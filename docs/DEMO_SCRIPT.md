# CourseForge — End-to-End Demo Script

A repeatable walkthrough for demonstrating CourseForge as a working SaaS. Steps marked
**✅ live** are verified working against the real Supabase backend; **⏳ pending** steps need an
owner action (noted) before they're fully live. Companion: `docs/SAAS_SETUP.md`.

## 0. One-time local setup

```bash
npm install

# Terminal 1 — the FULL stack (app + serverless functions) with the real OpenAI key from .env.
# Plain `vite` does NOT serve the /.netlify/functions/* routes — AI/Stripe calls 404 there.
netlify dev --offline

# Terminal 2 — forward Stripe test webhooks to the local webhook (needed for live checkout).
# Uses the test key already in .env; its signing secret already matches STRIPE_WEBHOOK_SECRET.
stripe listen --api-key "$(grep ^STRIPE_SECRET_KEY= .env | cut -d= -f2-)" \
  --forward-to localhost:8888/.netlify/functions/stripe-webhook
```

`--offline` is required locally: the linked Netlify site's `OPENAI_API_KEY` is a stale JWT that
otherwise overrides the real `sk-proj-…` key in `.env`. App runs at **http://localhost:8888**.

**Demo account (already created + email-confirmed):**
`zoomedic911+cfdemo@gmail.com` / `CourseForge123` — seeded with an active Individual Semester plan.

## 1. Public marketing + pricing ✅ live
1. Open `http://localhost:8888` → the landing page (Canvas-first positioning, value props).
2. Click **View pricing** → all tiers render from the plan catalog: Free Preview, Individual
   Semester ($79 / 4-mo pass), Individual Annual ($199/yr), Monthly ($29/mo), Designer Pro
   ($399/yr), Team ($999/yr), plus contact-sales Department/Institution.

## 2. Static demo (no AI, no account) ✅ live
1. From pricing's Free Preview, click **Try the static demo** (or the top-nav **Editor**).
2. The prebuilt sample course ("AI and Modern Society") opens read-only-ish in the editor.
3. Go to **Export** → run local validation → download a sample `.imscc`. No AI is called; no
   account required. (The public demo cannot reach the paid AI routes — they're server-gated.)

## 3. Create an account + sign in ✅ live
1. Click **Sign in** → **Create an account** → enter name/email/password → account is created in
   Supabase (a `profiles` row is auto-created by trigger).
2. *(If email confirmation is on, click the emailed link. Recommended: disable it in Supabase →
   Authentication → Email for a frictionless demo — see SAAS_SETUP.)*
3. Or just sign in with the seeded demo account above.

## 4. Choose a plan + pay ✅ live (Stripe test mode)
1. On pricing, click a paid plan → **Stripe Checkout** opens → pay with test card
   `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP → you return to the dashboard.
2. Stripe fires `checkout.session.completed` → `stripe listen` (Terminal 2) forwards it to the
   **webhook**, which writes your subscription row in Supabase. Click **Refresh status** on the
   dashboard if it hasn't appeared within a second or two.
- **Verified:** create-checkout-session returns a real `checkout.stripe.com` URL; the webhook
  (signature-verified, bad signatures rejected) updates the subscription with the correct plan,
  limits, and period; the **Billing portal** (dashboard) opens a real `billing.stripe.com` session.
  Test products/prices for all 5 self-serve plans exist in your Stripe **test** account.
- The seeded demo account starts as Individual Semester active, so steps 5–9 also work without
  paying. For the live "I just paid" moment, sign up a fresh account and run through checkout.

## 5. Authenticated dashboard ✅ live
1. The dashboard shows your **active plan** (Individual Semester), **usage** (AI generations +
   exports remaining), your **course projects**, and avg readiness — all read from Supabase via RLS.

## 6. Generate a course with AI ✅ live
1. Click **Create new course** → type a prompt, e.g.
   *"A 12-week graduate seminar on Research Ethics in AI: bias, privacy, accountability, governance."*
2. Click **Generate Blueprint with AI** → the server (auth + entitlement gated) calls OpenAI and
   returns a **blueprint**: title, outcomes, a module map, assessments, final project, warnings.
3. Review it → **Approve & Build Course** → the full Canvas course opens in the editor and
   **autosaves** to Supabase (you'll see "Saved").

## 7. Edit + AI revise ✅ live
1. Edit titles, modules, pages, assignments, etc. Changes autosave.
2. Use the editor's **AI revise** toolbar (Concise / Add examples / Accessibility / Rubric note) →
   the server rewrites the object's Canvas-safe HTML via OpenAI (gated; free users can't).

## 8. Theme: built-in + custom ✅ live
1. Open the **Theme** tab → pick a built-in theme (applies to the live preview).
2. Click **New custom theme** → set name, institution, primary/background/text colors, optional
   logo → **Save & apply**. It saves to `custom_themes` (RLS) and appears in the library tagged
   "Custom". Contrast is validated.

## 9. Export `.imscc` ✅ live (entitlement enforced)
1. Open **Export** → run local validation (manifest, modules, HTML safety, QTI, references).
2. Download the `.imscc`. Export is gated by real entitlement (active plan + export credits).

## 10. Import into Canvas ⏳ manual checklist (sandbox not yet verified)
CourseForge produces a Common Cartridge `.imscc`. To verify in Canvas:
1. Canvas → **Settings → Import Course Content** → "Common Cartridge 1.x Package" → upload the
   `.imscc` → Import.
2. Check: modules + items, pages render, assignments/discussions/quizzes appear, syllabus, and
   assignment groups. Note anything that doesn't import cleanly.
- **Status:** we validate the package locally and against well-formedness, but have **not** yet
  imported into a real Canvas sandbox. Do not claim "Canvas-verified" until this passes — the UI
  intentionally says "Canvas-oriented `.imscc`" / "Not verified".

## Known limitations (honest)
- Stripe checkout/webhook need the owner's test key + service-role key (step 4).
- Production `OPENAI_API_KEY` on the Netlify site is a stale JWT — fix before deploy.
- Full-course **content** (page/assignment prose) is deterministic-scaffold + AI module titles;
  per-object AI enrichment is the next quality pass.
- Canvas sandbox import is unverified (step 10).
- Department/Institution plans route to contact-sales (no live invoicing).
