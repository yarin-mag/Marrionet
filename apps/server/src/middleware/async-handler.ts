import type { Request, Response, NextFunction, RequestHandler } from "express";
import { logger } from "../utils/logger.js";

type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export const asyncHandler = (fn: AsyncRequestHandler): RequestHandler =>
  (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const asyncMethod =
  <T extends unknown[]>(fn: (...args: T) => Promise<unknown>) =>
  async (...args: T): Promise<unknown> => {
    try {
      return await fn(...args);
    } catch (err) {
      logger.error("Async method error:", err);
      throw err;
    }
  };
