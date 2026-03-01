import { Router } from "express";
import type { WebSocketService } from "../services/websocket.service.js";
import type { EventService } from "../services/event.service.js";
import { createAgentsRoutes } from "./agents.routes.js";
import { createEventsRoutes } from "./events.routes.js";
import { createStatusRoutes } from "./status.routes.js";
import { createPersonalTasksRoutes } from "./personal-tasks.routes.js";
import { createPreferencesRoutes } from "./preferences.routes.js";
import { CommandService } from "../services/command.service.js";

export function createApiRoutes(wsService?: WebSocketService, commandService?: CommandService, eventService?: EventService) {
  const router = Router();

  router.use("/agents", createAgentsRoutes(wsService, commandService));
  router.use("/events", createEventsRoutes(wsService, eventService));
  router.use("/personal-tasks", createPersonalTasksRoutes());
  router.use("/preferences", createPreferencesRoutes());

  // Status routes are mounted at root for backwards compatibility
  router.use("/", createStatusRoutes(wsService));

  return router;
}
