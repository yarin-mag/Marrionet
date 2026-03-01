/**
 * on-session-start — Claude Code PreToolUse hook (cross-platform replacement for on-session-start.sh)
 *
 * Registers this agent with the Marionette API proxy so token attribution works
 * correctly after a proxy restart or when the MCP server started before the proxy.
 *
 * Stdin: JSON with { session_id, cwd, tool_name, tool_input } from Claude Code.
 */
import { fileURLToPath } from "node:url";
import { resolveAgentId } from "./lib/agent-resolver.js";

export interface OnSessionStartDeps {
  readStdin: () => Promise<string>;
  resolveAgentId: (cwd: string, apiUrl: string) => Promise<string | null>;
  registerWithProxy: (
    agentId: string,
    runId: string,
    cwd: string,
    proxyUrl: string
  ) => Promise<void>;
  getCwd: () => string;
  getApiUrl: () => string;
  getProxyUrl: () => string;
}

export async function runOnSessionStart(deps: OnSessionStartDeps): Promise<void> {
  const apiUrl = deps.getApiUrl();
  const proxyUrl = deps.getProxyUrl();
  const cwd = deps.getCwd();

  const rawInput = await deps.readStdin();
  let sessionId = "";
  try {
    const parsed = JSON.parse(rawInput) as { session_id?: string };
    sessionId = parsed.session_id ?? "";
  } catch {
    // proceed without session_id
  }

  const agentId = await deps.resolveAgentId(cwd, apiUrl);
  if (!agentId) return;

  const runId = sessionId || `session_${Date.now()}`;
  await deps.registerWithProxy(agentId, runId, cwd, proxyUrl);
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

async function registerWithProxy(
  agentId: string,
  runId: string,
  cwd: string,
  proxyUrl: string
): Promise<void> {
  try {
    await fetch(`${proxyUrl}/_register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: agentId, run_id: runId, cwd }),
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // Non-fatal — proxy may not be running
  }
}

// ── Entry point ───────────────────────────────────────────────────────────

const isDirectRun =
  typeof process.argv[1] === "string" &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectRun) {
  const deps: OnSessionStartDeps = {
    readStdin,
    resolveAgentId: (cwd, apiUrl) => resolveAgentId(cwd, apiUrl),
    registerWithProxy,
    getCwd: () => process.env.PWD ?? process.cwd(),
    getApiUrl: () => process.env.MARIONETTE_API_URL ?? "http://localhost:8787",
    getProxyUrl: () => process.env.MARIONETTE_PROXY_URL ?? "http://localhost:8788",
  };

  runOnSessionStart(deps).catch((err) => {
    console.error("[on-session-start]", err);
    process.exit(1);
  });
}
