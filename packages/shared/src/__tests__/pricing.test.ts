import { describe, it, expect } from "vitest";
import { getPricingForModel, calculateCost, DEFAULT_PRICING, MODEL_PRICING } from "../pricing.js";

describe("getPricingForModel", () => {
  it("returns default pricing for null/undefined", () => {
    expect(getPricingForModel(null)).toBe(DEFAULT_PRICING);
    expect(getPricingForModel(undefined)).toBe(DEFAULT_PRICING);
    expect(getPricingForModel("")).toBe(DEFAULT_PRICING);
  });

  it("returns default pricing for unknown model", () => {
    expect(getPricingForModel("gpt-4o")).toBe(DEFAULT_PRICING);
  });

  it("matches claude-sonnet-4 with date suffix", () => {
    const pricing = getPricingForModel("claude-sonnet-4-6-20251101");
    expect(pricing).toBe(MODEL_PRICING["claude-sonnet-4"]);
  });

  it("matches claude-opus-4", () => {
    const pricing = getPricingForModel("claude-opus-4");
    expect(pricing).toBe(MODEL_PRICING["claude-opus-4"]);
  });

  it("matches claude-haiku-4 with suffix", () => {
    const pricing = getPricingForModel("claude-haiku-4-5-20251001");
    expect(pricing).toBe(MODEL_PRICING["claude-haiku-4"]);
  });

  it("matches claude-3-5-sonnet", () => {
    const pricing = getPricingForModel("claude-3-5-sonnet-20241022");
    expect(pricing).toBe(MODEL_PRICING["claude-3-5-sonnet"]);
  });

  it("prefers longer prefix match (claude-3-5-sonnet over claude-3)", () => {
    // claude-3-5-sonnet should not match claude-3-haiku (different family)
    const haiku = getPricingForModel("claude-3-haiku-20240307");
    expect(haiku).toBe(MODEL_PRICING["claude-3-haiku"]);
  });
});

describe("calculateCost", () => {
  it("returns 0 for empty tokens", () => {
    expect(calculateCost({}, "claude-sonnet-4")).toBe(0);
  });

  it("calculates input cost correctly", () => {
    // claude-opus-4: $5 per million input
    const cost = calculateCost({ input_tokens: 1_000_000 }, "claude-opus-4");
    expect(cost).toBeCloseTo(5.0);
  });

  it("calculates output cost correctly", () => {
    // claude-opus-4: $25 per million output
    const cost = calculateCost({ output_tokens: 1_000_000 }, "claude-opus-4");
    expect(cost).toBeCloseTo(25.0);
  });

  it("calculates cache write cost correctly", () => {
    // claude-sonnet-4: $3.75 per million cache write
    const cost = calculateCost({ cache_creation_input_tokens: 1_000_000 }, "claude-sonnet-4");
    expect(cost).toBeCloseTo(3.75);
  });

  it("calculates cache read cost correctly", () => {
    // claude-sonnet-4: $0.3 per million cache read
    const cost = calculateCost({ cache_read_input_tokens: 1_000_000 }, "claude-sonnet-4");
    expect(cost).toBeCloseTo(0.3);
  });

  it("sums all token types", () => {
    // claude-haiku-4: input $1, output $5, cache write $1.25, cache read $0.1
    const cost = calculateCost(
      {
        input_tokens: 1_000_000,
        output_tokens: 1_000_000,
        cache_creation_input_tokens: 1_000_000,
        cache_read_input_tokens: 1_000_000,
      },
      "claude-haiku-4"
    );
    expect(cost).toBeCloseTo(1 + 5 + 1.25 + 0.1);
  });

  it("uses default pricing for unknown model", () => {
    const withDefault = calculateCost({ input_tokens: 1_000_000 }, "unknown-model");
    const withSonnet4 = calculateCost({ input_tokens: 1_000_000 }, "claude-sonnet-4");
    expect(withDefault).toBe(withSonnet4);
  });
});
