// Single source of truth for OpenAI token pricing + cost computation. Used by every AI route to
// turn an OpenAI `usage` object ({ prompt_tokens, completion_tokens }) into a real dollar cost that
// we persist alongside the job, so per-course / per-user spend is measured, not estimated.
//
// Prices are USD per 1,000,000 tokens. Update the table when OpenAI changes prices, OR set the
// env overrides (OPENAI_PRICE_INPUT_PER_1M / OPENAI_PRICE_OUTPUT_PER_1M) to re-price without a deploy
// — handy because the active model is whatever OPENAI_MODEL resolves to (default gpt-4o-mini).

declare const process: { env: Record<string, string | undefined> };

export interface TokenUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

interface Rate {
  /** USD per 1M input (prompt) tokens. */
  inputPer1M: number;
  /** USD per 1M output (completion) tokens. */
  outputPer1M: number;
}

// Verified against OpenAI's published API pricing. Keys are matched exact-first, then by prefix so
// dated snapshots (e.g. "gpt-4o-mini-2024-07-18") resolve to their family rate.
const PRICING: Record<string, Rate> = {
  "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6 },
  "gpt-4o": { inputPer1M: 2.5, outputPer1M: 10 },
  "gpt-4.1": { inputPer1M: 2, outputPer1M: 8 },
  "gpt-4.1-mini": { inputPer1M: 0.4, outputPer1M: 1.6 },
  "gpt-4.1-nano": { inputPer1M: 0.1, outputPer1M: 0.4 },
  "o4-mini": { inputPer1M: 1.1, outputPer1M: 4.4 }
};

const DEFAULT_RATE: Rate = PRICING["gpt-4o-mini"];

/** Optional no-deploy override: if both env prices are set + valid, they win for every model. */
const envRate = (): Rate | null => {
  const input = Number(process.env.OPENAI_PRICE_INPUT_PER_1M);
  const output = Number(process.env.OPENAI_PRICE_OUTPUT_PER_1M);
  return Number.isFinite(input) && Number.isFinite(output) && input >= 0 && output >= 0
    ? { inputPer1M: input, outputPer1M: output }
    : null;
};

const rateForModel = (model?: string): Rate => {
  if (!model) return DEFAULT_RATE;
  const key = model.trim().toLowerCase();
  if (PRICING[key]) return PRICING[key];
  // Longest-prefix match so "gpt-4o-mini-..." beats "gpt-4o".
  const hit = Object.keys(PRICING)
    .filter((known) => key.startsWith(known))
    .sort((a, b) => b.length - a.length)[0];
  return hit ? PRICING[hit] : DEFAULT_RATE;
};

export interface CostBreakdown {
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  /** Full-precision USD (6 dp). A single builder call is ~$0.0008, so cents alone would round to 0. */
  costUsd: number;
  /** Integer micro-dollars (USD * 1e6) for exact summation in SQL/JS without float drift. */
  costMicroUsd: number;
  /** Rounded integer cents for the legacy ai_generation_jobs.estimated_cost_cents column. */
  costCents: number;
}

/** Turn an OpenAI usage object into a priced CostBreakdown. Safe on null/partial usage (returns 0s). */
export const computeUsageCost = (model: string | undefined, usage: TokenUsage | null | undefined): CostBreakdown => {
  const inputTokens = Math.max(0, Math.round(usage?.prompt_tokens ?? 0));
  const outputTokens = Math.max(0, Math.round(usage?.completion_tokens ?? 0));
  const totalTokens = Math.max(0, Math.round(usage?.total_tokens ?? inputTokens + outputTokens));
  const rate = envRate() ?? rateForModel(model);
  const costUsd = (inputTokens / 1_000_000) * rate.inputPer1M + (outputTokens / 1_000_000) * rate.outputPer1M;
  return {
    model: model?.trim() || "gpt-4o-mini",
    inputTokens,
    outputTokens,
    totalTokens,
    costUsd: Number(costUsd.toFixed(6)),
    costMicroUsd: Math.round(costUsd * 1_000_000),
    costCents: Math.round(costUsd * 100)
  };
};
