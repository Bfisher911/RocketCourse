-- ===========================================================================
-- RocketCourse — Richer Stripe discount records + a redemption history table.
--
-- Additive + idempotent. Extends discount_code_records (0005) with campaign
-- association, status lifecycle, plan/interval targeting, validity window,
-- per-customer limit, and notes. Adds discount_redemptions (a per-checkout
-- fact table) so the Super Admin can see who redeemed what. All writes are
-- service-role only (the super-admin function); RLS grants Super Admins read.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- discount_code_records: lifecycle + targeting + validity + notes
-- ---------------------------------------------------------------------------
alter table public.discount_code_records add column if not exists campaign_name text;
alter table public.discount_code_records add column if not exists status text not null default 'active';
alter table public.discount_code_records add column if not exists applies_to_plan text;        -- PlanKey or null = all plans
alter table public.discount_code_records add column if not exists applies_to_interval text;     -- month | year | one_time | all
alter table public.discount_code_records add column if not exists visibility text not null default 'public'; -- public | private | campaign
alter table public.discount_code_records add column if not exists starts_at timestamptz;
alter table public.discount_code_records add column if not exists per_customer_limit integer;
alter table public.discount_code_records add column if not exists duration_in_months integer;
alter table public.discount_code_records add column if not exists notes text;
alter table public.discount_code_records add column if not exists updated_at timestamptz not null default now();

alter table public.discount_code_records drop constraint if exists discount_records_status_check;
alter table public.discount_code_records add constraint discount_records_status_check
  check (status in ('draft', 'active', 'paused', 'expired', 'archived'));

alter table public.discount_code_records drop constraint if exists discount_records_visibility_check;
alter table public.discount_code_records add constraint discount_records_visibility_check
  check (visibility in ('public', 'private', 'campaign'));

create index if not exists idx_discount_records_status on public.discount_code_records (status);
create index if not exists idx_discount_records_campaign on public.discount_code_records (campaign_name);

drop trigger if exists trg_discount_records_updated_at on public.discount_code_records;
create trigger trg_discount_records_updated_at before update on public.discount_code_records
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- discount_redemptions: one row per checkout that applied a code (best-effort,
-- recorded by the webhook from the Checkout Session's applied discounts).
-- Unique on the checkout session id → idempotent under Stripe webhook retries.
-- ---------------------------------------------------------------------------
create table if not exists public.discount_redemptions (
  id uuid primary key default gen_random_uuid(),
  discount_record_id uuid references public.discount_code_records (id) on delete set null,
  stripe_promotion_code_id text,
  code text,
  user_id uuid references auth.users (id) on delete set null,
  stripe_customer_id text,
  stripe_checkout_session_id text unique,
  stripe_subscription_id text,
  amount_discounted_cents integer,
  currency text,
  redeemed_at timestamptz not null default now()
);
create index if not exists idx_discount_redemptions_record on public.discount_redemptions (discount_record_id);
create index if not exists idx_discount_redemptions_customer on public.discount_redemptions (stripe_customer_id);

alter table public.discount_redemptions enable row level security;
drop policy if exists discount_redemptions_super_read on public.discount_redemptions;
create policy discount_redemptions_super_read on public.discount_redemptions
  for select using (public.is_super_admin());
