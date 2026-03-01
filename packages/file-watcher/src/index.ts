#!/usr/bin/env node
import { config } from "./config.js";
import { startWatcher, scanHistoricalSessions } from "./watcher.js";
import { loadScannedSessions, markSessionsScanned, loadExcludedSessions } from "./scan-tracker.js";
import { buildDisconnectedEvent } from "./event-mapper.js";
import { log } from "./logger.js";
import type { MarionetteEvent, AgentMetadata } from "@marionette/shared";

async function postEvents(events: MarionetteEvent[], attempt = 1): Promise<void> {
  try {
    const response = await fetch(config.eventsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(events),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (err) {
    if (attempt >= 3) {
      log.error(`Dropping ${events.length} events after ${attempt} failed attempts:`, err);
      return;
    }
    const delayMs = 1000 * attempt;
    log.warn(`Emit failed (attempt ${attempt}) — retrying in ${delayMs}ms`);
    await new Promise((r) => setTimeout(r, delayMs));
    return postEvents(events, attempt + 1);
  }
}

async function emit(events: MarionetteEvent[]): Promise<void> {
  if (events.length === 0) return;

  log.info(
    `→ ${events.length} event(s): ${events.map((e) => `${e.type}[${e.agent_id?.slice(0, 12)}]`).join(", ")}`
  );

  try {
    await postEvents(events);
  } catch (err) {
    log.error("Failed to post events:", (err as Error).message);
  }
}

/**
 * Wait until the Marionette server is accepting requests.
 * In dev mode all services start concurrently, so the watcher can start
 * before the server has finished initialising. Without this gate the
 * historical scan's HTTP POSTs would silently fail.
 */
async function waitForServer(maxWaitMs = 30_000): Promise<void> {
  const healthUrl = `${config.apiUrl}/api/health`;
  const deadline = Date.now() + maxWaitMs;
  let attempt = 0;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(healthUrl, { signal: AbortSignal.timeout(2_000) });
      if (res.ok) {
        if (attempt > 0) log.info("Server is ready.");
        return;
      }
    } catch {
      // connection refused or timeout — server not up yet
    }
    attempt++;
    if (attempt === 1) log.info("Waiting for server to be ready...");
    await new Promise((r) => setTimeout(r, 500));
  }

  log.error(`Server did not become ready within ${maxWaitMs / 1000}s — proceeding anyway.`);
}

/**
 * Any agent not in a terminal status whose last_activity is older than this
 * is considered stale and will be swept to "disconnected" on startup.
 * 10 minutes gives the live watcher plenty of room to take over recently-active sessions.
 */
const STALE_THRESHOLD_MS = 15 * 60 * 1000; // align with watcher.ts WORKING_INACTIVITY_THRESHOLD_MS

/** Statuses that represent a finished lifecycle — never touched by the sweep. */
const TERMINAL_STATUSES = new Set(["disconnected", "finished", "crashed"]);

/**
 * After the historical scan has refreshed last_activity for newly-seen sessions,
 * mark any remaining non-terminal agent that hasn't been active within
 * STALE_THRESHOLD_MS as disconnected.
 * This cleans up agents left in "working" / "starting" etc. from previous
 * Marionette runs that were stopped while Claude was still active.
 */
async function sweepStaleAgents(): Promise<void> {
  try {
    const res = await fetch(`${config.apiUrl}/api/agents`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return;

    const agents = (await res.json()) as Array<{
      agent_id: string;
      status: string;
      last_activity: string;
      current_run_id?: string;
      agent_name?: string;
      metadata?: unknown;
    }>;

    const now = Date.now();
    const staleEvents: MarionetteEvent[] = [];

    for (const agent of agents) {
      if (TERMINAL_STATUSES.has(agent.status)) continue;
      const lastActivity = new Date(agent.last_activity).getTime();
      if (now - lastActivity <= STALE_THRESHOLD_MS) continue;

      staleEvents.push(
        buildDisconnectedEvent(
          agent.agent_id,
          agent.current_run_id ?? `run_stale_${agent.agent_id}`,
          ((agent.metadata as AgentMetadata) ?? { name: agent.agent_name ?? "unknown", source: "cli" })
        )
      );
    }

    if (staleEvents.length > 0) {
      log.info(`Sweeping ${staleEvents.length} stale agent(s) → disconnected`);
      await emit(staleEvents);
    }
  } catch (err) {
    log.error("Stale sweep failed:", (err as Error).message);
  }
}

async function main(): Promise<void> {
  log.info(`Watching: ${config.projectsDir}`);
  log.info(`Posting to: ${config.eventsUrl}`);

  await waitForServer();

  // ── Historical scan ──────────────────────────────────────────────────────
  // Import all existing Claude Code sessions that haven't been seen before.
  // On restarts, already-scanned files are skipped (byte offset is advanced
  // to end instead) so tokens/runs are never double-counted.
  const alreadyScanned = loadScannedSessions();
  const excluded = loadExcludedSessions();

  if (excluded.size > 0) log.info(`${excluded.size} session(s) permanently excluded (user-deleted).`);
  if (alreadyScanned.size > 0) {
    log.info(`Skipping ${alreadyScanned.size} previously scanned session(s).`);
  } else {
    log.info("First run — scanning all existing Claude Code sessions...");
  }

  const newlyScanned = await scanHistoricalSessions(emit, alreadyScanned, excluded);

  if (newlyScanned.length > 0) {
    log.info(`Historical scan complete: imported ${newlyScanned.length} new session(s).`);
    markSessionsScanned(newlyScanned);
  } else if (alreadyScanned.size === 0) {
    log.info("No existing sessions found.");
  }

  // ── Stale agent sweep ────────────────────────────────────────────────────
  // Runs after the historical scan so that freshly-imported sessions already
  // have an up-to-date last_activity and won't be incorrectly swept.
  await sweepStaleAgents();

  // ── Live watcher ─────────────────────────────────────────────────────────
  const stop = startWatcher(emit);

  const shutdown = () => {
    log.info("Shutting down...");
    stop()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  log.error("Fatal error:", err);
  process.exit(1);
});
