import { useEffect, useState, useCallback, useRef } from 'react';
import { useAgentMessengerStore } from '../features/agents/stores/agent-messenger.store';
import type { Message } from '@marionette/shared';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

interface UseAgentMessagingReturn {
  messages: Message[];
  isConnected: boolean;
  isTyping: boolean;
  isSending: boolean;
  sendMessage: (content: string) => Promise<void>;
  loadHistory: () => Promise<void>;
  error: string | null;
}

/**
 * Hook for agent messaging functionality
 */
export function useAgentMessaging(agentId: string): UseAgentMessagingReturn {
  const {
    messagesByAgent,
    addMessage,
    setMessages,
    markAsRead,
    typingAgents,
    setTyping,
  } = useAgentMessengerStore();

  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(true); // Assume connected for now
  const hasLoadedHistory = useRef(false);

  const messages = messagesByAgent[agentId] || [];
  const isTyping = typingAgents.has(agentId);

  /**
   * Load message history from server
   */
  const loadHistory = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/agents/${agentId}/messages?limit=100`
      );

      if (!response.ok) {
        throw new Error('Failed to load message history');
      }

      const data = await response.json();
      setMessages(agentId, data.messages || []);
      hasLoadedHistory.current = true;
    } catch (err: any) {
      console.error('Failed to load history:', err);
      setError(err.message);
    }
  }, [agentId, setMessages]);

  /**
   * Send a message to the agent
   */
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      setIsSending(true);
      setError(null);

      try {
        const response = await fetch(`${API_URL}/api/agents/${agentId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: content.trim(),
            userId: 'dashboard-user', // TODO: Get from auth context
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to send message');
        }

        const message: Message = await response.json();

        // Optimistically add message to UI
        addMessage(agentId, message);

        // Set typing indicator
        setTyping(agentId, true);
        setTimeout(() => setTyping(agentId, false), 3000);
      } catch (err: any) {
        console.error('Failed to send message:', err);
        setError(err.message);
      } finally {
        setIsSending(false);
      }
    },
    [agentId, addMessage, setTyping]
  );

  /**
   * Load history on mount
   */
  useEffect(() => {
    if (!hasLoadedHistory.current) {
      loadHistory();
    }
  }, [loadHistory]);

  /**
   * Mark messages as read when viewing the chat
   */
  useEffect(() => {
    markAsRead(agentId);
  }, [agentId, markAsRead]);

  /**
   * WebSocket listener (integration with existing WebSocket service)
   * This would connect to the dashboard's WebSocket stream
   */
  useEffect(() => {
    // TODO: Integrate with existing WebSocket service
    // For now, we'll poll for new messages periodically
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(
          `${API_URL}/api/agents/${agentId}/messages?limit=10`
        );
        if (response.ok) {
          const data = await response.json();
          const latestMessages = data.messages || [];

          // Check for new messages
          latestMessages.forEach((msg: Message) => {
            if (!messages.find(m => m.id === msg.id)) {
              addMessage(agentId, msg);
            }
          });
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [agentId, messages, addMessage]);

  return {
    messages,
    isConnected,
    isTyping,
    isSending,
    sendMessage,
    loadHistory,
    error,
  };
}
