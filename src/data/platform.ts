// Centralized platform / admin constants.
//
// The initial Super Admin is provisioned in the DATABASE (profiles.is_super_admin = true, set by
// supabase/migrations/0005 via public.grant_super_admin). That row is the authoritative gate the
// server checks. This list is documentation + a defense-in-depth fallback the SERVER may consult
// when bootstrapping a brand-new environment — it is NEVER the sole gate, and the client never
// decides super-admin status from it.
//
// To add/remove a Super Admin in production, run in the Supabase SQL editor:
//   select public.grant_super_admin('person@example.com');
//   select public.revoke_super_admin('person@example.com');

export const SUPER_ADMIN_BOOTSTRAP_EMAILS: readonly string[] = ["bfisher3@tulane.edu"];

export const isBootstrapSuperAdminEmail = (email: string | null | undefined): boolean =>
  !!email && SUPER_ADMIN_BOOTSTRAP_EMAILS.some((e) => e.toLowerCase() === email.toLowerCase());

/** Model pricing for usage-cost estimation (cents per 1M tokens). Server-side, easy to update. */
export interface ModelPricing {
  model: string;
  inputCentsPerMTok: number;
  outputCentsPerMTok: number;
}

export const MODEL_PRICING: ModelPricing[] = [
  { model: "gpt-4o", inputCentsPerMTok: 250, outputCentsPerMTok: 1000 },
  { model: "gpt-4o-mini", inputCentsPerMTok: 15, outputCentsPerMTok: 60 },
  { model: "gpt-4.1", inputCentsPerMTok: 200, outputCentsPerMTok: 800 },
  { model: "gpt-4.1-mini", inputCentsPerMTok: 40, outputCentsPerMTok: 160 },
  { model: "default", inputCentsPerMTok: 200, outputCentsPerMTok: 800 }
];

export const pricingForModel = (model: string | null | undefined): ModelPricing =>
  MODEL_PRICING.find((m) => m.model === model) ?? MODEL_PRICING.find((m) => m.model === "default")!;

/** Estimate cost in cents for a token spend on a model. */
export const estimateCostCents = (
  model: string | null | undefined,
  inputTokens: number,
  outputTokens: number
): number => {
  const p = pricingForModel(model);
  return Math.round((inputTokens * p.inputCentsPerMTok + outputTokens * p.outputCentsPerMTok) / 1_000_000);
};
