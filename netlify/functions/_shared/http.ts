// Small HTTP + auth helpers shared by the Netlify Functions. Verifying the caller's Supabase JWT
// here is what makes server-side entitlement trustworthy: the browser proves identity with its
// access token, the server resolves the real user, and entitlement is checked against the DB.

import { getSupabaseAdmin } from "./supabaseAdmin";

export interface AuthedUser {
  id: string;
  email: string;
}

export const json = (status: number, body: Record<string, unknown>): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Resolve the signed-in user from the Authorization: Bearer <jwt> header. Null if missing/invalid. */
export const getAuthedUser = async (request: Request): Promise<AuthedUser | null> => {
  const header = request.headers.get("authorization") || request.headers.get("Authorization");
  const token = header?.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : null;
  if (!token) return null;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? "" };
};
