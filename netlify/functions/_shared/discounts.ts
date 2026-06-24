// Server-side Stripe discount engine (service role). Owns the Stripe Coupon + Promotion Code
// lifecycle and the local discount_code_records mirror. The super-admin function calls these and
// adds the audit trail. Validation is the pure, unit-tested validateDiscountInput; this module
// translates a normalized discount into Stripe params and DB rows, and enforces the bits Stripe
// cannot (plan/interval targeting is stored; plan targeting is also pushed to Stripe via the
// coupon's applies_to.products so it is natively enforced).

import type Stripe from "stripe";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { appUrl, checkoutModeFor, getStripe, resolvePriceId } from "./stripe";
import { getPlan, planByKey, type PlanKey } from "../../../src/data/plans";
import { validateDiscountInput, type DiscountInput } from "../../../src/billing/discountValidation";

export type DiscountResult =
  | { ok: true; id?: string; code?: string | null; couponId?: string; status?: string; url?: string | null; synced?: number; warning?: string }
  | { ok: false; error: string; status?: number };

const epoch = (iso: string): number => Math.floor(new Date(iso).getTime() / 1000);

/** Resolve the Stripe product id backing a plan's configured price (for coupon.applies_to). */
const productForPlan = async (stripe: Stripe, planKey: PlanKey): Promise<string | null> => {
  const priceId = resolvePriceId(planKey);
  if (!priceId) return null;
  const price = await stripe.prices.retrieve(priceId);
  return typeof price.product === "string" ? price.product : price.product?.id ?? null;
};

/** Create a Stripe Coupon + Promotion Code and mirror it locally. Validation-gated. */
export const createDiscountCode = async (actorId: string, input: DiscountInput): Promise<DiscountResult> => {
  const valid = validateDiscountInput(input);
  if (!valid.ok) return { ok: false, error: valid.error, status: 400 };
  const v = valid.value;

  if (v.endsAt && new Date(v.endsAt).getTime() <= Date.now()) {
    return { ok: false, error: "End date must be in the future.", status: 400 };
  }

  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Stripe is not configured.", status: 503 };
  }

  try {
    const couponParams: Record<string, unknown> = { name: v.name, duration: v.duration };
    if (v.percentOff !== null) couponParams.percent_off = v.percentOff;
    if (v.amountOffCents !== null) {
      couponParams.amount_off = v.amountOffCents;
      couponParams.currency = v.currency;
    }
    if (v.duration === "repeating" && v.durationInMonths) couponParams.duration_in_months = v.durationInMonths;
    if (v.maxRedemptions) couponParams.max_redemptions = v.maxRedemptions;
    if (v.endsAt) couponParams.redeem_by = epoch(v.endsAt);

    // Plan targeting → restrict the coupon to that plan's product (native Stripe enforcement).
    if (v.appliesToPlan) {
      const productId = await productForPlan(stripe, v.appliesToPlan);
      if (productId) couponParams.applies_to = { products: [productId] };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const coupon = await stripe.coupons.create(couponParams as any);

    const promoParams: Record<string, unknown> = { coupon: coupon.id };
    if (v.code) promoParams.code = v.code;
    if (v.maxRedemptions) promoParams.max_redemptions = v.maxRedemptions;
    if (v.endsAt) promoParams.expires_at = epoch(v.endsAt);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const promo = await stripe.promotionCodes.create(promoParams as any);

    // A future start date parks the code as a draft until activated.
    const status = v.startsAt && new Date(v.startsAt).getTime() > Date.now() ? "draft" : "active";

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("discount_code_records")
      .insert({
        stripe_coupon_id: coupon.id,
        stripe_promotion_code_id: promo.id,
        code: promo.code,
        name: v.name,
        campaign_name: v.campaignName,
        percent_off: v.percentOff,
        amount_off: v.amountOffCents,
        currency: v.currency,
        duration: v.duration,
        duration_in_months: v.durationInMonths,
        max_redemptions: v.maxRedemptions,
        per_customer_limit: v.perCustomerLimit,
        applies_to_plan: v.appliesToPlan,
        applies_to_interval: v.appliesToInterval === "all" ? null : v.appliesToInterval,
        visibility: v.visibility,
        starts_at: v.startsAt,
        expires_at: v.endsAt,
        notes: v.notes,
        status,
        active: status === "active",
        created_by: actorId,
        metadata: {}
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message, status: 500 };
    return { ok: true, id: data?.id as string, code: promo.code, couponId: coupon.id, status };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Stripe could not create the discount.", status: 502 };
  }
};

/** Move a code through its lifecycle. active ⇒ redeemable in Stripe; anything else ⇒ disabled. */
export const setDiscountStatus = async (
  recordId: string,
  status: "draft" | "active" | "paused" | "expired" | "archived"
): Promise<DiscountResult> => {
  const admin = getSupabaseAdmin();
  const { data: rec } = await admin
    .from("discount_code_records")
    .select("id,stripe_promotion_code_id,code")
    .eq("id", recordId)
    .maybeSingle();
  if (!rec) return { ok: false, error: "Discount record not found.", status: 404 };

  const stripeActive = status === "active";
  let warning: string | undefined;
  try {
    if (rec.stripe_promotion_code_id) {
      await getStripe().promotionCodes.update(rec.stripe_promotion_code_id as string, { active: stripeActive });
    }
  } catch (error) {
    warning = error instanceof Error ? error.message : "Stripe update failed; applied locally.";
  }
  await admin.from("discount_code_records").update({ status, active: stripeActive }).eq("id", recordId);
  return { ok: true, code: rec.code as string, status, warning };
};

/** Clone a code's discount terms into a brand-new active code (auto-generated code text). */
export const duplicateDiscount = async (actorId: string, recordId: string): Promise<DiscountResult> => {
  const admin = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rec } = await admin.from("discount_code_records").select("*").eq("id", recordId).maybeSingle<any>();
  if (!rec) return { ok: false, error: "Discount record not found.", status: 404 };

  const input: DiscountInput = {
    name: `${rec.name ?? "Discount"} (copy)`,
    campaignName: rec.campaign_name,
    discountType: rec.percent_off !== null ? "percent" : "amount",
    percentOff: rec.percent_off,
    amountOff: rec.amount_off !== null ? rec.amount_off / 100 : null,
    currency: rec.currency,
    duration: rec.duration,
    durationInMonths: rec.duration_in_months,
    maxRedemptions: rec.max_redemptions,
    perCustomerLimit: rec.per_customer_limit,
    appliesToPlan: rec.applies_to_plan ?? "all",
    appliesToInterval: rec.applies_to_interval ?? "all",
    visibility: rec.visibility,
    notes: rec.notes
  };
  return createDiscountCode(actorId, input);
};

/** Pull authoritative redemption counts from Stripe and auto-expire codes past their window. */
export const syncDiscounts = async (): Promise<DiscountResult> => {
  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Stripe is not configured.", status: 503 };
  }
  const admin = getSupabaseAdmin();
  const { data: recs } = await admin
    .from("discount_code_records")
    .select("id,stripe_promotion_code_id,status,expires_at")
    .not("stripe_promotion_code_id", "is", null);

  let synced = 0;
  for (const r of recs ?? []) {
    try {
      const promo = await stripe.promotionCodes.retrieve(r.stripe_promotion_code_id as string);
      const update: Record<string, unknown> = { times_redeemed: promo.times_redeemed ?? 0 };
      const pastEnd = r.expires_at ? new Date(r.expires_at as string).getTime() < Date.now() : false;
      if (r.status === "active" && (pastEnd || !promo.active)) {
        update.status = "expired";
        update.active = false;
      }
      await admin.from("discount_code_records").update(update).eq("id", r.id);
      synced += 1;
    } catch {
      // Skip codes that no longer exist in Stripe.
    }
  }
  return { ok: true, synced };
};

/** Create a (test-mode) Checkout Session for a plan with the discount pre-applied; returns its URL. */
export const buildTestCheckoutLink = async (recordId: string, planKey: string): Promise<DiscountResult> => {
  if (!Object.prototype.hasOwnProperty.call(planByKey, planKey)) {
    return { ok: false, error: `Unknown plan: ${planKey}.`, status: 400 };
  }
  const plan = getPlan(planKey as PlanKey);
  if (plan.checkoutMode !== "subscription" && plan.checkoutMode !== "payment") {
    return { ok: false, error: `${plan.name} is not a self-serve checkout plan.`, status: 400 };
  }
  const priceId = resolvePriceId(plan.key);
  if (!priceId) return { ok: false, error: `No Stripe price configured for ${plan.name}.`, status: 503 };

  const admin = getSupabaseAdmin();
  const { data: rec } = await admin
    .from("discount_code_records")
    .select("stripe_promotion_code_id,code")
    .eq("id", recordId)
    .maybeSingle();
  if (!rec) return { ok: false, error: "Discount record not found.", status: 404 };

  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Stripe is not configured.", status: 503 };
  }

  const params: Record<string, unknown> = {
    mode: checkoutModeFor(plan),
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl()}/?checkout=test-success`,
    cancel_url: `${appUrl()}/?checkout=test-cancel`
  };
  if (rec.stripe_promotion_code_id) params.discounts = [{ promotion_code: rec.stripe_promotion_code_id }];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await stripe.checkout.sessions.create(params as any);
  return { ok: true, url: session.url, code: rec.code as string };
};
