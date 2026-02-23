import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger } from '../Logger';
import chalk from 'chalk';

describe('Logger', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let logger: Logger;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger = new Logger('test-prefix');
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should use default prefix when none provided', () => {
      const defaultLogger = new Logger();
      defaultLogger.info('test message');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.blue('[claude-wrapper]'),
        'test message'
      );
    });

    it('should use custom prefix when provided', () => {
      logger.info('test message');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.blue('[test-prefix]'),
        'test message'
      );
    });
  });

  describe('info', () => {
    it('should log info messages with blue color', () => {
      logger.info('information message');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.blue('[test-prefix]'),
        'information message'
      );
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('success', () => {
    it('should log success messages with green color', () => {
      logger.success('success message');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.green('[test-prefix]'),
        'success message'
      );
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('warn', () => {
    it('should log warning messages with yellow color', () => {
      logger.warn('warning message');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.yellow('[test-prefix]'),
        'warning message'
      );
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('error', () => {
    it('should log error messages with red color', () => {
      logger.error('error message');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.red('[test-prefix]'),
        'error message'
      );
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('displayBanner', () => {
    it('should display formatted banner with all information', () => {
      const agentId = 'agent-123';
      const sessionId = 'session-456';
      const wrapperPid = 12345;
      const terminal = 'zsh';
      const cwd = '/home/user/project';
      const wsUrl = 'ws://localhost:8080';

      logger.displayBanner(
        agentId,
        sessionId,
        wrapperPid,
        terminal,
        cwd,
        wsUrl
      );

      // Should be called 10 times (3 separator lines + 7 info lines)
      expect(consoleErrorSpy).toHaveBeenCalledTimes(10);

      // Check for banner content
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.blue('[test-prefix]'),
        '═══════════════════════════════════════════════════'
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.blue('[test-prefix]'),
        'Claude Wrapper - Conversation Capture Enabled'
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.blue('[test-prefix]'),
        `Agent ID:          ${agentId}`
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.blue('[test-prefix]'),
        `Session ID:        ${sessionId}`
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.blue('[test-prefix]'),
        `Wrapper PID:       ${wrapperPid}`
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.blue('[test-prefix]'),
        `Terminal:          ${terminal}`
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.blue('[test-prefix]'),
        `Working Directory: ${cwd}`
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.blue('[test-prefix]'),
        `Marionette:         ${wsUrl}`
      );
    });
  });
});
