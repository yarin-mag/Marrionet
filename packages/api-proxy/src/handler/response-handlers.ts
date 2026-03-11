import type { IncomingMessage, ServerResponse } from "node:http";
import { proxyStreamingResponse, proxyNonStreamingResponse } from "../streaming.js";
import { buildLlmCallEvent, emitEvent } from "../events.js";
import { calculateCost } from "../pricing.js";
import { tokenizeNewMessages } from "../message-cursor.js";

interface RequestParams {
  agentId: string;
  runId: string;
  model: string;
  messages: Array<{ role: string; content: unknown }>;
  messagesCount: number;
  hasSystemPrompt: boolean;
  toolsCount: number;
  startMs: number;
}

export async function handleStreamingResponse(
  upstreamRes: IncomingMessage,
  res: ServerResponse,
  params: RequestParams
): Promise<void> {
  const { agentId, runId, model, messages, messagesCount, hasSystemPrompt, toolsCount, startMs } = params;

  const usage = await proxyStreamingResponse(upstreamRes, res, startMs);
  const durationMs = Date.now() - startMs;

  console.log(`[api-proxy] usage: in=${usage.input_tokens} out=${usage.output_tokens} cache=${usage.cache_read_input_tokens}`);

  const resolvedModel = usage.model || model;
  const cost = calculateCost(resolvedModel, {
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    cache_read_input_tokens: usage.cache_read_input_tokens,
  });

  const messageTokens = tokenizeNewMessages(agentId, messages, usage.output_tokens);

  const event = buildLlmCallEvent({
    agentId,
    runId,
    model: resolvedModel,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadTokens: usage.cache_read_input_tokens,
    cacheCreationTokens: usage.cache_creation_input_tokens,
    stopReason: usage.stop_reason,
    durationMs,
    ttftMs: usage.ttft_ms,
    streaming: true,
    messagesCount,
    hasSystemPrompt,
    toolsCount,
    costUsd: cost,
    messageTokens,
  });

  emitEvent(event).catch((err) => {
    console.warn("[api-proxy] Failed to emit LLM call event (non-fatal):", err);
  });
}

export async function handleNonStreamingResponse(
  upstreamRes: IncomingMessage,
  res: ServerResponse,
  params: RequestParams
): Promise<void> {
  const { agentId, runId, model, messages, messagesCount, hasSystemPrompt, toolsCount, startMs } = params;

  const responseBody = await proxyNonStreamingResponse(upstreamRes, res);
  const durationMs = Date.now() - startMs;

  const usageRaw = responseBody.usage as Record<string, number> | undefined;
  const inputTokens = usageRaw?.input_tokens ?? 0;
  const outputTokens = usageRaw?.output_tokens ?? 0;
  const cacheReadTokens = usageRaw?.cache_read_input_tokens ?? 0;
  const cacheCreationTokens = usageRaw?.cache_creation_input_tokens ?? 0;
  const responseModel = typeof responseBody.model === "string" ? responseBody.model : model;
  const stopReason =
    typeof (responseBody as Record<string, unknown>).stop_reason === "string"
      ? String((responseBody as Record<string, unknown>).stop_reason)
      : "";

  const cost = calculateCost(responseModel, {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cache_read_input_tokens: cacheReadTokens,
  });

  const messageTokens = tokenizeNewMessages(agentId, messages, outputTokens);

  const event = buildLlmCallEvent({
    agentId,
    runId,
    model: responseModel,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    stopReason,
    durationMs,
    ttftMs: null,
    streaming: false,
    messagesCount,
    hasSystemPrompt,
    toolsCount,
    costUsd: cost,
    messageTokens,
  });

  emitEvent(event).catch((err) => {
    console.warn("[api-proxy] Failed to emit LLM call event (non-fatal):", err);
  });
}
