import { basename } from "node:path";
import type { MarionetteEvent, AgentMetadata, AgentStatus } from "@marionette/shared";
import type { ClaudeJsonlEntry } from "./types.js";
import { deriveSessionRunId, buildBase } from "./id-helpers.js";

/**
 * Emitted when a new main-session JSONL file appears
 * (`projects/{slug}/{session-uuid}.jsonl`).
 *
 * `agentId` is resolved by the caller (from the MCP temp file when available,
 * or derived from `sessionId` as a fallback). Keeping it as a parameter lets
 * the caller use the stable MCP-server identity across `/clear` sessions.
 */
export function buildConversationStartedEvent(
  agentId: string,
  sessionId: string,
  filePath: string,
  cwd?: string,
  gitBranch?: string,
  source?: AgentMetadata['source'],
  terminal?: string
): MarionetteEvent {
  const runId = deriveSessionRunId(sessionId);

  return {
    agent_id: agentId,
    run_id: runId,
    type: "conversation.started",
    ts: new Date().toISOString(),
    summary: "New conversation session started",
    status: "starting" as AgentStatus,
    agent_metadata: {
      name: cwd ? basename(cwd) : "claude-session",
      cwd,
      source: source ?? "cli",
      ...(terminal ? { terminal } : {}),
    },
    payload: {
      sessionId,
      gitBranch,
      filePath,
      source: "file-watcher",
    },
  } as MarionetteEvent;
}

/**
 * Emitted when a new subagent JSONL file appears.
 */
export function buildAgentStartedEvent(
  entry: ClaudeJsonlEntry,
  filePath: string,
  stableRunId: string,
  source?: AgentMetadata['source']
): MarionetteEvent {
  const base = buildBase(entry, filePath, stableRunId, source);
  return {
    ...base,
    type: "agent.started",
    summary: `Subagent started: ${entry.slug ?? entry.agentId ?? "unknown"}`,
    status: "working" as AgentStatus,
  } as MarionetteEvent;
}

/**
 * Emitted when a watched JSONL file is removed.
 */
export function buildDisconnectedEvent(
  agentId: string,
  runId: string,
  metadata: AgentMetadata
): MarionetteEvent {
  return {
    agent_id: agentId,
    run_id: runId,
    type: "agent.disconnected",
    ts: new Date().toISOString(),
    summary: "Agent disconnected (file removed)",
    status: "disconnected" as AgentStatus,
    agent_metadata: metadata,
    payload: { source: "file-watcher" },
  } as MarionetteEvent;
}
