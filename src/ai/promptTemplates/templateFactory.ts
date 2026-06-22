import type { PromptImprovementPass, PromptTemplate, PromptTemplateSeriesDefinition } from "./types";

const createdAt = "2026-06-21T00:00:00.000Z";

const sharedSystemInstructions = [
  "You are RocketCourse's instructional design generation engine.",
  "Generate complete Canvas-ready course objects, not outline-only shells.",
  "Treat every output as a draft that an instructor can edit, verify, import, and teach from.",
  "Use Canvas-safe HTML for student-facing rich text. Do not emit scripts, iframe embeds, event handlers, or inaccessible visual-only cues.",
  "Never invent citations, readings, URLs, institution policies, accreditation claims, instructor names, or local support details.",
  "When source material is missing, create clear instructor-editable placeholders instead of fake specificity."
].join("\n");

const sharedDeveloperInstructions = [
  "Map generated content back to the CourseProject model: modules, pages, assignments, discussions, quizzes, rubrics, resources, schedule, assignment groups, contact hours, and review notes.",
  "Keep output structured. Use stable ids, explicit outcome alignment, module ids, point values, publish state, and Canvas object type names when the schema asks for them.",
  "Prefer concrete course-specific examples, scenarios, vocabulary, misconceptions, deliverables, and student actions.",
  "Mark instructor-only or human-review content clearly. Local policy placeholders must remain editable and must not pretend to be official policy.",
  "If a requested object cannot be represented by the current model, place it in the closest supported object and add a modelGap note."
].join("\n");

const sharedChecklist = [
  "Course-specific language is visible in titles, examples, activities, and assessments.",
  "All graded work aligns to at least one course outcome.",
  "Rubrics, points, assignment descriptions, and gradebook groups agree.",
  "Student-facing HTML uses headings, lists, descriptive links, and short paragraphs.",
  "Resources use verified source notes or placeholders, not fabricated citations or links.",
  "Instructor-editable placeholders are labeled where local policy, due dates, materials, or support links are required."
];

const sharedFailureModes = [
  "Generic wording that could fit any course.",
  "Outline-only content without teachable lesson material.",
  "Vague module titles such as Introduction without a specific instructional topic.",
  "Assessment prompts that ask only for opinions or summaries.",
  "Fake citations, fake URLs, fake readings, fake policies, or unsupported institutional claims.",
  "Unstructured prose where the caller needs CourseProject-compatible fields."
];

export const improvementPasses: PromptImprovementPass[] = [
  {
    version: "v1",
    name: "Pass 1 baseline prompt system",
    developerInstruction:
      "Establish the baseline object contract. Generate complete draft objects with required fields, but keep the structure conservative and easy to validate.",
    checklistItems: ["Required fields are present.", "Output shape is structured and CourseProject-compatible."],
    failureModes: ["Missing required object fields.", "Unstructured blobs returned for structured stages."],
    notes: "Baseline version created for initial fixture and regression comparison."
  },
  {
    version: "v2",
    name: "Pass 2 completeness improvement",
    developerInstruction:
      "Expand thin areas. Include Start Here support, rich module paths, final synthesis, instructor notes, resources, contact-hour logic, and all expected Canvas objects.",
    checklistItems: ["No major Canvas course component is omitted.", "Module pages include overview, lesson, practice, recap, and next-step guidance."],
    failureModes: ["Missing Start Here, final, or instructor-only material.", "Pages are summaries instead of instructional lessons."],
    notes: "Adds full-course completeness requirements across Canvas object types."
  },
  {
    version: "v3",
    name: "Pass 3 specificity improvement",
    developerInstruction:
      "Force discipline-specific language. Require concrete examples, cases, key terms, misconceptions, deliverables, and scenarios tied to the fixture discipline and learner audience.",
    checklistItems: ["Examples and tasks are discipline-specific.", "Repeated generic phrasing is avoided across modules."],
    failureModes: ["Repeated phrasing across modules.", "Assignments or discussions that could fit any course."],
    notes: "Adds anti-generic constraints and discipline-specific detail requirements."
  },
  {
    version: "v4",
    name: "Pass 4 alignment improvement",
    developerInstruction:
      "Tighten alignment. Every module, page, graded activity, quiz question, rubric criterion, gradebook group, and workload estimate must connect to outcomes and the course blueprint.",
    checklistItems: ["Outcomes, modules, assessments, rubrics, and gradebook groups align.", "Quiz questions and feedback reference the intended module concepts."],
    failureModes: ["Unaligned assessments.", "Rubric totals do not match assignment or discussion points."],
    notes: "Adds outcome and assessment alignment requirements."
  },
  {
    version: "v5",
    name: "Pass 5 Canvas-readiness and editability improvement",
    developerInstruction:
      "Optimize for Canvas import review. Use Canvas-safe HTML, editable placeholders, instructor review notes, resource verification notes, accessibility reminders, and model-gap notes.",
    checklistItems: ["HTML is Canvas-safe and readable.", "Editable placeholders are clear and human-reviewable."],
    failureModes: ["Canvas-hostile HTML.", "Local policy or resource placeholders are missing or masquerade as final content."],
    notes: "Adds Canvas-ready HTML, accessibility, editability, and fake-specificity controls."
  },
  {
    version: "v6",
    name: "Pass 6 regression and rollback readiness",
    developerInstruction:
      "Preserve regression comparability. Keep ids stable, avoid schema drift, surface model gaps, and make improvements without weakening completeness, specificity, alignment, or Canvas readiness.",
    checklistItems: ["The output can be compared with earlier versions.", "No quality category regresses below target without an explicit modelGap note."],
    failureModes: ["Schema drift between prompt versions.", "Improvements that break export readiness or rollback comparison."],
    notes: "Active version. Adds regression, rollback, and comparison discipline."
  }
];

export const makePromptTemplateSeries = (definition: PromptTemplateSeriesDefinition): PromptTemplate[] =>
  improvementPasses.map((pass) => ({
    id: `${definition.idBase}.${pass.version}`,
    stage: definition.stage,
    name: `${definition.name} ${pass.version}`,
    version: pass.version,
    purpose: definition.purpose,
    inputSchemaDescription: definition.inputSchemaDescription,
    outputSchemaDescription: definition.outputSchemaDescription,
    systemInstructions: `${sharedSystemInstructions}\n${definition.systemInstructions}`,
    developerInstructions: `${sharedDeveloperInstructions}\n${definition.developerInstructions}\n${pass.developerInstruction}`,
    userPromptTemplate: definition.userPromptTemplate,
    qualityChecklist: [...sharedChecklist, ...definition.qualityChecklist, ...pass.checklistItems],
    failureModes: [...sharedFailureModes, ...definition.failureModes, ...pass.failureModes],
    createdAt,
    notes: `${definition.notes} ${pass.notes}`
  }));
