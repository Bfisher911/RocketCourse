import { describe, it, expect } from "vitest";
import type { CourseProject } from "../types";
import { buildImsccZip } from "./imsccExport";
import { generateCourseProject } from "./courseGenerator";
import { defaultSettings } from "../data/defaultSettings";

const courseWithQuiz = (): CourseProject => generateCourseProject({ prompt: "Intro to Marine Biology", settings: defaultSettings });
const metaFor = async (course: CourseProject, quizId: string): Promise<string> => {
  const zip = await buildImsccZip(course);
  return (await zip.file(`${quizId}/assessment_meta.xml`)?.async("text")) ?? "";
};

describe("quiz attempts + shuffle export", () => {
  it("defaults to 1 attempt and no shuffle when unset", async () => {
    const course = courseWithQuiz();
    expect(course.quizzes.length).toBeGreaterThan(0);
    const meta = await metaFor(course, course.quizzes[0].id);
    expect(meta).toContain("<allowed_attempts>1</allowed_attempts>");
    expect(meta).toContain("<shuffle_answers>false</shuffle_answers>");
  });

  it("exports per-quiz allowedAttempts and shuffleAnswers when set", async () => {
    const course = courseWithQuiz();
    const quizId = course.quizzes[0].id;
    const edited = { ...course, quizzes: course.quizzes.map((quiz, index) => (index === 0 ? { ...quiz, allowedAttempts: 3, shuffleAnswers: true } : quiz)) };
    const meta = await metaFor(edited, quizId);
    expect(meta).toContain("<allowed_attempts>3</allowed_attempts>");
    expect(meta).toContain("<shuffle_answers>true</shuffle_answers>");
  });

  it("supports unlimited attempts (-1)", async () => {
    const course = courseWithQuiz();
    const quizId = course.quizzes[0].id;
    const edited = { ...course, quizzes: course.quizzes.map((quiz, index) => (index === 0 ? { ...quiz, allowedAttempts: -1 } : quiz)) };
    const meta = await metaFor(edited, quizId);
    expect(meta).toContain("<allowed_attempts>-1</allowed_attempts>");
  });
});
