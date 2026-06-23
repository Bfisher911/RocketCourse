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
}): Promise<void> => {
  const plan = getPlan(params.planKey);
  const db = supabase();
  const { data: existing } = await db
    .from("subscriptions")
    .select("id,plan_key,status,exports_used,ai_generations_used")
    .eq("user_id", params.userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const freshActivation =
    !existing || existing.plan_key !== params.planKey || !["active", "trialing"].includes(existing.status as string);
  const exportsUsed = freshActivation ? 0 : (existing?.exports_used as number) ?? 0;
  const aiUsed = freshActivation ? 0 : (existing?.ai_generations_used as number) ?? 0;

  const row = {
    user_id: params.userId,
    plan_key: params.planKey,
    status: params.status,
    stripe_customer_id: params.customerId,
    stripe_subscription_id: params.subscriptionId,
    current_period_start: params.periodStart?.toISOString() ?? null,
    current_period_end: params.periodEnd?.toISOString() ?? null,
    cancel_at_period_end: params.cancelAtPeriodEnd,
    exports_limit: plan.exportsLimit,
    ai_generations_limit: plan.aiGenerationsLimit,
    exports_used: exportsUsed,
    ai_generations_used: aiUsed,
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

const handleCheckoutCompleted = async (session: Stripe.Checkout.Session): Promise<void> => {
  const customerId = (session.customer as string) ?? null;
  const metaUserId = (session.metadata?.supabase_user_id as string) ?? (session.client_reference_id as string) ?? null;
  const userId = await resolveUserId(customerId, metaUserId);
  if (!userId) return;

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
      cancelAtPeriodEnd: false
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

  await upsertSubscription({
    userId,
    planKey: plan.key,
    status: deleted ? "canceled" : sub.status,
    customerId,
    subscriptionId: sub.id,
    periodStart: sub.current_period_start ? new Date(sub.current_period_start * 1000) : null,
    periodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end)
  });

  // Team-capable plans get a synced workspace; the purchaser becomes the Launchpad Admin.
  // (No-op for individual plans.)
  await ensureWorkspaceForSubscription({
    userId,
    planKey: plan.key,
    status: deleted ? "canceled" : sub.status,
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    seatQuantity: sub.items.data[0]?.quantity ?? null,
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
          await supabase().from("subscriptions").update({ status: "past_due" }).eq("stripe_subscription_id", subId);
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
    // Log and return 500 so Stripe retries.
    return json(500, { error: error instanceof Error ? error.message : "Webhook handler error." });
  }

  return json(200, { received: true });
};
