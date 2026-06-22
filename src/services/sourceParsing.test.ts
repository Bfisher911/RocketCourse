import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { augmentPromptWithSources, buildSourcesDigest, parseSourceFile } from "./sourceParsing";
import type { SourceFile } from "../types";

// Minimal File polyfill helpers for the node test environment.
const textFile = (name: string, content: string, type = "text/plain"): File =>
  new File([content], name, { type });

describe("sourceParsing", () => {
  it("parses plain text and markdown to real extracted text", async () => {
    const result = await parseSourceFile(textFile("syllabus.txt", "Week 1: Intro to AI\nWeek 2: Ethics"));
    expect(result.status).toBe("parsed");
    expect(result.text).toContain("Intro to AI");
    expect(result.chars).toBeGreaterThan(0);
    expect(result.kind).toBe("txt");
  });

  it("strips HTML tags to readable text", async () => {
    const result = await parseSourceFile(textFile("notes.html", "<h1>Outcomes</h1><p>Explain <b>bias</b> in models.</p>", "text/html"));
    expect(result.status).toBe("parsed");
    expect(result.text).toContain("Outcomes");
    expect(result.text).toContain("bias");
    expect(result.text).not.toContain("<h1>");
  });

  it("extracts text from a real .docx (zip) document", async () => {
    const zip = new JSZip();
    zip.file(
      "word/document.xml",
      `<?xml version="1.0"?><w:document xmlns:w="x"><w:body><w:p><w:r><w:t>Course on machine learning ethics.</w:t></w:r></w:p><w:p><w:r><w:t>Module one covers fairness.</w:t></w:r></w:p></w:body></w:document>`
    );
    const blob = await zip.generateAsync({ type: "arraybuffer" });
    const file = new File([blob], "syllabus.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    const result = await parseSourceFile(file);
    expect(result.status).toBe("parsed");
    expect(result.text).toContain("machine learning ethics");
    expect(result.text).toContain("fairness");
  });

  it("flags an unreadable PDF as needs-review instead of emitting garbage", async () => {
    // A tiny fake PDF with no extractable Tj strings.
    const result = await parseSourceFile(new File(["%PDF-1.4\n%binary\n"], "scan.pdf", { type: "application/pdf" }));
    expect(result.status).toBe("needs-review");
    expect(result.note).toMatch(/PDF/i);
  });

  it("builds a budgeted digest and augments the prompt", () => {
    const sources: SourceFile[] = [
      { id: "1", name: "a.txt", sizeLabel: "1 KB", status: "parsed", text: "Fairness and accountability." },
      { id: "2", name: "b.txt", sizeLabel: "1 KB", status: "parsed", text: "Transparency in AI systems." }
    ];
    const digest = buildSourcesDigest(sources);
    expect(digest).toContain("a.txt");
    expect(digest).toContain("Transparency");
    const augmented = augmentPromptWithSources("Build a course.", sources);
    expect(augmented.startsWith("Build a course.")).toBe(true);
    expect(augmented).toContain("source materials");
  });

  it("returns the original prompt when no sources have text", () => {
    const sources: SourceFile[] = [{ id: "1", name: "x.pdf", sizeLabel: "1 KB", status: "needs-review", text: "" }];
    expect(augmentPromptWithSources("Build a course.", sources)).toBe("Build a course.");
  });
});
