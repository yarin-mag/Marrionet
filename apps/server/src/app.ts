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

  // Middleware — restrict CORS to local origins and the GitHub Pages frontend
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Electron shell, same-origin) and
      // any localhost / 127.0.0.1 origin on any port.
      if (!origin || origin === "null" || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) || origin === "https://yarin-mag.github.io") {
        callback(null, true);
      } else {
        logger.warn(`CORS blocked origin: "${origin}"`);
        callback(new Error("CORS: origin not allowed"));
      }
    },
  }));
  app.use(express.json({ limit: config.api.jsonBodyLimit }));

  // Request logging middleware
  app.use((req, _res, next) => {
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
