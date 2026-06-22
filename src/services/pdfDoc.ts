// ============================================================================
// Minimal, dependency-free PDF document builder
// ----------------------------------------------------------------------------
// A tiny hand-rolled PDF 1.4 writer shared by the course, quiz, answer-key, and
// syllabus PDF exports. Text is laid out as a flat list of typographic lines
// (Helvetica), greedily wrapped and paginated. No external dependency, and the
// byte length stays in sync with the declared /Length because all text is
// reduced to printable ASCII before it is written.
// ============================================================================

import { stripHtml } from "../utils/text";

export interface PdfLine {
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

const pdfEscape = (value: string): string =>
  pdfAsciiSafe(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

const lineHeight = (size: number): number => Math.round(size * 1.35) + 2;

// Greedy word-wrap to an approximate character budget for the given font size (Helvetica ~0.5em avg).
export const wrap = (text: string, size: number): string[] => {
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
export const createMultiPagePdf = (lines: PdfLine[]): string => {
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

/** Wrap a raw PDF document string in a downloadable Blob. */
export const pdfBlobFrom = (pdf: string): Blob => new Blob([pdf], { type: "application/pdf" });

/**
 * Accumulates typographic lines fluently, then renders a PDF. Keeps the four PDF exporters
 * consistent without each re-implementing heading/paragraph/bullet spacing.
 */
export class PdfDoc {
  private lines: PdfLine[] = [];

  /** Large document title. */
  title(text: string): this {
    wrap(text, 22).forEach((part) => this.lines.push({ text: part, size: 22 }));
    return this;
  }

  /** Section heading with a little space above it. */
  heading(text: string, size = 15): this {
    this.lines.push({ text: "", size: 6 });
    wrap(text, size).forEach((part) => this.lines.push({ text: part, size }));
    return this;
  }

  /** Plain paragraph; HTML is stripped to readable text. */
  para(text: string, size = 11): this {
    const clean = stripHtml(text).replace(/\s+/g, " ").trim();
    if (clean) wrap(clean, size).forEach((part) => this.lines.push({ text: part, size }));
    return this;
  }

  /** Bulleted line ("- text"). */
  bullet(text: string, size = 11): this {
    wrap(`- ${text}`, size).forEach((part) => this.lines.push({ text: part, size }));
    return this;
  }

  /** Vertical space. */
  spacer(size = 8): this {
    this.lines.push({ text: "", size });
    return this;
  }

  /** Raw line at a given size (no wrapping markers). */
  raw(text: string, size = 11): this {
    wrap(text, size).forEach((part) => this.lines.push({ text: part, size }));
    return this;
  }

  /** A blank answer-writing area: several ruled-feeling blank lines. */
  answerSpace(rows = 4): this {
    for (let i = 0; i < rows; i += 1) {
      this.lines.push({ text: "_".repeat(92), size: 11 });
      this.lines.push({ text: "", size: 4 });
    }
    return this;
  }

  build(): string {
    return createMultiPagePdf(this.lines);
  }

  blob(): Blob {
    return pdfBlobFrom(this.build());
  }
}
