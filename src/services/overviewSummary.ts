// ============================================================================
// Overview command-center model
// ----------------------------------------------------------------------------
// Pure, testable helpers that turn a CourseProject into the data the Overview tab
// renders: outcome management (add/delete/reorder/edit + alignment + orphan
// detection), a course-structure snapshot, a course-health summary derived from the
// readiness report, an export-readiness snapshot, and Overview-specific design checks.
// No React, no I/O — every function is course-in / data-out so the command center can
// be unit-tested without rendering.
// ============================================================================

import type { Assignment, CourseModule, CourseOutcome, CourseProject, Discussion, EditorTab, Quiz, ReadinessCheck, ReadinessReport } from "../types";
import { nowIso } from "../utils/text";
import { buildReadinessReport } from "./readiness";
import { getOutcomeFramework } from "./outcomeFrameworks";

// A measurable outcome leads with an observable action verb. Kept in sync with the readiness
// detector so the Overview "measurable language" signal matches the export readiness check.
// Includes every framework's leading verbs (Bloom remember/understand…, Kolb engage/reflect/
// conceptualize/experiment, etc.) so outcomes from any outcomeFramework are recognized as measurable.
const MEASURABLE_VERB =
  /^\s*(remember|understand|engage|reflect|conceptuali[sz]e|experiment|analy[sz]e|apply|argue|assess|build|calculate|categori[sz]e|classify|compare|compose|conduct|construct|create|critique|debate|defend|define|demonstrate|describe|design|develop|differentiate|distinguish|evaluate|examine|explain|formulate|generate|identify|illustrate|implement|integrate|interpret|investigate|justify|label|list|measure|model|name|organi[sz]e|outline|plan|predict|produce|propose|recommend|recogni[sz]e|relate|report|review|select|solve|summari[sz]e|synthesi[sz]e|test|translate|use)\b/i;

// ---------------------------------------------------------------------------
// Outcome alignment + orphan detection
// ---------------------------------------------------------------------------

export interface OutcomeAlignment {
  modules: CourseModule[];
  assignments: Assignment[];
  discussions: Discussion[];
  quizzes: Quiz[];
  rubricCount: number;
  total: number;
}

export const outcomeAlignment = (course: CourseProject, outcomeId: string): OutcomeAlignment => {
  const outcome = course.outcomes.find((entry) => entry.id === outcomeId);
  const modules = outcome ? course.modules.filter((module) => outcome.alignedModuleIds.includes(module.id)) : [];
  const assignments = course.assignments.filter((assignment) => assignment.alignedOutcomeIds.includes(outcomeId));
  const discussions = course.discussions.filter((discussion) => discussion.alignedOutcomeIds.includes(outcomeId));
  const quizzes = course.quizzes.filter((quiz) => quiz.alignedOutcomeIds.includes(outcomeId));
  const rubricCount = course.rubrics.filter((rubric) => rubric.alignedOutcomeIds.includes(outcomeId)).length;
  return {
    modules,
    assignments,
    discussions,
    quizzes,
    rubricCount,
    total: modules.length + assignments.length + discussions.length + quizzes.length + rubricCount
  };
};

// An outcome is orphaned when nothing points to it — no aligned module, graded item, or rubric.
// Matches the readiness "orphaned-outcomes" definition so the two views never disagree.
export const isOrphanOutcome = (course: CourseProject, outcome: CourseOutcome): boolean =>
  outcome.alignedModuleIds.length === 0 &&
  !course.assignments.some((assignment) => assignment.alignedOutcomeIds.includes(outcome.id)) &&
  !course.discussions.some((discussion) => discussion.alignedOutcomeIds.includes(outcome.id)) &&
  !course.quizzes.some((quiz) => quiz.alignedOutcomeIds.includes(outcome.id)) &&
  !course.rubrics.some((rubric) => rubric.alignedOutcomeIds.includes(outcome.id));

export const orphanOutcomes = (course: CourseProject): CourseOutcome[] => course.outcomes.filter((outcome) => isOrphanOutcome(course, outcome));

export const outcomeIsMeasurable = (outcome: CourseOutcome): boolean => MEASURABLE_VERB.test(outcome.text);

// A human-readable tag derived from an outcome's text (e.g. "Analyze key marine biology concepts…"
// → "analyze-marine-biology"). A display aid shown alongside the stable code; alignment stays
// id-based, so tags may collide or change without breaking anything.
const TAG_STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "by", "from", "into", "at", "as", "that", "this", "these", "those",
  "students", "student", "will", "be", "able", "end", "course", "key", "their", "its", "your", "you", "they", "them", "other",
  "concepts", "practices", "implications", "contexts", "context", "academic", "applied", "various", "different", "using", "use",
  "across", "within", "between", "about", "through", "over", "under", "more", "most", "real", "world", "skills", "ideas"
]);

export const outcomeTag = (outcome: Pick<CourseOutcome, "text" | "code">): string => {
  const words = outcome.text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1 && !TAG_STOPWORDS.has(word));
  const slug = words.slice(0, 4).join("-");
  return slug || (outcome.code ? outcome.code.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : "outcome");
};

export interface ModuleOutcomeRow {
  module: CourseModule;
  outcomes: CourseOutcome[];
  /** A content module with no aligned outcome — a real alignment gap worth surfacing. */
  isGap: boolean;
}

// Module-centric alignment: each module with the outcomes aligned to it. Mirrors the per-outcome
// `outcomeAlignment` view from the module side so the Overview can show a glanceable matrix.
export const moduleOutcomeMatrix = (course: CourseProject): ModuleOutcomeRow[] =>
  course.modules.map((module) => {
    const outcomes = course.outcomes.filter((outcome) => outcome.alignedModuleIds.includes(module.id));
    return { module, outcomes, isGap: module.kind === "content" && outcomes.length === 0 };
  });

// ---------------------------------------------------------------------------
// Outcome mutations (pure: course in, course out)
// ---------------------------------------------------------------------------

const touchCourse = (course: CourseProject, timestamp: string): CourseProject => ({ ...course, updatedAt: timestamp });

// Next "CLO N" code that does not collide with an existing outcome code.
const nextOutcomeCode = (course: CourseProject): string => {
  const used = new Set(course.outcomes.map((outcome) => outcome.code.trim().toLowerCase()));
  const highest = course.outcomes.reduce((max, outcome) => {
    const match = /(\d+)\s*$/.exec(outcome.code.trim());
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  let next = Math.max(highest, course.outcomes.length) + 1;
  while (used.has(`clo ${next}`.toLowerCase())) next += 1;
  return `CLO ${next}`;
};

export const addOutcome = (course: CourseProject, options: { timestamp?: string; id?: string } = {}): CourseProject => {
  const timestamp = options.timestamp ?? nowIso();
  const framework = getOutcomeFramework(course.settings.outcomeFramework);
  const outcome: CourseOutcome = {
    id: options.id ?? `outcome_${Date.now().toString(36)}`,
    code: nextOutcomeCode(course),
    text: "",
    bloomLevel: framework.levels[Math.min(1, framework.levels.length - 1)].label,
    alignedModuleIds: []
  };
  return touchCourse({ ...course, outcomes: [...course.outcomes, outcome] }, timestamp);
};

// Remove an outcome and scrub its id from every assessment and rubric that referenced it, so no
// dangling alignedOutcomeIds reach export.
export const deleteOutcome = (course: CourseProject, outcomeId: string, timestamp = nowIso()): CourseProject => {
  if (!course.outcomes.some((outcome) => outcome.id === outcomeId)) return course;
  const strip = <T extends { alignedOutcomeIds: string[] }>(items: T[]): T[] =>
    items.map((item) => (item.alignedOutcomeIds.includes(outcomeId) ? { ...item, alignedOutcomeIds: item.alignedOutcomeIds.filter((id) => id !== outcomeId) } : item));
  return touchCourse(
    {
      ...course,
      outcomes: course.outcomes.filter((outcome) => outcome.id !== outcomeId),
      assignments: strip(course.assignments),
      discussions: strip(course.discussions),
      quizzes: strip(course.quizzes),
      rubrics: strip(course.rubrics)
    },
    timestamp
  );
};

export const moveOutcome = (course: CourseProject, outcomeId: string, direction: "up" | "down", timestamp = nowIso()): CourseProject => {
  const index = course.outcomes.findIndex((outcome) => outcome.id === outcomeId);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || target < 0 || target >= course.outcomes.length) return course;
  const outcomes = [...course.outcomes];
  [outcomes[index], outcomes[target]] = [outcomes[target], outcomes[index]];
  return touchCourse({ ...course, outcomes }, timestamp);
};

export const updateOutcome = (
  course: CourseProject,
  outcomeId: string,
  patch: Partial<Pick<CourseOutcome, "code" | "text" | "bloomLevel">>,
  timestamp = nowIso()
): CourseProject =>
  touchCourse(
    { ...course, outcomes: course.outcomes.map((outcome) => (outcome.id === outcomeId ? { ...outcome, ...patch } : outcome)) },
    timestamp
  );

// ---------------------------------------------------------------------------
// Course structure snapshot
// ---------------------------------------------------------------------------

export interface CourseStructureSummary {
  modules: number;
  contentModules: number;
  pages: number;
  assignments: number;
  discussions: number;
  quizzes: number;
  rubrics: number;
  outcomes: number;
  assignmentGroups: number;
  contactHours: number;
  gradeWeightTotal: number;
}

export const courseStructureSummary = (course: CourseProject): CourseStructureSummary => ({
  modules: course.modules.length,
  contentModules: course.modules.filter((module) => module.kind === "content").length,
  pages: course.pages.length,
  assignments: course.assignments.length,
  discussions: course.discussions.length,
  quizzes: course.quizzes.length,
  rubrics: course.rubrics.length,
  outcomes: course.outcomes.length,
  assignmentGroups: course.assignmentGroups.length,
  contactHours: Math.round((course.contactHours?.totalHours ?? 0) * 10) / 10,
  gradeWeightTotal: Math.round(course.assignmentGroups.reduce((sum, group) => sum + Number(group.weight || 0), 0))
});

// ---------------------------------------------------------------------------
// Course health summary (derived from the readiness report)
// ---------------------------------------------------------------------------

// Route a readiness check to the editor tab where it can be fixed. Order matters: more specific
// keywords are tested before broader ones (homepage before page, group before assignment).
export const tabForCheck = (id: string): EditorTab => {
  if (/homepage|calendar-link|start-here-link/.test(id)) return "Homepage";
  if (/syllabus/.test(id)) return "Syllabus";
  if (/outcome|objective|bloom/.test(id)) return "Overview";
  if (/weight|group|gradebook/.test(id)) return "Gradebook Setup";
  if (/assignment/.test(id)) return "Assignments";
  if (/discussion/.test(id)) return "Discussions";
  if (/quiz/.test(id)) return "Quizzes";
  if (/rubric/.test(id)) return "Rubrics";
  if (/(^|-)page|placeholder-links|internal-links|empty-content|thin-content|accessibility/.test(id)) return "Pages";
  if (/workload|contact/.test(id)) return "Contact Hours";
  if (/module|start-here|reference-integrity|schedule|due-date/.test(id)) return "Modules";
  if (/navigation|theme/.test(id)) return "Theme";
  return "Export";
};

export interface HealthItem {
  id: string;
  label: string;
  detail: string;
  severity: ReadinessCheck["severity"];
  tab: EditorTab;
}

export interface CourseHealthSummary {
  score: number;
  blockers: number;
  warnings: number;
  passed: number;
  total: number;
  strengths: HealthItem[];
  attention: HealthItem[];
}

const toHealthItem = (check: ReadinessCheck): HealthItem => ({
  id: check.id,
  label: check.label,
  detail: check.detail,
  severity: check.severity,
  tab: tabForCheck(check.id)
});

// Required checks rank above recommended ones so the most consequential items surface first.
const bySeverity = (a: ReadinessCheck, b: ReadinessCheck): number =>
  (a.severity === "required" ? 0 : 1) - (b.severity === "required" ? 0 : 1);

export const courseHealthSummary = (course: CourseProject, report: ReadinessReport = buildReadinessReport(course), limit = 5): CourseHealthSummary => {
  const passed = report.checks.filter((check) => check.passed);
  const failed = report.checks.filter((check) => !check.passed);
  return {
    score: report.score,
    blockers: report.blockers,
    warnings: report.warnings,
    passed: passed.length,
    total: report.checks.length,
    strengths: [...passed].sort(bySeverity).slice(0, limit).map(toHealthItem),
    attention: [...failed].sort(bySeverity).slice(0, limit).map(toHealthItem)
  };
};

// ---------------------------------------------------------------------------
// Export readiness snapshot
// ---------------------------------------------------------------------------

export interface ExportReadinessSummary {
  status: "Ready" | "Needs review" | "Blocked";
  score: number;
  gradeWeightTotal: number;
  gradeWeightOk: boolean;
  orphanedOutcomes: number;
  referencesResolve: boolean;
  unsafeHtmlClean: boolean;
  placeholderLinksClean: boolean;
  blockers: number;
  warnings: number;
}

const checkPassed = (report: ReadinessReport, id: string): boolean => report.checks.find((check) => check.id === id)?.passed ?? true;

export const exportReadinessSummary = (course: CourseProject, report: ReadinessReport = buildReadinessReport(course)): ExportReadinessSummary => {
  const structure = courseStructureSummary(course);
  return {
    status: report.blockers > 0 ? "Blocked" : report.score >= 90 ? "Ready" : "Needs review",
    score: report.score,
    gradeWeightTotal: structure.gradeWeightTotal,
    gradeWeightOk: structure.gradeWeightTotal === 100,
    orphanedOutcomes: orphanOutcomes(course).length,
    referencesResolve: checkPassed(report, "reference-integrity") && checkPassed(report, "module-refs"),
    unsafeHtmlClean: checkPassed(report, "accessibility"),
    placeholderLinksClean: checkPassed(report, "placeholder-links"),
    blockers: report.blockers,
    warnings: report.warnings
  };
};

// ---------------------------------------------------------------------------
// Overview design checks
// ---------------------------------------------------------------------------

export type DesignCheckStatus = "pass" | "warn" | "fail";

export interface DesignCheck {
  id: string;
  label: string;
  status: DesignCheckStatus;
  detail: string;
  tab: EditorTab;
}

// Translate a readiness check into a design check, mapping severity to warn/fail when it fails.
const designFromReport = (report: ReadinessReport, id: string, label: string): DesignCheck => {
  const check = report.checks.find((entry) => entry.id === id);
  const status: DesignCheckStatus = !check ? "warn" : check.passed ? "pass" : check.severity === "required" ? "fail" : "warn";
  return { id, label, status, detail: check?.detail ?? "Not evaluated.", tab: tabForCheck(id) };
};

export const overviewDesignChecks = (course: CourseProject, report: ReadinessReport = buildReadinessReport(course)): DesignCheck[] => {
  const description = course.description.trim();
  const framework = getOutcomeFramework(course.settings.outcomeFramework);
  const distinctBloom = new Set(course.outcomes.map((outcome) => outcome.bloomLevel).filter(Boolean)).size;
  const outcomesWithBloom = course.outcomes.filter((outcome) => Boolean(outcome.bloomLevel)).length;
  const contentModules = course.modules.filter((module) => module.kind === "content").length;
  const weeks = Math.max(1, course.settings.lengthWeeks || course.settings.moduleCount || contentModules || 1);
  const moduleRatio = contentModules / weeks;
  const hoursPerWeek = (course.contactHours?.totalHours ?? 0) / weeks;

  const descriptionStatus: DesignCheckStatus = description.length >= 60 ? "pass" : description.length > 0 ? "warn" : "fail";
  const outcomesStatus: DesignCheckStatus = course.outcomes.length >= 5 ? "pass" : course.outcomes.length > 0 ? "warn" : "fail";
  const bloomStatus: DesignCheckStatus = outcomesWithBloom === course.outcomes.length && distinctBloom >= 3 ? "pass" : distinctBloom >= 1 ? "warn" : "fail";
  const moduleCountStatus: DesignCheckStatus = moduleRatio >= 0.5 && moduleRatio <= 2 ? "pass" : "warn";
  const workloadStatus: DesignCheckStatus = course.contactHours?.totalHours ? (hoursPerWeek >= 3 && hoursPerWeek <= 25 ? "pass" : "warn") : "fail";

  return [
    { id: "description", label: "Course has a clear description", status: descriptionStatus, detail: description ? `${description.length} characters of course description.` : "Add a student-facing course description.", tab: "Overview" },
    { id: "outcomes-present", label: "Learning outcomes exist", status: outcomesStatus, detail: `${course.outcomes.length} course outcome(s) defined.`, tab: "Overview" },
    designFromReport(report, "objective-measurable", "Outcomes use measurable language"),
    { id: "bloom-variety", label: "Outcome levels are varied", status: bloomStatus, detail: `${distinctBloom} distinct level(s) across ${course.outcomes.length} outcome(s) (${framework.label}).`, tab: "Overview" },
    designFromReport(report, "orphaned-outcomes", "Every outcome is aligned"),
    { id: "module-count-length", label: "Module count fits course length", status: moduleCountStatus, detail: `${contentModules} content module(s) across ~${weeks} week(s).`, tab: "Modules" },
    designFromReport(report, "required-modules", "Start, content, final & instructor modules present"),
    designFromReport(report, "graded-outcomes", "Graded work aligns to outcomes"),
    { id: "workload", label: "Workload looks plausible", status: workloadStatus, detail: course.contactHours?.totalHours ? `${Math.round(hoursPerWeek)} student hours/week (${course.contactHours.totalHours} total).` : "No workload estimate yet.", tab: "Contact Hours" },
    designFromReport(report, "weights", "Gradebook weights total 100%")
  ];
};

// ---------------------------------------------------------------------------
// Combined model (computes the readiness report once)
// ---------------------------------------------------------------------------

export interface OverviewModel {
  structure: CourseStructureSummary;
  health: CourseHealthSummary;
  exportReadiness: ExportReadinessSummary;
  designChecks: DesignCheck[];
  alignment: ModuleOutcomeRow[];
}

export const buildOverviewModel = (course: CourseProject): OverviewModel => {
  const report = buildReadinessReport(course);
  return {
    structure: courseStructureSummary(course),
    health: courseHealthSummary(course, report),
    exportReadiness: exportReadinessSummary(course, report),
    designChecks: overviewDesignChecks(course, report),
    alignment: moduleOutcomeMatrix(course)
  };
};
