import { IDLE_INACTIVITY_THRESHOLD_MS, WORKING_INACTIVITY_THRESHOLD_MS, INACTIVITY_CHECK_INTERVAL_MS } from "../config.js";
import { buildDisconnectedEvent } from "../event-mapper.js";
import { clearOffset } from "../jsonl-reader.js";
import { log } from "../logger.js";
import { fileStates, activeFilePerSlug, STALE_STATUSES } from "./state.js";
import type { EmitFn } from "./types.js";

/**
 * Start the inactivity detection timer.
 *
 * Handles two scenarios the stop hook can't cover:
 *   • SIGKILL: process dies instantly, no hook fires, agent stuck in "working"
 *   • Idle exit: Ctrl+C when Claude was between turns, stop hook sees "idle" → no-op
 *
 * Every 2 minutes, checks each watched file's last activity time.
 * If silence exceeds the threshold for that status → emits disconnected.
 *
 * Thresholds:
 *   working / awaiting_input / starting → 15 min
 *   idle → 30 min
 *
 * Returns the timer handle for cancellation.
 */
export function createInactivityTimer(emit: EmitFn): ReturnType<typeof setInterval> {
  return setInterval(() => {
    const now = Date.now();

    for (const [filePath, state] of fileStates) {
      const inactiveMs = now - state.lastActivity;

      const threshold =
        state.lastEmittedStatus === "idle"
          ? IDLE_INACTIVITY_THRESHOLD_MS
          : WORKING_INACTIVITY_THRESHOLD_MS;

      const isStaleStatus = STALE_STATUSES.has(state.lastEmittedStatus);

      if (isStaleStatus && inactiveMs > threshold) {
        log.info(
          `inactivity disconnect: ${state.agentId} ` +
          `(status=${state.lastEmittedStatus}, inactive=${Math.round(inactiveMs / 60000)}min)`
        );

        // Remove from active-file tracking immediately (prevents handleFileRemoved double-emit)
        if (activeFilePerSlug.get(state.slug) === filePath) {
          activeFilePerSlug.delete(state.slug);
        }

        // Mark status before emitting so the next timer tick sees "disconnected"
        // and skips this entry — prevents duplicate agent.disconnected on emit failure.
        state.lastEmittedStatus = "disconnected";
        state.lastActivity = now;

        emit([buildDisconnectedEvent(state.agentId, state.stableRunId, state.metadata)])
          .then(() => {
            fileStates.delete(filePath);
            clearOffset(filePath);
          })
          .catch((err) => {
            log.error("inactivity emit error — entry stays until next restart:", err);
            // entry remains for GC on process restart; timer won't re-trigger (status=disconnected)
          });
      }
    }
  }, INACTIVITY_CHECK_INTERVAL_MS);
}
