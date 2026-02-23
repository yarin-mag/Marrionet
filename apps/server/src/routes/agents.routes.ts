import { Router } from "express";
import { AgentsController } from "../controllers/agents.controller.js";
import { asyncHandler } from "../middleware/async-handler.js";

/**
 * Create agents routes with WebSocket service injection
 */
export function createAgentsRoutes(wsService?: any) {
  const router = Router();
  const controller = new AgentsController();

  // Inject WebSocket service
  if (wsService) {
    controller.setWebSocketService(wsService);
  }

  // Agent CRUD endpoints
  router.get("/", asyncHandler(controller.getAgents.bind(controller)));
  router.get("/:agentId", asyncHandler(controller.getAgent.bind(controller)));
  router.patch("/:agentId", asyncHandler(controller.updateMetadata.bind(controller)));

  // Agent cleanup endpoints
  router.delete("/crashed", asyncHandler(controller.deleteCrashed.bind(controller)));
  router.delete("/all", asyncHandler(controller.deleteAll.bind(controller)));

  return router;
}
