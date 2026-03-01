import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";
import { config } from "./config.js";
import { resolveAgent, resolveFallbackAgent } from "./resolver.js";
import { proxyStreamingResponse, proxyNonStreamingResponse } from "./streaming.js";
import { buildLlmCallEvent, emitEvent } from "./events.js";
import { calculateCost } from "./pricing.js";
import { collectBody } from "./utils.js";

const HOP_BY_HOP_HEADERS = new Set(["connection", "keep-alive", "proxy-authorization"]);

function filterHeaders(
  headers: Record<string, string | string[] | undefined>
): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  for (const [key, val] of Object.entries(headers)) {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase()) && val !== undefined) {
      result[key] = val as string | string[];
    }
  }
  return result;
}

function forwardToAnthropic(
  method: string,
  urlPath: string,
  headers: Record<string, string | string[]>,
  body: Buffer
): Promise<IncomingMessage> {
  const upstream = new URL(urlPath, config.anthropicUpstream);
  const isHttps = upstream.protocol === "https:";
  const requester = isHttps ? httpsRequest : httpRequest;

  // Build clean headers for upstream
  const upstreamHeaders: Record<string, string | string[]> = { ...headers };
  upstreamHeaders["host"] = upstream.hostname;
  upstreamHeaders["content-length"] = String(body.length);
  // Remove proxy-specific headers
  delete upstreamHeaders["connection"];

  return new Promise((resolve, reject) => {
    const req = requester(
      {
        hostname: upstream.hostname,
        port: upstream.port || (isHttps ? 443 : 80),
        path: upstream.pathname + upstream.search,
        method,
        headers: upstreamHeaders,
      },
      resolve
    );
    req.on("error", reject);
    req.end(body);
  });
}

export async function handleMessagesPost(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const startMs = Date.now();

  let bodyBuffer: Buffer;
  try {
    bodyBuffer = await collectBody(req);
  } catch (err) {
    res.writeHead(413, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Request body too large", detail: String(err) }));
    return;
  }

  let requestBody: Record<string, unknown> = {};
  try {
    requestBody = JSON.parse(bodyBuffer.toString("utf8")) as Record<string, unknown>;
  } catch {
    // keep empty object
  }

  const isStreaming = requestBody.stream === true;
  const model = typeof requestBody.model === "string" ? requestBody.model : "unknown";
  const messagesCount = Array.isArray(requestBody.messages) ? requestBody.messages.length : 0;
  const hasSystemPrompt = !!requestBody.system;
  const toolsCount = Array.isArray(requestBody.tools) ? requestBody.tools.length : 0;

  // Build headers for upstream (pass-through, minus hop-by-hop)
  const forwardHeaders = filterHeaders(req.headers);

  let upstreamRes: IncomingMessage;
  try {
    upstreamRes = await forwardToAnthropic(
      req.method ?? "POST",
      req.url ?? "/v1/messages",
      forwardHeaders,
      bodyBuffer
    );
  } catch (err) {
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Upstream connection failed", detail: String(err) }));
    return;
  }

  const agentInfo = (await resolveAgent()) ?? await resolveFallbackAgent();
  const agentId = agentInfo?.agent_id ?? "unknown";
  const runId = agentInfo?.run_id ?? "unknown";

  console.log(`[api-proxy] /v1/messages → agent: ${agentId} streaming: ${isStreaming}`);

  if (isStreaming) {
    const usage = await proxyStreamingResponse(upstreamRes, res, startMs);
    const durationMs = Date.now() - startMs;

    console.log(`[api-proxy] usage: in=${usage.input_tokens} out=${usage.output_tokens} cache=${usage.cache_read_input_tokens}`);

    const cost = calculateCost(usage.model || model, {
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cache_read_input_tokens: usage.cache_read_input_tokens,
    });

    const event = buildLlmCallEvent({
      agentId,
      runId,
      model: usage.model || model,
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
    });

    emitEvent(event).catch((err) => {
      console.warn("[api-proxy] Failed to emit LLM call event (non-fatal):", err);
    });
  } else {
    const responseBody = await proxyNonStreamingResponse(upstreamRes, res);
    const durationMs = Date.now() - startMs;

    // Extract usage from non-streaming response
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
    });

    emitEvent(event).catch((err) => {
      console.warn("[api-proxy] Failed to emit LLM call event (non-fatal):", err);
    });
  }
}

/**
 * Generic pass-through for all other Anthropic API paths (e.g. /v1/models).
 */
export async function handlePassthrough(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const bodyBuffer = await collectBody(req);
  const forwardHeaders = filterHeaders(req.headers);

  let upstreamRes: IncomingMessage;
  try {
    upstreamRes = await forwardToAnthropic(
      req.method ?? "GET",
      req.url ?? "/",
      forwardHeaders,
      bodyBuffer
    );
  } catch (err) {
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Upstream connection failed", detail: String(err) }));
    return;
  }

  // Simple pass-through — buffer and return
  const chunks: Buffer[] = [];
  for await (const chunk of upstreamRes) {
    chunks.push(chunk as Buffer);
  }
  const body = Buffer.concat(chunks);

  const headers: Record<string, string | string[]> = {};
  for (const [key, val] of Object.entries(upstreamRes.headers)) {
    if (val !== undefined) headers[key] = val as string | string[];
  }
  res.writeHead(upstreamRes.statusCode ?? 200, headers);
  res.end(body);
}
