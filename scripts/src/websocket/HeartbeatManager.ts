/**
 * Heartbeat management for keeping connection alive
 */

import { EventEmitter } from './EventEmitter.js';

export class HeartbeatManager {
  private interval: NodeJS.Timeout | null = null;

  constructor(
    private eventEmitter: EventEmitter,
    private startTime: number,
    private intervalMs: number = 30000
  ) {}

  /**
   * Start sending heartbeat events
   */
  start(): void {
    this.interval = setInterval(() => {
      this.sendHeartbeat();
    }, this.intervalMs);
  }

  /**
   * Stop sending heartbeat events
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /**
   * Send a single heartbeat event
   */
  private sendHeartbeat(): void {
    const uptimeSeconds = Math.floor(
      (Date.now() - this.startTime) / 1000
    );
    const memoryBytes = process.memoryUsage().heapUsed;

    this.eventEmitter.emitAgentHeartbeat(
      uptimeSeconds,
      memoryBytes
    );
  }
}
