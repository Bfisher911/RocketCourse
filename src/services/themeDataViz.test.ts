import { describe, expect, it } from "vitest";
import { buildBloomPyramid, buildCourseMap, buildGradeWeightDonut, buildWorkloadSparkline } from "./themeDataViz";
import type { Theme } from "../types";

const theme: Theme = {
  id: "vt-test",
  name: "Test",
  accent: "#4338ca",
  accentDark: "#3730a3",
  soft: "#eef2ff",
  contrastText: "#312e81",
  bannerLabel: "Test",
  contrastStatus: "pass",
  gradientFrom: "#4338ca",
  gradientTo: "#1e1b4b"
};

const canvasSafe = (html: string): void => {
  // Internal SVG refs like fill="url(#grad)" are fine (same pattern as the course banner); only
  // external url(...) is what Canvas strips.
  expect(html).not.toMatch(/url\((?!#)/i);
  expect(html).not.toMatch(/<script|<style|@font-face|<animate/i);
};

describe("themeDataViz", () => {
  it("grade donut: empty groups → empty, valid groups → an SVG normalized to 100%", () => {
    expect(buildGradeWeightDonut(theme, [])).toBe("");
    const svg = buildGradeWeightDonut(theme, [
      { name: "Assignments", weight: 50 },
      { name: "Quizzes", weight: 25 },
      { name: "Final", weight: 25 }
    ]);
    expect(svg).toContain("<svg");
    expect(svg).toContain("100%");
    expect(svg).toContain("50%"); // 50/100
    canvasSafe(svg);
  });

  it("bloom pyramid: one polygon + label per tier", () => {
    const svg = buildBloomPyramid(theme, [{ label: "Create" }, { label: "Apply", count: 3 }, { label: "Recall" }]);
    expect((svg.match(/<polygon/g) ?? []).length).toBe(3);
    expect(svg).toContain("Create");
    expect(svg).toContain("(3)");
    canvasSafe(svg);
  });

  it("workload sparkline: needs ≥2 points and draws a line + area", () => {
    expect(buildWorkloadSparkline(theme, [{ value: 5 }])).toBe("");
    const svg = buildWorkloadSparkline(theme, [{ value: 4 }, { value: 7 }, { value: 5 }, { value: 9 }]);
    expect((svg.match(/<path/g) ?? []).length).toBeGreaterThanOrEqual(2);
    canvasSafe(svg);
  });

  it("course map: a module×outcome grid with filled alignment cells", () => {
    expect(buildCourseMap(theme, [], ["CO1"])).toBe("");
    const html = buildCourseMap(
      theme,
      [
        { title: "Foundations", outcomeCodes: ["CO1", "CO2"] },
        { title: "Application", outcomeCodes: ["CO2"] }
      ],
      ["CO1", "CO2", "CO3"]
    );
    expect(html).toContain("<table");
    expect(html).toContain("Foundations");
    expect(html).toContain("CO3");
    canvasSafe(html);
  });
});
