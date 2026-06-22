# RocketCourse — Canvas-first AI Course Builder

RocketCourse turns a course idea or syllabus into an editable Canvas course shell and exports a
Canvas-oriented `.imscc` package. It is a working SaaS: real auth, persistence, server-side AI,
entitlement, themes, and export — built for higher-ed instructors and instructional designers.

## What is built (verified live against Supabase)

- **Auth & accounts** — Supabase email/password signup, login, session, auto-created profiles.
- **Plans & entitlement** — a canonical plan catalog + a central entitlement service enforced
  **server-side** (no client toggle). Free/demo users cannot reach paid AI or private export.
- **Persistence** — course projects autosave to Supabase (`course_projects`, RLS-scoped) and reload.
- **Real AI** — server-side blueprint generation (auth + entitlement gated) → approval → full
  course; per-object AI revise; all through a secured OpenAI proxy (key never reaches the browser).
- **Editor** — homepage, syllabus, modules, pages, assignments, discussions, quizzes, rubrics,
  gradebook, contact hours; add/delete/duplicate/reorder; readiness + quality scoring.
- **Themes** — built-in theme library + a custom school-theme builder (colors + logo) saved to the
  account.
- **Export** — browser-side `.imscc` (Common Cartridge) builder with local validation + QTI; export
  gated by real entitlement.
- **Billing (code-complete)** — Stripe Checkout / webhook / customer-portal Netlify Functions,
  driven by env (activate with a Stripe test key — see below).

## Run it

```bash
npm install
netlify dev --offline   # full stack (app + functions) at http://localhost:8888
npm run build           # tsc + vite production build
npm test                # vitest (300+ tests)
```

> Use **`netlify dev`** (not plain `vite`) so the `/.netlify/functions/*` AI/Stripe routes work.
> `--offline` makes it use the real `OPENAI_API_KEY` from `.env` (see SAAS_SETUP for why).

## Docs

- **[docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md)** — the repeatable end-to-end demo walkthrough.
- **[docs/SAAS_SETUP.md](docs/SAAS_SETUP.md)** — backend status, env vars, and the remaining
  owner action items (Stripe test key, service-role key, production OpenAI key).
- **[docs/COURSEFORGE_MVP_PLAN.md](docs/COURSEFORGE_MVP_PLAN.md)** — PRD, architecture, data model.

## Canvas compatibility note

The package builder follows public Canvas exporter structure + Common Cartridge concepts. **Canvas
sandbox import is not yet verified**, so the UI says "Canvas-oriented `.imscc`" / "Not verified"
rather than claiming Canvas-ready. Verify against a sandbox before making that claim.
