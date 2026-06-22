// Small HTTP + auth helpers shared by the Netlify Functions. Verifying the caller's Supabase JWT
// here is what makes server-side entitlement trustworthy: the browser proves identity with its
// access token, the server resolves the real user, and entitlement is checked against the DB.
//
// We verify by calling GoTrue's /auth/v1/user endpoint directly (a plain fetch) rather than
// supabase-js auth.getUser(jwt) — the latter does local issuer validation that misbehaves with the
// new publishable-key format. Direct verification needs no service-role key, so AI generation works
// before billing creds are configured. Trusted writes still use supabaseAdmin (service role).

declare const process: { env: Record<string, string | undefined> };

export interface AuthedUser {
  id: string;
  email: string;
  /** The caller's raw access token, for making further RLS-scoped reads as this user. */
  token: string;
}

export const json = (status: number, body: Record<string, unknown>): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const supabaseUrl = (): string =>
  (process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim() || "").replace(/\/$/, "");
const anonKey = (): string =>
  process.env.SUPABASE_ANON_KEY?.trim() || process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || "";

const bearer = (request: Request): string | null => {
  const header = request.headers.get("authorization") || request.headers.get("Authorization");
  return header?.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : null;
};

/** Resolve the signed-in user from the Authorization: Bearer <jwt> header. Null if missing/invalid. */
export const getAuthedUser = async (request: Request): Promise<AuthedUser | null> => {
  const token = bearer(request);
  if (!token) return null;
  const url = supabaseUrl();
  const key = anonKey();
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return null;
    const user = (await res.json()) as { id?: string; email?: string };
    if (!user?.id) return null;
    return { id: user.id, email: user.email ?? "", token };
  } catch {
    return null;
  }
};
