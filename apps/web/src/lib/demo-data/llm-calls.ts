const now = Date.now();

function makeCalls(_agentId: string, count: number, model = "claude-sonnet-4-6") {
  return Array.from({ length: count }, (_, i) => ({
    ts: new Date(now - (count - i) * 5 * 60_000).toISOString(),
    summary: `llm.call #${i + 1}`,
    duration_ms: 800 + Math.floor(Math.random() * 3200),
    tokens: {
      input_tokens: 1200 + i * 80,
      output_tokens: 350 + i * 40,
      cache_read_input_tokens: i > 2 ? 800 : 0,
      cache_creation_input_tokens: i === 0 ? 1200 : 0,
      cost_usd: 0.004 + i * 0.0008,
    },
    payload: {
      model,
      stop_reason: i === count - 1 ? "end_turn" : "tool_use",
      streaming: true,
      ttft_ms: 180 + Math.floor(Math.random() * 120),
      messages_count: 4 + i * 2,
      tools_count: 8,
    },
  }));
}

export const DEMO_LLM_CALLS: Record<string, ReturnType<typeof makeCalls>> = {
  "demo-agent-1": makeCalls("demo-agent-1", 12),
  "demo-agent-2": makeCalls("demo-agent-2", 8),
  "demo-agent-3": makeCalls("demo-agent-3", 6),
  "demo-agent-4": makeCalls("demo-agent-4", 5),
  "demo-agent-5": makeCalls("demo-agent-5", 18),
  "demo-agent-6": makeCalls("demo-agent-6", 4),
};
