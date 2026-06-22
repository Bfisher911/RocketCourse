# RocketCourse — Canvas-first AI Course Builder

RocketCourse turns a course idea, syllabus, lecture notes, reading list, or an existing Canvas
export into an editable, Canvas-oriented course and exports a Canvas-oriented `.imscc` package. It is
a working SaaS: a public marketing site, a separated no-account demo, real auth + entitlement +
Stripe billing, server-side AI, themes, and multi-format export — built for higher-ed instructors
and instructional designers.

## What RocketCourse is

Describe a course (or upload sources), review an AI blueprint, approve it, then edit native Canvas
objects and export a package you can import into a blank Canvas course. Generated content is a
first-draft scaffold meant to be reviewed and edited — not a locked AI blob.

## Public marketing site

A full public surface, viewable without an account:

- **Home** — Canvas-first positioning and value props.
- **Pricing** — every plan rendered from the canonical plan catalog (Free Preview + paid tiers, plus
  contact-sales Department/Institution).
- **About**, **Guides** — product story and how-to content.
- **Contact** — an inquiry form (see below).
- **Demo** — the separated no-account sample (see below).

## Public demo flow (no account, no AI credits)

The **Demo** is fully separated from the authenticated app. It opens a pre-populated **"AI and Modern
Society"** sample course with a guided tour of the editor and export. It is **not** connected to live
AI — exploring it spends **no AI credits** and saves nothing to an account. The public demo cannot
reach the paid AI routes; those are server-gated.

## Authenticated build flow

- **Auth & accounts** — Supabase email/password signup, login, session, auto-created profiles.
- **Plans & entitlement** — a canonical plan catalog + a central entitlement service enforced
  **server-side** (no client toggle). Free/demo users cannot reach paid AI or private export.
- **Billing** — Stripe Checkout / webhook / customer-portal Netlify Functions, env-driven.
- **Real AI (server-gated)** — server-side blueprint generation (auth + entitlement gated) →
  approval → full course; per-object AI revise. All AI runs through a secured OpenAI proxy
  (`netlify/functions/openai.ts`); the key never reaches the browser.
- **Persistence** — course projects autosave to Supabase (`course_projects`, RLS-scoped) and reload.

## Source upload parsing (in-browser)

Uploaded sources are parsed for **text in the browser** so the actual content informs generation
(not just the filename):

- **Text / Markdown / HTML / `.docx`** — parsed reliably (`.docx` is unzipped and its text extracted).
- **PDF** — best-effort; many PDFs compress their text streams, so when extraction is unreliable the
  app says so honestly rather than pretending the content was read.
- Uploading an existing `.imscc` imports its structure directly.

Uploaded files are parsed for text in the browser and are **not retained as files server-side**.

## Editor

A structured, tabbed workspace over native Canvas objects: **Overview** (command center), **Homepage**,
**Syllabus**, **Modules**, **Pages**, **Assignments**, **Discussions**, **Quizzes**, **Rubrics**,
**Gradebook**, **Contact Hours**, **Theme**, and **Export**. Add / delete / duplicate / reorder
objects; readiness + quality scoring throughout. A built-in theme library plus a custom school-theme
builder (colors + logo) saved to the account.

## Exports

- **`.imscc`** — browser-side Common Cartridge builder with local validation.
- **QTI** — quiz exports (bundled and standalone).
- **Course PDF** — the full course as a printable document.
- **Quiz student PDFs** — printable quiz copies for students (single quiz or all quizzes combined).
- **Instructor answer-key PDFs** — printable answer keys (single quiz or all quizzes combined).
- **Syllabus PDF** — the syllabus as a standalone printable document.
- **Validation report + import checklist** — local package checks plus a manual Canvas import checklist.

Export is gated by real entitlement (active plan + export credits).

## Contact form

The **Contact** page routes inquiries to **rocketproof.ai@gmail.com** via the Netlify function
`netlify/functions/contact.ts` (Resend HTTP API). Because that inbox is shared with Rocketproof,
every subject is prefixed **`[RocketCourse Inquiry]`**. If `RESEND_API_KEY` is not configured, the
form **gracefully falls back to a prefilled mailto link** — no email is sent server-side. See
`.env.example` and `docs/SAAS_SETUP.md`.

## Run it

```bash
npm install
netlify dev --offline   # full stack (app + functions) at http://localhost:8888
npm run build           # tsc + vite production build
npm test                # vitest (342+ tests)
```

> Use **`netlify dev`** (not plain `vite`) so the `/.netlify/functions/*` AI / Stripe / contact
> routes work. `--offline` makes it use the real `OPENAI_API_KEY` from `.env` (see SAAS_SETUP for why).

## Docs

- **[docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md)** — the repeatable end-to-end demo walkthrough.
- **[docs/SAAS_SETUP.md](docs/SAAS_SETUP.md)** — backend status, env vars, and remaining owner action
  items (Stripe test key, service-role key, production OpenAI key, Resend contact-email setup).
- **[docs/ROCKETCOURSE_MVP_PLAN.md](docs/ROCKETCOURSE_MVP_PLAN.md)** — PRD, architecture, data model.
- **[docs/COURSE_OUTPUT_QUALITY_LOOP.md](docs/COURSE_OUTPUT_QUALITY_LOOP.md)** — course-output quality work.
- **[docs/AI_PROMPT_TEMPLATE_SYSTEM.md](docs/AI_PROMPT_TEMPLATE_SYSTEM.md)** — versioned prompt-template architecture.

## Disclaimers (please read before publishing a course)

- **AI review disclaimer** — generated content is a **first draft that requires human review**.
  Verify resources, dates, examples, local policies, and assessment fit before publishing.
- **Quiz verification disclaimer** — **answer keys must be verified** before use.
- **Source retention** — uploaded files are parsed for text in the browser and are not retained as
  files server-side.

## Canvas compatibility note

The package builder follows public Canvas exporter structure + Common Cartridge concepts. **Canvas
sandbox import is not yet verified**, so the UI says "Canvas-oriented `.imscc`" / "Not verified"
rather than claiming Canvas-ready. Verify against a sandbox before making that claim.
