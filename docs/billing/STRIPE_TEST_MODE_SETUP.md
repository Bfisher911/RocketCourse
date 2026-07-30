# Stripe test mode — setup walkthrough

Everything here happens in **test mode**. No real card is ever charged, and no
live product or price is touched. Test and live mode in Stripe are completely
separate worlds: separate keys, separate products, separate webhooks. Nothing you
create below can affect live billing.

This unblocks **BLK-4** — a real `checkout → webhook → entitlement` round trip.

**Time:** ~20 minutes, most of it creating six products.

---

## Step 0 — Turn on test mode

Open the dashboard and flip the **Test mode** toggle (top-right). Every link
below already points at the test-mode URL, so if you use them you're in the right
place automatically.

🔗 https://dashboard.stripe.com/test/dashboard

> Sanity check: test-mode pages have an orange/amber banner or "TEST" badge. If
> you don't see one, you're in live mode — stop and toggle.

---

## Step 1 — Copy your two test API keys

🔗 https://dashboard.stripe.com/test/apikeys

Copy both:

| Dashboard label | Starts with | Env var |
| --- | --- | --- |
| Secret key (click **Reveal**) | `sk_test_…` | `STRIPE_SECRET_KEY` |

> You do **not** need the publishable key. Checkout is created entirely
> server-side (`create-checkout-session` returns a URL and the client redirects
> via `window.location.href`), and `VITE_STRIPE_PUBLISHABLE_KEY` is referenced
> nowhere in `src/`. It is listed in `.env.example` for historical reasons only.

The code already asserts this: `netlify/functions/_shared/stripe.ts` exposes
`isStripeTestMode()`, which is true only when the secret key starts with
`sk_test_`.

> ⚠️ If a key starts with `sk_live_` or `pk_live_`, you're in live mode. Go back
> to Step 0.

---

## Step 2 — Create the six products

🔗 https://dashboard.stripe.com/test/products/create

RocketCourse has six paid plans. Create one product per row, then copy the
**Price ID** (`price_…`, *not* the product `prod_…` ID) into the matching env var.

| Product name | Price | Billing | Env var |
| --- | --- | --- | --- |
| Individual Semester | $59.00 | **One-off** | `STRIPE_PRICE_INDIVIDUAL_SEMESTER` |
| Individual Annual | $129.00 | Recurring · **Yearly** | `STRIPE_PRICE_INDIVIDUAL_ANNUAL` |
| Monthly Instructor | $15.00 | Recurring · **Monthly** | `STRIPE_PRICE_MONTHLY_INSTRUCTOR` |
| RocketCourse Premium | $25.00 | Recurring · **Monthly** | `STRIPE_PRICE_ROCKETCOURSE_PREMIUM` |
| Designer Pro | $299.00 | Recurring · **Yearly** | `STRIPE_PRICE_DESIGNER_PRO` |
| Team | $599.00 | Recurring · **Yearly** | `STRIPE_PRICE_TEAM` |

These amounts and cadences come straight from `src/data/plans.ts` (`priceCents`
and `checkoutMode`) — they are what the app already advertises on the pricing
page, so keep them identical or the displayed price won't match what Stripe charges.

**Getting the Price ID:** open the product → under **Pricing**, click the price →
copy the ID beginning `price_`. (The `prod_` ID will not work; `resolvePriceId()`
matches on the price.)

> `Department Pilot` and `Institution` are `checkoutMode: "contact"`, and
> `Free Preview` is `"free"` — none of them use Stripe, so they need no product.

---

## Step 3 — Create the test webhook

🔗 https://dashboard.stripe.com/test/webhooks/create

- **Endpoint URL:**
  `https://<your-deploy>--thecourseforge.netlify.app/.netlify/functions/stripe-webhook`
  (use a draft-deploy URL to test without touching production)
- **Events to send** — select exactly these six, which are the ones the handler
  implements (see the header comment in `netlify/functions/stripe-webhook.ts`):
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`

After creating it, click **Reveal** under *Signing secret* and copy the
`whsec_…` value into `STRIPE_WEBHOOK_SECRET`.

> This secret is what the signature check uses. If it's wrong, every event is
> rejected with 400 — which is correct behaviour, and exactly what
> `stripe-webhook.security.test.ts` asserts.

---

## Step 4 — Put the values in Netlify

🔗 https://app.netlify.com/projects/thecourseforge/configuration/env

Add these eight:

```
STRIPE_SECRET_KEY=sk_test_…
STRIPE_WEBHOOK_SECRET=whsec_…
STRIPE_PRICE_INDIVIDUAL_SEMESTER=price_…
STRIPE_PRICE_INDIVIDUAL_ANNUAL=price_…
STRIPE_PRICE_MONTHLY_INSTRUCTOR=price_…
STRIPE_PRICE_ROCKETCOURSE_PREMIUM=price_…
STRIPE_PRICE_DESIGNER_PRO=price_…
STRIPE_PRICE_TEAM=price_…
```

Only `VITE_`-prefixed variables reach the browser bundle. `STRIPE_SECRET_KEY` and
`STRIPE_WEBHOOK_SECRET` must **never** get a `VITE_` prefix — that would publish
them to every visitor.

**Verify the deployed key is test mode before running a checkout.** A live key
would charge a real card. `netlify env:list` redacts secret values, so check via
the CLI instead:

```bash
netlify env:get STRIPE_SECRET_KEY | head -c 8   # must print sk_test_
```

Redeploy afterwards so the functions pick the values up:

```bash
netlify deploy --build
```

---

## Step 5 — Run a test checkout

🔗 Test card reference: https://docs.stripe.com/testing

On the deployed preview, open **Pricing** and choose any paid plan. At Stripe
Checkout use:

| Field | Value |
| --- | --- |
| Card | `4242 4242 4242 4242` |
| Expiry | any future date (e.g. `12/34`) |
| CVC | any 3 digits |
| ZIP | any 5 digits |

Useful variants:

| Scenario | Card |
| --- | --- |
| Payment succeeds | `4242 4242 4242 4242` |
| Card declined | `4000 0000 0000 0002` |
| Requires 3-D Secure | `4000 0025 0000 3155` |
| Insufficient funds | `4000 0000 0000 9995` |

---

## Step 6 — Confirm the round trip

Three places should agree:

1. **Stripe** → https://dashboard.stripe.com/test/payments — the payment is listed.
2. **Webhook delivery** → open your endpoint at
   https://dashboard.stripe.com/test/webhooks and check the attempt returned
   **200**. A 400 means the signing secret is wrong; a 503 means
   `STRIPE_WEBHOOK_SECRET` isn't set on the deploy.
3. **App** → the account's plan reflects the purchase. Entitlement is read only
   from the trusted `subscriptions` row, never from the client, so if the app
   shows the new plan the whole chain worked.

Optional local replay, no deploy needed:

```bash
stripe login
stripe listen --forward-to localhost:8888/.netlify/functions/stripe-webhook
stripe trigger checkout.session.completed
```

---

## What this proves, and what it doesn't

**Proves:** checkout session creation, signature verification against a real
Stripe-signed event, the six handled event types, idempotency (the `stripe_events`
table dedupes replays), and entitlement derivation.

**Doesn't prove:** anything about live mode. Live keys, live products and the live
webhook are configured separately — treat that as its own checklist.

Already proven without any of this, in `netlify/functions/stripe-webhook.security.test.ts`:
forged, wrong-secret, tampered and replayed events are all rejected; a genuine
signature is accepted; and a missing `STRIPE_WEBHOOK_SECRET` fails **closed** (503).
Step 6 adds the half that needs a real Stripe account.
