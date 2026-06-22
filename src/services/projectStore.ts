// Persists course projects to Supabase `course_projects` (JSONB course_json) using the signed-in
// user's session — RLS scopes every row to its owner. No-ops in local-dev mode (no Supabase), where
// projects live only in React state. The whole CourseProject is stored in course_json; a few columns
// (title/status/readiness/export_count) are denormalized for the dashboard and future queries.

import { getSupabaseClient, supabaseConfig } from "./supabaseClient";
import { buildReadinessReport } from "./readiness";
import type { CourseProject } from "../types";

export const persistenceEnabled = (): boolean => supabaseConfig.isConfigured;

const currentUserId = async (): Promise<string | null> => {
  const client = await getSupabaseClient();
  if (!client) return null;
  const { data } = await client.auth.getUser();
  return data.user?.id ?? null;
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
  return data
    .map((row) => row.course_json as CourseProject | null)
    .filter((project): project is CourseProject => Boolean(project && project.id));
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
