import type { Theme, ThemeCardStyle, ThemeFont, ThemeHeroStyle, ThemeMotif, ThemePattern } from "../types";
import { bestTextOn, contrastRatio, withAlpha } from "../utils/color";
import { escapeXml } from "../utils/text";

export type ThemeValidationStatus = "pass" | "review";
export type ThemePreviewKind = "homepage" | "syllabus" | "assignment" | "quiz" | "rubric";

export interface ThemeStyles {
  accent: string;
  accentDark: string;
  soft: string;
  contrastText: string;
  onAccent: string;
  onAccentDark: string;
  border: string;
  canvasText: string;
  mutedText: string;
  canvasBackground: string;
  gradientFrom: string;
  gradientTo: string;
  pattern: ThemePattern;
  motif: ThemeMotif;
  onGradient: string;
  font: string;
  heroStyle: ThemeHeroStyle;
  cardStyle: ThemeCardStyle;
}

// Canvas-safe system font stacks (no @font-face / web fonts). "sans" matches the legacy look exactly,
// so any theme without a fontFamily renders identically to before.
const fontStack = (font: ThemeFont | undefined): string => {
  switch (font) {
    case "serif":
      return "Georgia, 'Times New Roman', Cambria, serif";
    case "mono":
      return "'DejaVu Sans Mono', 'SFMono-Regular', Menlo, Consolas, 'Courier New', monospace";
    case "rounded":
      return "'Trebuchet MS', 'Segoe UI', 'Lato', Verdana, sans-serif";
    default:
      return "'Lato', 'Helvetica Neue', Helvetica, Arial, sans-serif";
  }
};

// Pick #ffffff or #0b1020 — whichever keeps the WORST contrast across both gradient stops highest —
// so hero text stays readable no matter where it sits over the gradient.
const textForGradient = (from: string, to: string): string => {
  const white = "#ffffff";
  const dark = "#0b1020";
  const whiteMin = Math.min(contrastRatio(white, from), contrastRatio(white, to));
  const darkMin = Math.min(contrastRatio(dark, from), contrastRatio(dark, to));
  return whiteMin >= darkMin ? white : dark;
};

// A subtle texture as a pure-CSS background layer (no url(), which Canvas may strip). Returns the
// background-image fragment and its size, meant to sit ON TOP of the hero gradient.
const patternLayer = (pattern: ThemePattern, ink: string): { image: string; size: string } | null => {
  switch (pattern) {
    case "dots":
      return { image: `radial-gradient(${ink} 1.4px, transparent 1.6px)`, size: "18px 18px" };
    case "grid":
      return { image: `linear-gradient(${ink} 1px, transparent 1px), linear-gradient(90deg, ${ink} 1px, transparent 1px)`, size: "22px 22px" };
    case "diagonal":
      return { image: `repeating-linear-gradient(45deg, ${ink} 0, ${ink} 1px, transparent 1px, transparent 12px)`, size: "auto" };
    case "crosshatch":
      return {
        image: `repeating-linear-gradient(45deg, ${ink} 0 1px, transparent 1px 11px), repeating-linear-gradient(-45deg, ${ink} 0 1px, transparent 1px 11px)`,
        size: "auto"
      };
    default:
      return null;
  }
};

// The full hero background: the theme gradient, a soft corner glow for depth, optionally textured
// with a pattern. Pure inline CSS (gradients only — never url(), which Canvas can strip).
export const heroBackgroundCss = (styles: ThemeStyles): string => {
  const gradient = `linear-gradient(135deg, ${styles.gradientFrom} 0%, ${styles.gradientTo} 100%)`;
  // A bright top-right glow + a subtle bottom-left lift give the flat gradient real dimension.
  const glowTop =
    styles.onGradient === "#ffffff"
      ? "radial-gradient(1100px 380px at 85% -25%, rgba(255,255,255,0.26), transparent 60%)"
      : "radial-gradient(1100px 380px at 85% -25%, rgba(255,255,255,0.40), transparent 60%)";
  const glowBottom = "radial-gradient(700px 260px at 5% 120%, rgba(0,0,0,0.18), transparent 60%)";
  const ink = styles.onGradient === "#ffffff" ? "rgba(255,255,255,0.13)" : "rgba(0,0,0,0.10)";
  const layer = patternLayer(styles.pattern, ink);
  const images = layer ? `${layer.image}, ${glowTop}, ${glowBottom}, ${gradient}` : `${glowTop}, ${glowBottom}, ${gradient}`;
  const sizes = layer ? `${layer.size}, auto, auto, auto` : "auto, auto, auto";
  return `background-color: ${styles.gradientTo}; background-image: ${images}; background-size: ${sizes};`;
};

export interface ThemeContrastCheck {
  id: string;
  label: string;
  foreground: string;
  background: string;
  ratio: number;
  required: number;
  passed: boolean;
  detail: string;
}

export interface ThemeValidationResult {
  status: ThemeValidationStatus;
  score: number;
  checks: ThemeContrastCheck[];
  warnings: number;
}

const escHtml = (value: string): string => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (value: string): string => escHtml(value).replace(/"/g, "&quot;");
const safeHref = (href: string): string => {
  const trimmed = String(href ?? "").trim();
  if (!trimmed) return "#";
  if (/^(javascript|vbscript):/i.test(trimmed)) return "#";
  if (/^data:/i.test(trimmed) && !/^data:image\//i.test(trimmed)) return "#";
  return trimmed;
};

export const getThemeStyles = (theme: Theme): ThemeStyles => {
  const gradientFrom = theme.gradientFrom ?? theme.accent;
  const gradientTo = theme.gradientTo ?? theme.accentDark;
  return {
    accent: theme.accent,
    accentDark: theme.accentDark,
    soft: theme.soft,
    contrastText: theme.contrastText,
    onAccent: bestTextOn(theme.accent),
    onAccentDark: bestTextOn(theme.accentDark),
    border: "#dbe4f0",
    canvasText: "#111827",
    mutedText: "#374151",
    canvasBackground: "#ffffff",
    gradientFrom,
    gradientTo,
    pattern: theme.pattern ?? "none",
    motif: theme.motif ?? "none",
    onGradient: textForGradient(gradientFrom, gradientTo),
    font: fontStack(theme.fontFamily),
    heroStyle: theme.heroStyle ?? "banner",
    cardStyle: theme.cardStyle ?? "elevated"
  };
};

// SVG <pattern> overlay for the banner — mirrors the CSS patternLayer, drawn in white at low opacity
// over the gradient. Returns the <pattern> def + the fill rect, or empty strings when pattern is "none".
const svgBannerPattern = (pattern: ThemePattern): { def: string; rect: string } => {
  const ink = "#ffffff";
  switch (pattern) {
    case "dots":
      return { def: `<pattern id="pat" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="13" cy="13" r="2" fill="${ink}" opacity="0.10"/></pattern>`, rect: `<rect width="1440" height="360" fill="url(#pat)"/>` };
    case "grid":
      return { def: `<pattern id="pat" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0 H0 V40" fill="none" stroke="${ink}" stroke-width="1" opacity="0.09"/></pattern>`, rect: `<rect width="1440" height="360" fill="url(#pat)"/>` };
    case "diagonal":
      return { def: `<pattern id="pat" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M0 28 L28 0" stroke="${ink}" stroke-width="3" opacity="0.08"/></pattern>`, rect: `<rect width="1440" height="360" fill="url(#pat)"/>` };
    case "crosshatch":
      return { def: `<pattern id="pat" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M0 22 L22 0 M-2 2 L2 -2 M20 24 L24 20" stroke="${ink}" stroke-width="2" opacity="0.08"/></pattern>`, rect: `<rect width="1440" height="360" fill="url(#pat)"/>` };
    default:
      return { def: "", rect: "" };
  }
};

// Decorative banner illustration per motif, drawn over the gradient on the RIGHT side (the white
// title card sits at x 96–736, so motif art stays clear of it). White at low opacity reads on every
// dark gradient. "none" keeps the original soft circles so existing themes are unchanged.
const motifBannerArt = (motif: ThemeMotif): string => {
  switch (motif) {
    case "cosmic":
      return `
  <g fill="none" stroke="#ffffff" opacity="0.16"><ellipse cx="1170" cy="180" rx="195" ry="72" stroke-width="2.5" transform="rotate(-18 1170 180)"/><circle cx="1300" cy="70" r="150" stroke-width="2"/></g>
  <circle cx="1170" cy="180" r="68" fill="#ffffff" opacity="0.16"/>
  <circle cx="1150" cy="158" r="16" fill="#ffffff" opacity="0.10"/>
  <circle cx="1356" cy="146" r="13" fill="#ffffff" opacity="0.55"/>
  <g fill="#ffffff">
    <circle cx="840" cy="70" r="3" opacity="0.6"/><circle cx="980" cy="300" r="2.5" opacity="0.5"/><circle cx="1240" cy="300" r="2.5" opacity="0.5"/><circle cx="1390" cy="250" r="3" opacity="0.55"/><circle cx="900" cy="200" r="2" opacity="0.4"/>
    <path d="M1040 90 l3 9 l9 3 l-9 3 l-3 9 l-3 -9 l-9 -3 l9 -3 z" opacity="0.7"/>
    <path d="M1330 300 l2.5 7 l7 2.5 l-7 2.5 l-2.5 7 l-2.5 -7 l-7 -2.5 l7 -2.5 z" opacity="0.55"/>
  </g>`;
    case "circuit":
      return `
  <g fill="none" stroke="#ffffff" stroke-width="3" opacity="0.20"><path d="M820 80 H1010 V210 H1210"/><path d="M1250 60 V150 H1380"/><path d="M880 300 H1080 V230"/><path d="M1210 210 H1320 V300"/></g>
  <g fill="#ffffff" opacity="0.75"><circle cx="820" cy="80" r="6"/><circle cx="1010" cy="210" r="6"/><circle cx="1210" cy="210" r="6"/><circle cx="1380" cy="150" r="6"/><circle cx="880" cy="300" r="6"/><circle cx="1320" cy="300" r="6"/></g>
  <rect x="1150" y="120" width="120" height="92" rx="12" fill="#ffffff" opacity="0.12"/>
  <g stroke="#ffffff" stroke-width="3" opacity="0.30"><path d="M1150 145 H1130 M1150 175 H1130 M1270 145 H1290 M1270 175 H1290 M1180 120 V100 M1240 120 V100"/></g>`;
    case "lab":
      return `
  <g opacity="0.9">
    <path d="M1175 90 h54 v66 l52 104 a12 12 0 0 1 -11 17 h-136 a12 12 0 0 1 -11 -17 l52 -104 z" fill="#ffffff" opacity="0.13" stroke="#ffffff" stroke-width="2.5"/>
    <path d="M1129 234 l24 -48 h98 l24 48 a12 12 0 0 1 -11 17 h-124 a12 12 0 0 1 -11 -17 z" fill="#ffffff" opacity="0.24"/>
    <line x1="1169" y1="90" x2="1235" y2="90" stroke="#ffffff" stroke-width="4" opacity="0.5"/>
    <circle cx="1190" cy="214" r="6" fill="#ffffff" opacity="0.5"/><circle cx="1214" cy="198" r="4" fill="#ffffff" opacity="0.45"/><circle cx="1170" cy="196" r="3.5" fill="#ffffff" opacity="0.4"/>
  </g>
  <g fill="none" stroke="#ffffff" stroke-width="2.5" opacity="0.22"><polygon points="900,150 940,128 980,150 980,194 940,216 900,194"/></g>
  <g fill="#ffffff" opacity="0.5"><circle cx="900" cy="150" r="5"/><circle cx="980" cy="194" r="5"/></g>`;
    case "botanical":
      return `
  <g opacity="0.9">
    <path d="M1300 80 C1190 116 1170 250 1290 312 C1380 256 1388 138 1300 80 z" fill="#ffffff" opacity="0.13"/>
    <path d="M1300 80 C1292 160 1288 244 1290 312" stroke="#ffffff" stroke-width="2" fill="none" opacity="0.3"/>
    <path d="M1300 140 C1330 150 1352 142 1366 124 M1296 196 C1326 208 1350 202 1366 184 M1294 250 C1322 262 1346 258 1360 242" stroke="#ffffff" stroke-width="2" fill="none" opacity="0.25"/>
    <path d="M840 330 C940 280 1020 320 1120 286" stroke="#ffffff" stroke-width="2.5" fill="none" opacity="0.22"/>
    <path d="M960 304 q-10 -26 16 -34 q6 26 -16 34 z M1050 300 q-10 -26 16 -34 q6 26 -16 34 z" fill="#ffffff" opacity="0.2"/>
  </g>`;
    case "blueprint":
      return `
  <g stroke="#ffffff" fill="none" opacity="0.22" stroke-width="2">
    <circle cx="1190" cy="186" r="118"/>
    <line x1="1190" y1="56" x2="1190" y2="316"/><line x1="1060" y1="186" x2="1320" y2="186"/>
    <path d="M1190 92 L1146 280 M1190 92 L1234 280"/>
    <rect x="860" y="240" width="180" height="80"/><line x1="860" y1="300" x2="1040" y2="300"/>
  </g>
  <g fill="#ffffff" opacity="0.55"><circle cx="1190" cy="92" r="6"/><circle cx="1190" cy="186" r="4"/></g>
  <g stroke="#ffffff" stroke-width="2" opacity="0.3"><path d="M820 90 h40 m-20 -20 v40"/></g>`;
    case "wave":
      return `
  <g fill="#ffffff">
    <path d="M0 300 C200 270 360 332 560 302 C760 272 960 332 1160 302 C1300 282 1380 312 1440 300 L1440 360 L0 360 z" opacity="0.12"/>
    <path d="M0 330 C240 302 420 352 640 328 C880 302 1080 352 1440 328 L1440 360 L0 360 z" opacity="0.18"/>
    <circle cx="1250" cy="150" r="7" opacity="0.4"/><circle cx="1300" cy="118" r="5" opacity="0.35"/><circle cx="1210" cy="120" r="4" opacity="0.3"/>
    <path d="M1180 220 q40 -30 80 0 q40 30 80 0" stroke="#ffffff" stroke-width="3" fill="none" opacity="0.25"/>
  </g>`;
    default:
      return `
  <circle cx="1200" cy="84" r="130" fill="#ffffff" opacity="0.08"/>
  <circle cx="1030" cy="320" r="96" fill="#ffffff" opacity="0.06"/>`;
  }
};

// A themed 1440×360 banner SVG: gradient + pattern + motif illustration with a white title card. Used
// verbatim by the .imscc export (web_resources/course-banner.svg) and, as a data URI, by the in-app
// homepage preview, so the two never diverge. Title text sits on a white card, readable for any theme.
export const buildBannerSvg = (title: string, theme: Theme): string => {
  const styles = getThemeStyles(theme);
  const pattern = svgBannerPattern(styles.pattern);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="360" viewBox="0 0 1440 360" role="img" aria-labelledby="bannerTitle bannerDesc">
  <title id="bannerTitle">${escapeXml(title)} course banner</title>
  <desc id="bannerDesc">Gradient banner using the ${escapeXml(theme.name)} theme.</desc>
  <defs>
    <linearGradient id="bannerBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${escapeXml(styles.gradientFrom)}"/>
      <stop offset="1" stop-color="${escapeXml(styles.gradientTo)}"/>
    </linearGradient>
    ${pattern.def}
  </defs>
  <rect width="1440" height="360" fill="url(#bannerBg)"/>
  ${pattern.rect}
  ${motifBannerArt(styles.motif)}
  <rect x="96" y="92" width="640" height="176" rx="18" fill="#ffffff" opacity="0.94"/>
  <text x="132" y="166" font-family="${styles.font}" font-size="44" font-weight="700" fill="#111827">${escapeXml(title)}</text>
  <text x="132" y="214" font-family="${styles.font}" font-size="24" fill="#374151">${escapeXml(theme.bannerLabel)}</text>
</svg>`;
};

const contrastCheck = (id: string, label: string, foreground: string, background: string, required = 4.5): ThemeContrastCheck => {
  const ratio = contrastRatio(foreground, background);
  return {
    id,
    label,
    foreground,
    background,
    ratio,
    required,
    passed: ratio >= required,
    detail: `${ratio.toFixed(1)}:1 contrast against required ${required}:1.`
  };
};

export const validateTheme = (theme: Theme): ThemeValidationResult => {
  const styles = getThemeStyles(theme);
  const checks = [
    contrastCheck("button-text", "Button text on accent", styles.onAccent, styles.accent),
    contrastCheck("accent-heading", "Accent heading on soft background", styles.accentDark, styles.soft),
    contrastCheck("body-on-soft", "Body text on soft background", styles.contrastText, styles.soft),
    contrastCheck("link-on-white", "Link text on white", styles.accentDark, styles.canvasBackground),
    contrastCheck("dark-on-accent", "Text on dark accent", styles.onAccentDark, styles.accentDark),
    // Hero heading is large bold text, so the 3:1 large-text threshold applies; the text color must
    // clear it against BOTH gradient stops (the worst case is wherever the text sits over the blend).
    contrastCheck("hero-gradient-start", "Hero text on gradient start", styles.onGradient, styles.gradientFrom, 3),
    contrastCheck("hero-gradient-end", "Hero text on gradient end", styles.onGradient, styles.gradientTo, 3)
  ];
  const passed = checks.filter((check) => check.passed).length;
  const score = Math.round((passed / checks.length) * 100);
  return {
    status: checks.every((check) => check.passed) ? "pass" : "review",
    score,
    checks,
    warnings: checks.filter((check) => !check.passed).length
  };
};

const SHADOW_SM = "0 1px 2px rgba(15,23,42,0.04), 0 4px 14px rgba(15,23,42,0.06)";
const SHADOW_MD = "0 10px 26px rgba(15,23,42,0.10)";

export const buildThemedButton = (theme: Theme, label: string, href: string): string => {
  const styles = getThemeStyles(theme);
  return `<a href="${escAttr(safeHref(href))}" style="display: inline-block; margin: 10px 12px 6px 0; padding: 13px 22px; border-radius: 10px; background: linear-gradient(135deg, ${styles.accent} 0%, ${styles.accentDark} 100%); color: ${styles.onAccent}; text-decoration: none; font-weight: 800; font-family: ${styles.font}; box-shadow: 0 8px 18px ${withAlpha(styles.accentDark, 0.32)};">${escHtml(label)} <span aria-hidden="true" style="opacity: 0.8;">&rarr;</span></a>`;
};

export const buildThemedSecondaryButton = (theme: Theme, label: string, href: string): string => {
  const styles = getThemeStyles(theme);
  return `<a href="${escAttr(safeHref(href))}" style="display: inline-block; margin: 10px 12px 6px 0; padding: 12px 20px; border-radius: 10px; background: #ffffff; border: 2px solid ${styles.accent}; color: ${styles.accentDark}; text-decoration: none; font-weight: 800; font-family: ${styles.font}; box-shadow: ${SHADOW_SM};">${escHtml(label)}</a>`;
};

export const buildThemedCallout = (theme: Theme, title: string, body: string): string => {
  const styles = getThemeStyles(theme);
  return `<div style="margin: 20px 0; padding: 18px 20px; border-left: 6px solid ${styles.accent}; background: linear-gradient(135deg, ${styles.soft} 0%, ${withAlpha(styles.accent, 0.06)} 100%); border-radius: 12px; box-shadow: ${SHADOW_SM};">
  <h3 style="margin: 0 0 8px; color: ${styles.accentDark}; font-size: 17px; font-weight: 800; font-family: ${styles.font};">${escHtml(title)}</h3>
  ${body}
</div>`.trim();
};

export const buildThemedCard = (theme: Theme, title: string, body: string): string => {
  const styles = getThemeStyles(theme);
  const swatch = `<span style="display: inline-block; width: 12px; height: 12px; border-radius: 4px; background: linear-gradient(135deg, ${styles.accent}, ${styles.accentDark}); vertical-align: middle; margin-right: 11px;"></span>`;
  const heading = (margin: string): string =>
    `<h2 style="margin: ${margin}; color: ${styles.accentDark}; font-size: 22px; font-weight: 800; font-family: ${styles.font};">${swatch}${escHtml(title)}</h2>`;
  // Card personality per template. All inline-style + Canvas-safe; "elevated" is the legacy look.
  switch (styles.cardStyle) {
    case "outline":
      return `<section style="margin: 22px 0; background: #ffffff; border: 2px solid ${styles.accent}; border-radius: 14px; padding: 22px 26px;">
  ${heading("0 0 14px")}
  ${body}
</section>`.trim();
    case "accent-bar":
      return `<section style="margin: 22px 0; background: #ffffff; border: 1px solid ${styles.border}; border-left: 6px solid ${styles.accent}; border-radius: 12px; box-shadow: ${SHADOW_SM}; padding: 22px 26px;">
  ${heading("0 0 14px")}
  ${body}
</section>`.trim();
    case "soft-fill":
      return `<section style="margin: 22px 0; background: linear-gradient(135deg, ${styles.soft} 0%, ${withAlpha(styles.accent, 0.08)} 100%); border: 1px solid ${withAlpha(styles.accent, 0.28)}; border-radius: 16px; padding: 22px 26px;">
  ${heading("0 0 14px")}
  ${body}
</section>`.trim();
    default:
      return `<section style="margin: 22px 0; background: #ffffff; border: 1px solid ${styles.border}; border-radius: 16px; box-shadow: ${SHADOW_SM}; overflow: hidden;">
  <div style="height: 6px; background: linear-gradient(90deg, ${styles.accent} 0%, ${styles.accentDark} 100%);"></div>
  <div style="padding: 22px 26px;">
    ${heading("0 0 14px")}
    ${body}
  </div>
</section>`.trim();
  }
};

export const buildThemedShell = (theme: Theme, title: string, subtitle: string, body: string): string => {
  const styles = getThemeStyles(theme);
  const onInk = styles.onGradient === "#ffffff" ? "#ffffff" : "#0b1020";
  const underline = withAlpha(onInk, 0.55);
  const eyebrow = `<div style="display: inline-block; margin: 0 0 16px; padding: 6px 14px; border-radius: 999px; background: ${withAlpha(onInk, 0.18)}; color: ${styles.onGradient}; font-size: 12px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase;">${escHtml(theme.bannerLabel)}</div>`;
  const wrap = (hero: string): string =>
    `<div style="font-family: ${styles.font}; color: ${styles.canvasText}; line-height: 1.65;">${hero}${body}</div>`.trim();

  // "minimal": flat soft panel with a thin accent top rule and dark text — no gradient. Distinct, calm.
  if (styles.heroStyle === "minimal") {
    return wrap(`<div style="margin: 0 0 24px; background: ${styles.soft}; border: 1px solid ${withAlpha(styles.accent, 0.3)}; border-top: 5px solid ${styles.accent}; border-radius: 14px; padding: 30px 32px;">
    <div style="margin: 0 0 12px; color: ${styles.accentDark}; font-size: 12px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase;">${escHtml(theme.bannerLabel)}</div>
    <h1 style="margin: 0 0 10px; color: ${styles.accentDark}; font-size: 34px; line-height: 1.15; font-weight: 900;">${escHtml(title)}</h1>
    <p style="margin: 0; color: ${styles.contrastText}; font-size: 17px; max-width: 62ch;">${escHtml(subtitle)}</p>
  </div>`);
  }

  const pad = styles.heroStyle === "stage" ? "52px 40px" : "36px 34px";
  const h1Size = styles.heroStyle === "stage" ? "42px" : "34px";
  const center = styles.heroStyle === "spotlight";
  const align = center ? "text-align: center;" : "";
  const underlineMargin = center ? "0 auto 14px" : "0 0 14px";
  const leftBar = styles.heroStyle === "split" ? `border-left: 8px solid ${underline};` : "";
  // "split" leads with the accent bar instead of the pill eyebrow.
  const eyebrowBlock = styles.heroStyle === "split" ? "" : eyebrow;
  const hero = `<div style="position: relative; overflow: hidden; margin: 0 0 24px; padding: ${pad}; ${leftBar} ${heroBackgroundCss(styles)} border-radius: 18px; color: ${styles.onGradient}; box-shadow: ${SHADOW_MD}; ${align}">
    ${eyebrowBlock}
    <h1 style="margin: 0 0 12px; color: ${styles.onGradient}; font-size: ${h1Size}; line-height: 1.14; font-weight: 900;">${escHtml(title)}</h1>
    <div style="width: 70px; height: 4px; border-radius: 3px; background: ${underline}; margin: ${underlineMargin};"></div>
    <p style="margin: ${center ? "0 auto" : "0"}; color: ${styles.onGradient}; opacity: 0.96; font-size: 17px; max-width: 62ch;">${escHtml(subtitle)}</p>
  </div>`;
  return wrap(hero);
};

// ---- Extended visual kit (Canvas-safe inline HTML) -------------------------

/** A row of theme-tinted "meta" chips, e.g. course length, credits, modules. */
export const buildThemedChips = (theme: Theme, items: string[]): string => {
  const styles = getThemeStyles(theme);
  if (!items.length) return "";
  const chips = items
    .map(
      (item) =>
        `<span style="display: inline-block; margin: 0 9px 9px 0; padding: 7px 15px; border-radius: 999px; background: ${withAlpha(styles.accent, 0.1)}; border: 1px solid ${withAlpha(styles.accent, 0.4)}; color: ${styles.accentDark}; font-size: 13px; font-weight: 700; font-family: ${styles.font};">${escHtml(item)}</span>`
    )
    .join("");
  return `<p style="margin: 0 0 18px;">${chips}</p>`;
};

type NoteVariant = "key-term" | "example" | "misconception" | "check" | "instructor" | "tip";

// Semantic, universally-readable colors per note type (misconception/example/check stay fixed so
// their meaning reads on any theme; key-term/tip pick up the course accent).
const noteStyle = (theme: Theme, variant: NoteVariant): { bg: string; border: string; fg: string; emoji: string } => {
  const styles = getThemeStyles(theme);
  switch (variant) {
    case "example":
      return { bg: "#fff8ec", border: "#f3c97d", fg: "#92400e", emoji: "&#128161;" }; // 💡
    case "misconception":
      return { bg: "#fef2f2", border: "#f3b4b4", fg: "#b91c1c", emoji: "&#9888;&#65039;" }; // ⚠️
    case "check":
      return { bg: "#ecfdf5", border: "#9be7c4", fg: "#15803d", emoji: "&#9989;" }; // ✅
    case "instructor":
      return { bg: "#f1f5f9", border: "#cbd5e1", fg: "#334155", emoji: "&#129517;" }; // 🧭
    case "key-term":
      return { bg: withAlpha(styles.accent, 0.08), border: withAlpha(styles.accent, 0.42), fg: styles.accentDark, emoji: "&#128216;" }; // 📘
    default:
      return { bg: withAlpha(styles.accent, 0.08), border: withAlpha(styles.accent, 0.42), fg: styles.accentDark, emoji: "&#10024;" }; // ✨
  }
};

/** A typed callout (key term, example, misconception, check, instructor note, tip) with an icon. */
export const buildThemedNote = (theme: Theme, variant: NoteVariant, title: string, body: string): string => {
  const note = noteStyle(theme, variant);
  const styles = getThemeStyles(theme);
  return `<div style="margin: 18px 0; padding: 16px 18px 16px 20px; border: 1px solid ${note.border}; border-left: 5px solid ${note.fg}; background: ${note.bg}; border-radius: 12px; box-shadow: ${SHADOW_SM};">
  <h3 style="margin: 0 0 8px; color: ${note.fg}; font-weight: 800; font-size: 16px; font-family: ${styles.font};"><span aria-hidden="true" style="margin-right: 8px;">${note.emoji}</span>${escHtml(title)}</h3>
  <div style="color: #374151;">${body}</div>
</div>`.trim();
};

/** A polished table: gradient header, zebra rows, rounded shadowed container. */
export const buildThemedTable = (theme: Theme, caption: string, headers: string[], rows: string[][]): string => {
  const styles = getThemeStyles(theme);
  const head = headers
    .map((header) => `<th scope="col" style="text-align: left; padding: 12px 15px; background: linear-gradient(135deg, ${styles.accent}, ${styles.accentDark}); color: ${styles.onAccent}; font-weight: 800; border: none; font-family: ${styles.font};">${escHtml(header)}</th>`)
    .join("");
  const body = rows
    .map(
      (row, index) =>
        `<tr style="background: ${index % 2 === 1 ? withAlpha(styles.accent, 0.05) : "#ffffff"};">${row
          .map((cell) => `<td style="padding: 11px 15px; border-top: 1px solid ${styles.border}; color: #374151; vertical-align: top;">${cell}</td>`)
          .join("")}</tr>`
    )
    .join("");
  const cap = caption ? `<caption style="caption-side: top; text-align: left; margin: 0 0 10px; color: ${styles.accentDark}; font-weight: 800; font-family: ${styles.font};">${escHtml(caption)}</caption>` : "";
  return `<div style="margin: 18px 0; border: 1px solid ${styles.border}; border-radius: 14px; overflow: hidden; box-shadow: ${SHADOW_SM};">
  <table style="width: 100%; border-collapse: collapse; font-size: 14px; font-family: ${styles.font};">${cap}
    <thead><tr>${head}</tr></thead>
    <tbody>${body}</tbody>
  </table>
</div>`.trim();
};

/** A soft gradient divider rule. */
export const buildThemedDivider = (theme: Theme): string => {
  const styles = getThemeStyles(theme);
  return `<div style="height: 2px; margin: 26px 0; border-radius: 2px; background: linear-gradient(90deg, transparent, ${withAlpha(styles.accent, 0.55)}, transparent);"></div>`;
};

/** Numbered step cards for "how this works" flows. */
export const buildThemedSteps = (theme: Theme, steps: Array<{ title: string; body: string }>): string => {
  const styles = getThemeStyles(theme);
  const items = steps
    .map(
      (step, index) =>
        `<div style="margin: 0 0 12px; padding: 16px 18px; background: #ffffff; border: 1px solid ${styles.border}; border-radius: 13px; box-shadow: ${SHADOW_SM};">
    <span style="display: inline-block; width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, ${styles.accent}, ${styles.accentDark}); color: ${styles.onAccent}; text-align: center; line-height: 32px; font-weight: 800; vertical-align: middle; margin-right: 12px; font-family: ${styles.font};">${index + 1}</span><strong style="color: ${styles.accentDark}; font-size: 16px; font-family: ${styles.font};">${escHtml(step.title)}</strong>
    <div style="margin: 10px 0 0; color: #374151;">${step.body}</div>
  </div>`
    )
    .join("");
  return `<div style="margin: 16px 0;">${items}</div>`;
};

/** Responsive two-up card grid (inline-block so it survives Canvas + the mobile app). */
export const buildThemedColumns = (theme: Theme, cards: Array<{ title: string; body: string; emoji?: string }>): string => {
  const styles = getThemeStyles(theme);
  const items = cards
    .map(
      (card) =>
        `<div style="display: inline-block; width: 48%; min-width: 230px; vertical-align: top; margin: 0 1% 16px 0; box-sizing: border-box; font-size: 15px; padding: 18px 20px; background: #ffffff; border: 1px solid ${styles.border}; border-radius: 14px; box-shadow: ${SHADOW_SM};">
    ${card.emoji ? `<div aria-hidden="true" style="font-size: 24px; line-height: 1; margin: 0 0 8px;">${card.emoji}</div>` : ""}<div style="font-weight: 800; color: ${styles.accentDark}; font-size: 16px; margin: 0 0 6px; font-family: ${styles.font};">${escHtml(card.title)}</div>
    <div style="color: #374151;">${card.body}</div>
  </div>`
    )
    .join("");
  return `<div style="margin: 16px 0; font-size: 0;">${items}</div>`;
};

const sampleTable = (theme: Theme): string => {
  const styles = getThemeStyles(theme);
  return `<table style="width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 14px;">
  <thead>
    <tr>
      <th scope="col" style="text-align: left; padding: 9px; border: 1px solid ${styles.border}; background: ${styles.soft}; color: ${styles.accentDark};">Week</th>
      <th scope="col" style="text-align: left; padding: 9px; border: 1px solid ${styles.border}; background: ${styles.soft}; color: ${styles.accentDark};">Focus</th>
      <th scope="col" style="text-align: left; padding: 9px; border: 1px solid ${styles.border}; background: ${styles.soft}; color: ${styles.accentDark};">Deliverable</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding: 9px; border: 1px solid ${styles.border};">1</td>
      <td style="padding: 9px; border: 1px solid ${styles.border};">Course orientation</td>
      <td style="padding: 9px; border: 1px solid ${styles.border};">Intro post</td>
    </tr>
    <tr>
      <td style="padding: 9px; border: 1px solid ${styles.border};">2</td>
      <td style="padding: 9px; border: 1px solid ${styles.border};">Applied analysis</td>
      <td style="padding: 9px; border: 1px solid ${styles.border};">Practice brief</td>
    </tr>
  </tbody>
</table>`;
};

const sampleRubric = (theme: Theme): string => {
  const styles = getThemeStyles(theme);
  return `<table style="width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 14px;">
  <caption style="caption-side: top; text-align: left; margin-bottom: 8px; color: ${styles.accentDark}; font-weight: 700;">Rubric sample</caption>
  <thead>
    <tr>
      <th scope="col" style="text-align: left; padding: 9px; border: 1px solid ${styles.border}; background: ${styles.soft}; color: ${styles.accentDark};">Criterion</th>
      <th scope="col" style="text-align: left; padding: 9px; border: 1px solid ${styles.border}; background: ${styles.soft}; color: ${styles.accentDark};">Exemplary</th>
      <th scope="col" style="text-align: left; padding: 9px; border: 1px solid ${styles.border}; background: ${styles.soft}; color: ${styles.accentDark};">Developing</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th scope="row" style="text-align: left; padding: 9px; border: 1px solid ${styles.border};">Evidence</th>
      <td style="padding: 9px; border: 1px solid ${styles.border};">Specific, relevant, and clearly explained.</td>
      <td style="padding: 9px; border: 1px solid ${styles.border};">Evidence is present but underexplained.</td>
    </tr>
  </tbody>
</table>`;
};

const paragraph = (text: string): string => `<p style="margin: 0 0 12px; color: #374151;">${escHtml(text)}</p>`;

export const buildThemePreviewHtml = (theme: Theme, kind: ThemePreviewKind, courseTitle = "Course Preview"): string => {
  const styles = getThemeStyles(theme);
  const intro = `<p style="margin: 0 0 12px; color: ${styles.mutedText};">This preview uses Canvas-safe inline HTML with no external fonts, scripts, or fragile assets.</p>`;
  // The real homepage leads with the themed course banner — show it so the motif (cosmic, circuit,
  // lab, …) is visible the moment a theme is selected. Rendered in-app, so a data-URI img is safe.
  const bannerImg = `<img src="data:image/svg+xml;utf8,${encodeURIComponent(buildBannerSvg(courseTitle, theme))}" alt="${escAttr(courseTitle)} banner" style="display: block; width: 100%; height: auto; border-radius: 12px; margin: 0 0 18px;"/>`;

  if (kind === "homepage") {
    return `<div style="font-family: ${styles.font};">${bannerImg}${buildThemedShell(
      theme,
      `${courseTitle} Homepage`,
      "Welcome students into a clear Canvas course path.",
      `${intro}${buildThemedCard(theme, "Start Here", `${paragraph("Open the Course Success Guide, review the syllabus, then begin Module 1.")}${buildThemedButton(theme, "Start Here", "course-success-guide.html")}${buildThemedSecondaryButton(theme, "View syllabus", "syllabus.html")}`)}${buildThemedCallout(theme, "Instructor note", paragraph("Use announcements and office hours to ask questions early."))}${sampleTable(theme)}`
    )}</div>`;
  }

  if (kind === "syllabus") {
    return buildThemedShell(
      theme,
      `${courseTitle} Syllabus`,
      "Outcomes, grading, schedule, policies, and support resources.",
      `${intro}${buildThemedCard(theme, "Course Learning Outcomes", "<ul><li>Analyze course concepts in context.</li><li>Create a clear final deliverable.</li></ul>")}${buildThemedCallout(theme, "Printable copy", paragraph("The export includes a print-friendly syllabus asset."))}${sampleTable(theme)}`
    );
  }

  if (kind === "assignment") {
    return buildThemedShell(
      theme,
      "Applied Analysis Assignment",
      "A Canvas assignment page with task, evidence, and submission guidance.",
      `${intro}${buildThemedCard(theme, "What to submit", "<ul><li>One focused claim.</li><li>Evidence from course resources.</li><li>A short reflection on audience and impact.</li></ul>")}${buildThemedCallout(theme, "Before submitting", paragraph("Review the rubric and confirm each required deliverable is included."))}`
    );
  }

  if (kind === "quiz") {
    return buildThemedShell(
      theme,
      "Knowledge Check",
      "Quiz instructions and feedback styles remain readable.",
      `${intro}${buildThemedCard(theme, "Instructions", paragraph("Answer each question using the module vocabulary and examples."))}${buildThemedCallout(theme, "Feedback sample", paragraph("Correct answers explain why the reasoning fits the course concept."))}`
    );
  }

  return buildThemedShell(
    theme,
    "Rubric Preview",
    "Criteria, levels, and point values should scan cleanly in Canvas.",
    `${intro}${buildThemedCard(theme, "Rubric guidance", paragraph("Use criteria labels, descriptive performance levels, and visible point values."))}${buildThemedCallout(theme, "Scoring note", paragraph("Students should see how evidence, reasoning, and communication affect the final score."))}${sampleRubric(theme)}`
  );
};
