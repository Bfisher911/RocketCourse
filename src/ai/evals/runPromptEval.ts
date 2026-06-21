import { generateCourseProject } from "../../services/courseGenerator";
import type { CourseProject } from "../../types";
import { comparePromptTemplateVersions, createPromptTemplateRegistry, getActivePromptTemplates } from "../promptTemplates/registry";
import type { PromptTemplate, PromptTemplateComparison, PromptTemplateStage, PromptTemplateVersion } from "../promptTemplates/types";
import { courseEvalFixtures, type CourseEvalFixture } from "./fixtures";
import { scoreCourseProjectForPromptEval, type PromptEvalScorecard } from "./rubric";

export type PromptEvalProvider = "deterministic-baseline" | "saved-fixture-output" | "future-server-side-ai";

export interface PromptEvalRunOptions {
  fixtureIds?: string[];
  provider?: PromptEvalProvider;
  activeVersionOverrides?: Partial<Record<PromptTemplateStage, PromptTemplateVersion>>;
}

export interface PromptEvalFixtureResult {
  fixtureId: string;
  fixtureTitle: string;
  provider: PromptEvalProvider;
  courseTitle: string;
  moduleCount: number;
  objectCounts: {
    pages: number;
    assignments: number;
    discussions: number;
    quizzes: number;
    rubrics: number;
    resources: number;
  };
  scorecard: PromptEvalScorecard;
  recommendations: string[];
}

export interface PromptEvalReport {
  provider: PromptEvalProvider;
  generatedAt: string;
  activeTemplates: Array<Pick<PromptTemplate, "id" | "stage" | "version" | "name">>;
  fixtureResults: PromptEvalFixtureResult[];
  averageScore: number;
  passingFixtureCount: number;
  fixtureCount: number;
  commonFailureModes: string[];
  nextPromptActions: string[];
}

export interface PromptVersionOutputComparison {
  stage: PromptTemplateStage;
  fromVersion: PromptTemplateVersion;
  toVersion: PromptTemplateVersion;
  promptComparison: PromptTemplateComparison;
  fixtureResults: PromptEvalFixtureResult[];
  note: string;
}

const rounded = (value: number): number => Math.round(value * 10) / 10;

const selectedFixtures = (fixtureIds?: string[]): CourseEvalFixture[] => {
  if (!fixtureIds?.length) return courseEvalFixtures;
  const requested = new Set(fixtureIds);
  return courseEvalFixtures.filter((fixture) => requested.has(fixture.id));
};

const deterministicCourseForFixture = (fixture: CourseEvalFixture): CourseProject =>
  generateCourseProject({
    prompt: `${fixture.prompt}\nAudience: ${fixture.audience}\nSource notes: ${fixture.sourceNotes}\nSpecial requirements: ${fixture.specialRequirements.join("; ")}`,
    settings: fixture.settings
  });

const recommendationsFor = (scorecard: PromptEvalScorecard): string[] =>
  scorecard.categoryScores
    .filter((score) => score.score < 4.5)
    .map((score) => `Improve ${score.label}: ${score.evidence[0]}`)
    .slice(0, 5);

const evalFixture = (fixture: CourseEvalFixture, provider: PromptEvalProvider): PromptEvalFixtureResult => {
  if (provider === "future-server-side-ai") {
    throw new Error("future-server-side-ai provider is intentionally not implemented in the browser bundle. Connect it through a server endpoint.");
  }

  const course = deterministicCourseForFixture(fixture);
  const scorecard = scoreCourseProjectForPromptEval(course);

  return {
    fixtureId: fixture.id,
    fixtureTitle: fixture.courseTitle,
    provider,
    courseTitle: course.title,
    moduleCount: course.modules.filter((module) => module.kind === "content").length,
    objectCounts: {
      pages: course.pages.length,
      assignments: course.assignments.length,
      discussions: course.discussions.length,
      quizzes: course.quizzes.length,
      rubrics: course.rubrics.length,
      resources: course.resources.length
    },
    scorecard,
    recommendations: recommendationsFor(scorecard)
  };
};

export const runPromptEval = (options: PromptEvalRunOptions = {}): PromptEvalReport => {
  const provider = options.provider ?? "deterministic-baseline";
  const registry = createPromptTemplateRegistry(options.activeVersionOverrides);
  const fixtureResults = selectedFixtures(options.fixtureIds).map((fixture) => evalFixture(fixture, provider));
  const averageScore = rounded(fixtureResults.reduce((sum, result) => sum + result.scorecard.averageScore, 0) / Math.max(1, fixtureResults.length));
  const lowCategories = fixtureResults.flatMap((result) => result.scorecard.categoryScores.filter((score) => score.score < 4.5).map((score) => score.label));
  const commonFailureModes = Array.from(new Set(lowCategories)).slice(0, 8);

  return {
    provider,
    generatedAt: new Date().toISOString(),
    activeTemplates: getActivePromptTemplates().map((template) => ({
      id: registry[template.stage].activeTemplate.id,
      stage: template.stage,
      version: registry[template.stage].activeTemplate.version,
      name: registry[template.stage].activeTemplate.name
    })),
    fixtureResults,
    averageScore,
    passingFixtureCount: fixtureResults.filter((result) => result.scorecard.passesTargets).length,
    fixtureCount: fixtureResults.length,
    commonFailureModes,
    nextPromptActions: commonFailureModes.length
      ? commonFailureModes.map((label) => `Revise active prompts to raise ${label}.`)
      : ["No deterministic rubric regression detected. Connect a server-side AI provider and compare saved outputs."]
  };
};

export const comparePromptVersionOutputs = (
  stage: PromptTemplateStage,
  fromVersion: PromptTemplateVersion,
  toVersion: PromptTemplateVersion,
  fixtureIds?: string[]
): PromptVersionOutputComparison => ({
  stage,
  fromVersion,
  toVersion,
  promptComparison: comparePromptTemplateVersions(stage, fromVersion, toVersion),
  fixtureResults: runPromptEval({ fixtureIds, activeVersionOverrides: { [stage]: toVersion } }).fixtureResults,
  note:
    "Current output comparison uses the deterministic baseline generator. When a server-side AI provider is connected, store provider outputs by template id and compare those saved snapshots."
});
