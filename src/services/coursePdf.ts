// ============================================================================
// Full-course PDF export
// ----------------------------------------------------------------------------
// Produces a single, readable, multi-page PDF copy of the whole course (title
// page, outcomes, then every module's pages, assignments, discussions, and
// quizzes in Canvas order). Uses the shared, dependency-free PDF engine in
// pdfDoc.ts. Text is the deterministic, stripped content of each object — a
// faithful reading copy of what the instructor will import into Canvas.
// ============================================================================

import type { CourseProject } from "../types";
import { slugify, stripHtml } from "../utils/text";
import { createMultiPagePdf, pdfBlobFrom, wrap, type PdfLine } from "./pdfDoc";

// Walk the course into a flat, ordered list of typographic lines.
const coursePdfLines = (course: CourseProject): PdfLine[] => {
  const lines: PdfLine[] = [];
  const heading = (text: string, size: number): void => {
    lines.push({ text: "", size: 6 });
    wrap(text, size).forEach((part) => lines.push({ text: part, size }));
  };
  const para = (text: string): void => {
    const clean = stripHtml(text).replace(/\s+/g, " ").trim();
    if (clean) wrap(clean, 11).forEach((part) => lines.push({ text: part, size: 11 }));
  };
  const bullet = (text: string): void => wrap(`- ${text}`, 11).forEach((part) => lines.push({ text: part, size: 11 }));

  // Title block
  wrap(course.title, 24).forEach((part) => lines.push({ text: part, size: 24 }));
  if (course.description) para(course.description);
  lines.push({ text: "", size: 8 });

  if (course.outcomes.length) {
    heading("Course Learning Outcomes", 15);
    course.outcomes.forEach((outcome) => bullet(`${outcome.code}: ${outcome.text} (${outcome.bloomLevel})`));
  }

  const byId = <T extends { id: string }>(items: T[], id: string): T | undefined => items.find((item) => item.id === id);

  [...course.modules]
    .sort((a, b) => a.order - b.order)
    .forEach((module) => {
      heading(module.title, 16);
      if (module.description) para(module.description);
      if (module.objectives?.length) {
        para("Objectives:");
        module.objectives.forEach((objective) => bullet(objective));
      }
      module.items.forEach((item) => {
        const page = byId(course.pages, item.refId);
        if (page) {
          heading(page.title, 13);
          para(page.bodyHtml);
          return;
        }
        const assignment = byId(course.assignments, item.refId);
        if (assignment) {
          heading(`Assignment: ${assignment.title}`, 13);
          para(assignment.descriptionHtml);
          return;
        }
        const discussion = byId(course.discussions, item.refId);
        if (discussion) {
          heading(`Discussion: ${discussion.title}`, 13);
          para(discussion.promptHtml);
          return;
        }
        const quiz = byId(course.quizzes, item.refId);
        if (quiz) {
          heading(`Quiz: ${quiz.title}`, 13);
          para(quiz.purpose);
          quiz.questions.forEach((question, index) => bullet(`Q${index + 1}. ${stripHtml(question.stem)}`));
        }
      });
    });

  return lines;
};

/** Build the raw PDF document string for the whole course. */
export const buildCoursePdf = (course: CourseProject): string => createMultiPagePdf(coursePdfLines(course));

/** A downloadable PDF Blob of the whole course. */
export const generateCoursePdfBlob = (course: CourseProject): Blob => pdfBlobFrom(buildCoursePdf(course));

/** Suggested download file name for the course PDF. */
export const coursePdfFileName = (course: CourseProject): string => `${slugify(course.title || "course")}-course.pdf`;
