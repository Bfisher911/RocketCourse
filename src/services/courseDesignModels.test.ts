import { describe, it, expect } from "vitest";
import type { CourseProject, CourseSettings } from "../types";
import { generateCourseProject } from "./courseGenerator";
import { defaultSettings } from "../data/defaultSettings";
import { buildReadinessReport } from "./readiness";
import { getModulePattern, getStructureFramework } from "./courseDesignModels";

const gen = (overrides: Partial<CourseSettings>): CourseProject =>
  generateCourseProject({ prompt: "Intro to Marine Biology", settings: { ...defaultSettings, ...overrides } });

const allHtml = (course: CourseProject): string => course.pages.map((page) => page.bodyHtml).join("\n");

describe("course design models", () => {
  it("falls back to defaults for unknown/undefined keys", () => {
    expect(getStructureFramework(undefined).key).toBe("linear");
    expect(getStructureFramework("nope").key).toBe("linear");
    expect(getModulePattern("nope").key).toBe("standard");
    expect(getModulePattern("gagne").key).toBe("gagne");
  });

  it("surfaces the structure framework's design approach in module overviews", () => {
    expect(allHtml(gen({ structureFramework: "backward" }))).toContain("works toward the evidence");
    expect(allHtml(gen({ structureFramework: "spiral" }))).toContain("return in later modules at greater depth");
  });

  it("uses the chosen module pattern's learning-path steps", () => {
    const gagneHtml = allHtml(gen({ modulePattern: "gagne" }));
    expect(gagneHtml).toContain("Take in new content from the readings and lecture");
    expect(gagneHtml).toContain("Demonstrate mastery in graded work");
    // default course keeps the original standard learning path (regression guard)
    expect(allHtml(gen({}))).toContain("Work through the mini-lecture and examples");
  });

  it("keeps a valid module learning path regardless of pattern (export-safe)", () => {
    for (const modulePattern of ["addie", "gagne", "inquiry", "conceptual"] as const) {
      const report = buildReadinessReport(gen({ modulePattern }));
      const pathCheck = report.checks.find((check) => check.id === "content-module-depth");
      expect(pathCheck?.passed, `pattern ${modulePattern} content-module-depth`).toBe(true);
    }
  });
});
