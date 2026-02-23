/**
 * Passthrough mode - fallback when backend is unavailable
 * Simply spawns Claude without any monitoring or capture
 */

import { spawn } from 'child_process';
import { Logger } from '../core/Logger.js';

export class PassthroughMode {
  constructor(
    private logger: Logger,
    private claudeCliPath: string
  ) {}

  /**
   * Execute passthrough mode
   */
  execute(args: string[]): void {
    this.logger.warn('Running in passthrough mode');

    const claudeProcess = spawn(this.claudeCliPath, args, {
      stdio: 'inherit',
      env: process.env,
    });

    claudeProcess.on('exit', (code) => {
      process.exit(code || 0);
    });
  }
}
