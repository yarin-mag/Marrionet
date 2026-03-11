import type { MarionetteEvent, AgentMetadata, AgentStatus } from "@marionette/shared";
import type { ClaudeJsonlEntry } from "./types.js";
import { buildBase } from "./id-helpers.js";

/** Returns true if the assistant message content contains at least one tool_use block. */
export function entryHasToolUse(entry: ClaudeJsonlEntry): boolean {
  const content = entry.message?.content;
  if (!Array.isArray(content)) return false;
  return (content as unknown[]).some(
    (block) =>
      typeof block === "object" &&
      block !== null &&
      (block as Record<string, unknown>)["type"] === "tool_use"
  );
}

/** Emitted when an assistant message contains a tool_use block — Claude is waiting for approval. */
export function buildAwaitingInputEvent(
  entry: ClaudeJsonlEntry,
  filePath: string,
  runId: string,
  source?: AgentMetadata['source']
): MarionetteEvent {
  const base = buildBase(entry, filePath, runId, source);
  return {
    ...base,
    type: "agent.status",
    summary: "Waiting for tool permission",
    status: "awaiting_input" as AgentStatus,
  } as MarionetteEvent;
}

/** Emitted when a tool_result user entry arrives — tool was approved/denied, Claude continues. */
export function buildToolResultEvent(
  entry: ClaudeJsonlEntry,
  filePath: string,
  runId: string,
  source?: AgentMetadata['source']
): MarionetteEvent {
  const base = buildBase(entry, filePath, runId, source);
  return {
    ...base,
    type: "agent.status",
    summary: "Tool permission response received",
    status: "working" as AgentStatus,
  } as MarionetteEvent;
}
