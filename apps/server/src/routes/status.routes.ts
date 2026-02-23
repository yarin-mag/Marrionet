import { Router } from "express";
import { StatusController } from "../controllers/status.controller.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { AgentsController } from "../controllers/agents.controller.js";
import { EventsController } from "../controllers/events.controller.js";

/**
 * Create status routes with WebSocket service injection
 */
export function createStatusRoutes(wsService?: any) {
  const router = Router();
  const statusController = new StatusController();
  const agentsController = new AgentsController();
  const eventsController = new EventsController();

  // Inject WebSocket service
  if (wsService) {
    agentsController.setWebSocketService(wsService);
    eventsController.setWebSocketService(wsService);
  }

  // Health check
  router.get("/health", asyncHandler(statusController.healthCheck.bind(statusController)));

  // System status
  router.get("/status", asyncHandler(statusController.getStatus.bind(statusController)));

  // Agent status update (for hooks)
  router.post("/agent-status", asyncHandler(agentsController.updateStatus.bind(agentsController)));

  // Agent events (nested route for backwards compatibility)
  router.get("/agents/:agentId/events", asyncHandler(eventsController.getAgentEvents.bind(eventsController)));

  return router;
}
