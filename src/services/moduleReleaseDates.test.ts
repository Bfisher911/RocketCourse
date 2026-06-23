import { describe, it, expect } from "vitest";
import type { CourseProject, CourseSettings } from "../types";
import { buildImsccZip } from "./imsccExport";
import { generateCourseProject } from "./courseGenerator";
import { defaultSettings } from "../data/defaultSettings";

const moduleMeta = async (course: CourseProject): Promise<string> => {
  const zip = await buildImsccZip(course);
  return (await zip.file("course_settings/module_meta.xml")?.async("text")) ?? "";
};

const scheduled: CourseSettings = {
  ...defaultSettings,
  schedule: { ...defaultSettings.schedule, enableDueDates: true, termStartDate: "2026-08-24" }
};

describe("module release dates export", () => {
  it("writes <unlock_at> for modules when a term schedule is configured", async () => {
    const course = generateCourseProject({ prompt: "Intro to Marine Biology", settings: scheduled });
    const meta = await moduleMeta(course);
    const count = (meta.match(/<unlock_at>/g) ?? []).length;
    expect(count).toBeGreaterThan(0);
    // each unlock_at carries an ISO date that Date can parse
    const first = meta.match(/<unlock_at>([^<]+)<\/unlock_at>/)?.[1];
    expect(first && !Number.isNaN(Date.parse(first))).toBe(true);
  });

  it("omits <unlock_at> when no term schedule is set (default course unchanged)", async () => {
    const course = generateCourseProject({ prompt: "Intro to Marine Biology", settings: defaultSettings });
    const meta = await moduleMeta(course);
    expect(meta).not.toContain("<unlock_at>");
  });
});
