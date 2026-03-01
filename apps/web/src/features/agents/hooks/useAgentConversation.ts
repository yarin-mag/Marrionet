import { useState, useEffect } from 'react';
import type { ConversationTurn, TokenUsage } from '@marionette/shared';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

export interface EnrichedConversationTurn extends ConversationTurn {
  tokens?: TokenUsage;
}

interface UseAgentConversationResult {
  turns: EnrichedConversationTurn[];
  isLoading: boolean;
  error: string | null;
}

export function useAgentConversation(agentId: string): UseAgentConversationResult {
  const [turns, setTurns] = useState<EnrichedConversationTurn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchConversation = async () => {
      try {
        const res = await fetch(`${API_URL}/api/agents/${agentId}/conversation`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setTurns(data.turns || []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load conversation');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchConversation();
    return () => { cancelled = true; };
  }, [agentId]);

  return { turns, isLoading, error };
}
