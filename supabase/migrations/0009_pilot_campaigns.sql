-- ===========================================================================
-- RocketCourse — Pilot campaigns + waitlist.
--
-- Additive + idempotent. Campaigns are created by Super Admins and render on the
-- public marketing site by placement. Signups are captured through a server
-- function (service role) that enforces the max-signup cap and waitlist switch
-- SERVER-SIDE — never trust a client count. Campaigns may link a Stripe-backed
-- discount (discount_code_records) to issue a limited offer (e.g. "first 50").
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- campaigns
-- ---------------------------------------------------------------------------
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,                                  -- internal campaign name
  slug text unique,                                    -- public/UTM reference
  type text not null default 'waitlist',               -- semester_pilot | limited_discount | waitlist | private_invite
  headline text,
  description text,
  cta_text text not null default 'Request access',
  status text not null default 'draft',                -- draft | active | paused | ended | archived
  placement text not null default 'homepage_banner',   -- homepage_hero | homepage_banner | pricing_page | modal | footer
  starts_at timestamptz,
  ends_at timestamptz,
  max_signups integer,                                 -- null = unlimited
  when_full text not null default 'waitlist',          -- waitlist | closed
  require_approval boolean not null default false,
  discount_record_id uuid references public.discount_code_records (id) on delete set null,
  plan_key text,
  webinar_url text,
  tutorial_at timestamptz,
  audience_label text,
  confirmation_message text,
  followup_email text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaigns_type_check check (type in ('semester_pilot', 'limited_discount', 'waitlist', 'private_invite')),
  constraint campaigns_status_check check (status in ('draft', 'active', 'paused', 'ended', 'archived')),
  constraint campaigns_placement_check check (placement in ('homepage_hero', 'homepage_banner', 'pricing_page', 'modal', 'footer')),
  constraint campaigns_when_full_check check (when_full in ('waitlist', 'closed'))
);
create index if not exists idx_campaigns_status on public.campaigns (status);
create index if not exists idx_campaigns_placement on public.campaigns (placement);

drop trigger if exists trg_campaigns_updated_at on public.campaigns;
create trigger trg_campaigns_updated_at before update on public.campaigns
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- campaign_signups  (one per email per campaign; server-written)
-- ---------------------------------------------------------------------------
create table if not exists public.campaign_signups (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  name text,
  email text not null,
  institution text,
  role text,
  notes text,
  status text not null default 'pending',              -- pending | approved | rejected | waitlisted | converted
  is_waitlisted boolean not null default false,
  referral_source text,
  utm jsonb not null default '{}'::jsonb,
  discount_code text,                                  -- code issued/reserved at signup
  user_id uuid references auth.users (id) on delete set null,
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  constraint campaign_signups_status_check check (status in ('pending', 'approved', 'rejected', 'waitlisted', 'converted'))
);
create unique index if not exists idx_campaign_signups_unique on public.campaign_signups (campaign_id, lower(email));
create index if not exists idx_campaign_signups_campaign on public.campaign_signups (campaign_id);
create index if not exists idx_campaign_signups_status on public.campaign_signups (status);

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.campaigns         enable row level security;
alter table public.campaign_signups  enable row level security;

-- campaigns: the public site reads ACTIVE, in-window campaigns (anon + authed).
-- Super Admins read everything. Writes are service-role only (super-admin function).
drop policy if exists campaigns_public_read on public.campaigns;
create policy campaigns_public_read on public.campaigns
  for select using (
    (status = 'active'
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at >= now()))
    or public.is_super_admin()
  );

-- campaign_signups: Super Admin read only (PII). Inserts go through the server function
-- (service role bypasses RLS); no public read.
drop policy if exists campaign_signups_super_read on public.campaign_signups;
create policy campaign_signups_super_read on public.campaign_signups
  for select using (public.is_super_admin());

-- Public, PII-free signup count for a LIVE campaign (drives "X spots left" on the marketing site).
-- Returns 0 for any campaign that is not currently live, so it can't be used to probe drafts.
create or replace function public.campaign_signup_count(p_campaign uuid)
returns integer language sql security definer stable set search_path = public as $$
  select case
    when exists (
      select 1 from public.campaigns c
      where c.id = p_campaign and c.status = 'active'
        and (c.starts_at is null or c.starts_at <= now())
        and (c.ends_at is null or c.ends_at >= now())
    )
    then (select count(*)::int from public.campaign_signups s where s.campaign_id = p_campaign and s.status <> 'rejected')
    else 0
  end;
$$;
grant execute on function public.campaign_signup_count(uuid) to anon, authenticated;
