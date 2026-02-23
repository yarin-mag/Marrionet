/**
 * Network monitoring via http/https hooks
 */

import { IMonitor } from '../interfaces/IMonitor.js';
import { EventEmitter } from '../websocket/EventEmitter.js';
import { HookRegistry } from '../hooks/HookRegistry.js';

export class NetworkMonitor implements IMonitor {
  constructor(
    private eventEmitter: EventEmitter,
    private hookRegistry: HookRegistry
  ) {}

  /**
   * Initialize network monitoring
   */
  initialize(): void {
    // Register HTTP hooks
    this.hookRegistry.registerHttpHooks(
      (url, method, req) => this.handleRequest(url, method),
      (url, statusCode, durationMs) =>
        this.handleResponse(url, statusCode, durationMs),
      (url, error) => this.handleError(url, error)
    );

    // Register HTTPS hooks
    this.hookRegistry.registerHttpsHooks(
      (url, method, req) => this.handleRequest(url, method),
      (url, statusCode, durationMs) =>
        this.handleResponse(url, statusCode, durationMs),
      (url, error) => this.handleError(url, error)
    );
  }

  /**
   * Shutdown network monitoring
   */
  shutdown(): void {
    // No cleanup needed
  }

  /**
   * Handle network request
   */
  private handleRequest(url: string, method: string): void {
    this.eventEmitter.emitNetworkRequest(method, url);
  }

  /**
   * Handle network response
   */
  private handleResponse(
    url: string,
    statusCode: number,
    durationMs: number
  ): void {
    this.eventEmitter.emitNetworkResponse(url, statusCode, durationMs);
  }

  /**
   * Handle network error
   */
  private handleError(url: string, error: Error): void {
    this.eventEmitter.emitNetworkError(url, error.message);
  }
}
