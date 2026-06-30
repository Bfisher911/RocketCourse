import type { Assignment, AssignmentGroup, ContactHourPlan, CourseOutcome, Discussion, Quiz, SyllabusContent, SyllabusState, Theme } from "../types";
import { bestTextOn } from "../utils/color";
import { webResourceHref, wikiPageRef, WELL_KNOWN_PAGE_IDS } from "./canvasLinks";
import { buildThemedStatBand, buildThemedTimeline } from "./themeDesign";

// Package-relative file links are migrated by Canvas into real file URLs on import.
export const PRINTABLE_HTML_HREF = webResourceHref("syllabus-printable.html");
export const PRINTABLE_PDF_HREF = webResourceHref("syllabus-printable.pdf");
export const CALENDAR_HREF = wikiPageRef(WELL_KNOWN_PAGE_IDS.calendar);

export interface SyllabusTemplateMeta {
  id: string;
  name: string;
  tagline: string;
  description: string;
  bestFor: string;
}

export const SYLLABUS_TEMPLATES: SyllabusTemplateMeta[] = [
  {
    id: "standard-university",
    name: "Standard University Syllabus",
    tagline: "Classic academic structure",
    description: "A clean policy-complete syllabus with outcomes, schedule, grading, materials, communication, and support sections.",
    bestFor: "Most academic courses and traditional Canvas shells."
  },
  {
    id: "online-course",
    name: "Online Course Syllabus",
    tagline: "Asynchronous pacing",
    description: "Adds online participation, technology expectations, communication rhythm, and self-paced weekly guidance.",
    bestFor: "Online asynchronous and mostly-online courses."
  },
  {
    id: "hybrid-course",
    name: "Hybrid Course Syllabus",
    tagline: "In-person plus online",
    description: "Clarifies meeting rhythm, online/in-person expectations, attendance guidance, and Canvas workflow.",
    bestFor: "Hybrid, blended, lab, and meeting-pattern courses."
  },
  {
    id: "project-based",
    name: "Project-Based Course Syllabus",
    tagline: "Milestones and deliverables",
    description: "Highlights project milestones, deliverables, peer review, grading criteria, and final synthesis.",
    bestFor: "Capstone, studio, portfolio, lab, and applied project courses."
  },
  {
    id: "compressed-term",
    name: "Compressed Term Syllabus",
    tagline: "Short course clarity",
    description: "Emphasizes pacing, workload, make-up planning, deadlines, and fast feedback loops.",
    bestFor: "Summer, intersession, bootcamp, maymester, and short-format courses."
  },
  {
    id: "accreditation-friendly",
    name: "Accreditation-Friendly Syllabus",
    tagline: "Alignment and evidence",
    description: "Emphasizes outcomes, contact hours, assessment alignment, workload, policy completeness, and review notes.",
    bestFor: "Program review, accreditation preparation, and compliance-sensitive courses."
  }
];

export const DEFAULT_SYLLABUS_TEMPLATE_ID = "standard-university";

export interface SyllabusContext {
  title: string;
  description: string;
  modality: string;
  level: string;
  creditHours: number;
  lengthWeeks: number;
  moduleCount: number;
  organizationLabel: string;
  finalProject: boolean;
  finalProjectType: string;
  outcomes: CourseOutcome[];
  assignmentGroups: AssignmentGroup[];
  assignments: Assignment[];
  discussions: Discussion[];
  quizzes: Quiz[];
  contactHours: ContactHourPlan;
  scheduleRows: string[];
}

export type SyllabusReviseAction =
  | "tighten-language"
  | "add-examples"
  | "accessibility"
  | "grading-clarity"
  | "workload-clarity"
  | "ai-policy"
  | "support-resources"
  | "instructor-notes"
  | "accreditation-details"
  | "placeholder-notes";

export interface SyllabusReviseMeta {
  id: SyllabusReviseAction;
  label: string;
  hint: string;
}

export const SYLLABUS_REVISE_ACTIONS: SyllabusReviseMeta[] = [
  { id: "tighten-language", label: "Tighten language", hint: "Shorten dense policy wording without removing required sections." },
  { id: "add-examples", label: "Add examples", hint: "Add concrete student-facing examples to assignments and weekly pacing." },
  { id: "accessibility", label: "Improve accessibility", hint: "Strengthen accommodations, readable formatting, links, and media expectations." },
  { id: "grading-clarity", label: "Clarify grading", hint: "Make gradebook categories and rubrics easier for students to interpret." },
  { id: "workload-clarity", label: "Clarify workload", hint: "Explain expected hours, pacing, and contact-hour assumptions." },
  { id: "ai-policy", label: "Add AI policy", hint: "Add editable AI-use expectations without inventing local rules." },
  { id: "support-resources", label: "Add support resources", hint: "Add instructor-editable support and help-seeking guidance." },
  { id: "instructor-notes", label: "Add review notes", hint: "Add instructor-only reminders for local policies and materials." },
  { id: "accreditation-details", label: "Accreditation-ready", hint: "Strengthen outcomes, contact hours, assessment alignment, and evidence language." },
  { id: "placeholder-notes", label: "Convert placeholders", hint: "Make placeholder areas obvious and editable rather than final-sounding." }
];

const escHtml = (value: string): string => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (value: string): string => escHtml(value).replace(/"/g, "&quot;");

const sentence = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
};

export const safeSyllabusHref = (target: string): string => {
  const trimmed = String(target ?? "").trim();
  if (!trimmed) return "#";
  if (/^(javascript|vbscript):/i.test(trimmed)) return "#";
  if (/^data:/i.test(trimmed) && !/^data:image\//i.test(trimmed)) return "#";
  return trimmed;
};

const wrapper = (inner: string): string =>
  `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #1f2937; line-height: 1.58; max-width: 980px; margin: 0 auto;">${inner}</div>`;

const list = (items: string[], ordered = false): string => {
  const tag = ordered ? "ol" : "ul";
  const filtered = items.filter((item) => item.trim().length > 0);
  return `<${tag} style="margin: 10px 0 0; padding-left: 22px;">${filtered.map((item) => `<li style="margin: 7px 0;">${escHtml(item)}</li>`).join("")}</${tag}>`;
};

const themedSection = (title: string, body: string, theme: Theme): string =>
  `<section style="margin: 18px 0; padding: 20px; background: #ffffff; border: 1px solid #dbe4f0; border-left: 5px solid ${theme.accent}; border-radius: 10px;">
    <h2 style="margin: 0 0 10px; color: ${theme.accentDark}; font-size: 22px;">${escHtml(title)}</h2>
    ${body}
  </section>`;

const compactSection = (title: string, body: string, theme: Theme): string =>
  `<section style="margin: 16px 0; padding: 18px; background: ${theme.soft}; border: 1px solid #dbe4f0; border-radius: 10px;">
    <h2 style="margin: 0 0 8px; color: ${theme.accentDark}; font-size: 20px;">${escHtml(title)}</h2>
    ${body}
  </section>`;

const paragraph = (value: string): string => `<p style="margin: 0 0 10px; color: #374151;">${escHtml(value)}</p>`;

const linkButton = (label: string, href: string, theme: Theme): string =>
  `<a href="${escAttr(safeSyllabusHref(href))}" style="display: inline-block; margin: 6px 10px 6px 0; padding: 10px 15px; border-radius: 7px; background: ${theme.accent}; color: ${bestTextOn(theme.accent)}; text-decoration: none; font-weight: 700;">${escHtml(label)}</a>`;

const outlineButton = (label: string, href: string, theme: Theme): string =>
  `<a href="${escAttr(safeSyllabusHref(href))}" style="display: inline-block; margin: 6px 10px 6px 0; padding: 9px 14px; border-radius: 7px; background: #ffffff; color: ${theme.accentDark}; border: 1px solid ${theme.accent}; text-decoration: none; font-weight: 700;">${escHtml(label)}</a>`;

const syllabusSnapshot = (content: SyllabusContent, theme: Theme): string =>
  buildThemedStatBand(theme, [
    { value: String(content.learningOutcomes.length), label: "Outcomes", sub: "Course goals" },
    { value: String(content.gradingBreakdown.length), label: "Grade Groups", sub: "Assessment mix" },
    { value: String(content.weeklySchedule.length), label: "Schedule", sub: "Pacing lines" },
    { value: String(content.studentSupportResources.length), label: "Support", sub: "Help routes" }
  ]);

const scheduleTimeline = (content: SyllabusContent, theme: Theme): string =>
  buildThemedTimeline(
    theme,
    content.weeklySchedule.slice(0, 6).map((row, index) => {
      const [first, ...rest] = row.split(":");
      const label = first && first.length <= 36 ? first : `Schedule item ${index + 1}`;
      const body = rest.length ? rest.join(":").trim() : row;
      return { label, body };
    })
  );

const gradingVisual = (content: SyllabusContent, theme: Theme): string => {
  const rows = content.gradingBreakdown.map((item) => {
    const match = item.match(/(.+?):\s*(\d+(?:\.\d+)?)%/);
    const label = match?.[1]?.trim() || item;
    const value = Math.max(0, Math.min(100, Number(match?.[2] ?? 0)));
    return `<div style="margin: 0 0 12px;">
      <div style="font-weight: 700; color: ${theme.accentDark}; margin: 0 0 5px;">${escHtml(label)}${value ? ` <span style="color: #374151; font-weight: 600;">${value}%</span>` : ""}</div>
      <div style="height: 12px; border-radius: 999px; background: #e5e7eb; overflow: hidden;">
        <div style="width: ${value || 12}%; height: 12px; background: linear-gradient(90deg, ${theme.accent}, ${theme.accentDark});"></div>
      </div>
    </div>`;
  });
  return `<div style="margin: 12px 0;">${rows.join("")}</div>`;
};

const hero = (content: SyllabusContent, theme: Theme, title = "Course Syllabus"): string =>
  `<header style="margin: 0 0 20px; padding: 28px; background: ${theme.soft}; border: 1px solid #dbe4f0; border-radius: 12px;">
    <h1 style="margin: 0 0 10px; color: #111827; font-size: 34px;">${escHtml(title)}</h1>
    <p style="margin: 0; color: #374151; font-size: 17px;">${escHtml(content.courseDescription)}</p>
    <p style="margin: 16px 0 0;">${linkButton("Open print-friendly syllabus", PRINTABLE_HTML_HREF, theme)}${outlineButton("Download simple PDF copy", PRINTABLE_PDF_HREF, theme)}</p>
    ${syllabusSnapshot(content, theme)}
  </header>`;

const coreSections = (content: SyllabusContent, theme: Theme): string => [
  themedSection("Course Info Card and Course Description", `${paragraph(content.courseDescription)}${syllabusSnapshot(content, theme)}`, theme),
  themedSection("Instructor Info Card: Instructor Contact and Availability", paragraph(content.instructorContactBlock), theme),
  themedSection("Course Learning Outcomes", list(content.learningOutcomes), theme),
  themedSection("Required and Optional Materials", list(content.requiredMaterials), theme),
  themedSection("Course Rhythm", `${paragraph(content.scheduleSummary)}${list(["Begin each module with the overview page.", "Use the weekly schedule and Canvas modules together.", "Check announcements and feedback before starting the next graded task.", "Ask for help early when timing, technology, or instructions become unclear."])}`, theme),
  themedSection("Weekly Schedule and Pacing", `${outlineButton("Open course calendar and workload plan", CALENDAR_HREF, theme)}${scheduleTimeline(content, theme)}${list(content.weeklySchedule)}`, theme),
  themedSection("Grading Breakdown Visual", `${gradingVisual(content, theme)}${list(content.gradingBreakdown)}`, theme),
  themedSection("Assignment Overview and How Grades Work", `${paragraph("Grades are organized by assignment groups, points, rubrics, and feedback. Students should review each rubric before submitting and check Canvas Grades after feedback is posted.")}${list(content.assignmentOverview)}`, theme),
  themedSection("Participation and Communication Expectations", paragraph(content.communicationExpectations), theme),
  themedSection("Technology Requirements and Technology Needed", paragraph(content.technologyRequirements), theme),
  themedSection("Late Work Policy at a Glance", paragraph(content.lateWorkPolicy), theme),
  themedSection("Accessibility and Accommodations / Inclusion", paragraph(content.accessibilityAccommodations), theme),
  themedSection("Student Success Path", list(["Start with the homepage and Start Here module.", "Read each module overview before opening graded work.", "Use rubrics and examples before submitting.", "Return to feedback and wrap-up pages before the next module.", "Contact the instructor or support office early when a barrier appears."]), theme),
  themedSection("Student Support Resources and Help", list(content.studentSupportResources), theme),
  themedSection("Academic Integrity Policy and AI Use Policy Guidance", `${paragraph(content.academicIntegrityPolicy)}${paragraph(content.aiUsePolicy)}`, theme),
  themedSection("Workload and Contact Hours", paragraph(content.workloadContactHours), theme)
].join("");

const reviewNotes = (content: SyllabusContent, theme: Theme): string =>
  content.instructorReviewNotes.length
    ? compactSection("Instructor Review Notes", `${paragraph("Before publishing, review these editable syllabus areas.")}${list(content.instructorReviewNotes)}`, theme)
    : "";

const standardUniversity = (content: SyllabusContent, theme: Theme): string => wrapper(`${hero(content, theme)}${coreSections(content, theme)}${reviewNotes(content, theme)}`);

const onlineCourse = (content: SyllabusContent, theme: Theme): string =>
  wrapper(
    `${hero(content, theme, "Online Course Syllabus")}
    ${compactSection("How This Online Course Works", `${paragraph("Most course activity happens in Canvas. Plan to check announcements, modules, discussions, grades, and feedback several times each week.")}${list(["Begin each module with the overview page.", "Complete readings and media before discussion or quiz work.", "Use the calendar and workload plan to manage asynchronous pacing.", "Contact the instructor early when technology or workload becomes a barrier."])}`, theme)}
    ${coreSections(content, theme)}
    ${reviewNotes(content, theme)}`
  );

const hybridCourse = (content: SyllabusContent, theme: Theme): string =>
  wrapper(
    `${hero(content, theme, "Hybrid Course Syllabus")}
    ${compactSection("Hybrid Meeting Rhythm", `${paragraph("This syllabus separates what happens in Canvas from what should happen during scheduled meetings. The instructor should update meeting days, room, attendance expectations, and lab or field requirements before publishing.")}${list(["Use Canvas modules for preparation, submission, feedback, and make-up guidance.", "Use scheduled meetings for practice, discussion, lab, fieldwork, or applied collaboration.", "Check Canvas after every meeting for follow-up notes and deadlines."])}`, theme)}
    ${coreSections(content, theme)}
    ${reviewNotes(content, theme)}`
  );

const projectBased = (content: SyllabusContent, theme: Theme): string =>
  wrapper(
    `${hero(content, theme, "Project-Based Course Syllabus")}
    ${compactSection("Project Milestones", `${paragraph("Major assignments and weekly work build toward the final synthesis. Use the milestones below to keep the project moving.")}${list(content.assignmentOverview, true)}`, theme)}
    ${coreSections(content, theme)}
    ${reviewNotes(content, theme)}`
  );

const compressedTerm = (content: SyllabusContent, theme: Theme): string =>
  wrapper(
    `${hero(content, theme, "Compressed Term Syllabus")}
    ${compactSection("Compressed Course Pace", `${paragraph("This course moves quickly. Missing one module can affect the next several assignments, so students should plan work blocks early and communicate before deadlines.")}${list(["Check Canvas daily during the term.", "Start graded work before the deadline day.", "Use support resources as soon as a barrier appears.", "Ask the instructor how make-up work is handled in the compressed format."])}`, theme)}
    ${coreSections(content, theme)}
    ${reviewNotes(content, theme)}`
  );

const accreditationFriendly = (content: SyllabusContent, theme: Theme): string =>
  wrapper(
    `${hero(content, theme, "Accreditation-Friendly Syllabus")}
    ${compactSection("Alignment Evidence", `${paragraph("This version foregrounds outcomes, assessment categories, contact-hour logic, and instructor review notes so the syllabus can support program review.")}${list(["Confirm outcomes match the official course record.", "Confirm grading categories match the approved assessment plan.", "Confirm contact-hour assumptions match local policy.", "Keep instructor review notes unpublished or remove them before student publication when appropriate."])}`, theme)}
    ${coreSections(content, theme)}
    ${reviewNotes(content, theme)}`
  );

const RENDERERS: Record<string, (content: SyllabusContent, theme: Theme) => string> = {
  "standard-university": standardUniversity,
  "online-course": onlineCourse,
  "hybrid-course": hybridCourse,
  "project-based": projectBased,
  "compressed-term": compressedTerm,
  "accreditation-friendly": accreditationFriendly
};

export const isKnownSyllabusTemplate = (id: string): boolean => SYLLABUS_TEMPLATES.some((template) => template.id === id);

export const syllabusTemplateMeta = (id: string): SyllabusTemplateMeta =>
  SYLLABUS_TEMPLATES.find((template) => template.id === id) ?? SYLLABUS_TEMPLATES[0];

export const renderSyllabus = (templateId: string, content: SyllabusContent, theme: Theme): string => {
  const renderer = RENDERERS[templateId] ?? RENDERERS[DEFAULT_SYLLABUS_TEMPLATE_ID];
  return renderer(content, theme).trim();
};

const scheduleLabel = (context: SyllabusContext, row: string, index: number): string => {
  const clean = row.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  return clean || `${context.organizationLabel || "Module"} ${index + 1}: instructor will add schedule details.`;
};

const subjectLabel = (context: Pick<SyllabusContext, "title">): string => {
  const cleaned = context.title
    .replace(/\b(introduction to|intro to|principles of|foundations of|survey of)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || context.title || "the course subject";
};

const finalProjectLabel = (context: Pick<SyllabusContext, "finalProjectType">): string =>
  context.finalProjectType.replace(/-/g, " ").replace(/\s+/g, " ").trim() || "final synthesis";

const courseDescriptionFor = (context: SyllabusContext): string => {
  const base = sentence(context.description);
  const subject = subjectLabel(context);
  const level = context.level ? `${context.level.toLowerCase()} ` : "";
  const project = context.finalProject ? ` and culminates in a ${finalProjectLabel(context)}` : "";
  const opening =
    base ||
    `${context.title} is a ${level}course that helps students build a working command of ${subject} through evidence, practice, feedback, and reflection.`;
  return [
    opening,
    `Students will move beyond memorizing terms by using module briefings, resource pages, discussions, knowledge checks, and applied assignments to explain how the central ideas of ${subject} work in real situations.`,
    `The course is designed as a guided path: each module starts with a clear question, introduces key concepts, asks students to practice with examples or cases, and closes with an action step that prepares them for the next module${project}.`,
    "A successful student will leave with usable vocabulary, stronger evidence habits, clearer communication, and a portfolio of work that shows what they can analyze, explain, create, or recommend."
  ].join(" ");
};

const assignmentGroupExplanation = (group: AssignmentGroup, context: SyllabusContext): string => {
  const name = group.name.trim();
  const lower = name.toLowerCase();
  const weight = `${group.weight}%`;
  const subject = subjectLabel(context);
  if (/discussion|participation|engagement/.test(lower)) {
    return `${name}: ${weight}. This category grades active course conversation: prepared first posts, evidence-based replies, respectful disagreement, and the habit of connecting classmates' ideas back to ${subject}.`;
  }
  if (/quiz|knowledge|check/.test(lower)) {
    return `${name}: ${weight}. These low-to-moderate stakes checks help students confirm vocabulary, concepts, examples, and module readiness before larger assignments.`;
  }
  if (/project|portfolio|capstone|final/.test(lower)) {
    return `${name}: ${weight}. Project work asks students to synthesize course evidence into a polished product, recommendation, analysis, or portfolio artifact.`;
  }
  if (/assignment|application|applied|lab|field|studio|brief|case/.test(lower)) {
    return `${name}: ${weight}. Applied work turns the module material into a concrete deliverable, such as a brief, analysis, case response, design, reflection, problem set, or evidence-based recommendation.`;
  }
  return `${name}: ${weight}. This category supports the course goals through rubric-aligned work, feedback, and revision habits.`;
};

const assignmentHighlights = (context: SyllabusContext): string[] =>
  context.assignments.slice(0, 8).map((assignment) => {
    const outcomeCodes = assignment.alignedOutcomeIds.length
      ? ` Alignment: ${assignment.alignedOutcomeIds.length} course outcome${assignment.alignedOutcomeIds.length === 1 ? "" : "s"}.`
      : "";
    return `${assignment.title}: ${assignment.points} points, estimated ${assignment.estimatedHours} hours. Students should read the prompt, review the rubric, complete the listed deliverables, and submit through Canvas.${outcomeCodes}`;
  });

export const syllabusContextFromCourse = (course: {
  title: string;
  description: string;
  settings: {
    modality: string;
    level: string;
    creditHours: number;
    lengthWeeks: number;
    moduleCount: number;
    organizationPattern: string;
    customOrganizationLabel: string;
    finalProject: boolean;
    finalProjectType: string;
  };
  outcomes: CourseOutcome[];
  assignmentGroups: AssignmentGroup[];
  assignments: Assignment[];
  discussions: Discussion[];
  quizzes: Quiz[];
  contactHours: ContactHourPlan;
  schedule: { title: string; itemType: string; workloadHours: number; notes: string }[];
}): SyllabusContext => ({
  title: course.title,
  description: course.description,
  modality: course.settings.modality,
  level: course.settings.level,
  creditHours: course.settings.creditHours,
  lengthWeeks: course.settings.lengthWeeks,
  moduleCount: course.settings.moduleCount,
  organizationLabel: course.settings.organizationPattern === "custom" ? course.settings.customOrganizationLabel : course.settings.organizationPattern,
  finalProject: course.settings.finalProject,
  finalProjectType: course.settings.finalProjectType,
  outcomes: course.outcomes,
  assignmentGroups: course.assignmentGroups,
  assignments: course.assignments,
  discussions: course.discussions,
  quizzes: course.quizzes,
  contactHours: course.contactHours,
  scheduleRows: course.schedule
    .filter((entry) => entry.itemType === "module")
    .slice(0, Math.max(1, course.settings.moduleCount))
    .map((entry, index) => `${entry.title}: ${entry.notes || `Plan approximately ${entry.workloadHours} hours.` || `Module ${index + 1}.`}`)
});

export const defaultSyllabusContent = (context: SyllabusContext): SyllabusContent => {
  const gradedAssignments = assignmentHighlights(context);
  const discussionCount = context.discussions.filter((discussion) => discussion.points > 0).length;
  const quizCount = context.quizzes.length;
  const modality = context.modality || "course";
  const subject = subjectLabel(context);
  return {
    courseDescription: courseDescriptionFor(context),
    learningOutcomes: context.outcomes.map((outcome) => `${outcome.code}: ${outcome.text} (${outcome.bloomLevel})`),
    requiredMaterials: [
      "Course materials are organized inside the Canvas modules. Use the module overview, resource page, linked readings, media, source packets, examples, datasets, templates, or instructor-added files as the authoritative weekly evidence base.",
      "Each module identifies what to read, watch, review, or practice before discussions, quizzes, and assignments. Complete those materials before opening graded work.",
      "If your section uses a required textbook, library article, primary source packet, lab tool, or media collection, the instructor will place the exact link or file in the matching module resource page."
    ],
    scheduleSummary: `${context.title} is planned as a ${context.creditHours}-credit ${modality.toLowerCase()} course over ${context.lengthWeeks} weeks with ${context.moduleCount} instructional modules. Expect a repeating rhythm of overview, course materials, practice, discussion or knowledge check, applied assignment work, and feedback review.`,
    weeklySchedule: context.scheduleRows.length
      ? context.scheduleRows.map((row, index) => scheduleLabel(context, row, index))
      : [`Module 1: begin with the Start Here module, review the course workflow, and complete the first ${subject} orientation activity.`],
    gradingBreakdown: context.assignmentGroups.map((group) => assignmentGroupExplanation(group, context)),
    assignmentOverview: [
      ...context.assignmentGroups.map((group) => assignmentGroupExplanation(group, context)),
      ...gradedAssignments,
      discussionCount
        ? `Graded discussions: ${discussionCount} discussion activity/activities. A strong discussion post makes a claim, uses course evidence, names a specific example, and replies to classmates in a way that advances the conversation.`
        : "Discussions are used for practice, interaction, and instructor-selected participation when they fit the module goals.",
      quizCount
        ? `Knowledge checks: ${quizCount} quiz or quiz set(s). Use quiz feedback to identify terms, examples, or concepts to revisit before larger assignments.`
        : "Knowledge checks may be added by the instructor when quick concept feedback would help students prepare for applied work.",
      context.finalProject
        ? `Final ${finalProjectLabel(context)}: a cumulative synthesis that asks students to connect multiple modules, use course evidence, meet rubric criteria, and explain the significance of their work.`
        : "Final assessment: students will complete the designated closing assessment, reflection, or synthesis activity selected for this section."
    ],
    communicationExpectations:
      "Students are expected to monitor Canvas announcements, read module overview pages before asking logistics questions, participate respectfully, ask specific questions, and contact the instructor when barriers arise. The instructor will confirm response-time expectations, office hours, and the preferred contact method for this section.",
    lateWorkPolicy:
      "Submit work through Canvas by the posted deadline whenever possible. If illness, caregiving, technology, work, travel, or another serious barrier affects your timeline, contact the instructor before the deadline with the assignment name, what is complete, and a realistic completion plan. The instructor will confirm any local grace periods, extension rules, and work that cannot be made up.",
    academicIntegrityPolicy:
      "Students are responsible for submitting original work, representing sources accurately, and following institutional academic integrity expectations. Course work should show the student's own reasoning, evidence choices, analysis, and writing unless collaboration or tool use is explicitly allowed.",
    aiUsePolicy:
      "AI tools may be useful for brainstorming, outlining, checking grammar, or testing study questions when the instructor permits that use. They may not replace required reading, evidence analysis, citation work, reflection, or original judgment. When AI assistance is allowed, students should disclose meaningful use, verify all claims against course sources, avoid entering private or sensitive information, and remain responsible for submitted work.",
    accessibilityAccommodations:
      "Students who need accommodations should contact the appropriate campus office and the instructor as early as possible. Course materials should use headings, descriptive links, readable files, captions/transcripts for media, and alternative formats where practical.",
    studentSupportResources: [
      "Use Canvas help or campus technology support for login, file, browser, upload, or access issues.",
      "Ask course-content questions in the instructor-designated channel so answers can help the whole class when appropriate.",
      "Use library support for research, source access, citation help, and evaluating evidence.",
      "Use tutoring, writing, advising, accessibility, counseling, or student success services before a small issue becomes urgent. The instructor should add local office names and links."
    ],
    instructorContactBlock:
      "Instructor contact information, office hours, preferred contact method, and response-time expectations should be confirmed in Canvas before the course opens. Students should use the stated channel, include the course and assignment name when asking for help, and follow up early when a problem affects participation or deadlines.",
    workloadContactHours:
      context.contactHours.totalHours > 0
        ? `${context.contactHours.justification} Planned hours include ${context.contactHours.instructionalTime} instructional, ${context.contactHours.readingMediaTime} reading/media, ${context.contactHours.assignmentTime} assignment, ${context.contactHours.discussionTime} discussion, ${context.contactHours.quizStudyTime} quiz/study, and ${context.contactHours.finalProjectTime} final project hours.`
        : `Students should plan regular weekly work blocks for reading or viewing course material, practicing with examples, joining discussions, completing assignments, reviewing feedback, and preparing for assessments in ${subject}.`,
    technologyRequirements:
      "Students need reliable Canvas access, a current browser, the ability to open common document formats, and a way to submit files or text entries. If the course requires specialized software, media tools, lab platforms, proctoring, or field documentation, those requirements should appear in the relevant module before students need them.",
    instructorReviewNotes: [
      "Confirm local policy language, instructor contact details, term dates, required materials, and support office links before publishing.",
      "Verify required materials, links, due dates, support offices, and accessibility guidance.",
      "Confirm grading weights, assignment names, rubrics, and weekly schedule match the Canvas course."
    ]
  };
};

export const chooseSyllabusTemplate = (context: Pick<SyllabusContext, "modality" | "lengthWeeks" | "finalProject">): string => {
  const modality = context.modality.toLowerCase();
  if (context.lengthWeeks <= 6) return "compressed-term";
  if (modality.includes("hybrid") || modality.includes("blended")) return "hybrid-course";
  if (modality.includes("online") || modality.includes("async")) return "online-course";
  if (context.finalProject) return "project-based";
  return DEFAULT_SYLLABUS_TEMPLATE_ID;
};

export const createSyllabusState = (content: SyllabusContent, templateId: string, themeId: string, updatedAt: string): SyllabusState => ({
  mode: "builder",
  templateId: isKnownSyllabusTemplate(templateId) ? templateId : DEFAULT_SYLLABUS_TEMPLATE_ID,
  content,
  themeId,
  updatedAt,
  snapshots: []
});

export const rethemeSyllabusHtml = (state: SyllabusState | undefined, theme: Theme): string | null => {
  if (!state || state.mode !== "builder") return null;
  return renderSyllabus(state.templateId, state.content, theme);
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

const tighten = (value: string): string => {
  const first = value.trim().match(/^[^.!?]*[.!?]/)?.[0]?.trim();
  return first && first.length > 30 ? first : value.trim();
};

export const reviseSyllabusContent = (action: SyllabusReviseAction, content: SyllabusContent, context: SyllabusContext): SyllabusContent => {
  switch (action) {
    case "tighten-language":
      return {
        ...content,
        communicationExpectations: tighten(content.communicationExpectations),
        lateWorkPolicy: tighten(content.lateWorkPolicy),
        accessibilityAccommodations: tighten(content.accessibilityAccommodations)
      };
    case "add-examples":
      return {
        ...content,
        assignmentOverview: dedupe([
          ...content.assignmentOverview,
          `Example workflow: review the module overview, collect evidence, draft the deliverable, compare it to the rubric, and submit in Canvas.`,
          context.finalProject ? `Final project example: use one module artifact as evidence or a milestone for the final ${context.finalProjectType.replace("-", " ")}.` : "Example: connect weekly practice work to a later assignment."
        ])
      };
    case "accessibility":
      return {
        ...content,
        accessibilityAccommodations:
          "Students who need accommodations should contact the appropriate campus office and the instructor as early as possible. Course pages should use headings, descriptive links, alt text for images, captions or transcripts for media, readable files, and no color-only instructions.",
        technologyRequirements:
          `${content.technologyRequirements} Instructor should verify that required tools are keyboard-accessible where possible and provide alternatives when a required technology creates an access barrier.`
      };
    case "grading-clarity":
      return {
        ...content,
        gradingBreakdown: dedupe([...content.gradingBreakdown, "Before submitting graded work, students should review the rubric and confirm each required deliverable is included."]),
        assignmentOverview: dedupe([...content.assignmentOverview, "Rubrics explain criteria, performance levels, and point values for major graded work."])
      };
    case "workload-clarity":
      return {
        ...content,
        workloadContactHours: `${content.workloadContactHours} Students should plan regular weekly work blocks rather than saving all work for the deadline day.`
      };
    case "ai-policy":
      return {
        ...content,
        aiUsePolicy:
          "Instructor should add the official AI-use policy for this course. If AI tools are permitted, students must disclose meaningful AI assistance, verify facts and citations, protect private data, and remain responsible for the accuracy and originality of submitted work."
      };
    case "support-resources":
      return {
        ...content,
        studentSupportResources: dedupe([
          ...content.studentSupportResources,
          "Use library support for research, citations, database access, and source evaluation.",
          "Use tutoring, writing, advising, or student success services before a small issue becomes urgent."
        ])
      };
    case "instructor-notes":
      return {
        ...content,
        instructorReviewNotes: dedupe([
          ...content.instructorReviewNotes,
          "Add instructor name, office hours, contact rules, and response-time expectations.",
          "Verify that the printable copy link works after export/import.",
          "Remove or revise instructor-only notes before publishing to students if needed."
        ])
      };
    case "accreditation-details":
      return {
        ...content,
        workloadContactHours: `${content.workloadContactHours} Instructor should verify these assumptions against local credit-hour and contact-hour policy before publication.`,
        instructorReviewNotes: dedupe([...content.instructorReviewNotes, "Confirm that outcomes, assessments, grading weights, and contact-hour language match official program or accreditation records."])
      };
    case "placeholder-notes":
      return {
        ...content,
        requiredMaterials: content.requiredMaterials.map((item) => (/(instructor|add|required|placeholder)/i.test(item) ? item : `Instructor-editable placeholder: ${item}`)),
        instructorReviewNotes: dedupe([...content.instructorReviewNotes, "Any section that depends on local policy, required materials, or support offices should remain clearly marked until verified."])
      };
    default:
      return content;
  }
};
