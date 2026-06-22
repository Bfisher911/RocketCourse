// POST /.netlify/functions/customer-portal  — requires Authorization: Bearer <supabase jwt>.
// Opens the Stripe Billing Portal for the signed-in user's Stripe customer (manage payment method,
// view invoices, cancel/update). Only available to users who already have a Stripe customer id.

import { getAuthedUser, json } from "./_shared/http";
import { getSupabaseAdmin } from "./_shared/supabaseAdmin";
import { appUrl, getStripe } from "./_shared/stripe";

export default async (request: Request): Promise<Response> => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed. Use POST." });

  const user = await getAuthedUser(request);
  if (!user) return json(401, { error: "Sign in to manage billing." });

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("stripe_customers")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const customerId = data?.stripe_customer_id as string | undefined;
  if (!customerId) {
    return json(404, { error: "No billing account yet. Choose a plan first." });
  }

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl()}/?view=dashboard`
    });
    return json(200, { url: session.url });
  } catch (error) {
    return json(502, { error: error instanceof Error ? error.message : "Could not open billing portal." });
  }
};
