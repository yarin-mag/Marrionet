import { readFile } from "node:fs/promises";
import { readNewLines, resetOffset, clearOffset } from "../jsonl-reader.js";
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
} from "../event-mapper.js";
import { archiveLine } from "../archiver.js";
import type { MarionetteEvent, AgentMetadata, AgentStatus } from "@marionette/shared";
import { agentTempFilePath } from "@marionette/shared/ids-node";
import { log } from "../logger.js";
import { fileStates, activeFilePerSlug } from "./state.js";
import { isMainSessionFile, isSubagentFile, extractPathComponents } from "./path-helpers.js";
import type { EmitFn, FileState } from "./types.js";

// ─── Temp-file helpers ──────────────────────────────────────────────────────

/**
 * Try to read the MCP server's agent_id and source from the temp file it writes at startup.
 * Line 1 = agentId, line 2 = source ("cli" | "vscode" | "mcp").
 * Returns null if the file is absent or malformed — caller falls back to sessionId derivation.
 */
async function readMcpTempFile(cwd: string): Promise<{ agentId: string; source: AgentMetadata['source']; terminal?: string } | null> {
  try {
    const content = await readFile(agentTempFilePath(cwd), "utf8");
    const lines = content.trim().split("\n");
    const agentId = lines[0];
    if (!agentId?.startsWith("agent_")) return null;
    const source: AgentMetadata['source'] =
      (lines[1] === "vscode" || lines[1] === "mcp") ? lines[1] : "cli";
    const terminal = lines[2]?.trim() || undefined;
    return { agentId, source, terminal };
  } catch {
    return null; // temp file absent (no MCP server) — fall back
  }
}

// ─── State initialization ───────────────────────────────────────────────────

/**
 * Create and register a FileState for a newly encountered file.
 * Also returns any initial events (conversation.started / agent.started)
 * that should be emitted for this file.
 * Called exactly once per file, on the first valid JSONL line.
 */
export async function initializeFileState(
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
      buildConversationStartedEvent(agentId, sessionId, filePath, entry.cwd, entry.gitBranch, source, tempFile?.terminal)
    );
  }
  // Emit agent.started for subagent files on initialization
  if (isSubagentFile(filePath)) {
    initialEvents.push(buildAgentStartedEvent(entry, filePath, stableRunId, source));
  }

  return { state, initialEvents };
}

// ─── Event mapping ──────────────────────────────────────────────────────────

/**
 * Map a single JSONL entry + current file state to the events it produces.
 * Note: mutates `state.currentRunId` when a new user message starts a run.
 */
export function buildEventsForEntry(
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

// ─── Core handlers ──────────────────────────────────────────────────────────

export async function handleNewFile(filePath: string, emit: EmitFn): Promise<void> {
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

export async function handleFileChanged(filePath: string, emit: EmitFn): Promise<void> {
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

export function handleFileRemoved(filePath: string, emit: EmitFn): void {
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
