import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { registerAgent } from "./resolver.js";
import { handleMessagesPost, handlePassthrough } from "./handler.js";
import { collectBody } from "./utils.js";

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const urlPath = req.url ?? "/";
  const method = req.method ?? "GET";

  console.log(`[api-proxy] ${method} ${urlPath}`);

  // Health check
  if (urlPath === "/_health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // MCP registration endpoint
  if (urlPath === "/_register" && method === "POST") {
    const body = await collectBody(req);
    try {
      const { agent_id, run_id, cwd } = JSON.parse(body.toString("utf8")) as {
        agent_id: string;
        run_id: string;
        cwd: string;
      };
      registerAgent(agent_id, run_id, cwd);
      console.log(`[api-proxy] Agent registered: ${agent_id} (cwd: ${cwd})`);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    } catch {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON" }));
    }
    return;
  }

  // Anthropic messages endpoint — intercept for telemetry
  // Strip query string before matching (Claude Code appends ?beta=true etc.)
  const pathname = urlPath.split("?")[0];
  if (pathname === "/v1/messages" && method === "POST") {
    await handleMessagesPost(req, res);
    return;
  }

  // All other Anthropic API paths — transparent pass-through
  await handlePassthrough(req, res);
}

export function createServer(): http.Server {
  return http.createServer((req, res) => {
    handleRequest(req, res).catch((err: unknown) => {
      console.error("[api-proxy] Unhandled error:", err);
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "Internal proxy error" }));
      }
    });
  });
}
