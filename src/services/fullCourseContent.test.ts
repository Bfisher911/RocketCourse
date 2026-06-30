import { describe, expect, it, vi } from "vitest";
import { defaultSettings } from "../data/defaultSettings";
import { generateCourseProject } from "./courseGenerator";
import type { AiResult } from "./aiAssist";
import type { HomepageContent, QuizQuestion, SyllabusContent } from "../types";

// Mock the per-object builders so the orchestrator is tested without the network. Each returns a
// tagged AiResult so we can assert that content is applied and counts are tallied correctly. The
// homepage/syllabus builders echo the current content (renderHomepage/renderSyllabus run for real).
vi.mock("./aiBuilders", () => ({
  aiGeneratePageBody: vi.fn(async (): Promise<AiResult<string>> => ({ source: "ai", value: "<p>AI lesson body</p>" })),
  aiGeneratePageProse: vi.fn(async (): Promise<AiResult<string>> => ({ source: "ai", value: "<p>AI prose paragraph</p>" })),
  aiGenerateAssignmentDescription: vi.fn(async (): Promise<AiResult<string>> => ({ source: "ai", value: "<p>AI assignment</p>" })),
  aiGenerateDiscussionPrompt: vi.fn(async (): Promise<AiResult<string>> => ({ source: "ai", value: "<p>AI discussion</p>" })),
  aiGenerateAnnouncementBody: vi.fn(async (): Promise<AiResult<string>> => ({ source: "ai", value: "<p>AI announcement</p>" })),
  aiGenerateHomepageContent: vi.fn(async (_c: unknown, current: HomepageContent): Promise<AiResult<HomepageContent>> => ({ source: "ai", value: { ...current, welcome: "AI homepage welcome." } })),
  aiGenerateSyllabusContent: vi.fn(async (_c: unknown, current: SyllabusContent): Promise<AiResult<SyllabusContent>> => ({ source: "ai", value: { ...current, courseDescription: "AI syllabus description." } })),
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
  it("counts every page (lectures, enriched pages, homepage, syllabus) plus activities and announcements", () => {
    const course = makeCourse();
    const plan = planFullCourseFill(course);

    // Every page is touched: lecture rewrite, enrichment, homepage, or syllabus.
    expect(plan.pages).toBe(course.pages.length);
    expect(plan.assignments).toBe(course.assignments.length);
    expect(plan.discussions).toBe(course.discussions.length);
    expect(plan.quizzes).toBe(course.quizzes.length);
    expect(plan.announcements).toBe(course.announcements.length);
    expect(plan.announcements).toBeGreaterThan(1); // welcome + periodic check-ins
    expect(plan.total).toBe(plan.pages + plan.assignments + plan.discussions + plan.quizzes + plan.announcements);
  });

  it("treats lecture pages as full-rewrite but never the homepage or syllabus", () => {
    const course = makeCourse();
    const lecture = course.pages.find((page) => /lecture/i.test(page.slug));
    const front = course.pages.find((page) => page.frontPage);
    const syllabus = course.pages.find((page) => page.slug === "syllabus");

    expect(lecture && isFillablePage(lecture)).toBe(true);
    if (front) expect(isFillablePage(front)).toBe(false);
    if (syllabus) expect(isFillablePage(syllabus)).toBe(false);
  });
});

describe("fillEntireCourseContent", () => {
  it("fills every surface with AI content and keeps structure on enriched pages", async () => {
    const course = makeCourse();
    const result = await fillEntireCourseContent(course);

    // Activities replaced with AI content.
    expect(result.course.assignments.every((a) => a.descriptionHtml.includes("AI assignment"))).toBe(true);
    expect(result.course.discussions.every((d) => d.promptHtml.includes("AI discussion"))).toBe(true);
    expect(result.course.announcements.every((a) => a.bodyHtml.includes("AI announcement"))).toBe(true);

    // Lecture pages fully rewritten; quiz questions replaced + points recomputed.
    expect(result.course.pages.filter(isFillablePage).every((p) => p.bodyHtml.includes("AI lesson body"))).toBe(true);
    expect(result.course.quizzes[0].questions).toHaveLength(1);
    expect(result.course.quizzes[0].points).toBe(3);

    // Homepage + syllabus re-rendered from AI-enriched content.
    const front = result.course.pages.find((p) => p.frontPage)!;
    expect(front.bodyHtml).toContain("AI homepage welcome.");
    expect(front.bodyHtml).toContain("About This Course"); // appended prose card
    expect(result.course.homepage?.content.welcome).toBe("AI homepage welcome.");
    expect(result.course.syllabus?.content.courseDescription).toBe("AI syllabus description.");

    // Enriched pages KEEP their original body and get prose appended (structure preserved).
    const enriched = course.pages.find((p) => !p.frontPage && p.slug !== "syllabus" && !isFillablePage(p))!;
    const after = result.course.pages.find((p) => p.id === enriched.id)!;
    expect(after.bodyHtml.startsWith(enriched.bodyHtml)).toBe(true);
    expect(after.bodyHtml).toContain("AI prose paragraph");

    expect(result.fallbackCount).toBe(0);
    expect(result.applied.announcements).toBe(course.announcements.length);
  });

  it("keeps existing quiz questions when the builder falls back", async () => {
    const course = makeCourse();
    const originalQuestions = course.quizzes[0].questions.length;
    vi.mocked(builders.aiGenerateQuizQuestions).mockResolvedValueOnce({ source: "deterministic", value: [], note: "offline" });

    const result = await fillEntireCourseContent(course, { concurrency: 1 });

    expect(result.fallbackCount).toBeGreaterThanOrEqual(1);
    expect(result.course.quizzes[0].questions.length).toBe(originalQuestions);
  });
});
