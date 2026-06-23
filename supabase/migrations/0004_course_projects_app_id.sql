-- Mirrors the live migration `course_projects_app_id` (already applied to the hosted project).
-- The app generates string project ids (e.g. "course_…"); key persistence on (owner, app id)
-- so the client can upsert without first knowing the DB uuid.

alter table public.course_projects add column if not exists app_project_id text;
create unique index if not exists idx_course_projects_owner_appid
  on public.course_projects (owner_id, app_project_id);
