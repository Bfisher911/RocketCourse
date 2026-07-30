// ============================================================================
// Contact-hours (workload) command-center model
// ----------------------------------------------------------------------------
// Pure, testable helpers that turn a CourseProject's ContactHourPlan into the data
// the Contact Hours tab renders: a per-category breakdown, a workload summary
// (total vs the Carnegie credit-hour expectation, per-week load, internal
// consistency), a plan-vs-generated cross-check, validation issues, and safe
// mutations (edit a category, recalculate from credit hours, edit justification).
// ============================================================================

import type { ContactHourPlan, CourseProject, EditorTab } from "../types";
import { HOURS_PER_CREDIT, makeContactHours } from "./contactHoursModel";
import { nowIso } from "../utils/text";

export type ContactHourCategoryKey = "instructionalTime" | "readingMediaTime" | "assignmentTime" | "discussionTime" | "quizStudyTime" | "finalProjectTime";

// The six workload categories, the editor tab each one maps to, and a short student-facing note.
export const CONTACT_HOUR_CATEGORIES: Array<{ key: ContactHourCategoryKey; label: string; tab: EditorTab; note: string }> = [
  { key: "instructionalTime", label: "Instructional", tab: "Modules", note: "Lectures, videos, and instructor-presented content." },
  { key: "readingMediaTime", label: "Reading & media", tab: "Modules", note: "Assigned readings, media, and study resources." },
  { key: "assignmentTime", label: "Assignments", tab: "Assignments", note: "Time spent producing graded assignment work." },
  { key: "discussionTime", label: "Discussions", tab: "Discussions", note: "Participating in and responding to discussions." },
  { key: "quizStudyTime", label: "Quiz & study", tab: "Quizzes", note: "Quiz preparation, review, and self-testing." },
  { key: "finalProjectTime", label: "Final project", tab: "Assignments", note: "Developing and completing the final project." }
];

const round1 = (value: number): number => Math.round(value * 10) / 10;

export const categorySum = (plan: ContactHourPlan): number => CONTACT_HOUR_CATEGORIES.reduce((sum, category) => sum + Number(plan[category.key] || 0), 0);

export const expectedTotalHours = (course: CourseProject): number => Math.round((Number(course.settings.creditHours) || 0) * HOURS_PER_CREDIT);

export interface ContactHourCategory {
  key: ContactHourCategoryKey;
  label: string;
  tab: EditorTab;
  note: string;
  hours: number;
  pct: number;
}

export const contactHoursBreakdown = (course: CourseProject): ContactHourCategory[] => {
  const total = categorySum(course.contactHours);
  return CONTACT_HOUR_CATEGORIES.map((category) => {
    const hours = Number(course.contactHours[category.key] || 0);
    return { ...category, hours, pct: total > 0 ? Math.round((hours / total) * 100) : 0 };
  });
};

export interface ContactHoursSummary {
  status: "Balanced" | "Needs review" | "Missing";
  totalHours: number;
  categorySum: number;
  sumsMatch: boolean;
  expectedTotal: number;
  variancePct: number;
  hoursPerCredit: number;
  weeks: number;
  perWeek: number;
  creditHours: number;
}

const PER_WEEK_MIN = 3;
const PER_WEEK_MAX = 25;

export const contactHoursSummary = (course: CourseProject): ContactHoursSummary => {
  const sum = categorySum(course.contactHours);
  const totalHours = Math.round(Number(course.contactHours.totalHours || 0));
  const expectedTotal = expectedTotalHours(course);
  const creditHours = Number(course.settings.creditHours) || 0;
  const weeks = Math.max(1, Number(course.settings.lengthWeeks) || 1);
  const perWeek = round1(totalHours / weeks);
  const sumsMatch = Math.round(sum) === totalHours;
  const variancePct = expectedTotal > 0 ? Math.round(((totalHours - expectedTotal) / expectedTotal) * 100) : 0;
  const implausible = perWeek < PER_WEEK_MIN || perWeek > PER_WEEK_MAX;
  const status: ContactHoursSummary["status"] =
    totalHours <= 0 ? "Missing" : !sumsMatch || implausible || Math.abs(variancePct) > 25 ? "Needs review" : "Balanced";
  return {
    status,
    totalHours,
    categorySum: Math.round(sum),
    sumsMatch,
    expectedTotal,
    variancePct,
    hoursPerCredit: creditHours > 0 ? round1(totalHours / creditHours) : 0,
    weeks,
    perWeek,
    creditHours
  };
};

// Bottom-up workload from the actually-generated objects, to sanity-check the top-down plan:
// module workload hours and the sum of assignment time estimates.
export interface WorkloadEstimate {
  moduleWorkload: number;
  assignmentEstimate: number;
}

export const actualWorkloadEstimate = (course: CourseProject): WorkloadEstimate => ({
  moduleWorkload: round1(course.modules.reduce((sum, module) => sum + Number(module.workloadHours || 0), 0)),
  assignmentEstimate: round1(course.assignments.reduce((sum, assignment) => sum + Number(assignment.estimatedHours || 0), 0))
});

export type ContactHoursIssueSeverity = "error" | "warning";

export interface ContactHoursIssue {
  id: string;
  severity: ContactHoursIssueSeverity;
  title: string;
  detail: string;
  tab: EditorTab;
}

export const contactHoursIssues = (course: CourseProject): ContactHoursIssue[] => {
  const issues: ContactHoursIssue[] = [];
  const summary = contactHoursSummary(course);

  if (summary.totalHours <= 0) {
    issues.push({ id: "no-total", severity: "error", title: "No workload estimate", detail: "Add student workload hours so the syllabus can state expected time on task.", tab: "Contact Hours" });
  }
  if (summary.totalHours > 0 && !summary.sumsMatch) {
    issues.push({
      id: "sum-mismatch",
      severity: "warning",
      title: "Category hours do not sum to the total",
      detail: `Categories add up to ${summary.categorySum}h but the total is ${summary.totalHours}h.`,
      tab: "Contact Hours"
    });
  }
  CONTACT_HOUR_CATEGORIES.filter((category) => Number(course.contactHours[category.key] || 0) < 0).forEach((category) =>
    issues.push({ id: `negative-${category.key}`, severity: "error", title: `${category.label} time is negative`, detail: "Workload hours cannot be negative.", tab: "Contact Hours" })
  );
  if (summary.totalHours > 0 && summary.perWeek < PER_WEEK_MIN) {
    issues.push({ id: "low-week", severity: "warning", title: "Weekly workload looks low", detail: `About ${summary.perWeek}h/week over ${summary.weeks} weeks may understate the real workload.`, tab: "Contact Hours" });
  }
  if (summary.perWeek > PER_WEEK_MAX) {
    issues.push({ id: "high-week", severity: "warning", title: "Weekly workload looks heavy", detail: `About ${summary.perWeek}h/week over ${summary.weeks} weeks may overload students.`, tab: "Contact Hours" });
  }
  if (summary.creditHours > 0 && Math.abs(summary.variancePct) > 25) {
    issues.push({
      id: "credit-variance",
      severity: "warning",
      title: "Total is far from the credit-hour expectation",
      detail: `${summary.creditHours} credits suggests ~${summary.expectedTotal}h, but the plan is ${summary.totalHours}h (${summary.variancePct > 0 ? "+" : ""}${summary.variancePct}%).`,
      tab: "Contact Hours"
    });
  }
  if (course.contactHours.justification.trim().length < 40) {
    issues.push({ id: "thin-justification", severity: "warning", title: "Justification is thin", detail: "Explain how the workload hours were estimated so reviewers can verify the plan.", tab: "Contact Hours" });
  }

  return issues;
};

// ---------------------------------------------------------------------------
// Mutations (pure: course in, course out)
// ---------------------------------------------------------------------------

const touch = (course: CourseProject, timestamp: string): CourseProject => ({ ...course, updatedAt: timestamp });

// Set one category's hours and keep totalHours in lockstep as the sum of all six categories.
export const updateContactHour = (course: CourseProject, key: ContactHourCategoryKey, value: number, timestamp = nowIso()): CourseProject => {
  const next = { ...course.contactHours, [key]: Math.max(0, Math.round(value)) };
  return touch({ ...course, contactHours: { ...next, totalHours: categorySum(next) } }, timestamp);
};

export const updateJustification = (course: CourseProject, justification: string, timestamp = nowIso()): CourseProject =>
  touch({ ...course, contactHours: { ...course.contactHours, justification } }, timestamp);

// Reset the plan to the canonical Carnegie model derived from the course's credit hours and
// length — the same calculation the generator uses, so the two never drift.
export const recalculateContactHours = (course: CourseProject, timestamp = nowIso()): CourseProject =>
  touch({ ...course, contactHours: makeContactHours(course.settings) }, timestamp);
