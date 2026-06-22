// Client side of Stripe billing. Calls the secure functions with the user's Supabase JWT and
// redirects the browser to the hosted Stripe page (Checkout or the Billing Portal). The server
// creates the session against the trusted price + customer; the client only triggers it.

import { getSupabaseClient } from "../services/supabaseClient";
import type { PlanKey } from "../data/plans";

const accessToken = async (): Promise<string | null> => {
  const client = await getSupabaseClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session?.access_token ?? null;
};

const postForUrl = async (
  endpoint: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; url?: string; error?: string }> => {
  const token = await accessToken();
  if (!token) return { ok: false, error: "Please sign in first." };
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    });
  } catch {
    return {
      ok: false,
      error: "Could not reach billing. Locally, run the app with `netlify dev` (not plain `vite`)."
    };
  }
  const data = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
  if (!response.ok || !data?.url) return { ok: false, error: data?.error ?? `Request failed (${response.status}).` };
  return { ok: true, url: data.url };
};

/** Start Stripe Checkout for a plan and redirect to the hosted page. Resolves only on error. */
export const startCheckout = async (planKey: PlanKey): Promise<{ ok: boolean; error?: string }> => {
  const result = await postForUrl("/.netlify/functions/create-checkout-session", { planKey });
  if (result.ok && result.url) {
    window.location.href = result.url;
    return { ok: true };
  }
  return { ok: false, error: result.error };
};

/** Open the Stripe Billing Portal (manage payment method, invoices, cancel). Redirects on success. */
export const openBillingPortal = async (): Promise<{ ok: boolean; error?: string }> => {
  const result = await postForUrl("/.netlify/functions/customer-portal", {});
  if (result.ok && result.url) {
    window.location.href = result.url;
    return { ok: true };
  }
  return { ok: false, error: result.error };
};
