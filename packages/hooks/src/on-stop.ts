/**
 * on-stop — Claude Code Stop hook (cross-platform TypeScript replacement for on-stop.sh)
 *
 * Called by Claude Code after every completed turn.
 * Detects agents killed mid-turn (SIGKILL / Ctrl+C) where no turn_duration line
 * was written, so the file watcher couldn't transition the agent to "idle".
 *
 * Strategy:
 *   1. Resolve the agent ID for the current working directory.
 *   2. Wait 3 s to let the file watcher process a turn_duration line (clean exit).
 *   3. Re-check the agent's status.
 *   4. If still in an active status → turn_duration was never written → emit agent.disconnected.
 *
 * Stdin: JSON with { session_id, cwd, ... } from Claude Code.
 */
import { fileURLToPath } from "node:url";
import { resolveAgentId } from "./lib/agent-resolver.js";
import { deriveRunId } from "./lib/run-id.js";

const ACTIVE_STATUSES = new Set(["working", "awaiting_input", "delegating", "starting"]);
const WAIT_MS = 3000;

// ── Dependency interface (injectable for testing) ─────────────────────────

export interface OnStopDeps {
  readStdin: () => Promise<string>;
  resolveAgentId: (cwd: string, apiUrl: string) => Promise<string | null>;
  getAgentStatus: (agentId: string, apiUrl: string) => Promise<string | null>;
  postDisconnect: (
    agentId: string,
    runId: string,
    cwd: string,
    apiUrl: string
  ) => Promise<void>;
  sleep: (ms: number) => Promise<void>;
  getCwd: () => string;
  getApiUrl: () => string;
}

// ── Core logic ────────────────────────────────────────────────────────────

export async function runOnStop(deps: OnStopDeps): Promise<void> {
  const apiUrl = deps.getApiUrl();
  const cwd = deps.getCwd();

  // Parse session_id from stdin — treat any read/parse failure as missing session_id
  let sessionId = "";
  try {
    const rawInput = await deps.readStdin();
    const parsed = JSON.parse(rawInput) as { session_id?: string };
    sessionId = parsed.session_id ?? "";
  } catch {
    // stdin error or invalid JSON — proceed without a session_id
  }

  // Resolve agent ID: temp file → API fallback
  const agentId = await deps.resolveAgentId(cwd, apiUrl);
  if (!agentId) return; // No agent found — nothing to do

  // Wait for file watcher to process turn_duration if the turn completed cleanly.
  // The file watcher has a 100 ms stabilityThreshold + read time + HTTP round-trip;
  // 3 s is comfortable headroom even on a slow machine.
  await deps.sleep(WAIT_MS);

  // Check the agent's current status
  const status = await deps.getAgentStatus(agentId, apiUrl);

  // Already idle / disconnected → clean exit, file watcher handled it
  if (!status || !ACTIVE_STATUSES.has(status)) return;

  // Still active → turn_duration was never written → Claude was killed mid-turn
  const runId = sessionId ? deriveRunId(sessionId) : `run_stop_${Date.now()}`;
  await deps.postDisconnect(agentId, runId, cwd, apiUrl);
}

// ── Production defaults ───────────────────────────────────────────────────

async function readStdin(): Promise<string> {
  try {
    const chunks: string[] = [];
    process.stdin.setEncoding("utf8");
    for await (const chunk of process.stdin) {
      chunks.push(chunk as string);
    }
    return chunks.join("") || "{}";
  } catch {
    return "{}";
  }
}

async function getAgentStatus(
  agentId: string,
  apiUrl: string
): Promise<string | null> {
  try {
    const res = await fetch(`${apiUrl}/api/agents/${agentId}`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;
    const agent = (await res.json()) as { status?: string };
    return agent.status ?? null;
  } catch {
    return null;
  }
}

async function postDisconnect(
  agentId: string,
  runId: string,
  cwd: string,
  apiUrl: string
): Promise<void> {
  const event = {
    type: "agent.disconnected",
    agent_id: agentId,
    run_id: runId,
    ts: new Date().toISOString(),
    summary: "Agent session ended (stop hook)",
    status: "disconnected",
    agent_metadata: { cwd, source: "cli" },
  };
  try {
    await fetch(`${apiUrl}/api/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Non-fatal — server may be unavailable
  }
}

// ── Entry point ───────────────────────────────────────────────────────────

const isDirectRun =
  typeof process.argv[1] === "string" &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectRun) {
  const deps: OnStopDeps = {
    readStdin,
    resolveAgentId: (cwd, apiUrl) => resolveAgentId(cwd, apiUrl),
    getAgentStatus,
    postDisconnect,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    getCwd: () => process.env.PWD ?? process.cwd(),
    getApiUrl: () => process.env.MARIONETTE_API_URL ?? "http://localhost:8787",
  };

  runOnStop(deps).catch((err) => {
    console.error("[on-stop]", err);
    process.exit(1);
  });
}
