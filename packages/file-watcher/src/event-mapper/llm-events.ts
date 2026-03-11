import type { MarionetteEvent, AgentMetadata } from "@marionette/shared";
import type { ClaudeJsonlEntry } from "./types.js";
import { buildBase } from "./id-helpers.js";

/**
 * Emitted immediately on each `type === "assistant"` JSONL entry.
 * Token counting is handled exclusively by the API proxy — this event
 * carries only model metadata for run tracking.
 */
export function buildLlmCallEvent(
  entry: ClaudeJsonlEntry,
  filePath: string,
  runId: string,
  source?: AgentMetadata['source']
): MarionetteEvent {
  const model = (entry.message as Record<string, unknown> | undefined)?.model as string | undefined;

  const base = buildBase(entry, filePath, runId, source);
  return {
    ...base,
    type: "llm.call",
    summary: "LLM API call",
    payload: {
      ...(base.payload as Record<string, unknown>),
      model,
    },
  } as MarionetteEvent;
}
