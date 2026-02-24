import { Router } from "express";
import type { WebSocketService } from "../services/websocket.service.js";
import { AgentsController } from "../controllers/agents.controller.js";
import { asyncHandler } from "../middleware/async-handler.js";

export function createAgentsRoutes(wsService?: WebSocketService) {
  const router = Router();
  const controller = new AgentsController();

  if (wsService) controller.setWebSocketService(wsService);

  router.get("/", asyncHandler(controller.getAgents.bind(controller)));
  router.get("/:agentId", asyncHandler(controller.getAgent.bind(controller)));
  router.patch("/:agentId", asyncHandler(controller.updateMetadata.bind(controller)));
  router.delete("/crashed", asyncHandler(controller.deleteCrashed.bind(controller)));
  router.delete("/all", asyncHandler(controller.deleteAll.bind(controller)));
  router.delete("/:agentId", asyncHandler(controller.deleteAgent.bind(controller)));

  return router;
}
