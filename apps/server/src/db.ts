import Database from "better-sqlite3";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Bump this integer whenever db/schema.sql changes. */
const CURRENT_SCHEMA_VERSION = 5;

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

      // Ensure the directory exists (critical for ~/.marionette/ on first run)
      mkdirSync(path.dirname(dbPath), { recursive: true });

      logger.info(`Connecting to SQLite database: ${dbPath}`);

      this.db = new Database(dbPath);

      // Enable WAL mode for better concurrency
      this.db.pragma("journal_mode = WAL");

      this.db.pragma("foreign_keys = ON");

      logger.info("SQLite database connected");

      // Auto-migrate: reset and apply schema if it's outdated
      this.autoMigrate();
    }
  }

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
    //   Release layout: dist/ lives beside db/ → ../db/schema.sql
    //   Dev layout:     apps/server/dist/ → ../../../db/schema.sql (project root)
    const releasePath = path.join(__dirname, "../db/schema.sql");
    const devPath = path.join(__dirname, "../../../db/schema.sql");
    const schemaPath = existsSync(releasePath) ? releasePath : devPath;
    const schema = readFileSync(schemaPath, "utf-8");

    // Execute the schema in one call — better-sqlite3's exec() handles
    // multiple semicolon-delimited statements natively and is immune to
    // semicolons inside string literals.
    this.db.exec(schema);

    this.db.pragma(`user_version = ${CURRENT_SCHEMA_VERSION}`);

    if (needsReset) {
      logger.info("Database schema reset and applied successfully");
    } else {
      logger.info("Database schema is current");
    }
  }

  /**
   * Returns true if the current on-disk schema matches what the code expects.
   * Uses SQLite's built-in user_version PRAGMA — a stable integer stored in the
   * DB header, immune to schema reformatting or comment changes.
   * Bump CURRENT_SCHEMA_VERSION whenever db/schema.sql changes.
   */
  private static schemaIsCurrent(): boolean {
    try {
      const ver = this.db.pragma("user_version", { simple: true }) as number;
      return ver === CURRENT_SCHEMA_VERSION;
    } catch {
      return false;
    }
  }

  /**
   * Execute a SQL query and return all rows
   * Converts PostgreSQL-style placeholders ($1, $2) to SQLite-style (?, ?)
   */
  static async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const [sqliteSql, boundParams] = this.convertPlaceholders(sql, params);

    try {
      const stmt = this.db.prepare(sqliteSql);
      const upper = sqliteSql.trimStart().toUpperCase();
      const isSelect = upper.startsWith('SELECT') || upper.startsWith('WITH');
      const hasReturning = upper.includes('RETURNING');

      if (isSelect || hasReturning) {
        const rows = stmt.all(...boundParams) as T[];
        (rows as any).rowCount = rows.length;
        return rows;
      } else {
        const result = stmt.run(...boundParams);
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
    const [sqliteSql, boundParams] = this.convertPlaceholders(sql, params);

    try {
      const stmt = this.db.prepare(sqliteSql);
      const row = stmt.get(...boundParams) as T | undefined;
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
    const [sqliteSql, boundParams] = this.convertPlaceholders(sql, params);

    try {
      const stmt = this.db.prepare(sqliteSql);
      return stmt.run(...boundParams);
    } catch (err) {
      logger.error(`Run error: ${sqliteSql}`, err);
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
   * Convert PostgreSQL-style placeholders ($1, $2) to SQLite-style (?, ?).
   * Reorders the params array to match the textual order of $N references,
   * so non-sequential usage (e.g. `$2 AND $1`) binds correctly.
   */
  private static convertPlaceholders(sql: string, params: any[]): [string, any[]] {
    const reordered: any[] = [];
    const converted = sql.replace(/\$(\d+)/g, (_, n) => {
      reordered.push(params[Number(n) - 1]);
      return '?';
    });
    return [converted, reordered];
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
