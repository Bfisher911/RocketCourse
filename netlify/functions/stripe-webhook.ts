// POST /.netlify/functions/stripe-webhook  (configure this URL as a Stripe webhook endpoint)
// Verifies the Stripe signature, then maps events to the trusted `subscriptions` row in Supabase.
// This function is the ONLY writer of subscription/plan status — the client never sets it.
//
// Handled: checkout.session.completed, customer.subscription.created/updated/deleted,
//          invoice.payment_succeeded, invoice.payment_failed.

import Stripe from "stripe";
import { json } from "./_shared/http";
import { getSupabaseAdmin } from "./_shared/supabaseAdmin";
import { getStripe, resolvePriceId } from "./_shared/stripe";
import { ensureWorkspaceForSubscription } from "./_shared/workspaceSync";
import { markReferredConverted } from "./_shared/referrals";
import { resolveSeatCount } from "../../src/billing/stripeParams";
import { getPlan, plans, type Plan, type PlanKey } from "../../src/data/plans";

declare const process: { env: Record<string, string | undefined> };

const planFromPriceId = (priceId: string | null | undefined): Plan | null => {
  if (!priceId) return null;
  for (const plan of plans) {
    if (resolvePriceId(plan.key) === priceId) return plan;
  }
  return null;
};

const addMonths = (date: Date, months: number): Date => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
};

const supabase = () => getSupabaseAdmin();

// Resolve our user id from event metadata or the stripe_customers mapping.
const resolveUserId = async (customerId: string | null, metaUserId: string | null): Promise<string | null> => {
  if (metaUserId) return metaUserId;
  if (!customerId) return null;
  const { data } = await supabase()
    .from("stripe_customers")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return (data?.user_id as string) ?? null;
};

// Upsert the single current subscription row for a user. Resets usage only on a plan change or a
// fresh (re)activation, otherwise preserves used counters.
const upsertSubscription = async (params: {
  userId: string;
  planKey: PlanKey;
  status: string;
  customerId: string | null;
  subscriptionId: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  seats?: number | null;
  trialStart?: Date | null;
  trialEnd?: Date | null;
  canceledAt?: Date | null;
  billingInterval?: string | null;
}): Promise<void> => {
  const plan = getPlan(params.planKey);
  const db = supabase();
  const { data: existing } = await db
    .from("subscriptions")
    .select("id,plan_key,status,current_period_start,exports_used,ai_generations_used,image_credits_limit,image_credits_used,workspace_id")
    .eq("user_id", params.userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const freshActivation =
    !existing || existing.plan_key !== params.planKey || !["active", "trialing"].includes(existing.status as string);
  const periodChanged = Boolean(params.periodStart && existing?.current_period_start
    && new Date(String(existing.current_period_start)).getTime() !== params.periodStart.getTime());
  const resetUsage = freshActivation || periodChanged;
  const exportsUsed = resetUsage ? 0 : (existing?.exports_used as number) ?? 0;
  const aiUsed = resetUsage ? 0 : (existing?.ai_generations_used as number) ?? 0;
  const imageCreditsUsed = resetUsage ? 0 : (existing?.image_credits_used as number) ?? 0;
  const { data: economics } = await db.from("image_economics_config").select("config").eq("key", "default").maybeSingle();
  const imageConfig = (economics?.config as Record<string, unknown> | null) ?? {};
  const configuredImageLimit = params.status === "trialing"
    ? Math.max(0, Number(imageConfig.trialImageAllowance ?? plan.imageCreditsLimit ?? 0))
    : params.planKey === "institution"
      ? Math.max(0, Number(imageConfig.institutionalImageAllowance ?? plan.imageCreditsLimit ?? 0))
      : plan.imageCreditsLimit ?? 0;

  if (periodChanged && existing) {
    const previousLimit = Math.max(0, Number(existing.image_credits_limit ?? 0));
    const previousUsed = Math.max(0, Number(existing.image_credits_used ?? 0));
    const rollover = imageConfig.unusedCreditsRollOver === true ? Math.max(0, previousLimit - Math.min(previousLimit, previousUsed)) : 0;
    const purchasedCreditsConsumed = Math.max(0, previousUsed - previousLimit);
    const adjustments = [
      ...(rollover > 0 ? [{ user_id: params.userId, workspace_id: existing.workspace_id ?? null, adjustment_type: "image_credit", amount: rollover, reason: "Unused included image credits rolled over at renewal", created_by: null }] : []),
      ...(purchasedCreditsConsumed > 0 ? [{ user_id: params.userId, workspace_id: existing.workspace_id ?? null, adjustment_type: "image_credit", amount: -purchasedCreditsConsumed, reason: "Purchased image credits consumed before renewal", created_by: null }] : [])
    ];
    if (adjustments.length) await db.from("usage_adjustments").insert(adjustments);
    const ledger = [
      ...(rollover > 0 ? [{ user_id: params.userId, workspace_id: existing.workspace_id ?? null, subscription_id: existing.id, entry_type: "adjustment", credits: rollover, reason: "Included image credits rolled over", metadata: { previousLimit, previousUsed } }] : []),
      ...(purchasedCreditsConsumed > 0 ? [{ user_id: params.userId, workspace_id: existing.workspace_id ?? null, subscription_id: existing.id, entry_type: "adjustment", credits: -purchasedCreditsConsumed, reason: "Credit-pack balance consumed", metadata: { previousLimit, previousUsed } }] : [])
    ];
    if (ledger.length) await db.from("image_credit_ledger").insert(ledger);
  }

  const row = {
    user_id: params.userId,
    plan_key: params.planKey,
    status: params.status,
    stripe_customer_id: params.customerId,
    stripe_subscription_id: params.subscriptionId,
    current_period_start: params.periodStart?.toISOString() ?? null,
    current_period_end: params.periodEnd?.toISOString() ?? null,
    cancel_at_period_end: params.cancelAtPeriodEnd,
    seats: params.seats ?? null,
    trial_start: params.trialStart?.toISOString() ?? null,
    trial_end: params.trialEnd?.toISOString() ?? null,
    canceled_at: params.canceledAt?.toISOString() ?? null,
    billing_interval: params.billingInterval ?? plan.billingInterval,
    exports_limit: plan.exportsLimit,
    ai_generations_limit: plan.aiGenerationsLimit,
    image_credits_limit: configuredImageLimit,
    exports_used: exportsUsed,
    ai_generations_used: aiUsed,
    image_credits_used: imageCreditsUsed,
    updated_at: new Date().toISOString()
  };

  if (existing?.id) {
    await db.from("subscriptions").update(row).eq("id", existing.id);
  } else {
    await db.from("subscriptions").insert(row);
  }

  await db.from("audit_events").insert({
    actor_user_id: params.userId,
    event_type: "subscription_updated",
    target_type: "subscription",
    target_id: params.subscriptionId,
    metadata: { plan_key: params.planKey, status: params.status }
  });
};

// Best-effort: record a discount redemption when a Checkout Session applied a promotion code.
// Idempotent via the unique checkout-session id. Authoritative redemption counts are reconciled
// separately by the Super Admin "Sync" action (Stripe's promotionCode.times_redeemed).
const recordRedemption = async (session: Stripe.Checkout.Session, userId: string | null): Promise<void> => {
  const amountDiscount = session.total_details?.amount_discount ?? 0;
  const discounts = (session.discounts ?? []) as Array<{ promotion_code?: string | null }>;
  if (amountDiscount <= 0 && discounts.length === 0) return;

  const promoId = discounts.map((d) => (typeof d.promotion_code === "string" ? d.promotion_code : null)).find(Boolean) ?? null;
  const db = supabase();
  let recordId: string | null = null;
  let code: string | null = null;
  if (promoId) {
    const { data } = await db.from("discount_code_records").select("id,code").eq("stripe_promotion_code_id", promoId).maybeSingle();
    recordId = (data?.id as string) ?? null;
    code = (data?.code as string) ?? null;
  }

  await db.from("discount_redemptions").upsert(
    {
      discount_record_id: recordId,
      stripe_promotion_code_id: promoId,
      code,
      user_id: userId,
      stripe_customer_id: (session.customer as string) ?? null,
      stripe_checkout_session_id: session.id,
      stripe_subscription_id: (session.subscription as string) ?? null,
      amount_discounted_cents: amountDiscount,
      currency: session.currency ?? null
    },
    { onConflict: "stripe_checkout_session_id" }
  );
};

const handleCheckoutCompleted = async (session: Stripe.Checkout.Session): Promise<void> => {
  const customerId = (session.customer as string) ?? null;
  const metaUserId = (session.metadata?.supabase_user_id as string) ?? (session.client_reference_id as string) ?? null;
  const userId = await resolveUserId(customerId, metaUserId);
  if (!userId) return;

  await recordRedemption(session, userId);

  if (session.mode === "payment" && session.metadata?.purchase_type === "image_credit_pack") {
    const credits = Math.max(1, Math.floor(Number(session.metadata.image_credit_amount ?? 0)));
    await supabase().from("usage_adjustments").insert({
      user_id: userId,
      adjustment_type: "image_credit",
      amount: credits,
      reason: `Stripe image credit pack ${session.id}`,
      created_by: null
    });
    await supabase().from("image_credit_ledger").insert({
      user_id: userId,
      entry_type: "adjustment",
      credits,
      reason: "Stripe image credit pack purchased",
      metadata: { stripeCheckoutSessionId: session.id, amountTotal: session.amount_total, currency: session.currency }
    });
    await supabase().from("audit_events").insert({
      actor_user_id: userId,
      event_type: "image_credit_pack_purchased",
      target_type: "stripe_checkout_session",
      target_id: session.id,
      metadata: { credits, amount_total: session.amount_total, currency: session.currency }
    });
    return;
  }

  // Best-effort: if this paying customer came from a campaign waitlist, mark them converted and
  // advance any inbound referral to `paid`. Fully isolated — never affects the billing writes below.
  try {
    const email = session.customer_details?.email ?? session.customer_email ?? null;
    if (email) await markReferredConverted(supabase(), email);
  } catch {
    /* never let referral bookkeeping disrupt the webhook */
  }

  // One-time payment (semester pass): no Stripe subscription object — we own the period window.
  if (session.mode === "payment") {
    const planKey = (session.metadata?.plan_key as PlanKey) ?? planFromPriceId(null)?.key ?? "individual_semester";
    const plan = getPlan(planKey);
    const start = new Date();
    await upsertSubscription({
      userId,
      planKey,
      status: "active",
      customerId,
      subscriptionId: `pass_${session.id}`,
      periodStart: start,
      periodEnd: addMonths(start, plan.entitlementMonths || 4),
      cancelAtPeriodEnd: false,
      seats: resolveSeatCount(plan, null),
      billingInterval: "one_time"
    });
  }
  // Subscription mode is finalized by customer.subscription.created/updated.
};

const handleSubscriptionEvent = async (sub: Stripe.Subscription, deleted = false): Promise<void> => {
  const customerId = (sub.customer as string) ?? null;
  const metaUserId = (sub.metadata?.supabase_user_id as string) ?? null;
  const userId = await resolveUserId(customerId, metaUserId);
  if (!userId) return;

  const priceId = sub.items.data[0]?.price?.id ?? null;
  const plan = planFromPriceId(priceId) ?? getPlan((sub.metadata?.plan_key as PlanKey) ?? "individual_annual");

  // Seats come from the Stripe item quantity (per-seat price) or a metadata hint, clamped to the
  // plan's floor/cap. This drives workspace.seat_limit (invite capacity), never a price.
  const requestedSeats = sub.items.data[0]?.quantity ?? Number(sub.metadata?.seats) ?? null;
  const seats = resolveSeatCount(plan, requestedSeats);
  const interval = sub.items.data[0]?.price?.recurring?.interval ?? null;

  await upsertSubscription({
    userId,
    planKey: plan.key,
    status: deleted ? "canceled" : sub.status,
    customerId,
    subscriptionId: sub.id,
    periodStart: sub.current_period_start ? new Date(sub.current_period_start * 1000) : null,
    periodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    seats,
    trialStart: sub.trial_start ? new Date(sub.trial_start * 1000) : null,
    trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
    billingInterval: interval
  });

  // Team-capable plans get a synced workspace; the purchaser becomes the Launchpad Admin.
  // (No-op for individual plans.)
  await ensureWorkspaceForSubscription({
    userId,
    planKey: plan.key,
    status: deleted ? "canceled" : sub.status,
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    seatQuantity: seats,
    workspaceName: (sub.metadata?.workspace_name as string) ?? null
  });
};

export default async (request: Request): Promise<Response> => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed." });

  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) return json(503, { error: "STRIPE_WEBHOOK_SECRET is not configured." });

  const signature = request.headers.get("stripe-signature");
  if (!signature) return json(400, { error: "Missing stripe-signature header." });

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(rawBody, signature, secret);
  } catch (error) {
    return json(400, { error: `Signature verification failed: ${error instanceof Error ? error.message : "unknown"}` });
  }

  const db = supabase();

  // Idempotency: Stripe delivers at-least-once. Skip events we've already fully processed; record
  // every event (full payload) for audit/replay. Errored events stay un-'processed' so a Stripe
  // retry reprocesses them. The subscription/workspace upserts are themselves idempotent.
  const { data: prior } = await db.from("stripe_events").select("status").eq("event_id", event.id).maybeSingle();
  if (prior?.status === "processed") {
    return json(200, { received: true, deduped: true });
  }
  await db.from("stripe_events").upsert(
    {
      event_id: event.id,
      type: event.type,
      status: "processing",
      payload: event as unknown as Record<string, unknown>
    },
    { onConflict: "event_id" }
  );

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionEvent(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionEvent(event.data.object as Stripe.Subscription, true);
        break;
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = (invoice.subscription as string) ?? null;
        if (subId) {
          await db.from("subscriptions").update({ status: "past_due" }).eq("stripe_subscription_id", subId);
        }
        break;
      }
      case "invoice.payment_succeeded":
        // Recurring renewals arrive as subscription.updated too; nothing extra needed here.
        break;
      default:
        break;
    }
  } catch (error) {
    // Record the failure and return 500 so Stripe retries (the event stays un-'processed').
    const message = error instanceof Error ? error.message : "Webhook handler error.";
    await db.from("stripe_events").update({ status: "error", error: message }).eq("event_id", event.id);
    return json(500, { error: message });
  }

  await db.from("stripe_events").update({ status: "processed", processed_at: new Date().toISOString() }).eq("event_id", event.id);
  return json(200, { received: true });
};
