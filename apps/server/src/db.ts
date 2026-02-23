import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Database client class for SQLite with transaction support
 */
export class DatabaseClient {
  private static db: Database.Database;

  /**
   * Initialize the SQLite database connection
   */
  static initialize() {
    if (!this.db) {
      // Extract database path from connection string
      // Format: sqlite:path/to/db.db or sqlite:../db/marionette.db
      let dbPath = config.database.url.replace(/^sqlite:/, "");

      // If relative path, resolve it relative to project root
      // __dirname is apps/server/src, so go up 3 levels to reach project root
      if (!path.isAbsolute(dbPath)) {
        dbPath = path.resolve(__dirname, "../../..", dbPath);
      }

      logger.info(`Connecting to SQLite database: ${dbPath}`);

      this.db = new Database(dbPath);

      // Enable WAL mode for better concurrency
      this.db.pragma("journal_mode = WAL");

      // Enable foreign keys
      this.db.pragma("foreign_keys = ON");

      logger.info("SQLite database connected");

      // Auto-migrate: reset and apply schema if it's outdated
      this.autoMigrate();
    }
  }

  /**
   * Check whether the current schema is up to date, reset and reapply if not.
   * "Up to date" means the agents table has the agent_id column.
   */
  private static autoMigrate(): void {
    const needsReset = !this.schemaIsCurrent();

    if (needsReset) {
      logger.info("Database schema is outdated — dropping and recreating tables");
      this.db.pragma("foreign_keys = OFF");
      for (const table of ["messages", "events", "agents"]) {
        this.db.exec(`DROP TABLE IF EXISTS ${table}`);
      }
      this.db.pragma("foreign_keys = ON");
    }

    // Apply schema (CREATE TABLE IF NOT EXISTS — safe to run always)
    const schemaPath = path.join(__dirname, "../../../db/schema.sql");
    const schema = readFileSync(schemaPath, "utf-8");

    // Split on semicolons; skip blank/comment-only chunks
    const statements = schema
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.replace(/--[^\n]*/g, "").trim().length > 0);

    for (const stmt of statements) {
      this.db.exec(stmt);
    }

    if (needsReset) {
      logger.info("Database schema reset and applied successfully");
    } else {
      logger.info("Database schema is current");
    }
  }

  /**
   * Returns true if the agents table already has the expected agent_id column.
   */
  private static schemaIsCurrent(): boolean {
    try {
      this.db.prepare("SELECT agent_id FROM agents LIMIT 0").get();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Execute a SQL query and return all rows
   * Converts PostgreSQL-style placeholders ($1, $2) to SQLite-style (?, ?)
   */
  static async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    // Convert PostgreSQL placeholders to SQLite
    const sqliteSql = this.convertPlaceholders(sql);

    try {
      const stmt = this.db.prepare(sqliteSql);
      const upper = sqliteSql.trimStart().toUpperCase();
      const isSelect = upper.startsWith('SELECT') || upper.startsWith('WITH');
      const hasReturning = upper.includes('RETURNING');

      if (isSelect || hasReturning) {
        // Statement returns rows — use all()
        const rows = stmt.all(...params) as T[];
        (rows as any).rowCount = rows.length;
        return rows;
      } else {
        // INSERT/UPDATE/DELETE without RETURNING — use run()
        const result = stmt.run(...params);
        const rows: T[] = [];
        (rows as any).rowCount = result.changes;
        return rows;
      }
    } catch (err) {
      logger.error(`Query error: ${sqliteSql}`, err);
      throw err;
    }
  }

  /**
   * Execute a SQL query and return the first row or null
   */
  static async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const sqliteSql = this.convertPlaceholders(sql);

    try {
      const stmt = this.db.prepare(sqliteSql);
      const row = stmt.get(...params) as T | undefined;
      return row || null;
    } catch (err) {
      logger.error(`Query error: ${sqliteSql}`, err);
      throw err;
    }
  }

  /**
   * Execute an INSERT/UPDATE/DELETE query and return info
   */
  static async run(sql: string, params: any[] = []): Promise<Database.RunResult> {
    const sqliteSql = this.convertPlaceholders(sql);

    try {
      const stmt = this.db.prepare(sqliteSql);
      return stmt.run(...params);
    } catch (err) {
      logger.error(`Run error: ${sqliteSql}`, err);
      throw err;
    }
  }

  /**
   * Execute queries within a transaction
   */
  static async transaction<T>(
    callback: (db: Database.Database) => Promise<T>
  ): Promise<T> {
    try {
      this.db.exec("BEGIN");
      const result = await callback(this.db);
      this.db.exec("COMMIT");
      return result;
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  /**
   * Get the underlying database instance
   */
  static getDb(): Database.Database {
    return this.db;
  }

  /**
   * Convert PostgreSQL-style placeholders ($1, $2) to SQLite-style (?, ?)
   */
  private static convertPlaceholders(sql: string): string {
    // Replace PostgreSQL placeholders with SQLite placeholders
    // $1, $2, $3... → ?, ?, ?...
    return sql.replace(/\$(\d+)/g, () => '?');
  }

  /**
   * Close the database connection
   */
  static close() {
    if (this.db) {
      this.db.close();
      logger.info("Database connection closed");
    }
  }
}

// Initialize on module load
DatabaseClient.initialize();

// Backward compatibility exports
export const query = DatabaseClient.query.bind(DatabaseClient);
export const queryOne = DatabaseClient.queryOne.bind(DatabaseClient);
export const db = DatabaseClient.getDb();
