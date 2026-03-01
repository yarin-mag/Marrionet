import type { MarionetteEvent } from "@marionette/shared";
import { config } from "./config.js";

interface LlmCallEventParams {
  agentId: string;
  runId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  stopReason: string;
  durationMs: number;
  ttftMs: number | null;
  streaming: boolean;
  messagesCount: number;
  hasSystemPrompt: boolean;
  toolsCount: number;
  costUsd: number;
}

export function buildLlmCallEvent(params: LlmCallEventParams): MarionetteEvent {
  const totalTokens = params.inputTokens + params.outputTokens;

  return {
    type: "llm.call",
    run_id: params.runId,
    agent_id: params.agentId,
    ts: new Date().toISOString(),
    summary: `API call: ${params.model}`,
    duration_ms: params.durationMs,
    tokens: {
      input_tokens: params.inputTokens,
      output_tokens: params.outputTokens,
      total_tokens: totalTokens,
      cost_usd: params.costUsd,
      raw: {
        cache_read_input_tokens: params.cacheReadTokens,
        cache_creation_input_tokens: params.cacheCreationTokens,
      },
    },
    payload: {
      model: params.model,
      stop_reason: params.stopReason,
      streaming: params.streaming,
      ttft_ms: params.ttftMs,
      messages_count: params.messagesCount,
      has_system_prompt: params.hasSystemPrompt,
      tools_count: params.toolsCount,
      source: "api-proxy",
    },
  };
}

export async function emitEvent(event: MarionetteEvent): Promise<void> {
  const url = `${config.marionetteApiUrl}/api/events`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
    });
  } catch (err) {
    // Non-fatal — monitoring failure must not interrupt the proxy
    console.error("[api-proxy] Failed to emit event:", err);
  }
}
