# RocketCourse — End-to-End Demo Script

A repeatable walkthrough for demonstrating RocketCourse (formerly CourseForge) as a working SaaS.
The first half is the **public** path (marketing + the no-account demo) — no login, no AI credits.
The second half is the **authenticated** build path (auth → checkout → AI → editor → export). Steps
marked **✅ live** are verified against the real Supabase backend; **⏳ pending** steps need an owner
action (noted). Companion: `docs/SAAS_SETUP.md`.

## 0. One-time local setup

```bash
npm install

# Terminal 1 — the FULL stack (app + serverless functions) with the real OpenAI key from .env.
# Plain `vite` does NOT serve the /.netlify/functions/* routes — AI / Stripe / contact calls 404 there.
netlify dev --offline

# Terminal 2 — forward Stripe test webhooks to the local webhook (needed for live checkout).
# Uses the test key already in .env; its signing secret already matches STRIPE_WEBHOOK_SECRET.
stripe listen --api-key "$(grep ^STRIPE_SECRET_KEY= .env | cut -d= -f2-)" \
  --forward-to localhost:8888/.netlify/functions/stripe-webhook
```

`--offline` is required locally: the linked Netlify site's `OPENAI_API_KEY` is a stale JWT that
otherwise overrides the real `sk-proj-…` key in `.env`. App runs at **http://localhost:8888**.

**Demo account (already created + email-confirmed):**
`zoomedic911+cfdemo@gmail.com` / `CourseForge123` (credentials predate the rename) — seeded with an
active Individual Semester plan.

---

## Part A — Public site (no account, no AI credits)

### 1. Home ✅ live
1. Open `http://localhost:8888` → the **Home** page (Canvas-first positioning, value props).
2. Point out the public nav: **Home, Pricing, About, Guides, Contact, Demo**. All are reachable
   without signing in.

### 2. Pricing ✅ live
1. Click **Pricing** → every tier renders from the canonical plan catalog: Free Preview, Individual
   Semester ($79 / 4-mo pass), Individual Annual ($199/yr), Monthly ($29/mo), Designer Pro
   ($399/yr), Team ($999/yr), plus contact-sales Department/Institution.

### 3. Demo intro ✅ live
1. Click **Demo** → the **Demo intro** sets expectations: it's a pre-populated **"AI and Modern
   Society"** sample, it is **not** connected to live AI, exploring it uses **no AI credits**, and it
   **saves nothing to an account**.
2. Choose **Take the guided tour** (or explore on your own).

### 4. Guided tour + editor tabs ✅ live
1. The guided tour opens the pre-populated **"AI and Modern Society"** course in the editor and walks
   the editor tabs:
   - **Overview** — command center: course summary, readiness, quick links into every section.
   - **Homepage**, **Syllabus**, **Modules**, **Pages**, **Assignments**, **Discussions**,
     **Quizzes**, **Rubrics**, **Gradebook**, **Contact Hours**, **Theme**.
2. Edits here aren't saved and **no AI credits are used** — this is the safe sandbox for showing what
   a finished RocketCourse course looks like.

### 5. Export from the demo ✅ live
1. Open the **Export** tab → run **local validation** (manifest, modules, HTML safety, QTI, references).
2. Download the artifacts to show the full export surface:
   - **`.imscc`** Common Cartridge package.
   - **Course PDF** — the whole course as a printable document.
   - **Quiz student PDFs** — printable quiz copies (single quiz or all quizzes combined).
   - **Instructor answer-key PDFs** — printable answer keys (single quiz or all quizzes combined).
   - **Syllabus PDF** — the syllabus as a standalone printable document.
   - **QTI** exports (bundled and standalone).
3. No AI is called and no account is required. The public demo cannot reach the paid AI routes —
   they're server-gated.

### 6. Guides ✅ live
1. Click **Guides** → walk the how-to content (what RocketCourse does, the build flow, exports, and
   the Canvas import checklist).

### 7. Contact ✅ live (mailto fallback) / ⏳ pending (server email)
1. Click **Contact** → fill the inquiry form and submit.
2. Inquiries route to **rocketproofai@gmail.com** via the Netlify function
   `netlify/functions/contact.ts`; the subject is always prefixed **`[RocketCourse Inquiry]`**
   (that inbox is shared with Rocketproof).
3. **Until `RESEND_API_KEY` + a verified sender domain are configured**, the form **gracefully falls
   back to a prefilled mailto link** — nothing is sent server-side, but no inquiry is lost. See
   SAAS_SETUP "Contact-form email."

---

## Part B — Authenticated build (auth → AI → editor → export)

### 8. Create an account + sign in ✅ live
1. Click **Sign in** → **Create an account** → enter name/email/password → account is created in
   Supabase (a `profiles` row is auto-created by trigger).
2. Or just sign in with the seeded demo account above.

### 9. Choose a plan + pay ✅ live (Stripe test mode)
1. On **Pricing**, click a paid plan → **Stripe Checkout** opens → pay with test card
   `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP → you return to the dashboard.
2. Stripe fires `checkout.session.completed` → `stripe listen` (Terminal 2) forwards it to the
   **webhook**, which writes your subscription row in Supabase. Click **Refresh status** on the
   dashboard if it hasn't appeared within a second or two.
- The seeded demo account starts as Individual Semester active, so steps 10–13 also work without
  paying. For the live "I just paid" moment, sign up a fresh account and run through checkout.

### 10. Authenticated dashboard ✅ live
1. The dashboard shows your **active plan**, **usage** (AI generations + exports remaining), your
   **course projects**, and avg readiness — all read from Supabase via RLS.

### 11. Generate a course with AI ✅ live
1. Click **Create new course** → optionally upload sources (text, Markdown, HTML, and `.docx` parse
   reliably in-browser; PDF is best-effort) → type a prompt, e.g.
   *"A 12-week graduate seminar on Research Ethics in AI: bias, privacy, accountability, governance."*
2. Click **Generate Blueprint with AI** → the server (auth + entitlement gated) calls OpenAI and
   returns a **blueprint**: title, outcomes, a module map, assessments, final project, warnings.
3. Review it → **Approve & Build Course** → the full Canvas course opens in the editor and
   **autosaves** to Supabase (you'll see "Saved").

### 12. Edit + AI revise + theme ✅ live
1. Edit titles, modules, pages, assignments, etc. Changes autosave.
2. Use the editor's **AI revise** toolbar (Concise / Add examples / Accessibility / Rubric note) →
   the server rewrites the object's Canvas-safe HTML via OpenAI (gated; free users can't).
3. Open **Theme** → pick a built-in theme or **New custom theme** (name, institution, colors,
   optional logo) → **Save & apply**. It saves to `custom_themes` (RLS); contrast is validated.

### 13. Export ✅ live (entitlement enforced)
1. Open **Export** → run local validation → download the **`.imscc`**, **Course PDF**, **quiz
   student PDFs**, **answer-key PDFs**, **syllabus PDF**, and **QTI**. Export is gated by real
   entitlement (active plan + export credits).

### 14. Import into Canvas ⏳ manual checklist (sandbox not yet verified)
RocketCourse produces a Common Cartridge `.imscc`. To verify in Canvas:
1. Canvas → **Settings → Import Course Content** → "Common Cartridge 1.x Package" → upload the
   `.imscc` → Import.
2. Check: modules + items, pages render, assignments/discussions/quizzes appear, syllabus, and
   assignment groups. Note anything that doesn't import cleanly.
- **Status:** we validate the package locally and against well-formedness, but have **not** yet
  imported into a real Canvas sandbox. Do not claim "Canvas-verified" until this passes — the UI
  intentionally says "Canvas-oriented `.imscc`" / "Not verified".

## Disclaimers to state during the demo
- **AI review:** generated content is a **first draft requiring human review** — verify resources,
  dates, examples, and local policies before publishing.
- **Quiz verification:** **answer keys must be verified** before use.
- **Source retention:** uploaded files are parsed for text in the browser and are **not retained as
  files server-side**.

## Known limitations (honest)
- Real contact-email delivery needs `RESEND_API_KEY` + a verified Resend sender domain; until then
  the Contact form uses the mailto fallback (step 7).
- Production `OPENAI_API_KEY` on the Netlify site is a stale JWT — fix before deploy (see SAAS_SETUP).
- Source **PDF** parsing is best-effort in-browser; text/Markdown/HTML/`.docx` are reliable.
- Canvas sandbox import is unverified (step 14).
- Department/Institution plans route to contact-sales (no live invoicing).
