// POST /.netlify/functions/create-checkout-session
// Body: { planKey }. Requires Authorization: Bearer <supabase jwt>.
// Ensures a Stripe customer for the user, then creates a Checkout Session for the plan's price and
// returns { url }. Success → /dashboard?checkout=success, cancel → /pricing. The webhook activates
// the subscription; the client never sets plan status.

import { getAuthedUser, json } from "./_shared/http";
import { getSupabaseAdmin } from "./_shared/supabaseAdmin";
import { appUrl, checkoutModeFor, getPlan, getStripe, resolvePriceId } from "./_shared/stripe";
import type { PlanKey } from "../../src/data/plans";

declare const process: { env: Record<string, string | undefined> };

const SELF_SERVE: PlanKey[] = [
  "individual_semester",
  "individual_annual",
  "monthly_instructor",
  "designer_pro",
  "team"
];

export default async (request: Request): Promise<Response> => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed. Use POST." });

  const user = await getAuthedUser(request);
  if (!user) return json(401, { error: "Sign in to start checkout." });

  let body: { planKey?: string; workspaceName?: string };
  try {
    body = (await request.json()) as { planKey?: string; workspaceName?: string };
  } catch {
    return json(400, { error: "Body must be JSON: { planKey }." });
  }

  const planKey = body.planKey as PlanKey | undefined;
  if (!planKey || !SELF_SERVE.includes(planKey)) {
    return json(400, { error: "Unknown or non-self-serve planKey." });
  }
  const plan = getPlan(planKey);
  const workspaceName =
    typeof body.workspaceName === "string" && body.workspaceName.trim()
      ? body.workspaceName.trim().slice(0, 80)
      : undefined;

  const priceId = resolvePriceId(planKey);
  if (!priceId) {
    return json(503, {
      error: `Stripe price for ${plan.name} is not configured yet. Run the Stripe sync to create test prices and set ${`STRIPE_PRICE_${planKey.toUpperCase()}`}.`
    });
  }

  let stripe: ReturnType<typeof getStripe>;
  try {
    stripe = getStripe();
  } catch (error) {
    return json(503, { error: error instanceof Error ? error.message : "Stripe not configured." });
  }

  const supabase = getSupabaseAdmin();

  try {
    // Reuse an existing Stripe customer for this user, or create one and record the mapping.
    const { data: existing } = await supabase
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let customerId = existing?.stripe_customer_id as string | undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, metadata: { supabase_user_id: user.id } });
      customerId = customer.id;
      await supabase.from("stripe_customers").upsert({ user_id: user.id, stripe_customer_id: customerId });
    }

    const meta: Record<string, string> = { supabase_user_id: user.id, plan_key: planKey };
    if (workspaceName) meta.workspace_name = workspaceName;

    const session = await stripe.checkout.sessions.create({
      mode: checkoutModeFor(plan),
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      // Let buyers apply a Super-Admin-created promotion code at checkout. Without this, the
      // discount codes created in the admin would be created in Stripe but never redeemable.
      allow_promotion_codes: true,
      success_url: `${appUrl()}/?checkout=success`,
      cancel_url: `${appUrl()}/?checkout=cancel`,
      client_reference_id: user.id,
      metadata: meta,
      ...(checkoutModeFor(plan) === "subscription"
        ? { subscription_data: { metadata: meta } }
        : { payment_intent_data: { metadata: meta } })
    });

    return json(200, { url: session.url });
  } catch (error) {
    return json(502, { error: error instanceof Error ? error.message : "Could not create checkout session." });
  }
};
