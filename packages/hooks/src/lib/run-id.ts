import { createHash } from "node:crypto";

/**
 * Derive a stable run_id from a Claude session ID.
 * Must match the formula used by the file-watcher (deriveSessionRunId).
 * sha256("run:{sessionId}")[0:16] prefixed with "run_".
 */
export function deriveRunId(sessionId: string): string {
  const hash = createHash("sha256")
    .update(`run:${sessionId}`)
    .digest("hex")
    .slice(0, 16);
  return `run_${hash}`;
}
