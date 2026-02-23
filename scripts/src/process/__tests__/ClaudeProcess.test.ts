import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClaudeProcess } from '../ClaudeProcess';
import { Logger } from '../../core/Logger';
import { MockChildProcess } from '../../__tests__/helpers/MockChildProcess';
import * as child_process from 'child_process';

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

describe('ClaudeProcess', () => {
  let claudeProcess: ClaudeProcess;
  let logger: Logger;
  let mockChildProcess: MockChildProcess;

  beforeEach(() => {
    logger = new Logger('test');
    mockChildProcess = new MockChildProcess();

    vi.mocked(child_process.spawn).mockReturnValue(
      mockChildProcess as any
    );

    claudeProcess = new ClaudeProcess(logger, 'claude');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('spawn', () => {
    it('should spawn Claude CLI with provided args', () => {
      const args = ['chat', '--model', 'opus'];
      claudeProcess.spawn(args);

      expect(child_process.spawn).toHaveBeenCalledWith('claude', args, {
        stdio: ['pipe', 'pipe', 'inherit'],
        env: process.env,
      });
    });

    it('should capture stdin stream', () => {
      claudeProcess.spawn(['chat']);

      expect(claudeProcess.getStdin()).toBe(mockChildProcess.stdin);
    });

    it('should capture process reference', () => {
      claudeProcess.spawn(['chat']);

      expect(claudeProcess.getProcess()).toBe(mockChildProcess);
    });

    it('should use custom Claude CLI path', () => {
      const customPath = '/custom/path/to/claude';
      const customProcess = new ClaudeProcess(logger, customPath);
      customProcess.spawn(['chat']);

      expect(child_process.spawn).toHaveBeenCalledWith(
        customPath,
        ['chat'],
        expect.any(Object)
      );
    });
  });

  describe('getProcess', () => {
    it('should return null when not spawned', () => {
      expect(claudeProcess.getProcess()).toBeNull();
    });

    it('should return process after spawn', () => {
      claudeProcess.spawn(['chat']);
      expect(claudeProcess.getProcess()).toBe(mockChildProcess);
    });
  });

  describe('getStdin', () => {
    it('should return null when not spawned', () => {
      expect(claudeProcess.getStdin()).toBeNull();
    });

    it('should return stdin stream after spawn', () => {
      claudeProcess.spawn(['chat']);
      expect(claudeProcess.getStdin()).toBe(mockChildProcess.stdin);
    });
  });

  describe('kill', () => {
    it('should kill process with SIGTERM by default', () => {
      claudeProcess.spawn(['chat']);
      const killSpy = vi.spyOn(mockChildProcess, 'kill');

      claudeProcess.kill();

      expect(killSpy).toHaveBeenCalledWith('SIGTERM');
    });

    it('should kill process with custom signal', () => {
      claudeProcess.spawn(['chat']);
      const killSpy = vi.spyOn(mockChildProcess, 'kill');

      claudeProcess.kill('SIGKILL');

      expect(killSpy).toHaveBeenCalledWith('SIGKILL');
    });

    it('should not throw when process not spawned', () => {
      expect(() => claudeProcess.kill()).not.toThrow();
    });

    it('should not kill already killed process', () => {
      claudeProcess.spawn(['chat']);
      mockChildProcess.killed = true;
      const killSpy = vi.spyOn(mockChildProcess, 'kill');

      claudeProcess.kill();

      expect(killSpy).not.toHaveBeenCalled();
    });
  });

  describe('onExit', () => {
    it('should register exit handler', () => {
      claudeProcess.spawn(['chat']);
      const callback = vi.fn();

      claudeProcess.onExit(callback);
      mockChildProcess.simulateExit(0);

      expect(callback).toHaveBeenCalledWith(0, undefined);
    });

    it('should handle exit with signal', () => {
      claudeProcess.spawn(['chat']);
      const callback = vi.fn();

      claudeProcess.onExit(callback);
      mockChildProcess.simulateExit(137, 'SIGKILL');

      expect(callback).toHaveBeenCalledWith(137, 'SIGKILL');
    });

    it('should not throw when process not spawned', () => {
      const callback = vi.fn();
      expect(() => claudeProcess.onExit(callback)).not.toThrow();
    });
  });

  describe('onError', () => {
    it('should register error handler', () => {
      claudeProcess.spawn(['chat']);
      const callback = vi.fn();

      claudeProcess.onError(callback);
      const error = new Error('Process error');
      mockChildProcess.simulateError(error);

      expect(callback).toHaveBeenCalledWith(error);
    });

    it('should not throw when process not spawned', () => {
      const callback = vi.fn();
      expect(() => claudeProcess.onError(callback)).not.toThrow();
    });
  });
});
