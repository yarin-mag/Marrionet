import chokidar from "chokidar";
import { readdirSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, normalize } from "node:path";
import { config, WORKING_INACTIVITY_THRESHOLD_MS, IDLE_INACTIVITY_THRESHOLD_MS, INACTIVITY_CHECK_INTERVAL_MS } from "./config.js";
import { readNewLines, resetOffset, setOffsetToEnd, clearOffset, clearAllOffsets } from "./jsonl-reader.js";
import {
  type ClaudeJsonlEntry,
  buildConversationStartedEvent,
  buildAgentStartedEvent,
  buildRunStartedEvent,
  buildTurnEndedEvent,
  buildLlmCallEvent,
  buildConversationTurnEvents,
  buildDisconnectedEvent,
  buildAwaitingInputEvent,
  buildToolResultEvent,
  entryHasToolUse,
  deriveAgentId,
  deriveSessionRunId,
  buildMetadata,
} from "./event-mapper.js";
import { archiveLine } from "./archiver.js";
import type { MarionetteEvent, AgentMetadata, AgentStatus } from "@marionette/shared";
import { agentTempFilePath } from "@marionette/shared/ids-node";
import { log } from "./logger.js";

// ─── Types ─────────────────────────────────────────────────────────────────

export type EmitFn = (events: MarionetteEvent[]) => Promise<void>;

interface FileState {
  agentId: string;
  /** Stable ID reused for lifecycle events (agent.started, idle, etc.) */
  stableRunId: string;
  /** Tracks the current run — changes each time a real user message is seen */
  currentRunId: string;
  metadata: AgentMetadata;
  lastActivity: number;
  /** Slug component of the JSONL path (for archiving) */
  slug: string;
  /** Session UUID (filename without .jsonl extension, for archiving) */
  sessionId: string;
  /** Last status we emitted for this agent — used by inactivity detection */
  lastEmittedStatus: AgentStatus;
  /** Source of the agent (cli / vscode / mcp) — read from temp file on first encounter */
  source: AgentMetadata['source'];
}

// ─── Per-file state ────────────────────────────────────────────────────────

const fileStates = new Map<string, FileState>();

/**
 * Tracks which JSONL file is the current "live" session per project slug.
 * Used to suppress spurious `agent.disconnected` when an old (superseded)
 * JSONL is deleted after `/clear`.
 */
const activeFilePerSlug = new Map<string, string>(); // slug → current live filePath

// ─── Threshold constants ───────────────────────────────────────────────────

/**
 * Sessions modified more than this many ms ago are treated as ended.
 * Also used as the inactivity threshold for working/awaiting_input/starting states.
 */

const STALE_STATUSES = new Set<AgentStatus>(["working", "awaiting_input", "starting", "idle"]);

// ─── Temp-file helpers ─────────────────────────────────────────────────────

/**
 * Try to read the MCP server's agent_id and source from the temp file it writes at startup.
 * Line 1 = agentId, line 2 = source ("cli" | "vscode" | "mcp").
 * Returns null if the file is absent or malformed — caller falls back to sessionId derivation.
 */
async function readMcpTempFile(cwd: string): Promise<{ agentId: string; source: AgentMetadata['source'] } | null> {
  try {
    const content = await readFile(agentTempFilePath(cwd), "utf8");
    const lines = content.trim().split("\n");
    const agentId = lines[0];
    if (!agentId?.startsWith("agent_")) return null;
    const source: AgentMetadata['source'] =
      (lines[1] === "vscode" || lines[1] === "mcp") ? lines[1] : "cli";
    return { agentId, source };
  } catch {
    return null; // temp file absent (no MCP server) — fall back
  }
}

// ─── Path helpers ──────────────────────────────────────────────────────────

/**
 * Normalize a file path to always use forward slashes.
 * Chokidar may report backslash-separated paths on Windows; normalizing here
 * lets all downstream logic use a single separator consistently.
 */
function toForwardSlashes(p: string): string {
  return normalize(p).replace(/\\/g, "/");
}

const projectsDirFwd = toForwardSlashes(config.projectsDir);

function parsePath(filePath: string): { rel: string; parts: string[] } {
  const fwd = toForwardSlashes(filePath);
  const rel = fwd.startsWith(projectsDirFwd + "/")
    ? fwd.slice(projectsDirFwd.length + 1)
    : fwd;
  return { rel, parts: rel.split("/") };
}

/**
 * `projects/{slug}/subagents/agent-*.jsonl`
 */
function isSubagentFile(filePath: string): boolean {
  return parsePath(filePath).rel.includes("/subagents/");
}

/**
 * `projects/{slug}/{uuid}.jsonl`  (depth = 2 after stripping projectsDir)
 */
function isMainSessionFile(filePath: string): boolean {
  const { parts } = parsePath(filePath);
  return parts.length === 2 && parts[1].endsWith(".jsonl");
}

function extractPathComponents(filePath: string): { slug: string; sessionId: string } {
  const { parts } = parsePath(filePath);
  if (!parts[0]) {
    log.warn(`Could not derive slug from path: ${filePath} — using full path as key`);
  }
  const slug = parts[0] ?? filePath.replace(/[^a-zA-Z0-9_-]/g, "-");
  const sessionId = (parts[1] ?? filePath).replace(/\.jsonl$/, "");
  return { slug, sessionId };
}

// ─── State + event helpers ─────────────────────────────────────────────────

/**
 * Create and register a FileState for a newly encountered file.
 * Also returns any initial events (conversation.started / agent.started)
 * that should be emitted for this file.
 * Called exactly once per file, on the first valid JSONL line.
 */
async function initializeFileState(
  filePath: string,
  entry: ClaudeJsonlEntry,
): Promise<{ state: FileState; initialEvents: MarionetteEvent[] }> {
  const { slug, sessionId: pathSessionId } = extractPathComponents(filePath);
  const sessionId = entry.sessionId ?? pathSessionId;

  // Resolve agentId and source: prefer MCP temp file (stable across /clear); fall back
  // to sessionId-based derivation when no MCP server is running.
  const tempFile = entry.cwd ? await readMcpTempFile(entry.cwd) : null;
  const agentId = tempFile?.agentId ?? deriveAgentId(entry, filePath);
  const source: AgentMetadata['source'] = tempFile?.source ?? "cli";

  const stableRunId = deriveSessionRunId(sessionId);
  const state: FileState = {
    agentId,
    stableRunId,
    currentRunId: stableRunId,
    metadata: buildMetadata(entry, source),
    lastActivity: Date.now(),
    slug,
    sessionId,
    lastEmittedStatus: "starting",
    source,
  };
  fileStates.set(filePath, state);

  if (fileStates.size > 500) {
    log.warn(`fileStates has ${fileStates.size} entries — possible leak`);
  }

  // Emit conversation.started for main session files here (CWD is now known
  // from the first JSONL line, so we can look up the temp file).
  const initialEvents: MarionetteEvent[] = [];
  if (isMainSessionFile(filePath)) {
    initialEvents.push(
      buildConversationStartedEvent(agentId, sessionId, filePath, entry.cwd, entry.gitBranch, source)
    );
  }
  // Emit agent.started for subagent files on initialization
  if (isSubagentFile(filePath)) {
    initialEvents.push(buildAgentStartedEvent(entry, filePath, stableRunId, source));
  }

  return { state, initialEvents };
}

/**
 * Map a single JSONL entry + current file state to the events it produces.
 * Note: mutates `state.currentRunId` when a new user message starts a run.
 */
function buildEventsForEntry(
  entry: ClaudeJsonlEntry,
  state: FileState,
  filePath: string,
): MarionetteEvent[] {
  const events: MarionetteEvent[] = [];

  if (
    entry.type === "user" &&
    !entry.toolUseResult &&
    entry.message?.role === "user"
  ) {
    // Real user message: start a new run
    const [runStarted, newRunId] = buildRunStartedEvent(entry, filePath, state.source);
    state.currentRunId = newRunId;
    events.push(runStarted);
  } else if (entry.type === "user" && entry.toolUseResult) {
    // Tool result received (user approved/denied) → back to working
    events.push(buildToolResultEvent(entry, filePath, state.stableRunId, state.source));
  } else if (entry.type === "assistant") {
    // Emit llm.call immediately for each assistant entry that has token usage
    if (entry.message?.usage) {
      events.push(buildLlmCallEvent(entry, filePath, state.currentRunId, state.source));
    }
    // Detect tool call → Claude is waiting for permission
    if (entryHasToolUse(entry)) {
      events.push(buildAwaitingInputEvent(entry, filePath, state.stableRunId, state.source));
    }
  } else if (entry.type === "system" && entry.subtype === "turn_duration") {
    // Lifecycle signal: emit run.ended with duration (tokens already recorded per-call)
    const durationMs = typeof entry.durationMs === "number" ? entry.durationMs : 0;
    events.push(buildTurnEndedEvent(entry, filePath, state.currentRunId, durationMs, state.source));
  }

  // Emit conversation.turn for any line with a message field
  if (entry.message) {
    events.push(...buildConversationTurnEvents(entry, filePath, state.currentRunId, state.source));
  }

  return events;
}

// ─── Core handlers ─────────────────────────────────────────────────────────

async function handleNewFile(filePath: string, emit: EmitFn): Promise<void> {
  resetOffset(filePath);

  if (isMainSessionFile(filePath)) {
    // Register this as the current live file for its slug so that when the old
    // JSONL is eventually deleted we don't emit a spurious agent.disconnected.
    const { slug } = extractPathComponents(filePath);
    activeFilePerSlug.set(slug, filePath);
  }

  // conversation.started is emitted from handleFileChanged() on first-line init
  // (once CWD is known from the JSONL content so we can look up the temp file).
  await handleFileChanged(filePath, emit);
}

async function handleFileChanged(filePath: string, emit: EmitFn): Promise<void> {
  const lines = await readNewLines(filePath);
  if (lines.length === 0) return;

  let state = fileStates.get(filePath);
  const events: MarionetteEvent[] = [];

  for (const { parsed, raw } of lines) {
    const entry = parsed as ClaudeJsonlEntry;
    if (!entry || typeof entry.type !== "string") continue; // skip malformed lines

    // Initialize state on first valid line we see for this file
    if (state === undefined) {
      const { state: newState, initialEvents } = await initializeFileState(filePath, entry);
      state = newState;
      events.push(...initialEvents);
    }

    // Archive every raw line in real-time (fire-and-forget; archiveLine is non-fatal)
    archiveLine(state.slug, state.sessionId, raw).catch((err) =>
      log.error("archiveLine failed:", err)
    );

    events.push(...buildEventsForEntry(entry, state, filePath));
  }

  if (state) {
    state.lastActivity = Date.now();
  }

  if (events.length > 0 && state) {
    // Ensure every event carries the stable agent_id stored in state.
    // This keeps events consistent across /clear (new JSONL, same agent).
    const stableId = state.agentId;
    const stableEvents = events.map((e) =>
      e.agent_id === stableId ? e : { ...e, agent_id: stableId }
    );
    await emit(stableEvents);

    // Track the last status we emitted so the inactivity checker knows
    // whether this agent is working, idle, etc.
    const lastWithStatus = [...stableEvents].reverse().find((e) => e.status != null);
    if (lastWithStatus?.status) {
      state.lastEmittedStatus = lastWithStatus.status as AgentStatus;
    }
  }
}

function handleFileRemoved(filePath: string, emit: EmitFn): void {
  const state = fileStates.get(filePath);
  fileStates.delete(filePath);
  clearOffset(filePath); // evict stale byte-offset entry
  if (!state) return;

  const activeFilePath = activeFilePerSlug.get(state.slug);
  const isActiveFile = activeFilePath === filePath;

  if (isActiveFile) {
    // Current live file removed → agent is gone
    activeFilePerSlug.delete(state.slug);
    emit([buildDisconnectedEvent(state.agentId, state.stableRunId, state.metadata)]).catch(
      (err) => log.error("emit error:", err)
    );
  } else {
    // Non-active file removed. Check if it belongs to a genuinely different agent
    // (i.e. MCP was not running so each session got a unique agent_id). If so,
    // disconnect it — the old agent was killed and a new one took its place.
    // If agent_ids match it's a /clear scenario (same agent, new JSONL) → skip.
    const activeState = activeFilePath ? fileStates.get(activeFilePath) : undefined;
    if (activeState && activeState.agentId !== state.agentId) {
      emit([buildDisconnectedEvent(state.agentId, state.stableRunId, state.metadata)]).catch(
        (err) => log.error("emit error:", err)
      );
    }
  }
}

// ─── Historical scan helpers ───────────────────────────────────────────────

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

// ─── Historical scan ───────────────────────────────────────────────────────

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

// ─── Public API ────────────────────────────────────────────────────────────

let _watcherActive = false;

/**
 * Start watching `~/.claude/projects/**\/*.jsonl`.
 * Returns a `stop` function that closes the watcher.
 */
export function startWatcher(emit: EmitFn): () => Promise<void> {
  if (_watcherActive) {
    throw new Error("[file-watcher] startWatcher() called while already running — call stop() first");
  }
  _watcherActive = true;
  // TODO: chokidar v4 glob patterns are broken on macOS (patterns silently match nothing).
  // Until this is fixed upstream, we watch the entire projectsDir and filter .jsonl manually
  // in each event handler. Track: https://github.com/paulmillr/chokidar/issues/1317
  // When fixed, replace the watch(dir, {depth:3}) + manual filter with:
  //   chokidar.watch(`${config.projectsDir}/**/*.jsonl`, { ... })
  const watcher = chokidar.watch(config.projectsDir, {
    // Only react to new/changed files while running — skip existing historical sessions
    ignoreInitial: true,
    persistent: true,
    depth: 3,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
  });

  watcher.on("add", (filePath: string) => {
    if (!filePath.endsWith(".jsonl")) return;
    handleNewFile(filePath, emit).catch((err) =>
      log.error("add handler error:", err)
    );
  });

  watcher.on("change", (filePath: string) => {
    if (!filePath.endsWith(".jsonl")) return;
    handleFileChanged(filePath, emit).catch((err) =>
      log.error("change handler error:", err)
    );
  });

  watcher.on("unlink", (filePath: string) => {
    if (!filePath.endsWith(".jsonl")) return;
    handleFileRemoved(filePath, emit);
  });

  watcher.on("error", (err: unknown) => {
    log.error("chokidar error:", err);
  });

  // ── Inactivity detection ──────────────────────────────────────────────────
  // Handles two scenarios the stop hook can't cover:
  //   • SIGKILL: process dies instantly, no hook fires, agent stuck in "working"
  //   • Idle exit: Ctrl+C when Claude was between turns, stop hook sees "idle" → no-op
  //
  // Every 2 minutes, check each watched file's last activity time.
  // If silence exceeds the threshold for that status → emit disconnected.
  //
  // Thresholds:
  //   working / awaiting_input / starting → 15 min
  //     (most real tool executions finish well under 15 min)
  //   idle → 30 min
  //     (user might take a long break; be more generous before declaring dead)
  //
  // False positive recovery: if we incorrectly disconnect an idle agent whose
  // session was still open, the next user message causes the file watcher to
  // emit run.started → status self-corrects back to "working".
  //
  // Theoretical race with handleFileChanged():
  //   The timer could fire between `readNewLines()` and `emit()` in
  //   handleFileChanged() — but this is benign. `state.lastActivity` is updated
  //   before the `await emit()`, so by the time the timer reads lastActivity
  //   the activity is already recorded. The only real edge case is if the timer
  //   fires before the state entry is even created, which would cause a spurious
  //   agent.disconnected followed by a new conversation.started — semantically
  //   correct (start over).


  const inactivityTimer = setInterval(() => {
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

  return async () => {
    _watcherActive = false;
    clearInterval(inactivityTimer);
    await watcher.close();
    fileStates.clear();
    activeFilePerSlug.clear();
    clearAllOffsets();
  };
}
