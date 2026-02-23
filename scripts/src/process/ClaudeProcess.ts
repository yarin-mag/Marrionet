/**
 * Claude CLI process management via node-pty (pseudo-terminal)
 *
 * Uses node-pty so Claude Code gets a real TTY (preserving its interactive TUI)
 * while the wrapper can intercept all I/O for capture and injection.
 */

import * as pty from 'node-pty';
import type { IPty } from 'node-pty';
import { IProcessManager } from '../interfaces/IProcessManager.js';
import { Logger } from '../core/Logger.js';

export class ClaudeProcess implements IProcessManager {
  private ptyProcess: IPty | null = null;

  constructor(
    private logger: Logger,
    private claudeCliPath: string = 'claude'
  ) {}

  /**
   * Spawn the Claude CLI inside a PTY so its TUI renders correctly
   * while allowing the wrapper to read/write all I/O.
   */
  spawn(args: string[]): void {
    this.ptyProcess = pty.spawn(this.claudeCliPath, args, {
      name: 'xterm-256color',
      cols: process.stdout.columns || 220,
      rows: process.stdout.rows || 50,
      cwd: process.cwd(),
      env: process.env as { [key: string]: string },
    });
  }

  /**
   * Get the process PID
   */
  getPid(): number | null {
    return this.ptyProcess?.pid ?? null;
  }

  /**
   * Subscribe to output data chunks from the PTY
   */
  onData(callback: (data: string) => void): void {
    if (!this.ptyProcess) return;
    this.ptyProcess.onData(callback);
  }

  /**
   * Write data to the PTY stdin (forwarded to Claude)
   */
  writeStdin(data: string): void {
    if (!this.ptyProcess) return;
    this.ptyProcess.write(data);
  }

  /**
   * Resize the PTY dimensions (call when terminal window is resized)
   */
  resize(cols: number, rows: number): void {
    if (!this.ptyProcess) return;
    try {
      this.ptyProcess.resize(cols, rows);
    } catch {
      // Ignore resize errors (process may have exited)
    }
  }

  /**
   * Kill the Claude process
   */
  kill(signal?: string): void {
    if (!this.ptyProcess) return;
    try {
      this.ptyProcess.kill(signal);
    } catch {
      // Ignore kill errors (process may have already exited)
    }
  }

  /**
   * Register an exit handler
   */
  onExit(
    callback: (exitCode: number | null, signal: string | null) => void
  ): void {
    if (!this.ptyProcess) return;
    this.ptyProcess.onExit(({ exitCode, signal }) => {
      callback(exitCode, signal !== undefined ? String(signal) : null);
    });
  }

  /**
   * Register an error handler (no-op for PTY — errors surface via exit)
   */
  onError(_callback: (err: Error) => void): void {
    // node-pty surfaces errors via onExit; no separate error event needed
  }
}
