-- Cover every new foreign key used by cleanup, reporting, and reconciliation jobs.
create index if not exists idx_image_assets_workspace on public.image_assets (workspace_id) where workspace_id is not null;
create index if not exists idx_image_requests_workspace on public.image_generation_requests (workspace_id) where workspace_id is not null;
create index if not exists idx_image_requests_subscription on public.image_generation_requests (subscription_id) where subscription_id is not null;
create index if not exists idx_image_ledger_workspace on public.image_credit_ledger (workspace_id) where workspace_id is not null;
create index if not exists idx_image_ledger_subscription on public.image_credit_ledger (subscription_id) where subscription_id is not null;
create index if not exists idx_image_ledger_request on public.image_credit_ledger (request_id) where request_id is not null;
create index if not exists idx_image_economics_updated_by on public.image_economics_config (updated_by) where updated_by is not null;
