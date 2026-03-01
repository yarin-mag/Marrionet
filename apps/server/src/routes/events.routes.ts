import { Router } from "express";
import type { WebSocketService } from "../services/websocket.service.js";
import type { EventService } from "../services/event.service.js";
import { EventsController } from "../controllers/events.controller.js";
import { asyncHandler } from "../middleware/async-handler.js";

export function createEventsRoutes(wsService?: WebSocketService, eventService?: EventService) {
  const router = Router();
  const controller = new EventsController(eventService);

  if (wsService) controller.setWebSocketService(wsService);

  router.get("/", asyncHandler(controller.getEvents.bind(controller)));
  router.post("/", asyncHandler(controller.ingestEvents.bind(controller)));

  return router;
}
