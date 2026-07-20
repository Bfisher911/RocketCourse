-- Release reservations stranded by a function/provider crash on the user's next imagery request.
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

revoke execute on function public.reconcile_stale_image_reservations(uuid) from public, anon, authenticated;
grant execute on function public.reconcile_stale_image_reservations(uuid) to service_role;
