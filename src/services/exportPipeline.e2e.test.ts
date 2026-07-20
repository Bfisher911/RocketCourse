// End-to-end guard for the production blocker: a freshly generated course must survive
// the full "Generate full content" pass (AI unreachable -> deterministic fallbacks) and
// then export a valid .imscc. If any stage throws or validation blocks, users cannot
// download their course at all.

import { describe, expect, it } from "vitest";
import { generateCourseProject, sampleProject } from "./courseGenerator";
import { fillEntireCourseContent } from "./fullCourseContent";
import { generateImsccBlob } from "./imsccExport";
import { buildReadinessReport } from "./readiness";
import { repairCourse } from "./courseRepair";
import { namespaceCourseForExport } from "./exportIdentifiers";
import { defaultSettings } from "../data/defaultSettings";

const PROMPTS = [
  "Cartography of Lost Things. Students map objects, memories, and places that no longer exist.",
  "Build me a 10-week course on Marine Biology with weekly quizzes and a final project.",
  ""
];

describe("export survives AI-shaped content that used to block validation", () => {
  it("keeps the 100%-ready public demo free of readiness warnings after export transforms", async () => {
    const prepared = namespaceCourseForExport(repairCourse(sampleProject).course);
    const readiness = buildReadinessReport(prepared);
    const requiredFailures = readiness.checks.filter((item) => !item.passed && item.severity === "required");
    expect(requiredFailures, JSON.stringify(requiredFailures, null, 2)).toEqual([]);

    const { report } = await generateImsccBlob(sampleProject, sampleProject.exportMode);
    expect(report.issues.filter((issue) => issue.id === "readiness-blockers"), JSON.stringify(report.issues, null, 2)).toEqual([]);
  }, 120000);

  it("repairs duplicate h1 pages and zero-point quiz questions instead of blocking the download", async () => {
    const base = generateCourseProject({
      prompt: "Build me an 8-week course on Field Botany with weekly quizzes.",
      settings: defaultSettings
    });
    // Simulate what a real AI pass can produce: a lecture body with two h1s, and a quiz
    // whose model-returned points were zero.
    const brokenPage = base.pages.find((page) => !page.frontPage && page.slug !== "syllabus");
    const course = {
      ...base,
      pages: base.pages.map((page) =>
        page.id === brokenPage?.id
          ? { ...page, bodyHtml: `<h1>Lecture</h1><p>Body</p><h1>Key Terms</h1><p>More</p>` }
          : page
      ),
      quizzes: base.quizzes.map((quiz, index) =>
        index === 0
          ? { ...quiz, points: 0, questions: quiz.questions.map((question) => ({ ...question, points: 0 })) }
          : quiz
      )
    };
    const { report } = await generateImsccBlob(course, course.exportMode);
    const blockers = report.issues.filter((issue) => issue.severity === "error");
    expect(blockers, JSON.stringify(blockers, null, 2)).toEqual([]);
    expect(report.valid).toBe(true);
  }, 120000);
});

describe("intake options produce observable, exportable differences", () => {
  it("includeRubrics: false generates no rubrics and still exports cleanly", async () => {
    const course = generateCourseProject({
      prompt: "Build me an 8-week course on Field Botany with weekly quizzes.",
      settings: { ...defaultSettings, includeRubrics: false }
    });
    expect(course.rubrics).toHaveLength(0);
    expect(course.assignments.every((assignment) => !assignment.rubricId)).toBe(true);
    expect(course.discussions.every((discussion) => !discussion.rubricId)).toBe(true);
    // Choosing "no rubrics" must not be punished as a readiness blocker.
    const readiness = buildReadinessReport(course);
    const rubricBlockers = readiness.checks.filter(
      (item) => !item.passed && item.severity === "required" && /rubric/i.test(item.label)
    );
    expect(rubricBlockers, JSON.stringify(rubricBlockers, null, 2)).toEqual([]);
    const { report } = await generateImsccBlob(course, course.exportMode);
    expect(report.issues.filter((issue) => issue.severity === "error")).toEqual([]);
  }, 120000);
});

describe("generate -> full-fill -> export pipeline", () => {
  for (const prompt of PROMPTS) {
    it(`exports a valid package for prompt: "${prompt.slice(0, 40) || "(empty)"}"`, async () => {
      const course = generateCourseProject({ prompt, settings: defaultSettings });
      // AI proxy is unreachable in tests, so every builder must fall back deterministically
      // without throwing — this is the exact path a local/vite user hits.
      const result = await fillEntireCourseContent(course, { concurrency: 2 });
      expect(result.total).toBeGreaterThan(0);

      const { report, fileName, blob } = await generateImsccBlob(result.course, result.course.exportMode);
      const blockers = report.issues.filter((issue) => issue.severity === "error");
      expect(blockers, JSON.stringify(blockers, null, 2)).toEqual([]);
      expect(report.valid).toBe(true);
      expect(fileName).toMatch(/\.imscc$/);
      expect(blob.size).toBeGreaterThan(1000);
    }, 120000);
  }
});

describe("cross-discipline course regression matrix", () => {
  const scenarios = [
    { title: "Introduction to Pharmacology for Nursing Students", prompt: "Build an undergraduate online course on Introduction to Pharmacology for Nursing Students.", weeks: 12, modules: 12 },
    { title: "The United States Civil War", prompt: "Build a college course on The United States Civil War.", weeks: 14, modules: 14 },
    { title: "Beginning Spanish I", prompt: "Build an in-person undergraduate course on Beginning Spanish I.", weeks: 16, modules: 16 },
    { title: "College Algebra", prompt: "Build a hybrid undergraduate course on College Algebra.", weeks: 15, modules: 15 },
    { title: "Construction Site Safety", prompt: "Build a professional course on Construction Site Safety.", weeks: 8, modules: 8 },
    { title: "Graduate Research Methods Seminar", prompt: "Build a graduate research methods seminar.", weeks: 12, modules: 12 },
    { title: "Teaching with Accessible Documents", prompt: "Build a short four-week professional development course on Teaching with Accessible Documents.", weeks: 4, modules: 4 }
  ];

  for (const scenario of scenarios) {
    it(`keeps ${scenario.title} subject-specific and exportable`, async () => {
      const course = generateCourseProject({
        prompt: scenario.prompt,
        settings: {
          ...defaultSettings,
          title: scenario.title,
          lengthWeeks: scenario.weeks,
          moduleCount: scenario.modules,
          level: /Graduate/.test(scenario.title) ? "Graduate" : defaultSettings.level
        }
      });
      const contentModules = course.modules.filter((module) => module.kind === "content");
      const serialized = JSON.stringify(course);

      expect(course.title).toBe(scenario.title);
      expect(course.settings.lengthWeeks).toBe(scenario.weeks);
      expect(contentModules).toHaveLength(scenario.modules);
      expect(serialized).toContain(scenario.title);
      expect(serialized).not.toMatch(/AI and Modern Society|civic dimensions of artificial intelligence/i);
      expect(new Set(course.outcomes.map((outcome) => outcome.text.toLowerCase().replace(/^[a-z-]+\s+/, ""))).size).toBe(course.outcomes.length);

      const { report, blob } = await generateImsccBlob(course, course.exportMode);
      expect(report.issues.filter((issue) => issue.severity === "error"), JSON.stringify(report.issues, null, 2)).toEqual([]);
      expect(blob.size).toBeGreaterThan(1000);
    }, 120000);
  }
});
