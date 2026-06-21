import type { Theme } from "../types";
import { bestTextOn, contrastRatio } from "../utils/color";

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
}

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

export const getThemeStyles = (theme: Theme): ThemeStyles => ({
  accent: theme.accent,
  accentDark: theme.accentDark,
  soft: theme.soft,
  contrastText: theme.contrastText,
  onAccent: bestTextOn(theme.accent),
  onAccentDark: bestTextOn(theme.accentDark),
  border: "#dbe4f0",
  canvasText: "#111827",
  mutedText: "#374151",
  canvasBackground: "#ffffff"
});

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
    contrastCheck("dark-on-accent", "Text on dark accent", styles.onAccentDark, styles.accentDark)
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
  <div style="margin: 0 0 18px; padding: 24px; background: ${styles.soft}; border: 1px solid ${styles.border}; border-radius: 8px;">
    <h1 style="margin: 0 0 8px; color: ${styles.canvasText};">${escHtml(title)}</h1>
    <p style="margin: 0; color: ${styles.mutedText}; font-size: 16px;">${escHtml(subtitle)}</p>
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
