import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import type { IncomingMessage } from "node:http";
import { URL } from "node:url";
import { config } from "../config.js";
import { collectBody } from "../utils.js";
import type { ServerResponse } from "node:http";

const HOP_BY_HOP_HEADERS = new Set(["connection", "keep-alive", "proxy-authorization"]);

export function filterHeaders(
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

export function forwardToAnthropic(
  method: string,
  urlPath: string,
  headers: Record<string, string | string[]>,
  body: Buffer
): Promise<IncomingMessage> {
  const upstream = new URL(urlPath, config.anthropicUpstream);
  const isHttps = upstream.protocol === "https:";
  const requester = isHttps ? httpsRequest : httpRequest;

  const upstreamHeaders: Record<string, string | string[]> = { ...headers };
  upstreamHeaders["host"] = upstream.hostname;
  upstreamHeaders["content-length"] = String(body.length);
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

export async function collectRequestBody(req: IncomingMessage, res: ServerResponse): Promise<Buffer | null> {
  try {
    return await collectBody(req);
  } catch (err) {
    res.writeHead(413, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Request body too large", detail: String(err) }));
    return null;
  }
}
