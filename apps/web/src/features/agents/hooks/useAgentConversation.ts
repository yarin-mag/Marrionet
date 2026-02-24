import { useState, useEffect, useRef } from 'react';
import type { ConversationSession, ConversationTurn } from '@marionette/shared';
import { createAgentSocket } from '../../../services/agentSocket';
import type { AgentSocketConnection } from '../../../services/agentSocket';

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
  const socketRef = useRef<AgentSocketConnection | null>(null);

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
    const socket = createAgentSocket({
      onOpen: () => {
        setIsConnected(true);
        setError(null);
      },
      onMessage: (event) => {
        try {
          const data = JSON.parse(event.data as string);

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

          if (data.type === 'conversation.started' && data.agent_id === agentId) {
            setConversation((prev: ConversationSession) => ({
              ...prev,
              session_id: data.session_id,
              started_at: data.timestamp,
              turns: [],
              turn_count: 0,
            }));
          }

          if (data.type === 'conversation.ended' && data.agent_id === agentId) {
            setConversation((prev: ConversationSession) => ({
              ...prev,
              ended_at: data.timestamp,
            }));
          }
        } catch {
          // Ignore malformed messages
        }
      },
      onError: () => {
        setError('WebSocket connection error');
        setIsConnected(false);
      },
      onClose: () => {
        setIsConnected(false);
      },
    });

    socketRef.current = socket;

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [agentId]);

  const sendMessage = async (content: string): Promise<void> => {
    if (!content.trim()) {
      throw new Error('Message content cannot be empty');
    }

    try {
      const ws = socketRef.current?.getSocket();
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'message.send', agent_id: agentId, content: content.trim() }));
        return;
      }

      const response = await fetch(`${API_URL}/api/conversation/${agentId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error((errorData as { error?: string }).error || 'Failed to send message');
      }
    } catch (err) {
      throw err;
    }
  };

  return { conversation, isLoading, isConnected, sendMessage, error };
}
