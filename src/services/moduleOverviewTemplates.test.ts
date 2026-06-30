import { describe, expect, it } from "vitest";
import { getTheme } from "../data/themes";
import { defaultSettings } from "../data/defaultSettings";
import { generateCourseProject, sampleProject } from "./courseGenerator";
import { MODULE_OVERVIEW_STYLES, chooseModuleOverviewStyle } from "./moduleOverviewTemplates";
import { unsafeHtmlReasons } from "./htmlSafety";

const firstContentOverviewHtml = (course = sampleProject): string => {
  const module = course.modules.find((entry) => entry.kind === "content");
  const item = module?.items.find((entry) => entry.type === "page" && /about|overview/i.test(entry.title));
  return course.pages.find((page) => page.id === item?.refId)?.bodyHtml ?? "";
};

describe("module overview presets", () => {
  it("ships the ten requested module overview styles", () => {
    expect(MODULE_OVERVIEW_STYLES.map((style) => style.name)).toEqual([
      "Weekly Rhythm",
      "Inquiry Cycle",
      "Project Sprint",
      "Case-Based",
      "Debate-Based",
      "Lab-Based",
      "Reading Seminar",
      "Field Investigation",
      "Design Studio",
      "Operations Briefing"
    ]);
  });

  it("lets settings choose a style and otherwise maps discipline themes to a strong default", () => {
    expect(chooseModuleOverviewStyle({ moduleOverviewStyleId: "debate-based" }, getTheme("modern-minimal"))).toBe("debate-based");
    expect(chooseModuleOverviewStyle({}, getTheme("ethics-debate-chamber"))).toBe("debate-based");
    expect(chooseModuleOverviewStyle({}, getTheme("modern-minimal"))).toBe("weekly-rhythm");
  });

  it("generates polished module overview pages with the required student-facing sections", () => {
    const html = firstContentOverviewHtml();

    [
      "Module Mission Briefing",
      "Big Question",
      "Objectives Chips",
      "Estimated Time",
      "Read-Watch-Do Path",
      "Module Map",
      "Key Terms",
      "Before You Begin Checklist",
      "Common Mistake to Avoid",
      "Wrap-Up Preview"
    ].forEach((label) => expect(html).toContain(label));

    expect(html).toContain("week-1-badge.svg");
    expect(unsafeHtmlReasons(html)).toEqual([]);
  });

  it("uses theme or settings without changing the course item graph", () => {
    const course = generateCourseProject({
      prompt: "Build a short ethics course.",
      settings: { ...defaultSettings, moduleCount: 3, lengthWeeks: 3, themeId: "ethics-debate-chamber" }
    });

    expect(firstContentOverviewHtml(course)).toContain("Debate-Based module overview");
    expect(course.modules.filter((module) => module.kind === "content")).toHaveLength(3);
  });
});
