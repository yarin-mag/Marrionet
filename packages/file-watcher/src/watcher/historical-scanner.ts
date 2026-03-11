import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { config, WORKING_INACTIVITY_THRESHOLD_MS } from "../config.js";
import { resetOffset, setOffsetToEnd } from "../jsonl-reader.js";
import { buildDisconnectedEvent } from "../event-mapper.js";
import { log } from "../logger.js";
import { fileStates, activeFilePerSlug } from "./state.js";
import { handleFileChanged } from "./file-handlers.js";
import type { EmitFn } from "./types.js";

/**
 * Advance the byte offset of a file to its end and mark it as scanned
 * (so the live watcher ignores it and restart doesn't re-import it).
 */
async function advanceAndMark(
  path: string,
  alreadyScanned: Set<string>,
  newlyScanned: string[],
): Promise<void> {
  if (!alreadyScanned.has(path)) newlyScanned.push(path);
  await setOffsetToEnd(path);
}

/**
 * Handle a single candidate "most recent" session file during the historical scan.
 * Three cases:
 *   1. excluded   — user deleted this agent; advance offset + mark, never re-import.
 *   2. already scanned — previous run already imported it; just advance offset.
 *   3. new        — import it, patch source_file on server, disconnect if stale.
 */
async function processSessionFile(
  mostRecent: { path: string; mtime: number },
  emit: EmitFn,
  alreadyScanned: Set<string>,
  excluded: Set<string>,
  newlyScanned: string[],
): Promise<void> {
  if (excluded.has(mostRecent.path)) {
    // User explicitly deleted this agent — never re-import it.
    await advanceAndMark(mostRecent.path, alreadyScanned, newlyScanned);
  } else if (alreadyScanned.has(mostRecent.path)) {
    // Restart: already imported — just advance offset.
    await setOffsetToEnd(mostRecent.path);
  } else {
    resetOffset(mostRecent.path);
    await handleFileChanged(mostRecent.path, emit);
    newlyScanned.push(mostRecent.path);

    const state = fileStates.get(mostRecent.path);
    if (state) {
      // Tag the agent with its source file path so the server can reference
      // it when the user deletes the agent (to populate excluded-sessions.json).
      await fetch(`${config.apiUrl}/api/agents/${state.agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_file: mostRecent.path }),
      }).catch((err) => {
        log.warn("Failed to patch source_file on server (non-fatal):", err);
      });

      if (Date.now() - mostRecent.mtime > WORKING_INACTIVITY_THRESHOLD_MS) {
        // Session ended before Marionette started — mark disconnected.
        await emit([buildDisconnectedEvent(state.agentId, state.stableRunId, state.metadata)]);
        fileStates.delete(mostRecent.path);
      } else {
        // Recent file: leave state alive so live watcher continues seamlessly.
        // Register as the active file so handleFileRemoved() works correctly.
        activeFilePerSlug.set(state.slug, mostRecent.path);
      }
    }
  }
}

/**
 * On startup: import existing Claude Code sessions into the DB.
 *
 * Strategy — one agent per project slug (not one per JSONL file):
 *   Claude Code creates a new .jsonl file for every conversation in a project.
 *   Importing all of them would produce hundreds of duplicate agent rows.
 *   Instead we only fully process the MOST RECENT session file per slug;
 *   older session files are marked as "scanned" and their byte offsets are
 *   advanced so the live watcher ignores them.
 *
 * Restart safety:
 *   File paths that were already processed in a previous run are stored in
 *   ~/.marionette/scanned-sessions.json (the alreadyScanned set).
 *   For those files we only advance the byte offset — no events re-emitted,
 *   so token/run counters are never double-counted across restarts.
 *
 * Returns the list of file paths newly processed (caller persists this).
 */
export async function scanHistoricalSessions(
  emit: EmitFn,
  alreadyScanned: Set<string>,
  excluded: Set<string> = new Set()
): Promise<string[]> {
  const newlyScanned: string[] = [];

  let slugDirs: string[];
  try {
    slugDirs = readdirSync(config.projectsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => join(config.projectsDir, d.name));
  } catch {
    return []; // ~/.claude/projects doesn't exist yet
  }

  for (const slugDir of slugDirs) {
    type FileEntry = { path: string; mtime: number };

    // ── Collect + sort main session files (newest first) ─────────────────
    const sessionFiles: FileEntry[] = [];
    try {
      for (const f of readdirSync(slugDir, { withFileTypes: true })) {
        if (!f.isFile() || !f.name.endsWith(".jsonl")) continue;
        const path = join(slugDir, f.name);
        try { sessionFiles.push({ path, mtime: statSync(path).mtimeMs }); } catch (statErr) {
          log.error("Could not stat session file:", path, statErr);
        }
      }
      sessionFiles.sort((a, b) => b.mtime - a.mtime);
    } catch (dirErr) {
      log.error("Could not read session dir:", slugDir, dirErr);
    }

    // ── Collect subagent files ────────────────────────────────────────────
    const subagentFiles: FileEntry[] = [];
    try {
      const subDir = join(slugDir, "subagents");
      for (const f of readdirSync(subDir, { withFileTypes: true })) {
        if (!f.isFile() || !f.name.endsWith(".jsonl")) continue;
        const path = join(subDir, f.name);
        try { subagentFiles.push({ path, mtime: statSync(path).mtimeMs }); } catch (statErr) {
          log.error("Could not stat subagent file:", path, statErr);
        }
      }
    } catch {
      // subagents/ dir absent — normal, not an error
    }

    // ── Main sessions: process only the most recent; skip older ones ──────
    const [mostRecent, ...olderSessions] = sessionFiles;

    for (const { path } of olderSessions) {
      await advanceAndMark(path, alreadyScanned, newlyScanned);
    }

    if (mostRecent) {
      await processSessionFile(mostRecent, emit, alreadyScanned, excluded, newlyScanned);
    }

    // ── Subagent files: advance offset only, don't import ────────────────
    // Historical subagents are short-lived and create noisy "claude-agent"
    // entries with no meaningful data. The live watcher handles any
    // subagents that are still running. Just advance the byte offset so
    // the live watcher doesn't replay old content, and mark as scanned.
    for (const { path } of subagentFiles) {
      await advanceAndMark(path, alreadyScanned, newlyScanned);
    }
  }

  return newlyScanned;
}
