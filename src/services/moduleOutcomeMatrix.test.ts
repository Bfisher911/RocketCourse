import { describe, it, expect } from "vitest";
import { generateCourseProject } from "./courseGenerator";
import { defaultSettings } from "../data/defaultSettings";
import { moduleOutcomeMatrix, outcomeTag } from "./overviewSummary";

describe("outcome tags + module/outcome alignment matrix", () => {
  it("derives a readable slug tag from outcome text", () => {
    expect(outcomeTag({ text: "Analyze key marine biology concepts, practices, and implications.", code: "CLO 1" })).toBe("analyze-marine-biology");
    expect(outcomeTag({ text: "Evaluate the ethical tradeoffs of facial recognition technology.", code: "CLO 3" })).toBe("evaluate-ethical-tradeoffs-facial");
    // empty text falls back to a slug of the code
    expect(outcomeTag({ text: "", code: "CLO 2" })).toBe("clo-2");
  });

  it("maps each module to the outcomes aligned to it", () => {
    const course = generateCourseProject({ prompt: "Intro to Marine Biology", settings: defaultSettings });
    const matrix = moduleOutcomeMatrix(course);

    expect(matrix.length).toBe(course.modules.length);

    // a freshly generated course aligns every content module to at least one outcome (no gaps)
    const contentRows = matrix.filter((row) => row.module.kind === "content");
    expect(contentRows.length).toBeGreaterThan(0);
    contentRows.forEach((row) => {
      expect(row.outcomes.length).toBeGreaterThan(0);
      expect(row.isGap).toBe(false);
    });

    // every outcome listed under a module actually references that module
    matrix.forEach((row) => {
      row.outcomes.forEach((outcome) => expect(outcome.alignedModuleIds).toContain(row.module.id));
    });
  });
});
