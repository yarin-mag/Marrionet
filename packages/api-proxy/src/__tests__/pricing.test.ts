import { describe, it, expect } from "vitest";
import { calculateCost } from "../pricing.js";

describe("calculateCost", () => {
  it("returns 0 for an unknown model", () => {
    expect(calculateCost("gpt-4o", { input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 0 })).toBe(0);
  });

  it("calculates cost for claude-sonnet-4", () => {
    // 1M input @ $3, 1M output @ $15
    const cost = calculateCost("claude-sonnet-4-20251101", {
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
      cache_read_input_tokens: 0,
    });
    expect(cost).toBeCloseTo(18); // $3 + $15
  });

  it("calculates cost for claude-opus-4", () => {
    // 1M input @ $15, 1M output @ $75
    const cost = calculateCost("claude-opus-4", {
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
      cache_read_input_tokens: 0,
    });
    expect(cost).toBeCloseTo(90); // $15 + $75
  });

  it("includes cache read cost", () => {
    // claude-sonnet-4 cache read: $0.3 per million
    const costWithCache = calculateCost("claude-sonnet-4", {
      input_tokens: 0,
      output_tokens: 0,
      cache_read_input_tokens: 1_000_000,
    });
    expect(costWithCache).toBeCloseTo(0.3);
  });

  it("returns 0 for all-zero tokens", () => {
    expect(calculateCost("claude-sonnet-4", { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0 })).toBe(0);
  });

  it("matches on model prefix with date suffix", () => {
    const costA = calculateCost("claude-haiku-4", { input_tokens: 1_000_000, output_tokens: 0, cache_read_input_tokens: 0 });
    const costB = calculateCost("claude-haiku-4-20251001", { input_tokens: 1_000_000, output_tokens: 0, cache_read_input_tokens: 0 });
    expect(costA).toBe(costB);
  });
});
