import { generateRunId } from "@marionette/shared";
import type { MarionetteEvent, AgentMetadata, AgentStatus } from "@marionette/shared";
import type { ClaudeJsonlEntry } from "./types.js";
import { buildBase } from "./id-helpers.js";

/** Extract plain text from a JSONL message content field. */
function extractMessageText(content: unknown): string | null {
  if (typeof content === "string") return content || null;
  if (Array.isArray(content)) {
    const parts = (content as unknown[])
      .filter(
        (block): block is { type: string; text: string } =>
          typeof block === "object" &&
          block !== null &&
          (block as Record<string, unknown>)["type"] === "text" &&
          typeof (block as Record<string, unknown>)["text"] === "string"
      )
      .map((block) => block.text);
    return parts.length > 0 ? parts.join("\n") : null;
  }
  return null;
}

/**
 * Emitted on a `type === "user"` line — beginning of a Claude run.
 * Returns `[run.started event, fresh runId]`.
 */
export function buildRunStartedEvent(
  entry: ClaudeJsonlEntry,
  filePath: string,
  source?: AgentMetadata['source']
): [MarionetteEvent, string] {
  const runId = generateRunId();
  const base = buildBase(entry, filePath, runId, source);

  const raw = extractMessageText(entry.message?.content);
  const currentTask =
    raw && raw.length >= 20
      ? raw.slice(0, 120) + (raw.length > 120 ? "…" : "")
      : null;

  const event: MarionetteEvent = {
    ...base,
    type: "run.started",
    summary: "Agent run started",
    status: "working" as AgentStatus,
    payload: {
      ...(base.payload as Record<string, unknown>),
      ...(currentTask ? { current_task: currentTask } : {}),
    },
  } as MarionetteEvent;
  return [event, runId];
}

/**
 * Emitted on a `type === "system", subtype === "turn_duration"` line.
 * Status transitions to `"idle"` with duration only (tokens tracked per-call via llm.call).
 */
export function buildTurnEndedEvent(
  entry: ClaudeJsonlEntry,
  filePath: string,
  runId: string,
  durationMs: number,
  source?: AgentMetadata['source']
): MarionetteEvent {
  const base = buildBase(entry, filePath, runId, source);
  return {
    ...base,
    type: "run.ended",
    summary: "Agent turn completed",
    status: "idle" as AgentStatus,
    duration_ms: durationMs,
  } as MarionetteEvent;
}
