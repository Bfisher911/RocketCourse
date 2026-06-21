import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

export const supabaseConfig = {
  url: supabaseUrl,
  publishableKey: supabasePublishableKey,
  isConfigured: Boolean(supabaseUrl && supabasePublishableKey)
};

let client: SupabaseClient | null = null;

export const getSupabaseClient = async (): Promise<SupabaseClient | null> => {
  if (!supabaseConfig.isConfigured) return null;
  if (client) return client;

  const { createClient } = await import("@supabase/supabase-js");
  client = createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
  return client;
};
