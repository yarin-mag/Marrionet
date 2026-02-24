export interface AgentInfo {
  id: string;
  name: string;
  status: string;
  terminal: string;
  cwd: string;
}

export interface ContextData {
  agent: AgentInfo;
  currentTask?: string;
  metadata?: Record<string, unknown>;
}

export interface ThinkingStep {
  type: string;
  summary: string;
  timestamp: string;
  duration?: number;
}

export interface MetricsData {
  runs: number;
  tasks: number;
  errors: number;
  tokens: number;
  duration: number;
  avgDuration: number;
}

export interface ToolUsage {
  tool: string;
  timestamp: string;
  status: string;
}

export interface InspectData {
  agentId: string;
  target: string;
  timestamp: string;
  context?: ContextData;
  thinking?: ThinkingStep[];
  metrics?: MetricsData;
  tools?: ToolUsage[];
}
