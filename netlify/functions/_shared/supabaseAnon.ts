// Anon-key Supabase clients for the functions. Used to (a) verify a caller's JWT and (b) read
// RLS-scoped rows AS that user — neither needs the service-role key, so AI generation works before
// the service-role key is configured. (Trusted WRITES still go through supabaseAdmin.)

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";

declare const process: { env: Record<string, string | undefined> };

// Netlify Functions run Node 20 (no native WebSocket); supabase-js's Realtime client construction
// throws without one. Supply `ws` (Realtime is never used server-side).
const realtime = { transport: WebSocket };

const url = (): string =>
  process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim() || "";
const anonKey = (): string =>
  process.env.SUPABASE_ANON_KEY?.trim() || process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || "";

let cached: SupabaseClient | null = null;

export const getSupabaseAnon = (): SupabaseClient => {
  if (cached) return cached;
  if (!url() || !anonKey()) throw new Error("Supabase is not configured (URL + publishable key).");
  cached = createClient(url(), anonKey(), { auth: { persistSession: false, autoRefreshToken: false }, realtime });
  return cached;
};

/** A client that acts AS the given user (RLS enforced) by attaching their access token. */
export const getSupabaseForUser = (token: string): SupabaseClient =>
  createClient(url(), anonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
    realtime
  });
