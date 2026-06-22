# CourseForge SaaS Setup & Status

This doc tracks the work to turn the CourseForge prototype into a working SaaS demo
(auth → pricing → Stripe checkout → paid dashboard → AI generation → editor → export).
It is the operational companion to `docs/COURSEFORGE_MVP_PLAN.md`.

## Architecture at a glance

| Concern | Where | Status |
| --- | --- | --- |
| Plan catalog (source of truth) | `src/data/plans.ts` | ✅ Built |
| Central entitlement service | `src/services/entitlement.ts` | ✅ Built + tested |
| Database schema + RLS | `supabase/migrations/0001_init.sql` | ✅ Written (not applied) |
| Plans seed | `supabase/migrations/0002_seed_plans.sql` | ✅ Written (not applied) |
| Server AI proxy (OpenAI) | `netlify/functions/openai.ts` | ✅ Built (real key configured) |
| Supabase client | `src/services/supabaseClient.ts` | ⚙️ Scaffold (auth flows pending) |
| Auth UI / context | — | ⏳ Pending |
| Stripe test products/prices | Stripe (test mode) | ⏳ Pending (free, no approval) |
| Stripe checkout / webhook / portal functions | `netlify/functions/` | ⏳ Pending |
| Pricing page | — | ⏳ Pending |
| Real AI blueprint → full course | — | ⏳ Pending (proxy ready) |

## ⛔ Owner approval needed (money gate)

Creating a dedicated Supabase project for CourseForge costs **$10/month** (confirmed via the
Supabase API for org `Bfisher911's Org`). The org's free active-project slots are already used by
other apps, so a new project is billable. Per the project's money-gate rules, **no project will be
created without explicit owner approval.**

Everything that does **not** require spend is being built first (schema files, entitlement logic,
Stripe **test-mode** setup, server functions, UI) so the backend lights up the moment approval lands.

**What the $10/month unblocks:** real signup/login, persistence of course projects, server-side
entitlement enforcement, and the Stripe webhook writing subscription status — i.e. the actual
end-to-end paid demo. Until then the app runs in **local demo mode** (in-memory, no account).

### When approved — apply the schema
With the Supabase project created (region `us-east-1` recommended), apply in order:
1. `supabase/migrations/0001_init.sql` — tables, triggers, RLS policies.
2. `supabase/migrations/0002_seed_plans.sql` — plan catalog seed.

Then set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and (server-only)
`SUPABASE_SERVICE_ROLE_KEY` in `.env` / the Netlify dashboard.

## Stripe (test mode — free, no approval)

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
