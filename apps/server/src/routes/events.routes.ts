import { Router } from "express";
import type { WebSocketService } from "../services/websocket.service.js";
import { EventsController } from "../controllers/events.controller.js";
import { asyncHandler } from "../middleware/async-handler.js";

export function createEventsRoutes(wsService?: WebSocketService) {
  const router = Router();
  const controller = new EventsController();

  if (wsService) controller.setWebSocketService(wsService);

  router.get("/", asyncHandler(controller.getEvents.bind(controller)));
  router.post("/", asyncHandler(controller.ingestEvents.bind(controller)));

  return router;
}
