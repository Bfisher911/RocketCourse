import type { Theme, ThemePattern } from "../types";
import { bestTextOn, contrastRatio } from "../utils/color";
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
  onGradient: string;
}

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

// The full hero background: the theme gradient, optionally textured with a pattern. Pure inline CSS.
export const heroBackgroundCss = (styles: ThemeStyles): string => {
  const gradient = `linear-gradient(135deg, ${styles.gradientFrom} 0%, ${styles.gradientTo} 100%)`;
  const ink = styles.onGradient === "#ffffff" ? "rgba(255,255,255,0.13)" : "rgba(0,0,0,0.10)";
  const layer = patternLayer(styles.pattern, ink);
  if (!layer) return `background: ${gradient};`;
  return `background-color: ${styles.gradientTo}; background-image: ${layer.image}, ${gradient}; background-size: ${layer.size}, auto;`;
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
    onGradient: textForGradient(gradientFrom, gradientTo)
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

// A themed 1440×360 banner SVG: gradient + pattern with a white title card. Used verbatim by the
// .imscc export (web_resources/course-banner.svg) and, as a data URI, by the in-app homepage preview,
// so the two never diverge. Title text sits on a white card, so it stays readable for any theme.
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
  <circle cx="1200" cy="84" r="130" fill="#ffffff" opacity="0.08"/>
  <circle cx="1030" cy="320" r="96" fill="#ffffff" opacity="0.06"/>
  <rect x="96" y="92" width="640" height="176" rx="18" fill="#ffffff" opacity="0.94"/>
  <text x="132" y="166" font-family="Arial, sans-serif" font-size="44" font-weight="700" fill="#111827">${escapeXml(title)}</text>
  <text x="132" y="214" font-family="Arial, sans-serif" font-size="24" fill="#374151">${escapeXml(theme.bannerLabel)}</text>
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

export const buildThemedButton = (theme: Theme, label: string, href: string): string => {
  const styles = getThemeStyles(theme);
  return `<a href="${escAttr(safeHref(href))}" style="display: inline-block; margin: 8px 10px 8px 0; padding: 11px 16px; border-radius: 7px; background: ${styles.accent}; color: ${styles.onAccent}; text-decoration: none; font-weight: 700;">${escHtml(label)}</a>`;
};

export const buildThemedSecondaryButton = (theme: Theme, label: string, href: string): string => {
  const styles = getThemeStyles(theme);
  return `<a href="${escAttr(safeHref(href))}" style="display: inline-block; margin: 8px 10px 8px 0; padding: 10px 15px; border-radius: 7px; background: #ffffff; border: 1px solid ${styles.accent}; color: ${styles.accentDark}; text-decoration: none; font-weight: 700;">${escHtml(label)}</a>`;
};

export const buildThemedCallout = (theme: Theme, title: string, body: string): string => {
  const styles = getThemeStyles(theme);
  return `<div style="margin: 18px 0; padding: 16px 18px; border-left: 5px solid ${styles.accent}; background: ${styles.soft}; border-radius: 8px;">
  <h3 style="margin: 0 0 8px; color: ${styles.accentDark};">${escHtml(title)}</h3>
  ${body}
</div>`.trim();
};

export const buildThemedCard = (theme: Theme, title: string, body: string): string => {
  const styles = getThemeStyles(theme);
  return `<section style="margin: 18px 0; padding: 18px; background: #ffffff; border: 1px solid ${styles.border}; border-radius: 8px;">
  <h2 style="margin: 0 0 10px; color: ${styles.accentDark};">${escHtml(title)}</h2>
  ${body}
</section>`.trim();
};

export const buildThemedShell = (theme: Theme, title: string, subtitle: string, body: string): string => {
  const styles = getThemeStyles(theme);
  return `<div style="font-family: Arial, sans-serif; color: ${styles.canvasText}; line-height: 1.55;">
  <div style="margin: 0 0 20px; padding: 28px 26px; ${heroBackgroundCss(styles)} border-radius: 12px; color: ${styles.onGradient};">
    <h1 style="margin: 0 0 8px; color: ${styles.onGradient}; font-size: 28px; line-height: 1.2;">${escHtml(title)}</h1>
    <p style="margin: 0; color: ${styles.onGradient}; opacity: 0.92; font-size: 16px;">${escHtml(subtitle)}</p>
  </div>
  ${body}
</div>`.trim();
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

  if (kind === "homepage") {
    return buildThemedShell(
      theme,
      `${courseTitle} Homepage`,
      "Welcome students into a clear Canvas course path.",
      `${intro}${buildThemedCard(theme, "Start Here", `${paragraph("Open the Course Success Guide, review the syllabus, then begin Module 1.")}${buildThemedButton(theme, "Start Here", "course-success-guide.html")}${buildThemedSecondaryButton(theme, "View syllabus", "syllabus.html")}`)}${buildThemedCallout(theme, "Instructor note", paragraph("Use announcements and office hours to ask questions early."))}${sampleTable(theme)}`
    );
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
