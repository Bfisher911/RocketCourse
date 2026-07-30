import { describe, expect, it } from "vitest";
import { sampleProject } from "./courseGenerator";
import {
  PLACEHOLDER_COURSE,
  SAMPLE_PROJECT_EXPORT_MODE,
  SAMPLE_PROJECT_ID,
  SAMPLE_PROJECT_PROMPT,
  getSampleProject,
  sampleProjectLoaded,
} from "./sampleCourse";

// These assertions are the contract that lets the rest of the app compare
// against SAMPLE_PROJECT_ID *without* importing the generator (which would
// re-pin the whole engine to the initial bundle and undo PERF-2). If the demo
// course's title/seed ever changes, its slugified id changes with it and this
// test fails loudly instead of silently breaking "is this the demo?" checks.
describe("sampleCourse identity constants", () => {
  it("SAMPLE_PROJECT_ID matches the generated sample project's id", () => {
    expect(SAMPLE_PROJECT_ID).toBe(sampleProject.id);
  });

  it("SAMPLE_PROJECT_EXPORT_MODE matches the generated sample project", () => {
    expect(SAMPLE_PROJECT_EXPORT_MODE).toBe(sampleProject.exportMode);
  });

  it("SAMPLE_PROJECT_PROMPT matches the seed the generator actually used", () => {
    expect(sampleProject.prompt).toBe(SAMPLE_PROJECT_PROMPT);
  });
});

describe("getSampleProject", () => {
  it("materializes the same course the generator produces, and memoizes it", async () => {
    const first = await getSampleProject();
    expect(first.id).toBe(SAMPLE_PROJECT_ID);
    expect(first.modules.length).toBeGreaterThan(0);
    expect(sampleProjectLoaded()).toBe(true);
    // second call returns the identical object (no regeneration)
    const second = await getSampleProject();
    expect(second).toBe(first);
  });

  it("concurrent callers share one generation", async () => {
    const [a, b, c] = await Promise.all([getSampleProject(), getSampleProject(), getSampleProject()]);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });
});

describe("PLACEHOLDER_COURSE", () => {
  it("is a structurally valid, empty CourseProject", () => {
    // Every array field the app maps over must exist, or the editor would throw
    // if it ever rendered before a real course is set.
    for (const key of [
      "outcomes", "announcements", "modules", "pages", "assignments", "discussions",
      "quizzes", "rubrics", "resources", "schedule", "reviewChecklist",
      "assignmentGroups", "fileAssets", "navigation", "exportHistory",
    ] as const) {
      expect(Array.isArray(PLACEHOLDER_COURSE[key]), `${key} must be an array`).toBe(true);
      expect((PLACEHOLDER_COURSE[key] as unknown[]).length).toBe(0);
    }
    expect(PLACEHOLDER_COURSE.settings).toBeTruthy();
    expect(PLACEHOLDER_COURSE.theme).toBeTruthy();
    expect(PLACEHOLDER_COURSE.contactHours.totalHours).toBe(0);
    expect(PLACEHOLDER_COURSE.metadata).toBeTruthy();
  });

  it("is never mistaken for the demo course", () => {
    expect(PLACEHOLDER_COURSE.id).not.toBe(SAMPLE_PROJECT_ID);
  });

  it("has the same field set as a real generated course", () => {
    // Guards against drift: a new required CourseProject field added to the
    // generator must also be added here, or the editor could read undefined.
    const missing = Object.keys(sampleProject).filter(
      (k) => !(k in PLACEHOLDER_COURSE) && !["homepage", "syllabus", "quality", "imageAssets"].includes(k)
    );
    expect(missing).toEqual([]);
  });
});
