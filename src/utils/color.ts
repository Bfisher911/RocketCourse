// Small, dependency-free color helpers used by the homepage template system and its
// validation. They let templates choose readable text colors automatically and let the
// homepage validator estimate WCAG contrast so generated buttons stay legible across every
// course theme.

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

// Parse #rgb / #rrggbb (with or without leading #). Returns null for anything we can't read so
// callers can fall back rather than crash on a hand-edited value.
export const parseHex = (value: string): Rgb | null => {
  const hex = value.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    return {
      r: parseInt(hex[0] + hex[0], 16),
      g: parseInt(hex[1] + hex[1], 16),
      b: parseInt(hex[2] + hex[2], 16)
    };
  }
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16)
    };
  }
  return null;
};

// WCAG relative luminance (sRGB). https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
export const relativeLuminance = (color: Rgb): number => {
  const channel = (value: number): number => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
};

// WCAG contrast ratio between two colors, 1 (none) to 21 (black on white). Accepts hex strings.
export const contrastRatio = (foreground: string, background: string): number => {
  const fg = parseHex(foreground);
  const bg = parseHex(background);
  if (!fg || !bg) return 1;
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
};

// True when a color is light enough that dark text reads better on top of it.
export const isLight = (value: string): boolean => {
  const rgb = parseHex(value);
  if (!rgb) return false;
  return relativeLuminance(rgb) > 0.4;
};

// Pick black or white (whichever has higher contrast) for text drawn on `background`. Keeps
// every generated button label readable regardless of the chosen theme accent.
export const bestTextOn = (background: string): "#ffffff" | "#0b1020" => {
  const dark = "#0b1020";
  const light = "#ffffff";
  return contrastRatio(light, background) >= contrastRatio(dark, background) ? light : dark;
};

// AA for normal text is 4.5:1; AA for large/bold text (used by buttons and headings) is 3:1.
export const meetsAaLarge = (foreground: string, background: string): boolean => contrastRatio(foreground, background) >= 3;
export const meetsAaNormal = (foreground: string, background: string): boolean => contrastRatio(foreground, background) >= 4.5;

// Translucent rgba() from a hex color. Used to lay soft, theme-tinted washes over white Canvas
// pages (accent glows, zebra rows, chip fills) that stay readable on any theme. Falls back to the
// input when it can't be parsed.
export const withAlpha = (value: string, alpha: number): string => {
  const rgb = parseHex(value);
  if (!rgb) return value;
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
};

// Mix a color toward black by `amount` (0–1). Used to derive a darker accent for custom themes so
// the user only has to pick one primary color. Returns the input unchanged if it can't be parsed.
export const darken = (value: string, amount: number): string => {
  const rgb = parseHex(value);
  if (!rgb) return value;
  const factor = Math.max(0, Math.min(1, 1 - amount));
  const channel = (n: number): string =>
    Math.round(Math.max(0, Math.min(255, n * factor)))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(rgb.r)}${channel(rgb.g)}${channel(rgb.b)}`;
};

const toHexChannel = (n: number): string =>
  Math.round(Math.max(0, Math.min(255, n)))
    .toString(16)
    .padStart(2, "0");

/** `#rrggbb` from an Rgb. */
export const rgbToHex = ({ r, g, b }: Rgb): string => `#${toHexChannel(r)}${toHexChannel(g)}${toHexChannel(b)}`;

/** Mix a color toward white by `amount` (0–1) — the lighten counterpart to `darken`. */
export const lighten = (value: string, amount: number): string => {
  const rgb = parseHex(value);
  if (!rgb) return value;
  const t = Math.max(0, Math.min(1, amount));
  return rgbToHex({ r: rgb.r + (255 - rgb.r) * t, g: rgb.g + (255 - rgb.g) * t, b: rgb.b + (255 - rgb.b) * t });
};

/** Linear blend of two colors. `t=0` → a, `t=1` → b. Falls back to `a` if either can't be parsed. */
export const mix = (a: string, b: string, t: number): string => {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return a;
  const k = Math.max(0, Math.min(1, t));
  return rgbToHex({ r: ca.r + (cb.r - ca.r) * k, g: ca.g + (cb.g - ca.g) * k, b: ca.b + (cb.b - ca.b) * k });
};

const rgbToHsl = ({ r, g, b }: Rgb): { h: number; s: number; l: number } => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h: h * 360, s, l };
};

const hslToRgb = (h: number, s: number, l: number): Rgb => {
  const hue = ((h % 360) + 360) % 360 / 360;
  if (s === 0) return { r: l * 255, g: l * 255, b: l * 255 };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number): number => {
    let tc = t;
    if (tc < 0) tc += 1;
    if (tc > 1) tc -= 1;
    if (tc < 1 / 6) return p + (q - p) * 6 * tc;
    if (tc < 1 / 2) return q;
    if (tc < 2 / 3) return p + (q - p) * (2 / 3 - tc) * 6;
    return p;
  };
  return { r: channel(hue + 1 / 3) * 255, g: channel(hue) * 255, b: channel(hue - 1 / 3) * 255 };
};

/**
 * Rotate a color's hue by `degrees` while preserving saturation + lightness. Used to give each
 * module a sibling-but-distinct accent (Module 3 ≠ Module 7) without leaving the theme's color world.
 */
export const shiftHue = (value: string, degrees: number): string => {
  const rgb = parseHex(value);
  if (!rgb) return value;
  const { h, s, l } = rgbToHsl(rgb);
  return rgbToHex(hslToRgb(h + degrees, s, l));
};
