# Production Readiness Audit

**Project:** Node (npm) · TypeScript + Vite SPA + Netlify functions · Node 20 target (local 25)
**Date:** 2026-07-24
**Result:** ✅ **PASS** — 0 P0 issues remaining (2 high-severity dependency advisories found and **fixed** during this audit)

## Summary

| Category | Status | Issues |
|---|---|---|
| Security | ✅ | 0 P0, 0 P1 (2 P1 dep advisories fixed), 1 P2 fixed |
| Type safety | ✅ | 0 errors (`tsc -b` + functions project) |
| Lint | ✅ | 0 errors, 0 warnings |
| Build | ✅ | passes; prerenders 19 routes + sitemap (1 non-blocking bundle-size warning) |

Test suite (out of scope for the audit skill, run anyway): **870 passed / 98 files**.

## P0 (blocking)

None.

## P1 (should fix before next release)

All P1s found were dependency advisories and were **fixed in this pass** (`npm audit` now reports **0 vulnerabilities**):

### `fast-xml-parser` high advisory — FIXED
- **What:** GHSA-8r6m-32jq-jx6q — repeated DOCTYPE declarations reset entity-expansion limits (entity-expansion DoS).
- **Where:** direct dependency; used in `src/services/xmlWellFormed.ts` (`XMLValidator.validate`) on the IMSCC export/validate path.
- **Why it mattered:** XML validation is exactly where a malicious/oversized entity payload would land.
- **Fix applied:** `npm audit fix` → `fast-xml-parser@5.9.3` → `5.10.1` (non-breaking).

### `sharp` / libvips high advisories — FIXED
- **What:** GHSA-f88m-g3jw-g9cj — CVE-2026-33327/33328/35590/35591, malicious-image handling in bundled libvips.
- **Where:** `netlify/functions/image-assets.ts` and `image-generate.ts` process external image bytes with `sharp(...)` (`failOn: "error"` already set).
- **Why it mattered:** `image-assets.ts` can process externally-sourced image bytes.
- **Fix applied:** `sharp@0.34.5` → `0.35.3` (major bump). Verified: functions typecheck clean; only stable APIs used (`.rotate/.resize/.metadata/.jpeg/.toBuffer`); lockfile still carries `@img/sharp-linux-x64` + `@img/sharp-linuxmusl-x64` for the Netlify build.

## P2 (cleanup)

### `.gitignore` missing key/cert patterns — FIXED
- **What:** `.gitignore` lacked `*.pem`, `*.key`, `id_rsa` (nothing was leaking — no such files tracked).
- **Fix applied:** appended a "Keys and certificates" section.

## Notes

**Security checks that passed clean (no action needed):**
- No leaked secrets in tracked code (AWS/Stripe-live/private-key/JWT/generic-assignment patterns all clear).
- No tracked `.env` files (`.env.example` only).
- Supabase migrations: no `disable row level security`. The one `for select using (true)` policy is the **intentional** world-readable `plans` pricing catalog (no client writes).
- Stripe webhook (`netlify/functions/stripe-webhook.ts`) verifies the `stripe-signature` via `constructEventAsync` with `STRIPE_WEBHOOK_SECRET`, 400s on a missing signature, 503s when unconfigured, and is idempotent (`stripe_events` table, migration 0007). Entitlement is read-only from trusted server state.
- 13 Netlify functions reference auth/authorization.

**Non-blocking / tracked elsewhere:**
- Build warns the main JS chunk is 1.69 MB (gzip 478 kB) — perf item **PERF-1** in `docs/production-readiness/ledger.md` (route/vendor code-split). Non-blocking for correctness.
- An "ineffective dynamic import" warning for `supabaseClient` — **MAINT-1** in the ledger.

**Out of scope for this audit (per skill):** runtime/deploy config (env vars on the deploy target, DNS, TLS), the test suite, and real Canvas import verification. Deploy-dependent gates (Netlify preview, live AI, Supabase RLS execution, Stripe test-mode, Lighthouse, Canvas import) are tracked as external blockers BLK-1…BLK-6 in the production-readiness ledger.

**Verdict:** the tree is safe to build and deploy to a **preview** from a code-security standpoint — no P0/P1 open. Production sign-off still depends on the external-blocker verifications in the ledger.
