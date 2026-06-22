// ============================================================================
// Export command-center model
// ----------------------------------------------------------------------------
// Pure, testable helpers that turn a CourseProject (+ the local ExportValidationReport
// produced by validateImsccZip) into the data the Export tab renders: an export
// checklist, grouped + enriched validation issues (with the tab that fixes them, why
// they matter, and a suggested fix), a package-contents summary, an honest confidence
// snapshot, and downloadable artifacts (a JSON validation report and a manual Canvas
// sandbox import checklist).
//
// IMPORTANT: this is presentation only. It never claims Canvas compatibility — local
// validation and Canvas sandbox import are reported as separate, honest states.
// ============================================================================

import type { CourseProject, EditorTab, ExportValidationIssue, ExportValidationReport, ReadinessReport } from "../types";
import { hasUnsafeHtml } from "./htmlSafety";
import { tabForCheck } from "./overviewSummary";

// ---------------------------------------------------------------------------
// Export checklist (derived from the course, works before validation runs)
// ---------------------------------------------------------------------------

export type ChecklistStatus = "pass" | "warn" | "fail" | "na";

export interface ChecklistItem {
  id: string;
  label: string;
  status: ChecklistStatus;
  detail: string;
  tab: EditorTab;
}

const presence = (ok: boolean, whenFail: ChecklistStatus = "fail"): ChecklistStatus => (ok ? "pass" : whenFail);

export const exportChecklist = (course: CourseProject): ChecklistItem[] => {
  const ids = new Set<string>([
    ...course.pages.map((page) => page.id),
    ...course.assignments.map((assignment) => assignment.id),
    ...course.discussions.map((discussion) => discussion.id),
    ...course.quizzes.map((quiz) => quiz.id)
  ]);
  const noBrokenRefs = course.modules.every((module) => module.items.every((item) => ids.has(item.refId)));
  const unsafeBlocks = [
    ...course.pages.map((page) => page.bodyHtml),
    ...course.assignments.map((assignment) => assignment.descriptionHtml),
    ...course.discussions.map((discussion) => discussion.promptHtml)
  ].filter(hasUnsafeHtml).length;
  const weightTotal = Math.round(course.assignmentGroups.reduce((sum, group) => sum + Number(group.weight || 0), 0));
  const syllabus = course.pages.find((page) => page.slug === "syllabus");

  return [
    { id: "metadata", label: "Course metadata present", status: presence(Boolean(course.title.trim() && course.description.trim())), detail: course.title.trim() ? `“${course.title}”` : "Add a course title and description.", tab: "Overview" },
    { id: "homepage", label: "Homepage present", status: presence(course.pages.some((page) => page.frontPage)), detail: course.pages.some((page) => page.frontPage) ? "Front page is set." : "No front page is set.", tab: "Homepage" },
    { id: "syllabus", label: "Syllabus present", status: presence(Boolean(syllabus)), detail: syllabus ? "Syllabus page is generated." : "No syllabus page found.", tab: "Syllabus" },
    { id: "modules", label: "Modules present", status: presence(course.modules.length > 0), detail: `${course.modules.length} module(s).`, tab: "Modules" },
    { id: "pages", label: "Pages present", status: presence(course.pages.length > 0), detail: `${course.pages.length} page(s).`, tab: "Pages" },
    { id: "assignments", label: "Assignments present", status: presence(course.assignments.length > 0, "warn"), detail: `${course.assignments.length} assignment(s).`, tab: "Assignments" },
    { id: "discussions", label: "Discussions present", status: presence(course.discussions.length > 0, "warn"), detail: `${course.discussions.length} discussion(s).`, tab: "Discussions" },
    { id: "quizzes", label: "Quizzes present", status: presence(course.quizzes.length > 0, "warn"), detail: `${course.quizzes.length} quiz/quizzes.`, tab: "Quizzes" },
    { id: "rubrics", label: "Rubrics present", status: presence(course.rubrics.length > 0, "warn"), detail: `${course.rubrics.length} rubric(s).`, tab: "Rubrics" },
    { id: "assignment-groups", label: "Assignment groups present", status: presence(course.assignmentGroups.length > 0), detail: `${course.assignmentGroups.length} group(s).`, tab: "Gradebook Setup" },
    { id: "outcomes", label: "Outcomes present", status: presence(course.outcomes.length > 0), detail: `${course.outcomes.length} outcome(s).`, tab: "Overview" },
    { id: "weights", label: "Grade weights total 100%", status: presence(weightTotal === 100), detail: `Weights total ${weightTotal}%.`, tab: "Gradebook Setup" },
    { id: "module-refs", label: "No broken module item references", status: presence(noBrokenRefs), detail: noBrokenRefs ? "Every module item resolves." : "A module item points at a missing object.", tab: "Modules" },
    { id: "unsafe-html", label: "No unsafe HTML detected", status: presence(unsafeBlocks === 0), detail: unsafeBlocks === 0 ? "Content avoids scripts, embeds, and event handlers." : `${unsafeBlocks} content block(s) include unsafe HTML.`, tab: "Pages" },
    { id: "printable-syllabus", label: "Printable syllabus available", status: syllabus ? "pass" : "na", detail: syllabus ? "A printable syllabus is generated alongside the syllabus page." : "No syllabus, so no printable syllabus.", tab: "Syllabus" }
  ];
};

// ---------------------------------------------------------------------------
// Enriched + grouped validation issues
// ---------------------------------------------------------------------------

export interface RichIssue extends ExportValidationIssue {
  tab: EditorTab;
  category: string;
  why: string;
  fix: string;
}

// Route an export issue id to the tab that fixes it. Package/manifest issues stay on Export;
// content issues route to their builder tab (reusing the Overview check→tab map).
export const tabForExportIssue = (id: string): EditorTab => {
  if (/^(unsafe-html-|placeholder-link-|broken-internal-link-)/.test(id)) return "Pages";
  if (/^(manifest-|course-settings-|canvas-export-|module-meta-|duplicate-resource-|missing-resource-|missing-file-|empty-required-|malformed-xml-)/.test(id)) return "Export";
  if (/group|weight/.test(id)) return "Gradebook Setup";
  return tabForCheck(id);
};

const guidanceFor = (id: string): { category: string; why: string; fix: string } => {
  if (/^malformed-xml-/.test(id)) return { category: "Malformed XML", why: "Canvas stops importing the moment its parser hits malformed XML.", fix: "Regenerate the affected object so its descriptor is well-formed." };
  if (/unsafe-html|-unsafe-html$/.test(id)) return { category: "Unsafe HTML", why: "Canvas strips scripts, embeds, and event handlers on import, so the content would not survive.", fix: "Open the flagged item and remove the unsafe markup." };
  if (/^duplicate-resource-/.test(id)) return { category: "Manifest integrity", why: "Two resources sharing one identifier make the manifest ambiguous and Canvas may drop one.", fix: "Give the conflicting objects distinct ids, usually by regenerating them." };
  if (/^(empty-required-|missing-file-|missing-resource-|manifest-missing|.*-missing$)/.test(id)) return { category: "Package files", why: "A required Common Cartridge file is missing or empty, so Canvas cannot build the course.", fix: "Regenerate the package; if it persists, fix the object that owns this file." };
  if (/broken-module-ref-|module-object-alignment-/.test(id)) return { category: "Module references", why: "A module item points at an object that is not in the package, leaving a dead link in Modules.", fix: "Remove the orphan item or restore the object it references." };
  if (/broken-internal-link-|placeholder-link-/.test(id)) return { category: "Links", why: "An internal link points at a page or file that is not in the package.", fix: "Fix or remove the link in the source content." };
  if (/group|weight/.test(id)) return { category: "Gradebook", why: "Gradebook weighting must total 100% with every graded group weighted.", fix: "Open Gradebook Setup and rebalance the weights." };
  if (/due-date/.test(id)) return { category: "Schedule", why: "Graded items need valid due dates when scheduling is enabled.", fix: "Set or correct the due date for the flagged item." };
  if (/outcome/.test(id)) return { category: "Outcomes", why: "Graded work and rubrics should align to at least one valid course outcome.", fix: "Align the flagged item to a course outcome." };
  return { category: "Quality", why: "This check keeps the exported course consistent and import-ready.", fix: "Open the related tab and resolve the flagged detail." };
};

export const toRichIssue = (issue: ExportValidationIssue): RichIssue => ({ ...issue, tab: tabForExportIssue(issue.id), ...guidanceFor(issue.id) });

export interface GroupedIssues {
  blocking: RichIssue[];
  warnings: RichIssue[];
}

export const groupValidationIssues = (report: ExportValidationReport | null): GroupedIssues => {
  if (!report) return { blocking: [], warnings: [] };
  const rich = report.issues.map(toRichIssue);
  return {
    blocking: rich.filter((issue) => issue.severity === "error"),
    warnings: rich.filter((issue) => issue.severity === "warning")
  };
};

// ---------------------------------------------------------------------------
// Package contents + confidence
// ---------------------------------------------------------------------------

export interface PackageContents {
  pages: number;
  modules: number;
  assignments: number;
  discussions: number;
  quizzes: number;
  rubrics: number;
  assignmentGroups: number;
  outcomes: number;
  files: number | null;
}

export const packageContents = (course: CourseProject, report: ExportValidationReport | null): PackageContents => ({
  pages: course.pages.length,
  modules: course.modules.length,
  assignments: course.assignments.length,
  discussions: course.discussions.length,
  quizzes: course.quizzes.length,
  rubrics: course.rubrics.length,
  assignmentGroups: course.assignmentGroups.length,
  outcomes: course.outcomes.length,
  files: report ? report.files.length : null
});

export type LocalValidationState = "Passed" | "Blocked" | "Not run";

export interface ExportConfidence {
  packageScore: number | null;
  courseScore: number;
  localValidation: LocalValidationState;
  sandboxLabel: string;
  blockers: number | null;
  warnings: number | null;
  downloadable: boolean;
}

export const exportConfidence = (report: ExportValidationReport | null, readiness: ReadinessReport): ExportConfidence => ({
  packageScore: report ? report.score : null,
  courseScore: readiness.score,
  localValidation: report ? (report.valid ? "Passed" : "Blocked") : "Not run",
  // Honest by construction: we never assert Canvas compatibility from local checks alone.
  sandboxLabel: report?.sandboxImportStatus === "passed" ? "Verified" : "Not verified",
  blockers: report ? report.issues.filter((issue) => issue.severity === "error").length : null,
  warnings: report ? report.issues.filter((issue) => issue.severity === "warning").length : null,
  downloadable: Boolean(report?.valid)
});

// ---------------------------------------------------------------------------
// Downloadable artifacts
// ---------------------------------------------------------------------------

export const buildValidationReportJson = (course: CourseProject, report: ExportValidationReport, readiness: ReadinessReport): string =>
  JSON.stringify(
    {
      generatedBy: "RocketCourse Canvas Builder",
      disclaimer: "Local package validation only. Canvas sandbox import has NOT been verified; do not treat this as proof of Canvas compatibility.",
      course: { title: course.title, packageName: report.packageName },
      checkedAt: report.checkedAt,
      localValidation: {
        valid: report.valid,
        score: report.score,
        blockers: report.issues.filter((issue) => issue.severity === "error").length,
        warnings: report.issues.filter((issue) => issue.severity === "warning").length
      },
      canvasSandboxImportStatus: report.sandboxImportStatus,
      courseReadinessScore: readiness.score,
      packageFileCount: report.files.length,
      issues: report.issues,
      files: report.files
    },
    null,
    2
  );

// A copy-pasteable manual checklist for importing into a Canvas sandbox and verifying the result —
// the step RocketCourse cannot perform itself.
export const buildImportChecklistText = (course: CourseProject, report: ExportValidationReport | null): string => {
  const blockers = report ? report.issues.filter((issue) => issue.severity === "error").length : null;
  const warnings = report ? report.issues.filter((issue) => issue.severity === "warning").length : null;
  const lines: string[] = [
    "RocketCourse → Canvas import & verification checklist",
    `Package: ${report?.packageName ?? `${course.title}.imscc`}`,
    report ? `Local validation: ${report.valid ? "Passed" : "Blocked"} (score ${report.score}, ${blockers} blocker(s), ${warnings} warning(s))` : "Local validation: not run yet",
    "",
    "IMPORTANT: This package passed LOCAL validation only. Canvas sandbox import has NOT been verified.",
    "Import into a NON-production Canvas course first.",
    "",
    "Before importing:",
    `[ ] Resolve ${blockers ?? "all"} blocking issue(s) in RocketCourse's Export tab.`,
    "[ ] Skim the warnings; decide which to fix now.",
    "",
    "Import into a Canvas sandbox:",
    "[ ] Open a sandbox/test Canvas course.",
    "[ ] Settings → Import Course Content.",
    "[ ] Content Type → Canvas Course Export Package / Common Cartridge.",
    `[ ] Choose ${report?.packageName ?? "the .imscc file"}.`,
    "[ ] Run the import and wait for it to finish.",
    "",
    "Verify after import:",
    "[ ] Modules appear in order with all items.",
    "[ ] Homepage and syllabus render; printable syllabus opens.",
    "[ ] Assignment groups exist and weights total 100%.",
    "[ ] Rubrics are attached to assignments and graded discussions.",
    "[ ] Quizzes render and can be graded.",
    "[ ] Pages render with no missing content or broken links.",
    "[ ] The instructor-only module is unpublished.",
    "[ ] Re-importing into an existing course may duplicate content — confirm before doing so."
  ];
  return lines.join("\n");
};
