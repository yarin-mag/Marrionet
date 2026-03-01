import { WS_URL } from "../lib/constants";
import type { AgentSnapshot } from "@marionette/shared";

type WsMessage =
  | { type: "agents_updated" }
  | { type: "agent_update"; agent_id: string; updates: Partial<AgentSnapshot> };

type WebSocketCallback = (data: WsMessage) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectDelay = 1000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners: Set<WebSocketCallback> = new Set();

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (
      this.ws?.readyState === WebSocket.OPEN ||
      this.ws?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    try {
      this.ws = new WebSocket(`${WS_URL}/stream`);

      this.ws.onopen = () => {
        this.reconnectDelay = 1000;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WsMessage;

          // Notify all listeners (snapshot first to avoid mutation during iteration)
          [...this.listeners].forEach((callback) => callback(data));
        } catch (error) {
          console.error("[ws] Failed to parse message:", error);
        }
      };

      this.ws.onerror = (error) => {
        console.error("[ws] Error:", error);
      };

      this.ws.onclose = () => {
        this.attemptReconnect();
      };
    } catch (error) {
      console.error("[ws] Connection failed:", error);
      this.attemptReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.listeners.clear();
  }

  /**
   * Subscribe to WebSocket messages
   */
  subscribe(callback: WebSocketCallback): () => void {
    this.listeners.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Attempt to reconnect with exponential backoff (capped at 30s, no hard limit)
   */
  private attemptReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      // Double the delay before connecting so any synchronous re-throw from connect()
      // (the catch path) picks up the already-increased value.
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30_000);
      try {
        this.connect();
      } catch (error) {
        console.error("[ws] Reconnect attempt threw:", error);
        this.attemptReconnect(); // re-schedule
      }
    }, this.reconnectDelay);
  }

  /**
   * Get current connection status
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const wsService = new WebSocketService();
