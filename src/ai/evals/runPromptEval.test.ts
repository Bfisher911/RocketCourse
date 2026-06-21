import { describe, expect, it } from "vitest";
import { comparePromptVersionOutputs, runPromptEval } from "./runPromptEval";

describe("prompt eval harness", () => {
  it("runs selected fixtures through the deterministic baseline without live AI", () => {
    const report = runPromptEval({
      fixtureIds: ["humanities-scifi-ethics", "stem-environmental-data"]
    });

    expect(report.provider).toBe("deterministic-baseline");
    expect(report.fixtureCount).toBe(2);
    expect(report.activeTemplates).toHaveLength(12);
    expect(report.averageScore).toBeGreaterThanOrEqual(4.3);
    expect(report.passingFixtureCount).toBe(2);

    report.fixtureResults.forEach((result) => {
      expect(result.objectCounts.pages).toBeGreaterThan(10);
      expect(result.objectCounts.rubrics).toBeGreaterThan(0);
      expect(result.scorecard.categoryScores.find((score) => score.id === "avoidanceOfFakeSpecificity")?.score).toBe(5);
    });
  });

  it("compares prompt versions while using deterministic outputs as the current snapshot provider", () => {
    const comparison = comparePromptVersionOutputs("quizDraft", "v5", "v6", ["online-ai-fundamentals-faculty"]);

    expect(comparison.promptComparison.rollbackTarget).toBe("v5");
    expect(comparison.fixtureResults).toHaveLength(1);
    expect(comparison.note).toContain("deterministic baseline");
  });
});
