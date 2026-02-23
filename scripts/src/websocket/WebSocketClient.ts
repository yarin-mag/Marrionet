/**
 * WebSocket connection manager
 */

import WebSocket from 'ws';
import { AgentEvent, IncomingEvent } from '../types/events.js';
import { Logger } from '../core/Logger.js';

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private isConnected: boolean = false;
  private logger: Logger;
  private messageHandler: ((event: IncomingEvent) => void) | null = null;
  private closeHandler: (() => void) | null = null;
  private intentionalDisconnect = false;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Register a callback for unexpected disconnects (not triggered by disconnect())
   */
  onClose(handler: () => void): void {
    this.closeHandler = handler;
  }

  /**
   * Connect to WebSocket backend
   */
  async connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 5000);

      this.ws = new WebSocket(`${url}/agent-stream`);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        this.isConnected = true;
        resolve();
      });

      this.ws.on('error', (err) => {
        clearTimeout(timeout);
        this.isConnected = false;
        reject(err);
      });

      this.ws.on('close', () => {
        this.isConnected = false;
        this.logger.warn('WebSocket connection closed');
        if (!this.intentionalDisconnect) {
          this.closeHandler?.();
        }
        this.intentionalDisconnect = false;
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data);
      });
    });
  }

  /**
   * Disconnect from WebSocket (intentional — does not trigger onClose callback)
   */
  disconnect(): void {
    this.intentionalDisconnect = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  /**
   * Send an event to the backend
   */
  send(event: AgentEvent): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      this.ws.send(JSON.stringify(event));
    } catch (err) {
      this.logger.error(
        `Failed to send event: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * Register a message handler for incoming events
   */
  onMessage(handler: (event: IncomingEvent) => void): void {
    this.messageHandler = handler;
  }

  /**
   * Check if connected
   */
  isConnectedToBackend(): boolean {
    return this.isConnected;
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: WebSocket.Data): void {
    try {
      const event = JSON.parse(data.toString()) as IncomingEvent;
      if (this.messageHandler) {
        this.messageHandler(event);
      }
    } catch (err) {
      this.logger.error(
        `Failed to parse WebSocket message: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}