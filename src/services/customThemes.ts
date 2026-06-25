// Custom (school) themes: turn a few instructor inputs into a valid app Theme, and persist them to
// Supabase `custom_themes` (RLS-scoped to the owner). The whole derived Theme is stored in
// theme_json so it round-trips exactly; individual colors live in columns for future querying.
// No-ops gracefully in local-dev mode (no Supabase) — the theme still applies in-session.

import { getSupabaseClient, supabaseConfig } from "./supabaseClient";
import { meetsAaNormal } from "../utils/color";
import { derivePalette } from "./themePalette";
import type { Theme } from "../types";

export interface CustomThemeInput {
  name: string;
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  institutionName?: string;
  /** Optional small logo as a data URL (capped client-side); shown on the preview + stored. */
  logoDataUrl?: string;
}

export interface SavedCustomTheme {
  id: string;
  theme: Theme;
  logoUrl?: string;
}

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32) || "theme";

/**
 * Derive a complete, valid app Theme from the friendly custom inputs. Pure + deterministic.
 * Palette intelligence (themePalette) turns the single primary color into a harmonious gradient +
 * darker accent, so a school/brand color picks up the same hero/card richness as the built-in
 * presets instead of a flat accent. The instructor's chosen background/text colors are respected.
 */
export const buildThemeFromCustom = (input: CustomThemeInput): Theme => {
  const accent = input.primaryColor;
  const palette = derivePalette(accent);
  return {
    id: `custom_${slugify(input.name)}`,
    name: input.name.trim() || "Custom theme",
    accent,
    accentDark: palette.accentDark,
    soft: input.backgroundColor,
    contrastText: input.textColor,
    bannerLabel: (input.institutionName || input.name).trim() || "Custom theme",
    contrastStatus: meetsAaNormal(input.textColor, input.backgroundColor) ? "pass" : "review",
    // Give custom themes a real two-stop hero gradient + a tasteful default hero/card personality.
    gradientFrom: accent,
    gradientTo: palette.shades[2],
    heroStyle: "banner",
    cardStyle: "accent-bar"
  };
};

const currentUserId = async (): Promise<string | null> => {
  const client = await getSupabaseClient();
  if (!client) return null;
  const { data } = await client.auth.getUser();
  return data.user?.id ?? null;
};

export const customThemesEnabled = (): boolean => supabaseConfig.isConfigured;

/** Load the signed-in user's saved custom themes (RLS scopes to owner). Empty if none/unavailable. */
export const listCustomThemes = async (): Promise<SavedCustomTheme[]> => {
  const client = await getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client
    .from("custom_themes")
    .select("id,theme_json,logo_url")
    .order("updated_at", { ascending: false });
  if (error || !data) return [];
  return data
    .map((row): SavedCustomTheme | null => {
      const theme = row.theme_json as Theme | null;
      if (!theme || !theme.id) return null;
      return { id: row.id as string, theme, logoUrl: (row.logo_url as string | null) ?? undefined };
    })
    .filter((value): value is SavedCustomTheme => value !== null);
};

/** Persist a custom theme for the signed-in user. Returns the derived Theme on success. */
export const saveCustomTheme = async (
  input: CustomThemeInput
): Promise<{ ok: boolean; theme?: Theme; error?: string }> => {
  const theme = buildThemeFromCustom(input);
  const client = await getSupabaseClient();
  if (!client) return { ok: true, theme }; // local mode: applies in-session, not persisted
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Sign in to save a theme." };

  const { error } = await client.from("custom_themes").insert({
    owner_id: userId,
    name: theme.name,
    primary_color: input.primaryColor,
    accent_color: theme.accentDark,
    background_color: input.backgroundColor,
    text_color: input.textColor,
    logo_url: input.logoDataUrl ?? null,
    theme_json: theme
  });
  return error ? { ok: false, error: error.message } : { ok: true, theme };
};
