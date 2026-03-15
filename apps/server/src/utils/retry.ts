import { logger } from "./logger.js";

interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  { maxAttempts = 10, baseDelayMs = 1000, maxDelayMs = 30000 }: RetryOptions = {}
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts) break;

      const delay = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
      logger.warn(`[retry] ${label} failed (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms:`, err);
      await new Promise((res) => setTimeout(res, delay));
    }
  }

  logger.error(`[retry] ${label} failed after ${maxAttempts} attempts:`, lastError);
  throw lastError;
}
