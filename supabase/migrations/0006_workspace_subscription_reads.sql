-- Let any ACTIVE workspace member (not just owner/admin/editor) READ the workspace subscription row,
-- so a team member's entitlement resolves to the shared team plan and the UI can show plan + usage.
-- The subscription row carries no card data — only plan/status/usage counters.

drop policy if exists subscriptions_read_own on public.subscriptions;
create policy subscriptions_read_own on public.subscriptions
  for select using (
    user_id = auth.uid()
    or (workspace_id is not null and public.is_workspace_member(workspace_id))
  );
