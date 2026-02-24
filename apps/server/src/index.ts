import "dotenv/config";
import { createApp, mountErrorHandler } from "./app.js";
import { DatabaseClient } from "./db.js";
import { WebSocketService } from "./services/websocket.service.js";
import { AgentService } from "./services/agent.service.js";
import { EventService } from "./services/event.service.js";
import { MessageService } from "./services/message.service.js";
import { CommandService } from "./services/command.service.js";
import { MessageRepository } from "./repositories/message.repository.js";
import { createApiRoutes } from "./routes/index.js";
import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";

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
    logger.info(`WebSocket: ws://localhost:${config.port}/stream`);
  });

  // Initialize WebSocket service
  const wsService = new WebSocketService(server);
  wsService.start();

  // Initialize shared service instances
  const agentService = new AgentService();
  const eventService = new EventService();
  const messageRepository = new MessageRepository();
  const commandService = new CommandService(agentService, eventService, messageRepository);
  const messageService = new MessageService(messageRepository, wsService, commandService);

  // Mount API routes with services injected
  app.use("/api", createApiRoutes(wsService, messageService));

  // Mount error handler (must be after routes)
  mountErrorHandler(app);

  // Start background task: periodically mark idle agents
  setInterval(async () => {
    try {
      const marked = await agentService.markIdleAgents();
      if (marked > 0) {
        // Notify dashboard clients
        wsService.broadcastToDashboard({ type: "agents_updated" });
      }
    } catch (err) {
      logger.error("Idle check error:", err);
    }
  }, config.websocket.idleCheckIntervalMs);

  logger.info(`Idle check interval: ${config.websocket.idleCheckIntervalMs / 1000}s`);

  // Graceful shutdown
  process.on("SIGINT", async () => {
    logger.info("Shutting down...");
    wsService.close();
    server.close(() => {
      logger.info("Server closed");
      process.exit(0);
    });
  });
}

// Start the server
main().catch((err) => {
  logger.error("Fatal error:", err);
  process.exit(1);
});
