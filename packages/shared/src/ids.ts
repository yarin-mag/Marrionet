import { createHash } from "node:crypto";
import os from "node:os";

export function uid(prefix = "id"): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export function generateRunId(): string {
  return uid("run");
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
  suffix?: string; // Add unique suffix (e.g., run_id) for multiple instances
}): string {
  const hostname = opts?.hostname ?? os.hostname();
  const terminal = opts?.terminal ?? process.env.TERM_SESSION_ID ?? process.env.TERM ?? "default";
  const cwd = opts?.cwd ?? process.cwd();
  const suffix = opts?.suffix ?? "";

  // Create a hash from these values (include suffix for uniqueness)
  const hash = createHash("sha256")
    .update(`${hostname}:${terminal}:${cwd}:${suffix}`)
    .digest("hex")
    .slice(0, 16);

  return `agent_${hash}`;
}
