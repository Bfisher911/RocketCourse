// Course-wide "transformations" — one-click, deterministic operations on an existing course, surfaced
// in the Transform tab. Pure (course-in / {course, summary}-out) so each is unit-testable. No AI:
// restyle re-themes generated content; polish appends idempotent per-object guidance via the
// deterministic reviser; make-export-ready fixes safely-fixable readiness gaps and reports the rest.
import type { CourseProject, Theme } from "../types";
import { nowIso } from "../utils/text";
import { applyThemeToGeneratedContent } from "./courseGenerator";
import { reviseCourseObject } from "./objectRevision";
import { rebalanceWeights } from "./gradebookSummary";
import { orphanOutcomes } from "./overviewSummary";
import { buildReadinessReport } from "./readiness";
import { repairCourse, unrepairableIssues } from "./courseRepair";

export interface TransformResult {
  course: CourseProject;
  summary: string[];
}

// --- 1. Restyle: re-theme the whole course ---------------------------------------------------------
export const restyleCourse = (course: CourseProject, theme: Theme): TransformResult => ({
  course: applyThemeToGeneratedContent(course, theme),
  summary: [
    `Recolored generated pages, the homepage, syllabus, and banner to "${theme.name}".`,
    "Hand-edited objects were preserved where possible."
  ]
});

// --- 2. Polish pass: deterministic, idempotent guidance per object type ----------------------------
// Markers keep the pass idempotent — a second run won't double-append the same block.
const POLISH_MARKER = { accessibility: "Accessibility Check", concise: "Clarity Pass", examples: "Examples To Consider" } as const;

const outcomeCodesFor = (course: CourseProject, ids: string[]): string[] =>
  ids.map((id) => course.outcomes.find((outcome) => outcome.id === id)?.code).filter((code): code is string => Boolean(code));

const polish = (
  course: CourseProject,
  objectType: "page" | "assignment" | "discussion",
  title: string,
  html: string,
  mode: keyof typeof POLISH_MARKER,
  outcomeCodes: string[]
): string | null => {
  if (html.includes(POLISH_MARKER[mode])) return null;
  return reviseCourseObject({ courseTitle: course.title, objectType, title, html, mode, context: { outcomeCodes, futureProvider: "server-side-ai" } }).html;
};

export const polishCourse = (course: CourseProject): TransformResult => {
  const timestamp = nowIso();
  let pages = 0;
  let assignments = 0;
  let discussions = 0;

  const nextPages = course.pages.map((page) => {
    const html = polish(course, "page", page.title, page.bodyHtml, "accessibility", []);
    if (!html) return page;
    pages += 1;
    return { ...page, bodyHtml: html, status: "edited" as const };
  });
  const nextAssignments = course.assignments.map((assignment) => {
    const html = polish(course, "assignment", assignment.title, assignment.descriptionHtml, "concise", outcomeCodesFor(course, assignment.alignedOutcomeIds));
    if (!html) return assignment;
    assignments += 1;
    return { ...assignment, descriptionHtml: html, status: "edited" as const };
  });
  const nextDiscussions = course.discussions.map((discussion) => {
    const html = polish(course, "discussion", discussion.title, discussion.promptHtml, "examples", outcomeCodesFor(course, discussion.alignedOutcomeIds));
    if (!html) return discussion;
    discussions += 1;
    return { ...discussion, promptHtml: html, status: "edited" as const };
  });

  const summary: string[] = [];
  if (pages) summary.push(`Added accessibility guidance to ${pages} page(s).`);
  if (assignments) summary.push(`Added a clarity pass to ${assignments} assignment(s).`);
  if (discussions) summary.push(`Added example prompts to ${discussions} discussion(s).`);
  if (summary.length) summary.push("Deterministic guidance — no AI credits used. Use per-object AI revise for deeper rewrites.");
  else summary.push("Every page, assignment, and discussion already has polish guidance — nothing to change.");

  return { course: { ...course, pages: nextPages, assignments: nextAssignments, discussions: nextDiscussions, updatedAt: timestamp, status: "edited" }, summary };
};

// --- 3. Make export-ready: fix safely-fixable readiness gaps, report the rest ----------------------
export const makeCourseExportReady = (course: CourseProject): TransformResult => {
  const timestamp = nowIso();
  const summary: string[] = [];

  // 0. Structural repair first (dangling refs, moduleId drift, broken rubric links, slugs, quiz
  //    question integrity, weights). This is the same repair the export path runs.
  const repaired = repairCourse(course);
  let next = repaired.course;
  summary.push(...repaired.repairs);

  // a. Align orphaned outcomes to content modules (round-robin), clearing the orphan warning.
  const orphans = orphanOutcomes(next);
  const contentModules = next.modules.filter((module) => module.kind === "content");
  if (orphans.length && contentModules.length) {
    const orphanIds = new Set(orphans.map((outcome) => outcome.id));
    let assigned = 0;
    next = {
      ...next,
      outcomes: next.outcomes.map((outcome) => {
        if (!orphanIds.has(outcome.id)) return outcome;
        const moduleId = contentModules[assigned % contentModules.length].id;
        assigned += 1;
        return { ...outcome, alignedModuleIds: [...outcome.alignedModuleIds, moduleId] };
      })
    };
    summary.push(`Aligned ${orphans.length} orphaned outcome(s) to content modules.`);
  }

  // b. Rebalance assignment-group weights to total 100% when they drift.
  const weightTotal = Math.round(next.assignmentGroups.reduce((sum, group) => sum + Number(group.weight || 0), 0));
  if (next.assignmentGroups.length && weightTotal !== 100) {
    next = rebalanceWeights(next, timestamp);
    summary.push("Rebalanced assignment-group weights to total 100%.");
  }

  // c. Surface issues repair can't auto-fix (need human content, e.g. a quiz with no questions).
  summary.push(...unrepairableIssues(next));

  // d. Report remaining required blockers honestly.
  const blockers = buildReadinessReport(next).checks.filter((check) => !check.passed && check.severity === "required");
  if (blockers.length) {
    summary.push(`${blockers.length} blocker(s) still need manual attention: ${blockers.slice(0, 3).map((check) => check.label).join("; ")}.`);
  } else {
    summary.push("No blocking readiness issues remain — this course is export-ready.");
  }

  return { course: { ...next, updatedAt: timestamp, status: "edited" }, summary };
};
