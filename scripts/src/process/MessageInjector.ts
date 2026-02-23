/**
 * Message injection from web UI to Claude stdin
 */

import { Writable } from 'stream';
import chalk from 'chalk';
import { IMessageCapture } from '../interfaces/IMessageCapture.js';
import { Logger } from '../core/Logger.js';

export class MessageInjector {
  constructor(
    private messageCapture: IMessageCapture,
    private logger: Logger
  ) {}

  /**
   * Inject a message into Claude's stdin
   */
  inject(content: string, claudeStdin: Writable | null): void {
    if (!claudeStdin) {
      this.logger.error(
        'Cannot inject message: Claude stdin not available'
      );
      return;
    }

    // Echo to terminal so user sees it
    process.stdout.write(
      chalk.cyan('\n[From Web UI] ') + content + '\n'
    );

    // Write to Claude's stdin
    claudeStdin.write(content + '\n');

    // Capture as user message from web source
    this.messageCapture.captureUser(content, 'web');
  }
}
