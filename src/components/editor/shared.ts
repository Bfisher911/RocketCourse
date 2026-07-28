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

export const readinessTab = (id: string): EditorTab => {
  if (id.startsWith("homepage")) return "Homepage";
  if (id.startsWith("syllabus")) return "Syllabus";
  if (id.startsWith("discussion")) return "Discussions";
  if (id.startsWith("quiz")) return "Quizzes";
  if (id.startsWith("rubric")) return "Rubrics";
  if (id.startsWith("assignment-group") || /^(weight|weights|nonzero-weight)/.test(id)) return "Gradebook Setup";
  if (id.startsWith("assignment")) return "Assignments";
  if (/^(workload|contact|calendar|schedule|due-date|graded-due)/.test(id)) return "Contact Hours";
  if (/^(export|instructor-pdf|syllabus-pdf|human-review|reference-integrity)/.test(id)) return "Export";
  if (/^(module|required-modules|content-module|start-here|instructor-unpublished)/.test(id)) return "Modules";
  if (/^(page-quality|internal-links|placeholder-links|thin-content|empty-content)/.test(id)) return "Pages";
  return "Overview"; // outcomes, objectives, bloom, accessibility, navigation, alignment-map
};
