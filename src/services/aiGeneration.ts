// Client side of real AI generation. Calls the secure server function with the user's Supabase JWT
// (so the server can verify identity + entitlement). Never touches the OpenAI key. After the user
// approves a blueprint, `buildCourseFromBlueprint` seeds the deterministic generator with the
// blueprint so the full course reliably exports valid Canvas structure while reflecting the AI plan.

import { getSupabaseClient } from "./supabaseClient";
import { generateCourseProject } from "./courseGenerator";
import { withFallback, type AiResult } from "./aiAssist";
import { reviseCourseObject, type ReviseCourseObjectInput } from "./objectRevision";
import { recordCourseAiSpend } from "./aiSpendMeter";
import type { ChatCompletionCost } from "./openaiClient";
import type { CourseBlueprint } from "../ai/blueprint";
import type { CourseProject, CourseSettings } from "../types";

const accessToken = async (): Promise<string | null> => {
  const client = await getSupabaseClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session?.access_token ?? null;
};

export const BLUEPRINT_ENDPOINT = "/.netlify/functions/generate-blueprint";
export const REVISE_ENDPOINT = "/.netlify/functions/revise-object";

/**
 * Revise an object's Canvas HTML with real server-side AI, falling back to the deterministic
 * reviser if the AI route is unreachable/denied (e.g. plain `vite`, no session, free plan). Always
 * resolves with the revised HTML and which path produced it (for an honest UI hint).
 */
export const reviseHtmlWithAi = async (input: ReviseCourseObjectInput): Promise<AiResult<string>> =>
  withFallback(
    async () => {
      const token = await accessToken();
      if (!token) throw new Error("Sign in to use AI revise.");
      const response = await fetch(REVISE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          objectType: input.objectType,
          title: input.title,
          html: input.html,
          mode: input.mode,
          context: {
            outcomeCodes: input.context.outcomeCodes,
            moduleTitle: input.context.moduleTitle,
            courseId: input.context.courseId
          }
        })
      });
      const data = (await response.json().catch(() => null)) as
        | { html?: string; cost?: ChatCompletionCost | null; error?: string }
        | null;
      if (!response.ok || !data?.html) throw new Error(data?.error ?? `AI revise failed (${response.status}).`);
      recordCourseAiSpend(input.context.courseId, data.cost);
      return data.html;
    },
    () => reviseCourseObject(input).html
  );

export interface BlueprintResult {
  blueprint: CourseBlueprint;
  /** Server-priced cost of the blueprint call; attributed to the course once it's built + has an id. */
  cost: ChatCompletionCost | null;
}

/** Request an AI-generated blueprint. Throws with a friendly message on auth/entitlement/AI errors. */
export const generateBlueprint = async (prompt: string, settings: CourseSettings): Promise<BlueprintResult> => {
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

  const data = (await response.json().catch(() => null)) as
    | { blueprint?: CourseBlueprint; cost?: ChatCompletionCost | null; error?: string }
    | null;
  if (!response.ok || !data?.blueprint) {
    throw new Error(data?.error ?? `AI request failed (${response.status}).`);
  }
  return { blueprint: data.blueprint, cost: data.cost ?? null };
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

  // Keep the base course's outcomes verbatim. The deterministic generator builds a fully
  // self-consistent course (outcomes, the syllabus page that embeds them, and every assignment/
  // quiz/rubric/discussion reference all line up). Replacing outcomes after the fact — even just
  // their ids or text — desynchronizes those references and the syllabus, which surfaced as false
  // readiness blockers right after generation. The AI still shapes the course through the title,
  // description, and per-module titles/summaries/objectives below.

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
    modules,
    status: "generated"
  };
};
