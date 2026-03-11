import type { MarionetteEvent, AgentMetadata, AgentStatus } from "@marionette/shared";

export type EmitFn = (events: MarionetteEvent[]) => Promise<void>;

export interface FileState {
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
