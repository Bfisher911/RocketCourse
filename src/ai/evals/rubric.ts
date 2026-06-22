import type { CourseProject } from "../../types";
import { buildCourseQualityReport } from "../../services/courseQuality";

export type PromptEvalCategoryId =
  | "specificity"
  | "completeness"
  | "instructionalUsefulness"
  | "canvasReadiness"
  | "alignment"
  | "assignmentQuality"
  | "quizQuality"
  | "rubricQuality"
  | "studentClarity"
  | "accessibilityReadability"
  | "instructorEditability"
  | "avoidanceOfFakeSpecificity";

export interface PromptEvalCategory {
  id: PromptEvalCategoryId;
  label: string;
  description: string;
  targetMinimum: number;
}

export interface PromptEvalCategoryScore {
  id: PromptEvalCategoryId;
  label: string;
  score: number;
  evidence: string[];
}

export interface PromptEvalScorecard {
  averageScore: number;
  minimumScore: number;
  passesTargets: boolean;
  categoryScores: PromptEvalCategoryScore[];
  targetSummary: string;
}

export const rocketCoursePromptEvalRubric: PromptEvalCategory[] = [
  { id: "specificity", label: "Specificity", description: "Course feels tailored to the discipline, level, learner audience, and module purpose.", targetMinimum: 4 },
  { id: "completeness", label: "Completeness", description: "Major Canvas course components are present with useful detail.", targetMinimum: 4 },
  { id: "instructionalUsefulness", label: "Instructional usefulness", description: "An instructor could teach from the draft after targeted edits.", targetMinimum: 4 },
  { id: "canvasReadiness", label: "Canvas readiness", description: "Objects map cleanly to Canvas pages, modules, graded work, rubrics, gradebook, and export.", targetMinimum: 4 },
  { id: "alignment", label: "Alignment", description: "Outcomes, modules, assignments, discussions, quizzes, and rubrics connect clearly.", targetMinimum: 4 },
  { id: "assignmentQuality", label: "Assignment quality", description: "Assignments are authentic, clear, assessable, and specific.", targetMinimum: 4 },
  { id: "quizQuality", label: "Quiz quality", description: "Questions are meaningful, answerable, varied, and supported by feedback.", targetMinimum: 4 },
  { id: "rubricQuality", label: "Rubric quality", description: "Rubrics are specific, fair, point-aligned, and student-facing.", targetMinimum: 4 },
  { id: "studentClarity", label: "Student clarity", description: "Students can understand what to do each week.", targetMinimum: 4 },
  { id: "accessibilityReadability", label: "Accessibility and readability", description: "Course is readable, navigable, and Canvas-safe.", targetMinimum: 4 },
  { id: "instructorEditability", label: "Instructor editability", description: "Placeholders and human-review areas are clear and easy to customize.", targetMinimum: 4 },
  { id: "avoidanceOfFakeSpecificity", label: "Avoidance of fake specificity", description: "Course avoids fake citations, URLs, readings, policies, and unsupported claims.", targetMinimum: 5 }
];

const scoreFromPercent = (value: number): number => {
  if (value >= 96) return 5;
  if (value >= 88) return 4.5;
  if (value >= 78) return 4;
  if (value >= 68) return 3.5;
  if (value >= 58) return 3;
  if (value >= 45) return 2;
  return 1;
};

const rounded = (value: number): number => Math.round(value * 10) / 10;

const categoryPercent = (course: CourseProject, category: string): number => {
  const report = buildCourseQualityReport(course);
  return report.categories.find((item) => item.category === category)?.score ?? report.score;
};

const htmlCorpus = (course: CourseProject): string =>
  [
    course.title,
    course.description,
    ...course.modules.map((module) => `${module.title} ${module.description} ${module.objectives.join(" ")}`),
    ...course.pages.map((page) => `${page.title} ${page.bodyHtml}`),
    ...course.assignments.map((assignment) => `${assignment.title} ${assignment.descriptionHtml}`),
    ...course.discussions.map((discussion) => `${discussion.title} ${discussion.promptHtml}`)
  ].join("\n");

const countMatches = (value: string, pattern: RegExp): number => (value.match(pattern) ?? []).length;

const scoreEntry = (id: PromptEvalCategoryId, score: number, evidence: string[]): PromptEvalCategoryScore => {
  const category = rocketCoursePromptEvalRubric.find((item) => item.id === id);
  if (!category) throw new Error(`Unknown prompt eval category: ${id}`);
  return { id, label: category.label, score: rounded(score), evidence };
};

export const scoreCourseProjectForPromptEval = (course: CourseProject): PromptEvalScorecard => {
  const corpus = htmlCorpus(course);
  const contentModules = course.modules.filter((module) => module.kind === "content");
  const vagueModuleTitles = contentModules.filter((module) => /^(introduction|overview|basics)$/i.test(module.title.trim()));
  const sourceLikeText = course.resources.map((resource) => `${resource.placeholder} ${resource.instructorEditNote} ${resource.studentInstructions}`).join("\n");
  const fabricatedUrlRisk = /https?:\/\//i.test(sourceLikeText) || /doi:|journal of|retrieved from/i.test(sourceLikeText);
  const assignmentDetails = course.assignments.filter((assignment) => /Scenario|Deliverable Requirements|Submission Instructions|Outcome Alignment/i.test(assignment.descriptionHtml));
  const quizFeedbackReady = course.quizzes.every((quiz) =>
    quiz.questions.every((question) => Boolean(question.feedback || question.correctFeedback) && Boolean(question.feedback || question.incorrectFeedback))
  );
  const rubricPointAligned = course.rubrics.every((rubric) => rubric.criteria.length >= 3 && rubric.alignedOutcomeIds.length > 0 && rubric.points > 0);
  const instructorModule = course.modules.find((module) => module.kind === "instructor");
  const policyPlaceholders = countMatches(corpus, /Instructor should add|placeholder|Replace with|Add verified|Human Review Required/gi);
  const courseTitleSignals = course.title
    .split(/\s+/)
    .filter((word) => word.length > 5)
    .filter((word) => new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(corpus)).length;

  const categoryScores = [
    scoreEntry("specificity", vagueModuleTitles.length === 0 && courseTitleSignals >= 2 ? 4.5 : 4, [
      `${contentModules.length} content modules checked for vague titles.`,
      `${courseTitleSignals} course-title signals found in generated content.`
    ]),
    scoreEntry("completeness", scoreFromPercent(categoryPercent(course, "completeness")), ["Quality service completeness score used as deterministic evidence."]),
    scoreEntry(
      "instructionalUsefulness",
      scoreFromPercent((categoryPercent(course, "studentClarity") + categoryPercent(course, "instructorReadiness") + categoryPercent(course, "moduleLearningPath")) / 3),
      ["Student clarity, instructor readiness, and module learning path scores averaged."]
    ),
    scoreEntry(
      "canvasReadiness",
      scoreFromPercent((categoryPercent(course, "canvasCompatibility") + categoryPercent(course, "exportReadiness")) / 2),
      ["Canvas compatibility and export readiness scores averaged."]
    ),
    scoreEntry("alignment", scoreFromPercent(categoryPercent(course, "outcomeAlignment")), ["Outcome alignment quality score used."]),
    scoreEntry("assignmentQuality", assignmentDetails.length === course.assignments.length ? 5 : 4, [
      `${assignmentDetails.length} of ${course.assignments.length} assignments include scenario, deliverable, submission, and outcome markers.`
    ]),
    scoreEntry("quizQuality", quizFeedbackReady ? 5 : 4, [`${course.quizzes.length} quizzes checked for answer feedback readiness.`]),
    scoreEntry("rubricQuality", rubricPointAligned ? scoreFromPercent(categoryPercent(course, "rubricQuality")) : 3.5, [
      `${course.rubrics.length} rubrics checked for criteria and outcome alignment.`
    ]),
    scoreEntry("studentClarity", scoreFromPercent(categoryPercent(course, "studentClarity")), ["Student clarity quality score used."]),
    scoreEntry("accessibilityReadability", scoreFromPercent(categoryPercent(course, "accessibility")), ["Accessibility quality score used."]),
    scoreEntry("instructorEditability", instructorModule?.publishState === "unpublished" && policyPlaceholders >= 8 ? 5 : 4, [
      instructorModule ? `Instructor module is ${instructorModule.publishState}.` : "Instructor module missing.",
      `${policyPlaceholders} editable placeholder or review markers found.`
    ]),
    scoreEntry("avoidanceOfFakeSpecificity", fabricatedUrlRisk ? 3 : 5, [
      fabricatedUrlRisk ? "Resource placeholder text contains URL or citation-like risk." : "Resource placeholders avoid fabricated URLs and citations."
    ])
  ];

  const averageScore = rounded(categoryScores.reduce((sum, item) => sum + item.score, 0) / categoryScores.length);
  const minimumScore = Math.min(...categoryScores.map((item) => item.score));
  const passesTargets =
    minimumScore >= 4 &&
    averageScore >= 4.3 &&
    (categoryScores.find((item) => item.id === "avoidanceOfFakeSpecificity")?.score ?? 0) === 5 &&
    (categoryScores.find((item) => item.id === "assignmentQuality")?.score ?? 0) >= 4 &&
    (categoryScores.find((item) => item.id === "rubricQuality")?.score ?? 0) >= 4 &&
    (categoryScores.find((item) => item.id === "canvasReadiness")?.score ?? 0) >= 4;

  return {
    averageScore,
    minimumScore,
    passesTargets,
    categoryScores,
    targetSummary: "Targets: no category below 4, average at least 4.3, assignment/rubric/Canvas readiness at least 4, fake-specificity avoidance exactly 5."
  };
};
