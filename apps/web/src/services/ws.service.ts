import { API_URL } from "../lib/constants";
import type { AgentSnapshot } from "@marionette/shared";

type WsMessage =
  | { type: "agents_updated" }
  | { type: "agent_update"; agent_id: string; updates: Partial<AgentSnapshot> };

type MessageCallback = (data: WsMessage) => void;

class StreamService {
  private es: EventSource | null = null;
  private listeners: Set<MessageCallback> = new Set();

  connect(): void {
    if (
      this.es?.readyState === EventSource.OPEN ||
      this.es?.readyState === EventSource.CONNECTING
    ) {
      return;
    }

    this.es = new EventSource(`${API_URL}/stream`);

    this.es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WsMessage;
        [...this.listeners].forEach((callback) => callback(data));
      } catch (error) {
        console.error("[sse] Failed to parse message:", error);
      }
    };

    this.es.onerror = (error) => {
      console.error("[sse] Error:", error);
      // EventSource reconnects automatically — no manual retry needed
    };
  }

  disconnect(): void {
    if (this.es) {
      this.es.close();
      this.es = null;
    }
    this.listeners.clear();
  }

  subscribe(callback: MessageCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  get isConnected(): boolean {
    return this.es?.readyState === EventSource.OPEN;
  }
}

export const wsService = new StreamService();
