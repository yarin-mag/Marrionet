import { homedir } from "node:os";
import { join } from "node:path";

export const config = {
  claudeDir: join(homedir(), ".claude"),
  projectsDir: join(homedir(), ".claude", "projects"),
  apiUrl: process.env.MARIONETTE_API_URL ?? "http://localhost:8787",
  archiveDir:
    process.env.MARIONETTE_ARCHIVE_DIR ??
    join(homedir(), ".marionette", "session-archives"),

  get eventsUrl(): string {
    return `${this.apiUrl}/api/events`;
  },
} as const;

export const WORKING_INACTIVITY_THRESHOLD_MS = Number(
  process.env.MARIONETTE_WORKING_INACTIVITY_MS ?? 15 * 60 * 1000
);
export const IDLE_INACTIVITY_THRESHOLD_MS = Number(
  process.env.MARIONETTE_IDLE_INACTIVITY_MS ?? 30 * 60 * 1000
);
export const INACTIVITY_CHECK_INTERVAL_MS = Number(
  process.env.MARIONETTE_INACTIVITY_CHECK_MS ?? 2 * 60 * 1000
);
