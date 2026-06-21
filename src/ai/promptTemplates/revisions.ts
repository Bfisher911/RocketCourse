import { makePromptTemplateSeries } from "./templateFactory";

export const revisionPromptTemplates = makePromptTemplateSeries({
  idBase: "revision",
  stage: "revision",
  name: "Object Revision Actions",
  purpose: "Revise existing CourseForge objects without losing structure, alignment, or Canvas readiness.",
  inputSchemaDescription:
    "Input includes course context, target object type, target object, revision action, outcomes, module context, current rubric or quiz context, constraints, and human instructions.",
  outputSchemaDescription:
    "Return RevisionResult JSON with revisedObject, changedFields, rationale, preservedIds, alignmentImpact, accessibilityImpact, validationWarnings, and modelGaps.",
  systemInstructions:
    "Object revisions should improve the selected object while preserving ids, references, points, outcome alignment, and export compatibility unless explicitly asked.",
  developerInstructions:
    "Supported actions include make this page more specific, add examples, simplify language, make assignment more authentic, strengthen rubric, add accessibility improvements, align to outcomes, convert thin content into a fuller lesson, improve Canvas readability, reduce verbosity while preserving completeness, add instructor notes, and add student success guidance.",
  userPromptTemplate: `Course context:
{{courseContextJson}}

Target object:
{{targetObjectJson}}

Revision action:
{{revisionAction}}

Generate RevisionResult JSON. Preserve stable ids and references unless the revision explicitly requires new objects. Explain changed fields, rationale, alignment impact, accessibility impact, validationWarnings, and modelGaps. Do not add fake citations, URLs, policies, or unsupported claims.`,
  qualityChecklist: [
    "Revision directly addresses the requested action.",
    "Ids, points, references, and outcome alignment are preserved unless intentionally changed.",
    "Revised HTML remains Canvas-safe.",
    "Specificity improves without fake source details.",
    "Rationale explains what changed."
  ],
  failureModes: [
    "Revision changes unrelated fields.",
    "Revision breaks references or point totals.",
    "Revision adds unsupported specificity."
  ],
  notes: "Revision prompt versions support future object-level AI operations behind a server-side service."
});
