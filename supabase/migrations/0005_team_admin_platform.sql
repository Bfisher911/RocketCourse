-- ===========================================================================
-- RocketCourse — Team workspaces, seats, super admin, usage credits, blog CMS,
-- discount records, and audit hardening.
--
-- Additive + idempotent. Extends the existing schema (0001) rather than
-- replacing it. Trusted writes (invites accept, seat sync, credits, blog,
-- discounts) go through server code (service role); RLS below is the
-- authoritative read/own-write guard. Client UI is advisory only.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- profiles: super-admin flag, avatar, default workspace
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists default_workspace_id uuid references public.workspaces (id) on delete set null;
alter table public.profiles add column if not exists is_super_admin boolean not null default false;
alter table public.profiles add column if not exists disabled_at timestamptz;

-- SECURITY DEFINER so RLS policies can call it without recursing into profiles' own RLS.
create or replace function public.is_super_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_super_admin = true
  );
$$;
revoke execute on function public.is_super_admin() from anon;

-- ---------------------------------------------------------------------------
-- workspaces: slug, stripe linkage, seats, status, created_by
-- ---------------------------------------------------------------------------
alter table public.workspaces add column if not exists slug text;
alter table public.workspaces add column if not exists stripe_customer_id text;
alter table public.workspaces add column if not exists stripe_subscription_id text;
alter table public.workspaces add column if not exists seat_limit integer not null default 1;
alter table public.workspaces add column if not exists status text not null default 'active';
alter table public.workspaces add column if not exists created_by uuid references auth.users (id) on delete set null;

update public.workspaces set created_by = owner_id where created_by is null;

alter table public.workspaces drop constraint if exists workspaces_status_check;
alter table public.workspaces add constraint workspaces_status_check
  check (status in ('active', 'past_due', 'canceled', 'paused', 'trialing'));

create unique index if not exists idx_workspaces_slug on public.workspaces (slug) where slug is not null;
create index if not exists idx_workspaces_owner on public.workspaces (owner_id);
create index if not exists idx_workspaces_stripe_sub on public.workspaces (stripe_subscription_id) where stripe_subscription_id is not null;

drop trigger if exists trg_workspaces_updated_at on public.workspaces;
create trigger trg_workspaces_updated_at before update on public.workspaces
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- workspace_members: membership status, timestamps, role enum
-- ---------------------------------------------------------------------------
alter table public.workspace_members add column if not exists status text not null default 'active';
alter table public.workspace_members add column if not exists joined_at timestamptz not null default now();
alter table public.workspace_members add column if not exists updated_at timestamptz not null default now();
alter table public.workspace_members add column if not exists last_active_at timestamptz;
alter table public.workspace_members add column if not exists invited_by uuid references auth.users (id) on delete set null;

alter table public.workspace_members drop constraint if exists workspace_members_role_check;
alter table public.workspace_members add constraint workspace_members_role_check
  check (role in ('owner', 'admin', 'editor', 'reviewer', 'member'));

alter table public.workspace_members drop constraint if exists workspace_members_status_check;
alter table public.workspace_members add constraint workspace_members_status_check
  check (status in ('active', 'invited', 'removed'));

drop trigger if exists trg_workspace_members_updated_at on public.workspace_members;
create trigger trg_workspace_members_updated_at before update on public.workspace_members
  for each row execute function public.set_updated_at();

-- Count active members of a workspace (the authoritative seat usage; never stored to avoid drift).
create or replace function public.workspace_seat_usage(ws uuid)
returns integer language sql security definer stable set search_path = public as $$
  select count(*)::int from public.workspace_members m
  where m.workspace_id = ws and m.status = 'active';
$$;
-- Not used by RLS and takes an arbitrary workspace id → keep it server-only (service role).
revoke execute on function public.workspace_seat_usage(uuid) from anon, authenticated, public;

-- True when the caller owns or is an admin of the workspace (manage seats/members/settings).
create or replace function public.is_workspace_admin(ws uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.workspaces w
    where w.id = ws and w.owner_id = auth.uid()
  ) or exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid()
      and m.role in ('owner', 'admin') and m.status = 'active'
  );
$$;
revoke execute on function public.is_workspace_admin(uuid) from anon;

-- ---------------------------------------------------------------------------
-- workspace_invites
-- ---------------------------------------------------------------------------
create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null,
  role text not null default 'member',
  token_hash text not null,
  status text not null default 'pending',          -- pending | accepted | revoked | expired
  expires_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  accepted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  constraint workspace_invites_role_check check (role in ('admin', 'editor', 'reviewer', 'member')),
  constraint workspace_invites_status_check check (status in ('pending', 'accepted', 'revoked', 'expired'))
);
create index if not exists idx_workspace_invites_ws on public.workspace_invites (workspace_id);
create index if not exists idx_workspace_invites_email on public.workspace_invites (lower(email));
create unique index if not exists idx_workspace_invites_token on public.workspace_invites (token_hash);
-- At most one live (pending) invite per email per workspace.
create unique index if not exists idx_workspace_invites_pending
  on public.workspace_invites (workspace_id, lower(email)) where status = 'pending';

-- ---------------------------------------------------------------------------
-- workspace_join_links
-- ---------------------------------------------------------------------------
create table if not exists public.workspace_join_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  token_hash text not null,
  default_role text not null default 'member',
  max_uses integer,
  used_count integer not null default 0,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint workspace_join_links_role_check check (default_role in ('editor', 'reviewer', 'member'))
);
create index if not exists idx_join_links_ws on public.workspace_join_links (workspace_id);
create unique index if not exists idx_join_links_token on public.workspace_join_links (token_hash);

-- ---------------------------------------------------------------------------
-- usage_adjustments  (credit ledger — feeds entitlement; never rewrites usage)
-- ---------------------------------------------------------------------------
create table if not exists public.usage_adjustments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  adjustment_type text not null,                     -- export_credit | ai_credit
  amount integer not null,
  reason text not null,
  created_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint usage_adjustments_type_check check (adjustment_type in ('export_credit', 'ai_credit')),
  constraint usage_adjustments_target_check check (workspace_id is not null or user_id is not null)
);
create index if not exists idx_usage_adjustments_user on public.usage_adjustments (user_id);
create index if not exists idx_usage_adjustments_ws on public.usage_adjustments (workspace_id);

-- Sum of currently-valid (non-expired) credits of a kind for a user (and their workspaces).
create or replace function public.active_credit_balance(p_user_id uuid, p_kind text)
returns integer language sql security definer stable set search_path = public as $$
  select coalesce(sum(a.amount), 0)::int
  from public.usage_adjustments a
  where a.adjustment_type = p_kind
    and (a.expires_at is null or a.expires_at > now())
    and (
      a.user_id = p_user_id
      or a.workspace_id in (
        select m.workspace_id from public.workspace_members m
        where m.user_id = p_user_id and m.status = 'active'
        union
        select w.id from public.workspaces w where w.owner_id = p_user_id
      )
    );
$$;
-- Not used by RLS and takes an arbitrary user id → keep it server-only (service role).
revoke execute on function public.active_credit_balance(uuid, text) from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- blog_posts
-- ---------------------------------------------------------------------------
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text not null default '',
  content_markdown text not null default '',
  cover_image_url text,
  status text not null default 'draft',              -- draft | scheduled | published | archived
  seo_title text,
  seo_description text,
  author_user_id uuid references auth.users (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blog_posts_status_check check (status in ('draft', 'scheduled', 'published', 'archived'))
);
create index if not exists idx_blog_posts_status on public.blog_posts (status);
create index if not exists idx_blog_posts_published on public.blog_posts (published_at desc) where status = 'published';

drop trigger if exists trg_blog_posts_updated_at on public.blog_posts;
create trigger trg_blog_posts_updated_at before update on public.blog_posts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- discount_code_records  (local mirror of Stripe coupons/promo codes)
-- ---------------------------------------------------------------------------
create table if not exists public.discount_code_records (
  id uuid primary key default gen_random_uuid(),
  stripe_coupon_id text,
  stripe_promotion_code_id text,
  code text,
  name text,
  percent_off numeric,
  amount_off integer,
  currency text,
  duration text,
  max_redemptions integer,
  times_redeemed integer not null default 0,
  expires_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_discount_records_active on public.discount_code_records (active);

-- ---------------------------------------------------------------------------
-- audit_events: actor email + request context (best-effort, server-written)
-- ---------------------------------------------------------------------------
alter table public.audit_events add column if not exists actor_email text;
alter table public.audit_events add column if not exists ip_address text;
alter table public.audit_events add column if not exists user_agent text;
create index if not exists idx_audit_events_ws on public.audit_events (workspace_id);
create index if not exists idx_audit_events_created on public.audit_events (created_at desc);

-- ===========================================================================
-- Row Level Security for new tables
-- ===========================================================================
alter table public.workspace_invites      enable row level security;
alter table public.workspace_join_links   enable row level security;
alter table public.usage_adjustments       enable row level security;
alter table public.blog_posts              enable row level security;
alter table public.discount_code_records   enable row level security;

-- workspace_invites: workspace admins (or super admin) manage their workspace's invites.
-- Acceptance by the invitee is performed by server code (service role) which bypasses RLS.
drop policy if exists invites_admin_read on public.workspace_invites;
create policy invites_admin_read on public.workspace_invites
  for select using (public.is_workspace_admin(workspace_id) or public.is_super_admin());
drop policy if exists invites_admin_manage on public.workspace_invites;
create policy invites_admin_manage on public.workspace_invites
  for all using (public.is_workspace_admin(workspace_id) or public.is_super_admin())
  with check (public.is_workspace_admin(workspace_id) or public.is_super_admin());

-- workspace_join_links: same admin-scoped management.
drop policy if exists join_links_admin_read on public.workspace_join_links;
create policy join_links_admin_read on public.workspace_join_links
  for select using (public.is_workspace_admin(workspace_id) or public.is_super_admin());
drop policy if exists join_links_admin_manage on public.workspace_join_links;
create policy join_links_admin_manage on public.workspace_join_links
  for all using (public.is_workspace_admin(workspace_id) or public.is_super_admin())
  with check (public.is_workspace_admin(workspace_id) or public.is_super_admin());

-- usage_adjustments: readable by the affected user, their workspace admins, and super admins.
-- Writes are service-role only (super admin grants flow through a server function).
drop policy if exists usage_adjustments_read on public.usage_adjustments;
create policy usage_adjustments_read on public.usage_adjustments
  for select using (
    user_id = auth.uid()
    or (workspace_id is not null and public.is_workspace_admin(workspace_id))
    or public.is_super_admin()
  );

-- blog_posts: world-readable when published (and past publish time); super admins read all.
-- Writes are service-role only (the Blog Manager calls a server function that validates + audits).
drop policy if exists blog_posts_public_read on public.blog_posts;
create policy blog_posts_public_read on public.blog_posts
  for select using (
    (status = 'published' and (published_at is null or published_at <= now()))
    or public.is_super_admin()
  );

-- discount_code_records: super admin only.
drop policy if exists discount_records_super_read on public.discount_code_records;
create policy discount_records_super_read on public.discount_code_records
  for select using (public.is_super_admin());

-- ===========================================================================
-- Super-admin override SELECT policies on existing tables (global read access).
-- Additive permissive policies — they only broaden read for super admins.
-- ===========================================================================
drop policy if exists profiles_super_read on public.profiles;
create policy profiles_super_read on public.profiles for select using (public.is_super_admin());

drop policy if exists workspaces_super_read on public.workspaces;
create policy workspaces_super_read on public.workspaces for select using (public.is_super_admin());

drop policy if exists members_super_read on public.workspace_members;
create policy members_super_read on public.workspace_members for select using (public.is_super_admin());

drop policy if exists subscriptions_super_read on public.subscriptions;
create policy subscriptions_super_read on public.subscriptions for select using (public.is_super_admin());

drop policy if exists stripe_customers_super_read on public.stripe_customers;
create policy stripe_customers_super_read on public.stripe_customers for select using (public.is_super_admin());

drop policy if exists course_projects_super_read on public.course_projects;
create policy course_projects_super_read on public.course_projects for select using (public.is_super_admin());

drop policy if exists usage_events_super_read on public.usage_events;
create policy usage_events_super_read on public.usage_events for select using (public.is_super_admin());

drop policy if exists ai_jobs_super_read on public.ai_generation_jobs;
create policy ai_jobs_super_read on public.ai_generation_jobs for select using (public.is_super_admin());

drop policy if exists audit_events_super_read on public.audit_events;
create policy audit_events_super_read on public.audit_events for select using (public.is_super_admin());

-- ===========================================================================
-- Super-admin provisioning
-- ===========================================================================
-- Idempotent grant/revoke helpers (callable by service role / SQL editor only).
create or replace function public.grant_super_admin(p_email text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set is_super_admin = true, updated_at = now()
  where lower(email) = lower(p_email);
end;
$$;
revoke execute on function public.grant_super_admin(text) from anon, authenticated, public;

create or replace function public.revoke_super_admin(p_email text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set is_super_admin = false, updated_at = now()
  where lower(email) = lower(p_email);
end;
$$;
revoke execute on function public.revoke_super_admin(text) from anon, authenticated, public;

-- Bootstrap the initial Super Admin. Idempotent: re-running is a no-op if already set.
-- To add/remove super admins later: select public.grant_super_admin('person@example.com');
select public.grant_super_admin('bfisher3@tulane.edu');
