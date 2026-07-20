-- The server resolves all three credit kinds through this service-role-only helper.
-- Earlier migrations revoked PUBLIC/anon/authenticated but did not explicitly restore service_role.
grant execute on function public.active_credit_balance(uuid, text) to service_role;
