import { WebSocket } from "ws";
import type { MarionetteEvent, AgentMetadata } from "@marionette/shared";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { withRetry } from "../utils/retry.js";

const RECONNECT_INTERVAL_MS = 5_000;

/**
 * WebSocket service for MCP server
 * Handles connection, reconnection, and event emission
 */
export class WebSocketService {
  private ws?: WebSocket;
  private stopRetry: (() => void) | null = null;
  private intentionalClose = false;

  constructor(
    private agentId: string,
    private runId: string,
    private agentMetadata: AgentMetadata
  ) {}

  /**
   * Connect to Marionette server.
   * Automatically retries every 30s if the connection drops or fails.
   */
  connect(): void {
    this.intentionalClose = false;
    this.attemptConnection();
  }

  private attemptConnection(): void {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    try {
      this.ws = new WebSocket(config.wsUrl);

      this.ws.on("open", () => {
        logger.info("WebSocket connected");
        this.clearRetry();
      });

      this.ws.on("error", (err) => {
        logger.error("WebSocket error:", err.message);
      });

      this.ws.on("close", () => {
        if (this.intentionalClose) {
          logger.info("WebSocket closed");
          return;
        }
        logger.info(
          `WebSocket disconnected, retrying every ${RECONNECT_INTERVAL_MS / 1000}s`
        );
        this.scheduleRetry();
      });
    } catch (err) {
      logger.error("WebSocket connection failed:", err);
      this.scheduleRetry();
    }
  }

  private scheduleRetry(): void {
    if (this.intentionalClose || this.stopRetry) return;
    this.stopRetry = withRetry(() => {
      logger.info("Retrying WebSocket connection...");
      this.attemptConnection();
    }, RECONNECT_INTERVAL_MS);
  }

  private clearRetry(): void {
    this.stopRetry?.();
    this.stopRetry = null;
  }

  /**
   * Emit an event to Marionette
   */
  emit(event: Partial<MarionetteEvent>): void {
    try {
      const payload: MarionetteEvent = {
        agent_id: this.agentId,
        run_id: this.runId,
        ts: new Date().toISOString(),
        agent_metadata: this.agentMetadata,
        ...event,
      } as MarionetteEvent;

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(payload));
      }
    } catch (err) {
      logger.error("Event emission failed:", err);
    }
  }

  /**
   * Close WebSocket connection intentionally (no retry)
   */
  close(): void {
    this.intentionalClose = true;
    this.clearRetry();
    if (this.ws && (
      this.ws.readyState === WebSocket.OPEN ||
      this.ws.readyState === WebSocket.CONNECTING
    )) {
      this.ws.close();
    }
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}