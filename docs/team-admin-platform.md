# RocketCourse — Team, Seats, Super Admin & Blog Platform

This document describes the team/workspace + admin + blog system added on top of the existing
RocketCourse architecture (Vite/React SPA + Netlify Functions + Supabase + Stripe). It extends the
existing entitlement/auth/billing spine — it does **not** introduce a second billing or auth system.

## 1. What was built

| Area | Implementation |
| --- | --- |
| Roles & workspace model | `profiles.is_super_admin`, `workspaces` (slug, seats, status, stripe ids), `workspace_members` (status, roles), invites, join links, usage-credit ledger, blog posts, discount records — all RLS-secured |
| Team purchase → workspace | Stripe webhook creates the workspace + owner ("Launchpad Admin") on team-plan activation |
| Seat management (server-enforced) | invite / join-link / accept / remove / role-change, with seat limits + last-admin protection enforced in Netlify Functions |
| Workspace Admin (Launchpad) UI | seats, members, invites, join links, analytics, activity log |
| Super Admin (Mission Control) UI | global overview, workspace/user directories, usage & cost, discount codes, blog manager, audit log, read-only audited impersonation |
| Public blog | SEO blog index (`/blog`) + post pages (`/blog/<slug>`), safe Markdown rendering |
| Security | RLS on every table, server-side role guards on every privileged action, audit logging |

## 2. Files changed / added

**Database migrations** (`supabase/migrations/`)
- `0003_harden_function_security.sql`, `0004_course_projects_app_id.sql` — repo mirrors of two migrations already applied to the hosted project.
- `0005_team_admin_platform.sql` — the foundation: profile super-admin flag + avatar + default workspace; workspace slug/seats/status/stripe linkage; member status/roles; `workspace_invites`, `workspace_join_links`, `usage_adjustments`, `blog_posts`, `discount_code_records`; `is_super_admin()`, `is_workspace_admin()`, `workspace_seat_usage()`, `active_credit_balance()`; RLS for new tables + super-admin read overrides; `grant_super_admin()`/`revoke_super_admin()` + bootstrap of `bfisher3@tulane.edu`.
- `0006_workspace_subscription_reads.sql` — lets active members read the shared team subscription.
- (live only) `harden_credit_functions` — revokes RPC EXECUTE on the two helpers that take arbitrary ids.

**Server (Netlify Functions)** — `netlify/functions/`
- `_shared/guards.ts` — `requireSuperAdmin`, `requireWorkspaceAdmin`, `requireWorkspaceMember`, `isSuperAdmin`, `getWorkspaceRole`, `createAuditLog`, `requestContext`.
- `_shared/workspaceEntitlement.ts` — workspace-aware effective subscription + credit folding.
- `_shared/workspaceSync.ts` — `ensureWorkspaceForSubscription` (webhook → workspace).
- `_shared/tokens.ts` — secure invite/join token generation + SHA-256 hashing.
- `_shared/serverEntitlement.ts`, `_shared/userEntitlement.ts` — now workspace + credit aware.
- `workspace-manage.ts` — admin write actions (invite/resend/revoke/join-link/remove/role).
- `workspace-join.ts` — accept invite / join link (seat-enforced).
- `workspace-data.ts` — admin dashboard payload (members + analytics).
- `super-admin.ts` — grant credits, disable user, impersonation audit, Stripe discounts.
- `blog-manage.ts` — blog CRUD.
- `stripe-webhook.ts`, `create-checkout-session.ts` — extended (workspace sync + workspace name).
- `ws.d.ts`, `tsconfig.functions.json` — functions typecheck gate (`npm run typecheck`).

**Client** — `src/`
- `data/platform.ts` — super-admin bootstrap email (centralized) + model pricing for cost estimates.
- `services/workspaceRoles.ts` (+ test) — pure role/seat logic.
- `services/platformClient.ts` — RLS reads + function calls.
- `services/blogClient.ts`, `services/usePlatformAccess.ts`, `utils/markdown.ts`.
- `services/entitlement.ts` (+ test) — additive credits.
- `components/blog/PublicBlog.tsx`, `components/admin/{JoinScreen,WorkspaceAdminScreen,SuperAdminScreen,BlogManager}.tsx`.
- `App.tsx`, `types.ts`, `seo.ts`, `seo-routes.json`, `main.tsx`, `platform.css` — routes, nav gating, screens.

## 3. New routes / screens

| Path | Screen | Access |
| --- | --- | --- |
| `/blog` | Public blog index | Public (indexable) |
| `/blog/<slug>` | Blog post | Public |
| `/join?invite=…` / `/join?link=…` | Accept invite / join link | Signed-in |
| `/workspace` | Workspace Launchpad (admin) | Workspace owner/admin |
| `/admin` | Super Admin Mission Control | Super Admin only (server-enforced) |

## 4. Environment variables (set in Netlify, not committed)

Already used by the existing build; the new functions reuse them:
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` (or `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`)
- `STRIPE_SECRET_KEY` (use `sk_test_…` for testing discounts), `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_TEAM` (+ other plan price ids)
- `APP_URL` — used to build invite/join links.

No new secrets are required. Service role and Stripe keys remain server-only.

## 5. How the team-plan workflow works

1. A user buys the **Team** plan via the existing Stripe Checkout (optionally passing a workspace name).
2. `customer.subscription.created/updated` → `stripe-webhook.ts` upserts the subscription **and** calls `ensureWorkspaceForSubscription`, which:
   - creates a workspace (unique slug, `seat_limit` from the plan / Stripe quantity), links the Stripe customer + subscription, sets status from the subscription;
   - makes the purchaser the **owner** + an active `owner` membership (the Workspace Launchpad Admin);
   - links the subscription to the workspace and writes a `workspace_created` audit event.
3. The purchaser sees the **Launchpad** tab and uses RocketCourse normally as a creator.

## 6. How seat management works

- Seat usage = **active** members only; pending invites do **not** consume a seat (`workspaceRoles.ts`, unit-tested).
- Invites/join links use a 256-bit random token; only its SHA-256 hash is stored.
- Acceptance (`workspace-join.ts`) re-checks seats **server-side**: a new member is blocked when the workspace is at `seat_limit`; an existing member re-accepting is allowed.
- Removing/demoting the **last** owner/admin is refused (`wouldOrphanWorkspace`). The workspace owner can't be removed/demoted via the panel.
- Increasing seats: the Team plan is a flat 5-seat plan, so "Manage billing" opens the existing Stripe Customer Portal; per-seat metered billing is a documented backlog item (set `STRIPE_PRICE_TEAM` to a per-seat price and pass `quantity` to enable it).

## 7. How Super Admin access is provisioned

- Stored as `profiles.is_super_admin = true`, set by `public.grant_super_admin('bfisher3@tulane.edu')` in migration `0005` (idempotent). The bootstrap email is also centralized in `src/data/platform.ts`.
- To add/remove super admins later, run in the Supabase SQL editor:
  ```sql
  select public.grant_super_admin('person@example.com');
  select public.revoke_super_admin('person@example.com');
  ```
- Every privileged Super-Admin action re-checks `is_super_admin` server-side (`requireSuperAdmin`) and writes an audit event.

## 8. How to test `bfisher3@tulane.edu` as Super Admin

1. Sign in to the deployed app as `bfisher3@tulane.edu`.
2. The top nav shows a **Super Admin** tab (it is hidden for everyone else; visiting `/admin` directly shows "Not authorized" and the server returns 403).
3. Mission Control loads the global overview, workspace + user directories, usage & cost, discounts, blog manager, and the audit log.

## 9. How to create and publish a blog post

1. Super Admin → **Super Admin → Blog → New post**.
2. Fill in title (slug auto-generates), excerpt, Markdown content, optional cover image URL, SEO title/description.
3. **Save draft** (not public) or **Publish** (visible at `/blog` and `/blog/<slug>`). Scheduled posts publish at their `published_at`.
4. Markdown is rendered through a safe renderer (`src/utils/markdown.ts`) — no author HTML/script survives.

## 10. QA status

**Verified locally**
- `npm run typecheck` (app `tsc -b` **and** `tsconfig.functions.json`) — passes.
- `npm test` — 387 tests pass (incl. new seat/role + credit tests).
- `npm run build` — passes (18 prerendered routes + sitemap).
- Migrations `0005`/`0006` applied to the hosted Supabase; `bfisher3@tulane.edu` confirmed `is_super_admin = true`; Supabase security advisors clean for the new objects.
- Browser smoke (vite dev): no console errors; **Blog** nav + public blog render; nav correctly **hides** Launchpad/Super Admin for a non-admin user; `/admin` shows "Not authorized" for a non-super-admin.

**Requires the deployed environment (Netlify Functions + live Stripe) to exercise end-to-end**
- `vite dev` does not serve Netlify Functions, so function-backed writes (invite/credits/discount/blog-save) and `workspace-data` were validated by typecheck + unit tests, not browser-clicked. Run `netlify dev` or deploy to click them through.
- A real Team purchase → webhook → workspace creation needs live Stripe + the webhook endpoint configured.
- Positive Super-Admin UI smoke needs the `bfisher3@tulane.edu` session (granting super-admin to another account was intentionally not done).

## 11. Remaining limitations / manual steps

- **Deploy** to make the new Netlify Functions live (`git push` → Netlify).
- **Stripe**: confirm the Team price id (`STRIPE_PRICE_TEAM`) and that the webhook endpoint forwards `customer.subscription.*`. Discount-code creation requires `STRIPE_SECRET_KEY`.
- **Email**: no email provider is wired, so invites surface a copyable link in the UI (clearly labeled). Add a provider + send-invite call in `workspace-manage.ts` when ready.
- **Per-seat billing** for larger teams (currently flat 5 seats + Customer Portal).
- **Per-post blog prerendering** for maximal SEO (posts render client-side today with client-set `<title>`/meta; the index `/blog` is prerendered).
- **Write-impersonation** is intentionally read-only "view as" (audited) for safety.
