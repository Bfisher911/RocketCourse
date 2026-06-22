// ============================================================================
// Homepage template system
// ----------------------------------------------------------------------------
// The course homepage is the first page a student sees. Rather than hand-editing
// raw HTML, instructors edit a small structured model (HomepageContent) and pick
// a template; the rendered Canvas-safe HTML is always derived from
// (templateId, content, theme). That keeps the friendly builder, the live
// preview, and the exported Canvas page in lockstep, and lets a theme change
// recolor the page without disturbing instructor-authored text.
//
// Every template here is Canvas-safe by construction: inline styles only, exactly
// one <h1>, informative alt text, descriptive internal links, and no <script>,
// <style>, <iframe>, <form>, inline event handlers, or javascript: URLs.
// ============================================================================

import type { HomepageContent, HomepageLink, HomepageState, Theme } from "../types";
import { bestTextOn } from "../utils/color";
import { fileRef, wikiPageRef, WELL_KNOWN_PAGE_IDS } from "./canvasLinks";

// The canonical Canvas link tokens the homepage points at. These are NOT relative
// ".html" paths — Canvas rewrites these tokens to live course URLs on import, so the
// homepage buttons actually resolve in the imported course. Keeping them here means
// every template, the default content, and the readiness checks stay in lockstep.
export const SYLLABUS_HREF = wikiPageRef(WELL_KNOWN_PAGE_IDS.syllabus);
export const SUCCESS_GUIDE_HREF = wikiPageRef(WELL_KNOWN_PAGE_IDS.successGuide);
export const CALENDAR_HREF = wikiPageRef(WELL_KNOWN_PAGE_IDS.calendar);
export const BANNER_SRC = fileRef("course-banner.svg");

export interface HomepageTemplateMeta {
  id: string;
  name: string;
  tagline: string;
  description: string;
  bestFor: string;
}

export const HOMEPAGE_TEMPLATES: HomepageTemplateMeta[] = [
  {
    id: "clean-canvas",
    name: "Clean Canvas",
    tagline: "Simple and professional",
    description: "A calm, professional Canvas homepage with a welcome, a clear start button, the syllabus, and a course path checklist.",
    bestFor: "Most courses — a dependable default that reads well on any device."
  },
  {
    id: "bold-university",
    name: "Bold University",
    tagline: "Strong hierarchy, vivid hero",
    description: "A visual homepage with an accent hero panel, three quick-start cards, and confident headings.",
    bestFor: "Flagship or recruiting courses that want a strong first impression."
  },
  {
    id: "warm-instructor",
    name: "Warm Instructor",
    tagline: "Personable and human",
    description: "Leads with a note from the instructor, then how to start, the weekly rhythm, and where to get help.",
    bestFor: "Seminar, cohort, and first-year courses where relationship matters."
  },
  {
    id: "high-contrast",
    name: "High Contrast",
    tagline: "Accessibility first",
    description: "Maximum-contrast text, large tap-friendly buttons, and simple stacked sections with no reliance on color alone.",
    bestFor: "Accessibility-priority courses and students using assistive technology."
  },
  {
    id: "project-based",
    name: "Project-Based Course",
    tagline: "Milestones and deliverables",
    description: "Organized around the final project: milestones, deliverables, and the module sequence that builds toward it.",
    bestFor: "Studio, capstone, lab, and portfolio courses driven by a final deliverable."
  }
];

export const DEFAULT_TEMPLATE_ID = "clean-canvas";

export const isKnownTemplate = (id: string): boolean => HOMEPAGE_TEMPLATES.some((template) => template.id === id);

export const templateMeta = (id: string): HomepageTemplateMeta =>
  HOMEPAGE_TEMPLATES.find((template) => template.id === id) ?? HOMEPAGE_TEMPLATES[0];

// ----------------------------------------------------------------------------
// Escaping + safe href handling
// ----------------------------------------------------------------------------

const escHtml = (value: string): string => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const escAttr = (value: string): string => escHtml(value).replace(/"/g, "&quot;");

// Strip dangerous URI schemes before rendering. A blocked scheme collapses to "#", which the
// homepage validator flags as a placeholder so the instructor sees and fixes it — but no
// javascript:/vbscript:/data: URL can ever reach the exported package.
export const safeHref = (target: string): string => {
  const trimmed = String(target ?? "").trim();
  if (!trimmed) return "#";
  if (/^(javascript|vbscript):/i.test(trimmed)) return "#";
  if (/^data:/i.test(trimmed) && !/^data:image\//i.test(trimmed)) return "#";
  return trimmed;
};

// ----------------------------------------------------------------------------
// Shared building blocks (inline-styled, Canvas-safe)
// ----------------------------------------------------------------------------

const wrapper = (inner: string): string =>
  `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #1f2733; line-height: 1.6; max-width: 960px; margin: 0 auto;">${inner}</div>`;

const banner = (content: HomepageContent, radius = 12): string =>
  `<p style="margin: 0 0 20px;"><img src="${BANNER_SRC}" alt="${escAttr(content.bannerAlt)}" style="width: 100%; max-height: 240px; object-fit: cover; border-radius: ${radius}px; display: block;" /></p>`;

const primaryButton = (link: HomepageLink, theme: Theme, bg = theme.accent): string =>
  `<a href="${escAttr(safeHref(link.target))}" style="display: inline-block; margin: 0 12px 12px 0; padding: 13px 24px; border-radius: 8px; background: ${bg}; color: ${bestTextOn(bg)}; text-decoration: none; font-weight: 700; font-size: 16px;">${escHtml(link.label)}</a>`;

const secondaryButton = (link: HomepageLink, theme: Theme): string =>
  `<a href="${escAttr(safeHref(link.target))}" style="display: inline-block; margin: 0 12px 12px 0; padding: 11px 22px; border-radius: 8px; background: #ffffff; border: 2px solid ${theme.accent}; color: ${theme.accentDark}; text-decoration: none; font-weight: 700; font-size: 16px;">${escHtml(link.label)}</a>`;

const checklist = (items: string[], accent: string): string =>
  `<ul style="list-style: none; margin: 12px 0 0; padding: 0;">${items
    .filter((item) => item.trim().length > 0)
    .map(
      (item) =>
        `<li style="margin: 10px 0; padding-left: 30px; position: relative;"><span aria-hidden="true" style="position: absolute; left: 0; top: 0; color: ${accent}; font-weight: 700; font-size: 18px;">&#10003;</span>${escHtml(item)}</li>`
    )
    .join("")}</ul>`;

const numberedList = (items: string[], accent: string): string =>
  `<ol style="margin: 12px 0 0; padding-left: 22px;">${items
    .filter((item) => item.trim().length > 0)
    .map((item) => `<li style="margin: 8px 0; padding-left: 6px;"><span style="color: ${accent}; font-weight: 700;">&nbsp;</span>${escHtml(item)}</li>`)
    .join("")}</ol>`;

const card = (title: string, body: string, theme: Theme): string =>
  `<section style="margin: 18px 0; padding: 22px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;"><h2 style="margin: 0 0 10px; font-size: 21px; color: ${theme.accentDark};">${escHtml(title)}</h2>${body}</section>`;

const paragraph = (text: string): string => `<p style="margin: 0 0 12px; color: #374151; font-size: 16px;">${escHtml(text)}</p>`;

// A descriptive quick-links row rendered by every template so the syllabus, success guide, and
// calendar links are always present, resolvable, and meaningfully labeled.
const quickLinks = (content: HomepageContent, theme: Theme): string => {
  const links = content.resourceLinks
    .filter((link) => link.label.trim().length > 0 && link.target.trim().length > 0)
    .map(
      (link) =>
        `<a href="${escAttr(safeHref(link.target))}" style="display: inline-block; margin: 6px 10px 6px 0; padding: 8px 14px; border-radius: 999px; background: ${theme.soft}; border: 1px solid ${theme.accent}; color: ${theme.accentDark}; text-decoration: none; font-weight: 600; font-size: 14px;">${escHtml(link.label)} &rarr;</a>`
    )
    .join("");
  return `<nav aria-label="Helpful course links" style="margin: 18px 0 0;"><p style="margin: 0 0 8px; font-weight: 700; color: #1f2733;">Helpful links</p>${links}</nav>`;
};

// ----------------------------------------------------------------------------
// Templates
// ----------------------------------------------------------------------------

const cleanCanvas = (content: HomepageContent, theme: Theme): string =>
  wrapper(
    `<div style="background: ${theme.soft}; border: 1px solid #e2e8f0; padding: 28px; border-radius: 14px;">
    ${banner(content)}
    <p style="margin: 0 0 6px; letter-spacing: 0.08em; text-transform: uppercase; font-size: 13px; font-weight: 700; color: ${theme.accentDark};">${escHtml(content.heroEyebrow)}</p>
    <h1 style="margin: 0 0 12px; font-size: 32px; color: #111827;">${escHtml(content.heroHeading)}</h1>
    <p style="margin: 0 0 18px; color: #374151; font-size: 17px;">${escHtml(content.welcome)}</p>
    <p style="margin: 0;">${primaryButton(content.primaryButton, theme)}${secondaryButton(content.secondaryButton, theme)}</p>
  </div>
  ${card("Your path through this course", checklist(content.pathItems, theme.accent), theme)}
  ${card("What to do first", `${paragraph("New here? Open the Start Here module and read the Course Success Guide before the first content module. It explains how the course works and how to succeed.")}${quickLinks(content, theme)}`, theme)}
  ${content.instructorNote.trim() ? card("A note from your instructor", paragraph(content.instructorNote), theme) : ""}`
  );

const boldUniversity = (content: HomepageContent, theme: Theme): string => {
  const heroText = bestTextOn(theme.accent);
  // Headings stay at h2 (not h3) so the page never skips a level after the h1 hero; the inline
  // font-size keeps the compact card look.
  const miniCard = (heading: string, body: string, link: HomepageLink): string =>
    `<div style="flex: 1 1 220px; min-width: 200px; background: #ffffff; border: 1px solid #e2e8f0; border-top: 4px solid ${theme.accent}; border-radius: 12px; padding: 18px;"><h2 style="margin: 0 0 8px; font-size: 17px; color: ${theme.accentDark};">${escHtml(heading)}</h2><p style="margin: 0 0 12px; color: #475569; font-size: 14px;">${escHtml(body)}</p><a href="${escAttr(safeHref(link.target))}" style="font-weight: 700; color: ${theme.accentDark}; text-decoration: none;">${escHtml(link.label)} &rarr;</a></div>`;
  return wrapper(
    `<div style="background: ${theme.accent}; border-radius: 16px; padding: 28px; color: ${heroText};">
    ${banner(content, 10)}
    <p style="margin: 0 0 8px; letter-spacing: 0.1em; text-transform: uppercase; font-size: 13px; font-weight: 700; opacity: 0.9;">${escHtml(content.heroEyebrow)}</p>
    <h1 style="margin: 0 0 14px; font-size: 38px; line-height: 1.15; color: ${heroText};">${escHtml(content.heroHeading)}</h1>
    <p style="margin: 0 0 22px; font-size: 18px; max-width: 640px; color: ${heroText}; opacity: 0.95;">${escHtml(content.welcome)}</p>
    <p style="margin: 0;">${primaryButton(content.primaryButton, theme, "#ffffff")}${secondaryButton({ ...content.secondaryButton }, theme)}</p>
  </div>
  <div style="display: flex; flex-wrap: wrap; gap: 16px; margin: 22px 0;">
    ${miniCard("Start Here", "Read the Course Success Guide to learn how everything fits together.", content.primaryButton)}
    ${miniCard("Syllabus", "Policies, outcomes, grading, and what is expected each week.", content.secondaryButton)}
    ${miniCard("Calendar", "Due dates and weekly workload so you can plan ahead.", { label: "Plan your weeks", target: CALENDAR_HREF })}
  </div>
  ${card("Your path through this course", checklist(content.pathItems, theme.accent), theme)}
  ${content.instructorNote.trim() ? card("From your instructor", paragraph(content.instructorNote), theme) : ""}
  ${card("Helpful links", quickLinks(content, theme), theme)}`
  );
};

const warmInstructor = (content: HomepageContent, theme: Theme): string =>
  wrapper(
    `${banner(content, 14)}
  <section style="margin: 0 0 18px; padding: 24px; background: ${theme.soft}; border-left: 6px solid ${theme.accent}; border-radius: 12px;">
    <p style="margin: 0 0 6px; letter-spacing: 0.06em; text-transform: uppercase; font-size: 12px; font-weight: 700; color: ${theme.accentDark};">${escHtml(content.heroEyebrow)}</p>
    <h1 style="margin: 0 0 12px; font-size: 30px; color: #111827;">${escHtml(content.heroHeading)}</h1>
    <p style="margin: 0; font-size: 17px; color: #374151;">${escHtml(content.instructorNote.trim() || content.welcome)}</p>
  </section>
  <p style="margin: 0 0 20px;">${primaryButton(content.primaryButton, theme)}${secondaryButton(content.secondaryButton, theme)}</p>
  ${card("How to get started", numberedList(content.pathItems, theme.accent), theme)}
  ${content.weeklyItems.some((item) => item.trim()) ? card("Our weekly rhythm", checklist(content.weeklyItems, theme.accent), theme) : ""}
  ${card("Where to get help", `${paragraph("You are not on your own. Use these anytime you are unsure what to do next:")}${quickLinks(content, theme)}`, theme)}`
  );

const highContrast = (content: HomepageContent, theme: Theme): string => {
  // Accessibility-first: black text on white, a near-black accent for buttons, thick borders,
  // large hit areas, and no reliance on color alone (every link is underlined + labeled).
  const buttonBg = theme.accentDark || "#111827";
  const hcButton = (link: HomepageLink, bg: string): string =>
    `<a href="${escAttr(safeHref(link.target))}" style="display: inline-block; margin: 0 14px 14px 0; padding: 16px 26px; border-radius: 8px; background: ${bg}; color: ${bestTextOn(bg)}; text-decoration: underline; font-weight: 700; font-size: 18px; border: 3px solid #000000;">${escHtml(link.label)}</a>`;
  const hcLinks = content.resourceLinks
    .map((link) => `<li style="margin: 10px 0;"><a href="${escAttr(safeHref(link.target))}" style="color: #0b1020; font-weight: 700; font-size: 17px; text-decoration: underline;">${escHtml(link.label)}</a></li>`)
    .join("");
  return wrapper(
    `<div style="background: #ffffff; border: 3px solid #000000; border-radius: 8px; padding: 28px;">
    <p style="margin: 0 0 8px; letter-spacing: 0.04em; text-transform: uppercase; font-size: 14px; font-weight: 700; color: #0b1020;">${escHtml(content.heroEyebrow)}</p>
    <h1 style="margin: 0 0 14px; font-size: 34px; color: #000000;">${escHtml(content.heroHeading)}</h1>
    <p style="margin: 0 0 20px; font-size: 18px; color: #1a1a1a;">${escHtml(content.welcome)}</p>
    <p style="margin: 0;">${hcButton(content.primaryButton, buttonBg)}${hcButton(content.secondaryButton, "#ffffff")}</p>
  </div>
  <section style="margin: 20px 0; padding: 24px; border: 3px solid #000000; border-radius: 8px;">
    <h2 style="margin: 0 0 12px; font-size: 24px; color: #000000;">Your path through this course</h2>
    ${checklist(content.pathItems, "#0b1020")}
  </section>
  ${content.instructorNote.trim() ? `<section style="margin: 20px 0; padding: 24px; border: 3px solid #000000; border-radius: 8px;"><h2 style="margin: 0 0 12px; font-size: 24px; color: #000000;">A note from your instructor</h2><p style="margin: 0; font-size: 17px; color: #1a1a1a;">${escHtml(content.instructorNote)}</p></section>` : ""}
  <section style="margin: 20px 0 0; padding: 24px; border: 3px solid #000000; border-radius: 8px;">
    <h2 style="margin: 0 0 12px; font-size: 24px; color: #000000;">Helpful links</h2>
    <ul style="margin: 0; padding-left: 22px;">${hcLinks}</ul>
  </section>`
  );
};

const projectBased = (content: HomepageContent, theme: Theme): string => {
  const milestoneList = content.weeklyItems.some((item) => item.trim()) ? content.weeklyItems : content.pathItems;
  return wrapper(
    `<div style="background: ${theme.soft}; border: 1px solid #e2e8f0; border-radius: 14px; padding: 28px;">
    ${banner(content)}
    <p style="margin: 0 0 6px; letter-spacing: 0.08em; text-transform: uppercase; font-size: 13px; font-weight: 700; color: ${theme.accentDark};">${escHtml(content.heroEyebrow)}</p>
    <h1 style="margin: 0 0 12px; font-size: 32px; color: #111827;">${escHtml(content.heroHeading)}</h1>
    <p style="margin: 0 0 18px; color: #374151; font-size: 17px;">${escHtml(content.welcome)}</p>
    <p style="margin: 0;">${primaryButton(content.primaryButton, theme)}${secondaryButton(content.secondaryButton, theme)}</p>
  </div>
  <section style="margin: 18px 0; padding: 22px; background: #ffffff; border: 1px solid #e2e8f0; border-left: 5px solid ${theme.accent}; border-radius: 12px;">
    <h2 style="margin: 0 0 10px; font-size: 21px; color: ${theme.accentDark};">Where this course is headed</h2>
    ${paragraph("Everything you do builds toward the final project. Use the milestones below to stay on track, and revisit them whenever you plan your week.")}
  </section>
  ${card("Project milestones", numberedList(milestoneList, theme.accent), theme)}
  ${card("How each module works", checklist(content.pathItems, theme.accent), theme)}
  ${card("Resources and deliverables", quickLinks(content, theme), theme)}
  ${content.instructorNote.trim() ? card("A note from your instructor", paragraph(content.instructorNote), theme) : ""}`
  );
};

type TemplateRenderer = (content: HomepageContent, theme: Theme) => string;

const RENDERERS: Record<string, TemplateRenderer> = {
  "clean-canvas": cleanCanvas,
  "bold-university": boldUniversity,
  "warm-instructor": warmInstructor,
  "high-contrast": highContrast,
  "project-based": projectBased
};

// Render a homepage to Canvas-safe HTML. Falls back to the default template for an unknown id.
export const renderHomepage = (templateId: string, content: HomepageContent, theme: Theme): string => {
  const renderer = RENDERERS[templateId] ?? RENDERERS[DEFAULT_TEMPLATE_ID];
  return renderer(content, theme).trim();
};

// ----------------------------------------------------------------------------
// Default content derived from the course
// ----------------------------------------------------------------------------

export interface HomepageContext {
  title: string;
  description: string;
  modality: string;
  level: string;
  moduleCount: number;
  finalProject: boolean;
  finalProjectType: string;
  organizationLabel: string;
}

const sentence = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
};

export const defaultHomepageContent = (context: HomepageContext): HomepageContent => {
  const modality = context.modality?.toLowerCase().includes("async")
    ? "fully online and self-paced within each week"
    : context.modality || "structured";
  const unit = context.organizationLabel?.toLowerCase().includes("week") ? "week" : "module";
  return {
    bannerAlt: `${context.title} course banner`,
    heroEyebrow: "Welcome to your course",
    heroHeading: `Welcome to ${context.title}`,
    welcome: sentence(context.description) || `This is your home base for ${context.title}. Start here, then move through the course one step at a time.`,
    primaryButton: { label: "Start Here", target: SUCCESS_GUIDE_HREF },
    secondaryButton: { label: "View the syllabus", target: SYLLABUS_HREF },
    pathItems: [
      "Open Start Here and read the Course Success Guide.",
      "Check the calendar and workload plan so you know the pace.",
      `Work through the ${unit}s in order — each one opens with an overview.`,
      "Use the rubrics and recap pages before you submit graded work.",
      context.finalProject ? "Finish strong with the Final Project module." : "Review the recap pages before the final assessment."
    ],
    instructorNote: `Welcome! I am glad you are here. This ${context.level || "course"} is ${modality}, and it is designed so you always know what to do next. If anything is unclear, reach out early — I would rather hear from you sooner than later.`,
    weeklyItems: [
      `Each ${unit} opens with an overview that sets the goals.`,
      "Read and watch the assigned materials.",
      "Join the discussion and learn from your classmates.",
      "Complete and submit the graded work before the due date.",
      "Review the recap before moving on."
    ],
    resourceLinks: [
      { label: "Course syllabus", target: SYLLABUS_HREF },
      { label: "Course Success Guide", target: SUCCESS_GUIDE_HREF },
      { label: "Calendar & workload plan", target: CALENDAR_HREF }
    ],
    purpose: "This is the first page students see. It welcomes them, explains how the course works, and points them to exactly where they should start."
  };
};

export const homepageContextFromCourse = (course: {
  title: string;
  description: string;
  settings: { modality: string; level: string; moduleCount: number; finalProject: boolean; finalProjectType: string; organizationPattern: string; customOrganizationLabel: string };
}): HomepageContext => ({
  title: course.title,
  description: course.description,
  modality: course.settings.modality,
  level: course.settings.level,
  moduleCount: course.settings.moduleCount,
  finalProject: course.settings.finalProject,
  finalProjectType: course.settings.finalProjectType,
  organizationLabel: course.settings.organizationPattern === "custom" ? course.settings.customOrganizationLabel : course.settings.organizationPattern
});

// ----------------------------------------------------------------------------
// State + re-theme helpers
// ----------------------------------------------------------------------------

export const createHomepageState = (content: HomepageContent, templateId: string, themeId: string, updatedAt: string): HomepageState => ({
  mode: "builder",
  templateId: isKnownTemplate(templateId) ? templateId : DEFAULT_TEMPLATE_ID,
  content,
  themeId,
  updatedAt,
  snapshots: []
});

// Re-render the homepage with a new theme, preserving instructor text. Returns null when the
// homepage is in custom (hand-edited HTML) mode so we never silently overwrite manual edits.
export const rethemeHomepageHtml = (state: HomepageState | undefined, theme: Theme): string | null => {
  if (!state || state.mode !== "builder") return null;
  return renderHomepage(state.templateId, state.content, theme);
};

// ----------------------------------------------------------------------------
// Context-aware revise actions
// ----------------------------------------------------------------------------

export type HomepageReviseAction =
  | "concise"
  | "examples"
  | "accessibility"
  | "start-path"
  | "instructor-welcome"
  | "weekly-rhythm"
  | "support-resources";

export interface HomepageReviseMeta {
  id: HomepageReviseAction;
  label: string;
  hint: string;
}

export const HOMEPAGE_REVISE_ACTIONS: HomepageReviseMeta[] = [
  { id: "concise", label: "Make more concise", hint: "Tighten the welcome and instructor note so students can scan it." },
  { id: "examples", label: "Add student-friendly examples", hint: "Make the path concrete with everyday examples." },
  { id: "accessibility", label: "Improve accessibility", hint: "Descriptive links, informative alt text, and a help path." },
  { id: "start-path", label: "Add a stronger start path", hint: "Sharpen the first steps and the Start Here button." },
  { id: "instructor-welcome", label: "Add instructor welcome", hint: "Add a warm, course-aware note from the instructor." },
  { id: "weekly-rhythm", label: "Add a weekly rhythm block", hint: "Show students the repeating weekly cadence." },
  { id: "support-resources", label: "Add support & success resources", hint: "Make sure syllabus, guide, and calendar links are present." }
];

const firstSentence = (value: string): string => {
  const match = value.trim().match(/^[^.!?]*[.!?]/);
  return match ? match[0].trim() : value.trim();
};

const dedupe = (items: string[]): string[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// Replace vague link text ("click here", "read more") with the descriptive label we already have.
const describeLink = (link: HomepageLink, fallback: string): HomepageLink => {
  const vague = /^(click here|here|read more|link|more|this)$/i.test(link.label.trim());
  return vague || !link.label.trim() ? { ...link, label: fallback } : link;
};

// Apply a context-aware revision to the structured content. Pure: returns new content; the
// caller snapshots and re-renders. Each action produces safer, more useful content than a
// canned HTML snippet because it edits the model the template renders from.
export const reviseHomepageContent = (action: HomepageReviseAction, content: HomepageContent, context: HomepageContext): HomepageContent => {
  switch (action) {
    case "concise":
      return {
        ...content,
        welcome: firstSentence(content.welcome),
        instructorNote: content.instructorNote ? firstSentence(content.instructorNote) : content.instructorNote,
        pathItems: content.pathItems.slice(0, 4)
      };
    case "examples":
      return {
        ...content,
        welcome: sentence(`${firstSentence(content.welcome)} For example, you might apply ${context.title} to a real situation you already care about`),
        pathItems: dedupe([
          ...content.pathItems,
          "Try the first activity with a real example from your own life or work.",
          "Bring a question or example to the discussion each week."
        ])
      };
    case "accessibility":
      return {
        ...content,
        bannerAlt: content.bannerAlt.trim() || `${context.title} course banner`,
        primaryButton: describeLink(content.primaryButton, "Start Here"),
        secondaryButton: describeLink(content.secondaryButton, "View the syllabus"),
        resourceLinks: ensureCoreLinks(content.resourceLinks).map((link, index) => describeLink(link, ["Course syllabus", "Course Success Guide", "Calendar & workload plan"][index] ?? link.label)),
        instructorNote: sentence(`${content.instructorNote.trim() || "Welcome!"} If you use assistive technology or need an accommodation, contact me and we will make it work`)
      };
    case "start-path":
      return {
        ...content,
        primaryButton: { label: "Start Here", target: SUCCESS_GUIDE_HREF },
        pathItems: dedupe([
          "First, open Start Here and read the Course Success Guide.",
          "Next, check the calendar and workload plan so the pace is no surprise.",
          `Then work through the ${context.organizationLabel?.toLowerCase().includes("week") ? "week" : "module"}s in order, beginning with the overview page.`,
          "Before each submission, compare your work against the rubric.",
          ...content.pathItems
        ]).slice(0, 6)
      };
    case "instructor-welcome":
      return {
        ...content,
        instructorNote:
          content.instructorNote.trim() ||
          `Welcome to ${context.title}! I am genuinely glad you are here. This ${context.level || "course"} is built so you always know the next step. Reach out early and often — I am here to help you succeed.`
      };
    case "weekly-rhythm":
      return {
        ...content,
        weeklyItems: content.weeklyItems.some((item) => item.trim())
          ? content.weeklyItems
          : [
              "Open the new module overview to see the week's goals.",
              "Read and watch the assigned materials.",
              "Post and reply in the discussion.",
              "Submit the graded work before the due date.",
              "Review the recap before the next module."
            ]
      };
    case "support-resources":
      return { ...content, resourceLinks: ensureCoreLinks(content.resourceLinks) };
    default:
      return content;
  }
};

// Guarantee the syllabus, success guide, and calendar links are present and resolvable.
export const ensureCoreLinks = (links: HomepageLink[]): HomepageLink[] => {
  const byTarget = new Map(links.map((link) => [link.target, link]));
  const core: HomepageLink[] = [
    { label: "Course syllabus", target: SYLLABUS_HREF },
    { label: "Course Success Guide", target: SUCCESS_GUIDE_HREF },
    { label: "Calendar & workload plan", target: CALENDAR_HREF }
  ];
  const result = [...links];
  core.forEach((link) => {
    if (!byTarget.has(link.target)) result.push(link);
  });
  return result;
};
