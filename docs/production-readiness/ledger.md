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
| PERF-1 | P2 | Performance | `dist/assets/index-*.js` = 1.69 MB; `App.tsx` (~4.3k lines) imported eagerly; no route-level code-split | 🔜 Open |
| MAINT-1 | P3 | Maintainability | Build warns: `supabaseClient.ts` dynamically imported by `openaiClient.ts` but statically elsewhere → dynamic import ineffective | 🔜 Open |
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
