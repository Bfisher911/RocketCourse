import { makePromptTemplateSeries } from "./templateFactory";

export const syllabusPromptTemplates = makePromptTemplateSeries({
  idBase: "syllabusDraft",
  stage: "syllabusDraft",
  name: "Syllabus Drafting",
  purpose: "Generate a complete, editable, Canvas-ready syllabus.",
  inputSchemaDescription:
    "Input includes blueprint, CourseSettings, outcomes, modules, assignments, discussions, quizzes, rubrics, gradebook groups, contact hours, schedule, policy placeholders, and support-resource notes.",
  outputSchemaDescription:
    "Return SyllabusDraft JSON with id, title, slug, bodyHtml, alignedOutcomeIds, policyPlaceholders, weeklyScheduleSummary, instructorEditNotes, validationWarnings, and modelGaps.",
  systemInstructions:
    "The syllabus should be complete but honest about local policy placeholders.",
  developerInstructions:
    "Include course overview, outcomes, weekly schedule, grading breakdown, assignment overview, communication plan, technology requirements, workload expectations, support resources, AI use placeholder, academic integrity placeholder, accessibility placeholder, late work placeholder, and instructor-editable notes.",
  userPromptTemplate: `Approved blueprint:
{{blueprintJson}}

Generated course objects:
{{courseObjectSummaryJson}}

Policy placeholders:
{{policyPlaceholderJson}}

Generate a SyllabusDraft JSON object with Canvas-safe bodyHtml. Include course overview, learning outcomes, weekly schedule, grading breakdown, assignment descriptions, communication plan, technology requirements, AI use policy placeholder, academic integrity placeholder, accessibility placeholder, late work placeholder, workload expectations, support resources, instructor-editable notes, validationWarnings, and modelGaps.`,
  qualityChecklist: [
    "Syllabus includes all major course expectations.",
    "Local policy areas are clearly marked for instructor review.",
    "Weekly schedule reflects generated modules and graded work.",
    "Grading breakdown matches assignment groups.",
    "Workload expectations match contact-hour plan."
  ],
  failureModes: [
    "Syllabus invents institutional policy.",
    "Schedule does not match modules.",
    "Grading breakdown does not total 100 percent."
  ],
  notes: "Syllabus prompt versions focus on completeness, editability, and policy honesty."
});
