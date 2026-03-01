import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

export interface RunHistoryItem {
  run_id: string;
  started_at: string;
  ended_at?: string | null;
  duration_ms?: number | null;
  current_task?: string | null;
  total_tokens: number;
  total_cost_usd: number;
}

interface UseAgentRunsResult {
  runs: RunHistoryItem[];
  isLoading: boolean;
}

export function useAgentRuns(agentId: string): UseAgentRunsResult {
  const [runs, setRuns] = useState<RunHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchRuns = async () => {
      try {
        const res = await fetch(`${API_URL}/api/agents/${agentId}/runs`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setRuns(data.runs || []);
      } catch {
        if (!cancelled) setRuns([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchRuns();
    return () => { cancelled = true; };
  }, [agentId]);

  return { runs, isLoading };
}
