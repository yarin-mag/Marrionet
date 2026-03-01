// Claude API pricing as of Feb 2026.
// Source: platform.claude.com/docs/en/about-claude/pricing
// To update: change the numbers here and rebuild shared.
//
// All prices are per 1,000,000 tokens (per-million rate).

export type ModelPricing = {
  inputPerMillion: number;
  outputPerMillion: number;
  cacheWritePerMillion: number; // 5-min TTL cache write (1.25× input)
  cacheReadPerMillion: number; // cache read (0.1× input)
};

// Keys are model ID prefixes. Match with startsWith() to handle date suffixes
// like "claude-sonnet-4-6-20251101".
export const MODEL_PRICING: Record<string, ModelPricing> = {
  "claude-opus-4": {
    inputPerMillion: 5.0,
    outputPerMillion: 25.0,
    cacheWritePerMillion: 6.25,
    cacheReadPerMillion: 0.5,
  },
  "claude-sonnet-4": {
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
    cacheWritePerMillion: 3.75,
    cacheReadPerMillion: 0.3,
  },
  "claude-haiku-4": {
    inputPerMillion: 1.0,
    outputPerMillion: 5.0,
    cacheWritePerMillion: 1.25,
    cacheReadPerMillion: 0.1,
  },
  "claude-3-5-sonnet": {
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
    cacheWritePerMillion: 3.75,
    cacheReadPerMillion: 0.3,
  },
  "claude-3-5-haiku": {
    inputPerMillion: 0.8,
    outputPerMillion: 4.0,
    cacheWritePerMillion: 1.0,
    cacheReadPerMillion: 0.08,
  },
  "claude-3-haiku": {
    inputPerMillion: 0.25,
    outputPerMillion: 1.25,
    cacheWritePerMillion: 0.3,
    cacheReadPerMillion: 0.03,
  },
  "claude-3-opus": {
    inputPerMillion: 15.0,
    outputPerMillion: 75.0,
    cacheWritePerMillion: 18.75,
    cacheReadPerMillion: 1.5,
  },
};

// Default fallback if model is unknown — use Sonnet 4 pricing (conservative middle)
export const DEFAULT_PRICING: ModelPricing = MODEL_PRICING["claude-sonnet-4"];

/** Returns the pricing entry whose key is the longest prefix of modelId. */
export function getPricingForModel(modelId?: string | null): ModelPricing {
  if (!modelId) return DEFAULT_PRICING;
  const id = modelId.toLowerCase();
  let best: ModelPricing | null = null;
  let bestLen = 0;
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (id.startsWith(key) && key.length > bestLen) {
      best = pricing;
      bestLen = key.length;
    }
  }
  return best ?? DEFAULT_PRICING;
}

/** Calculate cost in USD from a token usage object + model ID. */
export function calculateCost(
  tokens: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  },
  modelId?: string | null
): number {
  const p = getPricingForModel(modelId);
  const M = 1_000_000;
  return (
    ((tokens.input_tokens ?? 0) * p.inputPerMillion) / M +
    ((tokens.output_tokens ?? 0) * p.outputPerMillion) / M +
    ((tokens.cache_creation_input_tokens ?? 0) * p.cacheWritePerMillion) / M +
    ((tokens.cache_read_input_tokens ?? 0) * p.cacheReadPerMillion) / M
  );
}
