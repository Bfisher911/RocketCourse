// Generic AI engine shared by every builder's "Generate with AI" action.
//
// Flow: take a prompt-template stage + course context -> fill the template's
// {{placeholders}} -> ask the OpenAI proxy for strict JSON -> parse it. The
// `withFallback` wrapper guarantees a builder action never hard-fails: if the proxy
// is unreachable (no key, plain `vite` instead of `netlify dev`, network error, or
// unparseable output) the caller's deterministic generator runs instead.

import { getActivePromptTemplate, type PromptTemplateStage } from "../ai/promptTemplates";
import type { CourseProject } from "../types";
import { buildChatMessages, requestChatCompletion } from "./openaiClient";
import { recordCourseAiSpend } from "./aiSpendMeter";

export type AiSource = "ai" | "deterministic";

export interface AiResult<T> {
  value: T;
  source: AiSource;
  /** When source is "deterministic", why AI was skipped (for a subtle UI hint). */
  note?: string;
}

/** Replace {{token}} occurrences; unknown tokens are left intact so prompts stay debuggable. */
export const fillTemplate = (template: string, vars: Record<string, string>): string =>
  template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => (key in vars ? vars[key] : match));

/**
 * Compact, token-friendly snapshot of the course used to ground every generation.
 * Stringified into the {{blueprintJson}} placeholder shared by the prompt templates.
 */
export const buildBlueprintContext = (course: CourseProject): Record<string, unknown> => ({
  title: course.title,
  description: course.description,
  level: course.settings.level,
  modality: course.settings.modality,
  tone: course.settings.tone,
  creditHours: course.settings.creditHours,
  lengthWeeks: course.settings.lengthWeeks,
  outcomes: course.outcomes.map((outcome) => ({ code: outcome.code, text: outcome.text, bloom: outcome.bloomLevel })),
  modules: course.modules.map((module) => ({ id: module.id, title: module.title, objectives: module.objectives })),
  assignmentGroups: course.assignmentGroups.map((group) => ({ id: group.id, name: group.name, weight: group.weight }))
});

const stringifyVars = (context: Record<string, unknown>): Record<string, string> => {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(context)) {
    vars[key] = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  }
  return vars;
};

export interface GenerateJsonArgs {
  stage: PromptTemplateStage;
  /** Values for the template's {{placeholders}} (objects are JSON-stringified). */
  context: Record<string, unknown>;
  /** Explicit shape instruction appended to the prompt, e.g. 'Return {"bodyHtml": string}'. */
  outputContract: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  /** Telemetry: course id so the server can group spend per course. */
  courseId?: string;
  /** Telemetry: override the logged job type (defaults to the stage). */
  jobType?: string;
}

/**
 * Run one stage through the proxy and parse a JSON object from the reply.
 * Throws on any failure (missing key, network, non-JSON) — callers should wrap
 * this in `withFallback` so a deterministic path takes over.
 */
export const generateJson = async <T>(args: GenerateJsonArgs): Promise<T> => {
  const template = getActivePromptTemplate(args.stage);
  const filledUserPrompt = fillTemplate(template.userPromptTemplate, stringifyVars(args.context));
  const userPrompt = `${filledUserPrompt}\n\nReturn ONLY a single valid JSON object, no markdown fences. ${args.outputContract}`;

  const result = await requestChatCompletion({
    messages: buildChatMessages(userPrompt, template),
    temperature: args.temperature ?? 0.5,
    maxTokens: args.maxTokens,
    responseFormat: { type: "json_object" },
    jobType: args.jobType ?? args.stage,
    courseId: args.courseId,
    signal: args.signal
  });

  // Tally real spend the moment the (priced) reply lands — even if the JSON below fails to parse,
  // the tokens were spent, so the live badge must reflect them.
  recordCourseAiSpend(args.courseId, result.cost);

  const trimmed = result.content.trim();
  if (!trimmed) throw new Error("AI returned an empty response.");
  return JSON.parse(trimmed) as T;
};

/**
 * Try the AI path; on ANY error fall back to the deterministic generator.
 * Never rejects — always resolves with a value and which path produced it.
 */
export const withFallback = async <T>(aiFn: () => Promise<T>, deterministic: () => T): Promise<AiResult<T>> => {
  try {
    return { value: await aiFn(), source: "ai" };
  } catch (error) {
    return {
      value: deterministic(),
      source: "deterministic",
      note: error instanceof Error ? error.message : "AI unavailable"
    };
  }
};

/** Coerce an unknown AI value into a clean string[] (drops non-strings, trims, caps length). */
export const toStringList = (value: unknown, limit = 24): string[] =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, limit)
    : [];

/** Coerce an unknown AI value into a trimmed string, or undefined if not usable. */
export const toCleanString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;
