import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";

/**
 * Compute the path of the temp file used to share the MCP server's agent_id
 * with the file watcher. Must produce the same result as agentTempFilePath()
 * in packages/mcp-server/src/utils/agent-ids.ts.
 */
export function agentTempFilePath(cwd: string): string {
  const hash = createHash("sha256").update(cwd).digest("hex").slice(0, 8);
  return path.join(os.tmpdir(), `marionette-agent-${hash}`);
}

/**
 * Derive a stable agent ID from a Claude session ID.
 * Formula: sha256(sessionId)[0:16] prefixed with "agent_".
 * Used by both the file-watcher (event-mapper) and the MCP server (agent-ids)
 * to ensure they produce the same agent_id for the same session.
 * IMPORTANT: keep this as the single source of truth — do not duplicate the formula.
 */
export function deriveAgentIdFromSession(sessionId: string): string {
  const hash = createHash("sha256").update(sessionId).digest("hex").slice(0, 16);
  return `agent_${hash}`;
}

/**
 * Generate agent ID based on hostname + terminal session + optional suffix
 * If suffix is provided, makes each instance unique (for multiple agents in same location)
 * If suffix is omitted, creates persistent ID across runs (same agent gets same ID)
 */
export function generateAgentId(opts?: {
  hostname?: string;
  terminal?: string;
  cwd?: string;
  name?: string;
  suffix?: string;
}): string {
  const hostname = opts?.hostname ?? os.hostname();
  const terminal = opts?.terminal ?? process.env.TERM_SESSION_ID ?? process.env.TERM ?? "default";
  const cwd = opts?.cwd ?? process.cwd();
  const suffix = opts?.suffix ?? "";

  const hash = createHash("sha256")
    .update(`${hostname}:${terminal}:${cwd}:${suffix}`)
    .digest("hex")
    .slice(0, 16);

  return `agent_${hash}`;
}
