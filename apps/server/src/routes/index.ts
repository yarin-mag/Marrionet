import { Router } from "express";
import { createAgentsRoutes } from "./agents.routes.js";
import { createEventsRoutes } from "./events.routes.js";
import { createStatusRoutes } from "./status.routes.js";
import { createMessagesRouter } from "./messages.routes.js";
import { createConversationRouter } from "./conversation.routes.js";
import { MessageService } from "../services/message.service.js";

/**
 * Create API routes with services injection
 */
export function createApiRoutes(wsService?: any, messageService?: MessageService) {
  const router = Router();

  // Mount route modules (pass services)
  router.use("/agents", createAgentsRoutes(wsService));
  router.use("/events", createEventsRoutes(wsService));

  // Conversation routes (if wsService is provided)
  if (wsService) {
    router.use("/conversation", createConversationRouter(wsService));
  }

  // Messages routes (if messageService is provided)
  if (messageService) {
    router.use("/", createMessagesRouter(messageService));
  }

  // Status routes are mounted at root for backwards compatibility
  router.use("/", createStatusRoutes(wsService));

  return router;
}
