const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8787';

export const RECONNECT_DELAY_MS = 3_000;

export interface AgentSocketHandlers {
  onOpen: () => void;
  onMessage: (event: MessageEvent) => void;
  onError: () => void;
  onClose: () => void;
}

export interface AgentSocketConnection {
  getSocket: () => WebSocket | null;
  close: () => void;
}

/**
 * Creates a managed WebSocket connection to the client stream endpoint.
 * Handles reconnection on close or failure automatically.
 * Call `close()` on the returned object to teardown cleanly.
 */
export function createAgentSocket(handlers: AgentSocketHandlers): AgentSocketConnection {
  let mounted = true;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let ws: WebSocket | null = null;

  const scheduleReconnect = () => {
    reconnectTimer = setTimeout(() => {
      if (mounted) connect();
    }, RECONNECT_DELAY_MS);
  };

  const connect = () => {
    if (!mounted) return;

    try {
      ws = new WebSocket(`${WS_URL}/client-stream`);

      ws.onopen = () => {
        if (!mounted) return;
        handlers.onOpen();
      };

      ws.onmessage = (event) => {
        if (!mounted) return;
        handlers.onMessage(event);
      };

      ws.onerror = () => {
        if (!mounted) return;
        handlers.onError();
      };

      ws.onclose = () => {
        if (!mounted) return;
        handlers.onClose();
        scheduleReconnect();
      };
    } catch {
      scheduleReconnect();
    }
  };

  connect();

  return {
    getSocket: () => ws,
    close: () => {
      mounted = false;
      clearTimeout(reconnectTimer);
      ws?.close();
      ws = null;
    },
  };
}
