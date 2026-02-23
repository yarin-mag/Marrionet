/**
 * Event types for Marionette communication
 * These types define the contract between the wrapper and backend
 */

export interface AgentStartedEvent {
  type: 'agent.started';
  agent_id: string;
  session_id: string;
  wrapper_pid: number;
  terminal: string;
  cwd: string;
  hostname: string;
  user: string;
  timestamp: string;
}

export interface ConversationStartedEvent {
  type: 'conversation.started';
  agent_id: string;
  session_id: string;
  timestamp: string;
}

export interface ConversationTurnEvent {
  type: 'conversation.turn';
  agent_id: string;
  session_id: string;
  message: {
    id: string;
    agent_id: string;
    session_id: string;
    direction: 'to_agent' | 'from_agent';
    role: 'user' | 'assistant';
    content: string;
    content_plain: string;
    timestamp: string;
    source?: 'terminal' | 'web';
  };
}

export interface ConversationEndedEvent {
  type: 'conversation.ended';
  agent_id: string;
  session_id: string;
  duration_seconds: number;
  timestamp: string;
}

export interface ProcessSpawnedEvent {
  type: 'process.spawned';
  agent_id: string;
  pid: number;
  command: string;
  args: string[];
  timestamp: string;
}

export interface ProcessExitedEvent {
  type: 'process.exited';
  agent_id: string;
  pid: number;
  exit_code: number | null;
  signal: string | null;
  timestamp: string;
}

export interface ProcessStatsEvent {
  type: 'process.stats';
  agent_id: string;
  cpu_percent: number;
  memory_bytes: number;
  elapsed_ms: number;
  timestamp: string;
}

export interface NetworkRequestEvent {
  type: 'network.request';
  agent_id: string;
  method: string;
  url: string;
  timestamp: string;
}

export interface NetworkResponseEvent {
  type: 'network.response';
  agent_id: string;
  url: string;
  status_code: number;
  duration_ms: number;
  timestamp: string;
}

export interface NetworkErrorEvent {
  type: 'network.error';
  agent_id: string;
  url: string;
  error: string;
  timestamp: string;
}

export interface FileCreatedEvent {
  type: 'file.created';
  agent_id: string;
  path: string;
  timestamp: string;
}

export interface FileModifiedEvent {
  type: 'file.modified';
  agent_id: string;
  path: string;
  timestamp: string;
}

export interface FileDeletedEvent {
  type: 'file.deleted';
  agent_id: string;
  path: string;
  timestamp: string;
}

export interface AgentHeartbeatEvent {
  type: 'agent.heartbeat';
  agent_id: string;
  uptime_seconds: number;
  memory_bytes: number;
  timestamp: string;
}

export interface AgentDisconnectedEvent {
  type: 'agent.disconnected';
  agent_id: string;
  status: 'disconnected';
  exit_code: number | null;
  signal: string | null;
  duration_seconds: number;
  timestamp: string;
}

/**
 * Discriminated union of all possible agent events
 * This enables type-safe event handling
 */
export type AgentEvent =
  | AgentStartedEvent
  | ConversationStartedEvent
  | ConversationTurnEvent
  | ConversationEndedEvent
  | ProcessSpawnedEvent
  | ProcessExitedEvent
  | ProcessStatsEvent
  | NetworkRequestEvent
  | NetworkResponseEvent
  | NetworkErrorEvent
  | FileCreatedEvent
  | FileModifiedEvent
  | FileDeletedEvent
  | AgentHeartbeatEvent
  | AgentDisconnectedEvent;

/**
 * Incoming event types from backend (e.g., web UI)
 */
export interface MessageSendEvent {
  type: 'message.send';
  agent_id: string;
  content: string;
}

export type IncomingEvent = MessageSendEvent;
