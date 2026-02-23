import express from "express";
import cors from "cors";
import { errorHandler } from "./middleware/error-handler.js";
import { logger } from "./utils/logger.js";
import { config } from "./config/index.js";

/**
 * Create and configure the Express application
 * Routes should be mounted separately after WebSocket service is initialized
 */
export function createApp() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: config.api.jsonBodyLimit }));

  // Request logging middleware
  app.use((req, res, next) => {
    logger.debug(`${req.method} ${req.path}`);
    next();
  });

  return app;
}

/**
 * Mount error handler (must be called after routes are mounted)
 */
export function mountErrorHandler(app: express.Application) {
  app.use(errorHandler);
}
