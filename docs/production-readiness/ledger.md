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
| Unit/integration | `npm test` | ✅ **877 passed / 100 files** (was 870/98 at baseline; +7 from this pass's regression tests) |
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
| SEC-1 | P1 | Security headers | `netlify.toml` had **no** CSP / HSTS / X-Content-Type-Options / frame / Referrer / Permissions-Policy | ✅ **Fixed and fully enforcing** — all 7 headers live; CSP **promoted from Report-Only to enforcing** on 2026-07-28 after preview verification (see below) |
| SEC-2 | P1 | Dependency advisories | `npm audit`: `fast-xml-parser` (DOCTYPE entity expansion, used in XML validate path) + `sharp`/libvips CVEs (process external image bytes) | ✅ **Fixed** — fast-xml-parser 5.9.3→5.10.1; sharp 0.34.5→0.35.3. `npm audit` now **0 vulnerabilities**; typecheck/build/870 tests green; Netlify Linux sharp binaries retained |
| SEC-3 | P2 | Secret hygiene | `.gitignore` lacked `*.pem`/`*.key`/`id_rsa` (nothing leaking) | ✅ **Fixed** |
| RUN-1 | P2 | Data/UX correctness | Dashboard rendered **duplicate React keys** (`listProjects()` returned rows with the same project id → duplicate/double-counted course cards). Root cause: env where migration-0004 unique index isn't applied, or pre-0004 null `app_project_id` rows | ✅ **Fixed** — `dedupeById` in `listProjects` (keeps freshest, newest-first). Verified live: 28→24 rows, **0** fresh duplicate-key warnings after re-render; regression test added |
| PERF-1 | P2 | Performance | `dist/assets/index-*.js` = 1.69 MB; `App.tsx` (~4.3k lines) imported eagerly; no route-level code-split; 322.7 kB render-blocking CSS | ✅ **Fixed** — entry **1650.6 → 652.0 kB (−60.5%)**; CSS **322.7 → 268.3 kB**; INITIAL **1971.8 → 1134.3 kB** raw / **515.8 → 295.8 kB gzip (−42.7%)** |
| BUILD-1 | P1 | Build correctness | `tsconfig.node.json` (composite, no outDir) made `tsc -b` emit **`vite.config.js` next to `vite.config.ts`** — and Vite resolves `.js` first, so any build config in the `.ts` would be **silently ignored** | ✅ **Fixed** (`b4dc386`) — emit redirected to `node_modules/.tmp`; proven live because the `react-vendor` chunk now actually appears |
| REL-1 | P1 | Reliability | **No ErrorBoundary anywhere in `src/`**. With netlify's `/* → /index.html 200` catch-all, a chunk missing after a deploy returns HTML with status 200 → dynamic import parse-error → React unmounts the whole tree = **blank white page** | ✅ **Fixed** (`b4dc386`) — `ChunkErrorBoundary` around `<App/>`, detects chunk failures across Chrome/Safari/Firefox message shapes, leads with a reload action; 4 unit tests |
| PERF-3 | P2 | Caching | No header matched `/assets/*`, so content-hashed chunks revalidated every load — which would cancel out splitting | ✅ **Fixed** (`b4dc386`) — immutable 1-year `Cache-Control`. Verified all 42 emitted asset files are content-hashed and that `index.html`/favicons/`robots.txt` sit outside `/assets/` and stay revalidated |
| PERF-2 | P2 | Performance | **`sampleProject` was generated at module-evaluation time** (`courseGenerator.ts:2791`), so every visitor — including on the marketing landing page — synchronously built a **2.03 MB** demo course (~**73 ms** warm) before React rendered, and that pinned the whole generation + readiness cluster into the initial payload | ✅ **Fixed** — the four-part structural gate landed. Entry **968.2 → 652.0 kB**; INITIAL **1610.7 → 1134.3 kB** raw / **428.0 → 295.8 kB** gzip. `rubricBuilder` (139.5 kB) and `syllabusTemplates` (93.5 kB) left the critical path entirely. Verified decisively: the demo seed prompt `12-week undergraduate course` now appears **0×** in the built entry chunk (was 1×) |
| SEO-1 | P2 | SEO correctness | **Pre-existing**: the screen effect called `applySeo(screen)` **before** `history.pushState`, and `applySeo` resolves its route from `window.location.pathname` first — so every client-side navigation tagged the page with the **previous** screen's title, canonical and OG data | ✅ **Fixed** — URL now moves first. Verified live: title *and* canonical match the path on all four marketing routes (previously all but the first were wrong). Regression test in `App.smoke.test.tsx` |
| SPLIT-7 | P1 | Reliability | Once every screen became lazy, `setScreen()` from a click handler was a **synchronous** update that suspends — React refuses, warns *"A component suspended while responding to synchronous input"*, and replaces the whole UI with the fallback | ✅ **Fixed** — the setter (not all 41 call sites) is wrapped in `startTransition`, the documented fix; React now keeps the current screen visible until the next chunk arrives instead of flashing a skeleton |
| CACHE-1 | P3 | Caching | Preview verification showed the `/assets/* → 404` response **also** carries `cache-control: public,max-age=31536000,immutable`, because Netlify header rules match on request path and cannot vary by status. A browser may therefore cache a 404 for a year under a hashed asset URL | 🔜 **Open, documented.** Strictly better than the HTML-200 it replaced (which would be parsed as JS). Only bites if a rollback restores a byte-identical content hash whose URL a client already 404-cached; recoverable with a hard reload. Netlify offers no status-conditional header rule, so the alternatives are worse |
| BILL-1 | P2 | Billing config | `STRIPE_PRICE_ROCKETCOURSE_PREMIUM` is **required by the code** (`resolvePriceId('rocketcourse_premium')`, a `checkoutMode: "subscription"` plan) but was **missing from `.env.example`** — so that plan's checkout would fail on any environment set up from the documented list | ✅ **Fixed** — added to `.env.example`; all 6 paid plans now documented. Found while writing `docs/billing/STRIPE_TEST_MODE_SETUP.md` |
| MAINT-2 | P3 | Build hygiene | Build warned `INEFFECTIVE_DYNAMIC_IMPORT`: `sourceParsing.ts` was `await import()`ed in App while also statically imported there and by IntakeScreen (for the sync `augmentPromptWithSources`) — so it deferred nothing | ✅ **Fixed** — call site uses the static import. JSZip (the real weight) stays deferred inside `docxToText`; verified **0 refs** in the entry chunk and the build now emits **zero warnings** |
| MAINT-1 | P3 | Maintainability | Build warns: `supabaseClient.ts` dynamically imported by `openaiClient.ts` but statically elsewhere → dynamic import ineffective | 🔜 Open — **downgraded**: `@supabase/supabase-js` is *already* split (196.6 kB `dist-*.js`), so the warning names only the 1.6 kB local wrapper. Worth ~1 kB, not 201 kB |
| NAME-1 | P3 | Naming | Legacy "CourseForge": Netlify slug `thecourseforge.netlify.app` (prerender canonical/OG), repo dir, some internal ids. Product name is RocketCourse | 🔜 Open — migrate only where safe (not the live site slug / historical records) |
| UX-1 | ✅ | Workspace | Experience side-rails lost sticky travel in the SPA (chrome scrolled away → overhang; async `host.show()` double-mounted a second stage that stole rail travel) | ✅ **Fixed** (`855492c`) — persistent measured chrome + cancellable `show()` |
| UX-2 | ✅ | Discoverability | Nine building experiences only reachable after entering the editor | ✅ **Fixed** (`6cf795e`) — per-course "Open in <experience>" on the dashboard |
| FEAT-1 | ✅ | Interactions | No per-item recommendation layer | ✅ **Fixed** (`177d9fd`) — deterministic recommender + coverage-gap report |

**SEC-1 note — CSP is now ENFORCING.** Promoted from Report-Only on 2026-07-28
against draft deploy `6a695786ccf9a22348d275ee`. Evidence gathered without
credentials (I cannot enter a password):

- **Runtime**: a `fetch()` from the deployed page to the project's
  `*.supabase.co` origin **reached the server (HTTP 401)** — proving `connect-src`
  is not blocking it. The `wss:` realtime endpoint and an `img-src` load from
  Supabase storage likewise produced **no** `securitypolicyviolation` event.
- **Static**: Stripe checkout is a top-level `window.location.href` navigation
  (`billing/checkout.ts:43/53/63`), which no directive here governs; no component
  loads an `<img>` from a remote origin (generated imagery arrives as Supabase
  storage signed URLs); no unexpected external origin appears in any deployed chunk.
- **Post-promotion**: re-deployed with the header enforcing — **zero violations**,
  fonts still load, Pricing/Guides/Demo render, and the editor reaches with no
  error boundary.

Residual: a fully authenticated session was never exercised, but it uses the same
`*.supabase.co` origin already proven at runtime. If a future integration adds an
origin, the CSP will now **block** rather than warn — add it in the same commit.

---

## PERF-1 detail — what shipped, measured

`node scripts/bundle-report.mjs` (added this pass) separates the critical path
from lazy chunks so each step is measured, not guessed.

| | Entry chunk | Render-blocking CSS | INITIAL raw | INITIAL gzip |
| --- | --- | --- | --- | --- |
| Baseline | 1650.6 kB | 322.7 kB | 1971.8 kB | 515.8 kB |
| After split | **966.5 kB** | **268.3 kB** | **1608.9 kB** | **427.5 kB** |
| Change | **−41.4 %** | **−16.9 %** | **−18.4 %** | **−17.1 %** |

Asset count went 11 → 53: that is the point. The critical path shrank while the
deferred work (JSZip, export/PDF engines, admin, marketing screens, 11
experience stylesheets) moved behind the navigation that actually needs it, all
cached `immutable`.

What moved off the first load: JSZip (93.6 kB — it had **four** eager anchors, the
fourth being `waitlistExport` via `SuperAdminScreen`, which is why the admin step
had to ship in the same commit), the IMSCC exporter + importer, `fast-xml-parser`,
all four PDF/QTI engines, the three admin consoles, nine public
marketing/legal/blog screens, and the 11 workflow-experience stylesheets
(`host.ts` eager-globbed ~67 kB of prototype CSS into the render-blocking sheet
even for visitors who never open the editor). React moved to its own cacheable
`react-vendor` chunk. `Landing` and its widgets stay **eager** — that is the
prerendered first paint for 19 SEO routes.

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
| SPLIT-4 | P2 | `/assets/*` immutable caching + the `/*  →  /index.html 200` catch-all meant a missing chunk returned **HTML with status 200**, which would then be cached for a year under a `.js` URL | Added a `/assets/* → 404` redirect ahead of the catch-all so missing assets fail honestly. ✅ **Verified on the preview**: a missing chunk returns **HTTP 404**, not an HTML 200. See CACHE-1 for a residual nuance |
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

### PERF-2 — the four-part structural gate (done)

The earlier attempt removed App's static import of the generator and was
honestly recorded here as *not* delivering the win: three other eager modules
still pinned `courseGenerator`, so its module body — and the ~73 ms demo-course
generation — still ran at boot. All four parts have now landed:

1. **`HOURS_PER_CREDIT` + `makeContactHours` → `services/contactHoursModel.ts`.**
   A pure leaf module. `courseGenerator` re-exports both, so nothing else moved.
   This freed `contactHoursSummary` (and the Contact Hours tab) from dragging in
   the generation engine for a single constant.
2. **`aiGeneration` and `courseTransforms` off the eager path.** Their three App
   call sites (`generateBlueprint`, `buildCourseFromBlueprint`, the readiness
   "Fix all safe issues" button) all sit in click handlers or already-async
   functions, so they became `await import(...)`. `approveBlueprint` is now async.
   Their service signatures were left alone — no ripple into TransformTab.
3. **All 14 editor tabs are `React.lazy`.** They were already separate files, so
   this is the pattern already proven on admin/marketing. One `<Suspense>` wraps
   the tab body: exactly one tab renders at a time, so a shared boundary is
   equivalent to 14, and it is scoped *inside* the editor chrome so suspending
   never unmounts the chrome around it.
4. **The readiness cluster followed.** `readiness.ts → themeDesign.ts →` the six
   builders was reachable almost entirely through those tabs; once they went
   lazy, `rubricBuilder` (139.5 kB) and `syllabusTemplates` (93.5 kB) left the
   critical path without needing the Dashboard extraction. The Dashboard still
   computes per-project readiness scores synchronously, which is correct — it is
   never a boot screen.

| | Entry | INITIAL raw | INITIAL gzip |
| --- | --- | --- | --- |
| Original baseline | 1650.6 kB | 1971.8 kB | 515.8 kB |
| After PERF-1 | 968.2 kB | 1610.7 kB | 428.0 kB |
| **After PERF-2** | **652.0 kB** | **1134.3 kB** | **295.8 kB** |
| **Total change** | **−60.5 %** | **−42.5 %** | **−42.7 %** |

**Decisive verification** (not inference): the demo seed prompt
`12-week undergraduate course` appears **0×** in the built entry chunk — it was
1× before, as the minified module-scope call `pf=uf({prompt:\`Build me a…`.
The generation no longer runs on any page load.

**Browser-verified after the refactor**, since the 885 tests are pure logic and
would stay green through a total UI break:
- all **16** editor tabs render real content (1.4k–36k chars each), no stuck
  skeleton, no error boundary, zero console errors;
- the async `applyTemplate` handler awaits the generator chunk and applies —
  *"Applied the Cognitive Lab visual template."*;
- **full course generation end to end** via *Build instant draft (no AI)* (which
  is the now-async `startGeneration`): produced a real 9-module / 48-page
  Marine Biology course, with **no demo-topic leak** — the no-leak invariant
  holds through the split;
- demo entry, experience switching and the export/validate path all still work.

## Preview verification (2026-07-28)

Draft deploy: `https://6a6954d6940b29e8f2b07f72--thecourseforge.netlify.app`
(`netlify deploy --build`, **no** `--prod` — the production URL was not touched.)

Everything below could only be checked on a real deploy:

| Check | Result |
| --- | --- |
| All 7 security headers on `/*` | ✅ live and correct |
| `index.html` caching | ✅ `max-age=0, must-revalidate` (deploys picked up immediately) |
| Real asset caching | ✅ `max-age=31536000, immutable`, `content-type: application/javascript` |
| **Missing chunk** (SPLIT-4) | ✅ **HTTP 404** — not an HTML 200. See CACHE-1 for the residual nuance |
| 8 prerendered SEO routes | ✅ all 200 after trailing-slash 301, each with its own `<title>` + canonical |
| SPA deep-link refresh | ✅ `/app`, `/dashboard`, `/login`, `/app?exp=course-map` all 200 |
| Netlify functions | ✅ all 15 deployed; `openai`/`contact`/`generate-blueprint`/`stripe-webhook` return 405 to GET (running, correctly rejecting) |
| `robots.txt` / `sitemap.xml` | ✅ 200 / 200 with 19 URLs |
| **CSP violations** | ✅ **zero** across landing, Pricing, Guides, About, Demo, and the full editor |
| Editor on the deploy | ✅ demo course loads at `/app`, chrome renders, no error boundary, no stuck skeleton |

**CSP promotion.** Report-Only produced **zero** violations on every path exercised.
That is the evidence needed to promote it to enforcing — with the caveat that the
signed-out session could not exercise authenticated Supabase calls, Stripe
checkout redirect, or image generation. Recommend promoting after one signed-in
pass over those three.

## Migration + RLS verification (2026-07-28)

Run against a **local** stack (`supabase start` + `supabase db reset`) — no
credentials, no remote project, nothing touched outside this machine. Local ports
were remapped to 554xx in `supabase/config.toml` so an already-running Supabase
project on the default ports was left alone.

| Check | Result |
| --- | --- |
| **All 17 migrations apply to an empty DB** | ✅ clean; only benign `does not exist, skipping` notices from idempotent guards |
| Resulting schema | ✅ **29 tables**, and **every one has RLS enabled** (queried from `pg_class.relrowsecurity`, not inferred from SQL) |
| Policy count | ✅ 50 policies; no table is RLS-on-but-policy-less (which would be silently deny-all) |
| **Cross-user read** | ✅ Alice sees exactly 1 row (her own), **0** of Bob's |
| **Cross-user write** | ✅ Alice's `UPDATE` and `DELETE` of Bob's row both affect **0 rows**; superuser ground truth confirms Bob's row unmodified |
| **Cross-workspace read** | ✅ non-member Bob sees **0** of Alice's workspaces and **0** member rows |
| **Privilege escalation** | ✅ Bob inserting himself as workspace `admin` is **rejected by RLS** |
| Not over-restrictive | ✅ owner Alice still sees her own workspace |

Captured as a re-runnable test: **`supabase/tests/rls_isolation.sql`**. Every
assertion `RAISE EXCEPTION`s on failure.

**The test was proved to have teeth**, not just to pass: disabling RLS on
`course_projects` makes it fail with `RLS LEAK: Alice can see 1 of Bob's course
rows`, and re-enabling restores the pass.

**A trap worth recording:** `set local role` / `set local request.jwt.claims`
only apply inside a transaction. Outside one Postgres emits a WARNING and the
statements run as **superuser, which bypasses RLS entirely** — an early version of
this test did that and appeared to show total isolation failure. The committed
test keeps every impersonation inside `BEGIN/COMMIT`, and says so in a comment.

**Static analysis agreed:** 26 policies scope directly on `auth.uid()`/`owner_id`/
`user_id`; 23 scope via `SECURITY DEFINER` helpers (`is_workspace_admin`,
`can_edit_workspace`, `is_super_admin`); the one unconditional `using (true)` is
the intentional public `plans` pricing catalog.

## External blockers (precise owner action required)

These gate several completion criteria in the mandate. None can be satisfied
from this environment without credentials; no result for them may be fabricated.

| ID | Blocks | Smallest owner action |
| --- | --- | --- |
| BLK-1 | ~~Netlify preview deploy + deployed smoke tests~~ | ✅ **RESOLVED 2026-07-28.** Draft deployed to `https://6a6954d6940b29e8f2b07f72--thecourseforge.netlify.app` (production URL untouched). See "Preview verification" below. |
| BLK-2 | Live-AI smoke tests / generation quality on real model | Provide a budgeted, test-scoped `OPENAI_API_KEY` in a non-CI environment. Deterministic fixture + schema-contract tests already run without it; CI must not depend on a live model. |
| BLK-3 | ~~Migrations apply + RLS cross-user/-org isolation tests~~ | ✅ **RESOLVED 2026-07-28** — verified against a local Postgres via `supabase start` + `supabase db reset`, needing **no credentials at all**. See "Migration + RLS verification" below. |
| BLK-4 | Stripe billing end-to-end | 🟡 **Partly closed.** The webhook's *security contract* is now proven WITHOUT credentials (8 tests, `netlify/functions/stripe-webhook.security.test.ts`): forged, wrong-secret, tampered-payload and replayed events are all rejected; a genuine signature is accepted; and an unset `STRIPE_WEBHOOK_SECRET` fails **closed** (503). Still needs **test-mode keys + a test catalog** to exercise a real checkout → webhook → entitlement round trip. |
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
- **Pass 3** — PERF-1 code-split (6 commits): entry 1650.6 → 966.5 kB (−41.4%),
  render-blocking CSS 322.7 → 268.3 kB, INITIAL gzip 515.8 → 427.5 kB (−17.1%).
  Found + fixed BUILD-1 (config shadow), REL-1 (no ErrorBoundary), PERF-3
  (no asset caching). A 26-agent adversarial pass then found six real defects the
  split had introduced (SPLIT-1…6) — all fixed; every one had kept the suite
  green. **PERF-2 attempted and only partly achieved**: the product decision
  landed (real empty state for new accounts) and App no longer imports the
  generator, but the boot-time generation still runs — three other eager modules
  keep `courseGenerator` in the entry chunk. Recorded honestly above rather than
  claimed. Next: either the 4-part structural gate in the PERF-2 detail, or the
  `styles.css` carve-up (~185 kB editor-only CSS) with a screenshot-diff pass.
- **Pass 4** — PERF-2's four-part structural gate completed: contact-hours model
  extracted to a leaf module, `aiGeneration`/`courseTransforms` moved off the
  eager path, all 14 editor tabs `React.lazy`'d, and the readiness/builder
  cluster followed them off the critical path. Boot-time course generation is
  **gone** (seed prompt 0× in the entry chunk). Cumulative vs the original
  baseline: entry −60.5%, INITIAL gzip −42.7%. Verified in the browser incl. a
  full no-AI course generation with no demo-topic leak. PERF-1 and PERF-2 now
  both closed; remaining perf work is the `styles.css` carve-up (~185 kB
  editor-only CSS) and the Lighthouse run, which needs BLK-1.
- **Pass 5** — First cut into `styles.css` itself. Rather than trusting the
  audit's ~185 kB line-range estimate, each candidate section's class names were
  checked against the components that reference them; five sections
  (Assignments, Discussions, Rubrics, Overview + Gradebook command centers,
  47.6 kB) proved to be referenced *only* by lazily-loaded tabs and moved to
  `src/styles.editor-tabs.css`. Five more (Pages, Quizzes, Export, Export
  command center, Contact hours) are **still referenced by eager code**
  (`App.tsx`'s inline components, `contentBlocks`, `RockContentToolbox`) and were
  deliberately left behind — moving them would need the inline-screen extraction
  first. Render-blocking CSS 268.3 → 231.2 kB (43.7 → 39.9 kB gz).
- **Pass 5** — Inline-screen extraction, with a real React test harness landed
  first (@testing-library; the repo previously had ZERO rendering tests, so all
  885 logic tests would have stayed green through a total UI break). App.tsx
  **4575 → 1993 lines (−56%)**: form primitives, ModulesTab/ThemeTab/
  ReadinessPanel, and Editor/Intake/Dashboard/BlueprintReview/Progress/
  WelcomeSummary all extracted and lazy-loaded (Landing stays eager). INITIAL
  **1023.8 kB raw / 276.6 kB gzip** — vs the 1971.8 / 515.8 baseline, that is
  **−48% raw, −46% gzip**. The harness paid for itself immediately, catching a
  test-isolation bug, a false-positive assertion, the synchronous-suspend defect
  (SPLIT-7) and a pre-existing SEO bug (SEO-1). 891 tests green.
- **Pass 6** — Second full production audit (`PROD_AUDIT.md`). **PASS, 0 P0 / 0 P1.**
  Security clean (no secrets, no tracked env, `.gitignore` complete, no RLS
  disables, **0 npm vulnerabilities** — the pass-2 advisory fixes have not
  regressed). Typecheck 0 errors, lint clean, build green with **zero warnings**
  (the old 1.69 MB chunk-size warning is gone), 891 tests passing. Found and
  fixed MAINT-2. Remaining local item is the `styles.css` carve-up; everything
  else is gated on BLK-1…BLK-6.

