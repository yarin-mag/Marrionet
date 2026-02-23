import type { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";

/**
 * Wrapper for async route handlers to automatically catch errors and pass to error middleware
 */
export const asyncHandler = (fn: Function) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Wrapper for async methods in classes to automatically catch and log errors
 */
export const asyncMethod = (fn: Function) =>
  async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (err) {
      logger.error("Async method error:", err);
      throw err;
    }
  };
