import { useState, useEffect, useRef } from 'react';
import type { ConversationSession, ConversationTurn } from '@marionette/shared';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8787';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

interface UseAgentConversationResult {
  conversation: ConversationSession;
  isLoading: boolean;
  isConnected: boolean;
  sendMessage: (content: string) => Promise<void>;
  error: string | null;
}

export function useAgentConversation(agentId: string): UseAgentConversationResult {
  const [conversation, setConversation] = useState<ConversationSession>({
    session_id: '',
    agent_id: agentId,
    started_at: new Date().toISOString(),
    turn_count: 0,
    turns: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch conversation history when the modal opens
  useEffect(() => {
    let cancelled = false;

    const fetchHistory = async () => {
      try {
        const res = await fetch(`${API_URL}/api/conversation/agent/${agentId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.success && data.turns?.length > 0) {
          setConversation({
            session_id: data.session_id ?? '',
            agent_id: agentId,
            started_at: data.turns[0]?.timestamp ?? new Date().toISOString(),
            turn_count: data.turn_count,
            turns: data.turns,
          });
        }
      } catch {
        // Non-fatal: fall back to empty state, real-time updates still work
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchHistory();
    return () => { cancelled = true; };
  }, [agentId]);

  // Connect to WebSocket for real-time updates
  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let mounted = true;

    const connect = () => {
      if (!mounted) return;

      try {
        const ws = new WebSocket(`${WS_URL}/client-stream`);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!mounted) return;
          console.log('WebSocket connected');
          setIsConnected(true);
          setError(null);
        };

        ws.onmessage = (event) => {
          if (!mounted) return;

          try {
            const data = JSON.parse(event.data);

            // Handle conversation turn — skip duplicates (already in history)
            if (data.type === 'conversation.turn' && data.agent_id === agentId) {
              setConversation((prev: ConversationSession) => {
                if (data.message?.id && prev.turns.some((t: ConversationTurn) => t.id === data.message.id)) {
                  return prev;
                }
                return {
                  ...prev,
                  session_id: data.session_id || prev.session_id,
                  turns: [...prev.turns, data.message],
                  turn_count: prev.turn_count + 1,
                };
              });
            }

            // Handle conversation started
            if (data.type === 'conversation.started' && data.agent_id === agentId) {
              setConversation((prev: ConversationSession) => ({
                ...prev,
                session_id: data.session_id,
                started_at: data.timestamp,
                turns: [],
                turn_count: 0,
              }));
            }

            // Handle conversation ended
            if (data.type === 'conversation.ended' && data.agent_id === agentId) {
              setConversation((prev: ConversationSession) => ({
                ...prev,
                ended_at: data.timestamp,
              }));
            }
          } catch (err) {
            console.error('Failed to parse WebSocket message:', err);
          }
        };

        ws.onerror = (err) => {
          if (!mounted) return;
          console.error('WebSocket error:', err);
          setError('WebSocket connection error');
          setIsConnected(false);
        };

        ws.onclose = () => {
          if (!mounted) return;
          console.log('WebSocket disconnected');
          setIsConnected(false);

          // Attempt to reconnect after 3 seconds
          reconnectTimer = setTimeout(() => {
            if (mounted) {
              console.log('Attempting to reconnect...');
              connect();
            }
          }, 3000);
        };
      } catch (err) {
        console.error('Failed to create WebSocket:', err);
        setError('Failed to connect to WebSocket');
        setIsConnected(false);

        // Retry connection
        reconnectTimer = setTimeout(() => {
          if (mounted) connect();
        }, 3000);
      }
    };

    connect();

    return () => {
      mounted = false;
      clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [agentId]);

  // Send message to agent
  const sendMessage = async (content: string): Promise<void> => {
    if (!content.trim()) {
      throw new Error('Message content cannot be empty');
    }

    try {
      // Try WebSocket first if connected
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'message.send',
            agent_id: agentId,
            content: content.trim(),
          })
        );
        return;
      }

      // Fallback to HTTP if WebSocket not connected
      const response = await fetch(`${API_URL}/api/conversation/${agentId}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: content.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to send message');
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      throw err;
    }
  };

  return {
    conversation,
    isLoading,
    isConnected,
    sendMessage,
    error,
  };
}
