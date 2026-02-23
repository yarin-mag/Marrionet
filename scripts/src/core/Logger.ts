/**
 * Logging utility with colored console output
 */

import chalk from 'chalk';

export class Logger {
  private prefix: string;

  constructor(prefix: string = 'claude-wrapper') {
    this.prefix = prefix;
  }

  info(msg: string): void {
    console.error(chalk.blue(`[${this.prefix}]`), msg);
  }

  success(msg: string): void {
    console.error(chalk.green(`[${this.prefix}]`), msg);
  }

  warn(msg: string): void {
    console.error(chalk.yellow(`[${this.prefix}]`), msg);
  }

  error(msg: string): void {
    console.error(chalk.red(`[${this.prefix}]`), msg);
  }

  displayBanner(
    agentId: string,
    sessionId: string,
    wrapperPid: number,
    terminal: string,
    cwd: string,
    wsUrl: string
  ): void {
    this.info('═══════════════════════════════════════════════════');
    this.info('Claude Wrapper - Conversation Capture Enabled');
    this.info('═══════════════════════════════════════════════════');
    this.info(`Agent ID:          ${agentId}`);
    this.info(`Session ID:        ${sessionId}`);
    this.info(`Wrapper PID:       ${wrapperPid}`);
    this.info(`Terminal:          ${terminal}`);
    this.info(`Working Directory: ${cwd}`);
    this.info(`Marionette:         ${wsUrl}`);
    this.info('═══════════════════════════════════════════════════');
  }
}
