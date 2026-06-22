// Anon-key Supabase clients for the functions. Used to (a) verify a caller's JWT and (b) read
// RLS-scoped rows AS that user — neither needs the service-role key, so AI generation works before
// the service-role key is configured. (Trusted WRITES still go through supabaseAdmin.)

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare const process: { env: Record<string, string | undefined> };

const url = (): string =>
  process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim() || "";
const anonKey = (): string =>
  process.env.SUPABASE_ANON_KEY?.trim() || process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || "";

let cached: SupabaseClient | null = null;

export const getSupabaseAnon = (): SupabaseClient => {
  if (cached) return cached;
  if (!url() || !anonKey()) throw new Error("Supabase is not configured (URL + publishable key).");
  cached = createClient(url(), anonKey(), { auth: { persistSession: false, autoRefreshToken: false } });
  return cached;
};

/** A client that acts AS the given user (RLS enforced) by attaching their access token. */
export const getSupabaseForUser = (token: string): SupabaseClient =>
  createClient(url(), anonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
