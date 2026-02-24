import { Router } from "express";
import { PersonalTasksController } from "../controllers/personal-tasks.controller.js";
import { asyncHandler } from "../middleware/async-handler.js";

export function createPersonalTasksRoutes() {
  const router = Router();
  const controller = new PersonalTasksController();

  router.get("/", asyncHandler(controller.list.bind(controller)));
  router.post("/", asyncHandler(controller.create.bind(controller)));
  router.get("/:id", asyncHandler(controller.getOne.bind(controller)));
  router.patch("/:id", asyncHandler(controller.update.bind(controller)));
  router.delete("/:id", asyncHandler(controller.remove.bind(controller)));

  return router;
}
