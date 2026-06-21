import { makePromptTemplateSeries } from "./templateFactory";

export const lessonPagePromptTemplates = makePromptTemplateSeries({
  idBase: "lessonPageDraft",
  stage: "lessonPageDraft",
  name: "Lesson Page Drafting",
  purpose: "Generate rich Canvas-safe instructional page HTML for module lessons.",
  inputSchemaDescription:
    "Input includes blueprint, module draft, page purpose, outcomes, learner audience, key terms, examples to include, accessibility constraints, and resource notes.",
  outputSchemaDescription:
    "Return LessonPageDraft JSON with id, title, slug, bodyHtml, moduleId, alignedOutcomeIds, studentNextAction, instructorEditNotes, accessibilityNotes, validationWarnings, and modelGaps.",
  systemInstructions:
    "A lesson page teaches. It is not a short summary, syllabus excerpt, or placeholder.",
  developerInstructions:
    "Use Canvas-safe HTML with h2 and h3 sections, short paragraphs, lists, callouts, descriptive link placeholders, and alt-text placeholders when media is referenced.",
  userPromptTemplate: `Course blueprint:
{{blueprintJson}}

Module draft:
{{moduleDraftJson}}

Page request:
{{pageRequestJson}}

Generate a LessonPageDraft JSON object. bodyHtml must include a short introduction, concept explanation, examples, applied scenario, common misconception or caution, check for understanding, reflection prompt, summary, and next action. Keep the page course-specific and module-specific. Do not invent external sources.`,
  qualityChecklist: [
    "The page contains substantive teaching content.",
    "HTML uses accessible headings, lists, and readable paragraphs.",
    "Examples and scenarios are module-specific.",
    "The page includes a check for understanding and next action.",
    "Instructor placeholders are clearly marked when sources or policies need verification."
  ],
  failureModes: [
    "Page is a generic summary.",
    "Page uses unsupported embeds or scripts.",
    "Examples are not tied to the module."
  ],
  notes: "Lesson page versions test whether AI output creates teachable student-facing HTML."
});
