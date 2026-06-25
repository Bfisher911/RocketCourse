import { afterEach, describe, expect, it } from "vitest";
import { computeUsageCost } from "./aiPricing";

describe("computeUsageCost", () => {
  afterEach(() => {
    delete process.env.OPENAI_PRICE_INPUT_PER_1M;
    delete process.env.OPENAI_PRICE_OUTPUT_PER_1M;
  });

  it("prices gpt-4o-mini at $0.15 input / $0.60 output per 1M tokens", () => {
    const cost = computeUsageCost("gpt-4o-mini", { prompt_tokens: 1_000_000, completion_tokens: 1_000_000 });
    expect(cost.costUsd).toBe(0.75); // 0.15 + 0.60
    expect(cost.costMicroUsd).toBe(750_000);
    expect(cost.costCents).toBe(75);
    expect(cost.inputTokens).toBe(1_000_000);
    expect(cost.outputTokens).toBe(1_000_000);
    expect(cost.totalTokens).toBe(2_000_000);
  });

  it("keeps sub-cent precision a realistic builder call would round away in cents", () => {
    // 2k in + 1k out on mini = $0.0003 + $0.0006 = $0.0009 -> 900 micro-USD, 0 cents.
    const cost = computeUsageCost("gpt-4o-mini", { prompt_tokens: 2000, completion_tokens: 1000 });
    expect(cost.costUsd).toBe(0.0009);
    expect(cost.costMicroUsd).toBe(900);
    expect(cost.costCents).toBe(0);
  });

  it("matches dated model snapshots to their family rate by prefix", () => {
    const cost = computeUsageCost("gpt-4o-mini-2024-07-18", { prompt_tokens: 1_000_000, completion_tokens: 1_000_000 });
    expect(cost.costUsd).toBe(0.75); // mini rate, not gpt-4o's $12.50
  });

  it("prefers the longest matching prefix (gpt-4o-mini over gpt-4o)", () => {
    const fourO = computeUsageCost("gpt-4o", { prompt_tokens: 1_000_000, completion_tokens: 0 });
    expect(fourO.costUsd).toBe(2.5);
    const mini = computeUsageCost("gpt-4o-mini", { prompt_tokens: 1_000_000, completion_tokens: 0 });
    expect(mini.costUsd).toBe(0.15);
  });

  it("falls back to the gpt-4o-mini rate for unknown models", () => {
    const cost = computeUsageCost("some-future-model", { prompt_tokens: 1_000_000, completion_tokens: 0 });
    expect(cost.costUsd).toBe(0.15);
    expect(cost.model).toBe("some-future-model");
  });

  it("derives total tokens when OpenAI omits the field", () => {
    const cost = computeUsageCost("gpt-4o-mini", { prompt_tokens: 1200, completion_tokens: 800 });
    expect(cost.totalTokens).toBe(2000);
  });

  it("returns all-zero cost for null/empty usage", () => {
    const cost = computeUsageCost("gpt-4o-mini", null);
    expect(cost).toMatchObject({ inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0, costMicroUsd: 0, costCents: 0 });
  });

  it("lets env price overrides re-price without a code change", () => {
    process.env.OPENAI_PRICE_INPUT_PER_1M = "1";
    process.env.OPENAI_PRICE_OUTPUT_PER_1M = "2";
    const cost = computeUsageCost("gpt-4o-mini", { prompt_tokens: 1_000_000, completion_tokens: 1_000_000 });
    expect(cost.costUsd).toBe(3); // 1 + 2, overriding the table's 0.75
  });
});
