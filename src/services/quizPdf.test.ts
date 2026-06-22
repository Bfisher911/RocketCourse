import { describe, expect, it } from "vitest";
import { sampleProject } from "./courseGenerator";
import {
  allQuizzesAnswerKeyPdfFileName,
  allQuizzesStudentPdfFileName,
  buildAllQuizzesAnswerKeyPdfBlob,
  buildAllQuizzesStudentPdfBlob,
  buildQuizAnswerKeyPdfBlob,
  buildQuizStudentPdfBlob,
  quizAnswerKeyPdfFileName,
  quizStudentPdfFileName
} from "./quizPdf";

const pdfText = async (blob: Blob): Promise<string> => await blob.text();
const quiz = sampleProject.quizzes[0];

describe("quiz PDFs", () => {
  it("produces a valid student PDF without leaking answers", async () => {
    expect(quiz).toBeTruthy();
    const blob = buildQuizStudentPdfBlob(sampleProject, quiz);
    expect(blob.type).toBe("application/pdf");
    const text = await pdfText(blob);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    // The student copy must NOT contain the answer-key marker.
    expect(text).not.toContain("ANSWER KEY");
    expect(text).not.toContain("<== correct");
  });

  it("produces an answer key PDF that is clearly instructor-only", async () => {
    const blob = buildQuizAnswerKeyPdfBlob(sampleProject, quiz);
    const text = await pdfText(blob);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("NOT FOR STUDENT DISTRIBUTION");
    // A multiple-choice quiz should surface the correct-answer marker somewhere.
    const hasChoiceQuestion = quiz.questions.some((q) => q.type === "multiple_choice" || q.type === "true_false");
    if (hasChoiceQuestion) expect(text).toContain("correct");
  });

  it("keeps the declared page count in sync (valid xref) for both copies", async () => {
    for (const blob of [buildQuizStudentPdfBlob(sampleProject, quiz), buildQuizAnswerKeyPdfBlob(sampleProject, quiz)]) {
      const text = await pdfText(blob);
      const pageCount = (text.match(/\/Type \/Page\b/g) ?? []).length;
      const declared = Number(/\/Type \/Pages \/Kids \[[^\]]*\] \/Count (\d+)/.exec(text)?.[1] ?? "0");
      expect(declared).toBe(pageCount);
      expect(pageCount).toBeGreaterThan(0);
    }
  });

  it("builds combined student + answer-key packets for all quizzes", async () => {
    const student = await pdfText(buildAllQuizzesStudentPdfBlob(sampleProject));
    const key = await pdfText(buildAllQuizzesAnswerKeyPdfBlob(sampleProject));
    expect(student.startsWith("%PDF-1.4")).toBe(true);
    expect(key).toContain("NOT FOR STUDENT DISTRIBUTION");
  });

  it("emits ASCII-only bytes so /Length never desyncs", async () => {
    const text = await pdfText(buildQuizAnswerKeyPdfBlob(sampleProject, quiz));
    expect(/[^\x00-\x7F]/.test(text)).toBe(false);
  });

  it("names files distinctly for student vs answer key", () => {
    expect(quizStudentPdfFileName(sampleProject, quiz)).toMatch(/-student\.pdf$/);
    expect(quizAnswerKeyPdfFileName(sampleProject, quiz)).toMatch(/-answer-key\.pdf$/);
    expect(allQuizzesStudentPdfFileName(sampleProject)).toMatch(/-all-quizzes-student\.pdf$/);
    expect(allQuizzesAnswerKeyPdfFileName(sampleProject)).toMatch(/-all-quizzes-answer-key\.pdf$/);
  });
});
