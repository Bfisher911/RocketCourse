// Server-only Supabase client using the SERVICE ROLE key (bypasses RLS). Used by the Stripe
// webhook and entitlement checks to read/write trusted rows. NEVER import this from client code —
// it would leak the service role key. Bundled by Netlify esbuild, not the Vite/tsc app build.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";

declare const process: { env: Record<string, string | undefined> };

let cached: SupabaseClient | null = null;

export const getSupabaseAdmin = (): SupabaseClient => {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim() || "";
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  if (!url || !serviceRole) {
    throw new Error("Supabase admin is not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  cached = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
    // Netlify Functions run Node 20 (no native WebSocket); supply `ws` so supabase-js's Realtime
    // client construction doesn't throw. We never use Realtime server-side.
    realtime: { transport: WebSocket }
  });
  return cached;
};
