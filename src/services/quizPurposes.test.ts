import { describe, it, expect } from "vitest";
import type { QuizPurposeKey } from "../types";
import { generateCourseProject } from "./courseGenerator";
import { defaultSettings } from "../data/defaultSettings";
import { getQuizPurpose } from "./quizPurposes";

const gen = (quizPurpose: QuizPurposeKey) =>
  generateCourseProject({ prompt: "Intro to Marine Biology", settings: { ...defaultSettings, quizPurpose } });

describe("quiz purposes", () => {
  it("falls back to knowledge-check for unknown/undefined keys", () => {
    expect(getQuizPurpose(undefined).key).toBe("knowledge-check");
    expect(getQuizPurpose("nope").key).toBe("knowledge-check");
    expect(getQuizPurpose("scenario").key).toBe("scenario");
  });

  it("shapes generated quiz titles and purposes by the chosen purpose", () => {
    const scenario = gen("scenario");
    expect(scenario.quizzes.length).toBeGreaterThan(0);
    scenario.quizzes.forEach((quiz) => {
      expect(quiz.title).toContain("Scenario Quiz");
      expect(quiz.purpose.toLowerCase()).toContain("scenario");
      expect(quiz.purpose).toContain("Aligned outcomes:");
    });
  });

  it("keeps the default (knowledge-check) quiz output unchanged", () => {
    const standard = gen("knowledge-check");
    expect(standard.settings.quizPurpose).toBe("knowledge-check");
    expect(standard.quizzes.length).toBeGreaterThan(0);
    standard.quizzes.forEach((quiz) => {
      expect(quiz.title).toContain("Knowledge Check");
      expect(quiz.purpose).toMatch(/^Check understanding of /);
    });
  });
});
