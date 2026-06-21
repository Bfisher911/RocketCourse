import { makePromptTemplateSeries } from "./templateFactory";

export const homepagePromptTemplates = makePromptTemplateSeries({
  idBase: "homepageDraft",
  stage: "homepageDraft",
  name: "Homepage Drafting",
  purpose: "Generate a polished Canvas homepage that orients students and sends them to the right first action.",
  inputSchemaDescription:
    "Input includes blueprint, course title, description, modality, Start Here plan, syllabus link, calendar link, major assignments, support notes, theme colors, and Canvas-safe HTML constraints.",
  outputSchemaDescription:
    "Return HomepageDraft JSON with id, title, slug, bodyHtml, frontPage true, studentFirstAction, instructorEditNotes, accessibilityNotes, validationWarnings, and modelGaps.",
  systemInstructions:
    "The homepage should make the first student action obvious.",
  developerInstructions:
    "Include welcome, course purpose, where to start, weekly rhythm, major assignments, success checklist, support information, communication expectations, and Canvas-safe button-style links.",
  userPromptTemplate: `Course blueprint:
{{blueprintJson}}

Navigation and link targets:
{{navigationJson}}

Theme:
{{themeJson}}

Generate a HomepageDraft JSON object with Canvas-safe bodyHtml. Include welcome, course purpose, where to start, weekly rhythm, major assignments, student success checklist, support information, communication expectations, and clear button-style links to Start Here, syllabus, and course calendar. Use descriptive links and no unsupported scripts.`,
  qualityChecklist: [
    "The homepage identifies what students should do first.",
    "Button-style links use descriptive labels.",
    "Weekly rhythm and success tips are visible.",
    "Support and communication expectations are editable.",
    "HTML is readable in Canvas."
  ],
  failureModes: [
    "Homepage acts like a marketing page instead of a course entry point.",
    "Start Here action is unclear.",
    "Links are placeholders or non-descriptive."
  ],
  notes: "Homepage prompt versions focus on student orientation and Canvas navigation."
});
