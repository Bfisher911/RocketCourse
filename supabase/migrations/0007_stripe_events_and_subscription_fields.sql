-- ===========================================================================
-- RocketCourse — Stripe webhook idempotency + event audit log, and richer
-- subscription billing fields (seats, trial window, cancellation, interval).
--
-- Additive + idempotent. Extends 0001/0005. The webhook (service role) is the
-- only writer of stripe_events and subscription rows; RLS below grants Super
-- Admins read access for the admin billing view. Apply BEFORE deploying the
-- updated stripe-webhook function (it writes these new columns).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- stripe_events — every verified webhook event, for idempotency + audit/replay.
-- The webhook claims an event by upserting status='processing', skips events
-- already 'processed' (dedup on Stripe's at-least-once retries), and records
-- the full payload so billing issues can be reproduced.
-- ---------------------------------------------------------------------------
create table if not exists public.stripe_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,            -- Stripe's evt_… id (idempotency key)
  type text,                                 -- e.g. customer.subscription.updated
  status text not null default 'processing', -- received | processing | processed | error
  payload jsonb,
  error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint stripe_events_status_check check (status in ('received', 'processing', 'processed', 'error'))
);
create index if not exists idx_stripe_events_type on public.stripe_events (type);
create index if not exists idx_stripe_events_status on public.stripe_events (status);
create index if not exists idx_stripe_events_created on public.stripe_events (created_at desc);

alter table public.stripe_events enable row level security;
-- Super admins can read the event log (admin billing/debug view). Writes are service-role only.
drop policy if exists stripe_events_super_read on public.stripe_events;
create policy stripe_events_super_read on public.stripe_events
  for select using (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- subscriptions — persist seat count, trial window, cancellation time, interval.
-- These are synced ONLY from trusted Stripe webhooks (never the client).
-- ---------------------------------------------------------------------------
alter table public.subscriptions add column if not exists seats integer;
alter table public.subscriptions add column if not exists trial_start timestamptz;
alter table public.subscriptions add column if not exists trial_end timestamptz;
alter table public.subscriptions add column if not exists canceled_at timestamptz;
alter table public.subscriptions add column if not exists billing_interval text;
