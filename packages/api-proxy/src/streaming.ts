import type { IncomingMessage } from "node:http";
import type { ServerResponse } from "node:http";

export interface AccumulatedUsage {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
  stop_reason: string;
  ttft_ms: number | null;
}

export async function proxyStreamingResponse(
  upstreamRes: IncomingMessage,
  clientRes: ServerResponse,
  startMs: number
): Promise<AccumulatedUsage> {
  const usage: AccumulatedUsage = {
    model: "",
    input_tokens: 0,
    output_tokens: 0,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
    stop_reason: "",
    ttft_ms: null,
  };

  // Forward status + headers (drop transfer-encoding so we can re-chunk freely)
  const forwardHeaders: Record<string, string | string[]> = {};
  for (const [key, val] of Object.entries(upstreamRes.headers)) {
    if (key.toLowerCase() !== "transfer-encoding" && val !== undefined) {
      forwardHeaders[key] = val as string | string[];
    }
  }
  clientRes.writeHead(upstreamRes.statusCode ?? 200, forwardHeaders);

  // Cap accumulated SSE text to avoid unbounded memory growth on large responses.
  // message_start (input tokens + model) always appears in the first SSE frame (<200 bytes).
  // message_delta (output tokens + stop_reason) appears in the last frame (<200 bytes).
  // 32 KB is generous headroom for both; chunks are forwarded to the client regardless.
  const MAX_ACCUMULATE_BYTES = 32 * 1024;

  return new Promise((resolve, reject) => {
    let accumulated = "";
    let accumulatedBytes = 0;
    let firstChunk = true;

    upstreamRes.on("data", (chunk: Buffer) => {
      if (firstChunk) {
        usage.ttft_ms = Date.now() - startMs;
        firstChunk = false;
      }
      clientRes.write(chunk);
      if (accumulatedBytes < MAX_ACCUMULATE_BYTES) {
        const str = chunk.toString("utf8");
        accumulated += str;
        accumulatedBytes += str.length;
      }
    });

    upstreamRes.on("end", () => {
      clientRes.end();
      parseSSEAccumulation(accumulated, usage);
      if (!usage.model) {
        console.warn("[api-proxy] streaming: model field not found in SSE stream (message_start missing or truncated)");
      }
      resolve(usage);
    });

    upstreamRes.on("error", reject);
    clientRes.on("error", () => {
      // Client disconnected — resolve with what we have
      parseSSEAccumulation(accumulated, usage);
      resolve(usage);
    });
  });
}

function parseSSEAccumulation(text: string, usage: AccumulatedUsage): void {
  const lines = text.split("\n");

  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    const jsonStr = line.slice(6).trim();
    if (jsonStr === "[DONE]") continue;

    try {
      const event = JSON.parse(jsonStr) as Record<string, unknown>;

      if (event.type === "message_start") {
        const msg = event.message as Record<string, unknown> | undefined;
        if (msg?.model) usage.model = msg.model as string;
        const u = msg?.usage as Record<string, number> | undefined;
        if (u) {
          usage.input_tokens = u.input_tokens ?? usage.input_tokens;
          usage.output_tokens = u.output_tokens ?? usage.output_tokens;
          usage.cache_read_input_tokens = u.cache_read_input_tokens ?? usage.cache_read_input_tokens;
          usage.cache_creation_input_tokens = u.cache_creation_input_tokens ?? usage.cache_creation_input_tokens;
        }
      }

      if (event.type === "message_delta") {
        const delta = event.delta as Record<string, unknown> | undefined;
        if (delta?.stop_reason) usage.stop_reason = delta.stop_reason as string;
        const u = event.usage as Record<string, number> | undefined;
        if (u?.output_tokens) usage.output_tokens = u.output_tokens;
      }
    } catch {
      // Ignore unparseable SSE lines
    }
  }
}

export async function proxyNonStreamingResponse(
  upstreamRes: IncomingMessage,
  clientRes: ServerResponse
): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];

  for await (const chunk of upstreamRes) {
    chunks.push(chunk as Buffer);
  }

  const bodyBuffer = Buffer.concat(chunks);

  const forwardHeaders: Record<string, string | string[]> = {};
  for (const [key, val] of Object.entries(upstreamRes.headers)) {
    if (val !== undefined) forwardHeaders[key] = val as string | string[];
  }
  clientRes.writeHead(upstreamRes.statusCode ?? 200, forwardHeaders);
  clientRes.end(bodyBuffer);

  try {
    return JSON.parse(bodyBuffer.toString("utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}
