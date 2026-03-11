import { createHash } from "node:crypto";
import { basename } from "node:path";
import { deriveAgentIdFromSession } from "@marionette/shared/ids-node";
import type { MarionetteEvent, AgentMetadata } from "@marionette/shared";
import type { ClaudeJsonlEntry } from "./types.js";

/**
 * Derive a stable `agent_` prefixed ID from Claude's own agentId (subagents)
 * or from the sessionId (main session files).
 */
export function deriveAgentId(entry: ClaudeJsonlEntry, filePath: string): string {
  if (entry.agentId) {
    return `agent_${entry.agentId}`;
  }
  if (entry.sessionId) {
    return deriveAgentIdFromSession(entry.sessionId);
  }
  const hash = createHash("sha256").update(filePath).digest("hex").slice(0, 16);
  return `agent_${hash}`;
}

/**
 * Derive a stable session-level run_id (used for lifecycle events).
 * Per-run run_ids are generated fresh with `generateRunId()`.
 */
export function deriveSessionRunId(sessionId: string): string {
  const hash = createHash("sha256").update(`run:${sessionId}`).digest("hex").slice(0, 16);
  return `run_${hash}`;
}

export function buildMetadata(entry: ClaudeJsonlEntry, source?: AgentMetadata['source']): AgentMetadata {
  return {
    name: entry.slug ?? (entry.cwd ? basename(entry.cwd) : "claude-agent"),
    cwd: entry.cwd,
    version: entry.version,
    source: source ?? "cli",
  };
}

export function buildBase(
  entry: ClaudeJsonlEntry,
  filePath: string,
  runId: string,
  source?: AgentMetadata['source']
): Partial<MarionetteEvent> {
  return {
    agent_id: deriveAgentId(entry, filePath),
    run_id: runId,
    ts: entry.timestamp ?? new Date().toISOString(),
    agent_metadata: buildMetadata(entry, source),
    payload: {
      sessionId: entry.sessionId,
      gitBranch: entry.gitBranch,
      slug: entry.slug,
      cwd: entry.cwd,
      source: "file-watcher",
    },
  };
}
