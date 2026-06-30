import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

// The committed .env.example ships placeholder values; treat those (and any obviously-templated
// value) as "not configured" so the app falls back to local-dev mode instead of trying to reach a
// fake URL. Real credentials flip this to true automatically.
const isPlaceholder = (value: string): boolean =>
  !value || /your-project-ref|your_key_here|your-key-here|xxx|example\.supabase/i.test(value);

const looksLikeSupabaseUrl = (value: string): boolean => /^https:\/\/[a-z0-9]+\.supabase\.(co|in)/i.test(value);

export const supabaseConfig = {
  url: supabaseUrl,
  publishableKey: supabasePublishableKey,
  isConfigured:
    looksLikeSupabaseUrl(supabaseUrl) && !isPlaceholder(supabaseUrl) && !isPlaceholder(supabasePublishableKey)
};

let client: SupabaseClient | null = null;
let clientPromise: Promise<SupabaseClient | null> | null = null;

export const getSupabaseClient = async (): Promise<SupabaseClient | null> => {
  if (!supabaseConfig.isConfigured) return null;
  if (client) return client;
  if (clientPromise) return clientPromise;

  clientPromise = import("@supabase/supabase-js").then(({ createClient }) => {
    client = createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    return client;
  });

  return clientPromise;
};
