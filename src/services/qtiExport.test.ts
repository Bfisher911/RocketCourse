import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { sampleProject } from "./courseGenerator";
import { generateAllQuizzesQtiBlob, generateQuizQtiBlob } from "./imsccExport";
import { collectXmlParseErrors } from "./xmlWellFormed";

describe("standalone QTI export", () => {
  it("exports a single quiz as a Canvas-importable QTI zip", async () => {
    const quiz = sampleProject.quizzes[0];
    const { blob, fileName } = await generateQuizQtiBlob(quiz);
    expect(fileName).toMatch(/-qti\.zip$/);

    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const manifest = await zip.file("imsmanifest.xml")?.async("text");
    expect(manifest).toBeTruthy();
    expect(manifest).toContain(quiz.id);
    expect(manifest).toContain("imsqti_xmlv1p2");
    expect(zip.file(`${quiz.id}/assessment_qti.xml`)).toBeTruthy();
    // The assessment carries real item content.
    const assessment = await zip.file(`${quiz.id}/assessment_qti.xml`)?.async("text");
    expect(assessment).toContain("<assessment");
    expect(await collectXmlParseErrors(zip)).toEqual([]);
  });

  it("exports all quizzes as one bulk QTI zip", async () => {
    const { blob, fileName, count } = await generateAllQuizzesQtiBlob(sampleProject);
    expect(count).toBe(sampleProject.quizzes.length);
    expect(fileName).toMatch(/all-quizzes-qti\.zip$/);

    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    for (const quiz of sampleProject.quizzes) {
      expect(zip.file(`${quiz.id}/assessment_qti.xml`), quiz.id).toBeTruthy();
    }
    const manifest = await zip.file("imsmanifest.xml")?.async("text");
    sampleProject.quizzes.forEach((quiz) => expect(manifest).toContain(quiz.id));
    expect(await collectXmlParseErrors(zip)).toEqual([]);
  });
});
