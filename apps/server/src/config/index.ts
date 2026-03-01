import { homedir } from "os";
import { join } from "path";

/**
 * Centralized configuration management
 * All environment variables and constants in one place
 */
export const config = {
  port: parseInt(process.env.PORT || "8787", 10),

  database: {
    // In dev: set DATABASE_URL=sqlite:db/marionette.db in .env (see .env.example)
    // In production: defaults to ~/.marionette/marionette.db (works on all platforms)
    url: process.env.DATABASE_URL || `sqlite:${join(homedir(), ".marionette", "marionette.db")}`,
  },

  websocket: {
    heartbeatIntervalMs: 30000,
    idleCheckIntervalMs: 30000,
    idleTimeoutMinutes: 2,
    disconnectTimeoutMinutes: 10,
  },

  hooks: {
    debounceMs: 200,
  },

  api: {
    maxEventsLimit: 2000,
    defaultEventsLimit: 500,
    jsonBodyLimit: "2mb",
  },
} as const;
