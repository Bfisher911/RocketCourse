import { describe, it, expect } from "vitest";
import type { CourseOutcome } from "../types";
import { generateCourseProject } from "./courseGenerator";
import { defaultSettings } from "../data/defaultSettings";
import { themes } from "../data/themes";
import { orphanOutcomes } from "./overviewSummary";
import { makeCourseExportReady, polishCourse, restyleCourse } from "./courseTransforms";

const make = () => generateCourseProject({ prompt: "Intro to Marine Biology", settings: defaultSettings });

describe("course transforms", () => {
  it("restyle applies a theme across the course", () => {
    const course = make();
    const other = themes.find((theme) => theme.id !== course.theme.id) ?? themes[0];
    const { course: next, summary } = restyleCourse(course, other);
    expect(next.theme.id).toBe(other.id);
    expect(summary.join(" ")).toContain(other.name);
  });

  it("polish adds idempotent guidance and is a no-op on a second run", () => {
    const course = make();
    const first = polishCourse(course);
    expect(first.course.pages.some((page) => page.bodyHtml.includes("Accessibility Check"))).toBe(true);
    expect(first.summary.join(" ")).toMatch(/page|assignment|discussion/);

    const second = polishCourse(first.course);
    expect(second.summary.join(" ")).toContain("nothing to change");
  });

  it("make export-ready aligns orphaned outcomes", () => {
    const course = make();
    const orphan: CourseOutcome = { id: "orphan_x", code: "CLO 99", text: "Evaluate a novel orphan outcome.", bloomLevel: "Evaluate", alignedModuleIds: [] };
    const withOrphan = { ...course, outcomes: [...course.outcomes, orphan] };
    expect(orphanOutcomes(withOrphan).some((outcome) => outcome.id === "orphan_x")).toBe(true);

    const { course: next, summary } = makeCourseExportReady(withOrphan);
    expect(orphanOutcomes(next).some((outcome) => outcome.id === "orphan_x")).toBe(false);
    expect(summary.join(" ")).toMatch(/orphan/i);
  });
});
