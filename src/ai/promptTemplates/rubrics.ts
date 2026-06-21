import { makePromptTemplateSeries } from "./templateFactory";

export const rubricPromptTemplates = makePromptTemplateSeries({
  idBase: "rubricDraft",
  stage: "rubricDraft",
  name: "Rubric Drafting",
  purpose: "Generate rubrics that match assignments and discussions with student-facing descriptors.",
  inputSchemaDescription:
    "Input includes target assignment or discussion, points, aligned outcomes, course level, learner audience, grading emphasis, and Canvas model constraints.",
  outputSchemaDescription:
    "Return RubricDraft JSON with id, title, targetObjectId, targetObjectType, criteria, points, alignedOutcomeIds, validationWarnings, and modelGaps. Criteria include id, title, description, outcomeId, and levels with labels, points, and descriptors.",
  systemInstructions:
    "Rubrics must be specific to the task they evaluate.",
  developerInstructions:
    "Criteria should be observable, fair, point-aligned, student-facing, and tied to outcomes. Total rubric points must match the target assignment or discussion points.",
  userPromptTemplate: `Target graded object:
{{gradedObjectJson}}

Course and outcome context:
{{courseContextJson}}

Generate a RubricDraft JSON object. Include specific criteria, performance levels, descriptors, point values, total points, aligned outcomes, validationWarnings, and modelGaps. Make the rubric match the actual task, not a generic writing rubric.`,
  qualityChecklist: [
    "Rubric total matches target object points.",
    "Criteria are specific to the assignment or discussion.",
    "Performance levels use clear student-facing language.",
    "At least one criterion aligns to an outcome.",
    "Descriptors distinguish performance levels meaningfully."
  ],
  failureModes: [
    "Generic criteria only.",
    "Point totals do not match.",
    "Descriptors do not distinguish levels."
  ],
  notes: "Rubric prompt versions focus on task fit, fairness, point alignment, and student clarity."
});
