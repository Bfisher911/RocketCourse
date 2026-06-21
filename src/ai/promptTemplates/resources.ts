import { makePromptTemplateSeries } from "./templateFactory";

export const resourcePromptTemplates = makePromptTemplateSeries({
  idBase: "resourceDraft",
  stage: "resourceDraft",
  name: "Resource Drafting",
  purpose: "Generate editable resource placeholders and recommendations without fake citations.",
  inputSchemaDescription:
    "Input includes blueprint, module draft, available source notes, required material constraints, learner audience, accessibility constraints, and resource types requested.",
  outputSchemaDescription:
    "Return ResourceDraft JSON with resources. Each resource includes id, moduleId, title, type, whyItMatters, estimatedMinutes, studentInstructions, instructorEditNote, placeholder, optional, publishState, validationWarnings, and modelGaps.",
  systemInstructions:
    "Resources should guide instructor curation. Do not invent source details.",
  developerInstructions:
    "Include textbook chapter placeholder, OER suggestion placeholder, article placeholder, video placeholder, podcast or media placeholder when useful, local resource placeholder, and a note requiring instructor verification.",
  userPromptTemplate: `Module draft:
{{moduleDraftJson}}

Available verified sources:
{{sourceMaterialJson}}

Generate ResourceDraft JSON. Create editable resource placeholders and recommendations for this module. Include textbook, OER, article, video or media, podcast when appropriate, and instructor-added local resource placeholders. Do not invent citations, URLs, authors, titles, or publication details unless they are supplied in verified source material.`,
  qualityChecklist: [
    "Resources are useful for module objectives.",
    "Placeholders make verification work obvious.",
    "Media resources include caption or transcript guidance.",
    "Estimated minutes are plausible.",
    "No fake citations or URLs appear."
  ],
  failureModes: [
    "Fabricated source details.",
    "Resource placeholders are too vague to edit.",
    "Accessibility guidance is missing for media."
  ],
  notes: "Resource prompt versions focus on useful curation without hallucinated specificity."
});
