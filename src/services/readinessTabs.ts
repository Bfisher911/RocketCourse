// The single source of truth for "which editor tab fixes this readiness check?".
//
// This used to be two independent regex chains — readinessTab() in
// components/editor/shared.ts and tabForCheck() here-ish in overviewSummary.ts —
// which disagreed for real checks: `accessibility` went to Overview in one and
// Pages in the other, `navigation` to Overview vs Theme, `reference-integrity`
// to Export vs Modules, `schedule`/`due-date` to Contact Hours vs Modules, and
// the two fallbacks differed (Overview vs Export). The same failing check sent
// the user somewhere different depending on which surface they clicked from.
//
// It is now one EXPLICIT table rather than prefix matching, because prefix rules
// are what let the two drift apart silently: a new check id would quietly land
// in whichever bucket happened to match first. An unmapped id is a deliberate
//, visible decision (see the fallback note below), and readinessTabs.test.ts
// asserts every id the readiness report can emit is listed here.
//
// The destination is where the user can ACTUALLY FIX the thing — not where the
// thing is displayed.

import type { EditorTab } from "../screens/appModel";

const CHECK_TABS: Record<string, EditorTab> = {
  // Outcomes and course-level identity
  // Announcements are edited from the course command centre, not a content tab.
  "announcement-distinctness": "Overview",
  objectives: "Overview",
  "objective-quality": "Overview",
  "objective-measurable": "Overview",
  "objective-distinctness": "Overview",
  "orphaned-outcomes": "Overview",
  "graded-outcomes": "Overview",
  bloom: "Overview",
  // No UI edits course.navigation today, so there is no "fix it here" surface.
  // The command center is the honest landing spot rather than a tab that would
  // leave the user hunting for a control that does not exist.
  navigation: "Overview",

  // Homepage
  homepage: "Homepage",
  "homepage-module-directory": "Homepage",
  "start-here-link": "Homepage",
  "calendar-link": "Homepage",
  "visual-homepage-structure": "Homepage",
  "visual-support-info": "Homepage",

  // Syllabus
  syllabus: "Syllabus",
  "syllabus-outcomes": "Syllabus",
  "syllabus-quality": "Syllabus",
  "visual-syllabus-sections": "Syllabus",

  // Modules and structure
  "required-modules": "Modules",
  "module-not-empty": "Modules",
  "module-boundaries": "Modules",
  "module-refs": "Modules",
  "module-objectives": "Modules",
  "module-object-alignment": "Modules",
  "module-completion-checklist": "Modules",
  "content-module-depth": "Modules",
  "activity-density": "Modules",
  "start-here-content": "Modules",
  "instructor-unpublished": "Modules",
  "resource-verification": "Modules",
  "visual-module-overviews": "Modules",
  "visual-module-action-steps": "Modules",
  "visual-start-here-guidance": "Modules",
  // Dangling cross-object references are repaired by fixing the module items
  // that point at deleted content — Modules, not Export.
  "reference-integrity": "Modules",

  // Page bodies and the HTML inside them
  "page-quality": "Pages",
  "empty-content": "Pages",
  "thin-content": "Pages",
  "content-length": "Pages",
  "content-heading-duplicates": "Pages",
  "visual-heading-order": "Pages",
  "internal-links": "Pages",
  "placeholder-links": "Pages",
  // Dead anchors come from AI-written bodies across pages, assignments, discussions and
  // announcements; Pages is where the bulk of that HTML is authored and fixed.
  "dead-anchors": "Pages",
  "alignment-map": "Pages",
  // Unsafe Canvas HTML lives in page/assignment/discussion bodies; Pages is
  // where the bulk of it is authored and fixed.
  accessibility: "Pages",
  "visual-html-safety": "Pages",

  // Imagery — alt text is edited in the Imagery tab (neither previous map sent
  // the user there, which is why this check felt unfixable).
  "visual-image-alt": "Imagery",

  // Assessment
  "assignment-quality": "Assignments",
  "visual-assignment-launchpads": "Assignments",
  "discussion-quality": "Discussions",
  "visual-discussion-guidance": "Discussions",
  "start-here-question-forum": "Discussions",
  "quiz-quality": "Quizzes",
  rubrics: "Rubrics",
  "rubric-depth": "Rubrics",
  "rubric-outcomes": "Rubrics",
  "rubric-quality": "Rubrics",

  // Grading setup
  weights: "Gradebook Setup",
  "weight-bounds": "Gradebook Setup",
  "assignment-groups": "Gradebook Setup",
  "nonzero-weight-groups": "Gradebook Setup",

  // Schedule and workload
  workload: "Contact Hours",
  "calendar-page": "Contact Hours",
  "schedule-start-date": "Contact Hours",
  "graded-due-dates": "Contact Hours",
  "due-dates-decided": "Contact Hours",
  "due-date-blackouts": "Contact Hours",
  "due-date-term": "Contact Hours",

  // Theme
  "visual-theme-contrast": "Theme",
  "visual-pattern-consistency": "Theme",
  "visual-polish-score": "Theme",

  // Packaging artifacts
  "syllabus-pdf": "Export",
  "instructor-pdf": "Export",
  "human-review-checklist": "Export",
  "human-review-page": "Export"
};

/**
 * The tab that fixes a readiness check. Unknown ids land on Overview — the
 * command center — rather than a guess, so a newly added check is never
 * silently routed somewhere misleading.
 */
export const tabForCheck = (id: string): EditorTab => CHECK_TABS[id] ?? "Overview";

/** Exposed for the test that keeps this table in sync with readiness.ts. */
export const mappedCheckIds = (): string[] => Object.keys(CHECK_TABS);

/**
 * Whether an id is a readiness check at all. Export VALIDATION issues live in a
 * different namespace — they embed generated object ids
 * (`missing-assignment-a1`, `quiz-quality-q1-stem`) and so must be matched by
 * substring, not looked up here. See tabForExportIssue in exportSummary.ts.
 */
export const isKnownCheckId = (id: string): boolean => id in CHECK_TABS;
