export type MarionetteEventType =
  | "run.started" | "run.ended"
  | "agent.started" | "agent.ended"
  | "agent.heartbeat" | "agent.idle" | "agent.status"
  | "agent.disconnected"     // Agent process exited
  | "tool.called" | "tool.result"
  | "task.started" | "task.ended" | "task.blocked"
  | "log.info" | "log.warn" | "log.error"
  | "command.request"        // Slash command execution request
  | "command.response"       // Command result
  | "conversation.turn"      // Conversation message captured
  | "conversation.started"   // Conversation session started
  | "conversation.ended"     // Conversation session ended
  | "llm.call";              // Anthropic API call — model, tokens, cost, latency

export type AgentStatus =
  | "starting"
  | "idle"
  | "working"
  | "blocked"
  | "error"
  | "finished"
  | "crashed"
  | "disconnected" // Claude process exited/killed
  | "awaiting_input"; // Claude is waiting for user input/confirmation

/** Named constants for every AgentStatus value — use instead of raw string literals. */
export const AGENT_STATUS = {
  STARTING: "starting",
  IDLE: "idle",
  WORKING: "working",
  BLOCKED: "blocked",
  ERROR: "error",
  FINISHED: "finished",
  CRASHED: "crashed",
  DISCONNECTED: "disconnected",
  AWAITING_INPUT: "awaiting_input",
} as const satisfies Record<string, AgentStatus>;

export type TaskStatus =
  | "pending"
  | "running"
  | "blocked"
  | "completed"
  | "failed"
  | "cancelled";

/** A single message's token count — produced by the API proxy tokenizer */
export type MessageTokenEntry = {
  /** Zero-based position of this message in the full conversation */
  msg_index: number;
  role: 'user' | 'assistant';
  tokens: number;
  cost_usd?: number;
};

export type TokenUsage = {
  /** tokens sent to the LLM (best-effort) */
  input_tokens?: number;
  /** tokens received from the LLM (best-effort) */
  output_tokens?: number;
  /** tokens used to create the prompt cache */
  cache_creation_input_tokens?: number;
  /** tokens read from the prompt cache */
  cache_read_input_tokens?: number;
  /** total tokens if provided */
  total_tokens?: number;
  /** estimated $ cost if provided */
  cost_usd?: number;
  /** provider-specific raw usage payload (optional) */
  raw?: unknown;
};

export type AgentMetadata = {
  name?: string;
  terminal?: string;
  cwd?: string;
  version?: string;
  capabilities?: string[];
  source?: "cli" | "vscode" | "mcp";
};

export type MarionetteEvent = {
  org_id?: string;
  project_id?: string;
  user_id?: string;

  run_id: string;
  agent_id?: string;

  type: MarionetteEventType;
  ts: string; // ISO
  summary: string;

  trace_id?: string;
  span_id?: string;
  parent_span_id?: string;

  env?: "local" | "cloud";
  host?: string;

  tokens?: TokenUsage;

  // Enhanced fields for agent tracking
  agent_metadata?: AgentMetadata;
  task_id?: string;
  task_type?: string;
  status?: AgentStatus | TaskStatus;
  duration_ms?: number;
  error?: {
    message: string;
    code?: string;
    stack?: string;
    recoverable?: boolean;
  };

  payload?: Record<string, unknown>;
};

export type AgentSnapshot = {
  agent_id: string;
  agent_name?: string;
  status: AgentStatus;
  current_run_id?: string;
  current_task?: string;
  last_activity: string;
  terminal?: string;
  cwd?: string;
  total_runs: number;
  total_tasks: number;
  total_errors: number;
  total_tokens: number;
  total_duration_ms: number;
  session_start?: string;
  session_runs: number;
  session_errors: number;
  session_tokens: number;
  status_since?: string;
  source_file?: string;
  metadata?: Record<string, unknown>;
};

export type CommandCategory = 'context' | 'debug' | 'control' | 'query';

export interface CommandDefinition {
  name: string;
  description: string;
  category: CommandCategory;
  args?: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean';
    required?: boolean;
    default?: unknown;
    description?: string;
  }>;
}

export interface CommandResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  executionTimeMs?: number;
}

// ============================================
// Conversation Capture Types
// ============================================

export interface ConversationTurn {
  id: string;
  agent_id: string;
  session_id: string;
  direction: 'to_agent' | 'from_agent';
  role: 'user' | 'assistant' | 'system';
  content: string;
  content_plain?: string;  // Plain text without ANSI codes
  timestamp: string;       // ISO
  source?: 'terminal' | 'web'; // Where the message came from
  metadata?: {
    token_count?: number;
    stripped_ansi?: string;
    raw?: string;
  };
}

