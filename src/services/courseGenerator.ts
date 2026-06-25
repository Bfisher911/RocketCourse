import { defaultSettings } from "../data/defaultSettings";
import { getTheme } from "../data/themes";
import type {
  Announcement,
  Assignment,
  AssignmentGroup,
  CanvasNavigationItem,
  ContactHourPlan,
  CourseImageSettings,
  CourseModule,
  CourseOutcome,
  CoursePage,
  CourseProject,
  CourseResource,
  CourseScheduleEntry,
  CourseSettings,
  Discussion,
  FileAsset,
  HumanReviewChecklistItem,
  ModuleItem,
  ObjectMetadata,
  PublishState,
  Quiz,
  QuizQuestion,
  Rubric,
  RubricCriterion,
  Theme,
  VisualTemplate
} from "../types";
import { escapeXml, nowIso, slugify } from "../utils/text";
import { buildCourseQualityReport } from "./courseQuality";
import { getOutcomeFramework } from "./outcomeFrameworks";
import { getModulePattern, getStructureFramework } from "./courseDesignModels";
import { getQuizPurpose } from "./quizPurposes";
import { DEFAULT_TEMPLATE_ID, createHomepageState, defaultHomepageContent, renderHomepage, rethemeHomepageHtml } from "./homepageTemplates";
import {
  chooseSyllabusTemplate,
  createSyllabusState,
  defaultSyllabusContent,
  renderSyllabus,
  rethemeSyllabusHtml,
  type SyllabusContext
} from "./syllabusTemplates";
import { buildThemedButton, buildThemedCallout, buildThemedCard, buildThemedNote, buildThemedSecondaryButton, buildThemedShell } from "./themeDesign";
import { buildBloomPyramid, buildCourseMap, buildGradeWeightDonut } from "./themeDataViz";
import { bestTextOn, withAlpha } from "../utils/color";
import { validateSyllabus } from "./syllabusValidation";
import { fileRef, modulesIndexRef, wikiPageRef, WELL_KNOWN_PAGE_IDS } from "./canvasLinks";

export interface GenerateCourseInput {
  prompt: string;
  settings: CourseSettings;
  /** Use this exact theme instead of resolving settings.themeId — needed for custom/visual-template
   * themes that aren't in the base registry, so regenerated content gets the right palette. */
  themeOverride?: Theme;
}

const baseTopics = [
  "Foundations and Course Orientation",
  "Core Concepts and Vocabulary",
  "Historical Context and Major Debates",
  "Stakeholders and Real-World Systems",
  "Ethics, Equity, and Accessibility",
  "Methods, Evidence, and Evaluation",
  "Policy, Governance, and Institutional Practice",
  "Case Studies and Applied Analysis",
  "Designing Practical Interventions",
  "Communication, Collaboration, and Critique",
  "Future Trends and Professional Practice",
  "Synthesis and Transfer"
];

const id = (prefix: string, value: string | number): string => `${prefix}_${slugify(String(value))}`;

const metadata = (timestamp: string, source: ObjectMetadata["source"] = "generated"): ObjectMetadata => ({
  createdAt: timestamp,
  updatedAt: timestamp,
  exportVersion: 0,
  source
});

const titleFromPrompt = (prompt: string, fallback: string): string => {
  const match =
    prompt.match(/course on ([^.]+?)(?:\.|,| for | with |$)/i) ||
    prompt.match(/class on ([^.]+?)(?:\.|,| for | with |$)/i) ||
    prompt.match(/build me (?:a|an)?\s*([^.:]+?course[^.:]*)/i);

  if (!match) return fallback;
  const candidate = match[1].replace(/^about\s+/i, "").trim();
  if (!candidate) return fallback;
  return candidate
    .replace(/^a\s+/i, "")
    .replace(/^an\s+/i, "")
    .replace(/\s+course$/i, "")
    .split(" ")
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && ["and", "or", "of", "the", "to", "in", "for", "with"].includes(lower)) return lower;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
};

const organizationLabel = (settings: CourseSettings, moduleNumber: number): string => {
  const labels: Record<CourseSettings["organizationPattern"], string> = {
    weeks: "Week",
    topics: "Topic",
    chapters: "Chapter",
    units: "Unit",
    quarters: "Quarter",
    custom: settings.customOrganizationLabel || "Module"
  };
  return `${labels[settings.organizationPattern] ?? "Module"} ${moduleNumber}`;
};

const shouldIncludeEveryOther = (moduleNumber: number): boolean => moduleNumber % 2 === 1;

const shouldIncludeAssignment = (settings: CourseSettings, moduleNumber: number): boolean => {
  if (settings.assignmentCadence === "every-module") return true;
  if (settings.assignmentCadence === "every-other-module") return moduleNumber % 2 === 0;
  if (settings.assignmentCadence === "major-milestones") return moduleNumber % 3 === 0;
  return moduleNumber === Math.ceil(settings.moduleCount / 2);
};

const shouldIncludeQuiz = (settings: CourseSettings, moduleNumber: number): boolean => {
  if (settings.quizFrequency === "none") return false;
  if (settings.quizFrequency === "weekly" || settings.quizFrequency === "module") return true;
  return shouldIncludeEveryOther(moduleNumber);
};

const shouldIncludeDiscussion = (settings: CourseSettings, moduleNumber: number): boolean => {
  if (settings.discussionFrequency === "none") return false;
  if (settings.discussionFrequency === "weekly" || settings.discussionFrequency === "module") return true;
  return shouldIncludeEveryOther(moduleNumber);
};

const shouldIncludeFinalMilestone = (settings: CourseSettings, moduleNumber: number, moduleTotal: number): boolean => {
  if (!settings.scaffoldFinalProject) return false;
  if (settings.scaffoldPattern === "every-other-module") return moduleNumber % 2 === 0;
  if (settings.scaffoldPattern === "key-milestones") {
    const milestoneModules = new Set([1, Math.max(1, Math.ceil(moduleTotal / 2)), Math.max(1, moduleTotal - 1)]);
    return milestoneModules.has(moduleNumber);
  }
  return moduleNumber === Math.max(1, Math.ceil(moduleTotal / 2));
};

const listHtml = (items: string[]): string => `<ul style="margin: 10px 0 0 20px; padding: 0;">${items.map((item) => `<li style="margin: 6px 0;">${item}</li>`).join("")}</ul>`;

const orderedListHtml = (items: string[]): string => `<ol style="margin: 10px 0 0 20px; padding: 0;">${items.map((item) => `<li style="margin: 6px 0;">${item}</li>`).join("")}</ol>`;

// A Canvas-safe themed table. First cell of each row is a <th scope="row"> header for accessibility.
const tableHtml = (caption: string, headers: string[], rows: string[][], theme: Theme): string => {
  const border = "#dbe4f0";
  const onAccent = bestTextOn(theme.accentDark);
  const head = headers
    .map(
      (header) =>
        `<th scope="col" style="text-align: left; padding: 12px 14px; border: none; background: linear-gradient(135deg, ${theme.accent}, ${theme.accentDark}); color: ${onAccent}; font-weight: 800;">${header}</th>`
    )
    .join("");
  const body = rows
    .map(
      (cells, rowIndex) =>
        `<tr style="background: ${rowIndex % 2 === 1 ? withAlpha(theme.accent, 0.05) : "#ffffff"};">${cells
          .map((cell, index) =>
            index === 0
              ? `<th scope="row" style="text-align: left; padding: 11px 14px; border-top: 1px solid ${border}; font-weight: 700; color: ${theme.accentDark}; vertical-align: top;">${cell}</th>`
              : `<td style="padding: 11px 14px; border-top: 1px solid ${border}; vertical-align: top;">${cell}</td>`
          )
          .join("")}</tr>`
    )
    .join("");
  return `<div style="margin: 8px 0; border: 1px solid ${border}; border-radius: 14px; overflow: hidden; box-shadow: 0 1px 2px rgba(15,23,42,0.04), 0 6px 16px rgba(15,23,42,0.06);"><table style="width: 100%; border-collapse: collapse; margin: 0; font-size: 14px;">${
    caption ? `<caption style="caption-side: top; text-align: left; margin: 12px 14px 8px; color: ${theme.accentDark}; font-weight: 800;">${caption}</caption>` : ""
  }<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
};

// A small themed status pill (e.g. workload, outcome count) for at-a-glance visual scanning.
const pill = (label: string, theme: Theme): string =>
  `<span style="display: inline-block; margin: 0 8px 8px 0; padding: 5px 12px; border-radius: 999px; background: ${theme.soft}; border: 1px solid ${theme.accent}; color: ${theme.accentDark}; font-size: 13px; font-weight: 600;">${label}</span>`;

const pillRow = (labels: string[], theme: Theme): string => `<p style="margin: 0 0 4px;">${labels.map((label) => pill(label, theme)).join("")}</p>`;

const checklistHtml = (items: string[]): string =>
  `<ul style="list-style: none; margin: 10px 0 0; padding: 0;">${items
    .map((item) => `<li style="margin: 8px 0; padding-left: 28px; position: relative;"><span style="position: absolute; left: 0; color: #0f766e; font-weight: 700;">&#10003;</span>${item}</li>`)
    .join("")}</ul>`;

const outcomeBadges = (outcomes: CourseOutcome[], outcomeIds: string[], theme: Theme): string =>
  `<p style="margin: 10px 0 0;">${outcomeIds
    .map((outcomeId) => outcomes.find((outcome) => outcome.id === outcomeId))
    .filter(Boolean)
    .map(
      (outcome) =>
        `<span style="display: inline-block; margin: 4px 6px 4px 0; padding: 5px 9px; border-radius: 999px; background: ${theme.soft}; color: ${theme.accentDark}; border: 1px solid ${theme.accent}; font-size: 13px; font-weight: 700;">${outcome?.code}</span>`
    )
    .join("")}</p>`;

const buttonLink = (href: string, label: string, theme: Theme): string => buildThemedButton(theme, label, href);

const secondaryLink = (href: string, label: string, theme: Theme): string => buildThemedSecondaryButton(theme, label, href);

const callout = (title: string, body: string, theme: Theme): string => buildThemedCallout(theme, title, body);
// Typed instructional callouts — each pedagogical move gets a distinct, color-coded, icon-badged look.
const keyTermNote = (title: string, body: string, theme: Theme): string => buildThemedNote(theme, "key-term", title, body);
const exampleNote = (title: string, body: string, theme: Theme): string => buildThemedNote(theme, "example", title, body);
const misconceptionNote = (title: string, body: string, theme: Theme): string => buildThemedNote(theme, "misconception", title, body);
const checkNote = (title: string, body: string, theme: Theme): string => buildThemedNote(theme, "check", title, body);
const tipNote = (title: string, body: string, theme: Theme): string => buildThemedNote(theme, "tip", title, body);

const section = (title: string, body: string, theme: Theme): string => buildThemedCard(theme, title, body);

const canvasShell = (title: string, subtitle: string, body: string, theme: Theme): string => buildThemedShell(theme, title, subtitle, body);

const pageHref = (slugOrTitle: string): string => `${slugify(slugOrTitle)}.html`;

const readableFinalProjectType = (settings: CourseSettings): string =>
  settings.finalProjectType
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const finalModuleTitle = (settings: CourseSettings): string => (settings.finalProject ? "Final Project" : "Final Assignment");

const dayMs = 24 * 60 * 60 * 1000;

const parseLocalDate = (value?: string): Date | undefined => {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
};

const dateKey = (date: Date): string => date.toISOString().slice(0, 10);

const withTime = (date: Date, time: string): string => {
  const [hours, minutes] = time.split(":").map(Number);
  const next = new Date(date);
  next.setUTCHours(Number.isFinite(hours) ? hours : 23, Number.isFinite(minutes) ? minutes : 59, 0, 0);
  return next.toISOString();
};

const addDays = (date: Date, days: number): Date => new Date(date.getTime() + days * dayMs);

const nextWeekday = (date: Date, day: number): Date => {
  const normalized = ((day % 7) + 7) % 7;
  const delta = (normalized - date.getUTCDay() + 7) % 7;
  return addDays(date, delta);
};

const avoidBlockedDate = (date: Date, settings: CourseSettings): Date => {
  const blocked = new Set([...(settings.schedule.holidays ?? []), ...(settings.schedule.blackoutDates ?? [])]);
  let candidate = new Date(date);
  for (let guard = 0; guard < 14 && blocked.has(dateKey(candidate)); guard += 1) {
    candidate = addDays(candidate, 1);
  }
  return candidate;
};

const dueDateForModule = (settings: CourseSettings, moduleIndex: number, offsetDays = 0): string | undefined => {
  if (!settings.schedule.enableDueDates) return undefined;
  const termStart = parseLocalDate(settings.schedule.termStartDate);
  if (!termStart) return undefined;
  const termEnd = parseLocalDate(settings.schedule.termEndDate);
  const moduleStart = addDays(termStart, moduleIndex * 7);
  const preferred = nextWeekday(addDays(moduleStart, offsetDays), settings.schedule.preferredDueDay);
  const adjusted = avoidBlockedDate(preferred, settings);
  if (termEnd && adjusted > termEnd && !settings.schedule.allowDueDatesOutsideTerm) return undefined;
  return withTime(adjusted, settings.schedule.preferredDueTime);
};

const releaseDateForModule = (settings: CourseSettings, moduleIndex: number): string | undefined => {
  if (!settings.schedule.enableDueDates) return undefined;
  const termStart = parseLocalDate(settings.schedule.termStartDate);
  if (!termStart) return undefined;
  const moduleStart = addDays(termStart, moduleIndex * 7);
  const release = avoidBlockedDate(nextWeekday(moduleStart, settings.schedule.moduleReleaseDay), settings);
  return withTime(release, "08:00");
};

const readableDate = (iso: string | undefined): string => (iso ? new Date(iso).toISOString().slice(0, 10) : "Set by instructor");

const resourceTypeLabel = (type: CourseResource["type"]): string =>
  type
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const makeResource = (
  resourceId: string,
  moduleId: string,
  title: string,
  type: CourseResource["type"],
  whyItMatters: string,
  estimatedMinutes: number,
  studentInstructions: string,
  instructorEditNote: string,
  placeholder: string,
  optional: boolean,
  timestamp: string
): CourseResource => ({
  id: resourceId,
  moduleId,
  title,
  type,
  whyItMatters,
  estimatedMinutes,
  studentInstructions,
  instructorEditNote,
  placeholder,
  optional,
  publishState: "published",
  status: "generated",
  metadata: metadata(timestamp)
});

const resourceCardsHtml = (resources: CourseResource[], theme: Theme): string =>
  resources
    .map((resource) => {
      const typeBadge = `<span style="display: inline-block; margin: 0 8px 0 0; padding: 4px 12px; border-radius: 999px; background: ${withAlpha(theme.accent, 0.12)}; border: 1px solid ${withAlpha(theme.accent, 0.42)}; color: ${theme.accentDark}; font-size: 12px; font-weight: 700;">${resourceTypeLabel(resource.type)}${resource.optional ? " &middot; optional" : ""}</span>`;
      const timeBadge = `<span style="display: inline-block; padding: 4px 12px; border-radius: 999px; background: #f1f5f9; border: 1px solid #e2e8f0; color: #475569; font-size: 12px; font-weight: 700;">&#9201; ~${resource.estimatedMinutes} min</span>`;
      return `
<div style="margin: 14px 0; padding: 18px 20px; border: 1px solid #e2e8f0; border-left: 5px solid ${theme.accent}; border-radius: 14px; background: ${resource.optional ? "#f8fafc" : "#ffffff"}; box-shadow: 0 1px 2px rgba(15,23,42,0.04), 0 6px 16px rgba(15,23,42,0.06);">
  <div style="margin: 0 0 10px;">${typeBadge}${timeBadge}</div>
  <h3 style="margin: 0 0 8px; color: ${theme.accentDark}; font-size: 18px; font-weight: 800;">${resource.title}</h3>
  <p style="margin: 0 0 8px; color: #374151;"><strong>Why it matters:</strong> ${resource.whyItMatters}</p>
  <p style="margin: 0 0 8px; color: #374151;"><strong>Student instructions:</strong> ${resource.studentInstructions}</p>
  <p style="margin: 0 0 8px; color: #374151;"><strong>Editable source placeholder:</strong> ${resource.placeholder}</p>
  <p style="margin: 0; color: ${theme.accentDark}; font-size: 13px;"><strong>Instructor edit note:</strong> ${resource.instructorEditNote}</p>
</div>`.trim();
    })
    .join("\n");

const buildModuleResources = (moduleId: string, moduleLabel: string, moduleTopic: string, courseTopic: string, timestamp: string): CourseResource[] => [
  makeResource(
    id("resource", `${moduleId}-textbook`),
    moduleId,
    `${moduleLabel} Core Reading: ${moduleTopic}`,
    "textbook",
    `Gives students an instructor-selected anchor text for ${moduleTopic.toLowerCase()}.`,
    45,
    "Read with the module outcomes nearby and mark two ideas to use in discussion or applied work.",
    "Replace with the exact textbook chapter, OER section, or institution-approved reading.",
    "Add textbook chapter, OER section, or uploaded PDF before publishing.",
    false,
    timestamp
  ),
  makeResource(
    id("resource", `${moduleId}-scholarly`),
    moduleId,
    `${moduleLabel} Evidence Source`,
    "scholarly-article",
    `Models how evidence is used to support claims about ${courseTopic.toLowerCase()}.`,
    35,
    "Skim the abstract and conclusion first, then identify one claim, one piece of evidence, and one limitation.",
    "Add a verified scholarly article, library permalink, or reading-list citation. Do not leave this placeholder as a fake source.",
    "Add verified article citation or library link.",
    false,
    timestamp
  ),
  makeResource(
    id("resource", `${moduleId}-media`),
    moduleId,
    `${moduleLabel} Media Example`,
    "video",
    `Provides a concrete example students can connect to ${moduleTopic.toLowerCase()}.`,
    20,
    "Watch or review the media example and note one moment that illustrates the module vocabulary.",
    "Add a verified accessible video, podcast, website, or instructor-created mini-lecture. Include captions or transcript information.",
    "Add verified URL or upload replacement; include captions/transcript note.",
    true,
    timestamp
  )
];

const makeRubric = (
  rubricId: string,
  title: string,
  points: number,
  outcomeIds: string[],
  timestamp: string,
  purposeLabel: string
): Rubric => {
  const criteria: RubricCriterion[] = [
    {
      id: `${rubricId}_alignment`,
      title: `${purposeLabel} alignment`,
      description: "Work addresses the stated task and course outcomes with a clear purpose.",
      outcomeId: outcomeIds[0],
      levels: [
        { label: "Exemplary", points: Math.round(points * 0.34), description: "Focused, complete, and explicitly aligned to the relevant outcomes." },
        { label: "Proficient", points: Math.round(points * 0.26), description: "Mostly aligned with minor gaps in purpose or outcome connection." },
        { label: "Developing", points: Math.round(points * 0.16), description: "Partially aligned or missing important assignment expectations." }
      ]
    },
    {
      id: `${rubricId}_evidence`,
      title: "Evidence, reasoning, and application",
      description: "Uses course concepts, examples, and reasoning in a way that fits the task.",
      outcomeId: outcomeIds[1] ?? outcomeIds[0],
      levels: [
        { label: "Exemplary", points: Math.round(points * 0.33), description: "Specific evidence supports thoughtful analysis and practical application." },
        { label: "Proficient", points: Math.round(points * 0.24), description: "Evidence is relevant and mostly explained." },
        { label: "Developing", points: Math.round(points * 0.14), description: "Evidence is limited, generic, or underexplained." }
      ]
    },
    {
      id: `${rubricId}_communication`,
      title: "Communication and accessibility",
      description: "Presents work clearly with accessible formatting and complete deliverables.",
      outcomeId: outcomeIds[2] ?? outcomeIds[0],
      levels: [
        { label: "Exemplary", points: Math.max(1, points - Math.round(points * 0.67)), description: "Clear, polished, complete, and easy to navigate." },
        { label: "Proficient", points: Math.round(points * 0.2), description: "Generally clear with minor organization or editing issues." },
        { label: "Developing", points: Math.round(points * 0.1), description: "Difficult to follow, incomplete, or missing accessible structure." }
      ]
    }
  ];

  return {
    id: rubricId,
    title,
    criteria,
    points,
    alignedOutcomeIds: outcomeIds,
    publishState: "published",
    status: "generated",
    metadata: metadata(timestamp)
  };
};

export const HOURS_PER_CREDIT = 45;

export const makeContactHours = (settings: CourseSettings): ContactHourPlan => {
  const totalHours = settings.creditHours * HOURS_PER_CREDIT;
  const instructionalTime = Math.round(totalHours * 0.22);
  const readingMediaTime = Math.round(totalHours * 0.25);
  const assignmentTime = Math.round(totalHours * 0.22);
  const discussionTime = Math.round(totalHours * 0.1);
  const quizStudyTime = Math.round(totalHours * 0.08);
  const finalProjectTime = Math.max(0, totalHours - instructionalTime - readingMediaTime - assignmentTime - discussionTime - quizStudyTime);

  return {
    instructionalTime,
    readingMediaTime,
    assignmentTime,
    discussionTime,
    quizStudyTime,
    finalProjectTime,
    totalHours,
    justification: `${settings.creditHours} credit hours over ${settings.lengthWeeks} weeks is planned as approximately ${totalHours} total student workload hours. The plan balances instructor-presented content, reading and media, discussion, quiz preparation, applied assignments, and final project development.`
  };
};

const navigationDefaults = (): CanvasNavigationItem[] => [
  { id: "home", label: "Home", visible: true, reason: "Front page starts students in the guided course path." },
  { id: "announcements", label: "Announcements", visible: true, reason: "Faculty need one clear communication channel." },
  { id: "syllabus", label: "Syllabus", visible: true, reason: "Students need grading, schedule, and policy details." },
  { id: "modules", label: "Modules", visible: true, reason: "Modules are the primary learning path." },
  { id: "grades", label: "Grades", visible: true, reason: "Students need gradebook visibility." },
  { id: "people", label: "People", visible: true, reason: "Useful for class community and group workflows." },
  { id: "assignments", label: "Assignments", visible: false, reason: "Assignments are intentionally reached through Modules by default." },
  { id: "discussions", label: "Discussions", visible: false, reason: "Discussions are intentionally reached through Modules by default." },
  { id: "quizzes", label: "Quizzes", visible: false, reason: "Quizzes are intentionally reached through Modules by default." },
  { id: "pages", label: "Pages", visible: false, reason: "Pages are intentionally reached through Modules by default." },
  { id: "files", label: "Files", visible: false, reason: "Files are linked from relevant pages to avoid exposing a file dump." },
  { id: "outcomes", label: "Outcomes", visible: false, reason: "Outcomes support assessment design but are not a student-facing destination." },
  { id: "rubrics", label: "Rubrics", visible: false, reason: "Rubrics are attached to assignments; students reach them in context." },
  { id: "collaborations", label: "Collaborations", visible: false, reason: "Not used by default; enable only if your design needs it." }
];

const makeItem = (
  itemId: string,
  type: ModuleItem["type"],
  title: string,
  refId: string,
  order: number,
  timestamp: string,
  publishState: PublishState = "published",
  indent = 0
): ModuleItem => ({
  id: itemId,
  type,
  title,
  refId,
  order,
  indent,
  publishState,
  status: "generated",
  metadata: metadata(timestamp)
});

// A Canvas "text header" module item (ContextModuleSubHeader) — a labeled divider inside a module
// with no backing page/object, used to group Module Content vs Module Activities like a real course.
const makeSubHeader = (itemId: string, title: string, order: number, timestamp: string): ModuleItem => ({
  id: itemId,
  type: "subheader",
  title,
  refId: "",
  order,
  indent: 0,
  publishState: "published",
  status: "generated",
  metadata: metadata(timestamp)
});

// Reshape a content module's items into the professional Canvas pattern seen in mature courses:
//   About Module X · [Module Content] · content pages · [Module Activities] · graded items · End of Module X
// The two bracketed entries are text-header dividers. Works regardless of which optional items exist.
const structureContentModuleItems = (items: ModuleItem[], moduleNumber: number, ts: string): ModuleItem[] => {
  const about = items.find((item) => /^About /i.test(item.title));
  const end = items.find((item) => /^End of /i.test(item.title));
  const middle = items.filter((item) => item !== about && item !== end);
  const contentItems = middle.filter((item) => item.type === "page");
  const activityItems = middle.filter((item) => item.type !== "page");
  const ordered: ModuleItem[] = [];
  let position = 1;
  const push = (item?: ModuleItem): void => {
    if (item) ordered.push({ ...item, order: position++ });
  };
  push(about);
  if (contentItems.length) ordered.push(makeSubHeader(`item_m${moduleNumber}_content_header`, "Module Content", position++, ts));
  contentItems.forEach(push);
  if (activityItems.length) ordered.push(makeSubHeader(`item_m${moduleNumber}_activities_header`, "Module Activities", position++, ts));
  activityItems.forEach(push);
  push(end);
  return ordered;
};

const makePage = (
  pageId: string,
  title: string,
  slug: string,
  bodyHtml: string,
  moduleId: string | undefined,
  timestamp: string,
  options: { frontPage?: boolean; publishState?: PublishState; assetPath?: string } = {}
): CoursePage => ({
  id: pageId,
  title,
  slug,
  bodyHtml,
  moduleId,
  frontPage: options.frontPage,
  assetPath: options.assetPath,
  publishState: options.publishState ?? "published",
  status: "generated",
  metadata: metadata(timestamp)
});

const makeFileAsset = (
  idValue: string,
  path: string,
  title: string,
  mimeType: string,
  usage: FileAsset["usage"],
  timestamp: string,
  description: string
): FileAsset => ({
  id: idValue,
  path,
  fileName: path.split("/").pop() ?? path,
  title,
  mimeType,
  description,
  usage,
  publishState: "published",
  metadata: metadata(timestamp)
});

const moduleObjectivesFor = (outcomes: CourseOutcome[], outcomeIds: string[]): string[] =>
  outcomeIds.map((outcomeId) => outcomes.find((outcome) => outcome.id === outcomeId)?.text ?? "").filter(Boolean);

const quizQuestions = (quizId: string, moduleTopic: string, moduleId: string, outcomeIds: string[], settings: CourseSettings): QuizQuestion[] => {
  const base: QuizQuestion[] = [
    {
      id: `${quizId}_q1`,
      type: "multiple_choice",
      stem: `Which choice best describes a core issue in ${moduleTopic}?`,
      choices: ["A narrow technical detail", "A connection among concepts, people, and context", "A random course policy", "An unrelated opinion"],
      correctAnswer: "A connection among concepts, people, and context",
      feedback: "The best answer connects module concepts to broader context.",
      correctFeedback: "Correct. The strongest answer connects ideas, people, evidence, and context.",
      incorrectFeedback: "Review the lesson examples and look for the answer that connects concepts to context.",
      difficulty: settings.quizDifficulty,
      alignedOutcomeIds: outcomeIds,
      moduleId,
      points: 4
    },
    {
      id: `${quizId}_q2`,
      type: "true_false",
      stem: "Course concepts should be applied with attention to evidence and context.",
      choices: ["True", "False"],
      correctAnswer: "True",
      feedback: "Evidence and context make applied analysis stronger.",
      correctFeedback: "Correct. Evidence and context make applied work more defensible.",
      incorrectFeedback: "Revisit the module overview and the evidence-source reading prompt.",
      difficulty: "introductory",
      alignedOutcomeIds: outcomeIds,
      moduleId,
      points: 2
    },
    {
      id: `${quizId}_q3`,
      type: "short_answer",
      stem: `Name one example that illustrates ${moduleTopic.toLowerCase()} and explain why it matters.`,
      feedback: "A strong answer names a specific example and explains its significance using module vocabulary.",
      correctFeedback: "Look for a concrete example, relevant vocabulary, and a clear explanation of significance.",
      incorrectFeedback: "If the response is vague, ask the student to add a concrete example and one course concept.",
      difficulty: "balanced",
      alignedOutcomeIds: outcomeIds,
      moduleId,
      instructorReviewRequired: true,
      points: 4
    },
    {
      id: `${quizId}_q4`,
      type: settings.quizDifficulty === "challenging" ? "essay" : "multiple_choice",
      stem: `How should an instructor or practitioner evaluate competing claims about ${moduleTopic.toLowerCase()}?`,
      choices: settings.quizDifficulty === "challenging" ? undefined : ["By popularity only", "By evidence, context, and consequences", "By speed", "By personal preference"],
      correctAnswer: settings.quizDifficulty === "challenging" ? undefined : "By evidence, context, and consequences",
      feedback: "A strong answer weighs evidence, context, and consequences.",
      correctFeedback: "Correct. Claims should be evaluated by evidence, context, and consequences.",
      incorrectFeedback: "Review the misconception callout and compare the options against the evidence standard.",
      difficulty: settings.quizDifficulty,
      alignedOutcomeIds: outcomeIds,
      moduleId,
      instructorReviewRequired: settings.quizDifficulty === "challenging",
      points: 5
    },
    {
      id: `${quizId}_q5`,
      type: "short_answer",
      stem: `Identify one unresolved question students should carry forward from ${moduleTopic.toLowerCase()}.`,
      feedback: "A strong response names a question that can guide discussion, assignment work, or the final project.",
      correctFeedback: "Look for a question that is specific enough to investigate in later work.",
      incorrectFeedback: "Ask the student to connect the question to a module concept or outcome.",
      difficulty: "balanced",
      alignedOutcomeIds: outcomeIds,
      moduleId,
      instructorReviewRequired: true,
      points: 3
    }
  ];

  return base.slice(0, Math.max(1, Math.min(10, settings.quizQuestionsPerQuiz)));
};

const discussionPrompt = (moduleTopic: string, courseTopic: string, settings: CourseSettings, theme: Theme): string => {
  const styleLead: Record<CourseSettings["discussionStyle"], string> = {
    reflective: "Connect the module ideas to your own learning, prior experience, or professional context.",
    "case-based": "Analyze a concrete case that reveals the tensions in this module.",
    debate: "Take a position, acknowledge a counterargument, and explain what evidence would change your view.",
    "peer-review": "Share a draft idea and give classmates specific, constructive feedback.",
    application: "Apply the module concepts to a realistic decision, classroom, workplace, or community scenario."
  };

  return canvasShell(
    `Discussion: ${moduleTopic}`,
    styleLead[settings.discussionStyle],
    `${section("Purpose", `<p>This discussion helps you test the module ideas in conversation before using them in graded applied work.</p>`, theme)}
${section("Prompt", `<p>Choose one example connected to ${moduleTopic.toLowerCase()} and explain why it matters for ${courseTopic.toLowerCase()}.</p>`, theme)}
${section("Initial Post", checklistHtml(["Write 250-350 words unless your instructor changes the expectation.", "Use at least two module terms accurately.", "Reference one reading, media example, case, or personal/professional observation.", "End with one question that invites classmates into a more specific conversation."]), theme)}
${section("Replies", checklistHtml(["Reply to at least two classmates.", "Use the name of the idea you are connecting to or challenging.", "Add evidence, an example, a respectful counterpoint, or a useful question.", "Avoid short agreement-only replies."]), theme)}
${section("Example Starter Pattern", "<p>One way to begin: <em>The example I selected shows [module concept] because [evidence]. This matters for [course topic] because [consequence or decision].</em></p>", theme)}
${section("Instructor Facilitation Tips", checklistHtml(["Look for posts that stay too general and ask for a concrete example.", "Invite students to connect claims back to the module outcomes.", "Use one strong student question as a bridge into the next module."]), theme)}
${callout("Grading Criteria", "<p>Strong posts use evidence, connect to course outcomes, respond substantively to peers, and move the conversation forward.</p>", theme)}`,
    theme
  );
};

// A warm, visually rich welcome announcement. Canvas shows the latest announcements above the home
// page (the export turns that setting on), so this is often the first thing a student reads.
const buildWelcomeAnnouncementHtml = (courseTitle: string, theme: Theme): string =>
  canvasShell(
    `Welcome to ${courseTitle}!`,
    "Read this first — it is your launch pad for the whole course.",
    `${tipNote("Start here", `<p>Open the <strong>Start Here</strong> module, read the Course Success Guide, and skim the syllabus. Then begin Module 1. The course is laid out so you always know exactly what to do next.</p>`, theme)}
${section("Your first three steps", checklistHtml([
      "Open Start Here and read About This Course and the Course Success Guide.",
      "Post in the Introduce Yourself discussion so we get to know you.",
      "Check the Course Calendar and Workload Plan so the pace is no surprise."
    ]), theme)}
${exampleNote("How to stay on track", "<p>Check <strong>Announcements</strong> and the home page regularly — that is where reminders, updates, and encouragement will show up throughout the term.</p>", theme)}
${callout("Questions? Reach out early", "<p>Use the <strong>Ask Course Questions</strong> discussion in Start Here, or contact me during office hours. I would much rather hear from you sooner than later — you are not on your own here.</p>", theme)}`,
    theme
  );

const assignmentDescription = (title: string, moduleTopic: string, outcomeIds: string[], outcomes: CourseOutcome[], theme: Theme): string =>
  canvasShell(
    title,
    `Apply ${moduleTopic.toLowerCase()} to a realistic problem, case, or teaching context.`,
    `${section("Purpose", "<p>This assignment asks you to move from course concepts to grounded analysis and decision-making.</p>", theme)}
${section("Scenario", `<p>You are preparing a brief for an audience that needs to understand how ${moduleTopic.toLowerCase()} affects a real decision, policy, design, classroom, workplace, or community context.</p>`, theme)}
${section("Task Instructions", checklistHtml(["Select a relevant example, case, problem, or scenario.", "Explain the context, stakeholders, and decision point.", "Use module vocabulary and at least two pieces of course evidence.", "Analyze consequences, tradeoffs, or ethical considerations.", "End with a practical recommendation, next step, or unresolved question."]), theme)}
${section("Deliverable Requirements", checklistHtml(["Use clear headings that match the task.", "Include 700-1000 words or an equivalent instructor-approved artifact.", "Cite or name course sources according to local expectations.", "Use descriptive links and accessible file names if attachments are included."]), theme)}
${section("Format Guidance", "<p>A strong submission usually includes: context, evidence, analysis, recommendation, and reflection. Tables or diagrams are welcome when they make the reasoning easier to follow.</p>", theme)}
${section("Model Elements", checklistHtml(["A specific example instead of a broad topic.", "A claim supported by evidence.", "A paragraph that explains why the evidence matters.", "A recommendation that follows from the analysis."]), theme)}
${section("How Your Work Is Evaluated", tableHtml("Self-check against these before you submit — they mirror the rubric", ["Criterion", "What strong work shows"], [["Evidence", "Specific, relevant course evidence is cited and explained, not just listed."], ["Analysis", "Reasoning connects evidence to context, stakeholders, and tradeoffs."], ["Recommendation", "A defensible recommendation follows directly from the analysis."], ["Communication", "Clear headings, accessible links, and audience-appropriate language."]], theme), theme)}
${section("Submission Instructions", "<p>Submit in Canvas using online text entry or upload as directed by your instructor. Confirm that any attached file opens correctly before submitting.</p>", theme)}
${section("Estimated Workload", "<p>Plan for approximately 4-6 focused hours: review sources, outline, draft, revise, and check the rubric.</p>", theme)}
${section("Academic Integrity and AI Use", "<p>Use institutional academic integrity and AI-use policies. If AI tools are permitted, document how they were used and verify all output against course sources.</p>", theme)}
${section("Outcome Alignment", `<p>This work aligns to:</p>${outcomeBadges(outcomes, outcomeIds, theme)}`, theme)}
${callout("Before You Submit", "<p>Review the rubric, confirm every section is complete, check that links or attachments are accessible, and make sure your recommendation follows from your evidence.</p>", theme)}`,
    theme
  );

const buildStudentGuideHtml = (courseTitle: string, theme: Theme): string =>
  canvasShell(
    "Course Success Guide",
    `A practical student manual for navigating ${courseTitle}.`,
    `${section("How This Course Works", `<p>Begin with Start Here, then work through Modules in order. Each module opens with an overview, moves through content and practice, and closes with a recap.</p>${checklistHtml(["Read each module overview before starting.", "Use the module item order as your weekly path.", "Check due dates and rubrics before submitting work.", "Return to recap pages before quizzes, assignments, or the final project."])}`, theme)}
${section("Where To Find Important Work", checklistHtml(["Syllabus: grading, workload, policies, and course outcomes.", "Course Calendar and Workload Plan: release dates, due dates, workload estimates, and pacing notes.", "Modules: the primary path for readings, pages, discussions, quizzes, and assignments.", "Grades: feedback and progress.", "Announcements: instructor updates and reminders."]), theme)}
${section("What Success Looks Like", checklistHtml(["You can explain each module's objectives in your own words.", "You use rubric language before submitting.", "You ask questions early when instructions feel unclear.", "You connect weekly work to the final project."]), theme)}
${callout("When You Feel Stuck", "<p>Return to the current module overview, reread the assignment rubric, post or send a specific question, and name exactly where you lost the thread.</p>", theme)}
${section("First Steps", `<p>${buttonLink(wikiPageRef(WELL_KNOWN_PAGE_IDS.syllabus), "Review the syllabus", theme)}${secondaryLink(wikiPageRef(WELL_KNOWN_PAGE_IDS.calendar), "Open course calendar", theme)}${secondaryLink(modulesIndexRef(), "Go to Modules", theme)}</p>`, theme)}`,
    theme
  );

const scheduleTableHtml = (schedule: CourseScheduleEntry[]): string =>
  `<div style="overflow-x: auto;">
  <table style="width: 100%; border-collapse: collapse; min-width: 720px;">
    <caption style="text-align: left; margin: 0 0 10px; font-weight: 700;">Generated module calendar, workload estimates, and instructor notes</caption>
    <thead>
      <tr>
        <th scope="col" style="text-align: left; padding: 9px; border: 1px solid #dbe4f0; background: #f8fafc;">Item</th>
        <th scope="col" style="text-align: left; padding: 9px; border: 1px solid #dbe4f0; background: #f8fafc;">Type</th>
        <th scope="col" style="text-align: left; padding: 9px; border: 1px solid #dbe4f0; background: #f8fafc;">Release</th>
        <th scope="col" style="text-align: left; padding: 9px; border: 1px solid #dbe4f0; background: #f8fafc;">Due</th>
        <th scope="col" style="text-align: left; padding: 9px; border: 1px solid #dbe4f0; background: #f8fafc;">Hours</th>
        <th scope="col" style="text-align: left; padding: 9px; border: 1px solid #dbe4f0; background: #f8fafc;">Notes</th>
      </tr>
    </thead>
    <tbody>
      ${schedule
        .map(
          (entry) => `<tr>
        <th scope="row" style="text-align: left; vertical-align: top; padding: 9px; border: 1px solid #dbe4f0;">${escapeXml(entry.title)}</th>
        <td style="vertical-align: top; padding: 9px; border: 1px solid #dbe4f0;">${escapeXml(entry.itemType)}</td>
        <td style="vertical-align: top; padding: 9px; border: 1px solid #dbe4f0;">${escapeXml(readableDate(entry.releaseAt))}</td>
        <td style="vertical-align: top; padding: 9px; border: 1px solid #dbe4f0;">${escapeXml(readableDate(entry.dueAt))}</td>
        <td style="vertical-align: top; padding: 9px; border: 1px solid #dbe4f0;">${entry.workloadHours}</td>
        <td style="vertical-align: top; padding: 9px; border: 1px solid #dbe4f0;">${escapeXml(entry.notes)}</td>
      </tr>`
        )
        .join("")}
    </tbody>
  </table>
</div>`;

const buildCourseCalendarHtml = (courseTitle: string, schedule: CourseScheduleEntry[], settings: CourseSettings, theme: Theme): string => {
  const totalWorkload = schedule.reduce((sum, entry) => sum + entry.workloadHours, 0);
  const gradedItems = schedule.filter((entry) => ["assignment", "discussion", "quiz"].includes(entry.itemType));
  const generatedDateNote = settings.schedule.enableDueDates
    ? `This calendar was generated from term start ${settings.schedule.termStartDate ?? "not set"} with preferred due day ${settings.schedule.preferredDueDay}. Faculty should still compare it against the official academic calendar before publishing.`
    : "Due dates are intentionally marked Set by instructor. Faculty should add official dates in Canvas before publishing.";

  return canvasShell(
    "Course Calendar and Workload Plan",
    `Student-facing pacing guide for ${courseTitle}.`,
    `${section("How To Use This Calendar", checklistHtml(["Use release dates to know when to begin each module.", "Use due dates to plan graded discussions, quizzes, assignments, and the final project.", "Compare workload hours across the week before waiting until the deadline.", "Ask the instructor when Canvas calendar dates and this page disagree."]), theme)}
${section("Calendar Status", `<p>${escapeXml(generatedDateNote)}</p>${checklistHtml([`${gradedItems.length} graded items are represented in the schedule.`, `${totalWorkload} estimated workload hours are distributed across modules, practice, graded work, and the final project.`, "Instructor should adjust dates around holidays, breaks, exam periods, local policy, and section-specific pacing."])}`, theme)}
${section("Schedule Table", scheduleTableHtml(schedule), theme)}
${callout("Instructor Review Required", "<p>Before publishing, verify dates in Canvas Assignments, Discussions, Quizzes, Modules, and the Syllabus page. This generated page is a planning aid and should match the official Canvas calendar.</p>", theme)}`,
    theme
  );
};

const buildInstructorGuideHtml = (courseTitle: string, navigation: CanvasNavigationItem[], theme: Theme): string =>
  canvasShell(
    "Instructor Guide",
    `Instructor-only implementation notes for ${courseTitle}.`,
    `${section("Downloadable Version", `<p>${secondaryLink(fileRef("instructor-guide.pdf"), "Download instructor guide PDF", theme)}</p>`, theme)}
${section("How To Run This Course", checklistHtml(["Import the .imscc into a clean Canvas shell when possible.", "Review Start Here, syllabus, all module overview pages, assignments, rubrics, and quizzes before publishing.", "Replace instructor placeholders, required materials, due dates, office hours, and institution policies.", "Publish only the modules and items that should be visible to students."]), theme)}
${section("Course Structure", "<p>The generated shell uses Start Here, sequenced content modules, a separate Final Project module, and this unpublished Instructor Guide module at the end.</p>", theme)}
${section("Before Publishing Checklist", checklistHtml(["Confirm the homepage Start Here button resolves.", "Review the Outcome and Assessment Alignment Map.", "Review gradebook assignment groups and weights.", "Check every graded item has an aligned outcome and rubric where appropriate.", "Open Modules as a student would and verify flow.", "Confirm the Instructor Guide module remains unpublished.", "Decide whether Assignments, Discussions, Quizzes, Pages, or Files should stay hidden from course navigation."]), theme)}
${section("Canvas Navigation Defaults", listHtml(navigation.map((item) => `<strong>${item.label}:</strong> ${item.visible ? "visible" : "hidden"} - ${item.reason}`)), theme)}
${section("Import Workflow", checklistHtml(["Open the target Canvas course.", "Go to Settings.", "Click Import Course Content.", "Choose Canvas Course Export Package or Common Cartridge/IMSCC as appropriate.", "Upload the RocketCourse .imscc file.", "Select all content or selected content.", "Adjust due dates if needed.", "Start the import, then review modules, navigation, gradebook groups, rubrics, and syllabus."]), theme)}
${callout("Reimport Warning", "<p>Canvas can duplicate content when edited objects are imported again into an existing course. For major revisions, use a clean shell or remove old objects before importing.</p>", theme)}`,
    theme
  );

const buildInstructorTeachingNotesHtml = (courseTitle: string, contentModules: CourseModule[], theme: Theme): string =>
  canvasShell(
    "Instructor Module Teaching Notes",
    `Facilitation, grading, release, and review notes for ${courseTitle}.`,
    `${section("How To Use These Notes", checklistHtml(["Review each module before publishing.", "Replace resource placeholders with verified readings or media.", "Use announcement prompts to connect module work to the next graded task.", "Watch risk flags for content that needs discipline-specific review."]), theme)}
${contentModules
  .map(
    (module) =>
      section(
        module.title,
        `${section("Prep Reminders", checklistHtml(["Confirm resources are verified and accessible.", "Check that practice work prepares students for graded work.", "Adjust due dates around holidays, breaks, and workload spikes."]), theme)}
${section("Common Student Struggles", checklistHtml(["Students may summarize sources without explaining significance.", "Students may make broad claims without evidence.", "Students may overlook how the module outcomes connect to the final project."]), theme)}
${section("Suggested Announcement", `<p>This week, focus on the connection between evidence and decision-making in ${module.title}. Use the practice activity before starting graded work.</p>`, theme)}
${section("Grading Guidance", "<p>Look for clear use of module vocabulary, evidence, accessible formatting, and explicit outcome alignment.</p>", theme)}
${callout("Human Review Flag", "<p>Instructor should confirm that examples, resources, policy language, and local context are accurate before publishing.</p>", theme)}`,
        theme
      )
  )
  .join("")}`,
    theme
  );

const buildAlignmentMapHtml = (
  courseTitle: string,
  outcomes: CourseOutcome[],
  modules: CourseModule[],
  assignments: Assignment[],
  discussions: Discussion[],
  quizzes: Quiz[],
  rubrics: Rubric[],
  assignmentGroups: AssignmentGroup[],
  theme: Theme
): string => {
  const moduleTitles = new Map(modules.map((module) => [module.id, module.title]));
  const gradedItems = [
    ...assignments.map((assignment) => ({ title: assignment.title, points: assignment.points, outcomeIds: assignment.alignedOutcomeIds, type: "Assignment" })),
    ...discussions.filter((discussion) => discussion.points > 0).map((discussion) => ({ title: discussion.title, points: discussion.points, outcomeIds: discussion.alignedOutcomeIds, type: "Discussion" })),
    ...quizzes.filter((quiz) => quiz.points > 0).map((quiz) => ({ title: quiz.title, points: quiz.points, outcomeIds: quiz.alignedOutcomeIds, type: "Quiz" }))
  ];
  const rows = outcomes
    .map((outcome) => {
      const alignedModules = outcome.alignedModuleIds.map((moduleId) => moduleTitles.get(moduleId)).filter(Boolean).join("; ") || "Review needed";
      const alignedGradedItems =
        gradedItems
          .filter((item) => item.outcomeIds.includes(outcome.id))
          .map((item) => `${item.type}: ${item.title} (${item.points} pts)`)
          .join("; ") || "Review needed";
      const alignedRubrics =
        rubrics
          .filter((rubric) => rubric.alignedOutcomeIds.includes(outcome.id))
          .map((rubric) => rubric.title)
          .join("; ") || "Review needed";
      return `<tr>
        <th scope="row" style="text-align: left; vertical-align: top; padding: 9px; border: 1px solid #dbe4f0;">${escapeXml(outcome.code)}</th>
        <td style="vertical-align: top; padding: 9px; border: 1px solid #dbe4f0;">${escapeXml(outcome.text)}</td>
        <td style="vertical-align: top; padding: 9px; border: 1px solid #dbe4f0;">${escapeXml(alignedModules)}</td>
        <td style="vertical-align: top; padding: 9px; border: 1px solid #dbe4f0;">${escapeXml(alignedGradedItems)}</td>
        <td style="vertical-align: top; padding: 9px; border: 1px solid #dbe4f0;">${escapeXml(alignedRubrics)}</td>
      </tr>`;
    })
    .join("");
  const groupRows = assignmentGroups
    .map(
      (group) => `<tr>
        <th scope="row" style="text-align: left; padding: 9px; border: 1px solid #dbe4f0;">${escapeXml(group.name)}</th>
        <td style="padding: 9px; border: 1px solid #dbe4f0;">${group.weight}%</td>
      </tr>`
    )
    .join("");
  const tableChrome =
    "width: 100%; border-collapse: collapse; min-width: 780px;";
  const headChrome =
    "text-align: left; padding: 9px; border: 1px solid #dbe4f0; background: #f8fafc;";

  // Visual overview: grade-weight donut + Bloom pyramid + module→outcome map, all rendered as
  // inline SVG/HTML (Canvas-safe) from the same alignment data the table below itemizes.
  const outcomeCodeById = new Map(outcomes.map((outcome) => [outcome.id, outcome.code]));
  const allOutcomeCodes = outcomes.map((outcome) => outcome.code);
  const moduleAlignment = modules.map((module) => {
    const ids = new Set<string>();
    [...assignments, ...discussions, ...quizzes]
      .filter((item) => item.moduleId === module.id)
      .forEach((item) => (item.alignedOutcomeIds ?? []).forEach((outcomeId) => ids.add(outcomeId)));
    return { title: module.title, outcomeCodes: [...ids].map((outcomeId) => outcomeCodeById.get(outcomeId) ?? outcomeId) };
  });
  const bloomOrder = ["create", "evaluate", "analyze", "apply", "understand", "remember"];
  const bloomCounts = new Map<string, number>();
  outcomes.forEach((outcome) => {
    const level = (outcome.bloomLevel ?? "").toLowerCase();
    const key = bloomOrder.find((band) => level.includes(band));
    if (key) bloomCounts.set(key, (bloomCounts.get(key) ?? 0) + 1);
  });
  const bloomTiers = bloomOrder
    .filter((band) => bloomCounts.has(band))
    .map((band) => ({ label: band[0].toUpperCase() + band.slice(1), count: bloomCounts.get(band) }));
  const visualOverview = `<div style="font-size: 0;"><div style="display: inline-block; width: 49%; min-width: 240px; vertical-align: top; margin-right: 1%; font-size: 14px;">${buildGradeWeightDonut(
    theme,
    assignmentGroups.map((group) => ({ name: group.name, weight: group.weight }))
  )}</div><div style="display: inline-block; width: 49%; min-width: 240px; vertical-align: top; font-size: 14px;">${buildBloomPyramid(theme, bloomTiers)}</div></div>${buildCourseMap(theme, moduleAlignment, allOutcomeCodes)}`;

  return canvasShell(
    "Outcome and Assessment Alignment Map",
    `Instructor-only alignment evidence for ${courseTitle}.`,
    `${section("Visual Overview", visualOverview, theme)}
${section("How To Review This Map", checklistHtml(["Confirm each course outcome matches the official course record.", "Check that every outcome appears in modules, graded work, and rubrics.", "Edit generic language before publishing when local accreditation, program, or department outcomes require exact wording.", "Use this map during quality review before importing or publishing the Canvas shell."]), theme)}
${section(
  "Outcome Alignment Table",
  `<div style="overflow-x: auto;">
  <table style="${tableChrome}">
    <caption style="text-align: left; margin: 0 0 10px; font-weight: 700;">Outcomes mapped to modules, graded activities, and rubrics</caption>
    <thead>
      <tr>
        <th scope="col" style="${headChrome}">Outcome</th>
        <th scope="col" style="${headChrome}">Outcome Text</th>
        <th scope="col" style="${headChrome}">Modules</th>
        <th scope="col" style="${headChrome}">Graded Work</th>
        <th scope="col" style="${headChrome}">Rubrics</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</div>`,
  theme
)}
${section(
  "Gradebook Group Summary",
  `<div style="overflow-x: auto;">
  <table style="width: 100%; border-collapse: collapse; max-width: 520px;">
    <caption style="text-align: left; margin: 0 0 10px; font-weight: 700;">Imported Canvas assignment groups</caption>
    <thead><tr><th scope="col" style="${headChrome}">Group</th><th scope="col" style="${headChrome}">Weight</th></tr></thead>
    <tbody>${groupRows}</tbody>
  </table>
</div>`,
  theme
)}
${callout("Human Review Required", "<p>This page is generated evidence, not an accreditation claim. Faculty should verify outcomes, weights, assessment types, and rubric criteria against official requirements before publishing.</p>", theme)}`,
    theme
  );
};

const makeReviewItem = (
  priority: HumanReviewChecklistItem["priority"],
  title: string,
  rationale: string,
  action: string,
  relatedObjectType: HumanReviewChecklistItem["relatedObjectType"] = "course",
  relatedObjectId?: string
): HumanReviewChecklistItem => ({
  id: id("review", `${priority}-${title}`),
  priority,
  title,
  rationale,
  action,
  relatedObjectType,
  relatedObjectId,
  completed: false
});

const buildReviewChecklist = (course: {
  modules: CourseModule[];
  pages: CoursePage[];
  assignments: Assignment[];
  discussions: Discussion[];
  quizzes: Quiz[];
  rubrics: Rubric[];
  resources: CourseResource[];
  schedule: CourseScheduleEntry[];
  navigation: CanvasNavigationItem[];
  settings: CourseSettings;
}): HumanReviewChecklistItem[] => {
  const instructorModule = course.modules.find((module) => module.kind === "instructor");
  const finalModule = course.modules.find((module) => module.kind === "final");
  const dueDateNote = course.settings.schedule.enableDueDates ? "Confirm every generated due date avoids holidays, blackout dates, and institution-specific deadlines." : "Set due dates after confirming the official term calendar.";

  return [
    makeReviewItem("must", "Verify course outcomes", "Outcomes drive syllabus, rubrics, assignments, discussions, quizzes, and final project alignment.", "Read every course outcome and edit language that does not match the official course record.", "course"),
    makeReviewItem("must", "Review outcome and assessment alignment map", "A coherent Canvas course should show how outcomes connect to modules, graded work, rubrics, and gradebook groups.", "Open the alignment map and confirm every outcome has meaningful instructional and assessment evidence.", "course"),
    makeReviewItem("must", "Review gradebook groups and weights", "Canvas imports are sensitive to assignment-group setup and weights.", "Confirm assignment group names and percentages match the intended grading policy.", "gradebook"),
    makeReviewItem("must", "Review due dates and schedule", "Dates should not land on holidays, blackout dates, or outside the term unless intentionally allowed.", dueDateNote, "schedule"),
    makeReviewItem("must", "Replace resource placeholders", "Generated resources intentionally avoid fake citations and URLs.", "Replace textbook, OER, article, media, and upload placeholders with verified sources.", "resource"),
    makeReviewItem("must", "Check module flow", "Students should be able to move from overview to resources, lesson, practice, graded work, and recap.", "Open Modules in order and verify each content module has a clear learning path.", "module"),
    makeReviewItem("must", "Review rubrics", "Rubrics should be understandable before students submit work.", "Check criteria, performance levels, point values, and outcome alignment.", "course"),
    makeReviewItem("must", "Confirm instructor-only visibility", "Instructor-only materials should not publish to students by default.", "Confirm the instructor module and all instructor-only items remain unpublished.", "module", instructorModule?.id ?? "module_instructor_guide"),
    makeReviewItem("must", "Review syllabus policy language", "Institution policies vary and should not be treated as verified by RocketCourse.", "Replace placeholders for late work, academic integrity, AI use, accessibility, communication, and support.", "policy"),
    makeReviewItem("recommended", "Review final project scaffolding", "Milestones should match course length, project type, and feedback capacity.", "Confirm final project checkpoints are appropriate and spaced well.", "module", finalModule?.id),
    makeReviewItem("recommended", "Check assignment specificity", "Assignments should feel tied to the course topic and module purpose.", "Review every assignment scenario, deliverables, format guidance, examples, and success tips.", "assignment"),
    makeReviewItem("recommended", "Check discussion facilitation plan", "Discussions need clear reply expectations and instructor follow-up prompts.", "Review initial post instructions, reply rules, grading criteria, and facilitation tips.", "discussion"),
    makeReviewItem("recommended", "Check quiz review flags", "Short-answer and essay questions need human review.", "Review question banks, correct answers, feedback, and subjective scoring notes.", "quiz"),
    makeReviewItem("recommended", "Review accessibility details", "Accessibility requires more than Canvas-safe HTML.", "Confirm headings, descriptive links, alt text, captions/transcripts, files, and tables.", "accessibility"),
    makeReviewItem("recommended", "Review Canvas navigation", "Students should see only the tools needed for the course path.", `Visible navigation: ${course.navigation.filter((item) => item.visible).map((item) => item.label).join(", ")}. Adjust in Canvas if your design requires more tools.`, "navigation"),
    makeReviewItem("optional", "Polish visual assets", "Generated SVGs and placeholders are meant to be replaceable.", "Replace banner, tile, module images, diagrams, worksheets, handouts, or slide summaries as desired.", "course"),
    makeReviewItem("optional", "Tune workload balance", "Different student populations may need pacing adjustments.", "Compare workload estimates against course credit hours and local expectations.", "schedule")
  ];
};

const checklistGroupHtml = (items: HumanReviewChecklistItem[], priority: HumanReviewChecklistItem["priority"]): string =>
  checklistHtml(
    items
      .filter((item) => item.priority === priority)
      .map((item) => `<strong>${item.title}:</strong> ${item.action} <em>${item.rationale}</em>`)
  );

const buildHumanReviewChecklistHtml = (courseTitle: string, items: HumanReviewChecklistItem[], theme: Theme): string =>
  canvasShell(
    "Before Publishing Human Review Checklist",
    `Faculty review path for ${courseTitle}. Complete must-review items before publishing the imported Canvas course.`,
    `${section("Must Review Before Publishing", checklistGroupHtml(items, "must"), theme)}
${section("Recommended Review", checklistGroupHtml(items, "recommended"), theme)}
${section("Optional Polish", checklistGroupHtml(items, "optional"), theme)}
${callout("Canvas Reimport Reminder", "<p>If you import revised content into an existing Canvas course, Canvas may duplicate edited objects rather than replacing them. For high-stakes revisions, import into a clean shell or remove old objects first.</p>", theme)}`,
    theme
  );

// The generated homepage now shares a single source of truth with the in-app Homepage builder:
// it derives the structured HomepageContent and renders it through the template system. This
// keeps the friendly builder, the live preview, and the exported page identical, and lets a
// theme change recolor the page without touching instructor-authored text.
interface GeneratedHomepage {
  html: string;
  content: ReturnType<typeof defaultHomepageContent>;
}

const buildHomepage = (settings: CourseSettings, title: string, moduleCount: number, theme: Theme): GeneratedHomepage => {
  const content = defaultHomepageContent({
    title,
    description: settings.description,
    modality: settings.modality,
    level: settings.level,
    moduleCount,
    finalProject: settings.finalProject,
    finalProjectType: settings.finalProjectType,
    organizationLabel: settings.organizationPattern === "custom" ? settings.customOrganizationLabel : settings.organizationPattern
  });
  return { html: renderHomepage(DEFAULT_TEMPLATE_ID, content, theme), content };
};

export const generateCourseProject = ({ prompt, settings, themeOverride }: GenerateCourseInput): CourseProject => {
  const generatedAt = nowIso();
  const mergedSettings: CourseSettings = {
    ...defaultSettings,
    ...settings,
    schedule: { ...defaultSettings.schedule, ...settings.schedule },
    imageSettings: { ...defaultSettings.imageSettings, ...settings.imageSettings } as CourseImageSettings
  };
  const title = titleFromPrompt(prompt, mergedSettings.title);
  const theme = themeOverride ?? getTheme(mergedSettings.themeId);
  const moduleCount = Math.max(1, Math.min(18, mergedSettings.moduleCount || mergedSettings.lengthWeeks || 12));
  const finalTitle = finalModuleTitle(mergedSettings);
  const projectId = `course_${slugify(title)}`;
  const topic = title.replace(/^course\s+on\s+/i, "");
  const syllabusScheduleRows = Array.from({ length: moduleCount }, (_, index) => {
    const moduleNumber = index + 1;
    const moduleTopic = baseTopics[index] ?? `Applied Topic ${moduleNumber}`;
    const moduleLabel = organizationLabel(mergedSettings, moduleNumber);
    const releaseAt = releaseDateForModule(mergedSettings, index);
    const discussionDue = dueDateForModule(mergedSettings, index, 3);
    const quizDue = dueDateForModule(mergedSettings, index, 4);
    const assignmentDue = dueDateForModule(mergedSettings, index, 6);
    const activities = [
      "resources",
      "lesson",
      "practice",
      shouldIncludeDiscussion(mergedSettings, moduleNumber) ? `discussion due ${readableDate(discussionDue)}` : "",
      shouldIncludeQuiz(mergedSettings, moduleNumber) ? `quiz due ${readableDate(quizDue)}` : "",
      shouldIncludeAssignment(mergedSettings, moduleNumber) ? `applied assignment due ${readableDate(assignmentDue)}` : "",
      shouldIncludeFinalMilestone(mergedSettings, moduleNumber, moduleCount) ? `${finalTitle.toLowerCase()} checkpoint` : ""
    ].filter(Boolean);
    return `<strong>${moduleLabel}: ${moduleTopic}</strong> - release ${readableDate(releaseAt)}; ${activities.join(", ")}.`;
  });

  const framework = getOutcomeFramework(mergedSettings.outcomeFramework);
  const outcomes: CourseOutcome[] = Array.from({ length: 10 }, (_, index) => {
    const level = framework.levels[index % framework.levels.length];
    return {
      id: id("outcome", index + 1),
      code: `CLO ${index + 1}`,
      text: `${level.verb} key ${topic.toLowerCase()} concepts, practices, and implications in academic and applied contexts.`,
      bloomLevel: level.label,
      alignedModuleIds: []
    };
  });

  const assignmentGroups: AssignmentGroup[] = [
    { id: "group_discussions", name: "Engagement and Discussions", weight: 20 },
    { id: "group_quizzes", name: "Knowledge Checks", weight: 15 },
    { id: "group_assignments", name: "Applied Assignments", weight: 35 },
    { id: "group_final_project", name: finalTitle, weight: 30 }
  ];

  const navigation = navigationDefaults();
  const contactHours = makeContactHours(mergedSettings);
  const pages: CoursePage[] = [];
  const assignments: Assignment[] = [];
  const discussions: Discussion[] = [];
  const quizzes: Quiz[] = [];
  const rubrics: Rubric[] = [];
  const modules: CourseModule[] = [];
  const resources: CourseResource[] = [];
  const schedule: CourseScheduleEntry[] = [];
  const fileAssets: FileAsset[] = [
    makeFileAsset("asset_course_banner", "web_resources/course-banner.svg", "Course banner", "image/svg+xml", "banner", generatedAt, "Deterministic SVG homepage banner."),
    makeFileAsset("asset_course_tile", "web_resources/course-tile.svg", "Course tile image", "image/svg+xml", "tile", generatedAt, "Deterministic SVG course tile placeholder."),
    makeFileAsset("asset_syllabus_pdf", "web_resources/syllabus-printable.pdf", "Printable syllabus PDF", "application/pdf", "syllabus-printable", generatedAt, "Downloadable printable syllabus."),
    makeFileAsset("asset_syllabus_html", "web_resources/syllabus-printable.html", "Printable syllabus HTML", "text/html", "other", generatedAt, "PDF-ready syllabus HTML fallback."),
    makeFileAsset("asset_instructor_pdf", "web_resources/instructor-guide.pdf", "Instructor guide PDF", "application/pdf", "instructor-guide", generatedAt, "Downloadable instructor guide."),
    makeFileAsset("asset_instructor_html", "web_resources/instructor-guide-printable.html", "Instructor guide printable HTML", "text/html", "other", generatedAt, "PDF-ready instructor guide HTML fallback.")
  ];

  const homepageId = WELL_KNOWN_PAGE_IDS.homepage;
  const syllabusId = WELL_KNOWN_PAGE_IDS.syllabus;
  const studentGuideId = WELL_KNOWN_PAGE_IDS.successGuide;
  const instructorGuideId = "page_instructor_guide";
  const syllabusContext: SyllabusContext = {
    title,
    description: mergedSettings.description,
    modality: mergedSettings.modality,
    level: mergedSettings.level,
    creditHours: mergedSettings.creditHours,
    lengthWeeks: mergedSettings.lengthWeeks,
    moduleCount,
    organizationLabel: mergedSettings.organizationPattern === "custom" ? mergedSettings.customOrganizationLabel : mergedSettings.organizationPattern,
    finalProject: mergedSettings.finalProject,
    finalProjectType: mergedSettings.finalProjectType,
    outcomes,
    assignmentGroups,
    assignments,
    discussions,
    quizzes,
    contactHours,
    scheduleRows: syllabusScheduleRows.map((row) => row.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim())
  };
  const generatedSyllabusContent = defaultSyllabusContent(syllabusContext);
  const generatedSyllabusTemplateId = chooseSyllabusTemplate(syllabusContext);
  const syllabusHtml = renderSyllabus(generatedSyllabusTemplateId, generatedSyllabusContent, theme);
  const instructorGuideHtml = buildInstructorGuideHtml(title, navigation, theme);

  const generatedHomepage = buildHomepage(mergedSettings, title, moduleCount, theme);
  pages.push(makePage(homepageId, `${title} Homepage`, "homepage", generatedHomepage.html, "module_start", generatedAt, { frontPage: true }));
  pages.push(makePage(syllabusId, "Syllabus", "syllabus", syllabusHtml, "module_start", generatedAt));
  pages.push(makePage(studentGuideId, "Course Success Guide", "course-success-guide", buildStudentGuideHtml(title, theme), "module_start", generatedAt));

  const startItems: ModuleItem[] = [
    makeItem("item_homepage", "page", "Welcome to the Course", homepageId, 1, generatedAt),
    makeItem("item_course_success_guide", "page", "Course Success Guide", studentGuideId, 2, generatedAt),
    makeItem("item_syllabus", "syllabus", "Syllabus", syllabusId, 3, generatedAt)
  ];

  ["How to Use This Course", "Course Navigation Guide", "Technology Requirements", "Communication Expectations"].forEach((pageTitle, index) => {
    const pageId = id("page", pageTitle);
    pages.push(
      makePage(
        pageId,
        pageTitle,
        slugify(pageTitle),
        canvasShell(
          pageTitle,
          `Practical guidance for navigating ${title}.`,
          `${section("What This Page Covers", `<p>Use this page to understand one part of the course experience before beginning weekly work.</p>`, theme)}
${section("Recommended Actions", checklistHtml(["Review module overview pages first.", "Use Canvas notifications and calendar reminders.", "Download or bookmark key support resources.", "Contact the instructor before small issues become urgent."]), theme)}`,
          theme
        ),
        "module_start",
        generatedAt
      )
    );
    startItems.push(makeItem(id("item", pageTitle), "page", pageTitle, pageId, index + 4, generatedAt));
  });

  const introDiscussionId = "discussion_introduce_yourself";
  const introRubricId = "rubric_introduce_yourself";
  const introDiscussionDueAt = dueDateForModule(mergedSettings, 0, 1);
  rubrics.push(makeRubric(introRubricId, "Introduce Yourself Discussion Rubric", 10, [outcomes[0].id], generatedAt, "Community"));
  discussions.push({
    id: introDiscussionId,
    title: "Introduce Yourself",
    moduleId: "module_start",
    dueAt: introDiscussionDueAt,
    assignmentGroupId: "group_discussions",
    points: 10,
    rubricId: introRubricId,
    alignedOutcomeIds: [outcomes[0].id],
    publishState: "published",
    status: "generated",
    metadata: metadata(generatedAt),
    promptHtml: canvasShell(
      "Introduce Yourself",
      "Build course community and practice the discussion workflow.",
      `${section("Prompt", "<p>Share your background, one question you bring to the course, and one strategy that helps you learn online.</p>", theme)}
${section("Replies", "<p>Reply to two classmates with a connection, a useful resource, or a thoughtful question.</p>", theme)}`,
      theme
    )
  });
  startItems.push(makeItem("item_introduce_yourself", "discussion", "Introduce Yourself", introDiscussionId, startItems.length + 1, generatedAt));
  schedule.push({
    id: id("schedule", introDiscussionId),
    moduleId: "module_start",
    title: "Introduce Yourself discussion",
    itemId: introDiscussionId,
    itemType: "discussion",
    dueAt: introDiscussionDueAt,
    workloadHours: 1,
    notes: "Orientation discussion due date should give students time to practice Canvas discussion workflow before module work accelerates."
  });

  modules.push({
    id: "module_start",
    title: "Start Here",
    description: "Orientation materials that help students understand the course structure, expectations, technology, grading, and support resources.",
    objectives: ["Navigate the Canvas course shell.", "Identify course expectations and support resources."],
    workloadHours: 3,
    order: 0,
    kind: "start",
    publishState: "published",
    expanded: true,
    items: startItems,
    status: "generated",
    metadata: metadata(generatedAt)
  });

  // Deterministic id of any content module's overview page, so a module can link to its
  // neighbours' overviews for Previous/Next navigation. Must mirror the overviewPageId
  // formula used inside the loop below.
  const contentOverviewPageId = (i: number): string => id("page", `${i + 1}-${baseTopics[i] ?? `Applied Topic ${i + 1}`}-overview`);
  // A themed Previous/Next bar built from real Canvas wiki tokens. The first module steps back to
  // the Course Success Guide; the last steps forward to the Modules index (which holds the Final
  // Project module), so every module has working forward/backward navigation in the imported course.
  const moduleNavBar = (index: number): string => {
    const previous =
      index > 0
        ? secondaryLink(wikiPageRef(contentOverviewPageId(index - 1)), `Previous: ${organizationLabel(mergedSettings, index)}`, theme)
        : secondaryLink(wikiPageRef(studentGuideId), "Back to Course Success Guide", theme);
    const next =
      index < moduleCount - 1
        ? buttonLink(wikiPageRef(contentOverviewPageId(index + 1)), `Next: ${organizationLabel(mergedSettings, index + 2)}`, theme)
        : buttonLink(modulesIndexRef(), "Continue to Modules and Final Project", theme);
    return `<p>${previous}${next}</p>`;
  };

  const structureModel = getStructureFramework(mergedSettings.structureFramework);
  const patternModel = getModulePattern(mergedSettings.modulePattern);
  const quizPurposeModel = getQuizPurpose(mergedSettings.quizPurpose);

  for (let index = 0; index < moduleCount; index += 1) {
    const moduleNumber = index + 1;
    const moduleId = id("module", moduleNumber);
    const moduleTopic = baseTopics[index] ?? `Applied Topic ${moduleNumber}`;
    const moduleLabel = organizationLabel(mergedSettings, moduleNumber);
    const alignedOutcomeIds = [outcomes[index % outcomes.length].id, outcomes[(index + 2) % outcomes.length].id];
    const moduleObjectives = moduleObjectivesFor(outcomes, alignedOutcomeIds);
    const moduleItems: ModuleItem[] = [];
    const workloadHours = Math.round((contactHours.totalHours - 8) / moduleCount);
    const moduleResources = buildModuleResources(moduleId, moduleLabel, moduleTopic, topic, generatedAt);
    const moduleReleaseAt = releaseDateForModule(mergedSettings, index);
    const resourceDueAt = dueDateForModule(mergedSettings, index, 2);
    const practiceDueAt = dueDateForModule(mergedSettings, index, 3);
    const discussionDueAt = dueDateForModule(mergedSettings, index, 3);
    const quizDueAt = dueDateForModule(mergedSettings, index, 4);
    const assignmentDueAt = dueDateForModule(mergedSettings, index, 6);
    const milestoneDueAt = dueDateForModule(mergedSettings, index, 5);
    resources.push(...moduleResources);
    schedule.push({
      id: id("schedule", `${moduleId}-release`),
      moduleId,
      title: `${moduleLabel}: ${moduleTopic}`,
      itemType: "module",
      releaseAt: moduleReleaseAt,
      workloadHours,
      notes: "Set module release date and due dates after confirming the official term calendar, holidays, and blackout dates."
    });

    const overviewPageId = id("page", `${moduleNumber}-${moduleTopic}-overview`);
    const hasDiscussion = shouldIncludeDiscussion(mergedSettings, moduleNumber);
    const hasQuiz = shouldIncludeQuiz(mergedSettings, moduleNumber);
    const hasAssignment = shouldIncludeAssignment(mergedSettings, moduleNumber);
    const glanceRows: string[][] = [
      ["Overview", "Page", "—", "Read first"],
      ["Readings &amp; Resources", "Page", readableDate(resourceDueAt), "Required reading"],
      ["Lecture &amp; Notes", "Page", "—", "Study"],
      ["Practice Activity", "Page", readableDate(practiceDueAt), "Ungraded practice"]
    ];
    if (hasDiscussion) glanceRows.push(["Discussion", "Discussion", readableDate(discussionDueAt), "Graded"]);
    if (hasQuiz) glanceRows.push([quizPurposeModel.titleWord, "Quiz", readableDate(quizDueAt), "Graded"]);
    if (hasAssignment) glanceRows.push(["Applied Assignment", "Assignment", readableDate(assignmentDueAt), "Graded"]);
    glanceRows.push(["Wrap-Up &amp; Reflection", "Page", "—", "Recap"]);
    const overviewPills = pillRow(
      [`~${workloadHours} hrs of work`, `${alignedOutcomeIds.length} aligned outcomes`, `${glanceRows.length} activities`, `${[hasDiscussion, hasQuiz, hasAssignment].filter(Boolean).length} graded`],
      theme
    );
    // Per-module header image (opt-in via imageSettings.moduleHeaderImages). Mirrors the homepage
    // banner pattern: an SVG written to web_resources + referenced with a Canvas file token. The SVG
    // itself is generated at export time (imsccExport) from this same module number/title.
    let moduleHeaderImg = "";
    if (mergedSettings.imageSettings.moduleHeaderImages) {
      const headerFile = `module-${moduleNumber}-header.svg`;
      fileAssets.push(
        makeFileAsset(
          `asset_module_${moduleNumber}_header`,
          `web_resources/${headerFile}`,
          `${moduleLabel} header image`,
          "image/svg+xml",
          "other",
          generatedAt,
          "Per-module themed header banner (module-number monogram + motif + rotated accent)."
        )
      );
      moduleHeaderImg = `<p style="margin: 0 0 18px;"><img src="${fileRef(headerFile)}" alt="${escapeXml(`${moduleLabel}: ${moduleTopic} header`)}" style="display: block; width: 100%; height: auto; border-radius: 14px;" /></p>`;
    }
    pages.push(
      makePage(
        overviewPageId,
        `About ${moduleLabel}`,
        slugify(`${moduleLabel}-${moduleTopic}-overview`),
        canvasShell(
          `${moduleLabel}: ${moduleTopic}`,
          "Start here to understand the learning path, outcomes, activities, and expectations for this module.",
          `${moduleHeaderImg}${overviewPills}${callout("🚀 Mission briefing", `<p>Welcome to <strong>${moduleTopic}</strong> — your launch pad for this part of the course. Work through the module in order: each stop builds on the one before, moving you from new vocabulary to real examples to confident, evidence-based judgment.</p><p><em>${structureModel.approach}</em></p>`, theme)}
${callout("🧭 Keep this question as your North Star", `<p>As you move through the readings, lecture, and practice, keep asking: <em>What is actually happening, who is affected, what does the evidence show, and what becomes possible once we understand the context?</em></p>`, theme)}
${section("✅ What You Will Do", checklistHtml(["Review the module overview and required materials.", "Study the lecture/content page.", "Complete discussions, quizzes, and assignments shown in the module.", "Use the recap page to prepare for what comes next."]), theme)}
${section("Module Learning Objectives", listHtml(moduleObjectives), theme)}
${section("Aligned Course Outcomes", outcomeBadges(outcomes, alignedOutcomeIds, theme), theme)}
${section("Module at a Glance", tableHtml("Everything in this module and when it is due", ["Activity", "Type", "Due", "Counts toward grade"], glanceRows, theme), theme)}
${section("Learning Path", checklistHtml(patternModel.steps), theme)}
${callout("Estimated Workload", `<p>Plan for approximately ${workloadHours} hours of student work in this module.</p>`, theme)}
${section("Module Navigation", moduleNavBar(index), theme)}`,
          theme
        ),
        moduleId,
        generatedAt
      )
    );
    moduleItems.push(makeItem(id("item", overviewPageId), "page", `About ${moduleLabel}`, overviewPageId, moduleItems.length + 1, generatedAt));

    const resourcesPageId = id("page", `${moduleNumber}-${moduleTopic}-resources`);
    pages.push(
      makePage(
        resourcesPageId,
        `${moduleLabel}: Readings and Resources`,
        slugify(`${moduleLabel}-${moduleTopic}-resources`),
        canvasShell(
          `${moduleLabel}: Readings and Resources`,
          "Use these instructor-editable resources to build the evidence base for this module.",
          `${section("How To Use These Resources", checklistHtml(["Prioritize required resources first.", "Record one concept, one example, and one question from each required source.", "Treat generated citations and URLs as placeholders until an instructor replaces them with verified sources."]), theme)}
${section("Resource List", resourceCardsHtml(moduleResources, theme), theme)}
${callout("Accessibility Check", "<p>Instructor should confirm that videos include captions or transcripts, files are readable by screen readers where possible, and links use descriptive text.</p>", theme)}`,
          theme
        ),
        moduleId,
        generatedAt
      )
    );
    moduleItems.push(makeItem(id("item", resourcesPageId), "page", "Readings and Resources", resourcesPageId, moduleItems.length + 1, generatedAt));
    schedule.push({
      id: id("schedule", `${resourcesPageId}-work`),
      moduleId,
      title: `${moduleLabel} readings and resources`,
      itemId: resourcesPageId,
      itemType: "page",
      dueAt: resourceDueAt,
      workloadHours: Math.max(1, Math.round(moduleResources.reduce((sum, resource) => sum + resource.estimatedMinutes, 0) / 60)),
      notes: "Instructor should replace placeholders with verified readings, media, or uploaded files before publication."
    });

    const lecturePageId = id("page", `${moduleNumber}-${moduleTopic}-lecture`);
    pages.push(
      makePage(
        lecturePageId,
        `${moduleTopic}: Lecture and Notes`,
        slugify(`${moduleTopic}-lecture-notes`),
        canvasShell(
          `${moduleTopic}: Lecture and Notes`,
          "Canvas-friendly lesson content, examples, misconception checks, and instructor-editable teaching notes.",
          `${section("Mini-Lecture", `<p>${moduleTopic} asks students to connect course concepts to evidence, context, and decisions. In this module, students identify the vocabulary that helps them describe the issue, then practice using that vocabulary to interpret examples connected to ${topic.toLowerCase()}.</p><p>Experts in this area rarely ask "what do I think?" first. They ask, in order: <em>What is actually happening? Who is affected? What evidence supports the claim? What becomes possible once we understand the context?</em> The rest of this page walks that sequence so you can reuse it on the graded work.</p>`, theme)}
${section("Key Terms", `<p>Learn these well enough to use them in a sentence — the assignment and quiz both reward precise vocabulary.</p>${listHtml([
            `<strong>${moduleTopic} vocabulary:</strong> the specific words this module uses to describe ${moduleTopic.toLowerCase()} precisely instead of in general terms.`,
            "<strong>Stakeholder:</strong> any person, group, or system affected by a decision — naming stakeholders keeps your analysis grounded in real impact.",
            "<strong>Evidence:</strong> verifiable data, sources, or observations used to support a claim, as opposed to personal opinion.",
            "<strong>Context:</strong> the conditions and constraints that change how a situation should be interpreted.",
            "<strong>Tradeoff:</strong> what is given up when one option is chosen over another; strong analysis makes tradeoffs explicit.",
            "<strong>Recommendation:</strong> a defensible course of action that follows from the evidence and weighs the tradeoffs."
          ])}`, theme)}
${exampleNote("Worked Example", `<p>Here is the five-move method applied to a case connected to ${topic.toLowerCase()} — the same moves you will use on the assignment:</p>${orderedListHtml([
            "<strong>Situation:</strong> state what is happening and when, in one or two sentences, before interpreting anything.",
            "<strong>Stakeholders:</strong> name the people, groups, or systems affected, and note what each one stands to gain or lose.",
            "<strong>Evidence:</strong> cite two or three specific items from the resource page and explain what each one shows.",
            "<strong>Tradeoffs:</strong> make at least one tension between competing goals explicit instead of glossing over it.",
            "<strong>Recommendation:</strong> state a clear, defensible decision and one sentence on why it follows from the evidence."
          ])}<p style="margin: 12px 0 0;">Notice that opinion never appears on its own — every judgment is anchored to evidence and context.</p>`, theme)}
${tipNote("Why This Matters", `<p>Advanced courses and employers expect graduates to move from opinion to evidence-based judgment. Practicing the five-move method on ${moduleTopic.toLowerCase()} now builds the exact habit you will use in this module's graded work, in the final project, and in professional decisions later.</p>`, theme)}
${misconceptionNote("Common Misconception", `<p>A common mistake is treating ${moduleTopic.toLowerCase()} as a simple opinion question. Course work should move from opinion toward evidence, context, and reasoned judgment.</p>`, theme)}
${checkNote("Check Your Understanding", checklistHtml(["Define one module term in your own words.", "Name one example that illustrates the concept.", "Explain one consequence or tradeoff.", "Write one question you still need answered."]), theme)}
${section("Instructor Teaching Notes", checklistHtml(["Replace the worked example with one from the discipline or local context.", "Add a short announcement that connects this lesson to the graded task.", "Watch for students who summarize sources without explaining why the evidence matters."]), theme)}`,
          theme
        ),
        moduleId,
        generatedAt
      )
    );
    moduleItems.push(makeItem(id("item", lecturePageId), "page", "Lecture and Notes", lecturePageId, moduleItems.length + 1, generatedAt));

    const practicePageId = id("page", `${moduleNumber}-${moduleTopic}-practice`);
    pages.push(
      makePage(
        practicePageId,
        `${moduleLabel}: Practice Activity`,
        slugify(`${moduleLabel}-${moduleTopic}-practice`),
        canvasShell(
          `${moduleLabel}: Practice Activity`,
          "A low-stakes activity to prepare for discussion, quiz, assignment, or final project work.",
          `${section("Practice Prompt", `<p>Choose one example connected to ${moduleTopic.toLowerCase()}. Create a quick analysis with three parts: what is happening, what evidence supports your interpretation, and what question remains.</p>`, theme)}
${section("Student Steps", checklistHtml(["Write a one-sentence claim.", "Add one piece of evidence from the module resources.", "Name one stakeholder, audience, or affected group.", "Identify one uncertainty to discuss or investigate."]), theme)}
${section("Self-Check", checklistHtml(["Did I use at least one module term?", "Did I explain why the evidence matters?", "Did I connect this practice to a course outcome or final project idea?"]), theme)}
${callout("What To Do Next", "<p>Use this practice response as a starting point for the discussion, quiz preparation, assignment, or final project checkpoint.</p>", theme)}`,
          theme
        ),
        moduleId,
        generatedAt
      )
    );
    moduleItems.push(makeItem(id("item", practicePageId), "page", "Practice Activity", practicePageId, moduleItems.length + 1, generatedAt));
    schedule.push({
      id: id("schedule", `${practicePageId}-work`),
      moduleId,
      title: `${moduleLabel} practice activity`,
      itemId: practicePageId,
      itemType: "page",
      dueAt: practiceDueAt,
      workloadHours: 1,
      notes: "Low-stakes practice should be completed before graded activity dates."
    });

    if (shouldIncludeDiscussion(mergedSettings, moduleNumber)) {
      const discussionId = id("discussion", moduleNumber);
      const rubricId = id("rubric-discussion", moduleNumber);
      if (mergedSettings.includeRubrics) rubrics.push(makeRubric(rubricId, `${moduleLabel} Discussion Rubric`, 20, alignedOutcomeIds, generatedAt, "Discussion"));
      discussions.push({
        id: discussionId,
        title: `${moduleLabel} Discussion: ${moduleTopic}`,
        moduleId,
        dueAt: discussionDueAt,
        assignmentGroupId: "group_discussions",
        points: 20,
        rubricId: mergedSettings.includeRubrics ? rubricId : undefined,
        alignedOutcomeIds,
        publishState: "published",
        status: "generated",
        metadata: metadata(generatedAt),
        promptHtml: discussionPrompt(moduleTopic, topic, mergedSettings, theme)
      });
      moduleItems.push(makeItem(id("item", discussionId), "discussion", `Discussion: ${moduleTopic}`, discussionId, moduleItems.length + 1, generatedAt));
      schedule.push({
        id: id("schedule", discussionId),
        moduleId,
        title: `${moduleLabel} discussion`,
        itemId: discussionId,
        itemType: "discussion",
        dueAt: discussionDueAt,
        workloadHours: 1,
        notes: "Set an initial post deadline and reply deadline after confirming the weekly due-date pattern."
      });
    }

    if (shouldIncludeQuiz(mergedSettings, moduleNumber)) {
      const quizId = id("quiz", moduleNumber);
      const questions = quizQuestions(quizId, moduleTopic, moduleId, alignedOutcomeIds, mergedSettings);
      quizzes.push({
        id: quizId,
        title: `${moduleLabel} ${quizPurposeModel.titleWord}`,
        moduleId,
        dueAt: quizDueAt,
        assignmentGroupId: "group_quizzes",
        purpose: `${quizPurposeModel.framing(moduleTopic)} Aligned outcomes: ${alignedOutcomeIds.map((outcomeId) => outcomes.find((outcome) => outcome.id === outcomeId)?.code).join(", ")}.`,
        points: questions.reduce((sum, question) => sum + question.points, 0),
        alignedOutcomeIds,
        publishState: "published",
        status: "generated",
        metadata: metadata(generatedAt),
        questions
      });
      moduleItems.push(makeItem(id("item", quizId), "quiz", quizPurposeModel.titleWord, quizId, moduleItems.length + 1, generatedAt));
      schedule.push({
        id: id("schedule", quizId),
        moduleId,
        title: `${moduleLabel} knowledge check`,
        itemId: quizId,
        itemType: "quiz",
        dueAt: quizDueAt,
        workloadHours: 1,
        notes: "Set quiz due date after resource and lesson completion; subjective questions require instructor review."
      });
    }

    if (shouldIncludeAssignment(mergedSettings, moduleNumber)) {
      const assignmentId = id("assignment", moduleNumber);
      const rubricId = id("rubric-assignment", moduleNumber);
      if (mergedSettings.includeRubrics) rubrics.push(makeRubric(rubricId, `${moduleLabel} Applied Assignment Rubric`, 60, alignedOutcomeIds, generatedAt, "Applied assignment"));
      assignments.push({
        id: assignmentId,
        title: `${moduleLabel} Applied Analysis: ${moduleTopic}`,
        moduleId,
        dueAt: assignmentDueAt,
        assignmentGroupId: "group_assignments",
        points: 60,
        estimatedHours: 5,
        submissionType: "Online upload or text entry",
        rubricId: mergedSettings.includeRubrics ? rubricId : undefined,
        alignedOutcomeIds,
        publishState: "published",
        status: "generated",
        metadata: metadata(generatedAt),
        descriptionHtml: assignmentDescription(`${moduleLabel} Applied Analysis`, moduleTopic, alignedOutcomeIds, outcomes, theme)
      });
      moduleItems.push(makeItem(id("item", assignmentId), "assignment", assignments[assignments.length - 1].title, assignmentId, moduleItems.length + 1, generatedAt));
      schedule.push({
        id: id("schedule", assignmentId),
        moduleId,
        title: `${moduleLabel} applied assignment`,
        itemId: assignmentId,
        itemType: "assignment",
        dueAt: assignmentDueAt,
        workloadHours: 5,
        notes: "Set due date after discussion and practice work so students have time to revise."
      });
    }

    if (shouldIncludeFinalMilestone(mergedSettings, moduleNumber, moduleCount)) {
      const milestonePageId = id("page", `${moduleNumber}-final-project-milestone`);
      const milestoneLabel =
        mergedSettings.scaffoldPattern === "key-milestones"
          ? moduleNumber === 1
            ? "Project Proposal Checkpoint"
            : moduleNumber >= moduleCount - 1
              ? "Draft and Readiness Checkpoint"
              : "Evidence and Design Checkpoint"
          : "Milestone Reminder";
      pages.push(
        makePage(
          milestonePageId,
          `${moduleLabel} ${finalTitle} ${milestoneLabel}`,
          slugify(`${moduleLabel}-final-project-milestone`),
          canvasShell(
            `${moduleLabel} ${finalTitle} Milestone`,
            `Use this checkpoint to keep the ${finalTitle.toLowerCase()} moving before the final module.`,
            `${section("Milestone Task", checklistHtml(["Connect this module to your final work.", "Save one source, example, or design decision.", "Note one question to resolve before final submission."]), theme)}
${section("What To Carry Forward", `<p>This checkpoint should leave you with one concrete artifact, decision, or question to revisit in the ${finalTitle} module.</p>`, theme)}`,
            theme
          ),
          moduleId,
          generatedAt
        )
      );
      moduleItems.push(makeItem(id("item", milestonePageId), "page", `${finalTitle} ${milestoneLabel}`, milestonePageId, moduleItems.length + 1, generatedAt, "published", 1));
      schedule.push({
        id: id("schedule", milestonePageId),
        moduleId,
        title: `${moduleLabel} ${finalTitle.toLowerCase()} checkpoint`,
        itemId: milestonePageId,
        itemType: "page",
        dueAt: milestoneDueAt,
        workloadHours: 1,
        notes: "Checkpoint due date should leave enough time for instructor feedback before final submission."
      });
    }

    const wrapPageId = id("page", `${moduleNumber}-${moduleTopic}-wrap-up`);
    pages.push(
      makePage(
        wrapPageId,
        `End of ${moduleLabel}`,
        slugify(`${moduleLabel}-wrap-up`),
        canvasShell(
          `${moduleLabel} Wrap-Up`,
          "Close the module by consolidating what changed in your thinking.",
          `${section("What You Covered", `<p>You explored ${moduleTopic.toLowerCase()} and practiced applying course concepts in context.</p>`, theme)}
${section("You Should Now Be Able To", listHtml(moduleObjectives), theme)}
${section("Reflection Questions", checklistHtml(["What concept feels most useful now?", "What question remains unresolved?", "How does this module connect to your final project or professional context?"]), theme)}
${callout("Coming Next", `<p>The next module extends this work into ${baseTopics[index + 1] ?? finalTitle.toLowerCase()}.</p>`, theme)}
${section("Module Navigation", moduleNavBar(index), theme)}`,
          theme
        ),
        moduleId,
        generatedAt
      )
    );
    moduleItems.push(makeItem(id("item", wrapPageId), "page", `End of ${moduleLabel}`, wrapPageId, moduleItems.length + 1, generatedAt));

    outcomes.forEach((outcome) => {
      if (alignedOutcomeIds.includes(outcome.id)) outcome.alignedModuleIds.push(moduleId);
    });

    modules.push({
      id: moduleId,
      title: `${moduleLabel}: ${moduleTopic}`,
      description: `Students explore ${moduleTopic.toLowerCase()} through structured pages, practice, feedback, and recap.`,
      objectives: moduleObjectives,
      workloadHours,
      order: moduleNumber,
      kind: "content",
      publishState: "published",
      expanded: moduleNumber <= 2,
      items: structureContentModuleItems(moduleItems, moduleNumber, generatedAt),
      status: "generated",
      metadata: metadata(generatedAt)
    });
  }

  const finalModuleId = "module_final_project";
  const finalOutcomeIds = [outcomes[1].id, outcomes[3].id, outcomes[5].id, outcomes[8].id];
  const finalItems: ModuleItem[] = [];
  const finalReleaseAt = releaseDateForModule(mergedSettings, moduleCount);
  const finalDueAt = dueDateForModule(mergedSettings, moduleCount, 6);
  schedule.push({
    id: id("schedule", `${finalModuleId}-release`),
    moduleId: finalModuleId,
    title: finalTitle,
    itemType: "module",
    releaseAt: finalReleaseAt,
    dueAt: finalDueAt,
    workloadHours: contactHours.finalProjectTime,
    notes: "Final module dates should allow time for milestone review, revision, final submission, and reflection."
  });
  const finalOverviewId = "page_final_project_overview";
  pages.push(
    makePage(
      finalOverviewId,
      `${finalTitle} Overview`,
      "final-project-overview",
      canvasShell(
        `${finalTitle} Overview`,
        `Complete a final ${readableFinalProjectType(mergedSettings).toLowerCase()} that synthesizes the course.`,
        `${section("Purpose", "<p>The final project asks students to integrate course concepts, evidence, ethical considerations, and practical recommendations.</p>", theme)}
${section("Aligned Course Outcomes", outcomeBadges(outcomes, finalOutcomeIds, theme), theme)}
${section("Recommended Process", checklistHtml(["Review module recap pages.", "Choose a focused problem or scenario.", "Gather evidence and examples.", "Draft, revise, and check alignment to the rubric."]), theme)}`,
        theme
      ),
      finalModuleId,
      generatedAt
    )
  );
  finalItems.push(makeItem("item_final_project_overview", "page", `${finalTitle} Overview`, finalOverviewId, finalItems.length + 1, generatedAt));

  if (mergedSettings.scaffoldFinalProject) {
    const finalMilestoneId = "page_final_project_milestone_review";
    pages.push(
      makePage(
        finalMilestoneId,
        `${finalTitle} Milestone Review`,
        "final-project-milestone-review",
        canvasShell(
          `${finalTitle} Milestone Review`,
          "Use this page to gather earlier project checkpoints before final submission.",
          `${section("Milestone Review", checklistHtml(["Collect notes or drafts from earlier modules.", "Identify missing evidence or feedback.", "Confirm the project still aligns to course outcomes.", "Revise scope before final submission."]), theme)}`,
          theme
        ),
        finalModuleId,
        generatedAt
      )
    );
    finalItems.push(makeItem("item_final_project_milestone_review", "page", "Milestone Review", finalMilestoneId, finalItems.length + 1, generatedAt));
  }

  const finalAssignmentId = "assignment_final_project";
  const finalRubricId = "rubric_final_project";
  if (mergedSettings.includeRubrics) rubrics.push(makeRubric(finalRubricId, `${finalTitle} Rubric`, 120, finalOutcomeIds, generatedAt, finalTitle));
  assignments.push({
    id: finalAssignmentId,
    title: `Final ${readableFinalProjectType(mergedSettings)}: Course Synthesis`,
    moduleId: finalModuleId,
    dueAt: finalDueAt,
    assignmentGroupId: "group_final_project",
    points: 120,
    estimatedHours: 12,
    submissionType: "Online upload or text entry",
    rubricId: mergedSettings.includeRubrics ? finalRubricId : undefined,
    alignedOutcomeIds: finalOutcomeIds,
    publishState: "published",
    status: "generated",
    metadata: metadata(generatedAt),
    descriptionHtml: canvasShell(
      `Final ${readableFinalProjectType(mergedSettings)}: Course Synthesis`,
      "Demonstrate integrated learning across the course.",
      `${section("Final Deliverable", checklistHtml(["Submit the final artifact in the format specified by your instructor.", "Explain the problem, context, stakeholders, evidence, and recommendations.", "Connect your work to several course outcomes.", "Use accessible headings, clear file names, and complete citations where needed."]), theme)}
${section("Outcome Alignment", outcomeBadges(outcomes, finalOutcomeIds, theme), theme)}
${callout("Before Submission", "<p>Review the final rubric and confirm that every required section is complete.</p>", theme)}`,
      theme
    )
  });
  finalItems.push(makeItem("item_final_project_submission", "assignment", assignments[assignments.length - 1].title, finalAssignmentId, finalItems.length + 1, generatedAt));
  schedule.push({
    id: id("schedule", finalAssignmentId),
    moduleId: finalModuleId,
    title: `Final ${readableFinalProjectType(mergedSettings)} submission`,
    itemId: finalAssignmentId,
    itemType: "assignment",
    dueAt: finalDueAt,
    workloadHours: 12,
    notes: "Final due date should be reviewed against institutional exam, project, or course-end policies."
  });

  const finalWrapId = "page_final_project_wrap_up";
  pages.push(
    makePage(
      finalWrapId,
      "Final Course Wrap-Up",
      "final-course-wrap-up",
      canvasShell(
        "Final Course Wrap-Up",
        "Close the course by naming what you can carry into future learning and practice.",
        `${section("Reflect", checklistHtml(["What can you now explain or do that you could not do at the beginning?", "Which course outcome feels strongest for you?", "What will you keep practicing after the course?"]), theme)}
${section("Next Steps", "<p>Save your final project, feedback, and key resources for future academic or professional use.</p>", theme)}`,
        theme
      ),
      finalModuleId,
      generatedAt
    )
  );
  finalItems.push(makeItem("item_final_project_wrap_up", "page", "Final Wrap-Up", finalWrapId, finalItems.length + 1, generatedAt));
  finalOutcomeIds.forEach((outcomeId) => {
    const outcome = outcomes.find((item) => item.id === outcomeId);
    if (outcome && !outcome.alignedModuleIds.includes(finalModuleId)) outcome.alignedModuleIds.push(finalModuleId);
  });

  modules.push({
    id: finalModuleId,
    title: finalTitle,
    description: "A distinct final module for synthesis, milestone review, final submission, and course wrap-up.",
    objectives: moduleObjectivesFor(outcomes, finalOutcomeIds),
    workloadHours: contactHours.finalProjectTime,
    order: modules.length,
    kind: "final",
    publishState: "published",
    expanded: false,
    items: finalItems,
    status: "generated",
    metadata: metadata(generatedAt)
  });

  const courseCalendarId = WELL_KNOWN_PAGE_IDS.calendar;
  pages.push(
    makePage(
      courseCalendarId,
      "Course Calendar and Workload Plan",
      "course-calendar-and-workload-plan",
      buildCourseCalendarHtml(title, schedule, mergedSettings, theme),
      "module_start",
      generatedAt
    )
  );
  startItems.push(makeItem("item_course_calendar_workload_plan", "page", "Course Calendar and Workload Plan", courseCalendarId, startItems.length + 1, generatedAt));

  const alignmentMapId = "page_outcome_assessment_alignment_map";
  pages.push(
    makePage(
      alignmentMapId,
      "Outcome and Assessment Alignment Map",
      "outcome-and-assessment-alignment-map",
      buildAlignmentMapHtml(title, outcomes, modules, assignments, discussions, quizzes, rubrics, assignmentGroups, theme),
      "module_instructor_guide",
      generatedAt,
      { publishState: "unpublished" }
    )
  );

  const reviewChecklist = buildReviewChecklist({
    modules,
    pages,
    assignments,
    discussions,
    quizzes,
    rubrics,
    resources,
    schedule,
    navigation,
    settings: mergedSettings
  });
  pages.push(makePage(instructorGuideId, "Instructor Guide", "instructor-guide", instructorGuideHtml, "module_instructor_guide", generatedAt, { publishState: "unpublished" }));
  const instructorTeachingNotesId = "page_instructor_module_teaching_notes";
  pages.push(
    makePage(
      instructorTeachingNotesId,
      "Instructor Module Teaching Notes",
      "instructor-module-teaching-notes",
      buildInstructorTeachingNotesHtml(title, modules.filter((module) => module.kind === "content"), theme),
      "module_instructor_guide",
      generatedAt,
      { publishState: "unpublished" }
    )
  );
  const humanReviewChecklistId = "page_human_review_checklist";
  pages.push(
    makePage(
      humanReviewChecklistId,
      "Before Publishing Human Review Checklist",
      "before-publishing-human-review-checklist",
      buildHumanReviewChecklistHtml(title, reviewChecklist, theme),
      "module_instructor_guide",
      generatedAt,
      { publishState: "unpublished" }
    )
  );
  const instructorItems = [
    makeItem("item_instructor_guide", "page", "Instructor Guide", instructorGuideId, 1, generatedAt, "unpublished"),
    makeItem("item_instructor_module_teaching_notes", "page", "Instructor Module Teaching Notes", instructorTeachingNotesId, 2, generatedAt, "unpublished"),
    makeItem("item_outcome_assessment_alignment_map", "page", "Outcome and Assessment Alignment Map", alignmentMapId, 3, generatedAt, "unpublished"),
    makeItem("item_human_review_checklist", "page", "Before Publishing Human Review Checklist", humanReviewChecklistId, 4, generatedAt, "unpublished")
  ];
  modules.push({
    id: "module_instructor_guide",
    title: "Instructor Resources (DO NOT PUBLISH OR DELETE)",
    description: "Instructor-only resources, import guidance, publishing checklist, and course operation notes.",
    objectives: ["Review the generated course before publication.", "Use the instructor checklist to prepare the Canvas shell."],
    workloadHours: 1,
    order: modules.length,
    kind: "instructor",
    publishState: "unpublished",
    expanded: false,
    items: instructorItems,
    status: "generated",
    metadata: metadata(generatedAt)
  });

  const finalSyllabusContext: SyllabusContext = {
    ...syllabusContext,
    assignments,
    discussions,
    quizzes,
    scheduleRows: schedule
      .filter((entry) => entry.itemType === "module")
      .slice(0, moduleCount)
      .map((entry) => `${entry.title}: ${entry.notes || `Plan approximately ${entry.workloadHours} hours.`}`)
  };
  const finalSyllabusContent = defaultSyllabusContent(finalSyllabusContext);
  const finalSyllabusTemplateId = chooseSyllabusTemplate(finalSyllabusContext);
  const finalSyllabusHtml = renderSyllabus(finalSyllabusTemplateId, finalSyllabusContent, theme);
  const generatedSyllabusPage = pages.find((page) => page.id === syllabusId);
  if (generatedSyllabusPage) generatedSyllabusPage.bodyHtml = finalSyllabusHtml;

  const announcements: Announcement[] = [
    {
      id: "announcement_welcome",
      title: `Welcome to ${title}! 🚀`,
      bodyHtml: buildWelcomeAnnouncementHtml(title, theme),
      publishState: "published",
      status: "generated",
      metadata: metadata(generatedAt)
    }
  ];

  const project: CourseProject = {
    id: projectId,
    title,
    description: mergedSettings.description,
    prompt,
    settings: { ...mergedSettings, title, moduleCount },
    theme,
    status: "generated",
    updatedAt: generatedAt,
    homepage: createHomepageState(generatedHomepage.content, DEFAULT_TEMPLATE_ID, theme.id, generatedAt),
    syllabus: createSyllabusState(finalSyllabusContent, finalSyllabusTemplateId, theme.id, generatedAt),
    outcomes,
    announcements,
    modules,
    pages,
    assignments,
    discussions,
    quizzes,
    rubrics,
    resources,
    schedule,
    reviewChecklist,
    assignmentGroups,
    fileAssets,
    navigation,
    contactHours,
    exportHistory: [],
    exportMode: "full",
    metadata: metadata(generatedAt)
  };

  return { ...project, quality: buildCourseQualityReport(project) };
};

export const applyThemeToGeneratedContent = (course: CourseProject, theme: Theme): CourseProject => {
  const refreshedAt = nowIso();
  const regenerated = generateCourseProject({
    prompt: course.prompt,
    settings: { ...course.settings, themeId: theme.id },
    themeOverride: theme
  });

  const keepEdited = <T extends { id: string; status: string }>(generatedItems: T[], currentItems: T[]): T[] =>
    generatedItems.map((generatedItem) => {
      const currentItem = currentItems.find((item) => item.id === generatedItem.id);
      return currentItem?.status === "edited" ? currentItem : generatedItem;
    });

  const themedCourse: CourseProject = {
    ...course,
    theme,
    settings: { ...course.settings, themeId: theme.id },
    pages: keepEdited(regenerated.pages, course.pages),
    assignments: keepEdited(regenerated.assignments, course.assignments),
    discussions: keepEdited(regenerated.discussions, course.discussions),
    quizzes: keepEdited(regenerated.quizzes, course.quizzes),
    rubrics: keepEdited(regenerated.rubrics, course.rubrics),
    resources: keepEdited(regenerated.resources, course.resources),
    modules: keepEdited(regenerated.modules, course.modules),
    fileAssets: regenerated.fileAssets,
    schedule: regenerated.schedule,
    reviewChecklist: regenerated.reviewChecklist,
    navigation: course.navigation.length ? course.navigation : regenerated.navigation,
    updatedAt: refreshedAt,
    status: "edited"
  };

  // Re-theme the homepage from its builder model so a theme change recolors it even when the
  // page is marked "edited" (keepEdited would otherwise retain the old palette). A custom,
  // hand-edited homepage returns null here and is deliberately left untouched.
  const rethemedHomepageHtml = rethemeHomepageHtml(course.homepage, theme);
  const rethemedSyllabusHtml = rethemeSyllabusHtml(course.syllabus, theme);
  const homepagePage = course.pages.find((page) => page.frontPage);
  const syllabusPage = course.pages.find((page) => page.slug === "syllabus");
  const snapshotId = (prefix: string): string => `${prefix}_${refreshedAt.replace(/[^0-9]/g, "")}`;
  const homepageSnapshot = course.homepage && rethemedHomepageHtml
    ? {
        id: snapshotId("homepage_theme"),
        label: `Before refreshing ${theme.name} styling`,
        takenAt: refreshedAt,
        mode: course.homepage.mode,
        templateId: course.homepage.templateId,
        content: course.homepage.content,
        bodyHtml: homepagePage?.bodyHtml ?? ""
      }
    : null;
  const syllabusSnapshot = course.syllabus && rethemedSyllabusHtml
    ? {
        id: snapshotId("syllabus_theme"),
        label: `Before refreshing ${theme.name} styling`,
        takenAt: refreshedAt,
        mode: course.syllabus.mode,
        templateId: course.syllabus.templateId,
        content: course.syllabus.content,
        bodyHtml: syllabusPage?.bodyHtml ?? "",
        validationScore: validateSyllabus(syllabusPage?.bodyHtml ?? "", { includeContactHours: course.settings.includeContactHours }).score
      }
    : null;
  const finalCourse: CourseProject = rethemedHomepageHtml || rethemedSyllabusHtml
    ? {
        ...themedCourse,
        pages: themedCourse.pages.map((page) => {
          if (page.frontPage && rethemedHomepageHtml) return { ...page, bodyHtml: rethemedHomepageHtml };
          if (page.slug === "syllabus" && rethemedSyllabusHtml) return { ...page, bodyHtml: rethemedSyllabusHtml };
          return page;
        }),
        homepage:
          course.homepage && rethemedHomepageHtml
            ? { ...course.homepage, themeId: theme.id, updatedAt: refreshedAt, snapshots: homepageSnapshot ? [homepageSnapshot, ...course.homepage.snapshots].slice(0, 12) : course.homepage.snapshots }
            : course.homepage,
        syllabus:
          course.syllabus && rethemedSyllabusHtml
            ? { ...course.syllabus, themeId: theme.id, updatedAt: refreshedAt, snapshots: syllabusSnapshot ? [syllabusSnapshot, ...course.syllabus.snapshots].slice(0, 12) : course.syllabus.snapshots }
            : course.syllabus
      }
    : themedCourse;

  return { ...finalCourse, quality: buildCourseQualityReport(finalCourse) };
};

// Apply a named visual template: swap in its curated theme, point the homepage + syllabus builders at
// the template's matching layouts, record the selection, then re-theme all generated content so the
// editor previews, homepage, syllabus, module/page cards, and exports reflect the new look at once.
export const applyVisualTemplate = (course: CourseProject, template: VisualTemplate): CourseProject => {
  const staged: CourseProject = {
    ...course,
    theme: template.theme,
    settings: { ...course.settings, themeId: template.theme.id, visualTemplateId: template.id },
    homepage: course.homepage ? { ...course.homepage, templateId: template.homepageTemplateId } : course.homepage,
    syllabus: course.syllabus ? { ...course.syllabus, templateId: template.syllabusTemplateId } : course.syllabus
  };
  return applyThemeToGeneratedContent(staged, template.theme);
};

export const sampleProject = generateCourseProject({
  prompt:
    "Build me a 12-week undergraduate course on AI and Modern Society. It is a three-credit course with weekly modules, discussions, short quizzes, a final project, and a clean modern theme.",
  settings: defaultSettings
});
