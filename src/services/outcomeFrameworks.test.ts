import { describe, it, expect } from "vitest";
import type { CourseOutcome } from "../types";
import { generateCourseProject } from "./courseGenerator";
import { defaultSettings } from "../data/defaultSettings";
import { outcomeIsMeasurable } from "./overviewSummary";
import {
  DEFAULT_OUTCOME_FRAMEWORK,
  FRAMEWORK_VERBS,
  OUTCOME_FRAMEWORKS,
  getOutcomeFramework
} from "./outcomeFrameworks";

const outcomeWithText = (text: string): CourseOutcome => ({
  id: "o",
  code: "CLO 1",
  text,
  bloomLevel: "x",
  alignedModuleIds: []
});

describe("outcome frameworks", () => {
  it("falls back to Bloom for unknown/undefined keys", () => {
    expect(getOutcomeFramework(undefined).key).toBe("bloom");
    expect(getOutcomeFramework("nope").key).toBe("bloom");
    expect(getOutcomeFramework("solo").key).toBe("solo");
  });

  it("treats every framework's leading verb as measurable", () => {
    for (const verb of FRAMEWORK_VERBS) {
      expect(outcomeIsMeasurable(outcomeWithText(`${verb} key concepts in context.`)), `verb "${verb}"`).toBe(true);
    }
  });

  it("generates Bloom outcomes by default (regression guard)", () => {
    const course = generateCourseProject({ prompt: "Intro to Marine Biology", settings: defaultSettings });
    expect(course.settings.outcomeFramework).toBe(DEFAULT_OUTCOME_FRAMEWORK);
    const bloomLabels = OUTCOME_FRAMEWORKS.bloom.levels.map((level) => level.label);
    expect(course.outcomes.length).toBeGreaterThan(0);
    course.outcomes.forEach((outcome) => expect(bloomLabels).toContain(outcome.bloomLevel));
  });

  it("generates outcomes against the selected framework with measurable, leveled text", () => {
    for (const key of ["solo", "knowledge", "kolb"] as const) {
      const framework = OUTCOME_FRAMEWORKS[key];
      const labels = framework.levels.map((level) => level.label);
      const course = generateCourseProject({
        prompt: "Intro to Marine Biology",
        settings: { ...defaultSettings, outcomeFramework: key }
      });
      course.outcomes.forEach((outcome) => {
        expect(labels, `framework ${key} label`).toContain(outcome.bloomLevel);
        expect(outcomeIsMeasurable(outcome), `framework ${key} measurable: "${outcome.text}"`).toBe(true);
      });
      const distinct = new Set(course.outcomes.map((outcome) => outcome.bloomLevel)).size;
      expect(distinct).toBeGreaterThanOrEqual(Math.min(3, framework.levels.length));
    }
  });
});
