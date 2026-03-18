import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseClient } from "./db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
  console.log("[migrate] running SQLite migrations...");

  try {
    // Initialize database connection
    DatabaseClient.initialize();
    const db = DatabaseClient.getDb();

    // Read and execute schema.sql from root db directory
    const schemaPath = join(__dirname, "../../../db/schema.sql");
    const schema = await readFile(schemaPath, "utf-8");

    // Split by semicolons and execute each statement
    const statements = schema
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      db.exec(statement);
    }

    console.log("[migrate] ✓ SQLite schema applied successfully");

    // M001: add 'delegating' to agents.status CHECK constraint
    // SQLite can't ALTER a CHECK constraint — detect the old schema and rebuild if needed.
    const agentsSchema = db.prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='agents'"
    ).get() as { sql: string } | undefined;
    if (agentsSchema && !agentsSchema.sql.includes("'delegating'")) {
      console.log("[migrate] M001: rebuilding agents table to add 'delegating' status...");
      db.exec(`
        PRAGMA foreign_keys = OFF;
        BEGIN;
        CREATE TABLE agents_new (
          agent_id TEXT PRIMARY KEY,
          agent_name TEXT,
          status TEXT DEFAULT 'working' CHECK (status IN ('working', 'starting', 'blocked', 'idle', 'finished', 'disconnected', 'crashed', 'error', 'awaiting_input', 'delegating')),
          terminal TEXT,
          cwd TEXT,
          last_activity TIMESTAMP,
          session_start TIMESTAMP,
          metadata TEXT,
          current_run_id TEXT,
          current_task TEXT,
          current_session_id TEXT,
          total_runs INTEGER DEFAULT 0,
          total_tasks INTEGER DEFAULT 0,
          total_errors INTEGER DEFAULT 0,
          total_tokens INTEGER DEFAULT 0,
          total_duration_ms INTEGER DEFAULT 0,
          session_runs INTEGER DEFAULT 0,
          session_errors INTEGER DEFAULT 0,
          session_tokens INTEGER DEFAULT 0,
          source_file TEXT,
          parent_agent_id TEXT REFERENCES agents_new(agent_id) ON DELETE SET NULL,
          is_subagent INTEGER DEFAULT 0,
          status_since TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO agents_new SELECT * FROM agents;
        DROP TABLE agents;
        ALTER TABLE agents_new RENAME TO agents;
        COMMIT;
        PRAGMA foreign_keys = ON;
      `);
      console.log("[migrate] M001: ✓ done");
    }

    console.log("[migrate] ✓ all migrations complete");

    DatabaseClient.close();
    process.exit(0);
  } catch (err) {
    console.error("[migrate] ✗ migration failed:", err);
    try {
      DatabaseClient.close();
    } catch {
      // Ignore close errors
    }
    process.exit(1);
  }
}

migrate();
