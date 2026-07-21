import { describe, expect, it } from "vitest";
import { defaultSettings } from "../data/defaultSettings";
import { generateCourseProject } from "./courseGenerator";
import { discussionRef } from "./canvasLinks";

const makeCourse = (discussionFrequency: typeof defaultSettings.discussionFrequency = "module") =>
  generateCourseProject({
    prompt: "Build a four-week course on Coastal Resilience Planning.",
    settings: {
      ...defaultSettings,
      title: "Coastal Resilience Planning",
      description: "An applied course on evidence, stakeholders, risk, and resilient coastal decisions.",
      courseLengthPreset: "4-weeks",
      lengthWeeks: 4,
      moduleCount: 4,
      quizFrequency: "module",
      discussionFrequency,
      assignmentCadence: "every-module",
      finalProject: true,
      scaffoldPattern: "key-milestones"
    }
  });

describe("student-facing course experience patterns", () => {
  it("builds a distinct Start Here path with a persistent ungraded questions forum", () => {
    const course = makeCourse();
    const start = course.modules.find((module) => module.kind === "start");
    const questions = course.discussions.find((discussion) => discussion.id === "discussion_ask_course_questions");
    const startTitles = start?.items.map((item) => item.title) ?? [];

    expect(startTitles).toEqual(expect.arrayContaining(["How to Use This Course", "Technology and Access Check", "Communication and Help", "Optional Preparation and Refreshers", "Ask Course Questions"]));
    expect(questions?.points).toBe(0);
    expect(questions?.promptHtml).toMatch(/Initial Post Guidance|Reply Guidance|ungraded/i);
  });

  it("keeps welcome links valid when introductions are disabled", () => {
    const course = makeCourse("none");
    const welcome = course.announcements.find((announcement) => announcement.id === "announcement_welcome")?.bodyHtml ?? "";

    expect(course.discussions.some((discussion) => discussion.id === "discussion_introduce_yourself")).toBe(false);
    expect(course.discussions).toHaveLength(0);
    expect(welcome).not.toContain(discussionRef("discussion_introduce_yourself"));
    expect(welcome).not.toContain(discussionRef("discussion_ask_course_questions"));
    expect(welcome).toMatch(/contact the instructor/i);
  });

  it("matches each recap checklist to the activities in that module", () => {
    const course = makeCourse();

    course.modules.filter((module) => module.kind === "content").forEach((module) => {
      const recapItem = module.items.find((item) => item.type === "page" && /End of|Wrap|Recap/i.test(item.title));
      const recap = course.pages.find((page) => page.id === recapItem?.refId)?.bodyHtml ?? "";
      expect(recap, module.title).toContain("Before You Continue");
      if (module.items.some((item) => item.type === "discussion")) expect(recap, module.title).toMatch(/posted and replied/i);
      if (module.items.some((item) => item.type === "quiz")) expect(recap, module.title).toMatch(/reviewed feedback/i);
      if (module.items.some((item) => item.type === "assignment")) expect(recap, module.title).toMatch(/submitted the applied assignment/i);
    });
  });

  it("creates useful milestone artifacts and mastery-oriented quiz defaults", () => {
    const course = makeCourse();
    const contentModuleIds = new Set(course.modules.filter((module) => module.kind === "content").map((module) => module.id));
    const milestonePages = course.pages.filter((page) => contentModuleIds.has(page.moduleId ?? "") && /final-project-milestone/i.test(page.slug));

    expect(milestonePages.length).toBeGreaterThan(0);
    milestonePages.forEach((page) => {
      expect(page.bodyHtml).toMatch(/Estimated Time|What To Keep or Submit|Success Check|What To Carry Forward/i);
    });
    course.quizzes.forEach((quiz) => {
      expect(quiz.allowedAttempts).toBe(2);
      expect(quiz.shuffleAnswers).toBe(true);
    });
  });
});
