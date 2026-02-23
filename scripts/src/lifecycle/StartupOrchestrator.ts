/**
 * Startup sequence orchestration
 */

import { WebSocketClient } from '../websocket/WebSocketClient.js';
import { EventEmitter } from '../websocket/EventEmitter.js';
import { HeartbeatManager } from '../websocket/HeartbeatManager.js';
import { IMonitor } from '../interfaces/IMonitor.js';
import { Logger } from '../core/Logger.js';
import { TerminalInfo } from '../types/state.js';

const RETRY_INTERVAL_MS = 30_000;

export class StartupOrchestrator {
  constructor(
    private logger: Logger,
    private wsClient: WebSocketClient,
    private eventEmitter: EventEmitter,
    private heartbeat: HeartbeatManager,
    private monitors: IMonitor[]
  ) {}

  /**
   * Execute normal startup flow (blocking — waits for backend connection)
   */
  async execute(
    wsUrl: string,
    wrapperPid: number,
    terminalInfo: TerminalInfo
  ): Promise<void> {
    this.initializeMonitors();
    await this.wsClient.connect(wsUrl);
    this.logger.success('Connected to Marionette backend');
    this.eventEmitter.emitAgentStarted(wrapperPid, terminalInfo);
    this.eventEmitter.emitConversationStarted();
    this.heartbeat.start();
  }

  /**
   * Non-blocking connection with automatic retry every 30s.
   * Claude starts immediately; this runs in the background.
   * On unexpected disconnect, reconnects and re-registers the agent.
   */
  startBackgroundConnection(
    wsUrl: string,
    wrapperPid: number,
    terminalInfo: TerminalInfo
  ): void {
    const attempt = (): void => {
      this.wsClient
        .connect(wsUrl)
        .then(() => {
          this.logger.success('Connected to Marionette backend');
          this.eventEmitter.emitAgentStarted(wrapperPid, terminalInfo);
          this.eventEmitter.emitConversationStarted();
          this.heartbeat.start();

          // On unexpected disconnect, stop heartbeat and retry
          this.wsClient.onClose(() => {
            this.heartbeat.stop();
            this.logger.warn(
              `Backend disconnected, retrying in ${RETRY_INTERVAL_MS / 1000}s...`
            );
            setTimeout(attempt, RETRY_INTERVAL_MS);
          });
        })
        .catch((err: Error) => {
          this.logger.warn(
            `Backend unavailable (${err.message}), retrying in ${RETRY_INTERVAL_MS / 1000}s...`
          );
          setTimeout(attempt, RETRY_INTERVAL_MS);
        });
    };

    attempt();
  }

  /**
   * Initialize all monitors
   */
  initializeMonitors(): void {
    this.monitors.forEach((monitor) => {
      monitor.initialize();
    });
  }
}