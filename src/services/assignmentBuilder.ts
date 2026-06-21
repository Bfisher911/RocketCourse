import type { Assignment, CourseModule, CourseOutcome, CourseProject, ModuleItem, ObjectMetadata, Rubric } from "../types";
import { nowIso, slugify, stripHtml } from "../utils/text";

export type AssignmentTemplateId =
  | "essay-paper"
  | "project-milestone"
  | "final-project"
  | "presentation"
  | "case-study"
  | "lab-field-activity"
  | "reflection"
  | "data-analysis"
  | "discussion-linked"
  | "portfolio-artifact";

export type AssignmentIssueSeverity = "error" | "warning";
export type AssignmentPlanStatus = "Ready" | "Needs review";
export type AssignmentReviseAction = "clarity" | "examples" | "deliverables" | "grading" | "accessibility" | "scenario" | "outcomes";

export interface AssignmentTemplate {
  id: AssignmentTemplateId;
  name: string;
  description: string;
  recommendedPoints: number;
  recommendedHours: number;
  submissionType: string;
}

export interface AssignmentIssue {
  id: string;
  assignmentId: string;
  severity: AssignmentIssueSeverity;
  title: string;
  detail: string;
}

export interface AssignmentSummary {
  assignmentId: string;
  status: AssignmentPlanStatus;
  issues: AssignmentIssue[];
}

export interface AssignmentPlanValidation {
  score: number;
  status: AssignmentPlanStatus;
  issues: AssignmentIssue[];
  summaries: AssignmentSummary[];
}

export const ASSIGNMENT_SUBMISSION_TYPES = [
  "Online upload or text entry",
  "online_upload",
  "online_text_entry",
  "online_url",
  "media_recording",
  "none"
] as const;

export const ASSIGNMENT_TEMPLATES: AssignmentTemplate[] = [
  {
    id: "essay-paper",
    name: "Essay or Paper",
    description: "A thesis-driven written assignment with evidence, structure, and revision expectations.",
    recommendedPoints: 60,
    recommendedHours: 5,
    submissionType: "Online upload or text entry"
  },
  {
    id: "project-milestone",
    name: "Project Milestone",
    description: "A checkpoint that moves students from idea to draft, prototype, or decision-ready artifact.",
    recommendedPoints: 40,
    recommendedHours: 4,
    submissionType: "Online upload or text entry"
  },
  {
    id: "final-project",
    name: "Final Project",
    description: "A culminating assignment that synthesizes outcomes, evidence, deliverables, and reflection.",
    recommendedPoints: 120,
    recommendedHours: 12,
    submissionType: "Online upload or text entry"
  },
  {
    id: "presentation",
    name: "Presentation",
    description: "A structured presentation assignment with audience, visual, speaking, and accessibility guidance.",
    recommendedPoints: 75,
    recommendedHours: 6,
    submissionType: "Online upload or text entry"
  },
  {
    id: "case-study",
    name: "Case Study",
    description: "A realistic case analysis that asks students to diagnose, weigh evidence, and recommend action.",
    recommendedPoints: 70,
    recommendedHours: 6,
    submissionType: "Online upload or text entry"
  },
  {
    id: "lab-field-activity",
    name: "Lab or Field Activity",
    description: "An observation, experiment, fieldwork, or practice-based activity with evidence logs.",
    recommendedPoints: 65,
    recommendedHours: 6,
    submissionType: "Online upload or text entry"
  },
  {
    id: "reflection",
    name: "Reflection",
    description: "A reflective assignment that connects experience, course concepts, evidence, and next steps.",
    recommendedPoints: 35,
    recommendedHours: 3,
    submissionType: "Online upload or text entry"
  },
  {
    id: "data-analysis",
    name: "Data Analysis",
    description: "An evidence-based analysis assignment using datasets, visuals, interpretation, and limitations.",
    recommendedPoints: 80,
    recommendedHours: 7,
    submissionType: "Online upload or text entry"
  },
  {
    id: "discussion-linked",
    name: "Discussion-Linked Assignment",
    description: "An assignment that grows from discussion ideas into a more polished applied deliverable.",
    recommendedPoints: 45,
    recommendedHours: 4,
    submissionType: "Online upload or text entry"
  },
  {
    id: "portfolio-artifact",
    name: "Portfolio Artifact",
    description: "A polished artifact students can revise, contextualize, and include in a learning portfolio.",
    recommendedPoints: 90,
    recommendedHours: 8,
    submissionType: "Online upload or text entry"
  }
];

export const ASSIGNMENT_REVISE_ACTIONS: Array<{ id: AssignmentReviseAction; label: string; description: string }> = [
  { id: "clarity", label: "Clarify", description: "Tighten directions and reduce ambiguity." },
  { id: "examples", label: "Add examples", description: "Add concrete success markers and sample moves." },
  { id: "deliverables", label: "Deliverables", description: "Make submission pieces explicit." },
  { id: "grading", label: "Grading clarity", description: "Add rubric and criteria language." },
  { id: "accessibility", label: "Accessibility", description: "Add accessible file, link, and media guidance." },
  { id: "scenario", label: "Scenario", description: "Add student-facing context and audience." },
  { id: "outcomes", label: "Outcomes", description: "Connect the assignment to selected outcomes." }
];

const escapeHtml = (value: string | number | undefined | null): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const paragraph = (value: string): string => `<p>${escapeHtml(value)}</p>`;

const list = (items: string[]): string => `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;

const section = (title: string, body: string): string => `<h2>${escapeHtml(title)}</h2>${body}`;

const touchedMetadata = (metadata: ObjectMetadata | undefined, timestamp: string): ObjectMetadata => ({
  createdAt: metadata?.createdAt ?? timestamp,
  updatedAt: timestamp,
  lastExportedAt: metadata?.lastExportedAt,
  exportVersion: metadata?.exportVersion ?? 0,
  source: "edited"
});

const renumberItems = (items: ModuleItem[]): ModuleItem[] => items.map((item, index) => ({ ...item, order: index + 1, status: "edited" }));

const templateById = (templateId: AssignmentTemplateId): AssignmentTemplate =>
  ASSIGNMENT_TEMPLATES.find((template) => template.id === templateId) ?? ASSIGNMENT_TEMPLATES[0];

const outcomeLabels = (outcomes: CourseOutcome[], alignedOutcomeIds: string[]): string[] => {
  const labels = alignedOutcomeIds
    .map((outcomeId) => outcomes.find((outcome) => outcome.id === outcomeId))
    .filter((outcome): outcome is CourseOutcome => Boolean(outcome))
    .map((outcome) => `${outcome.code}: ${outcome.text}`);
  return labels.length ? labels : ["Instructor will align this assignment to the appropriate course outcomes before publishing."];
};

const moduleTitleFor = (course: CourseProject, moduleId?: string): string =>
  course.modules.find((module) => module.id === moduleId)?.title ?? "the current module";

const assignmentThemeStyle = (course: CourseProject): string =>
  `border-left: 6px solid ${escapeHtml(course.theme.accent)}; background: ${escapeHtml(course.theme.soft)}; padding: 14px 16px; margin: 16px 0;`;

const templateDetails: Record<AssignmentTemplateId, { purpose: string; task: string; deliverables: string[]; steps: string[]; format: string[]; examples: string[]; grading: string[] }> = {
  "essay-paper": {
    purpose: "Build a focused argument that uses course evidence to explain, interpret, or evaluate a meaningful question.",
    task: "Write a thesis-driven paper for a reader who needs a clear claim, credible support, and a practical implication.",
    deliverables: ["A polished paper or equivalent document.", "A clear thesis or guiding claim.", "Evidence from assigned course materials.", "A short conclusion that names why the analysis matters."],
    steps: ["Choose a narrow question or problem.", "Draft a working thesis.", "Select evidence that directly supports the claim.", "Organize the paper with accessible headings.", "Revise for clarity, citation, and connection to outcomes."],
    format: ["Suggested length: 900-1400 words unless your instructor changes it.", "Use the citation style requested by your program.", "Use descriptive file names and readable headings."],
    examples: ["A strong paper explains why each source matters instead of dropping in quotations.", "A strong conclusion names a decision, implication, or next question."],
    grading: ["Argument and focus.", "Use of evidence.", "Organization and clarity.", "Connection to course outcomes."]
  },
  "project-milestone": {
    purpose: "Help you make visible progress on a larger project before the final deadline.",
    task: "Submit a checkpoint artifact that shows your current decision, evidence, plan, and open questions.",
    deliverables: ["A draft, prototype, outline, storyboard, annotated source list, or planning memo.", "A short progress note naming what changed.", "Two questions for instructor or peer feedback."],
    steps: ["Review the final project criteria.", "Name the milestone goal.", "Produce the draft artifact.", "Mark areas where feedback would help.", "Submit the artifact and progress note together."],
    format: ["Use the format that best fits the project stage.", "Label unfinished sections clearly.", "Include links or files students and the instructor can open."],
    examples: ["A strong milestone makes next steps visible.", "A strong progress note distinguishes completed work from planned work."],
    grading: ["Evidence of progress.", "Alignment with final project criteria.", "Specificity of next steps.", "Usefulness for feedback."]
  },
  "final-project": {
    purpose: "Demonstrate integrated learning across the course through a polished final artifact.",
    task: "Create a final project that addresses a meaningful problem, audience, or scenario using course concepts and evidence.",
    deliverables: ["Final artifact or product.", "Brief rationale explaining audience, purpose, and evidence.", "Reflection on learning and revision choices.", "Accessible files, links, or media as needed."],
    steps: ["Review outcomes and rubric criteria.", "Choose the problem, audience, and format.", "Gather evidence and examples.", "Draft and revise the artifact.", "Check accessibility and submit all required pieces."],
    format: ["Follow the final project format approved by the instructor.", "Use headings, captions, alt text, or transcripts where appropriate.", "Include citations or source notes."],
    examples: ["A strong final project makes its audience and decision point obvious.", "A strong rationale explains why the chosen evidence is credible."],
    grading: ["Synthesis of course outcomes.", "Quality of evidence.", "Audience fit.", "Professional polish and accessibility."]
  },
  presentation: {
    purpose: "Practice explaining course ideas to an audience with clear structure, evidence, and delivery choices.",
    task: "Prepare a concise presentation that teaches, persuades, or recommends action for a defined audience.",
    deliverables: ["Slide deck, outline, poster, recording, or speaker notes as assigned.", "A clear audience statement.", "Evidence and examples embedded in the presentation.", "Accessible visual and media materials."],
    steps: ["Name the audience and purpose.", "Build a short story arc.", "Choose visuals that support the message.", "Practice timing and transitions.", "Check captions, contrast, and readable text."],
    format: ["Use the instructor-approved length or time limit.", "Keep slide text concise.", "Provide notes, transcript, or captions when media is used."],
    examples: ["A strong presentation has one clear takeaway.", "A strong visual supports a point instead of decorating the slide."],
    grading: ["Organization.", "Evidence.", "Audience awareness.", "Visual and accessibility quality."]
  },
  "case-study": {
    purpose: "Apply course concepts to a realistic situation where evidence, stakeholders, and tradeoffs matter.",
    task: "Analyze a case, diagnose the main issue, compare options, and recommend a defensible action.",
    deliverables: ["Case summary.", "Stakeholder or context analysis.", "Evidence-based recommendation.", "Risk, tradeoff, or ethics note."],
    steps: ["Read the case carefully.", "Identify the central decision point.", "Apply relevant course concepts.", "Compare at least two possible responses.", "Recommend and justify the strongest option."],
    format: ["Use headings for context, analysis, recommendation, and reflection.", "Cite course sources or case evidence.", "Use tables only when they clarify comparison."],
    examples: ["A strong case analysis explains why one option is stronger than another.", "A strong recommendation names a likely consequence."],
    grading: ["Concept application.", "Evidence quality.", "Decision reasoning.", "Attention to stakeholders and tradeoffs."]
  },
  "lab-field-activity": {
    purpose: "Use observation, practice, experimentation, or fieldwork to connect course concepts to evidence.",
    task: "Complete the activity, document what happened, interpret the evidence, and connect it to the module outcomes.",
    deliverables: ["Observation notes, data, field log, or activity record.", "Brief analysis of findings.", "Reflection on limitations or next steps.", "Required images, files, or media with accessibility support."],
    steps: ["Review safety, ethics, and access expectations.", "Complete the activity as directed.", "Record evidence while it is fresh.", "Analyze patterns or surprises.", "Submit the activity record and interpretation."],
    format: ["Use the provided lab or field template if one exists.", "Label units, dates, locations, or conditions when relevant.", "Do not include private or sensitive information unless explicitly approved."],
    examples: ["A strong field note separates observation from interpretation.", "A strong analysis names what the evidence can and cannot show."],
    grading: ["Completion of activity.", "Quality of documentation.", "Interpretation.", "Safety, ethics, and accessibility."]
  },
  reflection: {
    purpose: "Help you connect personal learning, course concepts, feedback, and future action.",
    task: "Write a structured reflection that names what you learned, how your thinking changed, and what you will do next.",
    deliverables: ["A reflective response.", "At least one specific course concept.", "One example from your work or experience.", "One next step or question."],
    steps: ["Choose a learning moment.", "Describe the evidence or experience.", "Connect it to a course concept.", "Explain what changed in your understanding.", "Name a future action."],
    format: ["Suggested length: 400-700 words unless changed by the instructor.", "Use first person when appropriate.", "Protect privacy when discussing real people or workplaces."],
    examples: ["A strong reflection uses a specific moment rather than a broad summary.", "A strong next step is concrete and doable."],
    grading: ["Specificity.", "Concept connection.", "Depth of reflection.", "Future-facing action."]
  },
  "data-analysis": {
    purpose: "Use data or evidence to answer a question and communicate an interpretation responsibly.",
    task: "Analyze a dataset, table, source set, or evidence sample and explain what the results suggest.",
    deliverables: ["Research or analysis question.", "Cleaned or summarized evidence.", "Table, chart, calculation, or coded analysis as appropriate.", "Interpretation and limitation statement."],
    steps: ["Define the question.", "Inspect and prepare the data.", "Run the required analysis.", "Create a clear table or visual.", "Explain findings and limitations."],
    format: ["Include source notes and units.", "Use readable labels for tables and charts.", "Submit files in instructor-approved formats."],
    examples: ["A strong analysis does not overclaim beyond the data.", "A strong chart title names the takeaway."],
    grading: ["Question quality.", "Accuracy.", "Interpretation.", "Communication of limitations."]
  },
  "discussion-linked": {
    purpose: "Turn discussion thinking into a more complete, evidence-supported assignment.",
    task: "Use ideas from the discussion to produce a polished response, analysis, or applied artifact.",
    deliverables: ["Reference to one discussion idea or question.", "Expanded analysis with evidence.", "A revised claim, example, or recommendation.", "Brief note on how peer or instructor feedback shaped the work."],
    steps: ["Review your discussion post and replies.", "Choose one idea worth developing.", "Add evidence from course materials.", "Revise the idea into a more complete deliverable.", "Name what changed from the discussion version."],
    format: ["Use headings that distinguish discussion idea, revision, and final response.", "Quote classmates only when allowed by course norms.", "Keep tone respectful and evidence-based."],
    examples: ["A strong submission shows how conversation improved the work.", "A strong revision adds evidence rather than simply restating a post."],
    grading: ["Connection to discussion.", "Revision quality.", "Evidence.", "Professional communication."]
  },
  "portfolio-artifact": {
    purpose: "Create a polished artifact that can represent your learning beyond this course.",
    task: "Revise or create an artifact, explain its purpose, and connect it to course outcomes and future use.",
    deliverables: ["Portfolio-ready artifact.", "Context statement.", "Outcome alignment note.", "Revision or reflection note."],
    steps: ["Choose the artifact and audience.", "Review rubric and outcome criteria.", "Revise for clarity, polish, and accessibility.", "Write the context statement.", "Submit all files or links."],
    format: ["Use professional naming and accessible formatting.", "Include captions, alt text, or transcripts when needed.", "Remove private information before sharing."],
    examples: ["A strong artifact can be understood by someone outside the class.", "A strong context statement explains what the artifact proves."],
    grading: ["Artifact quality.", "Context and reflection.", "Outcome connection.", "Accessibility and polish."]
  }
};

export const buildAssignmentTemplateHtml = (templateId: AssignmentTemplateId, course: CourseProject, assignment?: Assignment): string => {
  const template = templateById(templateId);
  const details = templateDetails[template.id];
  const moduleTitle = moduleTitleFor(course, assignment?.moduleId);
  const alignedOutcomeIds = assignment?.alignedOutcomeIds.length ? assignment.alignedOutcomeIds : course.outcomes.slice(0, 2).map((outcome) => outcome.id);
  const rubric = assignment?.rubricId ? course.rubrics.find((candidate) => candidate.id === assignment.rubricId) : undefined;
  const title = assignment?.title?.trim() || template.name;

  return [
    `<div style="${assignmentThemeStyle(course)}"><h2 style="margin-top: 0;">${escapeHtml(title)}</h2>${paragraph(`This ${template.name.toLowerCase()} belongs in ${moduleTitle}. Review local due dates, point values, and policy language before publishing.`)}</div>`,
    section("Purpose", paragraph(details.purpose)),
    section("Task", paragraph(details.task)),
    section("Deliverables", list(details.deliverables)),
    section("Steps", list(details.steps)),
    section("Format Requirements", list(details.format)),
    section("Example Success Markers", list(details.examples)),
    section("Submission Instructions", paragraph(`Submit this assignment in Canvas using ${assignment?.submissionType || template.submissionType}. Confirm that attached files, links, media, and captions open correctly before the deadline.`)),
    section("Grading Notes", list([`This assignment is worth ${assignment?.points ?? template.recommendedPoints} points.`, ...(rubric ? [`Use the ${rubric.title} rubric when reviewing your work.`] : ["Instructor should attach or confirm the rubric before publishing."]), ...details.grading])),
    section("Accessibility Note", paragraph("Use clear headings, descriptive link text, readable file names, alt text for meaningful images, captions or transcripts for media, and accessible document structure where applicable.")),
    section("Rubric Alignment Prompt", paragraph("Before publishing, confirm the rubric criteria match the task, deliverables, success markers, and selected outcomes.")),
    section("Outcome Alignment", list(outcomeLabels(course.outcomes, alignedOutcomeIds)))
  ].join("\n");
};

export const reviseAssignmentInstructions = (assignment: Assignment, course: CourseProject, action: AssignmentReviseAction): string => {
  const existing = assignment.descriptionHtml.trim();
  const outcomeText = outcomeLabels(course.outcomes, assignment.alignedOutcomeIds);
  const snippets: Record<AssignmentReviseAction, string> = {
    clarity: section("Instructor Clarity Check", list(["Make the audience, task, deliverables, format, and grading path visible before students begin.", "Replace any local placeholders with exact dates, policies, examples, or file requirements."])),
    examples: section("Additional Examples", list(["Strong submissions use a specific case, source, dataset, artifact, or scenario rather than a broad topic.", "Strong explanations name what the evidence shows and why it matters for the course outcome."])),
    deliverables: section("Submission Checklist", list(["Required artifact or response.", "Evidence, citations, source notes, or data as appropriate.", "Brief explanation of choices, limitations, or revision decisions.", "Accessible file names, links, captions, or alt text where needed."])),
    grading: section("How This Will Be Graded", list(["Completion of all deliverables.", "Use of course evidence and terminology.", "Alignment with the attached rubric.", "Clarity, organization, accessibility, and professional presentation."])),
    accessibility: section("Accessibility Guidance", paragraph("Use built-in headings, descriptive links, readable contrast, alt text for meaningful images, captions or transcripts for media, and document formats that can be opened with common tools.")),
    scenario: section("Scenario Context", paragraph(`Imagine you are preparing this work for a real audience connected to ${moduleTitleFor(course, assignment.moduleId)}. Your submission should help that audience understand the issue, evidence, decision point, and recommended next step.`)),
    outcomes: section("Outcome Connection", list(outcomeText))
  };
  return `${existing}\n${snippets[action]}`;
};

const validSubmissionType = (value: string): boolean => {
  const normalized = value.toLowerCase().replace(/\s+/g, "_");
  return ASSIGNMENT_SUBMISSION_TYPES.some((option) => option.toLowerCase().replace(/\s+/g, "_") === normalized) || /upload|text|url|media|none/.test(normalized);
};

const hrefsFrom = (html: string): string[] => Array.from(html.matchAll(/href\s*=\s*["']([^"']*)["']/gi)).map((match) => match[1].trim());

const anchorTextsFrom = (html: string): string[] =>
  Array.from(html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)).map((match) => stripHtml(match[1]).trim().toLowerCase());

const hasUnsafeHtml = (html: string): boolean =>
  /<script[\s>]/i.test(html) ||
  /\son[a-z]+\s*=/i.test(html) ||
  /javascript\s*:/i.test(html) ||
  /<(iframe|object|embed|form|input|button)[\s>]/i.test(html);

const imagesWithoutAlt = (html: string): number =>
  Array.from(html.matchAll(/<img\b[^>]*>/gi)).filter((match) => !/\salt\s*=\s*["'][^"']+["']/i.test(match[0])).length;

const knownTargetsFor = (course: CourseProject): Set<string> => {
  const targets = new Set<string>();
  course.pages.forEach((page) => {
    const slug = slugify(page.slug || page.title);
    targets.add(`${slug}.html`);
    targets.add(`wiki_content/${slug}.html`);
    if (page.slug) targets.add(`${page.slug}.html`);
  });
  course.fileAssets.forEach((asset) => {
    targets.add(asset.path);
    targets.add(`../${asset.path}`);
    targets.add(asset.fileName);
  });
  return targets;
};

export const validateAssignmentPlan = (course: CourseProject): AssignmentPlanValidation => {
  const issues: AssignmentIssue[] = [];
  const groupIds = new Set(course.assignmentGroups.map((group) => group.id));
  const moduleIds = new Set(course.modules.map((module) => module.id));
  const rubricIds = new Set(course.rubrics.map((rubric) => rubric.id));
  const outcomeIds = new Set(course.outcomes.map((outcome) => outcome.id));
  const assignmentItems = course.modules.flatMap((module) => module.items.filter((item) => item.type === "assignment").map((item) => ({ moduleId: module.id, item })));
  const knownTargets = knownTargetsFor(course);

  const add = (assignment: Assignment, id: string, severity: AssignmentIssueSeverity, title: string, detail: string): void => {
    issues.push({ id: `${assignment.id}-${id}`, assignmentId: assignment.id, severity, title, detail });
  };

  course.assignments.forEach((assignment) => {
    const text = stripHtml(assignment.descriptionHtml);
    const matchingItems = assignmentItems.filter(({ item }) => item.refId === assignment.id);

    if (!assignment.title.trim()) add(assignment, "title", "error", "Title missing", "Canvas assignments need a clear student-facing title.");
    if (text.length < 220) add(assignment, "description-detail", "warning", "Instructions are thin", "Add purpose, task, deliverables, steps, examples, and grading notes.");
    if (!Number.isFinite(assignment.points) || assignment.points <= 0) add(assignment, "points", "error", "Points missing", "Use a positive point value so Canvas gradebook metadata is clear.");
    if (!Number.isFinite(assignment.estimatedHours) || assignment.estimatedHours <= 0) add(assignment, "hours", "warning", "Estimated hours missing", "Add a reasonable time-on-task estimate for workload planning.");
    if (assignment.estimatedHours > 20) add(assignment, "hours-heavy", "warning", "Estimated hours look high", `${assignment.estimatedHours} hours may overload students unless this is a major project.`);
    if (!groupIds.has(assignment.assignmentGroupId)) add(assignment, "group", "error", "Assignment group missing", "Choose an assignment group that exists in Gradebook Setup.");
    if (!moduleIds.has(assignment.moduleId)) add(assignment, "module", "error", "Module missing", "Choose a module that exists in the course sequence.");
    if (course.rubrics.length > 0 && (!assignment.rubricId || !rubricIds.has(assignment.rubricId))) add(assignment, "rubric", "warning", "Rubric not attached", "Attach a rubric or confirm that this assignment should be graded without one.");
    if (assignment.alignedOutcomeIds.length === 0 || assignment.alignedOutcomeIds.some((outcomeId) => !outcomeIds.has(outcomeId))) add(assignment, "outcomes", "warning", "Outcomes not aligned", "Select at least one valid outcome so assessment alignment is visible.");
    if (!validSubmissionType(assignment.submissionType)) add(assignment, "submission", "warning", "Submission type unclear", "Use a Canvas-friendly submission type such as online upload, text entry, URL, media, or none.");
    if (!/(deliverable|submit|submission|artifact|paper|presentation|report|file|portfolio|final deliverable)/i.test(text)) add(assignment, "deliverables", "warning", "Deliverables unclear", "Name exactly what students submit.");
    if (!/(grading|rubric|criteria|points|success|before you submit|will be graded)/i.test(text)) add(assignment, "grading", "warning", "Grading path unclear", "Reference rubric criteria, point value, or success markers.");
    if (hasUnsafeHtml(assignment.descriptionHtml)) add(assignment, "unsafe-html", "error", "Unsafe HTML", "Remove scripts, event handlers, JavaScript links, forms, embeds, or other Canvas-hostile HTML.");
    if (imagesWithoutAlt(assignment.descriptionHtml) > 0) add(assignment, "image-alt", "warning", "Image alt text missing", "Add alt text to meaningful images or mark decorative images appropriately before export.");

    const weakLinks = anchorTextsFrom(assignment.descriptionHtml).filter((textValue) => /^(click here|here|link|read more|more)$/i.test(textValue));
    if (weakLinks.length > 0) add(assignment, "link-text", "warning", "Link text is vague", "Use descriptive link text so students and screen readers know where links go.");

    const brokenLinks = hrefsFrom(assignment.descriptionHtml)
      .filter((href) => href !== "" && href !== "#" && !/^javascript:/i.test(href))
      .filter((href) => !/^https?:\/\//i.test(href) && !/^mailto:/i.test(href) && !href.startsWith("#"))
      .filter((href) => !knownTargets.has(href.replace(/^\.\//, "")));
    if (brokenLinks.length > 0) add(assignment, "broken-links", "warning", "Internal link may not resolve", `Check ${brokenLinks.slice(0, 2).join(", ")} before export.`);

    if (matchingItems.length === 0) {
      add(assignment, "module-item", "error", "Missing from Modules", "Every assignment should appear as a module item so students find it in sequence.");
    } else if (matchingItems.some(({ moduleId }) => moduleId !== assignment.moduleId)) {
      add(assignment, "module-mismatch", "error", "Module placement mismatch", "The assignment object and module item location disagree.");
    }
  });

  const summaries = course.assignments.map((assignment) => {
    const assignmentIssues = issues.filter((issue) => issue.assignmentId === assignment.id);
    return {
      assignmentId: assignment.id,
      status: assignmentIssues.some((issue) => issue.severity === "error") ? "Needs review" : "Ready",
      issues: assignmentIssues
    } satisfies AssignmentSummary;
  });
  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.filter((issue) => issue.severity === "warning").length;
  return {
    score: Math.max(0, Math.round(100 - errors * 9 - warnings * 3)),
    status: errors > 0 ? "Needs review" : "Ready",
    issues,
    summaries
  };
};

const defaultModule = (course: CourseProject): CourseModule | undefined =>
  course.modules.find((module) => module.kind === "content") ?? course.modules.find((module) => module.kind !== "instructor") ?? course.modules[0];

const defaultAssignmentGroupId = (course: CourseProject): string =>
  course.assignmentGroups.find((group) => /assignment|project/i.test(group.name))?.id ?? course.assignmentGroups[0]?.id ?? "group_assignments";

const defaultRubricId = (course: CourseProject, outcomes: string[]): string | undefined => {
  const assignmentRubric = course.rubrics.find((rubric) => /assignment|project|paper|presentation/i.test(rubric.title));
  const outcomeRubric = course.rubrics.find((rubric) => rubric.alignedOutcomeIds.some((outcomeId) => outcomes.includes(outcomeId)));
  return assignmentRubric?.id ?? outcomeRubric?.id ?? course.rubrics[0]?.id;
};

export const createAssignment = (
  course: CourseProject,
  options: { templateId?: AssignmentTemplateId; assignmentId?: string; timestamp?: string } = {}
): CourseProject => {
  const timestamp = options.timestamp ?? nowIso();
  const template = templateById(options.templateId ?? "essay-paper");
  const module = defaultModule(course);
  if (!module) return course;
  const alignedOutcomeIds = course.outcomes.slice(0, 2).map((outcome) => outcome.id);
  const assignmentId = options.assignmentId ?? `assignment_${slugify(template.id)}_${Date.now().toString(36)}`;
  const rubricId = defaultRubricId(course, alignedOutcomeIds);
  const assignment: Assignment = {
    id: assignmentId,
    title: `New ${template.name}`,
    descriptionHtml: "",
    points: template.recommendedPoints,
    estimatedHours: template.recommendedHours,
    submissionType: template.submissionType,
    moduleId: module.id,
    assignmentGroupId: defaultAssignmentGroupId(course),
    rubricId,
    alignedOutcomeIds,
    publishState: "unpublished",
    status: "edited",
    metadata: touchedMetadata(undefined, timestamp)
  };
  const completeAssignment = { ...assignment, descriptionHtml: buildAssignmentTemplateHtml(template.id, course, assignment) };
  const moduleItem: ModuleItem = {
    id: `item_${assignmentId}`,
    type: "assignment",
    title: completeAssignment.title,
    refId: assignmentId,
    order: module.items.length + 1,
    indent: 0,
    publishState: "unpublished",
    status: "edited",
    metadata: touchedMetadata(undefined, timestamp)
  };
  return {
    ...course,
    assignments: [...course.assignments, completeAssignment],
    modules: course.modules.map((entry) =>
      entry.id === module.id
        ? { ...entry, expanded: true, items: renumberItems([...entry.items, moduleItem]), status: "edited", metadata: touchedMetadata(entry.metadata, timestamp) }
        : entry
    )
  };
};

export const changeAssignmentModule = (course: CourseProject, assignmentId: string, moduleId: string, timestamp = nowIso()): CourseProject => {
  const assignment = course.assignments.find((entry) => entry.id === assignmentId);
  const targetModule = course.modules.find((module) => module.id === moduleId);
  if (!assignment || !targetModule) return course;
  const existingItem = course.modules.flatMap((module) => module.items).find((item) => item.type === "assignment" && item.refId === assignmentId);
  const moduleItem: ModuleItem = existingItem
    ? { ...existingItem, title: assignment.title, publishState: assignment.publishState, status: "edited", metadata: touchedMetadata(existingItem.metadata, timestamp) }
    : {
        id: `item_${assignmentId}`,
        type: "assignment",
        title: assignment.title,
        refId: assignmentId,
        order: targetModule.items.length + 1,
        indent: 0,
        publishState: assignment.publishState,
        status: "edited",
        metadata: touchedMetadata(undefined, timestamp)
      };

  return {
    ...course,
    assignments: course.assignments.map((entry) =>
      entry.id === assignmentId ? { ...entry, moduleId, status: "edited", metadata: touchedMetadata(entry.metadata, timestamp) } : entry
    ),
    modules: course.modules.map((module) => {
      const withoutAssignment = module.items.filter((item) => !(item.type === "assignment" && item.refId === assignmentId));
      if (module.id !== moduleId) return { ...module, items: renumberItems(withoutAssignment) };
      return {
        ...module,
        expanded: true,
        items: renumberItems([...withoutAssignment, moduleItem]),
        status: "edited",
        metadata: touchedMetadata(module.metadata, timestamp)
      };
    }),
    schedule: course.schedule.map((entry) => (entry.itemId === assignmentId ? { ...entry, moduleId } : entry))
  };
};

export const renameAssignmentEverywhere = (course: CourseProject, assignmentId: string, title: string, timestamp = nowIso()): CourseProject => ({
  ...course,
  assignments: course.assignments.map((assignment) =>
    assignment.id === assignmentId ? { ...assignment, title, status: "edited", metadata: touchedMetadata(assignment.metadata, timestamp) } : assignment
  ),
  modules: course.modules.map((module) => ({
    ...module,
    items: module.items.map((item) => (item.type === "assignment" && item.refId === assignmentId ? { ...item, title, status: "edited", metadata: touchedMetadata(item.metadata, timestamp) } : item))
  })),
  schedule: course.schedule.map((entry) => (entry.itemId === assignmentId ? { ...entry, title } : entry))
});

export const deleteAssignment = (course: CourseProject, assignmentId: string): CourseProject => ({
  ...course,
  assignments: course.assignments.filter((assignment) => assignment.id !== assignmentId),
  modules: course.modules.map((module) => ({
    ...module,
    items: renumberItems(module.items.filter((item) => !(item.type === "assignment" && item.refId === assignmentId)))
  })),
  schedule: course.schedule.filter((entry) => entry.itemId !== assignmentId)
});

export const restoreAssignment = (course: CourseProject, assignment: Assignment, timestamp = nowIso()): CourseProject => {
  const restored = { ...assignment, status: "edited" as const, metadata: touchedMetadata(assignment.metadata, timestamp) };
  const withAssignment = course.assignments.some((entry) => entry.id === assignment.id)
    ? { ...course, assignments: course.assignments.map((entry) => (entry.id === assignment.id ? restored : entry)) }
    : { ...course, assignments: [...course.assignments, restored] };
  return changeAssignmentModule(withAssignment, assignment.id, assignment.moduleId, timestamp);
};

export const sanitizeAssignmentHtmlForPreview = (html: string): string =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
    .replace(/href\s*=\s*["']\s*javascript:[^"']*["']/gi, 'href="#"')
    .replace(/<(iframe|object|embed|form|input|button)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<(iframe|object|embed|form|input|button)\b[^>]*>/gi, "");

export const rubricForAssignment = (course: CourseProject, assignment: Assignment): Rubric | undefined =>
  assignment.rubricId ? course.rubrics.find((rubric) => rubric.id === assignment.rubricId) : undefined;
