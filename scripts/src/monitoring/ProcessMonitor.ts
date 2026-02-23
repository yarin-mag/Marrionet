/**
 * Process monitoring via child_process hooks
 */

import { IMonitor } from '../interfaces/IMonitor.js';
import { EventEmitter } from '../websocket/EventEmitter.js';
import { HookRegistry } from '../hooks/HookRegistry.js';

export class ProcessMonitor implements IMonitor {
  constructor(
    private eventEmitter: EventEmitter,
    private hookRegistry: HookRegistry
  ) {}

  /**
   * Initialize process monitoring
   */
  initialize(): void {
    this.hookRegistry.registerSpawnHook((command, args, child) => {
      this.handleSpawn(command, args, child);
    });
  }

  /**
   * Shutdown process monitoring
   */
  shutdown(): void {
    // No cleanup needed
  }

  /**
   * Handle process spawn event
   */
  private handleSpawn(
    command: string,
    args: readonly string[] | undefined,
    child: any
  ): void {
    if (child.pid) {
      this.eventEmitter.emitProcessSpawned(
        child.pid,
        command,
        args || []
      );
    }

    // Listen for exit
    child.on('exit', (code: number | null, signal: string | null) => {
      if (child.pid) {
        this.eventEmitter.emitProcessExited(child.pid, code, signal);
      }
    });
  }
}
