import "dotenv/config";
import { createApp, mountErrorHandler } from "./app.js";
import { DatabaseClient } from "./db.js";
import { WebSocketService } from "./services/websocket.service.js";
import { AgentService } from "./services/agent.service.js";
import { EventService } from "./services/event.service.js";
import { CommandService } from "./services/command.service.js";
import { createApiRoutes } from "./routes/index.js";
import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";
import express from "express";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Main entry point for the Marionette server
 */
async function main() {
  // Initialize database connection pool
  DatabaseClient.initialize();

  // Create base app with middleware
  const app = createApp();

  // Start HTTP server
  const server = app.listen(config.port, () => {
    logger.info(`Server listening on http://localhost:${config.port}`);
    logger.info(`SSE stream: http://localhost:${config.port}/stream`);
  });

  // Initialize WebSocket service (agent-stream) + SSE dashboard stream
  const wsService = new WebSocketService(server);
  wsService.start();
  app.get("/stream", (req, res) => wsService.handleSseConnection(req, res));

  // Initialize shared service instances
  const agentService = new AgentService();
  const eventService = new EventService();
  const commandService = new CommandService(agentService, eventService);

  // Mount API routes with services injected
  app.use("/api", createApiRoutes(wsService, commandService));

  // Serve web app static files in production
  const webDist = process.env.WEB_DIST ?? resolve(__dirname, "../web");
  if (existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get("*", (_req, res) => res.sendFile(resolve(webDist, "index.html")));
  }

  // Mount error handler (must be after routes)
  mountErrorHandler(app);

  // Graceful shutdown
  process.on("SIGINT", () => {
    logger.info("Shutting down...");

    // Force exit after 5 s if graceful shutdown stalls (e.g. open keep-alive connections)
    const forceExit = setTimeout(() => {
      logger.warn("Graceful shutdown timed out — forcing exit");
      process.exit(1);
    }, 5000);
    forceExit.unref(); // don't keep the event loop alive for this alone

    try {
      wsService.close();
    } catch (err) {
      logger.error("Error closing WebSocket service:", err);
    }

    server.close(() => {
      logger.info("Server closed");
      clearTimeout(forceExit);
      process.exit(0);
    });
  });
}

// Start the server
main().catch((err) => {
  logger.error("Fatal error:", err);
  process.exit(1);
});
