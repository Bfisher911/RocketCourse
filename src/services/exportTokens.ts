// Export design tokens — the single tuned scale every Canvas-safe block is built on, so spacing,
// type, radius, and elevation feel like one system instead of per-function guesses. These are plain
// numbers/strings (no CSS variables — Canvas can strip <style>/:root), inlined by the renderers.

/** 4px-based spacing scale (px). Use SPACE.md for standard block padding, SPACE.lg between sections. */
export const SPACE = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 36,
  xxl: 56
} as const;

/** Type ramp (px) — a major-third-ish scale so headings and body relate. */
export const TYPE = {
  /** Eyebrow / kicker / uppercase label. */
  eyebrow: 12,
  caption: 13,
  small: 14,
  body: 16,
  lead: 18,
  h3: 20,
  h2: 24,
  h1: 34,
  display: 44
} as const;

/** Corner radius scale (px). `pill` for chips/buttons, `card` for sections, `hero` for banners. */
export const RADIUS = {
  sm: 8,
  card: 14,
  lg: 16,
  hero: 18,
  pill: 999
} as const;

/** Font weights, named so intent is obvious at call sites. */
export const WEIGHT = {
  regular: 400,
  medium: 600,
  bold: 800,
  black: 900
} as const;

/** Letter-spacing for uppercase labels/eyebrows. */
export const TRACKING = {
  label: "0.1em",
  tight: "0.05em"
} as const;

/** Soft, layered shadows (kept subtle so Canvas's white page stays clean). */
export const ELEVATION = {
  none: "none",
  sm: "0 1px 2px rgba(16, 24, 40, 0.06), 0 4px 12px rgba(16, 24, 40, 0.06)",
  md: "0 4px 10px rgba(16, 24, 40, 0.08), 0 14px 32px rgba(16, 24, 40, 0.10)",
  lg: "0 10px 24px rgba(16, 24, 40, 0.12), 0 24px 56px rgba(16, 24, 40, 0.14)"
} as const;

/** Max readable measure for body copy. */
export const MEASURE = "62ch";

/** Convenience: `${px(SPACE.md)}` → "16px". */
export const px = (n: number): string => `${n}px`;
