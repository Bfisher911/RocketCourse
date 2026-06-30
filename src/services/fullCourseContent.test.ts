import { describe, expect, it, vi } from "vitest";
import { defaultSettings } from "../data/defaultSettings";
import { generateCourseProject } from "./courseGenerator";
import type { AiResult } from "./aiAssist";
import type { QuizQuestion } from "../types";

// Mock the per-object builders so the orchestrator is tested without the network. Each returns a
// tagged AiResult so we can assert that content is applied and counts are tallied correctly.
vi.mock("./aiBuilders", () => ({
  aiGeneratePageBody: vi.fn(async (): Promise<AiResult<string>> => ({ source: "ai", value: "<p>AI lesson body</p>" })),
  aiGenerateAssignmentDescription: vi.fn(async (): Promise<AiResult<string>> => ({ source: "ai", value: "<p>AI assignment</p>" })),
  aiGenerateDiscussionPrompt: vi.fn(async (): Promise<AiResult<string>> => ({ source: "ai", value: "<p>AI discussion</p>" })),
  aiGenerateQuizQuestions: vi.fn(
    async (_course: unknown, quiz: { id: string; alignedOutcomeIds: string[]; moduleId: string }): Promise<AiResult<QuizQuestion[]>> => ({
      source: "ai",
      value: [
        {
          id: `${quiz.id}_ai_1`,
          type: "multiple_choice",
          stem: "AI generated stem?",
          choices: ["a", "b"],
          correctAnswer: "a",
          difficulty: "balanced",
          alignedOutcomeIds: quiz.alignedOutcomeIds,
          moduleId: quiz.moduleId,
          points: 3
        }
      ]
    })
  )
}));

import { fillEntireCourseContent, isFillablePage, planFullCourseFill } from "./fullCourseContent";
import * as builders from "./aiBuilders";

const makeCourse = () =>
  generateCourseProject({
    prompt: "Build me a 4-week course on Coastal Ecology.",
    settings: {
      ...defaultSettings,
      title: "Coastal Ecology",
      moduleCount: 4,
      lengthWeeks: 4,
      assignmentCadence: "every-module",
      discussionFrequency: "weekly",
      quizFrequency: "weekly"
    }
  });

describe("planFullCourseFill", () => {
  it("counts only lecture pages plus every assignment, discussion, and quiz", () => {
    const course = makeCourse();
    const plan = planFullCourseFill(course);
    const lecturePages = course.pages.filter(isFillablePage);

    expect(plan.pages).toBe(lecturePages.length);
    expect(plan.assignments).toBe(course.assignments.length);
    expect(plan.discussions).toBe(course.discussions.length);
    expect(plan.quizzes).toBe(course.quizzes.length);
    expect(plan.total).toBe(plan.pages + plan.assignments + plan.discussions + plan.quizzes);
    expect(plan.total).toBeGreaterThan(0);
  });

  it("treats lecture pages as fillable but leaves overview/front pages alone", () => {
    const course = makeCourse();
    const lecture = course.pages.find((page) => /lecture/i.test(page.slug));
    const overview = course.pages.find((page) => /^About /i.test(page.title));
    const front = course.pages.find((page) => page.frontPage);

    expect(lecture && isFillablePage(lecture)).toBe(true);
    if (overview) expect(isFillablePage(overview)).toBe(false);
    if (front) expect(isFillablePage(front)).toBe(false);
  });
});

describe("fillEntireCourseContent", () => {
  it("applies AI content across every content type and reports counts", async () => {
    const course = makeCourse();
    const plan = planFullCourseFill(course);
    const progress: number[] = [];

    const result = await fillEntireCourseContent(course, { onProgress: (p) => progress.push(p.completed) });

    expect(result.total).toBe(plan.total);
    expect(result.aiCount).toBe(plan.total);
    expect(result.fallbackCount).toBe(0);
    expect(result.applied.pages).toBe(plan.pages);
    expect(result.applied.assignments).toBe(plan.assignments);
    expect(result.applied.quizzes).toBe(plan.quizzes);

    // Content actually merged in.
    expect(result.course.assignments.every((a) => a.descriptionHtml.includes("AI assignment"))).toBe(true);
    expect(result.course.discussions.every((d) => d.promptHtml.includes("AI discussion"))).toBe(true);
    expect(result.course.pages.filter(isFillablePage).every((p) => p.bodyHtml.includes("AI lesson body"))).toBe(true);
    // Quiz questions replaced (not appended) and points recomputed from the new set.
    const quiz = result.course.quizzes[0];
    expect(quiz.questions).toHaveLength(1);
    expect(quiz.points).toBe(3);

    // Progress fired once per object, ending at the total.
    expect(progress[progress.length - 1]).toBe(plan.total);
  });

  it("keeps existing content when a builder falls back to its template", async () => {
    const course = makeCourse();
    const originalQuestions = course.quizzes[0].questions.length;
    vi.mocked(builders.aiGenerateQuizQuestions).mockResolvedValueOnce({ source: "deterministic", value: [], note: "offline" });

    const result = await fillEntireCourseContent(course, { concurrency: 1 });

    expect(result.fallbackCount).toBeGreaterThanOrEqual(1);
    // The fallback quiz kept its generated questions instead of being wiped.
    expect(result.course.quizzes[0].questions.length).toBe(originalQuestions);
  });
});
