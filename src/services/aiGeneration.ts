// Client side of real AI generation. Calls the secure server function with the user's Supabase JWT
// (so the server can verify identity + entitlement). Never touches the OpenAI key. After the user
// approves a blueprint, `buildCourseFromBlueprint` seeds the deterministic generator with the
// blueprint so the full course reliably exports valid Canvas structure while reflecting the AI plan.

import { getSupabaseClient } from "./supabaseClient";
import { generateCourseProject } from "./courseGenerator";
import type { CourseBlueprint } from "../ai/blueprint";
import type { CourseOutcome, CourseProject, CourseSettings } from "../types";

const accessToken = async (): Promise<string | null> => {
  const client = await getSupabaseClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session?.access_token ?? null;
};

export const BLUEPRINT_ENDPOINT = "/.netlify/functions/generate-blueprint";

/** Request an AI-generated blueprint. Throws with a friendly message on auth/entitlement/AI errors. */
export const generateBlueprint = async (prompt: string, settings: CourseSettings): Promise<CourseBlueprint> => {
  const token = await accessToken();
  if (!token) throw new Error("Please sign in to generate with AI.");

  let response: Response;
  try {
    response = await fetch(BLUEPRINT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ prompt, settings })
    });
  } catch {
    throw new Error(
      "Could not reach the AI service. Run the app with `netlify dev` (plain `vite` does not serve functions)."
    );
  }

  const data = (await response.json().catch(() => null)) as { blueprint?: CourseBlueprint; error?: string } | null;
  if (!response.ok || !data?.blueprint) {
    throw new Error(data?.error ?? `AI request failed (${response.status}).`);
  }
  return data.blueprint;
};

/**
 * Build a full, editable, export-valid course from an approved blueprint. The deterministic
 * generator guarantees valid Canvas structure; the blueprint overrides title, description, outcomes,
 * and per-module titles/objectives so the result reflects the AI's instructional plan.
 */
export const buildCourseFromBlueprint = (
  blueprint: CourseBlueprint,
  settings: CourseSettings,
  prompt: string
): CourseProject => {
  const moduleCount = Math.max(1, blueprint.modules.length);
  const mergedSettings: CourseSettings = {
    ...settings,
    title: blueprint.title || settings.title,
    description: blueprint.description || settings.description,
    creditHours: blueprint.creditHours || settings.creditHours,
    lengthWeeks: blueprint.lengthWeeks || settings.lengthWeeks,
    moduleCount
  };

  const base = generateCourseProject({ prompt, settings: mergedSettings });

  const outcomes: CourseOutcome[] = blueprint.outcomes.length
    ? blueprint.outcomes.map((outcome, index) => ({
        id: `outcome_${index + 1}`,
        code: outcome.code || `CO${index + 1}`,
        text: outcome.text,
        bloomLevel: base.outcomes[index]?.bloomLevel ?? "Apply",
        alignedModuleIds: base.outcomes[index]?.alignedModuleIds ?? []
      }))
    : base.outcomes;

  // Overlay blueprint module titles/summaries/objectives onto the generated modules (by order).
  const modules = base.modules.map((module, index) => {
    const planned = blueprint.modules[index];
    if (!planned) return module;
    return {
      ...module,
      title: planned.title || module.title,
      description: planned.summary || module.description,
      objectives: planned.objectives.length ? planned.objectives : module.objectives
    };
  });

  return {
    ...base,
    id: `course_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    title: blueprint.title || base.title,
    description: blueprint.description || base.description,
    prompt,
    outcomes,
    modules,
    status: "generated"
  };
};
