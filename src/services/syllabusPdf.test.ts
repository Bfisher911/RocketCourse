import { describe, expect, it } from "vitest";
import { sampleProject } from "./courseGenerator";
import { buildSyllabusPdfBlob, findSyllabusPage, syllabusPdfFileName } from "./syllabusPdf";

describe("syllabus PDF", () => {
  it("finds the syllabus page in the sample course", () => {
    const page = findSyllabusPage(sampleProject);
    expect(page).toBeTruthy();
    expect(page?.slug === "syllabus" || /syllabus/i.test(page?.title ?? "")).toBe(true);
  });

  it("produces a valid, ASCII-only PDF aligned with the syllabus page", async () => {
    const blob = buildSyllabusPdfBlob(sampleProject);
    expect(blob.type).toBe("application/pdf");
    const text = await blob.text();
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(/[^\x00-\x7F]/.test(text)).toBe(false);
    const pageCount = (text.match(/\/Type \/Page\b/g) ?? []).length;
    const declared = Number(/\/Type \/Pages \/Kids \[[^\]]*\] \/Count (\d+)/.exec(text)?.[1] ?? "0");
    expect(declared).toBe(pageCount);
  });

  it("names the file with a -syllabus.pdf suffix", () => {
    expect(syllabusPdfFileName(sampleProject)).toMatch(/-syllabus\.pdf$/);
  });
});
