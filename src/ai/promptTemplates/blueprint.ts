import { makePromptTemplateSeries } from "./templateFactory";

export const blueprintPromptTemplates = makePromptTemplateSeries({
  idBase: "blueprint",
  stage: "blueprint",
  name: "Course Blueprint Generation",
  purpose: "Generate a complete RocketCourse blueprint before detailed Canvas object drafting.",
  inputSchemaDescription:
    "Input includes prompt, CourseSettings, source file notes, target audience, modality, credit hours, length, module count, assessment preferences, resource constraints, tone, and any instructor-provided source material.",
  outputSchemaDescription:
    "Return CourseBlueprint JSON with title, description, learners, level, modality, credit hours, length, modules, outcomes, module objectives, major assessments, discussion plan, quiz plan, final project plan, gradebook plan, workload assumptions, source notes, teaching approach, accessibility notes, Canvas object map, validationWarnings, and modelGaps.",
  systemInstructions:
    "Blueprints must decide the instructional architecture before downstream drafting begins. The blueprint is a contract, not a brainstorm.",
  developerInstructions:
    "Reject thin topics. Do not allow module titles such as Introduction unless the title identifies a specific concept, problem, method, or applied context. Include the Start Here, final, and instructor-only course architecture in the Canvas object map.",
  userPromptTemplate: `Course intake:
{{courseBriefJson}}

Course settings:
{{courseSettingsJson}}

Source material notes:
{{sourceNotes}}

Generate a complete CourseBlueprint JSON object. Include exact module count, course outcomes, module objectives, major assessments, discussions, quizzes, final project plan, gradebook groups that total 100 percent, contact-hour assumptions, accessibility notes, resource placeholder policy, Canvas object map, validationWarnings, and modelGaps. Do not invent readings, URLs, institutional policies, or instructor identity.`,
  qualityChecklist: [
    "Module list matches the requested module count.",
    "Every module title names a specific instructional topic.",
    "Major assessments are distributed across the course and tied to outcomes.",
    "The Canvas object map includes pages, assignments, discussions, quizzes, rubrics, resources, gradebook groups, schedule, contact hours, and instructor-only materials.",
    "Source material gaps are represented as placeholders or modelGaps."
  ],
  failureModes: [
    "Blueprint is only an outline.",
    "Module plan ignores modality, course length, or credit hours.",
    "Major assessments do not connect to outcomes.",
    "Resource plan invents citations or URLs."
  ],
  notes: "Blueprint versions support comparison before downstream object generation."
});
