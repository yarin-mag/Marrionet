import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HeartbeatManager } from '../HeartbeatManager';
import { EventEmitter } from '../EventEmitter';
import { WebSocketClient } from '../WebSocketClient';
import { Logger } from '../../core/Logger';

describe('HeartbeatManager', () => {
  let heartbeatManager: HeartbeatManager;
  let eventEmitter: EventEmitter;
  let startTime: number;

  beforeEach(() => {
    vi.useFakeTimers();
    startTime = Date.now();

    const logger = new Logger('test');
    const wsClient = new WebSocketClient(logger);
    eventEmitter = new EventEmitter(wsClient, 'agent-123', 'session-456');

    vi.spyOn(eventEmitter, 'emitAgentHeartbeat').mockImplementation(() => {});

    heartbeatManager = new HeartbeatManager(eventEmitter, startTime, 30000);
  });

  afterEach(() => {
    heartbeatManager.stop();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('start', () => {
    it('should start sending heartbeats at configured interval', () => {
      heartbeatManager.start();

      expect(eventEmitter.emitAgentHeartbeat).not.toHaveBeenCalled();

      vi.advanceTimersByTime(30000);
      expect(eventEmitter.emitAgentHeartbeat).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(30000);
      expect(eventEmitter.emitAgentHeartbeat).toHaveBeenCalledTimes(2);
    });

    it('should send heartbeat with correct uptime', () => {
      heartbeatManager.start();

      vi.advanceTimersByTime(30000);

      expect(eventEmitter.emitAgentHeartbeat).toHaveBeenCalledWith(
        30,
        expect.any(Number)
      );

      vi.advanceTimersByTime(30000);

      expect(eventEmitter.emitAgentHeartbeat).toHaveBeenCalledWith(
        60,
        expect.any(Number)
      );
    });

    it('should send heartbeat with memory usage', () => {
      heartbeatManager.start();

      const mockMemoryUsage = 123456789;
      vi.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: mockMemoryUsage,
        heapTotal: 0,
        external: 0,
        rss: 0,
        arrayBuffers: 0,
      });

      vi.advanceTimersByTime(30000);

      expect(eventEmitter.emitAgentHeartbeat).toHaveBeenCalledWith(
        expect.any(Number),
        mockMemoryUsage
      );
    });

    it('should respect custom interval', () => {
      heartbeatManager = new HeartbeatManager(eventEmitter, startTime, 10000);
      heartbeatManager.start();

      vi.advanceTimersByTime(10000);
      expect(eventEmitter.emitAgentHeartbeat).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(10000);
      expect(eventEmitter.emitAgentHeartbeat).toHaveBeenCalledTimes(2);
    });
  });

  describe('stop', () => {
    it('should stop sending heartbeats', () => {
      heartbeatManager.start();

      vi.advanceTimersByTime(30000);
      expect(eventEmitter.emitAgentHeartbeat).toHaveBeenCalledTimes(1);

      heartbeatManager.stop();

      vi.advanceTimersByTime(30000);
      expect(eventEmitter.emitAgentHeartbeat).toHaveBeenCalledTimes(1);
    });

    it('should be safe to call stop when not started', () => {
      expect(() => heartbeatManager.stop()).not.toThrow();
    });

    it('should be safe to call stop multiple times', () => {
      heartbeatManager.start();
      heartbeatManager.stop();

      expect(() => heartbeatManager.stop()).not.toThrow();
    });
  });

  describe('integration', () => {
    it('should handle start, stop, restart cycle', () => {
      heartbeatManager.start();
      vi.advanceTimersByTime(30000);
      expect(eventEmitter.emitAgentHeartbeat).toHaveBeenCalledTimes(1);

      heartbeatManager.stop();
      vi.advanceTimersByTime(30000);
      expect(eventEmitter.emitAgentHeartbeat).toHaveBeenCalledTimes(1);

      heartbeatManager.start();
      vi.advanceTimersByTime(30000);
      expect(eventEmitter.emitAgentHeartbeat).toHaveBeenCalledTimes(2);
    });

    it('should calculate uptime correctly across time', () => {
      const startTime = 1000000000000;
      const mockDateNow = vi.spyOn(Date, 'now');
      mockDateNow.mockReturnValue(startTime);

      heartbeatManager = new HeartbeatManager(eventEmitter, startTime, 30000);
      heartbeatManager.start();

      mockDateNow.mockReturnValue(startTime + 30000);
      vi.advanceTimersByTime(30000);
      expect(eventEmitter.emitAgentHeartbeat).toHaveBeenCalledWith(
        30,
        expect.any(Number)
      );

      mockDateNow.mockReturnValue(startTime + 90000);
      vi.advanceTimersByTime(60000);
      expect(eventEmitter.emitAgentHeartbeat).toHaveBeenLastCalledWith(
        90,
        expect.any(Number)
      );
    });
  });
});
