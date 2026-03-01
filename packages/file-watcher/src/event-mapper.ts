import { createHash } from "node:crypto";
import { basename } from "node:path";
import { generateRunId, calculateCost } from "@marionette/shared";
import { deriveAgentIdFromSession } from "@marionette/shared/ids-node";
import type { MarionetteEvent, AgentMetadata, AgentStatus, ConversationTurn } from "@marionette/shared";

// ─── Claude JSONL entry shape ──────────────────────────────────────────────

export interface AssistantUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface ClaudeJsonlEntry {
  parentUuid?: string;
  isSidechain?: boolean;
  sessionId?: string;
  agentId?: string;
  slug?: string;
  /** "user" | "assistant" | "system" | ... */
  type?: string;
  subtype?: string;
  /** For system/turn_duration entries */
  durationMs?: number;
  message?: {
    role?: string;
    content?: unknown;
    stop_reason?: string | null;
    usage?: AssistantUsage;
  };
  /** Present on user entries that contain tool results (not real user messages) */
  toolUseResult?: unknown;
  uuid?: string;
  timestamp?: string;
  cwd?: string;
  gitBranch?: string;
  version?: string;
  [key: string]: unknown;
}

// ─── ID helpers ────────────────────────────────────────────────────────────

/**
 * Derive a stable `agent_` prefixed ID from Claude's own agentId (subagents)
 * or from the sessionId (main session files).
 */
export function deriveAgentId(entry: ClaudeJsonlEntry, filePath: string): string {
  if (entry.agentId) {
    return `agent_${entry.agentId}`;
  }
  if (entry.sessionId) {
    return deriveAgentIdFromSession(entry.sessionId);
  }
  const hash = createHash("sha256").update(filePath).digest("hex").slice(0, 16);
  return `agent_${hash}`;
}

/**
 * Derive a stable session-level run_id (used for lifecycle events).
 * Per-run run_ids are generated fresh with `generateRunId()`.
 */
export function deriveSessionRunId(sessionId: string): string {
  const hash = createHash("sha256").update(`run:${sessionId}`).digest("hex").slice(0, 16);
  return `run_${hash}`;
}

// ─── Metadata ──────────────────────────────────────────────────────────────

export function buildMetadata(entry: ClaudeJsonlEntry, source?: AgentMetadata['source']): AgentMetadata {
  return {
    name: entry.slug ?? (entry.cwd ? basename(entry.cwd) : "claude-agent"),
    cwd: entry.cwd,
    version: entry.version,
    source: source ?? "cli",
  };
}

// ─── Base event ────────────────────────────────────────────────────────────

function buildBase(
  entry: ClaudeJsonlEntry,
  filePath: string,
  runId: string,
  source?: AgentMetadata['source']
): Partial<MarionetteEvent> {
  return {
    agent_id: deriveAgentId(entry, filePath),
    run_id: runId,
    ts: entry.timestamp ?? new Date().toISOString(),
    agent_metadata: buildMetadata(entry, source),
    payload: {
      sessionId: entry.sessionId,
      gitBranch: entry.gitBranch,
      slug: entry.slug,
      cwd: entry.cwd,
      source: "file-watcher",
    },
  };
}

// ─── Event builders ────────────────────────────────────────────────────────

/**
 * Emitted when a new main-session JSONL file appears
 * (`projects/{slug}/{session-uuid}.jsonl`).
 *
 * `agentId` is resolved by the caller (from the MCP temp file when available,
 * or derived from `sessionId` as a fallback). Keeping it as a parameter lets
 * the caller use the stable MCP-server identity across `/clear` sessions.
 */
export function buildConversationStartedEvent(
  agentId: string,
  sessionId: string,
  filePath: string,
  cwd?: string,
  gitBranch?: string,
  source?: AgentMetadata['source']
): MarionetteEvent {
  const runId = deriveSessionRunId(sessionId);

  return {
    agent_id: agentId,
    run_id: runId,
    type: "conversation.started",
    ts: new Date().toISOString(),
    summary: "New conversation session started",
    status: "starting" as AgentStatus,
    agent_metadata: {
      name: cwd ? basename(cwd) : "claude-session",
      cwd,
      source: source ?? "cli",
    },
    payload: {
      sessionId,
      gitBranch,
      filePath,
      source: "file-watcher",
    },
  } as MarionetteEvent;
}

/**
 * Emitted when a new subagent JSONL file appears.
 */
export function buildAgentStartedEvent(
  entry: ClaudeJsonlEntry,
  filePath: string,
  stableRunId: string,
  source?: AgentMetadata['source']
): MarionetteEvent {
  const base = buildBase(entry, filePath, stableRunId, source);
  return {
    ...base,
    type: "agent.started",
    summary: `Subagent started: ${entry.slug ?? entry.agentId ?? "unknown"}`,
    status: "working" as AgentStatus,
  } as MarionetteEvent;
}

/**
 * Emitted on a `type === "user"` line — beginning of a Claude run.
 * Returns `[run.started event, fresh runId]`.
 */
export function buildRunStartedEvent(
  entry: ClaudeJsonlEntry,
  filePath: string,
  source?: AgentMetadata['source']
): [MarionetteEvent, string] {
  const runId = generateRunId();
  const base = buildBase(entry, filePath, runId, source);

  const raw = extractMessageText(entry.message?.content);
  const currentTask =
    raw && raw.length >= 20
      ? raw.slice(0, 120) + (raw.length > 120 ? "…" : "")
      : null;

  const event: MarionetteEvent = {
    ...base,
    type: "run.started",
    summary: "Agent run started",
    status: "working" as AgentStatus,
    payload: {
      ...(base.payload as Record<string, unknown>),
      ...(currentTask ? { current_task: currentTask } : {}),
    },
  } as MarionetteEvent;
  return [event, runId];
}

/**
 * Emitted immediately on each `type === "assistant"` JSONL entry.
 * Records token usage for a single LLM API call — no accumulation needed.
 */
export function buildLlmCallEvent(
  entry: ClaudeJsonlEntry,
  filePath: string,
  runId: string,
  source?: AgentMetadata['source']
): MarionetteEvent {
  const usage = entry.message?.usage ?? {};
  const model = (entry.message as Record<string, unknown> | undefined)?.model as string | undefined;
  const total =
    (usage.input_tokens ?? 0) +
    (usage.output_tokens ?? 0) +
    (usage.cache_creation_input_tokens ?? 0) +
    (usage.cache_read_input_tokens ?? 0);
  const cost_usd = calculateCost(usage, model);

  const base = buildBase(entry, filePath, runId, source);
  return {
    ...base,
    type: "llm.call",
    summary: "LLM API call",
    tokens: {
      input_tokens: usage.input_tokens ?? 0,
      output_tokens: usage.output_tokens ?? 0,
      cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
      total_tokens: total,
      cost_usd,
    },
    payload: {
      ...(base.payload as Record<string, unknown>),
      model,
    },
  } as MarionetteEvent;
}

/**
 * Emitted on a `type === "system", subtype === "turn_duration"` line.
 * Status transitions to `"idle"` with duration only (tokens tracked per-call via llm.call).
 */
export function buildTurnEndedEvent(
  entry: ClaudeJsonlEntry,
  filePath: string,
  runId: string,
  durationMs: number,
  source?: AgentMetadata['source']
): MarionetteEvent {
  const base = buildBase(entry, filePath, runId, source);
  return {
    ...base,
    type: "run.ended",
    summary: "Agent turn completed",
    status: "idle" as AgentStatus,
    duration_ms: durationMs,
  } as MarionetteEvent;
}

// ─── Conversation capture ──────────────────────────────────────────────────

/**
 * Extract plain text from a JSONL message content field.
 * Content can be a string or an array of content blocks.
 */
function extractMessageText(content: unknown): string | null {
  if (typeof content === "string") return content || null;
  if (Array.isArray(content)) {
    const parts = (content as unknown[])
      .filter(
        (block): block is { type: string; text: string } =>
          typeof block === "object" &&
          block !== null &&
          (block as Record<string, unknown>)["type"] === "text" &&
          typeof (block as Record<string, unknown>)["text"] === "string"
      )
      .map((block) => block.text);
    return parts.length > 0 ? parts.join("\n") : null;
  }
  return null;
}

/**
 * Emits `conversation.turn` events for JSONL lines that have a `message` field
 * with extractable text content.
 */
export function buildConversationTurnEvents(
  entry: ClaudeJsonlEntry,
  filePath: string,
  runId: string,
  source?: AgentMetadata['source']
): MarionetteEvent[] {
  if (!entry.message) return [];

  const msg = entry.message as { role?: string; content?: unknown };
  if (!msg.role) return [];

  const text = extractMessageText(msg.content);
  if (text === null) return [];

  const agentId = deriveAgentId(entry, filePath);
  const sessionId = entry.sessionId ?? "";
  const role = msg.role as "user" | "assistant" | "system";
  const direction: "to_agent" | "from_agent" = role === "user" ? "to_agent" : "from_agent";

  const turn: ConversationTurn = {
    id: entry.uuid ?? `${agentId}-${entry.timestamp ?? new Date().toISOString()}-${Math.random().toString(36).slice(2, 9)}`,
    agent_id: agentId,
    session_id: sessionId,
    direction,
    role,
    content: text,
    content_plain: text,
    timestamp: entry.timestamp ?? new Date().toISOString(),
    source: "terminal",
  };

  return [
    {
      agent_id: agentId,
      run_id: runId,
      type: "conversation.turn",
      ts: entry.timestamp ?? new Date().toISOString(),
      summary: `Conversation turn: ${role}`,
      agent_metadata: buildMetadata(entry, source),
      payload: turn as unknown as Record<string, unknown>,
    } as MarionetteEvent,
  ];
}

// ─── Tool use detection ────────────────────────────────────────────────────

/** Returns true if the assistant message content contains at least one tool_use block. */
export function entryHasToolUse(entry: ClaudeJsonlEntry): boolean {
  const content = entry.message?.content;
  if (!Array.isArray(content)) return false;
  return (content as unknown[]).some(
    (block) =>
      typeof block === "object" &&
      block !== null &&
      (block as Record<string, unknown>)["type"] === "tool_use"
  );
}

/** Emitted when an assistant message contains a tool_use block — Claude is waiting for approval. */
export function buildAwaitingInputEvent(
  entry: ClaudeJsonlEntry,
  filePath: string,
  runId: string,
  source?: AgentMetadata['source']
): MarionetteEvent {
  const base = buildBase(entry, filePath, runId, source);
  return {
    ...base,
    type: "agent.status",
    summary: "Waiting for tool permission",
    status: "awaiting_input" as AgentStatus,
  } as MarionetteEvent;
}

/** Emitted when a tool_result user entry arrives — tool was approved/denied, Claude continues. */
export function buildToolResultEvent(
  entry: ClaudeJsonlEntry,
  filePath: string,
  runId: string,
  source?: AgentMetadata['source']
): MarionetteEvent {
  const base = buildBase(entry, filePath, runId, source);
  return {
    ...base,
    type: "agent.status",
    summary: "Tool permission response received",
    status: "working" as AgentStatus,
  } as MarionetteEvent;
}

/**
 * Emitted when a watched JSONL file is removed.
 */
export function buildDisconnectedEvent(
  agentId: string,
  runId: string,
  metadata: AgentMetadata
): MarionetteEvent {
  return {
    agent_id: agentId,
    run_id: runId,
    type: "agent.disconnected",
    ts: new Date().toISOString(),
    summary: "Agent disconnected (file removed)",
    status: "disconnected" as AgentStatus,
    agent_metadata: metadata,
    payload: { source: "file-watcher" },
  } as MarionetteEvent;
}
