import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StartupOrchestrator } from '../StartupOrchestrator';
import { WebSocketClient } from '../../websocket/WebSocketClient';
import { EventEmitter } from '../../websocket/EventEmitter';
import { HeartbeatManager } from '../../websocket/HeartbeatManager';
import { IMonitor } from '../../interfaces/IMonitor';
import { Logger } from '../../core/Logger';
import type { TerminalInfo } from '../../types/state';

describe('StartupOrchestrator', () => {
  let orchestrator: StartupOrchestrator;
  let logger: Logger;
  let wsClient: WebSocketClient;
  let eventEmitter: EventEmitter;
  let heartbeat: HeartbeatManager;
  let mockMonitor1: IMonitor;
  let mockMonitor2: IMonitor;

  beforeEach(() => {
    logger = new Logger('test');
    wsClient = new WebSocketClient(logger);
    eventEmitter = new EventEmitter(wsClient, 'agent-123', 'session-456');
    heartbeat = new HeartbeatManager(eventEmitter, Date.now());

    mockMonitor1 = {
      initialize: vi.fn(),
      shutdown: vi.fn(),
    };

    mockMonitor2 = {
      initialize: vi.fn(),
      shutdown: vi.fn(),
    };

    vi.spyOn(logger, 'success').mockImplementation(() => {});
    vi.spyOn(wsClient, 'connect').mockResolvedValue();
    vi.spyOn(eventEmitter, 'emitAgentStarted').mockImplementation(() => {});
    vi.spyOn(eventEmitter, 'emitConversationStarted').mockImplementation(
      () => {}
    );
    vi.spyOn(heartbeat, 'start').mockImplementation(() => {});

    orchestrator = new StartupOrchestrator(
      logger,
      wsClient,
      eventEmitter,
      heartbeat,
      [mockMonitor1, mockMonitor2]
    );
  });

  describe('execute', () => {
    it('should initialize monitors before connecting', async () => {
      const wsUrl = 'ws://localhost:8080';
      const wrapperPid = 12345;
      const terminalInfo: TerminalInfo = {
        shell: 'zsh',
        cwd: '/home/user',
      };

      const callOrder: string[] = [];

      vi.mocked(mockMonitor1.initialize).mockImplementation(() => {
        callOrder.push('monitor1');
      });
      vi.mocked(mockMonitor2.initialize).mockImplementation(() => {
        callOrder.push('monitor2');
      });
      vi.mocked(wsClient.connect).mockImplementation(async () => {
        callOrder.push('connect');
      });

      await orchestrator.execute(wsUrl, wrapperPid, terminalInfo);

      expect(callOrder).toEqual(['monitor1', 'monitor2', 'connect']);
    });

    it('should connect to WebSocket backend', async () => {
      const wsUrl = 'ws://localhost:8080';
      const wrapperPid = 12345;
      const terminalInfo: TerminalInfo = {
        shell: 'zsh',
        cwd: '/home/user',
      };

      await orchestrator.execute(wsUrl, wrapperPid, terminalInfo);

      expect(wsClient.connect).toHaveBeenCalledWith(wsUrl);
      expect(logger.success).toHaveBeenCalledWith(
        'Connected to Marionette backend'
      );
    });

    it('should emit agent started event', async () => {
      const wsUrl = 'ws://localhost:8080';
      const wrapperPid = 12345;
      const terminalInfo: TerminalInfo = {
        shell: 'zsh',
        cwd: '/home/user',
      };

      await orchestrator.execute(wsUrl, wrapperPid, terminalInfo);

      expect(eventEmitter.emitAgentStarted).toHaveBeenCalledWith(
        wrapperPid,
        terminalInfo
      );
    });

    it('should emit conversation started event', async () => {
      const wsUrl = 'ws://localhost:8080';
      const wrapperPid = 12345;
      const terminalInfo: TerminalInfo = {
        shell: 'zsh',
        cwd: '/home/user',
      };

      await orchestrator.execute(wsUrl, wrapperPid, terminalInfo);

      expect(eventEmitter.emitConversationStarted).toHaveBeenCalled();
    });

    it('should start heartbeat mechanism', async () => {
      const wsUrl = 'ws://localhost:8080';
      const wrapperPid = 12345;
      const terminalInfo: TerminalInfo = {
        shell: 'zsh',
        cwd: '/home/user',
      };

      await orchestrator.execute(wsUrl, wrapperPid, terminalInfo);

      expect(heartbeat.start).toHaveBeenCalled();
    });

    it('should execute full startup sequence in correct order', async () => {
      const wsUrl = 'ws://localhost:8080';
      const wrapperPid = 12345;
      const terminalInfo: TerminalInfo = {
        shell: 'zsh',
        cwd: '/home/user',
      };

      const callOrder: string[] = [];

      vi.mocked(mockMonitor1.initialize).mockImplementation(() => {
        callOrder.push('monitor1.initialize');
      });
      vi.mocked(wsClient.connect).mockImplementation(async () => {
        callOrder.push('wsClient.connect');
      });
      vi.mocked(eventEmitter.emitAgentStarted).mockImplementation(() => {
        callOrder.push('emitAgentStarted');
      });
      vi.mocked(eventEmitter.emitConversationStarted).mockImplementation(
        () => {
          callOrder.push('emitConversationStarted');
        }
      );
      vi.mocked(heartbeat.start).mockImplementation(() => {
        callOrder.push('heartbeat.start');
      });

      await orchestrator.execute(wsUrl, wrapperPid, terminalInfo);

      expect(callOrder).toEqual([
        'monitor1.initialize',
        'wsClient.connect',
        'emitAgentStarted',
        'emitConversationStarted',
        'heartbeat.start',
      ]);
    });

    it('should initialize all monitors', async () => {
      const wsUrl = 'ws://localhost:8080';
      const wrapperPid = 12345;
      const terminalInfo: TerminalInfo = {
        shell: 'zsh',
        cwd: '/home/user',
      };

      await orchestrator.execute(wsUrl, wrapperPid, terminalInfo);

      expect(mockMonitor1.initialize).toHaveBeenCalled();
      expect(mockMonitor2.initialize).toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
      const wsUrl = 'ws://localhost:8080';
      const wrapperPid = 12345;
      const terminalInfo: TerminalInfo = {
        shell: 'zsh',
        cwd: '/home/user',
      };

      vi.mocked(wsClient.connect).mockRejectedValue(
        new Error('Connection failed')
      );

      await expect(
        orchestrator.execute(wsUrl, wrapperPid, terminalInfo)
      ).rejects.toThrow('Connection failed');

      // Should not emit events or start heartbeat after failed connection
      expect(eventEmitter.emitAgentStarted).not.toHaveBeenCalled();
      expect(heartbeat.start).not.toHaveBeenCalled();
    });
  });
});
