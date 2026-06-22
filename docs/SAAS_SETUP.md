# RocketCourse SaaS Setup & Status

This doc tracks the work to turn the RocketCourse (formerly CourseForge) prototype into a working
SaaS demo (auth → pricing → Stripe checkout → paid dashboard → AI generation → editor → export).
It is the operational companion to `docs/ROCKETCOURSE_MVP_PLAN.md`.

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
| **Real AI blueprint generation** | `netlify/functions/generate-blueprint.ts` | ✅ **Verified live (auth+entitlement gated)** |
| **Course project persistence** | `course_projects` via RLS | ✅ **Verified live (autosave + load)** |
| Blueprint → full course (approval flow) | `src/services/aiGeneration.ts` | ✅ Built + verified |
| Stripe checkout / webhook / portal functions | `netlify/functions/` | ✅ **Verified live (test mode)** |
| Stripe test products/prices | Stripe (test mode) | ✅ **5 created; price IDs in .env** |
| Full-course AI content enrichment | — | ⏳ Next (pages/assignments via AI) |

## 🤖 Real AI generation is LIVE (verified)

`generate-blueprint` is a secure server route: it verifies the caller's Supabase JWT, checks
entitlement against the DB (free/demo users denied server-side), calls OpenAI server-side with the
production blueprint prompt template, and returns validated `CourseBlueprint` JSON. Verified live:
the demo account generated a real 12-module AI ethics blueprint, approved it, and the resulting
15-module course autosaved to Supabase with the AI module titles.

### ⚠️ OpenAI key gotcha for local dev + production
The linked Netlify site (`thecourseforge`) has `OPENAI_API_KEY` set to a **stale JWT** (not a valid
`sk-…` key), and `netlify dev` lets that site value override the real key in `.env`. Two consequences:
- **Local demo:** run **`netlify dev --offline`** (the preview config `courseforge-fullstack` already
  does this) so the real `sk-proj-…` key from `.env` is used. Plain `vite` won't serve functions.
- **Production:** update the site's `OPENAI_API_KEY` to the real key (Netlify dashboard → Site
  settings → Environment variables) or AI calls will 401. Also add `SUPABASE_SERVICE_ROLE_KEY` and
  the Stripe vars there for deploys.

(AI usage counting writes via the service-role key; it's best-effort and lights up once that key is
set — generation itself works without it.)

## ✅ Supabase backend is LIVE

Owner approved the **$10/month** project. Created project **`yxyilycskkbcypczlxif`** (name
"CourseForge" — the internal project id predates the rename, region us-east-1, ACTIVE_HEALTHY). Both
migrations applied; all 8 plans seeded. Real signup → profile-trigger → login → session verified
in-browser. `.env` now holds the real `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` (the app
auto-switched out of local-dev mode).

**Demo account (created + email-confirmed):** `zoomedic911+cfdemo@gmail.com` / `CourseForge123`
(credentials predate the rename).

### Owner action items

1. ✅ **DONE** — `SUPABASE_SERVICE_ROLE_KEY` is in `.env` (verified: bypasses RLS).
2. ✅ **DONE** — Stripe **test** key in `.env`; 5 test products/prices created (`STRIPE_PRICE_*`);
   `STRIPE_WEBHOOK_SECRET` set from `stripe listen`. Verified: checkout URL, signed webhook →
   Supabase update, billing portal, bad-signature rejection. Run `stripe listen --forward-to
   localhost:8888/.netlify/functions/stripe-webhook` during the demo (see DEMO_SCRIPT).
3. ✅ **DONE** — Netlify site `OPENAI_API_KEY` updated to the real `sk-proj-…` key across all 4
   deploy contexts (verified). For a full production deploy, also add `SUPABASE_SERVICE_ROLE_KEY`,
   `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and the `STRIPE_PRICE_*` vars to the Netlify
   dashboard (and create a Stripe dashboard webhook endpoint at the deployed `/stripe-webhook` URL).
4. ✅ **DONE** — Supabase email confirmation **disabled** (verified: fresh signup returns a session
   immediately). Live signups are now frictionless.

## Stripe (test mode — free, no approval) — ⚠️ blocked on a test key

**Discovered:** the connected Stripe MCP is authenticated with a **LIVE** key (its products return
`livemode: true` and are real products from the owner's other apps). The money-gate rules forbid
creating live products/prices/webhooks without approval, and the demo wants **test mode** anyway.

**Therefore RocketCourse will NOT create any Stripe objects via the live MCP.** All Stripe
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
`OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`) are **server-only**
and must never carry a `VITE_` prefix (which would bundle them into the browser). The documented set
covers `DEFAULT_CHAT_MODEL` / `OPENAI_MODEL`, `EMBEDDING_PROVIDER`, `OPENAI_API_KEY`, the
Supabase vars, the Stripe vars, the app URLs, and the contact-form vars below.

### Contact-form email (`netlify/functions/contact.ts`)

The Contact page routes inquiries through a Netlify function using the Resend HTTP API:

- **`RESEND_API_KEY`** — Resend API key for contact-form email delivery. **If unset, the contact
  form gracefully falls back to a prefilled mailto link; no email is sent server-side.**
- **`CONTACT_TO_EMAIL`** — destination inbox. Defaults to `rocketproofai@gmail.com`.
- **`CONTACT_FROM_EMAIL`** — the verified Resend sender. Defaults to
  `RocketCourse <onboarding@resend.dev>`.

The contact subject is **always prefixed `[RocketCourse Inquiry]`** because that inbox is shared with
Rocketproof.

## Entitlement model (how gating stays honest)

`src/services/entitlement.ts` answers "can this user do X?" purely from a trusted subscription
snapshot (the Supabase `subscriptions` row, written only by the Stripe webhook) plus the plan
catalog. The browser may call it to disable locked buttons, but the **server re-checks** before any
paid action (AI generation, private export). There is no client-only toggle that grants real access.

## Remaining owner actions & known limitations

The Stripe / Supabase / OpenAI owner-action notes above still stand. In addition:

1. **Resend contact-email delivery (owner action).** Real contact-email sending needs a
   **`RESEND_API_KEY`** plus a **verified sender domain** in Resend (and, for production, those vars
   set on the Netlify site). Until then, the Contact form falls back to a prefilled **mailto** link,
   which works without any server config — no email is lost, it just opens the user's mail client.
2. **Canvas sandbox import is still owner-verified.** The package builder is "Canvas-oriented"; it
   has **not** been imported into a real Canvas sandbox here. Do not claim "Canvas-verified" until
   the owner imports an `.imscc` into a sandbox and compares against a known-good export.
3. **Source PDF parsing is best-effort.** Uploaded **text, Markdown, HTML, and `.docx`** sources
   parse reliably in the browser; **PDF** text extraction is best-effort (many PDFs compress their
   text streams), and the app says so honestly rather than pretending the content was read. Paste
   key sections when a PDF won't parse.

## Security & privacy notes

- **Source upload retention.** Uploaded source files are parsed **for text in the browser** and are
  **not retained as files server-side**. Only the extracted text (capped per file) is used to inform
  generation.
- **AI review disclaimer.** Generated course content is a **first draft that requires human review**.
  Verify resources, dates, examples, local policies, accessibility, and assessment fit before
  publishing.
- **Quiz verification disclaimer.** Generated quizzes and **answer keys must be verified** before use.
