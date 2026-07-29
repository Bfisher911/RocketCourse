// Security contract for the Stripe webhook — the ONLY writer of subscription /
// plan status in the system. If signature verification can be bypassed, anyone
// who can reach the URL can grant themselves a paid plan, so these are the
// assertions that matter most in the billing path.
//
// Runs with NO Stripe account and NO network: Stripe's signature scheme is
// HMAC-SHA256 over `${timestamp}.${payload}`, and `constructEventAsync` is pure
// crypto. `stripe.webhooks.generateTestHeaderString` (shipped by the SDK for
// exactly this) produces genuine signatures from a local secret.
//
// Every case below is rejected BEFORE any Supabase or Stripe network call, so
// none of them need credentials.

import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import handler from "./stripe-webhook";

const WEBHOOK_SECRET = "whsec_test_local_only_not_a_real_secret";
const OTHER_SECRET = "whsec_test_a_different_local_secret_value";

const stripe = new Stripe("sk_test_local_placeholder_not_a_real_key", {
  apiVersion: "2025-01-27.acacia" as Stripe.LatestApiVersion,
});

/** A minimal but structurally real Stripe event body. */
const eventBody = (id = "evt_test_00000000000001"): string =>
  JSON.stringify({
    id,
    object: "event",
    type: "customer.subscription.deleted",
    api_version: "2025-01-27.acacia",
    created: Math.floor(Date.now() / 1000),
    data: { object: { id: "sub_test_123", object: "subscription", customer: "cus_test_123" } },
  });

const post = (body: string, headers: Record<string, string> = {}): Request =>
  new Request("https://example.test/.netlify/functions/stripe-webhook", { method: "POST", body, headers });

const env = globalThis.process.env as Record<string, string | undefined>;
let savedSecret: string | undefined;
let savedKey: string | undefined;

beforeEach(() => {
  savedSecret = env.STRIPE_WEBHOOK_SECRET;
  savedKey = env.STRIPE_SECRET_KEY;
  env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  // Never a live key: constructEventAsync does no network I/O, so a placeholder
  // is enough to build the client.
  env.STRIPE_SECRET_KEY = "sk_test_local_placeholder_not_a_real_key";
});

afterEach(() => {
  env.STRIPE_WEBHOOK_SECRET = savedSecret;
  env.STRIPE_SECRET_KEY = savedKey;
});

describe("stripe-webhook: request guards", () => {
  it("rejects non-POST methods", async () => {
    const res = await handler(new Request("https://example.test/x", { method: "GET" }));
    expect(res.status).toBe(405);
  });

  it("refuses to run when STRIPE_WEBHOOK_SECRET is unset (503, not a silent accept)", async () => {
    delete env.STRIPE_WEBHOOK_SECRET;
    const res = await handler(post(eventBody()));
    expect(res.status).toBe(503);
    // A misconfigured deployment must fail closed, never process unverified events.
    expect(JSON.stringify(await res.json())).toMatch(/not configured/i);
  });

  it("rejects a request with no stripe-signature header", async () => {
    const res = await handler(post(eventBody()));
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).toMatch(/signature/i);
  });
});

describe("stripe-webhook: signature verification", () => {
  it("rejects a forged signature", async () => {
    const res = await handler(post(eventBody(), { "stripe-signature": "t=1,v1=deadbeef" }));
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).toMatch(/verification failed/i);
  });

  it("rejects a signature computed with a DIFFERENT secret", async () => {
    const body = eventBody();
    const sig = stripe.webhooks.generateTestHeaderString({ payload: body, secret: OTHER_SECRET });
    const res = await handler(post(body, { "stripe-signature": sig }));
    expect(res.status).toBe(400);
  });

  it("rejects a TAMPERED payload even when the signature is otherwise valid", async () => {
    // The classic attack: take a real event, swap the body for one that grants a plan.
    const original = eventBody();
    const sig = stripe.webhooks.generateTestHeaderString({ payload: original, secret: WEBHOOK_SECRET });
    const tampered = original.replace("customer.subscription.deleted", "customer.subscription.created");
    expect(tampered).not.toBe(original);
    const res = await handler(post(tampered, { "stripe-signature": sig }));
    expect(res.status).toBe(400);
  });

  it("rejects a replayed event whose timestamp is outside the tolerance", async () => {
    const body = eventBody();
    const old = Math.floor(Date.now() / 1000) - 60 * 60; // an hour stale
    const sig = stripe.webhooks.generateTestHeaderString({ payload: body, secret: WEBHOOK_SECRET, timestamp: old });
    const res = await handler(post(body, { "stripe-signature": sig }));
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).toMatch(/timestamp|tolerance|verification failed/i);
  });

  it("ACCEPTS a genuine signature — i.e. the guard is not simply rejecting everything", async () => {
    const body = eventBody();
    const sig = stripe.webhooks.generateTestHeaderString({ payload: body, secret: WEBHOOK_SECRET });

    // Without this case the suite would still pass if verification rejected
    // EVERY request — the failure mode that would silently break billing.
    //
    // A genuine signature gets past constructEventAsync and reaches the Supabase
    // admin client, which is deliberately unconfigured here. So the proof that
    // the signature was accepted is that we fail LATER, on Supabase, rather than
    // returning a 400 signature error.
    let outcome: string;
    try {
      const res = await handler(post(body, { "stripe-signature": sig }));
      outcome = `response:${res.status}:${JSON.stringify(await res.json())}`;
    } catch (error) {
      outcome = `threw:${error instanceof Error ? error.message : String(error)}`;
    }

    expect(outcome).not.toMatch(/verification failed/i);
    expect(outcome).toMatch(/Supabase admin is not configured|response:200|deduped/i);
  });
});
