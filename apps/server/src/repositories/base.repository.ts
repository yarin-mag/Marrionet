import { DatabaseClient } from "../db.js";
import { logger } from "../utils/logger.js";

/**
 * Base repository class with common database operations
 * All repositories should extend this class
 */
export abstract class BaseRepository {
  protected query = DatabaseClient.query.bind(DatabaseClient);
  protected queryOne = DatabaseClient.queryOne.bind(DatabaseClient);

  /**
   * Safely stringify an object to JSON, returning null for null/undefined
   */
  protected safeStringify(obj: unknown): string | null {
    if (obj == null) return null;
    try {
      return JSON.stringify(obj);
    } catch {
      return null;
    }
  }

  /**
   * Safely parse a JSON string, returning undefined for null/undefined/empty strings or parse errors
   */
  protected safeParse<T>(str: string | null): T | undefined {
    if (!str) return undefined;
    try {
      return JSON.parse(str) as T;
    } catch (err) {
      logger.warn("safeParse: failed to parse stored JSON", { str: str.slice(0, 80), err });
      return undefined;
    }
  }
}
