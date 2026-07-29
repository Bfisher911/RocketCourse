-- ============================================================================
-- RLS cross-user and cross-workspace isolation test
-- ----------------------------------------------------------------------------
-- Proves that Row Level Security actually isolates tenants, rather than just
-- being switched on. Every assertion RAISES EXCEPTION on failure, so this file
-- either completes silently or aborts with the reason.
--
-- Run against a LOCAL stack (never a project with real data):
--     supabase start && supabase db reset
--     psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" \
--          -v ON_ERROR_STOP=1 -f supabase/tests/rls_isolation.sql
--
-- WHY THE TRANSACTIONS MATTER: `set local role` / `set local request.jwt.claims`
-- only take effect inside a transaction block. Outside one, Postgres emits a
-- WARNING and the statements run as the superuser — which BYPASSES RLS and makes
-- the test silently vacuous. An early version of this test did exactly that and
-- appeared to show a total isolation failure. Keep every impersonation in BEGIN/COMMIT.
-- ============================================================================

\set ON_ERROR_STOP on

begin;

-- ── fixtures ────────────────────────────────────────────────────────────────
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','alice@rls.test','x',now(),now(),now()),
       ('22222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','bob@rls.test','x',now(),now(),now())
on conflict (id) do nothing;

insert into public.course_projects (owner_id, app_project_id, title, course_json)
values ('11111111-1111-1111-1111-111111111111','rls-alice','ALICE COURSE','{}'::jsonb),
       ('22222222-2222-2222-2222-222222222222','rls-bob','BOB COURSE','{}'::jsonb)
on conflict do nothing;

insert into public.workspaces (id, name, owner_id)
values ('aaaaaaaa-0000-0000-0000-00000000aaaa','Alice Org','11111111-1111-1111-1111-111111111111')
on conflict (id) do nothing;

commit;

-- ── 1. a user cannot READ another user's course ─────────────────────────────
do $$
declare visible int;
begin
  set local role authenticated;
  set local "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
  select count(*) into visible from public.course_projects where app_project_id = 'rls-bob';
  if visible <> 0 then
    raise exception 'RLS LEAK: Alice can see % of Bob''s course rows', visible;
  end if;
  select count(*) into visible from public.course_projects;
  if visible <> 1 then
    raise exception 'RLS LEAK: Alice sees % course rows, expected exactly her own 1', visible;
  end if;
end $$;

-- ── 2. a user cannot UPDATE or DELETE another user's course ─────────────────
do $$
declare touched int;
begin
  set local role authenticated;
  set local "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
  update public.course_projects set title = 'HIJACKED' where app_project_id = 'rls-bob';
  get diagnostics touched = row_count;
  if touched <> 0 then raise exception 'RLS LEAK: Alice updated % of Bob''s rows', touched; end if;
  delete from public.course_projects where app_project_id = 'rls-bob';
  get diagnostics touched = row_count;
  if touched <> 0 then raise exception 'RLS LEAK: Alice deleted % of Bob''s rows', touched; end if;
end $$;

-- Bob's row must be untouched, checked with RLS off (superuser ground truth).
do $$
declare t text;
begin
  select title into t from public.course_projects where app_project_id = 'rls-bob';
  if t is distinct from 'BOB COURSE' then
    raise exception 'RLS LEAK: Bob''s row was modified — title is now %', t;
  end if;
end $$;

-- ── 3. a non-member cannot see another org's workspace or its members ───────
do $$
declare visible int;
begin
  set local role authenticated;
  set local "request.jwt.claims" = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
  select count(*) into visible from public.workspaces where id = 'aaaaaaaa-0000-0000-0000-00000000aaaa';
  if visible <> 0 then raise exception 'RLS LEAK: non-member Bob sees Alice''s workspace'; end if;
  select count(*) into visible from public.workspace_members where workspace_id = 'aaaaaaaa-0000-0000-0000-00000000aaaa';
  if visible <> 0 then raise exception 'RLS LEAK: non-member Bob sees % member rows', visible; end if;
end $$;

-- ── 4. a non-member cannot escalate by adding themselves as admin ───────────
do $$
declare escalated boolean := false;
begin
  begin
    set local role authenticated;
    set local "request.jwt.claims" = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
    insert into public.workspace_members (workspace_id, user_id, role)
    values ('aaaaaaaa-0000-0000-0000-00000000aaaa','22222222-2222-2222-2222-222222222222','admin');
    escalated := true;                       -- insert succeeded = policy failure
  exception when insufficient_privilege or check_violation then
    escalated := false;                      -- rejected by RLS = correct
  end;
  if escalated then
    raise exception 'RLS LEAK: non-member Bob inserted himself as workspace admin';
  end if;
end $$;

-- ── 5. the owner CAN still see their own workspace (policies not over-tight) ─
do $$
declare visible int;
begin
  set local role authenticated;
  set local "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
  select count(*) into visible from public.workspaces where id = 'aaaaaaaa-0000-0000-0000-00000000aaaa';
  if visible <> 1 then raise exception 'OVER-RESTRICTIVE: owner Alice cannot see her own workspace'; end if;
end $$;

-- ── 6. every public table has RLS enabled ───────────────────────────────────
do $$
declare offenders text;
begin
  select string_agg(c.relname, ', ') into offenders
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  if offenders is not null then
    raise exception 'RLS NOT ENABLED on: %', offenders;
  end if;
end $$;

-- ── cleanup ─────────────────────────────────────────────────────────────────
delete from public.workspace_members where workspace_id = 'aaaaaaaa-0000-0000-0000-00000000aaaa';
delete from public.workspaces where id = 'aaaaaaaa-0000-0000-0000-00000000aaaa';
delete from public.course_projects where app_project_id in ('rls-alice','rls-bob');
delete from auth.users where email in ('alice@rls.test','bob@rls.test');

\echo 'RLS isolation: ALL CHECKS PASSED'
