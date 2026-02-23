import type {
  AgentStartedEvent,
  ConversationTurnEvent,
  ProcessSpawnedEvent,
  NetworkRequestEvent,
  FilesystemChangeEvent,
  PerformanceStatsEvent,
} from '../../types/events';
import type { Message } from '../../types/messages';

export const TEST_CONFIG = {
  backendUrl: 'ws://localhost:8080',
  agentId: 'test-agent-123',
  sessionId: 'test-session-456',
};

export const createMockMessage = (
  overrides: Partial<Message> = {}
): Message => ({
  id: 'msg-123',
  source: 'terminal',
  content: 'Test message',
  timestamp: Date.now(),
  role: 'user',
  ...overrides,
});

export const createMockAgentStartedEvent = (
  overrides: Partial<AgentStartedEvent> = {}
): AgentStartedEvent => ({
  type: 'agent_started',
  timestamp: Date.now(),
  agentId: 'agent-123',
  sessionId: 'session-456',
  ...overrides,
});

export const createMockConversationTurnEvent = (
  overrides: Partial<ConversationTurnEvent> = {}
): ConversationTurnEvent => ({
  type: 'conversation_turn',
  timestamp: Date.now(),
  agentId: 'agent-123',
  sessionId: 'session-456',
  turn: {
    id: 'msg-123',
    role: 'user',
    content: 'Test message',
    timestamp: Date.now(),
    source: 'terminal',
  },
  ...overrides,
});

export const createMockProcessSpawnedEvent = (
  overrides: Partial<ProcessSpawnedEvent> = {}
): ProcessSpawnedEvent => ({
  type: 'process_spawned',
  timestamp: Date.now(),
  agentId: 'agent-123',
  sessionId: 'session-456',
  process: {
    pid: 12345,
    command: 'claude',
    args: ['chat'],
  },
  ...overrides,
});

export const createMockNetworkRequestEvent = (
  overrides: Partial<NetworkRequestEvent> = {}
): NetworkRequestEvent => ({
  type: 'network_request',
  timestamp: Date.now(),
  agentId: 'agent-123',
  sessionId: 'session-456',
  request: {
    method: 'GET',
    url: 'https://api.anthropic.com/test',
    headers: {},
  },
  ...overrides,
});

export const createMockFilesystemChangeEvent = (
  overrides: Partial<FilesystemChangeEvent> = {}
): FilesystemChangeEvent => ({
  type: 'filesystem_change',
  timestamp: Date.now(),
  agentId: 'agent-123',
  sessionId: 'session-456',
  change: {
    type: 'add',
    path: '/test/file.txt',
  },
  ...overrides,
});

export const createMockPerformanceStatsEvent = (
  overrides: Partial<PerformanceStatsEvent> = {}
): PerformanceStatsEvent => ({
  type: 'performance_stats',
  timestamp: Date.now(),
  agentId: 'agent-123',
  sessionId: 'session-456',
  stats: {
    cpu: 5.5,
    memory: 123456789,
    elapsed: 30000,
  },
  ...overrides,
});
