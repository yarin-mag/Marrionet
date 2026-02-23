export type MarionetteEventType =
  | "run.started" | "run.ended"
  | "agent.started" | "agent.ended"
  | "agent.heartbeat" | "agent.idle" | "agent.status"
  | "agent.disconnected"     // Agent process exited
  | "step.started" | "step.ended"
  | "tool.called" | "tool.result"
  | "task.started" | "task.ended" | "task.blocked"
  | "log.info" | "log.warn" | "log.error"
  | "message.sent"           // Dashboard sent message to agent
  | "message.delivered"      // Agent received message
  | "message.response"       // Agent sent response
  | "command.request"        // Slash command execution request
  | "command.response"       // Command result
  | "agent.typing"           // Agent is processing (for UI)
  | "conversation.turn"      // Conversation message captured
  | "conversation.started"   // Conversation session started
  | "conversation.ended"     // Conversation session ended
  | "agent.register"         // Agent wrapper registration
  | "process.spawned"        // Child process spawned
  | "process.exited"         // Child process exited
  | "file.created"           // File created
  | "file.modified"          // File modified
  | "file.deleted"           // File deleted
  | "network.request"        // HTTP request initiated
  | "network.response"       // HTTP response received
  | "network.error"          // HTTP request error
  | "process.stats";         // Process performance metrics

export type AgentStatus =
  | "starting"
  | "idle"
  | "working"
  | "blocked"
  | "error"
  | "finished"
  | "crashed"
  | "disconnected"; // Claude process exited/killed

export type TaskStatus =
  | "pending"
  | "running"
  | "blocked"
  | "completed"
  | "failed"
  | "cancelled";

export type TokenUsage = {
  /** tokens sent to the LLM (best-effort) */
  input_tokens?: number;
  /** tokens received from the LLM (best-effort) */
  output_tokens?: number;
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
  metadata?: Record<string, unknown>;
};

// ============================================
// Interactive Messaging Types
// ============================================

export type MessageDirection = 'to_agent' | 'from_agent';
export type MessageType = 'text' | 'command' | 'response' | 'error' | 'system';
export type MessageStatus = 'pending' | 'delivered' | 'processing' | 'completed' | 'failed';

export interface Message {
  id: string;
  agentId: string;
  direction: MessageDirection;
  messageType: MessageType;
  content: string;
  status: MessageStatus;
  createdAt: string;
  deliveredAt?: string;
  processedAt?: string;
  completedAt?: string;
  metadata?: {
    command?: string;
    args?: Record<string, unknown>;
    executionTimeMs?: number;
    tokenCount?: number;
    error?: {
      message: string;
      code?: string;
      stack?: string;
    };
    userId?: string;
  };
  parentMessageId?: string;
}

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

export interface ConversationSession {
  session_id: string;
  agent_id: string;
  started_at: string;
  ended_at?: string;
  turn_count: number;
  turns: ConversationTurn[];
  metadata?: {
    terminal?: string;
    cwd?: string;
    hostname?: string;
    user?: string;
  };
}
