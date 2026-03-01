import { createServer } from "./server.js";
import { config } from "./config.js";

const server = createServer();

server.listen(config.port, config.host, () => {
  console.log(`[api-proxy] Listening on http://${config.host}:${config.port}`);
  console.log(`[api-proxy] Forwarding to ${config.anthropicUpstream}`);
  console.log(`[api-proxy] Reporting to ${config.marionetteApiUrl}`);
  console.log(`[api-proxy] Set ANTHROPIC_BASE_URL=http://localhost:${config.port} in Claude Code`);
});

process.on("SIGINT", () => {
  console.log("[api-proxy] Shutting down...");
  server.close(() => process.exit(0));
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
