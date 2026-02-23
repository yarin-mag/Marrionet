import { WS_URL } from "../lib/constants";

type WebSocketCallback = (data: any) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: Set<WebSocketCallback> = new Set();

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log("[ws] Already connected");
      return;
    }

    try {
      this.ws = new WebSocket(`${WS_URL}/stream`);

      this.ws.onopen = () => {
        console.log("[ws] Connected");
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("[ws] Message:", data.type);

          // Notify all listeners
          this.listeners.forEach((callback) => callback(data));
        } catch (error) {
          console.error("[ws] Failed to parse message:", error);
        }
      };

      this.ws.onerror = (error) => {
        console.error("[ws] Error:", error);
      };

      this.ws.onclose = () => {
        console.log("[ws] Disconnected");
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
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[ws] Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    console.log(
      `[ws] Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    setTimeout(() => {
      this.connect();
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
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
