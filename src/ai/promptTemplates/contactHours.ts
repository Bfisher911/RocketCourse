import { makePromptTemplateSeries } from "./templateFactory";

export const contactHourPromptTemplates = makePromptTemplateSeries({
  idBase: "contactHourDraft",
  stage: "contactHourDraft",
  name: "Contact Hour Drafting",
  purpose: "Generate workload and contact-hour estimates that are internally consistent with course settings.",
  inputSchemaDescription:
    "Input includes CourseSettings, module plan, modality, credit hours, course length, readings and media plan, assignments, discussions, quizzes, final project, schedule, and institutional placeholder notes.",
  outputSchemaDescription:
    "Return ContactHourDraft JSON with instructionalTime, readingMediaTime, assignmentTime, discussionTime, quizStudyTime, finalProjectTime, totalHours, perModuleBreakdown, assumptions, consistencyCheck, validationWarnings, and modelGaps.",
  systemInstructions:
    "Contact-hour estimates must be plausible, transparent, and easy for an instructor to edit.",
  developerInstructions:
    "Base total workload on credit hours, course length, modality, readings, assignments, discussions, quizzes, final project, instructional time, and student practice time. Include consistency checks and assumptions.",
  userPromptTemplate: `Course settings:
{{courseSettingsJson}}

Course object summary:
{{courseObjectSummaryJson}}

Generate ContactHourDraft JSON. Include instructional time, reading/media time, assignment time, discussion time, quiz/study time, final project time, total hours, per-module breakdown, assumptions, justification, consistency check against credit hours and term length, validationWarnings, and modelGaps.`,
  qualityChecklist: [
    "Total hours reconcile to credit hours.",
    "Per-module workload is plausible.",
    "Final project time is represented when selected.",
    "Modality assumptions are stated.",
    "Instructor can edit assumptions before publishing."
  ],
  failureModes: [
    "Hours do not add up.",
    "Workload ignores modality or course length.",
    "Justification is missing."
  ],
  notes: "Contact-hour prompt versions focus on transparent workload math and reviewability."
});
