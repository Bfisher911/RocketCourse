# Production Readiness Audit

**Project:** Node (npm) · TypeScript + Vite 8 / rolldown SPA + Netlify functions · Node 20 target (local v25.9.0)
**Date:** 2026-07-28
**Result:** ✅ **PASS** — 0 P0, 0 P1 issues

Second full audit of this branch. The first (2026-07-24) found and fixed two high-severity
dependency advisories and a `.gitignore` gap. Since then ~20 commits have landed
(code-splitting, an inline-screen extraction, a React test harness). This pass re-runs
every check against the current tree.

## Summary

| Category | Status | Issues |
|---|---|---|
| Security | ✅ | 0 P0, 0 P1, 0 P2 |
| Type safety | ✅ | 0 errors |
| Lint | ✅ | 0 errors, 0 warnings |
| Build | ✅ | passes, prerenders 19 routes + sitemap, **0 build warnings** |

Not part of the audit skill, run anyway: **891 tests / 102 files, all passing.**

## P0 (blocking)

None.

## P1 (should fix before next release)

None.

## P2 (cleanup)

None open.

## Fixed during this audit

### Ineffective dynamic import of `sourceParsing` (P3)
- **What:** the build warned `INEFFECTIVE_DYNAMIC_IMPORT` — `src/services/sourceParsing.ts` was
  `await import()`ed at `App.tsx:738` while also being statically imported by `App.tsx:180` and
  `screens/IntakeScreen.tsx:12` (both for the synchronous `augmentPromptWithSources`). The module
  was already in the eager graph, so the dynamic import deferred nothing.
- **Why it was harmless but worth removing:** the actual weight — JSZip (~96 kB) — is deferred
  separately *inside* `docxToText`, not by this call. The dynamic import was pure noise, and a
  standing build warning trains people to ignore build warnings.
- **Fix applied:** use the static `parseSourceFile` import at the call site.
- **Verified:** build now emits **zero** warnings; JSZip is still its own chunk
  (`jszip.min-*.js`) with **0 references** in the entry chunk; INITIAL total unchanged at
  1023.6 kB / 276.5 kB gzip; 891 tests still green.

## Notes

### Security checks that passed clean
- No leaked secrets in tracked code (AWS keys, `sk_live_`, private-key headers, JWTs, and generic
  `api_key`/`token`/`secret`/`password` assignments all clear).
- No tracked `.env` files (`.env.example` only).
- `.gitignore` covers `.env`, `.env.local`, `*.pem`, `*.key`, `id_rsa`.
- Supabase migrations contain no `disable row level security`.
- Working tree is clean (no uncommitted or untracked files).
- `npm audit --omit=dev`: **0 vulnerabilities** (the `fast-xml-parser` and `sharp` advisories
  fixed in the previous audit have not regressed).

### Deploy-checklist observations
- **`netlify.toml` is in good shape:** seven security headers on `/*`, immutable 1-year caching
  scoped to `/assets/*` only (verified every emitted asset is content-hashed, and
  `index.html`/favicons/`robots.txt` sit outside it and stay revalidated), and an
  `/assets/* → 404` rule ahead of the SPA catch-all so a missing chunk fails honestly instead of
  being served an HTML shell with status 200.
- **Two items still need a real deploy to verify** (ledger BLK-1) and cannot be exercised locally:
  promoting the CSP from `Report-Only` to enforcing, and confirming the `/assets/* → 404`
  redirect/header interaction behaves as intended on Netlify.
- **Config-shadow trap is closed:** `tsconfig.node.json` emits to `node_modules/.tmp`, so `tsc -b`
  can no longer write a `vite.config.js` that would silently shadow `vite.config.ts`.

### Tech-debt observations
- **`App.tsx` is now 1,993 lines**, down from 4,575 at the start of this effort (−56%). Screens
  live in `src/screens/`, editor components in `src/components/editor/`, form primitives in
  `src/components/form/`.
- **Bundle:** INITIAL 1023.6 kB raw / 276.5 kB gzip, down from 1971.8 / 515.8 — **−48% raw,
  −46% gzip**. The chunk-size build warning that flagged the old 1.69 MB entry is gone.
- **Largest remaining local item:** ~185 kB of editor-only CSS still inside the render-blocking
  stylesheet. Deliberately not attempted — it carries four documented traps (impure selectors
  shared with Landing, a responsive block straddling landing and editor, deliberate late-file
  overrides, and this repo's own history of a cascade-order regression), so it needs a
  screenshot-diff pass across all 19 prerendered routes.
- **`MAINT-1`** (a second, unrelated ineffective-dynamic-import on the 1.6 kB `supabaseClient`
  wrapper) remains open and downgraded: `@supabase/supabase-js` is already split into its own
  ~197 kB chunk, so that warning is worth ~1 kB, not 197.
- **`NAME-1`**: legacy "CourseForge" naming persists in the Netlify slug
  (`thecourseforge.netlify.app`, which the prerender uses for canonical/OG) and the repo
  directory. Renaming the live slug is an owner decision, not a code change.

### Out of scope for this skill
Runtime/deploy configuration (env vars on the target, DNS, TLS), the test suite, and real Canvas
import verification. Deploy-dependent gates — Netlify preview, live-AI generation quality,
Supabase migration/RLS execution, Stripe test-mode billing, Lighthouse scores, and Canvas
import — are tracked as external blockers BLK-1…BLK-6 in
`docs/production-readiness/ledger.md`, each with the smallest owner action needed.

**Verdict:** no P0 or P1 open; the tree is safe to build and deploy to a **preview** from a
code-security standpoint. Production sign-off still depends on the external-blocker
verifications in the ledger.
