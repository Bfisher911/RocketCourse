import { makePromptTemplateSeries } from "./templateFactory";

export const discussionPromptTemplates = makePromptTemplateSeries({
  idBase: "discussionDraft",
  stage: "discussionDraft",
  name: "Discussion Drafting",
  purpose: "Generate discussion prompts that create meaningful student interaction.",
  inputSchemaDescription:
    "Input includes blueprint, module draft, discussion style, target outcomes, grading plan, learner audience, modality, and facilitation preferences.",
  outputSchemaDescription:
    "Return DiscussionDraft JSON with id, title, promptHtml, points, moduleId, assignmentGroupId, rubricRecommendation, alignedOutcomeIds, facilitationNotes, validationWarnings, and modelGaps.",
  systemInstructions:
    "Discussions should require evidence, course concepts, and peer interaction. Avoid opinion-only prompts.",
  developerInstructions:
    "Include setup context, prompt, student role or scenario, required concept connection, evidence or example requirement, initial post instructions, reply instructions, netiquette guidance, grading criteria, facilitation notes, and aligned outcomes. Prefer original, public-domain, or instructor-supplied cases; do not imitate protected characters or fictional worlds. Keep roleplay purposeful and the tone professional rather than theatrical.",
  userPromptTemplate: `Approved blueprint:
{{blueprintJson}}

Module draft:
{{moduleDraftJson}}

Discussion request:
{{discussionRequestJson}}

Generate a DiscussionDraft JSON object. Include setup context, prompt, required course concept connection, evidence or example requirement, initial post expectations, reply expectations, netiquette guidance, grading criteria, instructor facilitation note, rubric recommendation, aligned outcomes, validationWarnings, and modelGaps.`,
  qualityChecklist: [
    "Discussion asks students to use course concepts and evidence.",
    "Initial post and reply expectations are specific.",
    "Facilitation notes help the instructor deepen the conversation.",
    "Grading criteria are student-facing.",
    "Prompt creates interaction beyond agreement or opinion."
  ],
  failureModes: [
    "Prompt asks only for personal opinion.",
    "Reply instructions are vague.",
    "Facilitation note is missing or generic."
  ],
  notes: "Discussion prompt versions focus on interaction quality and grading clarity."
});
