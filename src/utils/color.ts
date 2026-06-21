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
