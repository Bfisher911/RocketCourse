// Shared leaf helpers for the extracted editor screens.
//
// A LEAF on purpose: App.tsx and the extracted screens both need these, so if
// they lived in App.tsx the screens would import App while App lazily imported
// them back — a cycle that, across a chunk boundary, fails at runtime rather
// than at build time.

import type { CourseModule, EditorTab, ObjectMetadata } from "../../types";
import type { ThemePreviewKind } from "../../services/themeDesign";

export const moveItem = <T,>(items: T[], fromIndex: number, toIndex: number): T[] => {
  const next = [...items];
  const [removed] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, removed);
  return next;
};

export const renumberModules = (modules: CourseModule[]): CourseModule[] =>
  modules.map((module, index) => ({ ...module, order: index, status: "edited" }));

export const editMetadata = (): ObjectMetadata => ({
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  exportVersion: 0,
  source: "edited"
});

export const themePreviewModes: Array<{ id: ThemePreviewKind; label: string }> = [
  { id: "homepage", label: "Homepage" },
  { id: "syllabus", label: "Syllabus" },
  { id: "assignment", label: "Assignment" },
  { id: "quiz", label: "Quiz" },
  { id: "rubric", label: "Rubric" }
];

/**
 * The tab that fixes a readiness check. Aliases the one canonical table so the
 * editor rail, the readiness drawer, the Overview cards and the guided journey
 * all send the user to the SAME place — this used to be a second, independent
 * regex chain that disagreed with services/overviewSummary.ts.
 */
export { tabForCheck as readinessTab } from "../../services/readinessTabs";
