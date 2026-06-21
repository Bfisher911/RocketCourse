import { makePromptTemplateSeries } from "./templateFactory";

export const moduleDraftPromptTemplates = makePromptTemplateSeries({
  idBase: "moduleDraft",
  stage: "moduleDraft",
  name: "Module Drafting",
  purpose: "Generate full module-level learning paths from the approved blueprint.",
  inputSchemaDescription:
    "Input includes approved CourseBlueprint, CourseSettings, target module, neighboring module context, outcomes, assessment plan, resource notes, and Canvas model constraints.",
  outputSchemaDescription:
    "Return ModuleDraft JSON with module id, title, description, objectives, workloadHours, overview page plan, lesson page plans, resource plan, practice activity, discussion or quiz plan, assignment connection, recap, next-step preview, schedule entries, validationWarnings, and modelGaps.",
  systemInstructions:
    "A module draft should read like a weekly or unit teaching plan that can become Canvas module items.",
  developerInstructions:
    "Create a complete learning path. Each content module needs overview, objectives, key terms, readings and resources, rich lesson content, examples, misconceptions, practice, applicable graded work, recap, and preview.",
  userPromptTemplate: `Approved blueprint:
{{blueprintJson}}

Target module:
{{moduleJson}}

Course settings:
{{courseSettingsJson}}

Generate a ModuleDraft JSON object for this module. Include overview, objectives, key terms, student tasks, instructional narrative, examples, misconception callouts, practice activity, discussion or quiz plan when appropriate, assignment connection, recap, preview of next module, workload estimate, schedule entries, validationWarnings, and modelGaps.`,
  qualityChecklist: [
    "Module contains a complete learning path from overview to recap.",
    "Objectives map to course outcomes.",
    "Workload estimate is plausible for course credits and length.",
    "Practice prepares students for graded work.",
    "Module language is specific to the course discipline and audience."
  ],
  failureModes: [
    "Module becomes a checklist without instructional substance.",
    "Practice activity does not prepare for assessment.",
    "Workload ignores credit hours or course length."
  ],
  notes: "Module draft versions test completeness, specificity, and alignment at the module boundary."
});
