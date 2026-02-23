/**
 * Shutdown and cleanup management
 */

import { WebSocketClient } from '../websocket/WebSocketClient.js';
import { EventEmitter } from '../websocket/EventEmitter.js';
import { HeartbeatManager } from '../websocket/HeartbeatManager.js';
import { IMonitor } from '../interfaces/IMonitor.js';
import { IMessageCapture } from '../interfaces/IMessageCapture.js';
import { IProcessManager } from '../interfaces/IProcessManager.js';
import { Logger } from '../core/Logger.js';

export class ShutdownManager {
  constructor(
    private logger: Logger,
    private wsClient: WebSocketClient,
    private eventEmitter: EventEmitter,
    private heartbeat: HeartbeatManager,
    private messageCapture: IMessageCapture,
    private processManager: IProcessManager,
    private monitors: IMonitor[],
    private startTime: number
  ) {}

  /**
   * Perform graceful shutdown
   */
  shutdown(
    signal: NodeJS.Signals,
    exitCode: number | null = null
  ): void {
    this.logger.info(`Received ${signal}, cleaning up...`);

    // Stop heartbeat
    this.heartbeat.stop();

    // Stop all monitors
    this.stopMonitors();

    // Flush pending messages
    this.messageCapture.flush();

    // Calculate duration
    const durationSeconds = Math.floor(
      (Date.now() - this.startTime) / 1000
    );

    // Send disconnect events
    if (this.wsClient.isConnectedToBackend()) {
      this.eventEmitter.emitAgentDisconnected(
        exitCode,
        signal,
        durationSeconds
      );
      this.eventEmitter.emitConversationEnded(durationSeconds);
    }

    // Kill Claude process
    this.processManager.kill(signal as string);

    // Close WebSocket
    this.wsClient.disconnect();

    process.exit(exitCode || 0);
  }

  /**
   * Stop all monitors
   */
  private stopMonitors(): void {
    this.monitors.forEach((monitor) => {
      monitor.shutdown();
    });
  }
}
