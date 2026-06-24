// Pure validation + normalization for Super-Admin-created Stripe discounts. Lives here (not in the
// Netlify function) so the invalid-combination rules are unit-testable and identical wherever they
// run. The server calls validateDiscountInput, then translates the normalized result into Stripe
// Coupon/Promotion Code params and the discount_code_records row. No Stripe/DB access here.

import { planByKey, type PlanBillingInterval, type PlanKey } from "../data/plans";

export type DiscountType = "percent" | "amount";
export type DiscountDuration = "once" | "repeating" | "forever";
export type DiscountVisibility = "public" | "private" | "campaign";
/** Plan/interval targeting: a specific plan, a billing interval bucket, or "all". */
export type DiscountInterval = PlanBillingInterval | "all";

export interface DiscountInput {
  name?: string;
  campaignName?: string | null;
  code?: string | null;
  discountType?: DiscountType;
  percentOff?: number | string | null;
  amountOff?: number | string | null; // dollars from the form; normalized to cents
  currency?: string | null;
  duration?: DiscountDuration;
  durationInMonths?: number | string | null;
  maxRedemptions?: number | string | null;
  perCustomerLimit?: number | string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  appliesToPlan?: string | null; // PlanKey or "all"
  appliesToInterval?: string | null; // month | year | one_time | all
  visibility?: string | null;
  notes?: string | null;
}

export interface NormalizedDiscount {
  name: string;
  campaignName: string | null;
  code: string | null;
  discountType: DiscountType;
  percentOff: number | null;
  amountOffCents: number | null;
  currency: string | null;
  duration: DiscountDuration;
  durationInMonths: number | null;
  maxRedemptions: number | null;
  perCustomerLimit: number | null;
  startsAt: string | null;
  endsAt: string | null;
  appliesToPlan: PlanKey | null; // null = all plans
  appliesToInterval: DiscountInterval;
  visibility: DiscountVisibility;
  notes: string | null;
}

export type DiscountValidation =
  | { ok: true; value: NormalizedDiscount }
  | { ok: false; error: string };

const toNumber = (v: unknown): number => Math.floor(Number(v));
const isPlanKey = (v: string): v is PlanKey => Object.prototype.hasOwnProperty.call(planByKey, v);

/** Normalize a raw promo code: uppercase, strip to [A-Z0-9_-], cap length. */
export const normalizeCode = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const code = String(raw).toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 40);
  return code || null;
};

/**
 * Validate + normalize discount input. Enforces the invalid-combination rules:
 *  - percent: 0 < percentOff <= 100
 *  - amount: amountOff > 0 AND a currency is provided
 *  - repeating: durationInMonths is a positive integer
 *  - maxRedemptions / perCustomerLimit: positive integers when provided
 *  - start < end when both supplied
 *  - appliesToPlan is a known plan key (or "all"); interval is a known bucket (or "all")
 */
export const validateDiscountInput = (input: DiscountInput): DiscountValidation => {
  const name = (input.name ?? "").trim() || "RocketCourse discount";
  const discountType: DiscountType = input.discountType === "amount" ? "amount" : "percent";

  let percentOff: number | null = null;
  let amountOffCents: number | null = null;
  let currency: string | null = null;

  if (discountType === "percent") {
    const p = Number(input.percentOff);
    if (!Number.isFinite(p) || p <= 0 || p > 100) {
      return { ok: false, error: "Percentage off must be between 1 and 100." };
    }
    percentOff = Math.round(p * 100) / 100; // allow up to 2 decimals (Stripe supports decimals)
  } else {
    const dollars = Number(input.amountOff);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      return { ok: false, error: "Amount off must be greater than 0." };
    }
    const cur = (input.currency ?? "").trim().toLowerCase();
    if (!/^[a-z]{3}$/.test(cur)) {
      return { ok: false, error: "A 3-letter currency (e.g. usd) is required for a fixed-amount discount." };
    }
    amountOffCents = Math.round(dollars * 100);
    currency = cur;
  }

  const duration: DiscountDuration = ["once", "repeating", "forever"].includes(String(input.duration))
    ? (input.duration as DiscountDuration)
    : "once";

  let durationInMonths: number | null = null;
  if (duration === "repeating") {
    const m = toNumber(input.durationInMonths);
    if (!Number.isFinite(m) || m < 1) {
      return { ok: false, error: "Repeating discounts need a duration in months (1 or more)." };
    }
    durationInMonths = m;
  }

  let maxRedemptions: number | null = null;
  if (input.maxRedemptions !== undefined && input.maxRedemptions !== null && String(input.maxRedemptions) !== "") {
    const n = toNumber(input.maxRedemptions);
    if (!Number.isFinite(n) || n < 1) return { ok: false, error: "Max redemptions must be a positive whole number." };
    maxRedemptions = n;
  }

  let perCustomerLimit: number | null = null;
  if (input.perCustomerLimit !== undefined && input.perCustomerLimit !== null && String(input.perCustomerLimit) !== "") {
    const n = toNumber(input.perCustomerLimit);
    if (!Number.isFinite(n) || n < 1) return { ok: false, error: "Per-customer limit must be a positive whole number." };
    perCustomerLimit = n;
  }

  const startsAt = input.startsAt ? new Date(input.startsAt) : null;
  const endsAt = input.endsAt ? new Date(input.endsAt) : null;
  if (startsAt && Number.isNaN(startsAt.getTime())) return { ok: false, error: "Start date is invalid." };
  if (endsAt && Number.isNaN(endsAt.getTime())) return { ok: false, error: "End date is invalid." };
  if (startsAt && endsAt && startsAt.getTime() >= endsAt.getTime()) {
    return { ok: false, error: "Start date must be before the end date." };
  }

  const planRaw = (input.appliesToPlan ?? "all").trim();
  let appliesToPlan: PlanKey | null = null;
  if (planRaw && planRaw !== "all") {
    if (!isPlanKey(planRaw)) return { ok: false, error: `Unknown plan: ${planRaw}.` };
    appliesToPlan = planRaw;
  }

  const intervalRaw = (input.appliesToInterval ?? "all").trim();
  const validIntervals: DiscountInterval[] = ["month", "year", "one_time", "contact", "all"];
  if (!validIntervals.includes(intervalRaw as DiscountInterval)) {
    return { ok: false, error: `Unknown billing interval: ${intervalRaw}.` };
  }
  const appliesToInterval = intervalRaw as DiscountInterval;

  const visibilityRaw = (input.visibility ?? "public").trim();
  const visibility: DiscountVisibility = ["public", "private", "campaign"].includes(visibilityRaw)
    ? (visibilityRaw as DiscountVisibility)
    : "public";

  return {
    ok: true,
    value: {
      name: name.slice(0, 120),
      campaignName: (input.campaignName ?? "").trim() || null,
      code: normalizeCode(input.code),
      discountType,
      percentOff,
      amountOffCents,
      currency,
      duration,
      durationInMonths,
      maxRedemptions,
      perCustomerLimit,
      startsAt: startsAt ? startsAt.toISOString() : null,
      endsAt: endsAt ? endsAt.toISOString() : null,
      appliesToPlan,
      appliesToInterval,
      visibility,
      notes: (input.notes ?? "").trim().slice(0, 2000) || null
    }
  };
};
