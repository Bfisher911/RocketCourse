-- RocketCourse private course imagery + Premium image-credit accounting.
-- Additive, idempotent, and safe for projects created before imagery existed.

alter table public.plans add column if not exists image_credits_limit integer not null default 0;
alter table public.subscriptions add column if not exists image_credits_limit integer;
alter table public.subscriptions add column if not exists image_credits_used integer not null default 0;

insert into public.plans (
  key, name, billing_interval, checkout_mode, price_cents, entitlement_months,
  exports_limit, ai_generations_limit, image_credits_limit, seats_limit, projects_limit,
  capabilities, features, active, sort_order
) values (
  'rocketcourse_premium', 'RocketCourse Premium', 'month', 'subscription', 2500, 1,
  12, 8, 50, 1, 5,
  '{"privateProjects":true,"aiGeneration":true,"privateExport":true,"customThemes":true,"sourceParsing":false,"advancedRevise":false,"teamWorkspace":false,"imageGeneration":true}'::jsonb,
  '["Everything in Monthly Instructor","50 AI image credits / month","Coordinated Canvas-ready image sets","Private image library and versions","Uploads do not use credits"]'::jsonb,
  true, 4
) on conflict (key) do update set
  name = excluded.name,
  price_cents = excluded.price_cents,
  image_credits_limit = excluded.image_credits_limit,
  capabilities = excluded.capabilities,
  features = excluded.features,
  active = excluded.active,
  sort_order = excluded.sort_order;

-- Existing credit grants accept the new kind without rewriting history.
alter table public.usage_adjustments drop constraint if exists usage_adjustments_type_check;
alter table public.usage_adjustments add constraint usage_adjustments_type_check
  check (adjustment_type in ('export_credit', 'ai_credit', 'image_credit'));

create table if not exists public.image_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  course_app_id text not null,
  placement text not null check (placement in ('course-card', 'homepage-banner', 'supporting')),
  source text not null check (source in ('upload', 'ai')),
  status text not null default 'processing' check (status in ('processing', 'ready', 'failed', 'archived')),
  version integer not null default 1 check (version > 0),
  file_name text not null,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/gif', 'image/webp')),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  byte_size bigint not null check (byte_size >= 0 and byte_size <= 10485760),
  storage_path text not null,
  original_storage_path text,
  crop_json jsonb not null default '{"x":0,"y":0,"width":100,"height":100,"zoom":1,"focalX":50,"focalY":50}'::jsonb,
  alt_text text not null default '',
  decorative boolean not null default false,
  prompt_snapshot text,
  visual_direction text,
  provider text,
  provider_model text,
  provider_request_id text,
  idempotency_key text,
  credit_cost integer,
  estimated_cost_usd numeric(10,6),
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (owner_id, course_app_id, placement, version)
);
create index if not exists idx_image_assets_course on public.image_assets (owner_id, course_app_id, placement, version desc);
create index if not exists idx_image_assets_storage on public.image_assets (storage_path);

create table if not exists public.image_generation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  course_app_id text not null,
  idempotency_key text not null,
  request_id text not null,
  status text not null default 'reserved' check (status in ('reserved', 'processing', 'completed', 'failed')),
  credits integer not null check (credits > 0),
  request_json jsonb not null default '{}'::jsonb,
  provider_request_ids jsonb not null default '[]'::jsonb,
  estimated_cost_usd numeric(10,6),
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, idempotency_key)
);
create index if not exists idx_image_requests_user_created on public.image_generation_requests (user_id, created_at desc);
create index if not exists idx_image_requests_pending on public.image_generation_requests (subscription_id, status) where status in ('reserved', 'processing');

-- Append-only audit ledger. Updates/deletes are prohibited by trigger as well as RLS.
create table if not exists public.image_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  request_id uuid references public.image_generation_requests (id) on delete set null,
  entry_type text not null check (entry_type in ('reserve', 'commit', 'refund', 'adjustment')),
  credits integer not null check (credits <> 0),
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_image_ledger_user_created on public.image_credit_ledger (user_id, created_at desc);

create or replace function public.prevent_image_ledger_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'image_credit_ledger is append-only';
end;
$$;
drop trigger if exists trg_image_ledger_append_only on public.image_credit_ledger;
create trigger trg_image_ledger_append_only before update or delete on public.image_credit_ledger
  for each row execute function public.prevent_image_ledger_mutation();

create table if not exists public.image_economics_config (
  key text primary key,
  config jsonb not null,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.image_economics_config (key, config) values (
  'default',
  '{"premiumMonthlyCents":2500,"premiumIncrementCents":1000,"includedCredits":50,"mediumCredits":1,"highCredits":4,"creditPackCredits":25,"creditPackCents":500,"targetGrossMarginPercent":70,"provider":"openai","model":"gpt-image-2","mediumLandscapeCostUsd":0.041,"highLandscapeCostUsd":0.165}'::jsonb
) on conflict (key) do nothing;

-- Private bucket. Files are always served through short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('course-images', 'course-images', false, 10485760, array['image/jpeg','image/png','image/gif','image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.image_assets enable row level security;
alter table public.image_generation_requests enable row level security;
alter table public.image_credit_ledger enable row level security;
alter table public.image_economics_config enable row level security;

drop policy if exists image_assets_read_own on public.image_assets;
create policy image_assets_read_own on public.image_assets for select
  using (owner_id = auth.uid() or (workspace_id is not null and public.is_workspace_member(workspace_id)) or public.is_super_admin());

drop policy if exists image_requests_read_own on public.image_generation_requests;
create policy image_requests_read_own on public.image_generation_requests for select
  using (user_id = auth.uid() or public.is_super_admin());

drop policy if exists image_ledger_read_own on public.image_credit_ledger;
create policy image_ledger_read_own on public.image_credit_ledger for select
  using (user_id = auth.uid() or public.is_super_admin());

drop policy if exists image_economics_super_read on public.image_economics_config;
create policy image_economics_super_read on public.image_economics_config for select
  using (public.is_super_admin());

-- Explicit grants: new public tables are not implicitly exposed to the Data API.
revoke all on public.image_assets, public.image_generation_requests, public.image_credit_ledger, public.image_economics_config from anon, authenticated;
grant select on public.image_assets, public.image_generation_requests, public.image_credit_ledger to authenticated;
grant select on public.image_economics_config to authenticated;

-- Reserve credits atomically, under a locked effective subscription row.
create or replace function public.reserve_image_generation(
  p_user_id uuid,
  p_idempotency_key text,
  p_request_id text,
  p_course_app_id text,
  p_credits integer,
  p_request_json jsonb
) returns public.image_generation_requests
language plpgsql security definer set search_path = '' as $$
declare
  v_sub public.subscriptions%rowtype;
  v_plan_limit integer;
  v_granted integer := 0;
  v_pending integer := 0;
  v_existing public.image_generation_requests%rowtype;
  v_created public.image_generation_requests%rowtype;
begin
  if p_credits <= 0 or length(trim(p_idempotency_key)) < 8 then
    raise exception 'invalid image reservation';
  end if;
  select * into v_existing from public.image_generation_requests
    where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then return v_existing; end if;

  select s.* into v_sub
  from public.subscriptions s
  join public.plans p on p.key = s.plan_key
  where s.status in ('active','trialing')
    and (s.current_period_end is null or s.current_period_end > now())
    and coalesce((p.capabilities ->> 'imageGeneration')::boolean, false) = true
    and (
      s.user_id = p_user_id
      or s.workspace_id in (
        select m.workspace_id from public.workspace_members m where m.user_id = p_user_id and m.status = 'active'
        union select w.id from public.workspaces w where w.owner_id = p_user_id
      )
    )
  order by s.updated_at desc
  limit 1 for update of s;
  if not found then raise exception 'premium image generation is not included in the active plan'; end if;

  -- A concurrent duplicate may have committed while this request waited on the subscription lock.
  select * into v_existing from public.image_generation_requests
    where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then return v_existing; end if;

  select coalesce(s.image_credits_limit, p.image_credits_limit, 0) into v_plan_limit
  from public.plans p join public.subscriptions s on s.plan_key = p.key where s.id = v_sub.id;
  select coalesce(sum(a.amount),0)::integer into v_granted
  from public.usage_adjustments a
  where a.adjustment_type = 'image_credit' and (a.expires_at is null or a.expires_at > now())
    and (a.user_id = p_user_id or a.workspace_id = v_sub.workspace_id);
  select coalesce(sum(r.credits),0)::integer into v_pending
  from public.image_generation_requests r
  where r.subscription_id = v_sub.id and r.status in ('reserved','processing');
  if v_plan_limit + v_granted - v_sub.image_credits_used - v_pending < p_credits then
    raise exception 'image credit limit reached';
  end if;

  insert into public.image_generation_requests (
    user_id, workspace_id, subscription_id, course_app_id, idempotency_key, request_id, credits, request_json
  ) values (
    p_user_id, v_sub.workspace_id, v_sub.id, p_course_app_id, p_idempotency_key, p_request_id, p_credits, coalesce(p_request_json,'{}'::jsonb)
  ) returning * into v_created;
  insert into public.image_credit_ledger (user_id, workspace_id, subscription_id, request_id, entry_type, credits, reason)
  values (p_user_id, v_sub.workspace_id, v_sub.id, v_created.id, 'reserve', -p_credits, 'Image generation credits reserved');
  return v_created;
end;
$$;

create or replace function public.finalize_image_generation(
  p_user_id uuid,
  p_generation_request_id uuid,
  p_succeeded boolean,
  p_provider_request_ids jsonb default '[]'::jsonb,
  p_estimated_cost_usd numeric default null,
  p_error_message text default null
) returns public.image_generation_requests
language plpgsql security definer set search_path = '' as $$
declare v_request public.image_generation_requests%rowtype;
begin
  select * into v_request from public.image_generation_requests
    where id = p_generation_request_id and user_id = p_user_id for update;
  if not found then raise exception 'image generation request not found'; end if;
  if v_request.status in ('completed','failed') then return v_request; end if;
  if p_succeeded then
    update public.subscriptions set image_credits_used = image_credits_used + v_request.credits, updated_at = now()
      where id = v_request.subscription_id;
    update public.image_generation_requests set status='completed', provider_request_ids=coalesce(p_provider_request_ids,'[]'::jsonb),
      estimated_cost_usd=p_estimated_cost_usd, completed_at=now() where id=v_request.id returning * into v_request;
    insert into public.image_credit_ledger (user_id, workspace_id, subscription_id, request_id, entry_type, credits, reason, metadata)
      values (p_user_id, v_request.workspace_id, v_request.subscription_id, v_request.id, 'commit', -v_request.credits,
        'Image generation completed', jsonb_build_object('estimatedCostUsd',p_estimated_cost_usd));
  else
    update public.image_generation_requests set status='failed', error_message=left(coalesce(p_error_message,'provider failure'),500),
      provider_request_ids=coalesce(p_provider_request_ids,'[]'::jsonb), completed_at=now() where id=v_request.id returning * into v_request;
    insert into public.image_credit_ledger (user_id, workspace_id, subscription_id, request_id, entry_type, credits, reason)
      values (p_user_id, v_request.workspace_id, v_request.subscription_id, v_request.id, 'refund', v_request.credits,
        'Image generation failed; reservation released');
  end if;
  return v_request;
end;
$$;

create or replace function public.reconcile_stale_image_reservations(p_user_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_request public.image_generation_requests%rowtype;
  v_count integer := 0;
begin
  for v_request in
    select * from public.image_generation_requests
    where user_id = p_user_id and status in ('reserved','processing') and created_at < now() - interval '10 minutes'
    for update skip locked
  loop
    update public.image_generation_requests set status='failed', error_message='Stale reservation reconciled', completed_at=now()
      where id=v_request.id;
    insert into public.image_credit_ledger (user_id, workspace_id, subscription_id, request_id, entry_type, credits, reason)
      values (p_user_id, v_request.workspace_id, v_request.subscription_id, v_request.id, 'refund', v_request.credits,
        'Stale image reservation reconciled');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.reserve_image_generation(uuid,text,text,text,integer,jsonb) from public, anon, authenticated;
revoke execute on function public.finalize_image_generation(uuid,uuid,boolean,jsonb,numeric,text) from public, anon, authenticated;
revoke execute on function public.reconcile_stale_image_reservations(uuid) from public, anon, authenticated;
grant execute on function public.reserve_image_generation(uuid,text,text,text,integer,jsonb) to service_role;
grant execute on function public.finalize_image_generation(uuid,uuid,boolean,jsonb,numeric,text) to service_role;
grant execute on function public.reconcile_stale_image_reservations(uuid) to service_role;
