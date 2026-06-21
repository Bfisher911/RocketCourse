import type { Assignment, AssignmentGroup, ContactHourPlan, CourseOutcome, Discussion, Quiz, SyllabusContent, SyllabusState, Theme } from "../types";
import { bestTextOn } from "../utils/color";

export const PRINTABLE_HTML_HREF = "../web_resources/syllabus-printable.html";
export const PRINTABLE_PDF_HREF = "../web_resources/syllabus-printable.pdf";
export const CALENDAR_HREF = "course-calendar-and-workload-plan.html";

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

const hero = (content: SyllabusContent, theme: Theme, title = "Course Syllabus"): string =>
  `<header style="margin: 0 0 20px; padding: 28px; background: ${theme.soft}; border: 1px solid #dbe4f0; border-radius: 12px;">
    <h1 style="margin: 0 0 10px; color: #111827; font-size: 34px;">${escHtml(title)}</h1>
    <p style="margin: 0; color: #374151; font-size: 17px;">${escHtml(content.courseDescription)}</p>
    <p style="margin: 16px 0 0;">${linkButton("Open print-friendly syllabus", PRINTABLE_HTML_HREF, theme)}${outlineButton("Download simple PDF copy", PRINTABLE_PDF_HREF, theme)}</p>
  </header>`;

const coreSections = (content: SyllabusContent, theme: Theme): string => [
  themedSection("Course Description", paragraph(content.courseDescription), theme),
  themedSection("Course Learning Outcomes", list(content.learningOutcomes), theme),
  themedSection("Required and Optional Materials", list(content.requiredMaterials), theme),
  themedSection("Weekly Schedule and Pacing", `${paragraph(content.scheduleSummary)}${outlineButton("Open course calendar and workload plan", CALENDAR_HREF, theme)}${list(content.weeklySchedule)}`, theme),
  themedSection("Grading Breakdown", list(content.gradingBreakdown), theme),
  themedSection("Assignment Overview", list(content.assignmentOverview), theme),
  themedSection("Participation and Communication", paragraph(content.communicationExpectations), theme),
  themedSection("Late Work Policy", paragraph(content.lateWorkPolicy), theme),
  themedSection("Academic Integrity Policy", paragraph(content.academicIntegrityPolicy), theme),
  themedSection("AI Use Policy", paragraph(content.aiUsePolicy), theme),
  themedSection("Accessibility and Accommodations", paragraph(content.accessibilityAccommodations), theme),
  themedSection("Technology Requirements", paragraph(content.technologyRequirements), theme),
  themedSection("Student Support Resources", list(content.studentSupportResources), theme),
  themedSection("Instructor Contact and Availability", paragraph(content.instructorContactBlock), theme),
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
  const gradedAssignments = context.assignments.slice(0, 8).map((assignment) => `${assignment.title}: ${assignment.points} points, estimated ${assignment.estimatedHours} hours.`);
  const discussionCount = context.discussions.filter((discussion) => discussion.points > 0).length;
  const quizCount = context.quizzes.length;
  const modality = context.modality || "course";
  return {
    courseDescription:
      sentence(context.description) ||
      `${context.title} is a ${context.level || "course"} organized around clear modules, applied work, feedback, and a final synthesis.`,
    learningOutcomes: context.outcomes.map((outcome) => `${outcome.code}: ${outcome.text} (${outcome.bloomLevel})`),
    requiredMaterials: [
      "Instructor will add required textbook chapters, OER sections, articles, videos, software, or open educational resources before publishing.",
      "Module resource pages identify where verified readings, media, datasets, templates, or uploaded files should be added.",
      "Optional resources are marked clearly so students can prioritize required work."
    ],
    scheduleSummary: `${context.title} is planned as a ${context.creditHours}-credit ${modality.toLowerCase()} course over ${context.lengthWeeks} weeks with ${context.moduleCount} instructional modules. Dates should be checked against the official term calendar before publishing.`,
    weeklySchedule: context.scheduleRows.length ? context.scheduleRows.map((row, index) => scheduleLabel(context, row, index)) : ["Instructor will add official weekly dates and deadlines before publishing."],
    gradingBreakdown: context.assignmentGroups.map((group) => `${group.name}: ${group.weight}%`),
    assignmentOverview: [
      ...gradedAssignments,
      discussionCount ? `Graded discussions: ${discussionCount} discussion activity/activities with clear initial post and reply expectations.` : "Discussions are used for practice, interaction, or instructor-selected participation.",
      quizCount ? `Knowledge checks: ${quizCount} quiz/quiz set(s) with answer feedback and outcome alignment.` : "Quizzes are not currently selected for this course.",
      context.finalProject ? `Final ${context.finalProjectType.replace("-", " ")}: a cumulative synthesis project with rubric-aligned deliverables.` : "Final assessment: instructor will confirm the final synthesis format."
    ],
    communicationExpectations:
      "Students are expected to monitor Canvas announcements, participate respectfully, ask specific questions, and contact the instructor when barriers arise. Instructor should add response-time expectations, office hours, and preferred contact method.",
    lateWorkPolicy:
      "Instructor should add institution-specific late work rules, grace periods, extension procedures, and assignment types that cannot be submitted late. Students should communicate before deadlines whenever possible.",
    academicIntegrityPolicy:
      "Students are responsible for submitting original work and following institutional academic integrity expectations. Instructor should insert the official institutional policy before publishing.",
    aiUsePolicy:
      "Instructor should add the official AI-use policy for this course. If AI tools are permitted, students should disclose use, verify all output against course sources, and remain responsible for submitted work.",
    accessibilityAccommodations:
      "Students who need accommodations should contact the appropriate campus office and the instructor as early as possible. Course materials should use headings, descriptive links, readable files, captions/transcripts for media, and alternative formats where practical.",
    studentSupportResources: [
      "Use Canvas help or campus support for technical access issues.",
      "Ask content questions in the instructor-designated channel.",
      "Contact advising, tutoring, library, accessibility, or student support offices when needed. Instructor should add local links before publishing."
    ],
    instructorContactBlock:
      "Instructor should add name, pronouns if desired, email, office hours, response-time expectations, preferred contact method, and any section-specific communication rules before publishing.",
    workloadContactHours:
      context.contactHours.totalHours > 0
        ? `${context.contactHours.justification} Planned hours include ${context.contactHours.instructionalTime} instructional, ${context.contactHours.readingMediaTime} reading/media, ${context.contactHours.assignmentTime} assignment, ${context.contactHours.discussionTime} discussion, ${context.contactHours.quizStudyTime} quiz/study, and ${context.contactHours.finalProjectTime} final project hours.`
        : "Instructor should add workload and contact-hour expectations before publishing.",
    technologyRequirements:
      "Students need reliable Canvas access, the ability to open common document formats, and any instructor-specified software. Instructor should add browser, device, proctoring, lab, or media requirements if applicable.",
    instructorReviewNotes: [
      "Replace all local policy placeholders with official institutional wording.",
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
