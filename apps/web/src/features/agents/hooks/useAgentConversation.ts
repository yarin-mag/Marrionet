import { useState, useEffect } from 'react';
import type { ConversationTurn, TokenUsage } from '@marionette/shared';
import { useDemoMode } from '../../../hooks/useDemoMode';
import { DEMO_CONVERSATIONS } from '../../../lib/demo-data';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

export interface EnrichedConversationTurn extends ConversationTurn {
  tokens?: TokenUsage;
}

export interface ConversationTotals {
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

interface UseAgentConversationResult {
  turns: EnrichedConversationTurn[];
  totals: ConversationTotals | null;
  isLoading: boolean;
  error: string | null;
}

export function useAgentConversation(agentId: string): UseAgentConversationResult {
  const isDemoMode = useDemoMode();
  const [turns, setTurns] = useState<EnrichedConversationTurn[]>([]);
  const [totals, setTotals] = useState<ConversationTotals | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isDemoMode) {
      setTurns(DEMO_CONVERSATIONS[agentId] ?? []);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const fetchConversation = async () => {
      try {
        const res = await fetch(`${API_URL}/api/agents/${agentId}/conversation`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setTurns(data.turns || []);
        setTotals(data.totals ?? null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load conversation');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchConversation();
    return () => { cancelled = true; };
  }, [agentId, isDemoMode]);

  return { turns, totals, isLoading, error };
}
