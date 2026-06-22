// ============================================================================
// Full-course PDF export
// ----------------------------------------------------------------------------
// Produces a single, readable, multi-page PDF copy of the whole course (title
// page, outcomes, then every module's pages, assignments, discussions, and
// quizzes in Canvas order). Hand-rolled PDF 1.4 in the same minimal style the
// in-package syllabus/instructor PDFs use, so there is no extra dependency.
// Text is the deterministic, stripped content of each object — a faithful
// reading copy of what the instructor will import into Canvas.
// ============================================================================

import type { CourseProject } from "../types";
import { slugify, stripHtml } from "../utils/text";

interface PdfLine {
  text: string;
  size: number;
}

const PAGE_TOP = 760;
const PAGE_BOTTOM = 56;
const LEFT = 54;

// PDF text uses single-byte Helvetica (WinAnsi); restrict to printable ASCII so decoded Unicode
// can never desync the byte count from the declared /Length.
const pdfAsciiSafe = (value: string): string =>
  value
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[•✓✔→]/g, "-")
    .replace(/[^\x20-\x7E]/g, " ");

const pdfEscape = (value: string): string => pdfAsciiSafe(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

const lineHeight = (size: number): number => Math.round(size * 1.35) + 2;

// Greedy word-wrap to an approximate character budget for the given font size (Helvetica ~0.5em avg).
const wrap = (text: string, size: number): string[] => {
  const max = Math.max(20, Math.floor((612 - LEFT * 2) / (size * 0.5)));
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [""];
  const words = clean.split(" ");
  const out: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > max && current) {
      out.push(current);
      current = word.length > max ? word.slice(0, max) : word;
    } else {
      current = candidate.length > max ? candidate.slice(0, max) : candidate;
    }
  }
  if (current) out.push(current);
  return out;
};

// Paginate lines by accumulated height, then render each page's content stream from the top.
const createMultiPagePdf = (lines: PdfLine[]): string => {
  const pages: PdfLine[][] = [];
  let current: PdfLine[] = [];
  let y = PAGE_TOP;
  for (const line of lines) {
    const lh = lineHeight(line.size);
    if (y - lh < PAGE_BOTTOM && current.length) {
      pages.push(current);
      current = [];
      y = PAGE_TOP;
    }
    current.push(line);
    y -= lh;
  }
  if (current.length) pages.push(current);
  if (!pages.length) pages.push([{ text: "", size: 11 }]);

  const contentFor = (pageLines: PdfLine[]): string => {
    let py = PAGE_TOP;
    const parts: string[] = [];
    for (const line of pageLines) {
      parts.push(`BT /F1 ${line.size} Tf ${LEFT} ${py} Td (${pdfEscape(line.text)}) Tj ET`);
      py -= lineHeight(line.size);
    }
    return parts.join("\n");
  };

  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  const kids = pages.map((_, index) => `${4 + index * 2} 0 R`).join(" ");
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  pages.forEach((pageLines, index) => {
    const content = contentFor(pageLines);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + index * 2} 0 R >>`);
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });

  let body = "%PDF-1.4\n";
  const offsets: number[] = [0];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return body;
};

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
export const generateCoursePdfBlob = (course: CourseProject): Blob => new Blob([buildCoursePdf(course)], { type: "application/pdf" });

/** Suggested download file name for the course PDF. */
export const coursePdfFileName = (course: CourseProject): string => `${slugify(course.title || "course")}-course.pdf`;
