// POST /.netlify/functions/generate-blueprint  — requires Authorization: Bearer <supabase jwt>.
// Body: { prompt, settings }. Auth + entitlement gated (can 'generate_blueprint'), then calls
// OpenAI server-side (key never reaches the browser) with the production blueprint prompt template,
// validates the JSON into a CourseBlueprint, records usage (best-effort), and returns it.
//
// This is the secure AI route: the public demo cannot reach it (no JWT / free plan → denied).

import { getAuthedUser, json } from "./_shared/http";
import { checkUserEntitlement, recordAiUsage } from "./_shared/userEntitlement";
import { getActivePromptTemplate } from "../../src/ai/promptTemplates/registry";
import { BLUEPRINT_JSON_SHAPE, parseBlueprint } from "../../src/ai/blueprint";

declare const process: { env: Record<string, string | undefined> };

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
const TIMEOUT_MS = 90_000;

const fill = (template: string, vars: Record<string, string>): string =>
  template.replace(/\{\{(\w+)\}\}/g, (_match, key) => vars[key] ?? "");

export default async (request: Request): Promise<Response> => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed. Use POST." });

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return json(503, { error: "AI is not configured (OPENAI_API_KEY missing)." });

  const user = await getAuthedUser(request);
  if (!user) return json(401, { error: "Sign in to generate a blueprint." });

  // Server-side entitlement: the authoritative gate. Free/demo users are denied here.
  const { decision } = await checkUserEntitlement(user.token, "generate_blueprint");
  if (!decision.allowed) {
    return json(403, { error: decision.reason, code: decision.code });
  }

  let body: { prompt?: unknown; settings?: unknown };
  try {
    body = (await request.json()) as { prompt?: unknown; settings?: unknown };
  } catch {
    return json(400, { error: "Body must be JSON: { prompt, settings }." });
  }
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  const settings = typeof body.settings === "object" && body.settings !== null ? body.settings : {};
  if (!prompt.trim()) return json(400, { error: "A course prompt is required." });

  const template = getActivePromptTemplate("blueprint");
  // The client appends extracted source text to the prompt, so the model already sees the content.
  // Here we summarise the sources for the prompt and strip the bulky `text` from the settings JSON so
  // the same content isn't sent twice.
  const rawSources = Array.isArray((settings as Record<string, unknown>).sourceFiles)
    ? ((settings as Record<string, unknown>).sourceFiles as Array<{ name?: string; status?: string; chars?: number }>)
    : [];
  const settingsForPrompt = {
    ...(settings as Record<string, unknown>),
    sourceFiles: rawSources.map(({ name, status, chars }) => ({ name, status, chars }))
  };
  const parsedSources = rawSources.filter((f) => f.status === "parsed" || f.status === "needs-review");
  const sourceNotes = parsedSources.length
    ? `Instructor source materials are included in the course brief above; reflect them. Files: ${parsedSources
        .map((f) => `${f.name ?? "source"} (${f.chars ?? 0} chars)`)
        .join(", ")}`
    : rawSources.length
      ? `Instructor attached files that could not be parsed: ${rawSources.map((f) => f.name).filter(Boolean).join(", ")}`
      : "None provided.";
  const userPrompt =
    fill(template.userPromptTemplate, {
      courseBriefJson: JSON.stringify({ prompt }, null, 2),
      courseSettingsJson: JSON.stringify(settingsForPrompt, null, 2),
      sourceNotes
    }) + `\n\nReturn ONLY a JSON object with exactly this shape (no prose, no markdown):\n${BLUEPRINT_JSON_SHAPE}`;

  const messages = [
    { role: "system", content: template.systemInstructions },
    { role: "system", content: template.developerInstructions },
    { role: "user", content: userPrompt }
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, messages, temperature: 0.6, response_format: { type: "json_object" } }),
      signal: controller.signal
    });
    const payload = (await response.json()) as Record<string, any>;
    if (!response.ok) {
      return json(response.status, { error: payload?.error?.message ?? "OpenAI request failed." });
    }
    const content = payload?.choices?.[0]?.message?.content ?? "";
    let blueprint;
    try {
      blueprint = parseBlueprint(JSON.parse(content));
    } catch (error) {
      return json(502, { error: `Model returned invalid blueprint JSON: ${error instanceof Error ? error.message : "parse error"}` });
    }

    await recordAiUsage(user.id, "blueprint", { model: payload?.model ?? MODEL, promptSnapshot: prompt.slice(0, 500) });

    return json(200, { blueprint, model: payload?.model ?? MODEL, usage: payload?.usage ?? null });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return json(aborted ? 504 : 502, { error: aborted ? "AI request timed out." : "Failed to reach the AI service." });
  } finally {
    clearTimeout(timeout);
  }
};
