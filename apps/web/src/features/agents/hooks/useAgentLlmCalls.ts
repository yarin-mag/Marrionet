import { useState, useEffect } from "react";
import { calculateCost, getPricingForModel } from "@marionette/shared";
import type { ModelPricing } from "@marionette/shared";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787";

interface LlmCallRecord {
  ts: string;
  summary: string;
  duration_ms: number | null;
  tokens: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
    total_tokens?: number;
    cost_usd?: number;
  } | null;
  payload: {
    model?: string;
    stop_reason?: string;
    streaming?: boolean;
    ttft_ms?: number | null;
    messages_count?: number;
    tools_count?: number;
    source?: string;
  } | null;
}

interface AgentLlmStats {
  totalCostUsd: number;
  lastModel: string | null;
  callCount: number;
  calls: LlmCallRecord[];
  pricing: ModelPricing;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheWriteTokens: number;
  totalCacheReadTokens: number;
}

interface UseAgentLlmCallsResult {
  stats: AgentLlmStats;
  isLoading: boolean;
}

export function useAgentLlmCalls(agentId: string): UseAgentLlmCallsResult {
  const [stats, setStats] = useState<AgentLlmStats>(() => ({
    totalCostUsd: 0,
    lastModel: null,
    callCount: 0,
    calls: [],
    pricing: getPricingForModel(null),
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheWriteTokens: 0,
    totalCacheReadTokens: 0,
  }));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchLlmCalls = async () => {
      try {
        const res = await fetch(`${API_URL}/api/agents/${agentId}/llm-calls?limit=200`);
        if (!res.ok) return;
        const data = (await res.json()) as { calls: LlmCallRecord[] };
        if (cancelled) return;

        const calls = data.calls ?? [];
        const lastModel = calls.length > 0 ? (calls[0].payload?.model ?? null) : null;
        const pricing = getPricingForModel(lastModel);

        let totalCostUsd = 0;
        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        let totalCacheWriteTokens = 0;
        let totalCacheReadTokens = 0;

        for (const c of calls) {
          const t = c.tokens ?? {};
          totalInputTokens += t.input_tokens ?? 0;
          totalOutputTokens += t.output_tokens ?? 0;
          totalCacheWriteTokens += t.cache_creation_input_tokens ?? 0;
          totalCacheReadTokens += t.cache_read_input_tokens ?? 0;
          // Use stored cost_usd if available; fall back to client-side calculation
          const cost =
            t.cost_usd != null
              ? t.cost_usd
              : calculateCost(t, c.payload?.model);
          totalCostUsd += cost;
        }

        setStats({
          totalCostUsd,
          lastModel,
          callCount: calls.length,
          calls,
          pricing,
          totalInputTokens,
          totalOutputTokens,
          totalCacheWriteTokens,
          totalCacheReadTokens,
        });
      } catch {
        // Non-fatal — proxy may not be running
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchLlmCalls();
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  return { stats, isLoading };
}
