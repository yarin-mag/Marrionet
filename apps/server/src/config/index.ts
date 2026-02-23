/**
 * Centralized configuration management
 * All environment variables and constants in one place
 */
export const config = {
  port: parseInt(process.env.PORT || "8787", 10),

  database: {
    url: process.env.DATABASE_URL || "sqlite:db/marionette.db",
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },

  websocket: {
    heartbeatIntervalMs: 30000,
    idleCheckIntervalMs: 30000,
    idleTimeoutMinutes: 2,
  },

  hooks: {
    debounceMs: 200,
  },

  api: {
    maxEventsLimit: 2000,
    defaultEventsLimit: 500,
    jsonBodyLimit: "2mb",
  },

  jira: {
    ticketRegex: /\b([A-Z][A-Z0-9]+-\d+)\b/g,
    ticketFormat: /^[A-Z][A-Z0-9]+-\d+$/,
  },
} as const;
