-- Re-check idempotency after taking the subscription lock so simultaneous retries converge on
-- the first reservation instead of reaching the unique constraint.
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

revoke execute on function public.reserve_image_generation(uuid,text,text,text,integer,jsonb) from public, anon, authenticated;
grant execute on function public.reserve_image_generation(uuid,text,text,text,integer,jsonb) to service_role;
