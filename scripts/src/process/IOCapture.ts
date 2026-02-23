/**
 * I/O capture for Claude process stdin/stdout
 */

import readline from 'readline';
import { ChildProcess } from 'child_process';
import { Readable, Writable } from 'stream';
import { IMessageCapture } from '../interfaces/IMessageCapture.js';

export class IOCapture {
  constructor(private messageCapture: IMessageCapture) {}

  /**
   * Capture user input from terminal stdin
   */
  captureStdin(
    stdin: Readable,
    claudeStdin: Writable
  ): readline.Interface {
    const rl = readline.createInterface({
      input: stdin,
      output: claudeStdin,
      terminal: false,
    });

    rl.on('line', (line) => {
      this.messageCapture.captureUser(line, 'terminal');
    });

    return rl;
  }

  /**
   * Capture Claude output from stdout
   */
  captureStdout(
    stdout: Readable,
    userStdout: Writable
  ): readline.Interface {
    const rl = readline.createInterface({
      input: stdout,
      terminal: false,
    });

    rl.on('line', (line) => {
      // Forward to user's terminal
      userStdout.write(line + '\n');

      // Capture Claude's response
      this.messageCapture.captureClaude(line);
    });

    return rl;
  }
}
