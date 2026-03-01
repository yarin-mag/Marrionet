/**
 * on-error — Claude Code Notification hook (cross-platform replacement for on-error.sh)
 *
 * Emits a log.error MarionetteEvent when Claude Code fires a Notification hook
 * for an error or alert.
 *
 * Stdin: JSON with { session_id, message, title, cwd } from Claude Code.
 */
import { fileURLToPath } from "node:url";
import { resolveAgentId } from "./lib/agent-resolver.js";
import { deriveRunId } from "./lib/run-id.js";

export interface OnErrorDeps {
  readStdin: () => Promise<string>;
  resolveAgentId: (cwd: string, apiUrl: string) => Promise<string | null>;
  postErrorEvent: (
    agentId: string,
    runId: string,
    summary: string,
    message: string,
    apiUrl: string
  ) => Promise<void>;
  getCwd: () => string;
  getApiUrl: () => string;
}

export async function runOnError(deps: OnErrorDeps): Promise<void> {
  const apiUrl = deps.getApiUrl();
  const cwd = deps.getCwd();

  const rawInput = await deps.readStdin();
  let sessionId = "";
  let message = "Unknown error";
  let title = "";
  try {
    const parsed = JSON.parse(rawInput) as {
      session_id?: string;
      message?: string;
      title?: string;
    };
    sessionId = parsed.session_id ?? "";
    message = parsed.message ?? "Unknown error";
    title = parsed.title ?? "";
  } catch {
    // proceed with defaults
  }

  const agentId = await deps.resolveAgentId(cwd, apiUrl);
  if (!agentId) return;

  const runId = sessionId ? deriveRunId(sessionId) : `run_error_${Date.now()}`;
  const summary = title ? `${title}: ${message}` : message;

  await deps.postErrorEvent(agentId, runId, summary, message, apiUrl);
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

async function postErrorEvent(
  agentId: string,
  runId: string,
  summary: string,
  message: string,
  apiUrl: string
): Promise<void> {
  const event = {
    type: "log.error",
    agent_id: agentId,
    run_id: runId,
    ts: new Date().toISOString(),
    summary,
    error: { message, recoverable: true },
  };
  try {
    await fetch(`${apiUrl}/api/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(5000),
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
  const deps: OnErrorDeps = {
    readStdin,
    resolveAgentId: (cwd, apiUrl) => resolveAgentId(cwd, apiUrl),
    postErrorEvent,
    getCwd: () => process.env.PWD ?? process.cwd(),
    getApiUrl: () => process.env.MARIONETTE_API_URL ?? "http://localhost:8787",
  };

  runOnError(deps).catch((err) => {
    console.error("[on-error]", err);
    process.exit(1);
  });
}
