import { describe, expect, it, vi } from "vitest";
import { defaultSettings } from "../data/defaultSettings";
import { generateCourseProject, rebuildAlignmentMapPage } from "./courseGenerator";
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
    expect(plan.discussions).toBe(course.discussions.filter((discussion) => discussion.id !== "discussion_ask_course_questions").length);
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

describe("instructor alignment map", () => {
  it("re-renders from current quiz points instead of the generation-time snapshot", () => {
    // The map is a page, so it freezes whatever the graded items looked like when it was written.
    // The AI fill pass then swaps quiz questions and recomputes each quiz's points, which left the
    // live Tulane map quoting every quiz at "(18 pts)" -- the deterministic template's 4+2+4+5+3 --
    // while the real values were 6 to 11. The instructor's own alignment reference was wrong for all
    // ten quizzes.
    const course = generateCourseProject({
      prompt: "Build me a 4-week professional course on Community Health Program Design.",
      settings: { ...defaultSettings, courseLengthPreset: "4-weeks", lengthWeeks: 4, moduleCount: 4 }
    });
    const slug = "outcome-and-assessment-alignment-map";
    const originalPoints = course.quizzes[0].points;
    const title = course.quizzes[0].title;

    expect(course.pages.find((page) => page.slug === slug)?.bodyHtml).toContain(`${title} (${originalPoints} pts)`);

    // Points change the way the AI fill pass changes them.
    const repointed = { ...course, quizzes: course.quizzes.map((quiz) => ({ ...quiz, points: 7 })) };
    // Without a rebuild the page still quotes the old total.
    expect(repointed.pages.find((page) => page.slug === slug)?.bodyHtml).toContain(`${title} (${originalPoints} pts)`);

    const rebuilt = rebuildAlignmentMapPage(repointed);
    const body = rebuilt.pages.find((page) => page.slug === slug)?.bodyHtml ?? "";
    expect(body).toContain(`${title} (7 pts)`);
    expect(body).not.toContain(`${title} (${originalPoints} pts)`);
  });

  it("also completes the module list the generation-time snapshot missed", () => {
    // The map is rendered before the last module is appended, so the snapshot names one module
    // fewer than the finished course. Rebuilding is additive: every module appears and no graded
    // item is dropped.
    const course = generateCourseProject({
      prompt: "Build me a 4-week professional course on Community Health Program Design.",
      settings: { ...defaultSettings, courseLengthPreset: "4-weeks", lengthWeeks: 4, moduleCount: 4 }
    });
    const slug = "outcome-and-assessment-alignment-map";
    const snapshot = course.pages.find((page) => page.slug === slug)?.bodyHtml ?? "";
    const rebuilt = rebuildAlignmentMapPage(course).pages.find((page) => page.slug === slug)?.bodyHtml ?? "";
    const named = (html: string) => course.modules.filter((module) => html.includes(module.title)).length;
    const gradedItems = (html: string) => (html.match(/ pts\)/g) ?? []).length;

    expect(named(snapshot)).toBeLessThan(course.modules.length);
    expect(named(rebuilt)).toBe(course.modules.length);
    expect(gradedItems(rebuilt)).toBe(gradedItems(snapshot));
  });
});

describe("fillEntireCourseContent", () => {
  it("fills every surface with AI content and keeps structure on enriched pages", async () => {
    const course = makeCourse();
    const result = await fillEntireCourseContent(course);

    // Activities replaced with AI content.
    expect(result.course.assignments.every((a) => a.descriptionHtml.includes("AI assignment"))).toBe(true);
    expect(result.course.discussions.filter((discussion) => discussion.id !== "discussion_ask_course_questions").every((d) => d.promptHtml.includes("AI discussion"))).toBe(true);
    expect(result.course.discussions.find((discussion) => discussion.id === "discussion_ask_course_questions")?.promptHtml).toContain("ungraded");
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
