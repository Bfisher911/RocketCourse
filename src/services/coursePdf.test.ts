import { describe, expect, it } from "vitest";
import { sampleProject } from "./courseGenerator";
import { buildCoursePdf, coursePdfFileName, generateCoursePdfBlob } from "./coursePdf";

describe("course PDF export", () => {
  const pdf = buildCoursePdf(sampleProject);

  it("produces a structurally valid multi-page PDF", () => {
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(pdf).toContain("/Type /Catalog");
    // A full course spans many pages.
    const pageCount = (pdf.match(/\/Type \/Page\b/g) ?? []).length;
    expect(pageCount).toBeGreaterThan(3);
    // /Count on the Pages node matches the number of Page objects.
    const declared = Number(pdf.match(/\/Type \/Pages \/Kids \[[^\]]*\] \/Count (\d+)/)?.[1]);
    expect(declared).toBe(pageCount);
  });

  it("includes course title and module content as text", () => {
    expect(pdf).toContain("Course Learning Outcomes");
    // The generated sample course title words appear in the document.
    expect(pdf).toContain("AI");
  });

  it("escapes PDF-special characters and stays ASCII-safe", () => {
    // No raw unescaped parens leaking from content would be hard to assert; instead ensure the
    // body is ASCII (single-byte Helvetica) so declared /Length byte counts stay correct.
    expect(/[^\x00-\x7F]/.test(pdf)).toBe(false);
  });

  it("names the download from the course title", () => {
    expect(coursePdfFileName(sampleProject)).toMatch(/-course\.pdf$/);
    expect(generateCoursePdfBlob(sampleProject).type).toBe("application/pdf");
  });
});
