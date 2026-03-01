import type { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";

/**
 * Global error handler middleware
 * Must be registered last in the middleware chain
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  logger.error(`Request error [${req.method} ${req.path}]:`, err);

  const statusCode = (err instanceof Error && "statusCode" in err)
    ? (err as Error & { statusCode: number }).statusCode
    : 500;
  const message = err.message || "Internal server error";

  res.status(statusCode).json({
    error: message,
    path: req.path,
    method: req.method
  });
};
