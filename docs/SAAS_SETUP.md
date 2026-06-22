# CourseForge SaaS Setup & Status

This doc tracks the work to turn the CourseForge prototype into a working SaaS demo
(auth → pricing → Stripe checkout → paid dashboard → AI generation → editor → export).
It is the operational companion to `docs/COURSEFORGE_MVP_PLAN.md`.

## Architecture at a glance

| Concern | Where | Status |
| --- | --- | --- |
| Plan catalog (source of truth) | `src/data/plans.ts` | ✅ Built |
| Central entitlement service | `src/services/entitlement.ts` | ✅ Built + tested |
| Database schema + RLS | `supabase/migrations/0001_init.sql` | ✅ **Applied to live project** |
| Plans seed | `supabase/migrations/0002_seed_plans.sql` | ✅ **Applied (8 plans live)** |
| Supabase project | `yxyilycskkbcypczlxif` (us-east-1) | ✅ **ACTIVE_HEALTHY** |
| Supabase auth (signup/login/session) | `src/auth/*` | ✅ **Verified live** |
| Profile auto-create trigger | `handle_new_user` | ✅ **Verified live** |
| Pricing page | `src/components/PricingPage.tsx` | ✅ Built |
| Server AI proxy (OpenAI) | `netlify/functions/openai.ts` | ✅ Built (real key) |
| Stripe checkout / webhook / portal functions | `netlify/functions/` | ✅ Built — needs test key + service role key |
| Stripe test products/prices | Stripe (test mode) | ⏳ Needs owner `sk_test_` key |
| Course project persistence | `course_projects` table ready | ⏳ Next (client CRUD via RLS) |
| Real AI blueprint → full course | proxy ready | ⏳ Next (key is real) |

## ✅ Supabase backend is LIVE

Owner approved the **$10/month** project. Created project **`yxyilycskkbcypczlxif`** (name
"CourseForge", region us-east-1, ACTIVE_HEALTHY). Both migrations applied; all 8 plans seeded.
Real signup → profile-trigger → login → session verified in-browser. `.env` now holds the real
`VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` (the app auto-switched out of local-dev mode).

**Demo account (created + email-confirmed):** `zoomedic911+cfdemo@gmail.com` / `CourseForge123`.

### ⚠️ Owner action items to finish the billing + server-enforcement half

1. **Paste the Supabase SERVICE ROLE key** into `.env` as `SUPABASE_SERVICE_ROLE_KEY` (Supabase
   dashboard → Project Settings → API → `service_role` secret). The MCP cannot expose it. Required
   for the Stripe webhook and server-side entitlement enforcement to write/read trusted rows.
2. **Add a Stripe TEST secret key** to `.env` as `STRIPE_SECRET_KEY=sk_test_…`. Then I create the 5
   test products/prices and set the `STRIPE_PRICE_*` vars, and wire `STRIPE_WEBHOOK_SECRET`.
3. **(Recommended) Disable email confirmation** for a frictionless demo: Supabase dashboard →
   Authentication → Sign In / Providers → Email → turn **off** "Confirm email". Otherwise new signups
   must click an emailed link (the seeded demo account above is already confirmed). The MCP can't
   toggle this.

## Stripe (test mode — free, no approval) — ⚠️ blocked on a test key

**Discovered:** the connected Stripe MCP is authenticated with a **LIVE** key (its products return
`livemode: true` and are real products from the owner's other apps). The money-gate rules forbid
creating live products/prices/webhooks without approval, and the demo wants **test mode** anyway.

**Therefore CourseForge will NOT create any Stripe objects via the live MCP.** All Stripe
integration is built as **env-driven code** (checkout/webhook/portal functions + a sync script) that
lights up once a Stripe **TEST** secret key (`sk_test_…`) is provided. To unblock, the owner can
either (a) add a `sk_test_…` key to `.env`/Netlify so the sync script creates the test products, or
(b) create the 5 test products in the Stripe dashboard and paste their price IDs into `.env`.

Test-mode products, prices, checkout, and webhooks cost nothing and touch no real customers.
Going **live** (live products/prices/webhooks, real invoices/emails) requires separate owner
approval and is out of scope for the demo.

Self-serve plans needing a Stripe price (test mode): `individual_semester` (one-time $79),
`individual_annual` ($199/yr), `monthly_instructor` ($29/mo), `designer_pro` ($399/yr),
`team` ($999/yr). Department/Institution route to contact-sales, not Checkout.

Test card: `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP.

## Environment variables

See `.env.example` for the full, commented list. Secrets (`*_SERVICE_ROLE_KEY`,
`OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) are **server-only** and must never
carry a `VITE_` prefix (which would bundle them into the browser).

## Entitlement model (how gating stays honest)

`src/services/entitlement.ts` answers "can this user do X?" purely from a trusted subscription
snapshot (the Supabase `subscriptions` row, written only by the Stripe webhook) plus the plan
catalog. The browser may call it to disable locked buttons, but the **server re-checks** before any
paid action (AI generation, private export). There is no client-only toggle that grants real access.
