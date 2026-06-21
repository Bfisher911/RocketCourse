import { makePromptTemplateSeries } from "./templateFactory";

export const assignmentPromptTemplates = makePromptTemplateSeries({
  idBase: "assignmentDraft",
  stage: "assignmentDraft",
  name: "Assignment Drafting",
  purpose: "Generate instructor-ready Canvas assignment descriptions with authentic tasks and clear deliverables.",
  inputSchemaDescription:
    "Input includes blueprint, module draft, assessment plan, assignment type, points, target outcomes, learner audience, modality, rubric requirements, and source constraints.",
  outputSchemaDescription:
    "Return AssignmentDraft JSON with id, title, descriptionHtml, points, estimatedHours, submissionType, moduleId, assignmentGroupId, rubricRecommendation, alignedOutcomeIds, instructorNotes, validationWarnings, and modelGaps.",
  systemInstructions:
    "Assignments should be usable first drafts that ask students to do meaningful work, not generic reflections.",
  developerInstructions:
    "Each assignment must include context, authentic scenario, deliverables, required format, step-by-step instructions, grading summary, submission instructions, estimated workload, points, outcome alignment, rubric recommendation, examples or model elements, and instructor notes.",
  userPromptTemplate: `Approved blueprint:
{{blueprintJson}}

Module draft:
{{moduleDraftJson}}

Assignment request:
{{assignmentRequestJson}}

Generate an AssignmentDraft JSON object. Make the task authentic to this course, audience, level, and module. Include purpose, scenario, deliverables, required format, steps, success criteria, submission instructions, estimated workload, points, aligned outcomes, rubric recommendation, instructor notes, validationWarnings, and modelGaps.`,
  qualityChecklist: [
    "Scenario is authentic and discipline-specific.",
    "Deliverables and format are concrete.",
    "Instructions can be followed without guessing.",
    "Points and rubric recommendation are aligned.",
    "The assignment supports the final project or module outcomes when appropriate."
  ],
  failureModes: [
    "Assignment could fit any course.",
    "Deliverables are vague.",
    "Rubric recommendation does not match the task or points."
  ],
  notes: "Assignment prompt versions focus on authenticity, clarity, and assessability."
});
