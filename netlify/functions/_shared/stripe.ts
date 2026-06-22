// Shared Stripe client + plan→price resolution. Uses STRIPE_SECRET_KEY (use a TEST key, sk_test_…,
// for the demo). Price IDs come from env (STRIPE_PRICE_<KEY>), created by scripts/stripe-sync.mjs.

import Stripe from "stripe";
import { getPlan, type Plan, type PlanKey } from "../../../src/data/plans";

declare const process: { env: Record<string, string | undefined> };

let cached: Stripe | null = null;

export const getStripe = (): Stripe => {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("Stripe is not configured: set STRIPE_SECRET_KEY (use a sk_test_… key for the demo).");
  cached = new Stripe(key, { apiVersion: "2025-01-27.acacia" as Stripe.LatestApiVersion });
  return cached;
};

export const isStripeTestMode = (): boolean => Boolean(process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_"));

/** The env var holding a plan's Stripe Price ID, e.g. STRIPE_PRICE_INDIVIDUAL_SEMESTER. */
export const priceEnvVar = (planKey: PlanKey): string => `STRIPE_PRICE_${planKey.toUpperCase()}`;

export const resolvePriceId = (planKey: PlanKey): string | null =>
  process.env[priceEnvVar(planKey)]?.trim() || null;

/** Stripe Checkout mode for a plan: one-time payment (semester pass) vs recurring subscription. */
export const checkoutModeFor = (plan: Plan): "payment" | "subscription" =>
  plan.checkoutMode === "payment" ? "payment" : "subscription";

export const appUrl = (): string =>
  (process.env.APP_URL?.trim() || process.env.VITE_APP_URL?.trim() || "http://localhost:8888").replace(/\/$/, "");

export { getPlan };
