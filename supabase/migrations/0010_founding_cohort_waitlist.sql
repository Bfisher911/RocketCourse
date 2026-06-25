-- ===========================================================================
-- RocketCourse — Founding Cohort waitlist + referral funnel.
--
-- Additive + idempotent. Extends the existing campaign spine (0009) rather than
-- duplicating it:
--   * campaign_signups gains the richer waitlist fields (names, course area,
--     use case, pain point, webinar seat, email consent, discrete UTM columns,
--     landing path, the personal referral code assigned at signup, the referral
--     code that referred them, an assigned Stripe promo code, plus a CRM-style
--     pipeline stage + admin notes for the Super Admin console).
--   * campaigns gains marketing-offer, webinar, and referral-reward config so a
--     dedicated landing page (e.g. /founding-cohort) can render everything from
--     data and the Super Admin can edit it — nothing is hard-coded forever.
--   * Two NEW tables — referral_codes + referral_events — own the referral graph.
--
-- All writes go through the service-role server functions. RLS grants Super
-- Admins read on the PII tables; the public never reads signups or referrals.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- campaign_signups — richer waitlist fields
-- ---------------------------------------------------------------------------
alter table public.campaign_signups add column if not exists first_name text;
alter table public.campaign_signups add column if not exists last_name text;
alter table public.campaign_signups add column if not exists course_area text;
alter table public.campaign_signups add column if not exists primary_use_case text;
alter table public.campaign_signups add column if not exists pain_point text;
alter table public.campaign_signups add column if not exists wants_webinar_seat boolean not null default false;
alter table public.campaign_signups add column if not exists consent_to_email boolean not null default false;
alter table public.campaign_signups add column if not exists referral_code_used text;
alter table public.campaign_signups add column if not exists assigned_referral_code text;
alter table public.campaign_signups add column if not exists assigned_stripe_promo_code text;
alter table public.campaign_signups add column if not exists utm_source text;
alter table public.campaign_signups add column if not exists utm_medium text;
alter table public.campaign_signups add column if not exists utm_campaign text;
alter table public.campaign_signups add column if not exists utm_content text;
alter table public.campaign_signups add column if not exists utm_term text;
alter table public.campaign_signups add column if not exists landing_page_path text;
-- CRM-style pipeline stage the Super Admin manages, kept distinct from the
-- server-enforced lifecycle `status` (pending/approved/rejected/waitlisted/converted).
alter table public.campaign_signups add column if not exists pipeline_stage text not null default 'new';
alter table public.campaign_signups add column if not exists admin_notes text;
alter table public.campaign_signups add column if not exists updated_at timestamptz not null default now();

alter table public.campaign_signups drop constraint if exists campaign_signups_pipeline_stage_check;
alter table public.campaign_signups add constraint campaign_signups_pipeline_stage_check
  check (pipeline_stage in ('new', 'contacted', 'invited', 'converted', 'not_fit'));

-- The personal referral code is unique across signups (when present) so a code
-- resolves to exactly one referrer.
create unique index if not exists idx_campaign_signups_assigned_ref
  on public.campaign_signups (assigned_referral_code)
  where assigned_referral_code is not null;
create index if not exists idx_campaign_signups_webinar
  on public.campaign_signups (campaign_id) where wants_webinar_seat;

drop trigger if exists trg_campaign_signups_updated_at on public.campaign_signups;
create trigger trg_campaign_signups_updated_at before update on public.campaign_signups
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- campaigns — marketing offer + webinar + referral-reward config
-- ---------------------------------------------------------------------------
alter table public.campaigns add column if not exists subheadline text;
alter table public.campaigns add column if not exists offer_summary text;
alter table public.campaigns add column if not exists discount_percent integer;
alter table public.campaigns add column if not exists discount_duration text;            -- once | repeating | forever
alter table public.campaigns add column if not exists discount_duration_months integer;  -- when repeating
alter table public.campaigns add column if not exists annual_discount_percent integer;
alter table public.campaigns add column if not exists stripe_coupon_id text;             -- mirror; canonical lives in discount_code_records
alter table public.campaigns add column if not exists stripe_promotion_code_id text;
alter table public.campaigns add column if not exists webinar_title text;
alter table public.campaigns add column if not exists webinar_description text;
alter table public.campaigns add column if not exists webinar_at timestamptz;
alter table public.campaigns add column if not exists webinar_capacity integer;
alter table public.campaigns add column if not exists webinar_rsvp_status text not null default 'open';  -- open | closed | full
alter table public.campaigns add column if not exists referral_reward_summary text;
alter table public.campaigns add column if not exists referral_threshold integer;                 -- invites needed
alter table public.campaigns add column if not exists referral_reward_months integer;             -- free months for the referrer
alter table public.campaigns add column if not exists referral_referred_discount_percent integer; -- extra discount for the referred

alter table public.campaigns drop constraint if exists campaigns_webinar_rsvp_check;
alter table public.campaigns add constraint campaigns_webinar_rsvp_check
  check (webinar_rsvp_status in ('open', 'closed', 'full'));

alter table public.campaigns drop constraint if exists campaigns_discount_duration_check;
alter table public.campaigns add constraint campaigns_discount_duration_check
  check (discount_duration is null or discount_duration in ('once', 'repeating', 'forever'));

-- ---------------------------------------------------------------------------
-- referral_codes — one personal code per signup (canonical referral store)
-- ---------------------------------------------------------------------------
create table if not exists public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  signup_id uuid references public.campaign_signups (id) on delete set null,
  email text not null,                                 -- owner email (lowercased)
  uses_count integer not null default 0,               -- referred signups attributed to this code
  reward_threshold integer,                            -- invites needed to earn the referrer reward (snapshot of campaign config)
  reward_status text not null default 'pending',       -- pending | earned | granted | disqualified
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint referral_codes_reward_status_check check (reward_status in ('pending', 'earned', 'granted', 'disqualified'))
);
create index if not exists idx_referral_codes_campaign on public.referral_codes (campaign_id);
create index if not exists idx_referral_codes_email on public.referral_codes (lower(email));

drop trigger if exists trg_referral_codes_updated_at on public.referral_codes;
create trigger trg_referral_codes_updated_at before update on public.referral_codes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- referral_events — the referral graph (one row per attributed referral)
-- ---------------------------------------------------------------------------
create table if not exists public.referral_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  referral_code_id uuid references public.referral_codes (id) on delete set null,
  code text,                                           -- denormalized for resilience
  referrer_signup_id uuid references public.campaign_signups (id) on delete set null,
  referred_signup_id uuid references public.campaign_signups (id) on delete set null,
  referred_email text,
  status text not null default 'signed_up',            -- pending_signup | signed_up | paid | rewarded | disqualified
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint referral_events_status_check check (status in ('pending_signup', 'signed_up', 'paid', 'rewarded', 'disqualified'))
);
-- A given referred email counts at most once per code (idempotent attribution).
create unique index if not exists idx_referral_events_unique
  on public.referral_events (referral_code_id, lower(referred_email))
  where referral_code_id is not null and referred_email is not null;
create index if not exists idx_referral_events_campaign on public.referral_events (campaign_id);
create index if not exists idx_referral_events_referrer on public.referral_events (referrer_signup_id);
create index if not exists idx_referral_events_status on public.referral_events (status);

drop trigger if exists trg_referral_events_updated_at on public.referral_events;
create trigger trg_referral_events_updated_at before update on public.referral_events
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- Row Level Security — Super Admin read only; all writes are service-role.
-- ===========================================================================
alter table public.referral_codes  enable row level security;
alter table public.referral_events enable row level security;

drop policy if exists referral_codes_super_read on public.referral_codes;
create policy referral_codes_super_read on public.referral_codes
  for select using (public.is_super_admin());

drop policy if exists referral_events_super_read on public.referral_events;
create policy referral_events_super_read on public.referral_events
  for select using (public.is_super_admin());
