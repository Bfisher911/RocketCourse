import type { Theme, ThemeCardStyle, ThemeFont, ThemeHeroStyle, ThemeMotif, ThemePattern } from "../types";
import { bestTextOn, contrastRatio, shiftHue, withAlpha } from "../utils/color";
import { escapeXml } from "../utils/text";
import { icon, iconLabel, type IconName } from "./themeIcons";
import { ELEVATION, MEASURE, RADIUS, SPACE } from "./exportTokens";
import { buildBloomPyramid, buildGradeWeightDonut } from "./themeDataViz";
import { seededBannerDecor } from "./generativeArt";

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
    case "topographic":
      return { image: `repeating-radial-gradient(circle at 30% 120%, transparent 0 20px, ${ink} 20px 21px, transparent 21px 22px)`, size: "auto" };
    case "hexagon":
      return {
        image: `repeating-linear-gradient(60deg, ${ink} 0 1px, transparent 1px 20px), repeating-linear-gradient(-60deg, ${ink} 0 1px, transparent 1px 20px), repeating-linear-gradient(0deg, ${ink} 0 1px, transparent 1px 35px)`,
        size: "auto"
      };
    case "isometric":
      return {
        image: `repeating-linear-gradient(30deg, ${ink} 0 1px, transparent 1px 22px), repeating-linear-gradient(150deg, ${ink} 0 1px, transparent 1px 22px), repeating-linear-gradient(90deg, ${ink} 0 1px, transparent 1px 22px)`,
        size: "auto"
      };
    case "concentric":
      return { image: `repeating-radial-gradient(circle at 50% 50%, transparent 0 14px, ${ink} 14px 15px)`, size: "44px 44px" };
    case "halftone":
      return { image: `radial-gradient(${ink} 2.2px, transparent 2.5px)`, size: "14px 14px" };
    case "graphpaper":
      // Fine minor grid (1px every 14px) under a thicker major grid (2px every 70px), same ink so a
      // single passed color reads as classic two-tier graph paper.
      return {
        image: `repeating-linear-gradient(0deg, ${ink} 0 1px, transparent 1px 14px), repeating-linear-gradient(90deg, ${ink} 0 1px, transparent 1px 14px), repeating-linear-gradient(0deg, ${ink} 0 2px, transparent 2px 70px), repeating-linear-gradient(90deg, ${ink} 0 2px, transparent 2px 70px)`,
        size: "auto"
      };
    case "musicstaff":
      return {
        image: `repeating-linear-gradient(0deg, ${ink} 0 1.5px, transparent 1.5px 10px, ${ink} 10px 11.5px, transparent 11.5px 20px, ${ink} 20px 21.5px, transparent 21.5px 30px, ${ink} 30px 31.5px, transparent 31.5px 40px, ${ink} 40px 41.5px, transparent 41.5px 72px)`,
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
    case "topographic":
      return { def: `<pattern id="pat" width="64" height="48" patternUnits="userSpaceOnUse"><path d="M-4 40 q34 -28 68 0 M-4 24 q34 -28 68 0 M-4 56 q34 -28 68 0" fill="none" stroke="${ink}" stroke-width="1.4" opacity="0.10"/></pattern>`, rect: `<rect width="1440" height="360" fill="url(#pat)"/>` };
    case "hexagon":
      return { def: `<pattern id="pat" width="44" height="50" patternUnits="userSpaceOnUse"><path d="M11 1 L33 1 L44 25 L33 49 L11 49 L0 25 Z" fill="none" stroke="${ink}" stroke-width="1.2" opacity="0.10"/></pattern>`, rect: `<rect width="1440" height="360" fill="url(#pat)"/>` };
    case "isometric":
      return { def: `<pattern id="pat" width="40" height="46" patternUnits="userSpaceOnUse"><path d="M20 1 L39 12 V35 L20 46 L1 35 V12 Z M20 1 V46 M1 12 L39 35 M39 12 L1 35" fill="none" stroke="${ink}" stroke-width="1" opacity="0.08"/></pattern>`, rect: `<rect width="1440" height="360" fill="url(#pat)"/>` };
    case "concentric":
      return { def: `<pattern id="pat" width="52" height="52" patternUnits="userSpaceOnUse"><g fill="none" stroke="${ink}" stroke-width="1.3" opacity="0.10"><circle cx="26" cy="26" r="7"/><circle cx="26" cy="26" r="16"/><circle cx="26" cy="26" r="25"/></g></pattern>`, rect: `<rect width="1440" height="360" fill="url(#pat)"/>` };
    case "halftone":
      return { def: `<pattern id="pat" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="10" cy="10" r="3" fill="${ink}" opacity="0.10"/></pattern>`, rect: `<rect width="1440" height="360" fill="url(#pat)"/>` };
    case "graphpaper":
      return { def: `<pattern id="patMinor" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M16 0 H0 V16" fill="none" stroke="${ink}" stroke-width="0.8" opacity="0.07"/></pattern><pattern id="pat" width="80" height="80" patternUnits="userSpaceOnUse"><rect width="80" height="80" fill="url(#patMinor)"/><path d="M80 0 H0 V80" fill="none" stroke="${ink}" stroke-width="1.6" opacity="0.10"/></pattern>`, rect: `<rect width="1440" height="360" fill="url(#pat)"/>` };
    case "musicstaff":
      return { def: `<pattern id="pat" width="40" height="72" patternUnits="userSpaceOnUse"><g stroke="${ink}" stroke-width="1.2" opacity="0.10"><path d="M0 10 H40 M0 20 H40 M0 30 H40 M0 40 H40 M0 50 H40"/></g></pattern>`, rect: `<rect width="1440" height="360" fill="url(#pat)"/>` };
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
    case "manuscript":
      return `
  <g opacity="0.9">
    <path d="M1130 300 C1170 250 1250 150 1330 84 l30 26 C1290 176 1210 256 1166 306 z" fill="#ffffff" opacity="0.13" stroke="#ffffff" stroke-width="2"/>
    <path d="M1330 84 l30 26" stroke="#ffffff" stroke-width="3" opacity="0.4"/>
    <path d="M1130 300 l24 6 l12 0" stroke="#ffffff" stroke-width="2" fill="none" opacity="0.4"/>
    <path d="M860 250 C960 232 1010 268 1100 250 M860 280 C960 262 1010 298 1100 280" stroke="#ffffff" stroke-width="2" fill="none" opacity="0.22"/>
    <path d="M900 150 c30 -22 60 18 30 34 c-26 14 -52 -14 -20 -44" stroke="#ffffff" stroke-width="2" fill="none" opacity="0.2"/>
  </g>`;
    case "staff":
      return `
  <g stroke="#ffffff" opacity="0.2" stroke-width="2"><path d="M840 120 H1400 M840 150 H1400 M840 180 H1400 M840 210 H1400 M840 240 H1400"/></g>
  <g fill="#ffffff" opacity="0.7"><ellipse cx="980" cy="240" rx="15" ry="11" transform="rotate(-20 980 240)"/><ellipse cx="1140" cy="210" rx="15" ry="11" transform="rotate(-20 1140 210)"/><ellipse cx="1300" cy="180" rx="15" ry="11" transform="rotate(-20 1300 180)"/></g>
  <g stroke="#ffffff" stroke-width="3" opacity="0.7" fill="none"><path d="M993 238 V150 M1153 208 V120 M1313 178 V92"/><path d="M1313 92 c26 4 30 22 12 30"/></g>
  <path d="M860 120 c-14 30 -14 90 0 120 c-22 -30 -22 -90 0 -120 z" fill="#ffffff" opacity="0.5"/>`;
    case "geometry":
      return `
  <g fill="none" stroke="#ffffff" opacity="0.22" stroke-width="2">
    <circle cx="1180" cy="190" r="120"/><circle cx="1180" cy="190" r="74"/>
    <path d="M1060 190 H1300 M1180 70 V310"/>
    <path d="M1100 280 L1180 70 L1260 280 Z"/>
  </g>
  <g stroke="#ffffff" stroke-width="2.5" opacity="0.5" fill="none"><path d="M880 280 L1010 280 M880 280 L955 150"/><path d="M880 280 a40 40 0 0 1 40 -22" /></g>
  <g fill="#ffffff" opacity="0.55"><circle cx="1180" cy="70" r="5"/><circle cx="1180" cy="190" r="4"/></g>`;
    case "globe":
      return `
  <g fill="none" stroke="#ffffff" stroke-width="2" opacity="0.24">
    <circle cx="1190" cy="190" r="118"/>
    <ellipse cx="1190" cy="190" rx="48" ry="118"/><ellipse cx="1190" cy="190" rx="96" ry="118"/>
    <path d="M1072 190 H1308 M1086 132 H1294 M1086 248 H1294"/>
  </g>
  <g fill="#ffffff" opacity="0.5"><circle cx="900" cy="130" r="3"/><circle cx="980" cy="300" r="3"/><circle cx="860" cy="240" r="2.5"/></g>`;
    case "gears":
      return `
  <g fill="none" stroke="#ffffff" stroke-width="3" opacity="0.26">
    <circle cx="1180" cy="170" r="58"/><circle cx="1180" cy="170" r="24"/>
    <g stroke-width="14"><path d="M1180 100 v-16 M1180 256 v-16 M1110 170 h-16 M1266 170 h-16 M1131 121 l-11 -11 M1240 220 l-11 -11 M1229 121 l11 -11 M1120 220 l11 -11"/></g>
    <circle cx="1300" cy="270" r="40"/><circle cx="1300" cy="270" r="16"/>
    <g stroke-width="12"><path d="M1300 218 v-12 M1300 334 v-12 M1248 270 h-12 M1364 270 h-12"/></g>
  </g>`;
    case "terminal":
      return `
  <g><rect x="860" y="90" width="500" height="200" rx="14" fill="#ffffff" opacity="0.1" stroke="#ffffff" stroke-width="2"/>
    <path d="M860 126 H1360" stroke="#ffffff" stroke-width="2" opacity="0.3"/>
    <g fill="#ffffff" opacity="0.6"><circle cx="884" cy="108" r="5"/><circle cx="904" cy="108" r="5"/><circle cx="924" cy="108" r="5"/></g>
    <g stroke="#ffffff" stroke-width="3" fill="none" opacity="0.7"><path d="M892 160 l22 18 l-22 18"/><path d="M930 196 h40"/></g>
    <rect x="990" y="220" width="22" height="22" fill="#ffffff" opacity="0.5"/>
  </g>`;
    case "scales":
      return `
  <g fill="none" stroke="#ffffff" stroke-width="3" opacity="0.5"><path d="M1190 80 V250"/><path d="M1090 120 H1290"/><path d="M1160 250 H1220"/><path d="M1190 250 h-30 v6 h60 v-6 z" fill="#ffffff" opacity="0.4"/></g>
  <g fill="none" stroke="#ffffff" stroke-width="2.5" opacity="0.4">
    <path d="M1090 120 l-26 56 h52 z"/><path d="M1064 176 a26 12 0 0 0 52 0"/>
    <path d="M1290 120 l-26 56 h52 z"/><path d="M1264 176 a26 12 0 0 0 52 0"/>
  </g>
  <circle cx="1190" cy="80" r="6" fill="#ffffff" opacity="0.6"/>`;
    case "timeline":
      return `
  <g stroke="#ffffff" stroke-width="3" opacity="0.3"><path d="M840 200 H1400"/></g>
  <g fill="#ffffff"><circle cx="920" cy="200" r="9" opacity="0.7"/><circle cx="1080" cy="200" r="9" opacity="0.6"/><circle cx="1240" cy="200" r="9" opacity="0.55"/><circle cx="1360" cy="200" r="9" opacity="0.5"/></g>
  <g stroke="#ffffff" stroke-width="2" opacity="0.35"><path d="M920 200 V150 M1080 200 V250 M1240 200 V150 M1360 200 V250"/></g>
  <g fill="#ffffff" opacity="0.16"><rect x="892" y="118" width="56" height="26" rx="5"/><rect x="1212" y="118" width="56" height="26" rx="5"/></g>`;
    case "molecule":
      return `
  <g stroke="#ffffff" stroke-width="2.5" opacity="0.35" fill="none"><path d="M1120 130 L1260 130 L1330 250 L1260 370 M1120 130 L1050 250 L1120 370 L1260 370 M1050 250 L920 250"/></g>
  <g fill="#ffffff"><circle cx="1120" cy="130" r="13" opacity="0.7"/><circle cx="1260" cy="130" r="13" opacity="0.65"/><circle cx="1330" cy="250" r="13" opacity="0.6"/><circle cx="1120" cy="370" r="13" opacity="0.6"/><circle cx="1050" cy="250" r="15" opacity="0.75"/><circle cx="920" cy="250" r="11" opacity="0.55"/></g>`;
    case "helix":
      return `
  <g stroke="#ffffff" stroke-width="3" fill="none" opacity="0.5"><path d="M1140 70 C1280 130 1280 230 1140 290 C1000 350 1000 250 1140 70" opacity="0"/>
    <path d="M1120 70 C1260 120 1000 200 1140 250 C1280 300 1020 380 1160 430"/>
    <path d="M1240 70 C1100 120 1360 200 1220 250 C1080 300 1340 380 1200 430"/></g>
  <g stroke="#ffffff" stroke-width="2" opacity="0.3"><path d="M1135 92 H1225 M1110 130 H1250 M1130 170 H1230 M1160 210 H1200 M1130 250 H1230 M1110 290 H1250 M1135 330 H1225"/></g>`;
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
  ${seededBannerDecor(title, styles.onGradient)}
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
    case "folder-tab":
      // Title lives in the tab, so the body card omits the inline heading to avoid duplication.
      return `<section style="margin: 26px 0 22px;">
  <div style="display: inline-block; padding: 7px 22px 9px; background: linear-gradient(135deg, ${styles.accent}, ${styles.accentDark}); color: ${styles.onAccent}; font-weight: 800; font-size: 14px; border-radius: 12px 12px 0 0; font-family: ${styles.font}; letter-spacing: 0.03em;">${escHtml(title)}</div>
  <div style="background: #ffffff; border: 1px solid ${styles.border}; border-top: 3px solid ${styles.accent}; border-radius: 0 13px 13px 13px; box-shadow: ${SHADOW_SM}; padding: 20px 26px;">
    ${body}
  </div>
</section>`.trim();
    case "index-card":
      return `<section style="margin: 22px 0; background: repeating-linear-gradient(0deg, #ffffff 0 27px, ${withAlpha(styles.accent, 0.1)} 27px 28px); border: 1px solid ${styles.border}; border-left: 4px solid #e2574c; border-radius: 10px; box-shadow: ${SHADOW_SM}; padding: 18px 26px;">
  ${heading("0 0 14px")}
  ${body}
</section>`.trim();
    case "notch":
      return `<section style="position: relative; overflow: hidden; margin: 22px 0; background: linear-gradient(135deg, ${styles.soft} 0%, ${withAlpha(styles.accent, 0.1)} 100%); border: 1px solid ${withAlpha(styles.accent, 0.3)}; border-radius: 14px; padding: 22px 30px;">
  <span aria-hidden="true" style="position: absolute; left: -13px; top: calc(50% - 13px); width: 26px; height: 26px; border-radius: 50%; background: #ffffff;"></span>
  <span aria-hidden="true" style="position: absolute; right: -13px; top: calc(50% - 13px); width: 26px; height: 26px; border-radius: 50%; background: #ffffff;"></span>
  ${heading("0 0 14px")}
  ${body}
</section>`.trim();
    case "matted":
      return `<section style="margin: 22px 0; background: ${styles.soft}; border: 1px solid ${withAlpha(styles.accent, 0.3)}; border-radius: 16px; padding: 13px; box-shadow: ${SHADOW_SM};">
  <div style="background: #ffffff; border: 1px solid ${styles.border}; border-radius: 9px; padding: 22px 26px;">
    ${heading("0 0 14px")}
    ${body}
  </div>
</section>`.trim();
    case "gradient-edge":
      return `<section style="margin: 22px 0; padding: 2px; border-radius: 16px; background: linear-gradient(135deg, ${styles.accent}, ${styles.accentDark}); box-shadow: ${SHADOW_SM};">
  <div style="background: #ffffff; border-radius: 14px; padding: 22px 26px;">
    ${heading("0 0 14px")}
    ${body}
  </div>
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

  // "ticket": boarding-pass — gradient main panel + a dashed perforation + a tear-off stub.
  if (styles.heroStyle === "ticket") {
    return wrap(`<div style="margin: 0 0 24px; border-radius: 18px; overflow: hidden; box-shadow: ${SHADOW_MD}; font-size: 0;">
    <div style="display: inline-block; width: 70%; vertical-align: top; box-sizing: border-box; padding: 36px 34px; ${heroBackgroundCss(styles)} color: ${styles.onGradient}; font-size: 16px;">
      ${eyebrow}
      <h1 style="margin: 0 0 12px; color: ${styles.onGradient}; font-size: 34px; line-height: 1.14; font-weight: 900;">${escHtml(title)}</h1>
      <p style="margin: 0; color: ${styles.onGradient}; opacity: 0.96; font-size: 17px; max-width: 56ch;">${escHtml(subtitle)}</p>
    </div><div style="display: inline-block; width: 30%; vertical-align: top; box-sizing: border-box; padding: 32px 18px; border-left: 3px dashed ${withAlpha(onInk, 0.55)}; background: linear-gradient(135deg, ${styles.gradientTo} 0%, ${styles.gradientFrom} 100%); color: ${styles.onGradient}; text-align: center; font-size: 16px;">
      <div style="font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; opacity: 0.85; margin: 0 0 10px;">${escHtml(theme.bannerLabel)}</div>
      <div style="margin: 0 auto; width: 46px; height: 46px;">${icon("flag", { color: styles.onGradient, size: 46, strokeWidth: 1.6 })}</div>
      <div style="font-size: 12px; opacity: 0.8; margin: 12px 0 0; letter-spacing: 0.08em;">ADMIT&nbsp;ONE</div>
    </div>
  </div>`);
  }

  // "postcard": gradient card with a stamp + postmark and a hairline address rule.
  if (styles.heroStyle === "postcard") {
    const stamp = `<div style="position: absolute; top: 24px; right: 26px; width: 66px; height: 78px; border: 2px dashed ${withAlpha(onInk, 0.6)}; border-radius: 6px; text-align: center; box-sizing: border-box; padding: 8px 4px;"><div style="font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; opacity: 0.85;">${escHtml(theme.bannerLabel.slice(0, 10))}</div><div style="margin: 6px auto 0; width: 30px;">${icon("compass", { color: styles.onGradient, size: 30, strokeWidth: 1.6 })}</div></div>`;
    const postmark = `<div aria-hidden="true" style="position: absolute; top: 34px; right: 96px; width: 58px; height: 58px;"><svg width="58" height="58" viewBox="0 0 58 58" fill="none" stroke="${withAlpha(onInk, 0.5)}" stroke-width="1.5"><circle cx="29" cy="29" r="26"/><circle cx="29" cy="29" r="18"/><path d="M5 22h48M5 36h48"/></svg></div>`;
    return wrap(`<div style="position: relative; overflow: hidden; margin: 0 0 24px; padding: 34px 34px; ${heroBackgroundCss(styles)} border-radius: 18px; color: ${styles.onGradient}; box-shadow: ${SHADOW_MD};">
    ${postmark}${stamp}
    ${eyebrow}
    <h1 style="margin: 0 0 12px; color: ${styles.onGradient}; font-size: 34px; line-height: 1.14; font-weight: 900; max-width: 60%;">${escHtml(title)}</h1>
    <div style="width: 70px; height: 4px; border-radius: 3px; background: ${underline}; margin: 0 0 14px;"></div>
    <p style="margin: 0; color: ${styles.onGradient}; opacity: 0.96; font-size: 17px; max-width: 52ch;">${escHtml(subtitle)}</p>
    <div style="margin: 18px 0 0; border-top: 1px solid ${withAlpha(onInk, 0.4)}; padding-top: 6px;"><span style="display: inline-block; width: 38%; border-bottom: 1px solid ${withAlpha(onInk, 0.3)}; margin: 8px 4% 0 0; height: 1px;"></span><span style="display: inline-block; width: 30%; border-bottom: 1px solid ${withAlpha(onInk, 0.3)}; height: 1px;"></span></div>
  </div>`);
  }

  // "console": terminal-window chrome with a mono prompt. Mono font regardless of theme font.
  if (styles.heroStyle === "console") {
    const mono = "'DejaVu Sans Mono', 'SFMono-Regular', Menlo, Consolas, 'Courier New', monospace";
    return wrap(`<div style="margin: 0 0 24px; border-radius: 14px; overflow: hidden; box-shadow: ${SHADOW_MD}; border: 1px solid ${withAlpha(styles.accentDark, 0.5)};">
    <div style="background: ${styles.accentDark}; padding: 11px 16px; font-family: ${mono};">
      <span aria-hidden="true" style="display: inline-block; vertical-align: middle;"><span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:#ff5f57;margin-right:7px;"></span><span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:#febc2e;margin-right:7px;"></span><span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:#28c840;"></span></span>
      <span style="color: ${withAlpha("#ffffff", 0.7)}; font-size: 13px; margin-left: 14px; vertical-align: middle;">${escHtml(theme.bannerLabel.toLowerCase().replace(/\s+/g, "-"))} — course</span>
    </div>
    <div style="${heroBackgroundCss(styles)} padding: 30px 32px; color: ${styles.onGradient}; font-family: ${mono};">
      <div style="opacity: 0.82; font-size: 14px; margin: 0 0 10px;">$ rocketcourse open "${escHtml(theme.bannerLabel)}"</div>
      <h1 style="margin: 0 0 12px; color: ${styles.onGradient}; font-size: 30px; line-height: 1.2; font-weight: 800;"><span style="opacity: 0.7;">&gt; </span>${escHtml(title)}</h1>
      <p style="margin: 0; color: ${styles.onGradient}; opacity: 0.94; font-size: 16px; max-width: 64ch;">${escHtml(subtitle)}<span aria-hidden="true" style="display: inline-block; width: 9px; height: 18px; background: ${styles.onGradient}; vertical-align: -3px; margin-left: 4px; opacity: 0.8;"></span></p>
    </div>
  </div>`);
  }

  // "editorial": print masthead — no gradient, big type, kicker + rules, generous whitespace.
  if (styles.heroStyle === "editorial") {
    return wrap(`<div style="margin: 0 0 28px; padding: 6px 0 22px; border-bottom: 3px solid ${styles.accentDark};">
    <div style="margin: 0 0 14px; padding-bottom: 12px; border-bottom: 1px solid ${styles.border};"><span style="color: ${styles.accentDark}; font-size: 12px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase;">${escHtml(theme.bannerLabel)}</span></div>
    <h1 style="margin: 0 0 14px; color: #111827; font-size: 46px; line-height: 1.04; font-weight: 900; letter-spacing: -0.01em; max-width: 18ch;">${escHtml(title)}</h1>
    <p style="margin: 0; color: ${styles.contrastText}; font-size: 19px; line-height: 1.5; max-width: 60ch;">${escHtml(subtitle)}</p>
  </div>`);
  }

  // "medallion": centered seal/emblem — for capstones, certificates, flagship courses.
  if (styles.heroStyle === "medallion") {
    const seal = `<div style="margin: 0 auto 18px; width: 92px; height: 92px; border-radius: 50%; border: 3px solid ${withAlpha(onInk, 0.7)}; box-sizing: border-box; text-align: center; line-height: 92px;"><span style="display: inline-block; vertical-align: middle; line-height: 1;">${icon("award", { color: styles.onGradient, size: 50, strokeWidth: 1.7 })}</span></div>`;
    return wrap(`<div style="margin: 0 0 24px; padding: 44px 32px; ${heroBackgroundCss(styles)} border-radius: 18px; color: ${styles.onGradient}; box-shadow: ${SHADOW_MD}; text-align: center;">
    ${seal}
    <div style="display: inline-block; margin: 0 0 14px; padding: 6px 14px; border-radius: 999px; background: ${withAlpha(onInk, 0.18)}; color: ${styles.onGradient}; font-size: 12px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase;">${escHtml(theme.bannerLabel)}</div>
    <h1 style="margin: 0 0 12px; color: ${styles.onGradient}; font-size: 40px; line-height: 1.12; font-weight: 900;">${escHtml(title)}</h1>
    <div style="width: 70px; height: 4px; border-radius: 3px; background: ${underline}; margin: 0 auto 14px;"></div>
    <p style="margin: 0 auto; color: ${styles.onGradient}; opacity: 0.96; font-size: 17px; max-width: 56ch;">${escHtml(subtitle)}</p>
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

// Semantic, universally-readable colors + themed line icon per note type (misconception/example/check
// stay fixed so their meaning reads on any theme; key-term/tip pick up the course accent). Icons
// replace the old emoji so they render identically everywhere and match the accent.
const noteStyle = (theme: Theme, variant: NoteVariant): { bg: string; border: string; fg: string; iconName: IconName } => {
  const styles = getThemeStyles(theme);
  switch (variant) {
    case "example":
      return { bg: "#fff8ec", border: "#f3c97d", fg: "#92400e", iconName: "tip" };
    case "misconception":
      return { bg: "#fef2f2", border: "#f3b4b4", fg: "#b91c1c", iconName: "warning" };
    case "check":
      return { bg: "#ecfdf5", border: "#9be7c4", fg: "#15803d", iconName: "check" };
    case "instructor":
      return { bg: "#f1f5f9", border: "#cbd5e1", fg: "#334155", iconName: "compass" };
    case "key-term":
      return { bg: withAlpha(styles.accent, 0.08), border: withAlpha(styles.accent, 0.42), fg: styles.accentDark, iconName: "key-term" };
    default:
      return { bg: withAlpha(styles.accent, 0.08), border: withAlpha(styles.accent, 0.42), fg: styles.accentDark, iconName: "star" };
  }
};

/** A typed callout (key term, example, misconception, check, instructor note, tip) with an icon. */
export const buildThemedNote = (theme: Theme, variant: NoteVariant, title: string, body: string): string => {
  const note = noteStyle(theme, variant);
  const styles = getThemeStyles(theme);
  return `<div style="margin: 18px 0; padding: 16px 18px 16px 20px; border: 1px solid ${note.border}; border-left: 5px solid ${note.fg}; background: ${note.bg}; border-radius: 12px; box-shadow: ${SHADOW_SM};">
  <h3 style="margin: 0 0 8px; color: ${note.fg}; font-weight: 800; font-size: 16px; font-family: ${styles.font};"><span style="margin-right: 9px;">${icon(note.iconName, { color: note.fg, size: 18 })}</span>${escHtml(title)}</h3>
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

// ---- Specialized course-object cards (Canvas-safe, theme-driven, no JS) -----
// Shared bits so every card reads consistently.
const cardLabel = (styles: ThemeStyles, label: string, emoji: string): string =>
  `<div style="font-size: 12px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; color: ${styles.accentDark}; margin: 0 0 5px; font-family: ${styles.font};"><span aria-hidden="true" style="margin-right: 7px;">${emoji}</span>${escHtml(label)}</div>`;

const cardBlock = (styles: ThemeStyles, label: string, emoji: string, value: string | undefined): string =>
  value && value.trim() ? `<div style="margin: 0 0 14px;">${cardLabel(styles, label, emoji)}<p style="margin: 0; color: #374151;">${escHtml(value)}</p></div>` : "";

const metaPills = (styles: ThemeStyles, items: string[]): string =>
  items.length
    ? `<div style="margin: 0 0 14px;">${items
        .map(
          (item) =>
            `<span style="display: inline-block; margin: 0 8px 6px 0; padding: 5px 12px; border-radius: 999px; background: ${withAlpha(styles.accent, 0.1)}; border: 1px solid ${withAlpha(styles.accent, 0.32)}; color: ${styles.accentDark}; font-size: 12.5px; font-weight: 700; font-family: ${styles.font};">${escHtml(item)}</span>`
        )
        .join("")}</div>`
    : "";

const objectCard = (styles: ThemeStyles, metaItems: string[], blocks: string): string =>
  `<section style="margin: 22px 0; background: #ffffff; border: 1px solid ${styles.border}; border-left: 6px solid ${styles.accent}; border-radius: 14px; box-shadow: ${SHADOW_SM}; padding: 20px 24px; font-family: ${styles.font}; line-height: 1.6;">${metaPills(styles, metaItems)}${blocks}</section>`;

/** A row of learning-objective badges (pill chips with a check icon). */
export const buildObjectiveBadges = (theme: Theme, objectives: string[]): string => {
  const styles = getThemeStyles(theme);
  const items = objectives.filter((objective) => objective && objective.trim());
  if (!items.length) return "";
  const badges = items
    .map(
      (objective) =>
        `<span style="display: inline-block; margin: 0 8px 8px 0; padding: 8px 14px 8px 12px; border-radius: 999px; background: ${withAlpha(styles.accent, 0.1)}; border: 1px solid ${withAlpha(styles.accent, 0.4)}; color: ${styles.accentDark}; font-size: 13px; font-weight: 700; font-family: ${styles.font};"><span aria-hidden="true" style="margin-right: 7px;">&#10003;</span>${escHtml(objective)}</span>`
    )
    .join("");
  return `<div style="margin: 14px 0;">${badges}</div>`;
};

export interface AssignmentCardFields {
  purpose?: string;
  task?: string;
  deliverable?: string;
  successCriteria?: string;
  dueLabel?: string;
  points?: number;
  estimatedHours?: number;
}

/** Assignment card: due/points/time meta + purpose, task, deliverable, success criteria. */
export const buildAssignmentCard = (theme: Theme, fields: AssignmentCardFields): string => {
  const styles = getThemeStyles(theme);
  const meta: string[] = [];
  if (fields.dueLabel) meta.push(`Due: ${fields.dueLabel}`);
  if (typeof fields.points === "number") meta.push(`${fields.points} pts`);
  if (typeof fields.estimatedHours === "number" && fields.estimatedHours > 0) meta.push(`~${fields.estimatedHours} hr`);
  const blocks = [
    cardBlock(styles, "Purpose", "&#127919;", fields.purpose),
    cardBlock(styles, "Your task", "&#128221;", fields.task),
    cardBlock(styles, "Deliverable", "&#128228;", fields.deliverable),
    cardBlock(styles, "Success criteria", "&#9989;", fields.successCriteria)
  ].join("");
  return objectCard(styles, meta, blocks);
};

export interface DiscussionCardFields {
  prompt?: string;
  preparation?: string;
  replyExpectations?: string;
  gradingCriteria?: string;
  dueLabel?: string;
  points?: number;
}

/** Discussion card: prompt, preparation, reply expectations, grading criteria. */
export const buildDiscussionCard = (theme: Theme, fields: DiscussionCardFields): string => {
  const styles = getThemeStyles(theme);
  const meta: string[] = [];
  if (fields.dueLabel) meta.push(`Due: ${fields.dueLabel}`);
  if (typeof fields.points === "number") meta.push(`${fields.points} pts`);
  const blocks = [
    cardBlock(styles, "Prompt", "&#128172;", fields.prompt),
    cardBlock(styles, "Prepare", "&#128218;", fields.preparation),
    cardBlock(styles, "Reply expectations", "&#128101;", fields.replyExpectations),
    cardBlock(styles, "Graded on", "&#9989;", fields.gradingCriteria)
  ].join("");
  return objectCard(styles, meta, blocks);
};

export interface QuizCardFields {
  purpose?: string;
  format?: string;
  preparation?: string;
  estimatedMinutes?: number;
  points?: number;
  integrityNote?: string;
}

/** Quiz card: purpose, format, preparation tips, estimated time, integrity note. */
export const buildQuizCard = (theme: Theme, fields: QuizCardFields): string => {
  const styles = getThemeStyles(theme);
  const meta: string[] = [];
  if (typeof fields.estimatedMinutes === "number" && fields.estimatedMinutes > 0) meta.push(`~${fields.estimatedMinutes} min`);
  if (typeof fields.points === "number") meta.push(`${fields.points} pts`);
  const blocks = [
    cardBlock(styles, "Purpose", "&#127919;", fields.purpose),
    cardBlock(styles, "Format", "&#128203;", fields.format),
    cardBlock(styles, "How to prepare", "&#128218;", fields.preparation),
    cardBlock(styles, "Academic integrity", "&#128274;", fields.integrityNote)
  ].join("");
  return objectCard(styles, meta, blocks);
};

/** Workload breakdown tiles: a big number + label per category (reading, writing, practice…). */
export const buildWorkloadTiles = (theme: Theme, tiles: Array<{ label: string; value: string; sub?: string }>): string => {
  const styles = getThemeStyles(theme);
  if (!tiles.length) return "";
  const items = tiles
    .map(
      (tile) =>
        `<div style="display: inline-block; width: 31%; min-width: 150px; vertical-align: top; margin: 0 1% 14px 0; box-sizing: border-box; padding: 16px 18px; background: linear-gradient(135deg, ${styles.soft} 0%, ${withAlpha(styles.accent, 0.06)} 100%); border: 1px solid ${withAlpha(styles.accent, 0.28)}; border-radius: 14px;">
    <div style="font-size: 26px; font-weight: 900; color: ${styles.accentDark}; font-family: ${styles.font};">${escHtml(tile.value)}</div>
    <div style="font-size: 13px; font-weight: 700; color: #374151; margin: 4px 0 0; font-family: ${styles.font};">${escHtml(tile.label)}</div>
    ${tile.sub ? `<div style="font-size: 12px; color: #6b7280; margin: 3px 0 0;">${escHtml(tile.sub)}</div>` : ""}
  </div>`
    )
    .join("");
  return `<div style="margin: 16px 0; font-size: 0;">${items}</div>`;
};

/** Module roadmap / weekly rhythm strip: numbered stops with a label + sublabel. */
export const buildModuleRoadmap = (theme: Theme, stops: Array<{ label: string; sub?: string }>): string => {
  const styles = getThemeStyles(theme);
  if (!stops.length) return "";
  const items = stops
    .map(
      (stop, index) =>
        `<div style="display: inline-block; vertical-align: top; width: 24%; min-width: 130px; margin: 0 1% 12px 0; box-sizing: border-box; text-align: center;">
    <span style="display: inline-block; width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, ${styles.accent}, ${styles.accentDark}); color: ${styles.onAccent}; line-height: 34px; font-weight: 800; font-family: ${styles.font};">${index + 1}</span>
    <div style="font-size: 13.5px; font-weight: 700; color: ${styles.accentDark}; margin: 7px 0 0; font-family: ${styles.font};">${escHtml(stop.label)}</div>
    ${stop.sub ? `<div style="font-size: 12px; color: #6b7280; margin: 2px 0 0;">${escHtml(stop.sub)}</div>` : ""}
  </div>`
    )
    .join("");
  return `<div style="margin: 18px 0; font-size: 0;">${items}</div>`;
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

// ---- Phase-2 content blocks: richer, themeable, Canvas-safe page primitives ----

/** A vertical timeline (schedule / project milestones) — the tall sibling of buildModuleRoadmap. */
export const buildThemedTimeline = (
  theme: Theme,
  items: Array<{ label: string; date?: string; body?: string }>
): string => {
  const styles = getThemeStyles(theme);
  if (!items.length) return "";
  const rows = items
    .map(
      (item) => `<div style="position: relative; margin: 0 0 ${SPACE.md}px;">
    <span aria-hidden="true" style="position: absolute; left: -${SPACE.lg}px; top: 3px; width: 16px; height: 16px; border-radius: 50%; background: #ffffff; border: 3px solid ${styles.accent}; box-sizing: border-box;"></span>
    <div style="font-weight: 800; color: ${styles.accentDark}; font-family: ${styles.font};">${escHtml(item.label)}${item.date ? `<span style="margin-left: 9px; font-size: 12px; font-weight: 700; color: ${styles.accent}; background: ${withAlpha(styles.accent, 0.1)}; padding: 2px 9px; border-radius: 999px;">${escHtml(item.date)}</span>` : ""}</div>
    ${item.body ? `<div style="margin: 4px 0 0; color: #374151;">${escHtml(item.body)}</div>` : ""}
  </div>`
    )
    .join("");
  return `<div style="position: relative; margin: ${SPACE.md}px 0; padding-left: ${SPACE.lg}px;">
  <div aria-hidden="true" style="position: absolute; left: 7px; top: 6px; bottom: 6px; width: 2px; background: linear-gradient(${styles.accent}, ${styles.accentDark});"></div>
  ${rows}
</div>`.trim();
};

/** A big themed pull-quote / epigraph for readings and the humanities. */
export const buildThemedPullQuote = (theme: Theme, quote: string, attribution?: string): string => {
  const styles = getThemeStyles(theme);
  return `<blockquote style="margin: 24px 0; padding: 6px 0 6px 26px; border-left: 5px solid ${styles.accent}; font-family: ${styles.font};">
  <div aria-hidden="true" style="font-size: 40px; line-height: 0.2; color: ${withAlpha(styles.accent, 0.5)}; font-weight: 900;">&ldquo;</div>
  <p style="margin: 6px 0 0; font-size: 22px; line-height: 1.45; color: ${styles.accentDark}; font-weight: 700; font-style: italic; max-width: ${MEASURE};">${escHtml(quote)}</p>
  ${attribution ? `<cite style="display: block; margin: 12px 0 0; font-style: normal; font-weight: 700; color: ${styles.contrastText};">&mdash; ${escHtml(attribution)}</cite>` : ""}
</blockquote>`.trim();
};

/** A KPI/stat band: big-number tiles ("12 weeks · 3 credits · 5 projects"). */
export const buildThemedStatBand = (
  theme: Theme,
  stats: Array<{ value: string; label: string; sub?: string }>
): string => {
  const styles = getThemeStyles(theme);
  if (!stats.length) return "";
  const tiles = stats
    .map(
      (stat) => `<div style="display: inline-block; vertical-align: top; box-sizing: border-box; width: 24%; min-width: 150px; margin: 0 1% 12px 0; padding: 18px 16px; text-align: center; background: linear-gradient(135deg, ${styles.soft} 0%, ${withAlpha(styles.accent, 0.08)} 100%); border: 1px solid ${withAlpha(styles.accent, 0.28)}; border-radius: ${RADIUS.card}px; font-size: 15px;">
    <div style="font-size: 30px; font-weight: 900; color: ${styles.accentDark}; line-height: 1.1; font-family: ${styles.font};">${escHtml(stat.value)}</div>
    <div style="margin: 4px 0 0; font-size: 12px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: ${styles.accent};">${escHtml(stat.label)}</div>
    ${stat.sub ? `<div style="margin: 3px 0 0; font-size: 12px; color: #64748b;">${escHtml(stat.sub)}</div>` : ""}
  </div>`
    )
    .join("");
  return `<div style="margin: ${SPACE.md}px 0; font-size: 0;">${tiles}</div>`;
};

/** A Key Terms glossary card — gives the AI-generated key terms a designed home. */
export const buildThemedGlossary = (theme: Theme, terms: Array<{ term: string; definition: string }>): string => {
  const styles = getThemeStyles(theme);
  if (!terms.length) return "";
  const rows = terms
    .map(
      (entry, index) => `<div style="padding: 12px 18px; border-left: 3px solid ${styles.accent}; ${index ? `border-top: 1px solid ${styles.border};` : ""}">
    <dt style="font-weight: 800; color: ${styles.accentDark}; font-family: ${styles.font};">${escHtml(entry.term)}</dt>
    <dd style="margin: 4px 0 0; color: #374151;">${escHtml(entry.definition)}</dd>
  </div>`
    )
    .join("");
  return `<dl style="margin: ${SPACE.md}px 0; background: #ffffff; border: 1px solid ${styles.border}; border-radius: ${RADIUS.card}px; box-shadow: ${ELEVATION.sm}; overflow: hidden;">
  <div style="display: flex; align-items: center; gap: 9px; padding: 12px 18px; background: ${styles.soft}; border-bottom: 1px solid ${styles.border}; font-weight: 800; color: ${styles.accentDark}; font-family: ${styles.font};">${icon("key-term", { color: styles.accent, size: 18 })} Key Terms</div>
  ${rows}
</dl>`.trim();
};

/** A compact "At a glance" sidebar card — due / points / time / outcomes for an object. */
export const buildThemedAtAGlance = (
  theme: Theme,
  rows: Array<{ icon: IconName; label: string; value: string }>
): string => {
  const styles = getThemeStyles(theme);
  if (!rows.length) return "";
  const body = rows
    .map(
      (row, index) => `<div style="${index ? `border-top: 1px solid ${withAlpha(styles.accent, 0.18)};` : ""} padding: 8px 0;">
    <span style="display: inline-block; width: 58%; vertical-align: middle;">${iconLabel(row.icon, row.label, { color: styles.accent, size: 16 })}</span><span style="display: inline-block; width: 40%; text-align: right; vertical-align: middle; font-weight: 800; color: ${styles.accentDark};">${escHtml(row.value)}</span>
  </div>`
    )
    .join("");
  return `<aside style="margin: ${SPACE.md}px 0; background: ${styles.soft}; border: 1px solid ${withAlpha(styles.accent, 0.3)}; border-radius: ${RADIUS.card}px; padding: 16px 18px; font-family: ${styles.font};">
  <div style="font-size: 12px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: ${styles.accentDark}; margin: 0 0 6px;">At a glance</div>
  ${body}
</aside>`.trim();
};

/** A difficulty / effort meter — filled dots out of `max`. */
export const buildThemedEffortMeter = (theme: Theme, level: number, max = 3, label = "Effort"): string => {
  const styles = getThemeStyles(theme);
  const filled = Math.max(0, Math.min(max, Math.round(level)));
  const dots = Array.from({ length: max })
    .map(
      (_unused, index) =>
        `<span aria-hidden="true" style="display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-left: 5px; background: ${index < filled ? styles.accent : withAlpha(styles.accent, 0.22)};"></span>`
    )
    .join("");
  return `<span style="display: inline-block; font-family: ${styles.font};"><span style="font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #64748b; vertical-align: middle;">${escHtml(label)}</span>${dots}<span style="position: absolute; left: -9999px;">${filled} of ${max}</span></span>`;
};

/** Visually-grouped panels (a static, JS-free "tabbed" section): a tab bar over stacked panels. */
export const buildThemedPanels = (theme: Theme, panels: Array<{ label: string; body: string }>): string => {
  const styles = getThemeStyles(theme);
  if (!panels.length) return "";
  const tabs = panels
    .map(
      (panel, index) =>
        `<span style="display: inline-block; padding: 11px 18px; font-weight: 800; font-family: ${styles.font}; color: ${index === 0 ? styles.accentDark : "#94a3b8"}; border-bottom: 3px solid ${index === 0 ? styles.accent : "transparent"};">${escHtml(panel.label)}</span>`
    )
    .join("");
  const bodies = panels
    .map(
      (panel, index) => `<div style="padding: 16px 20px; ${index ? `border-top: 1px solid ${styles.border};` : ""}">
    <div style="font-size: 12px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: ${styles.accent}; margin: 0 0 8px;">${escHtml(panel.label)}</div>
    ${panel.body}
  </div>`
    )
    .join("");
  return `<div style="margin: ${SPACE.md}px 0; border: 1px solid ${styles.border}; border-radius: ${RADIUS.card}px; overflow: hidden; box-shadow: ${ELEVATION.sm};">
  <div style="background: ${styles.soft}; border-bottom: 1px solid ${styles.border}; padding: 0 6px;">${tabs}</div>
  ${bodies}
</div>`.trim();
};

/** A comparison / decision matrix — a table with an emphasized first (label) column. */
export const buildThemedMatrix = (
  theme: Theme,
  columns: string[],
  rows: Array<{ label: string; cells: string[] }>
): string => {
  const styles = getThemeStyles(theme);
  const head = `<th scope="col" style="text-align: left; padding: 12px 15px; background: ${styles.accentDark}; color: ${styles.onAccentDark}; font-family: ${styles.font};"></th>${columns
    .map((col) => `<th scope="col" style="text-align: left; padding: 12px 15px; background: linear-gradient(135deg, ${styles.accent}, ${styles.accentDark}); color: ${styles.onAccent}; font-weight: 800; font-family: ${styles.font};">${escHtml(col)}</th>`)
    .join("")}`;
  const body = rows
    .map(
      (row, index) =>
        `<tr style="background: ${index % 2 === 1 ? withAlpha(styles.accent, 0.05) : "#ffffff"};"><th scope="row" style="text-align: left; padding: 11px 15px; background: ${styles.soft}; color: ${styles.accentDark}; font-weight: 800; border-top: 1px solid ${styles.border}; font-family: ${styles.font};">${escHtml(row.label)}</th>${row.cells
          .map((cell) => `<td style="padding: 11px 15px; border-top: 1px solid ${styles.border}; color: #374151; vertical-align: top;">${cell}</td>`)
          .join("")}</tr>`
    )
    .join("");
  return `<div style="margin: ${SPACE.md}px 0; border: 1px solid ${styles.border}; border-radius: ${RADIUS.card}px; overflow: hidden; box-shadow: ${ELEVATION.sm};">
  <table style="width: 100%; border-collapse: collapse; font-size: 14px;"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
</div>`.trim();
};

/** A high-visibility deadline ribbon / date strip. */
export const buildThemedDeadlineRibbon = (theme: Theme, label: string, date: string, sub?: string): string => {
  const styles = getThemeStyles(theme);
  return `<div style="margin: ${SPACE.md}px 0; background: linear-gradient(135deg, ${styles.accent} 0%, ${styles.accentDark} 100%); color: ${styles.onAccent}; border-radius: ${RADIUS.card}px; padding: 14px 20px; box-shadow: ${ELEVATION.md}; font-family: ${styles.font};">
  <span style="vertical-align: middle;">${icon("deadline", { color: styles.onAccent, size: 20 })}</span>
  <strong style="margin-left: 10px; vertical-align: middle; font-size: 16px;">${escHtml(label)}</strong>
  <span style="margin-left: 10px; vertical-align: middle; font-weight: 800; background: ${withAlpha("#ffffff", 0.18)}; padding: 3px 12px; border-radius: 999px;">${escHtml(date)}</span>
  ${sub ? `<span style="margin-left: 10px; vertical-align: middle; opacity: 0.9;">${escHtml(sub)}</span>` : ""}
</div>`.trim();
};

/** A completion / achievement seal for end-of-module recap pages. */
export const buildThemedAchievement = (theme: Theme, title: string, sub?: string): string => {
  const styles = getThemeStyles(theme);
  return `<div style="margin: 20px 0; text-align: center; padding: 26px 24px; background: ${styles.soft}; border: 1px dashed ${withAlpha(styles.accent, 0.55)}; border-radius: ${RADIUS.lg}px; font-family: ${styles.font};">
  <div style="margin: 0 auto 12px; width: 66px; height: 66px; border-radius: 50%; border: 3px solid ${styles.accent}; box-sizing: border-box; line-height: 66px;"><span style="display: inline-block; vertical-align: middle; line-height: 1;">${icon("award", { color: styles.accent, size: 36, strokeWidth: 1.8 })}</span></div>
  <div style="font-weight: 900; color: ${styles.accentDark}; font-size: 18px;">${escHtml(title)}</div>
  ${sub ? `<div style="margin: 5px 0 0; color: ${styles.contrastText};">${escHtml(sub)}</div>` : ""}
</div>`.trim();
};

const RESOURCE_ICONS: Record<string, IconName> = {
  article: "reading",
  reading: "reading",
  video: "video",
  dataset: "chart",
  data: "chart",
  link: "resource",
  website: "resource",
  download: "download",
  file: "folder"
};

/** A reading / resource card — title + a typed chip (Article / Video / Dataset …) with its icon. */
export const buildThemedResourceCard = (
  theme: Theme,
  resource: { title: string; kind: string; meta?: string; href?: string }
): string => {
  const styles = getThemeStyles(theme);
  const iconName = RESOURCE_ICONS[resource.kind.trim().toLowerCase()] ?? "folder";
  const titleHtml = resource.href
    ? `<a href="${escAttr(safeHref(resource.href))}" style="color: #111827; text-decoration: none; font-weight: 800;">${escHtml(resource.title)} <span aria-hidden="true" style="color: ${styles.accent};">&rarr;</span></a>`
    : `<span style="color: #111827; font-weight: 800;">${escHtml(resource.title)}</span>`;
  return `<div style="margin: 12px 0; background: #ffffff; border: 1px solid ${styles.border}; border-left: 4px solid ${styles.accent}; border-radius: 12px; padding: 14px 18px; box-shadow: ${ELEVATION.sm}; font-family: ${styles.font};">
  <span style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; color: ${styles.accentDark}; background: ${withAlpha(styles.accent, 0.1)}; border: 1px solid ${withAlpha(styles.accent, 0.32)}; padding: 3px 10px; border-radius: 999px;">${icon(iconName, { color: styles.accent, size: 14 })}${escHtml(resource.kind)}</span>
  <div style="margin: 9px 0 0; font-size: 16px;">${titleHtml}</div>
  ${resource.meta ? `<div style="margin: 3px 0 0; color: #64748b; font-size: 14px;">${escHtml(resource.meta)}</div>` : ""}
</div>`.trim();
};

// ---- Phase-3 per-module identity + cohesion (one design language across the package) ----

/**
 * A sibling-but-distinct accent for module N: the theme accent gently hue-rotated on a 7-step cycle
 * (kept within ±27° so it never leaves the theme's color world) so Module 3 ≠ Module 7 and a long
 * course gains rhythm. index is 0-based.
 */
const MODULE_HUE_SHIFTS = [0, 16, -16, 26, -26, 9, -9]; // module 1 = base; neighbors distinct; within ±26°
export const moduleAccentTheme = (theme: Theme, index: number): Theme => {
  const shift = MODULE_HUE_SHIFTS[((index % MODULE_HUE_SHIFTS.length) + MODULE_HUE_SHIFTS.length) % MODULE_HUE_SHIFTS.length];
  if (shift === 0) return theme;
  const roll = (value: string | undefined): string | undefined => (value ? shiftHue(value, shift) : value);
  return {
    ...theme,
    accent: shiftHue(theme.accent, shift),
    accentDark: shiftHue(theme.accentDark, shift),
    soft: shiftHue(theme.soft, shift),
    gradientFrom: roll(theme.gradientFrom),
    gradientTo: roll(theme.gradientTo)
  };
};

/**
 * A 1440×220 module header strip: the module's rotated-accent gradient + pattern + motif, a big
 * number monogram, and the module title. Used when imageSettings.moduleHeaderImages is on so each
 * module opens with its own banner instead of a flat heading.
 */
export const buildModuleHeaderSvg = (theme: Theme, moduleNumber: number, moduleTitle: string, label = "Module"): string => {
  const moduleTheme = moduleAccentTheme(theme, moduleNumber - 1);
  const styles = getThemeStyles(moduleTheme);
  const pattern = svgBannerPattern(styles.pattern);
  const onInk = styles.onGradient;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="220" viewBox="0 0 1440 220" role="img" aria-labelledby="mhTitle">
  <title id="mhTitle">${escapeXml(label)} ${moduleNumber}: ${escapeXml(moduleTitle)}</title>
  <defs>
    <linearGradient id="mhBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${escapeXml(styles.gradientFrom)}"/><stop offset="1" stop-color="${escapeXml(styles.gradientTo)}"/></linearGradient>
    ${pattern.def}
  </defs>
  <rect width="1440" height="220" fill="url(#mhBg)"/>
  ${pattern.rect}
  <g transform="translate(0,-70) scale(1,0.78)">${motifBannerArt(styles.motif)}</g>
  <circle cx="150" cy="110" r="68" fill="${withAlpha(onInk, 0.16)}"/>
  <text x="150" y="110" text-anchor="middle" dominant-baseline="central" font-family="${styles.font}" font-size="64" font-weight="800" fill="${onInk}">${moduleNumber}</text>
  <text x="262" y="96" font-family="${styles.font}" font-size="20" font-weight="700" fill="${onInk}" opacity="0.85" letter-spacing="3">${escapeXml(label.toUpperCase())}</text>
  <text x="262" y="146" font-family="${styles.font}" font-size="40" font-weight="800" fill="${onInk}">${escapeXml(moduleTitle.length > 46 ? `${moduleTitle.slice(0, 44)}…` : moduleTitle)}</text>
</svg>`;
};

/** A square (800×800) course tile — same design language as the banner, for the dashboard thumbnail. */
export const buildCourseTileSvg = (title: string, theme: Theme): string => {
  const styles = getThemeStyles(theme);
  const pattern = svgBannerPattern(styles.pattern);
  const onInk = styles.onGradient;
  const lines = title.length > 22 ? [title.slice(0, 22), title.slice(22, 44)] : [title];
  const titleText = lines
    .map((line, index) => `<tspan x="80" dy="${index === 0 ? 0 : 56}">${escapeXml(line)}</tspan>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800" role="img" aria-labelledby="tileTitle">
  <title id="tileTitle">${escapeXml(title)}</title>
  <defs><linearGradient id="tileBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${escapeXml(styles.gradientFrom)}"/><stop offset="1" stop-color="${escapeXml(styles.gradientTo)}"/></linearGradient>${pattern.def}</defs>
  <rect width="800" height="800" fill="url(#tileBg)"/>
  ${pattern.rect}
  <g transform="translate(-360,120) scale(0.85)">${motifBannerArt(styles.motif)}</g>
  <text x="80" y="120" font-family="${styles.font}" font-size="22" font-weight="700" fill="${onInk}" opacity="0.85" letter-spacing="4">${escapeXml(theme.bannerLabel.toUpperCase())}</text>
  <text y="640" font-family="${styles.font}" font-size="52" font-weight="800" fill="${onInk}">${titleText}</text>
  <rect x="80" y="700" width="84" height="6" rx="3" fill="${withAlpha(onInk, 0.7)}"/>
</svg>`;
};

/** A quiet themed colophon for the homepage footer — subtle brand reinforcement. */
export const buildThemedColophon = (theme: Theme): string => {
  const styles = getThemeStyles(theme);
  return `<div style="margin: 28px 0 4px; padding: 14px 0 0; border-top: 1px solid ${styles.border}; text-align: center; font-family: ${styles.font};">
  <span style="display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: linear-gradient(135deg, ${styles.accent}, ${styles.accentDark}); vertical-align: middle; margin-right: 8px;"></span><span style="font-size: 12px; letter-spacing: 0.06em; color: #94a3b8;">Designed with <strong style="color: ${styles.accentDark};">RocketCourse</strong></span>
</div>`.trim();
};

export const buildThemePreviewHtml = (theme: Theme, kind: ThemePreviewKind, courseTitle = "Course Preview"): string => {
  const styles = getThemeStyles(theme);
  const intro = `<p style="margin: 0 0 12px; color: ${styles.mutedText};">This preview uses Canvas-safe inline HTML with no external fonts, scripts, or fragile assets.</p>`;
  // The real homepage leads with the themed course banner — show it so the motif (cosmic, circuit,
  // lab, …) is visible the moment a theme is selected. Rendered in-app, so a data-URI img is safe.
  const bannerImg = `<img src="data:image/svg+xml;utf8,${encodeURIComponent(buildBannerSvg(courseTitle, theme))}" alt="${escAttr(courseTitle)} banner" style="display: block; width: 100%; height: auto; border-radius: 12px; margin: 0 0 18px;"/>`;

  if (kind === "homepage") {
    // Showcase the richer kit so selecting a template demonstrates icons, data-viz, and the new
    // content blocks — all themed to the selected palette/hero/card personality.
    const showcase = `${buildThemedStatBand(theme, [
      { value: "12", label: "Weeks" },
      { value: "3", label: "Credits" },
      { value: "5", label: "Projects" },
      { value: "94%", label: "Ready" }
    ])}${buildThemedDeadlineRibbon(theme, "Module 1 opens", "Aug 25", "Begin with Start Here")}<div style="font-size: 0; margin: 4px 0;"><div style="display: inline-block; width: 49%; min-width: 240px; vertical-align: top; margin-right: 1%; font-size: 14px;">${buildGradeWeightDonut(
      theme,
      [
        { name: "Assignments", weight: 40 },
        { name: "Discussions", weight: 20 },
        { name: "Quizzes", weight: 15 },
        { name: "Final Project", weight: 25 }
      ]
    )}</div><div style="display: inline-block; width: 49%; min-width: 240px; vertical-align: top; font-size: 14px;">${buildBloomPyramid(theme, [
      { label: "Create" },
      { label: "Evaluate" },
      { label: "Apply" },
      { label: "Understand" }
    ])}</div></div>${buildThemedNote(theme, "tip", "Study tip", paragraph("Skim each module overview before the lesson page to prime the key terms."))}${buildThemedGlossary(
      theme,
      [
        { term: "Construct", definition: "A concept defined precisely enough to observe or measure." },
        { term: "Alignment", definition: "Outcomes, activities, and assessments all pointing at the same goal." }
      ]
    )}${buildThemedAchievement(theme, "Module complete", "Nice work — you finished the Start Here module.")}${buildThemedColophon(theme)}`;
    return `<div style="font-family: ${styles.font};">${bannerImg}${buildThemedShell(
      theme,
      `${courseTitle} Homepage`,
      "Welcome students into a clear Canvas course path.",
      `${intro}${buildThemedCard(theme, "Start Here", `${paragraph("Open the Course Success Guide, review the syllabus, then begin Module 1.")}${buildThemedButton(theme, "Start Here", "course-success-guide.html")}${buildThemedSecondaryButton(theme, "View syllabus", "syllabus.html")}`)}${buildThemedCallout(theme, "Instructor note", paragraph("Use announcements and office hours to ask questions early."))}${showcase}${sampleTable(theme)}`
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
