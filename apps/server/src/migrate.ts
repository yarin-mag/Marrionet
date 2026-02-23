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
