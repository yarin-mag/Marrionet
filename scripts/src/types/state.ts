/**
 * Configuration and shared state types
 */

export interface Config {
  wsUrl: string;
  apiUrl: string;
  captureEnabled: boolean;
  claudeCliPath: string;
  heartbeatIntervalMs: number;
  performanceIntervalMs: number;
  messageTimeoutMs: number;
}

export interface TerminalInfo {
  terminal: string;
  cwd: string;
  hostname: string;
  user: string;
}

export interface AgentIdentity {
  agentId: string;
  sessionId: string;
  wrapperPid: number;
  startTime: number;
}
