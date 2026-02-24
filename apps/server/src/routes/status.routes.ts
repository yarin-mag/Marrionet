import { Router } from "express";
import type { WebSocketService } from "../services/websocket.service.js";
import { StatusController } from "../controllers/status.controller.js";
import { AgentsController } from "../controllers/agents.controller.js";
import { EventsController } from "../controllers/events.controller.js";
import { asyncHandler } from "../middleware/async-handler.js";

export function createStatusRoutes(wsService?: WebSocketService) {
  const router = Router();
  const statusController = new StatusController();
  const agentsController = new AgentsController();
  const eventsController = new EventsController();

  if (wsService) {
    agentsController.setWebSocketService(wsService);
    eventsController.setWebSocketService(wsService);
  }

  router.get("/health", asyncHandler(statusController.healthCheck.bind(statusController)));
  router.get("/status", asyncHandler(statusController.getStatus.bind(statusController)));
  router.post("/agent-status", asyncHandler(agentsController.updateStatus.bind(agentsController)));
  router.get("/agents/:agentId/events", asyncHandler(eventsController.getAgentEvents.bind(eventsController)));

  return router;
}
