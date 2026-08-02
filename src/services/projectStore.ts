// Persists course projects to Supabase `course_projects` (JSONB course_json) using the signed-in
// user's session — RLS scopes every row to its owner. No-ops in local-dev mode (no Supabase), where
// projects live only in React state. The whole CourseProject is stored in course_json; a few columns
// (title/status/readiness/export_count) are denormalized for the dashboard and future queries.

import { getSupabaseClient, supabaseConfig } from "./supabaseClient";
import { buildReadinessReport } from "./readiness";
import type { CourseProject } from "../types";

export const persistenceEnabled = (): boolean => supabaseConfig.isConfigured;

/** Keep the first occurrence of each id (input is newest-first), dropping later
 * duplicates. Guards the dashboard against duplicate React keys / double counts
 * when storage carries more than one row for the same project id. */
export const dedupeById = <T extends { id: string }>(items: T[]): T[] => {
  const seen = new Set<string>();
  return items.filter((item) => (seen.has(item.id) ? false : seen.add(item.id)));
};

const currentUserId = async (): Promise<string | null> => {
  const client = await getSupabaseClient();
  if (!client) return null;
  const { data } = await client.auth.getUser();
  return data.user?.id ?? null;
};

/** Lightweight dashboard row — everything needed to paint a project card
 * without downloading the (potentially multi-megabyte) course_json. */
export interface ProjectSummary {
  id: string;
  title: string;
  status: string;
  readinessScore: number;
  updatedAt: string;
}

/** Fast first paint: only the denormalized columns, no course_json. */
export const listProjectSummaries = async (): Promise<ProjectSummary[]> => {
  const client = await getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client
    .from("course_projects")
    .select("app_project_id,title,status,readiness_score,updated_at")
    .order("updated_at", { ascending: false });
  if (error || !data) return [];
  return dedupeById(
    data
      .filter((row) => Boolean(row.app_project_id))
      .map((row) => ({
        id: row.app_project_id as string,
        title: (row.title as string) ?? "",
        status: (row.status as string) ?? "draft",
        readinessScore: Number(row.readiness_score ?? 0),
        updatedAt: (row.updated_at as string) ?? ""
      }))
  );
};

/** Load all of the signed-in user's saved projects, newest first. Empty array if none/unavailable. */
export const listProjects = async (): Promise<CourseProject[]> => {
  const client = await getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client
    .from("course_projects")
    .select("course_json")
    .order("updated_at", { ascending: false });
  if (error || !data) return [];
  const projects = data
    .map((row) => row.course_json as CourseProject | null)
    .filter((project): project is CourseProject => Boolean(project && project.id));
  // Defend the UI contract "one row per project id": rows are ordered newest
  // first, so keeping the first occurrence of each id both dedupes the dashboard
  // (no duplicate React keys, no double counts) and keeps the freshest copy.
  // Duplicates can appear when the (owner_id, app_project_id) unique index from
  // migration 0004 has not been applied, or from pre-0004 rows whose null
  // app_project_id does not participate in the unique index.
  return dedupeById(projects);
};

/** Upsert a project for the signed-in user (keyed on owner + app project id). */
export const saveProject = async (project: CourseProject): Promise<{ ok: boolean; error?: string }> => {
  const client = await getSupabaseClient();
  if (!client) return { ok: false, error: "Persistence unavailable." };
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Not signed in." };

  const row = {
    owner_id: userId,
    app_project_id: project.id,
    title: project.title,
    description: project.description,
    prompt: project.prompt,
    status: project.status,
    course_json: project,
    readiness_score: buildReadinessReport(project).score,
    export_count: project.exportHistory.length,
    updated_at: new Date().toISOString()
  };

  const { error } = await client.from("course_projects").upsert(row, { onConflict: "owner_id,app_project_id" });
  return error ? { ok: false, error: error.message } : { ok: true };
};

export const deleteProject = async (project: CourseProject): Promise<{ ok: boolean; error?: string }> => {
  const client = await getSupabaseClient();
  if (!client) return { ok: false, error: "Persistence unavailable." };
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Not signed in." };
  const { error } = await client
    .from("course_projects")
    .delete()
    .eq("owner_id", userId)
    .eq("app_project_id", project.id);
  return error ? { ok: false, error: error.message } : { ok: true };
};
