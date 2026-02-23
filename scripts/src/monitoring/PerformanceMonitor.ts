/**
 * Performance monitoring via pidusage
 */

import pidusage from 'pidusage';
import { IMonitor } from '../interfaces/IMonitor.js';
import { EventEmitter } from '../websocket/EventEmitter.js';
import { Logger } from '../core/Logger.js';

export class PerformanceMonitor implements IMonitor {
  private interval: NodeJS.Timeout | null = null;

  constructor(
    private eventEmitter: EventEmitter,
    private logger: Logger,
    private pid: number,
    private intervalMs: number = 5000
  ) {}

  /**
   * Initialize performance monitoring
   */
  initialize(): void {
    this.interval = setInterval(() => {
      this.collectStats();
    }, this.intervalMs);
  }

  /**
   * Shutdown performance monitoring
   */
  shutdown(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /**
   * Collect performance statistics
   */
  private async collectStats(): Promise<void> {
    try {
      const stats = await pidusage(this.pid);

      this.eventEmitter.emitProcessStats(
        stats.cpu,
        stats.memory,
        stats.elapsed
      );
    } catch (err) {
      // Process might have exited, stop monitoring
      this.shutdown();
    }
  }
}
