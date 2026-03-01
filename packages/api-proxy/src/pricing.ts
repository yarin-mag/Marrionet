interface ModelPricing {
  input: number;    // $ per million input tokens
  output: number;   // $ per million output tokens
  cacheRead: number; // $ per million cache-read tokens
}

const PRICING: Record<string, ModelPricing> = {
  "claude-opus-4":   { input: 15,  output: 75,  cacheRead: 1.5  },
  "claude-sonnet-4": { input: 3,   output: 15,  cacheRead: 0.3  },
  "claude-haiku-4":  { input: 0.8, output: 4,   cacheRead: 0.08 },
};

function getPricing(model: string): ModelPricing | null {
  for (const [prefix, pricing] of Object.entries(PRICING)) {
    if (model.startsWith(prefix)) return pricing;
  }
  return null;
}

export interface TokensForPricing {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
}

export function calculateCost(model: string, tokens: TokensForPricing): number {
  const pricing = getPricing(model);
  if (!pricing) return 0;

  const inputCost = (tokens.input_tokens / 1_000_000) * pricing.input;
  const outputCost = (tokens.output_tokens / 1_000_000) * pricing.output;
  const cacheReadCost = (tokens.cache_read_input_tokens / 1_000_000) * pricing.cacheRead;

  return inputCost + outputCost + cacheReadCost;
}
