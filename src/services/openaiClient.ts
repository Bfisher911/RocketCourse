// Browser-side helper for talking to OpenAI *through* our Netlify Function proxy
// (netlify/functions/openai.ts). The secret OPENAI_API_KEY lives only on the server,
// so this file never sees or sends it — it just POSTs chat messages to our own endpoint.

export type ChatRole = "system" | "developer" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatCompletionRequest {
  messages: ChatMessage[];
  /** Overrides the server default (OPENAI_MODEL env, else gpt-4o-mini). */
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Passed through to OpenAI, e.g. { type: "json_object" } for JSON-mode output. */
  responseFormat?: Record<string, unknown>;
  /** Telemetry: which builder stage is spending the tokens (logged server-side, e.g. "quizDraft"). */
  jobType?: string;
  /** Telemetry: CourseProject id, so spend can be grouped per course. */
  courseId?: string;
  /** Allows the caller to cancel the request (e.g. on unmount). */
  signal?: AbortSignal;
}

export interface ChatCompletionUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

/** Server-computed spend for the call (priced from usage). Echoed back for live cost display. */
export interface ChatCompletionCost {
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  costMicroUsd: number;
  costCents: number;
}

export interface ChatCompletionResult {
  content: string;
  model: string;
  finishReason: string | null;
  usage: ChatCompletionUsage | null;
  cost?: ChatCompletionCost | null;
}

export const OPENAI_PROXY_ENDPOINT = "/.netlify/functions/openai";

// The proxy is auth-gated (it spends real tokens), so attach the user's Supabase access token.
// Unauthenticated callers get a 401 and the caller's `withFallback` runs the deterministic path.
const sessionToken = async (): Promise<string | null> => {
  const { getSupabaseClient } = await import("./supabaseClient");
  const client = await getSupabaseClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session?.access_token ?? null;
};

/**
 * Send chat messages to OpenAI via the server proxy.
 * Throws an Error (with the server's message) on any non-2xx response.
 */
export const requestChatCompletion = async (request: ChatCompletionRequest): Promise<ChatCompletionResult> => {
  const { signal, ...payload } = request;
  const token = await sessionToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(OPENAI_PROXY_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new Error(
      "Could not reach the OpenAI proxy. If you're running locally, start the app with `netlify dev` (plain `vite` does not serve Netlify Functions)."
    );
  }

  const data = (await response.json().catch(() => null)) as
    | (ChatCompletionResult & { error?: string })
    | { error?: string }
    | null;

  if (!response.ok) {
    throw new Error(data?.error ?? `OpenAI proxy returned ${response.status}.`);
  }

  return data as ChatCompletionResult;
};

/**
 * Convenience: turn a prompt template's instruction fields plus a filled-in user
 * prompt into a `messages` array. Developer instructions are sent as a second system
 * message for broad model compatibility (not every model accepts the `developer` role).
 */
export const buildChatMessages = (
  userPrompt: string,
  instructions: { systemInstructions?: string; developerInstructions?: string } = {}
): ChatMessage[] => {
  const messages: ChatMessage[] = [];
  if (instructions.systemInstructions?.trim()) {
    messages.push({ role: "system", content: instructions.systemInstructions.trim() });
  }
  if (instructions.developerInstructions?.trim()) {
    messages.push({ role: "system", content: instructions.developerInstructions.trim() });
  }
  messages.push({ role: "user", content: userPrompt });
  return messages;
};
