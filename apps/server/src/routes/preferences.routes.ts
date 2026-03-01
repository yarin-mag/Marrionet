import { Router } from "express";
import { PreferencesController } from "../controllers/preferences.controller.js";
import { asyncHandler } from "../middleware/async-handler.js";

export function createPreferencesRoutes() {
  const router = Router();
  const controller = new PreferencesController();

  router.get("/", asyncHandler(controller.getPreferences.bind(controller)));
  router.put("/", asyncHandler(controller.setPreferences.bind(controller)));

  return router;
}
