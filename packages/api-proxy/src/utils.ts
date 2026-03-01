import type { IncomingMessage } from "node:http";

/** Maximum request body size: 20 MB (generous headroom above Anthropic's ~10 MB limit) */
const MAX_BODY_BYTES = 20 * 1024 * 1024;

/**
 * Collect the full request body into a Buffer.
 * Throws if the body exceeds MAX_BODY_BYTES to prevent unbounded memory growth.
 */
export async function collectBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    totalBytes += buf.length;
    if (totalBytes > MAX_BODY_BYTES) {
      req.destroy(new Error(`Request body exceeds ${MAX_BODY_BYTES} byte limit`));
      throw new Error(`Request body too large (limit: ${MAX_BODY_BYTES} bytes)`);
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}
