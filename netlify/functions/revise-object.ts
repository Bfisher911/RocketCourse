// POST /.netlify/functions/revise-object  — requires Authorization: Bearer <supabase jwt>.
// Body: { objectType, title, html, mode, context }. Auth + entitlement gated (can 'revise_ai'),
// then rewrites the object's Canvas HTML server-side via OpenAI using the production revision
// template, and returns { html }. Public/free users are denied here.

import { getAuthedUser, json } from "./_shared/http";
import { checkUserEntitlement, recordAiUsage } from "./_shared/userEntitlement";
import { getActivePromptTemplate } from "../../src/ai/promptTemplates/registry";

declare const process: { env: Record<string, string | undefined> };

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
const TIMEOUT_MS = 60_000;

type Mode = "concise" | "examples" | "accessibility" | "rubric";

const MODE_INSTRUCTIONS: Record<Mode, string> = {
  concise:
    "Tighten the writing. Lead with purpose, task, deliverable, and next step. Remove filler and redundancy while keeping all substantive instructions and requirements.",
  examples:
    "Add 2-3 concrete, discipline-specific examples, cases, or scenarios that make the concept tangible. Keep them realistic and editable; do not invent citations, URLs, or fake sources.",
  accessibility:
    "Improve accessibility: semantic headings, short paragraphs, descriptive link text, logical lists, and no reliance on color alone. Add brief alt-text placeholders for any implied images.",
  rubric:
    "Add a short, student-facing 'Before you submit' checklist that maps the work to its rubric criteria and aligned outcomes, so students can self-check."
};

export default async (request: Request): Promise<Response> => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed. Use POST." });

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return json(503, { error: "AI is not configured (OPENAI_API_KEY missing)." });

  const user = await getAuthedUser(request);
  if (!user) return json(401, { error: "Sign in to use AI revise." });

  const { decision } = await checkUserEntitlement(user.token, "revise_ai", user.id);
  if (!decision.allowed) return json(403, { error: decision.reason, code: decision.code });

  let body: { objectType?: string; title?: string; html?: string; mode?: string; context?: Record<string, unknown> };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json(400, { error: "Body must be JSON: { objectType, title, html, mode }." });
  }
  const html = typeof body.html === "string" ? body.html : "";
  const mode = (body.mode as Mode) ?? "concise";
  if (!html.trim()) return json(400, { error: "Object html is required." });
  if (!(mode in MODE_INSTRUCTIONS)) return json(400, { error: `Unknown revise mode: ${mode}.` });

  const template = getActivePromptTemplate("revision");
  const outcomeCodes = Array.isArray(body.context?.outcomeCodes) ? (body.context!.outcomeCodes as string[]) : [];
  const userPrompt = [
    `Revise this Canvas ${body.objectType ?? "page"} titled "${body.title ?? "Untitled"}".`,
    `Revision goal: ${MODE_INSTRUCTIONS[mode]}`,
    outcomeCodes.length ? `Aligned outcomes: ${outcomeCodes.join(", ")}.` : "",
    body.context?.moduleTitle ? `Module: ${String(body.context.moduleTitle)}.` : "",
    "",
    "Current HTML:",
    html,
    "",
    'Return ONLY a JSON object: {"html": "<the full revised Canvas-safe HTML>"}. Use semantic headings, lists, and descriptive links. Do NOT include <script>, iframes, event handlers, or markdown fences. Preserve the instructor\'s intent and any existing correct content.'
  ]
    .filter(Boolean)
    .join("\n");

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
      body: JSON.stringify({ model: MODEL, messages, temperature: 0.5, response_format: { type: "json_object" } }),
      signal: controller.signal
    });
    const payload = (await response.json()) as Record<string, any>;
    if (!response.ok) return json(response.status, { error: payload?.error?.message ?? "OpenAI request failed." });

    let revised = "";
    try {
      const parsed = JSON.parse(payload?.choices?.[0]?.message?.content ?? "{}");
      revised = typeof parsed.html === "string" ? parsed.html : "";
    } catch {
      revised = "";
    }
    if (!revised.trim()) return json(502, { error: "Model returned no revised HTML." });

    const courseId = typeof body.context?.courseId === "string" ? (body.context.courseId as string) : undefined;
    const cost = await recordAiUsage(user.id, `revise_${mode}`, {
      model: payload?.model ?? MODEL,
      usage: payload?.usage ?? null,
      courseId
    });
    return json(200, { html: revised, model: payload?.model ?? MODEL, cost });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return json(aborted ? 504 : 502, { error: aborted ? "AI request timed out." : "Failed to reach the AI service." });
  } finally {
    clearTimeout(timeout);
  }
};
