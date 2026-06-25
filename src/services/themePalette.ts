// Palette intelligence: turn a single brand/accent color into a full, harmonious export palette —
// tints, shades, surfaces, and semantic colors (success/info/warning/danger) that all sit in the
// theme's color world. So a custom theme or institutional brand kit only needs ONE color picked and
// everything generated downstream stays coherent. Pure color math (utils/color); no rendering here.

import { bestTextOn, darken, lighten, mix } from "../utils/color";

export interface SemanticPair {
  /** Strong foreground/border color. */
  base: string;
  /** Very light fill for the note/badge background. */
  soft: string;
}

export interface DerivedPalette {
  accent: string;
  accentDark: string;
  accentLight: string;
  /** Soft tinted panel background (cards, callouts). */
  soft: string;
  /** Near-white page surface with the faintest accent warmth. */
  surface: string;
  onAccent: "#ffffff" | "#0b1020";
  /** Light → strong tints (accent mixed toward white). */
  tints: string[];
  /** Light → deep shades (accent mixed toward black). */
  shades: string[];
  success: SemanticPair;
  info: SemanticPair;
  warning: SemanticPair;
  danger: SemanticPair;
}

// Canonical semantic hues, nudged a touch toward the accent so they feel part of the same family
// without losing their universal meaning (green=ok, blue=info, amber=warn, red=danger).
const semantic = (accent: string, base: string): SemanticPair => {
  const harmonized = mix(base, accent, 0.08);
  return { base: harmonized, soft: mix(harmonized, "#ffffff", 0.86) };
};

/** Derive a complete palette from one accent (and an optional explicit dark). */
export const derivePalette = (accent: string, accentDark?: string): DerivedPalette => ({
  accent,
  accentDark: accentDark ?? darken(accent, 0.22),
  accentLight: lighten(accent, 0.34),
  soft: lighten(accent, 0.88),
  surface: lighten(accent, 0.965),
  onAccent: bestTextOn(accent),
  tints: [0.85, 0.7, 0.5, 0.3, 0.15].map((t) => lighten(accent, t)),
  shades: [0.1, 0.22, 0.34, 0.48, 0.62].map((t) => darken(accent, t)),
  success: semantic(accent, "#15803d"),
  info: semantic(accent, "#2563eb"),
  warning: semantic(accent, "#b45309"),
  danger: semantic(accent, "#b91c1c")
});

/** Just the four semantic pairs (for note/badge styling that wants to stay theme-harmonized). */
export const semanticColors = (accent: string): Pick<DerivedPalette, "success" | "info" | "warning" | "danger"> => {
  const p = derivePalette(accent);
  return { success: p.success, info: p.info, warning: p.warning, danger: p.danger };
};
