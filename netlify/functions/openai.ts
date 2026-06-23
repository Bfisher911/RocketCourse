// Server-side OpenAI proxy. Runs on Netlify (Node 20), NOT in the browser, so the
// secret OPENAI_API_KEY never reaches the client. The app POSTs chat messages here
// and this function forwards them to OpenAI with the secret attached.
//
// Bundled by Netlify (esbuild) independently of the app's `tsc -b`, so it has no
// effect on the Vite build. Uses only Web-standard globals (fetch/Request/Response)
// available on Node 20 — no extra dependencies required.

// Minimal ambient declaration so editors/tsc are happy without pulling in @types/node.
declare const process: { env: Record<string, string | undefined> };

import { getAuthedUser } from "./_shared/http";
import { checkUserEntitlement } from "./_shared/userEntitlement";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
const REQUEST_TIMEOUT_MS = 60_000;

type ChatRole = "system" | "developer" | "user" | "assistant";

interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface ChatRequestBody {
  messages?: unknown;
  model?: unknown;
  temperature?: unknown;
  maxTokens?: unknown;
  responseFormat?: unknown;
}

const json = (status: number, body: Record<string, unknown>): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });

const isChatMessage = (value: unknown): value is ChatMessage => {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    (candidate.role === "system" ||
      candidate.role === "developer" ||
      candidate.role === "user" ||
      candidate.role === "assistant") &&
    typeof candidate.content === "string" &&
    candidate.content.length > 0
  );
};

export default async (request: Request): Promise<Response> => {
  if (request.method !== "POST") {
    return json(405, { error: "Method not allowed. Use POST." });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return json(500, {
      error:
        "Server is not configured: OPENAI_API_KEY is missing. Set it in `.env` for local dev (via `netlify dev`) or in the Netlify dashboard for production."
    });
  }

  // SECURITY: this generic AI proxy is NOT public. Require a valid Supabase session and an active
  // AI-capable plan, so the static demo / free users can never spend OpenAI tokens here. Builder
  // "Generate with AI" actions send the user's JWT; unauthenticated callers fall back to the
  // deterministic generators client-side (withFallback).
  const user = await getAuthedUser(request);
  if (!user) return json(401, { error: "Sign in with an active plan to use AI." });
  const { decision } = await checkUserEntitlement(user.token, "revise_ai", user.id);
  if (!decision.allowed) return json(403, { error: decision.reason, code: decision.code });

  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return json(400, { error: "Request body must be valid JSON." });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return json(400, { error: "`messages` must be a non-empty array of { role, content }." });
  }
  if (!body.messages.every(isChatMessage)) {
    return json(400, {
      error: "Each message needs a string `content` and a role of system | developer | user | assistant."
    });
  }

  const model = typeof body.model === "string" && body.model.trim() ? body.model.trim() : DEFAULT_MODEL;
  const temperature = typeof body.temperature === "number" ? body.temperature : undefined;
  const maxTokens = typeof body.maxTokens === "number" ? body.maxTokens : undefined;
  const responseFormat =
    typeof body.responseFormat === "object" && body.responseFormat !== null ? body.responseFormat : undefined;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const openaiResponse = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: body.messages,
        ...(temperature !== undefined ? { temperature } : {}),
        ...(maxTokens !== undefined ? { max_tokens: maxTokens } : {}),
        ...(responseFormat !== undefined ? { response_format: responseFormat } : {})
      }),
      signal: controller.signal
    });

    const payload = (await openaiResponse.json()) as Record<string, any>;

    if (!openaiResponse.ok) {
      // Surface OpenAI's error message (e.g. invalid key, rate limit) without echoing the key.
      const message = payload?.error?.message ?? "OpenAI request failed.";
      return json(openaiResponse.status, { error: message });
    }

    return json(200, {
      content: payload?.choices?.[0]?.message?.content ?? "",
      model: payload?.model ?? model,
      finishReason: payload?.choices?.[0]?.finish_reason ?? null,
      usage: payload?.usage ?? null
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return json(aborted ? 504 : 502, {
      error: aborted
        ? `OpenAI request timed out after ${REQUEST_TIMEOUT_MS / 1000}s.`
        : "Failed to reach OpenAI."
    });
  } finally {
    clearTimeout(timeout);
  }
};
