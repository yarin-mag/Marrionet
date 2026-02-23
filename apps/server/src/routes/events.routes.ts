import { Router } from "express";
import { EventsController } from "../controllers/events.controller.js";
import { asyncHandler } from "../middleware/async-handler.js";

/**
 * Create events routes with WebSocket service injection
 */
export function createEventsRoutes(wsService?: any) {
  const router = Router();
  const controller = new EventsController();

  // Inject WebSocket service
  if (wsService) {
    controller.setWebSocketService(wsService);
  }

  // Event endpoints
  router.get("/", asyncHandler(controller.getEvents.bind(controller)));
  router.post("/", asyncHandler(controller.ingestEvents.bind(controller)));

  return router;
}
