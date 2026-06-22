-- CourseForge core schema + Row Level Security.
-- MVP storage strategy: course content is stored as JSONB on course_projects (course_json,
-- blueprint_json, theme_json). SaaS concerns (identity, billing, entitlement, usage, audit)
-- are normalized. Normalizing course modules/pages/etc. into their own tables is a later step.
--
-- Safe to run on a fresh project. Idempotent where practical. Subscription/usage/audit rows are
-- written ONLY by trusted server code (service role bypasses RLS) — there are deliberately no
-- client INSERT/UPDATE policies on those tables.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helper: keep updated_at fresh
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles  (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- plans  (public catalog — seeded in 0002)
-- ---------------------------------------------------------------------------
create table if not exists public.plans (
  key text primary key,
  name text not null,
  billing_interval text not null,            -- month | year | one_time | contact
  checkout_mode text not null,               -- free | subscription | payment | contact
  price_cents integer not null default 0,
  entitlement_months integer not null default 0,
  exports_limit integer,                     -- null = unlimited
  ai_generations_limit integer,              -- null = unlimited
  seats_limit integer,
  projects_limit integer,
  capabilities jsonb not null default '{}'::jsonb,
  features jsonb not null default '[]'::jsonb,
  stripe_price_id text,
  active boolean not null default true,
  sort_order integer not null default 0
);

-- ---------------------------------------------------------------------------
-- workspaces + members
-- ---------------------------------------------------------------------------
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  plan_key text not null default 'free_preview' references public.plans (key),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member',       -- owner | admin | editor | member
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

-- SECURITY DEFINER membership helpers avoid recursive RLS evaluation on workspace_members.
create or replace function public.is_workspace_member(ws uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid()
  ) or exists (
    select 1 from public.workspaces w
    where w.id = ws and w.owner_id = auth.uid()
  );
$$;

create or replace function public.can_edit_workspace(ws uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.workspaces w
    where w.id = ws and w.owner_id = auth.uid()
  ) or exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid() and m.role in ('owner', 'admin', 'editor')
  );
$$;

-- ---------------------------------------------------------------------------
-- stripe_customers + subscriptions  (server-written only)
-- ---------------------------------------------------------------------------
create table if not exists public.stripe_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  plan_key text not null default 'free_preview' references public.plans (key),
  status text not null default 'none',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  exports_limit integer,
  exports_used integer not null default 0,
  ai_generations_limit integer,
  ai_generations_used integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_user on public.subscriptions (user_id);
create unique index if not exists idx_subscriptions_user_active
  on public.subscriptions (user_id)
  where status in ('active', 'trialing', 'past_due');

drop trigger if exists trg_subscriptions_updated_at on public.subscriptions;
create trigger trg_subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- course_projects  (JSONB-first course content)
-- ---------------------------------------------------------------------------
create table if not exists public.course_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  title text not null default 'Untitled course',
  description text not null default '',
  prompt text not null default '',
  status text not null default 'draft',
  course_json jsonb,
  blueprint_json jsonb,
  theme_json jsonb,
  canvas_verification_status text not null default 'not_verified',
  readiness_score integer not null default 0,
  export_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_course_projects_owner on public.course_projects (owner_id);
create index if not exists idx_course_projects_workspace on public.course_projects (workspace_id);

drop trigger if exists trg_course_projects_updated_at on public.course_projects;
create trigger trg_course_projects_updated_at before update on public.course_projects
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- custom_themes
-- ---------------------------------------------------------------------------
create table if not exists public.custom_themes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  name text not null,
  primary_color text not null default '#1f3a8a',
  accent_color text not null default '#22d3ee',
  background_color text not null default '#0b1020',
  text_color text not null default '#e6ecff',
  logo_url text,
  theme_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_custom_themes_owner on public.custom_themes (owner_id);

drop trigger if exists trg_custom_themes_updated_at on public.custom_themes;
create trigger trg_custom_themes_updated_at before update on public.custom_themes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- export_jobs + export_history
-- ---------------------------------------------------------------------------
create table if not exists public.export_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  course_project_id uuid references public.course_projects (id) on delete cascade,
  status text not null default 'pending',    -- pending | running | completed | failed
  file_name text,
  storage_path text,
  readiness_score integer,
  validation_report jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  error_message text
);

create index if not exists idx_export_jobs_owner on public.export_jobs (owner_id);
create index if not exists idx_export_jobs_project on public.export_jobs (course_project_id);

create table if not exists public.export_history (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  course_project_id uuid references public.course_projects (id) on delete cascade,
  file_name text not null,
  mode text not null default 'full',
  validation_score integer not null default 0,
  exported_at timestamptz not null default now()
);

create index if not exists idx_export_history_owner on public.export_history (owner_id);

-- ---------------------------------------------------------------------------
-- usage_events, ai_generation_jobs/logs, audit_events  (server-written)
-- ---------------------------------------------------------------------------
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  course_project_id uuid references public.course_projects (id) on delete set null,
  event_type text not null,                  -- ai_generation | export | ...
  units integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_usage_events_user on public.usage_events (user_id);

create table if not exists public.ai_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  course_project_id uuid references public.course_projects (id) on delete set null,
  job_type text not null,                    -- blueprint | full_course | revise_<object>
  status text not null default 'pending',
  model text,
  input_tokens integer,
  output_tokens integer,
  estimated_cost_cents integer,
  prompt_snapshot text,
  result_json jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_ai_jobs_user on public.ai_generation_jobs (user_id);

create table if not exists public.ai_generation_logs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.ai_generation_jobs (id) on delete cascade,
  level text not null default 'info',
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users (id) on delete set null,
  workspace_id uuid references public.workspaces (id) on delete set null,
  event_type text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_events_actor on public.audit_events (actor_user_id);

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.profiles            enable row level security;
alter table public.plans               enable row level security;
alter table public.workspaces          enable row level security;
alter table public.workspace_members   enable row level security;
alter table public.stripe_customers    enable row level security;
alter table public.subscriptions       enable row level security;
alter table public.course_projects     enable row level security;
alter table public.custom_themes       enable row level security;
alter table public.export_jobs         enable row level security;
alter table public.export_history      enable row level security;
alter table public.usage_events        enable row level security;
alter table public.ai_generation_jobs  enable row level security;
alter table public.ai_generation_logs  enable row level security;
alter table public.audit_events        enable row level security;

-- profiles: read/update your own row
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- plans: world-readable catalog (no client writes)
drop policy if exists plans_read_all on public.plans;
create policy plans_read_all on public.plans
  for select using (true);

-- workspaces: owner full control; members may read
drop policy if exists workspaces_read on public.workspaces;
create policy workspaces_read on public.workspaces
  for select using (owner_id = auth.uid() or public.is_workspace_member(id));
drop policy if exists workspaces_insert on public.workspaces;
create policy workspaces_insert on public.workspaces
  for insert with check (owner_id = auth.uid());
drop policy if exists workspaces_update on public.workspaces;
create policy workspaces_update on public.workspaces
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists workspaces_delete on public.workspaces;
create policy workspaces_delete on public.workspaces
  for delete using (owner_id = auth.uid());

-- workspace_members: a member can see co-members; owners/admins manage
drop policy if exists members_read on public.workspace_members;
create policy members_read on public.workspace_members
  for select using (user_id = auth.uid() or public.is_workspace_member(workspace_id));
drop policy if exists members_manage on public.workspace_members;
create policy members_manage on public.workspace_members
  for all using (public.can_edit_workspace(workspace_id))
  with check (public.can_edit_workspace(workspace_id));

-- stripe_customers / subscriptions: read your own; writes are service-role only
drop policy if exists stripe_customers_read_own on public.stripe_customers;
create policy stripe_customers_read_own on public.stripe_customers
  for select using (user_id = auth.uid());

drop policy if exists subscriptions_read_own on public.subscriptions;
create policy subscriptions_read_own on public.subscriptions
  for select using (
    user_id = auth.uid()
    or (workspace_id is not null and public.can_edit_workspace(workspace_id))
  );

-- course_projects: owner full; workspace editors may read+write; members read
drop policy if exists course_projects_read on public.course_projects;
create policy course_projects_read on public.course_projects
  for select using (
    owner_id = auth.uid()
    or (workspace_id is not null and public.is_workspace_member(workspace_id))
  );
drop policy if exists course_projects_insert on public.course_projects;
create policy course_projects_insert on public.course_projects
  for insert with check (
    owner_id = auth.uid()
    and (workspace_id is null or public.can_edit_workspace(workspace_id))
  );
drop policy if exists course_projects_update on public.course_projects;
create policy course_projects_update on public.course_projects
  for update using (
    owner_id = auth.uid()
    or (workspace_id is not null and public.can_edit_workspace(workspace_id))
  ) with check (
    owner_id = auth.uid()
    or (workspace_id is not null and public.can_edit_workspace(workspace_id))
  );
drop policy if exists course_projects_delete on public.course_projects;
create policy course_projects_delete on public.course_projects
  for delete using (
    owner_id = auth.uid()
    or (workspace_id is not null and public.can_edit_workspace(workspace_id))
  );

-- custom_themes: owner full; workspace members read
drop policy if exists custom_themes_read on public.custom_themes;
create policy custom_themes_read on public.custom_themes
  for select using (
    owner_id = auth.uid()
    or (workspace_id is not null and public.is_workspace_member(workspace_id))
  );
drop policy if exists custom_themes_write on public.custom_themes;
create policy custom_themes_write on public.custom_themes
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- export_jobs / export_history: scoped to owner
drop policy if exists export_jobs_read on public.export_jobs;
create policy export_jobs_read on public.export_jobs
  for select using (owner_id = auth.uid());
drop policy if exists export_history_read on public.export_history;
create policy export_history_read on public.export_history
  for select using (owner_id = auth.uid());

-- usage / ai jobs / ai logs / audit: read your own; writes are service-role only
drop policy if exists usage_events_read_own on public.usage_events;
create policy usage_events_read_own on public.usage_events
  for select using (user_id = auth.uid());

drop policy if exists ai_jobs_read_own on public.ai_generation_jobs;
create policy ai_jobs_read_own on public.ai_generation_jobs
  for select using (user_id = auth.uid());

drop policy if exists ai_logs_read_own on public.ai_generation_logs;
create policy ai_logs_read_own on public.ai_generation_logs
  for select using (
    exists (
      select 1 from public.ai_generation_jobs j
      where j.id = ai_generation_logs.job_id and j.user_id = auth.uid()
    )
  );

drop policy if exists audit_events_read_own on public.audit_events;
create policy audit_events_read_own on public.audit_events
  for select using (
    actor_user_id = auth.uid()
    or (workspace_id is not null and public.can_edit_workspace(workspace_id))
  );
