import { readdir, stat, readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { config } from "./config.js";

interface AgentRegistration {
  agent_id: string;
  run_id: string;
  cwd: string;
  ts: number;
}

const TTL_MS = 60 * 60 * 1000;

// Most recently registered agent (set via /_register)
let recentAgent: AgentRegistration | null = null;

export function registerAgent(agent_id: string, run_id: string, cwd: string): void {
  recentAgent = { agent_id, run_id, cwd, ts: Date.now() };
}

async function scanTempFile(): Promise<{ agent_id: string; run_id: string } | null> {
  const tmpdir = os.tmpdir();
  try {
    const files = (await readdir(tmpdir)).filter((f) => f.startsWith("marionette-agent-"));
    if (files.length === 0) return null;

    let latest: { file: string; mtime: number } | null = null;
    for (const file of files) {
      try {
        const st = await stat(path.join(tmpdir, file));
        if (!latest || st.mtimeMs > latest.mtime) {
          latest = { file, mtime: st.mtimeMs };
        }
      } catch {
        // skip inaccessible file
      }
    }

    if (!latest) return null;
    const content = (await readFile(path.join(tmpdir, latest.file), "utf8")).trim();
    if (!content) return null;
    return { agent_id: content, run_id: "unknown" };
  } catch {
    return null;
  }
}

// Lazy fallback cache — only stores successful (non-null) results.
// On null (empty DB or server not ready), we rate-limit retries to once per 500 ms
// so rapid API calls don't spam the server but recovery is near-instant.
let lazyCache: { result: { agent_id: string; run_id: string }; ts: number } | null = null;
let lastNullAttemptMs = 0;

export async function resolveFallbackAgent(): Promise<{ agent_id: string; run_id: string } | null> {
  // Cached hit — short TTL to avoid stale cross-agent attribution in multi-project setups
  if (lazyCache && Date.now() - lazyCache.ts < 1_000) {
    return lazyCache.result;
  }

  // Rate-limit null retries — at most one outbound fetch per 500 ms
  const now = Date.now();
  if (now - lastNullAttemptMs < 500) {
    return null;
  }
  lastNullAttemptMs = now;

  try {
    const res = await fetch(`${config.marionetteApiUrl}/api/agents`, {
      signal: AbortSignal.timeout(500),
    });
    if (!res.ok) return null;

    const agents = (await res.json()) as Array<{
      agent_id: string;
      current_run_id?: string;
      status: string;
      last_activity: string;
    }>;

    const candidate = agents
      .filter((a) => !["finished", "disconnected", "crashed"].includes(a.status))
      .sort((a, b) => new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime())[0];

    if (candidate) {
      lazyCache = {
        result: { agent_id: candidate.agent_id, run_id: candidate.current_run_id ?? "unknown" },
        ts: now,
      };
      return lazyCache.result;
    }
    return null;
  } catch {
    return null;
  }
}

/** Fast-path resolution: in-memory registration or temp file scan. */
export async function resolveAgent(): Promise<{ agent_id: string; run_id: string } | null> {
  if (recentAgent && Date.now() - recentAgent.ts < TTL_MS) {
    return { agent_id: recentAgent.agent_id, run_id: recentAgent.run_id };
  }
  return scanTempFile();
}
