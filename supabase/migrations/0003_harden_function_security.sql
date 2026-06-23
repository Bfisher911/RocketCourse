-- Mirrors the live migration `harden_function_security` (already applied to the hosted project).
-- Kept in the repo so a fresh `supabase db reset` reproduces production exactly.

-- Pin search_path on the updated_at trigger function (clears function_search_path_mutable).
alter function public.set_updated_at() set search_path = public;

-- handle_new_user is an auth trigger; it never needs to be callable via the REST RPC surface.
-- Triggers run as the table owner regardless, so revoking EXECUTE is safe and removes the
-- "anon/authenticated can execute SECURITY DEFINER function" exposure for it.
revoke execute on function public.handle_new_user() from anon, authenticated, public;

-- is_workspace_member / can_edit_workspace are SECURITY DEFINER helpers referenced by RLS policies,
-- so the authenticated role must retain EXECUTE for policy evaluation. They only return booleans
-- about the *caller's own* membership (no data leak). Revoke from anon (auth.uid() is null for anon).
revoke execute on function public.is_workspace_member(uuid) from anon;
revoke execute on function public.can_edit_workspace(uuid) from anon;
