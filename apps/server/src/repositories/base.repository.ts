import { DatabaseClient } from "../db.js";

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
  protected safeStringify(obj: any): string | null {
    return obj ? JSON.stringify(obj) : null;
  }

  /**
   * Safely parse a JSON string, returning undefined for null/undefined/empty strings
   */
  protected safeParse<T>(str: string | null): T | undefined {
    return str ? JSON.parse(str) : undefined;
  }
}
