import { afterEach, describe, expect, it, vi } from "vitest";

describe("supabase client", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("shares one browser client across concurrent callers", async () => {
    const createClient = vi.fn(() => ({ from: vi.fn() }));
    vi.doMock("@supabase/supabase-js", () => ({ createClient }));
    vi.stubEnv("VITE_SUPABASE_URL", "https://abc123.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "publishable-key");

    const { getSupabaseClient } = await import("./supabaseClient");
    const clients = await Promise.all([getSupabaseClient(), getSupabaseClient(), getSupabaseClient()]);

    expect(createClient).toHaveBeenCalledTimes(1);
    expect(clients[0]).toBe(clients[1]);
    expect(clients[1]).toBe(clients[2]);
  });
});
