-- Supporting imagery can target a concrete course object while identity images remain course-wide.
alter table public.image_assets
  add column if not exists content_object_id text,
  add column if not exists content_object_type text,
  add column if not exists content_object_title text,
  add column if not exists usage_metadata jsonb,
  add column if not exists actual_cost_usd numeric(10,6),
  add column if not exists rights_acknowledged_at timestamptz;

alter table public.image_assets drop constraint if exists image_assets_owner_id_course_app_id_placement_version_key;
drop index if exists public.image_assets_owner_course_target_version_key;
create unique index image_assets_owner_course_target_version_key
  on public.image_assets (owner_id, course_app_id, placement, coalesce(content_object_id, ''), version);
create index if not exists idx_image_assets_content_object
  on public.image_assets (owner_id, course_app_id, content_object_id)
  where content_object_id is not null;

alter table public.image_assets drop constraint if exists image_assets_content_object_type_check;
alter table public.image_assets add constraint image_assets_content_object_type_check
  check (content_object_type is null or content_object_type in ('module','page','assignment','discussion','quiz'));
alter table public.image_assets drop constraint if exists image_assets_supporting_target_check;
alter table public.image_assets add constraint image_assets_supporting_target_check
  check (
    (placement = 'supporting' and content_object_id is not null and content_object_type is not null)
    or (placement <> 'supporting' and content_object_id is null and content_object_type is null)
  ) not valid;

update public.image_economics_config
set config = config || '{"premiumPlanName":"RocketCourse Premium","maxBatchImages":12,"maxImagesPerCourse":100,"perUserDailyLimit":50,"monthlyHardSpendUsd":2000,"retryReservePercent":10,"storageCostPerGbUsd":0.03,"processingCostPerImageUsd":0.002,"paymentFeePercent":2.9,"paymentFeeFixedUsd":0.30,"supportReservePercent":5,"unusedCreditsRollOver":false,"trialImageAllowance":0,"institutionalImageAllowance":0}'::jsonb,
    updated_at = now()
where key = 'default';

update public.plans
set capabilities = coalesce(capabilities, '{}'::jsonb) || '{"imageGeneration":true}'::jsonb,
    image_credits_limit = coalesce(image_credits_limit, 0)
where key = 'institution';

update public.subscriptions s
set image_credits_limit = case
  when s.status = 'trialing' and s.plan_key = 'rocketcourse_premium'
    then coalesce((select (config ->> 'trialImageAllowance')::integer from public.image_economics_config where key = 'default'), 0)
  when s.plan_key = 'institution'
    then coalesce((select (config ->> 'institutionalImageAllowance')::integer from public.image_economics_config where key = 'default'), 0)
  else s.image_credits_limit
end
where (s.status = 'trialing' and s.plan_key = 'rocketcourse_premium') or s.plan_key = 'institution';
