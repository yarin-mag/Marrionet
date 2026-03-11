import type { IncomingMessage, ServerResponse } from "node:http";
import { resolveAgent, resolveFallbackAgent } from "../resolver.js";
import { collectBody } from "../utils.js";
import { filterHeaders, forwardToAnthropic, collectRequestBody } from "./request-forwarder.js";
import { handleStreamingResponse, handleNonStreamingResponse } from "./response-handlers.js";

export async function handleMessagesPost(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const startMs = Date.now();

  const bodyBuffer = await collectRequestBody(req, res);
  if (!bodyBuffer) return;

  let requestBody: Record<string, unknown> = {};
  try {
    requestBody = JSON.parse(bodyBuffer.toString("utf8")) as Record<string, unknown>;
  } catch {
    // keep empty object
  }

  const isStreaming = requestBody.stream === true;
  const model = typeof requestBody.model === "string" ? requestBody.model : "unknown";
  const messages = Array.isArray(requestBody.messages)
    ? (requestBody.messages as Array<{ role: string; content: unknown }>)
    : [];
  const messagesCount = messages.length;
  const hasSystemPrompt = !!requestBody.system;
  const toolsCount = Array.isArray(requestBody.tools) ? requestBody.tools.length : 0;

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

  const params = { agentId, runId, model, messages, messagesCount, hasSystemPrompt, toolsCount, startMs };

  if (isStreaming) {
    await handleStreamingResponse(upstreamRes, res, params);
  } else {
    await handleNonStreamingResponse(upstreamRes, res, params);
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
