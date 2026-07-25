# RocketCourse — Production Readiness Ledger

Living record for the production hardening loop. Running code, migrations, and
tests are the source of truth; audit docs are treated as findings to verify.

**Branch:** `feature/nine-workflows-units-design` · **Never deploys to production; Netlify preview only.**

Severities: **P0** security/privacy/data-loss/billing/auth/corrupt-export/outage ·
**P1** core-workflow failure / major a11y / misleading paid feature ·
**P2** meaningful UX/perf/quality/maintainability defect · **P3** minor polish.

---

## Baseline (verified this pass)

| Gate | Command | Result |
| --- | --- | --- |
| Lint | `npm run lint` | ✅ clean (no leaked secrets, focused tests, or debugger) |
| Typecheck | `npm run typecheck` | ✅ clean (`tsc -b` + functions project) |
| Unit/integration | `npm test` | ✅ **870 passed / 98 files** |
| Build | `npm run build` | ✅ builds + prerenders 19 routes + sitemap |
| Install | `node_modules` present | ✅ (fresh-install path not re-verified this pass) |

Build signals: main JS chunk **1.69 MB** (gzip 478 kB) → PERF-1; ineffective
dynamic import of `supabaseClient` → MAINT-1.

Honest positives verified in prior sessions and re-confirmed by tests: IMSCC
export cannot be blocked by AI content (sanitize/coerce/repair layers); demo
content cannot leak into generations (guarded by `courseGenerator.noleak.test.ts`);
topic-leak regression tests exist; production paths use honest disclosures
("Local mode: plan is simulated", "Canvas IMSCC export", integration "coming soon"),
not fake controls.

---

## Findings

| ID | Sev | Area | Evidence | Status |
| --- | --- | --- | --- | --- |
| SEC-1 | P1 | Security headers | `netlify.toml` had **no** CSP / HSTS / X-Content-Type-Options / frame / Referrer / Permissions-Policy | ✅ **Fixed** — hardening headers added (enforced) + CSP in **Report-Only** (see note) |
| SEC-2 | P1 | Dependency advisories | `npm audit`: `fast-xml-parser` (DOCTYPE entity expansion, used in XML validate path) + `sharp`/libvips CVEs (process external image bytes) | ✅ **Fixed** — fast-xml-parser 5.9.3→5.10.1; sharp 0.34.5→0.35.3. `npm audit` now **0 vulnerabilities**; typecheck/build/870 tests green; Netlify Linux sharp binaries retained |
| SEC-3 | P2 | Secret hygiene | `.gitignore` lacked `*.pem`/`*.key`/`id_rsa` (nothing leaking) | ✅ **Fixed** |
| RUN-1 | P2 | Data/UX correctness | Dashboard rendered **duplicate React keys** (`listProjects()` returned rows with the same project id → duplicate/double-counted course cards). Root cause: env where migration-0004 unique index isn't applied, or pre-0004 null `app_project_id` rows | ✅ **Fixed** — `dedupeById` in `listProjects` (keeps freshest, newest-first). Verified live: 28→24 rows, **0** fresh duplicate-key warnings after re-render; regression test added |
| PERF-1 | P2 | Performance | `dist/assets/index-*.js` = 1.69 MB; `App.tsx` (~4.3k lines) imported eagerly; no route-level code-split | 🟡 **Largely fixed** — entry **1650.6 → 964.1 kB** (−41.6%); INITIAL **1971.8 → 1660.8 kB** raw / **515.8 → 436.0 kB** gzip (−15.5%). See PERF-1 detail below; one large lever remains (PERF-2) |
| BUILD-1 | P1 | Build correctness | `tsconfig.node.json` (composite, no outDir) made `tsc -b` emit **`vite.config.js` next to `vite.config.ts`** — and Vite resolves `.js` first, so any build config in the `.ts` would be **silently ignored** | ✅ **Fixed** (`b4dc386`) — emit redirected to `node_modules/.tmp`; proven live because the `react-vendor` chunk now actually appears |
| REL-1 | P1 | Reliability | **No ErrorBoundary anywhere in `src/`**. With netlify's `/* → /index.html 200` catch-all, a chunk missing after a deploy returns HTML with status 200 → dynamic import parse-error → React unmounts the whole tree = **blank white page** | ✅ **Fixed** (`b4dc386`) — `ChunkErrorBoundary` around `<App/>`, detects chunk failures across Chrome/Safari/Firefox message shapes, leads with a reload action; 4 unit tests |
| PERF-3 | P2 | Caching | No header matched `/assets/*`, so content-hashed chunks revalidated every load — which would cancel out splitting | ✅ **Fixed** (`b4dc386`) — immutable 1-year `Cache-Control`. Verified all 42 emitted asset files are content-hashed and that `index.html`/favicons/`robots.txt` sit outside `/assets/` and stay revalidated |
| PERF-2 | P2 | Performance | **`sampleProject` is generated at module-evaluation time** (`courseGenerator.ts:2791` runs `generateCourseProject(...)`), so *every* visitor — including on the marketing landing page — synchronously builds a **2.03 MB** demo course before React renders. Measured **~73 ms** warm/JIT'd pure execution (cold is materially worse), and it pins the whole generation engine (incl. the still-critical `rubricBuilder` 139.5 kB + `syllabusTemplates` 93.5 kB chunks) into the initial payload | 🔜 **Open** — see design + blocker below |
| MAINT-1 | P3 | Maintainability | Build warns: `supabaseClient.ts` dynamically imported by `openaiClient.ts` but statically elsewhere → dynamic import ineffective | 🔜 Open — **downgraded**: `@supabase/supabase-js` is *already* split (196.6 kB `dist-*.js`), so the warning names only the 1.6 kB local wrapper. Worth ~1 kB, not 201 kB |
| NAME-1 | P3 | Naming | Legacy "CourseForge": Netlify slug `thecourseforge.netlify.app` (prerender canonical/OG), repo dir, some internal ids. Product name is RocketCourse | 🔜 Open — migrate only where safe (not the live site slug / historical records) |
| UX-1 | ✅ | Workspace | Experience side-rails lost sticky travel in the SPA (chrome scrolled away → overhang; async `host.show()` double-mounted a second stage that stole rail travel) | ✅ **Fixed** (`855492c`) — persistent measured chrome + cancellable `show()` |
| UX-2 | ✅ | Discoverability | Nine building experiences only reachable after entering the editor | ✅ **Fixed** (`6cf795e`) — per-course "Open in <experience>" on the dashboard |
| FEAT-1 | ✅ | Interactions | No per-item recommendation layer | ✅ **Fixed** (`177d9fd`) — deterministic recommender + coverage-gap report |

**SEC-1 note.** Netlify header rules only take effect on a real deploy, so an
enforcing CSP we cannot exercise locally risks breaking fonts/Supabase/Stripe.
CSP therefore ships as `Content-Security-Policy-Report-Only`; promote it to
`Content-Security-Policy` after verifying zero violations on a branch preview.
The other headers are safe to enforce immediately (verified: the app never
iframes itself, so `X-Frame-Options: DENY` is safe).

---

## PERF-1 detail — what shipped, measured

`node scripts/bundle-report.mjs` (added this pass) separates the critical path
from lazy chunks so each step is measured, not guessed.

| | Entry chunk | INITIAL raw | INITIAL gzip |
| --- | --- | --- | --- |
| Baseline | 1650.6 kB | 1971.8 kB | 515.8 kB |
| After split | **964.1 kB** | **1660.8 kB** | **436.0 kB** |
| Change | **−41.6 %** | **−15.8 %** | **−15.5 %** |

What moved off the first load: JSZip (93.6 kB — it had **four** eager anchors, the
fourth being `waitlistExport` via `SuperAdminScreen`, which is why the admin step
had to ship in the same commit), the IMSCC exporter + importer, `fast-xml-parser`,
all four PDF/QTI engines, the three admin consoles, and nine public
marketing/legal/blog screens. React moved to its own cacheable `react-vendor`
chunk. `Landing` and its widgets stay **eager** — that is the prerendered first
paint for 19 SEO routes.

Verified in the browser, not only by tests (the 100 test files are pure logic and
would stay green through a total UI break): on a cold load neither `jszip` nor
`imsccExport` appears in the resource timeline, and clicking *Validate only*
fetches exactly those two on demand; all five public routes render with no stuck
skeleton; a **cold direct URL load of `/pricing`** renders fully with its correct
per-page title; the command palette opens over a workflow experience with the
stage keeping **identical DOM node identity** (no remount — the UX-1 hazard); the
measured `--rc-chrome-offset` is still a real 138 px, not the 70/64 fallback; and
undo still reverts an edit made inside an experience.

### Defects the split introduced — found by adversarial review, fixed

A 26-agent adversarial pass (5 hostile lenses → independent verification of each
claim) was run against the claim *"this changed no behavior."* It raised 21
candidates; verification refuted several as misreads and confirmed these, all now
fixed. This is why the pass was worth running: **every test stayed green through
all of them**, because the 100 test files are pure logic.

| ID | Sev | Defect | Fix |
| --- | --- | --- | --- |
| SPLIT-1 | P2 | Eight code-split download handlers (`downloadCoursePdf`, `downloadSyllabusPdf`, both QTI, four quiz PDFs) had a bare `await import(...)` with no `catch`. Their `() => void` prop signatures discard the promise, and an error boundary only sees **render-phase** errors — so a chunk failure was a permanently dead button with no message anywhere (a failed module fetch is cached as errored, so retries re-reject). | `withDownloadErrors()` wrapper reports via `setExportError`, which ExportTab already renders **plus** a global `unhandledrejection` listener in `main.tsx` that routes chunk failures to the boundary's reload prompt — covering *all* call-site `await import()`, which `React.lazy` coverage alone misses |
| SPLIT-2 | P2 | `.imscc` intake import: chunk failure silently no-oped the upload zone (no row, no error) | `.catch()` that surfaces a real message |
| SPLIT-3 | P2 | `fillFullCourseContent`'s chunk import sat **above** its `try`, so a failure skipped the catch *and* `blocks.js` still fired a green "Full content marked generated" toast — reporting success for content never generated | Import moved inside the `try` |
| SPLIT-4 | P2 | `/assets/*` immutable caching + the `/*  →  /index.html 200` catch-all meant a missing chunk returned **HTML with status 200**, which would then be cached for a year under a `.js` URL | Added a `/assets/* → 404` redirect ahead of the catch-all so missing assets fail honestly. ⚠️ **Verify on the preview (BLK-1)** — Netlify redirect/header interaction cannot be exercised locally |
| SPLIT-5 | P3 | `ScreenSkeleton` used `<main role="status">`, which **replaces** the main landmark and has no `id="main-content"` — the always-rendered skip link pointed at nothing while any lazy screen loaded | `<main id="main-content">` with the live region as a child |
| SPLIT-6 | P3 | New CSS used `var(--ink-3)` / `var(--ink-2)`, which are defined **only** in the prototype-scoped `[data-rc-ds]` sheet, not the app's `:root` — muted text rendered at full ink. (Also fixed the same bug in the dashboard "Open in" label from `6cf795e`.) | Use the app's `--muted` token |

**Correction to an earlier claim.** Commit `02de8ac` listed `fullCourseContent`
among the deferred modules. It is **not** deferred: `ExportTab.tsx:35` statically
imports `planFullCourseFill` and calls it during render, and `ExportTab` is eager.
The dynamic import at the call site is harmless and becomes effective once the
editor itself is split, but the byte win was overstated. The measured totals in
the table above were taken from real builds and are unaffected.

Verified live after the fixes: a rejected dynamic import now raises the
"This page needs a refresh" panel with a working reload button; an *ordinary*
rejected promise does **not** blank the screen; muted text resolves to
`rgb(91,85,79)`; `#main-content` exists for the skip link; marketing routes still
render.

### PERF-2 — the remaining lever, and why it is not a code-split problem

Everything still on the critical path is gated behind one line:
`src/App.tsx` imports `sampleProject`, and `courseGenerator.ts:2791` *executes*
`generateCourseProject(...)` at module scope. No bundler can split that: the
demo course, the generation engine, every content builder and the readiness /
quality reports are all reachable from module evaluation.

Fixing it is **not** a bundler change — it is an App-state change with a product
decision inside it, which is why it is filed rather than done:

1. `sampleProject` becomes memoized `getSampleProject()` (async), with the stable
   id `course_ai-and-modern-society` exported as a plain constant so the ~6
   identity comparisons in `App.tsx` never trigger generation.
2. `enterDemo` awaits it. The editor is **never** a boot screen (`pathToScreen`
   cannot return `"editor"`; it is only ever reached via `setScreen("editor")`),
   so nothing renders a course at load.
3. `projects` initial state stops being `[sampleProject]`. **This is the product
   decision**: today a signed-in user with zero saved courses sees the
   *AI and Modern Society* sample sitting in their dashboard. Removing it is what
   this ledger's own rules ask for ("keep demo content out of normal accounts",
   "genuine empty states for new users") and the real empty state already exists —
   but it changes what an existing user sees, so it needs an owner's yes.
4. `readiness`/`quality` `useMemo`s at `App.tsx:390-391` run unconditionally on
   the boot course and statically pull `readiness.ts → themeDesign.ts →` all six
   builders. They must be gated on the editor screen for the cluster to actually
   leave.

Expected: removes ~73 ms of blocking CPU from **every** page load plus the
`rubricBuilder` (139.5 kB) and `syllabusTemplates` (93.5 kB) critical chunks.

## External blockers (precise owner action required)

These gate several completion criteria in the mandate. None can be satisfied
from this environment without credentials; no result for them may be fabricated.

| ID | Blocks | Smallest owner action |
| --- | --- | --- |
| BLK-1 | Netlify preview deploy + deployed smoke tests | Authorize Netlify CLI (or link the existing `thecourseforge` site) and provide preview-safe env vars; then `netlify deploy --build` (draft/branch, **no** `--prod`). |
| BLK-2 | Live-AI smoke tests / generation quality on real model | Provide a budgeted, test-scoped `OPENAI_API_KEY` in a non-CI environment. Deterministic fixture + schema-contract tests already run without it; CI must not depend on a live model. |
| BLK-3 | Migrations apply + RLS cross-user/-org isolation tests | Provide a throwaway Supabase project (URL + service-role key). 10 migrations exist under `supabase/migrations/`; application + RLS isolation are unverified here. |
| BLK-4 | Stripe billing end-to-end | Provide **test-mode** Stripe keys + a test product catalog (current config is live-mode). Entitlement is already read-only from trusted server state. |
| BLK-5 | Real Canvas import verification / "Canvas-ready" claim | Import a generated `.imscc` into a Canvas sandbox and inspect objects. Until then the UI correctly says "Canvas IMSCC export" / "locally validated", never "Canvas-ready". |
| BLK-6 | Lighthouse Perf ≥90 / A11y ≥95 / Best-Practices ≥95 | Run Lighthouse against a production-like deploy (depends on BLK-1). Local a11y is checked via in-browser contrast/keyboard passes; PERF-1 is the main perf lever. |

---

## Loop log

- **Pass 1** — Baseline captured (all four gates green). Discovery: production
  paths are honest (no dead controls / fake progress found in the red-flag
  sweep). Fixed SEC-1 (security headers + Report-Only CSP). Recorded PERF-1,
  MAINT-1, NAME-1 and the six external blockers. Prior this session: UX-1, UX-2,
  FEAT-1 landed.
- **Pass 2** — Production-readiness audit (`PROD_AUDIT.md`). Result **PASS**, 0 P0.
  Security scan clean (no secrets, no tracked env, RLS sound, Stripe webhook
  signature-verified + idempotent). Found + fixed SEC-2 (2 high dep advisories →
  0 vulnerabilities) and SEC-3 (.gitignore). Types/lint/build/870-tests all green.
  Next candidate batch: PERF-1 (route/vendor code-split) toward the Lighthouse
  gate, then NAME-1 safe rename.
