export const fullyFledgedCourseStandard = [
  "Homepage with welcome, purpose, Start Here guidance, weekly rhythm, success tips, communication expectations, and Canvas-safe button links.",
  "Complete syllabus with outcomes, materials placeholders, technology requirements, communication plan, grading breakdown, weekly schedule, workload, support, late work, AI use, accessibility, and academic integrity placeholders.",
  "Start Here module with welcome, course-use guidance, syllabus tour, technology check, introduce-yourself discussion, success checklist, and optional low-stakes quiz.",
  "Instructional modules with overview, objectives, key terms, mini-lecture, examples, misconceptions, resources, practice, discussion or quiz when appropriate, assignment connections, recap, preview, and workload estimate.",
  "Final module with synthesis assignment, deliverables, milestones, rubric, submission instructions, and reflection or wrap-up activity.",
  "Instructor-only module with design rationale, alignment map, facilitation notes, weekly teaching notes, grading notes, intervention points, announcement templates, and printable course map.",
  "Assignments with purpose, authentic scenario, deliverables, format, step-by-step instructions, success criteria, submission instructions, estimated time, points, rubric alignment, outcome alignment, examples, and instructor notes.",
  "Discussions with concrete prompt, student role or scenario, evidence requirement, concept connection, initial post expectations, reply expectations, netiquette, grading criteria, facilitation notes, and rubric alignment.",
  "Quizzes with purpose, varied question types, answers, correct and incorrect feedback, difficulty labels, point values, and outcome alignment.",
  "Rubrics with specific criteria, performance levels, point values, descriptors, outcome alignment, and totals that match the graded item.",
  "Gradebook groups that are coherent, justified, and total 100 percent.",
  "Contact-hour and workload plan based on credits, course length, modality, instructional time, reading and media, assignments, discussions, quizzes, and final project work.",
  "Accessibility-aware Canvas-safe HTML with headings, descriptive links, plain language, alt-text placeholders, and no color-only meaning.",
  "Export-ready object mapping into CourseProject without unsupported Canvas-only content unless a modelGap note is included."
];

export const antiBeigeRules = {
  prevent: [
    "Vague module titles.",
    "Repeated wording across modules.",
    "Generic students will understand phrasing.",
    "Assignments that could fit any course.",
    "Discussions that ask only for opinions.",
    "Obvious or shallow quiz questions.",
    "Rubrics with generic criteria only.",
    "Pages that summarize instead of teaching.",
    "Fake readings, fake citations, fake URLs, or fake institutional policies."
  ],
  require: [
    "Concrete examples.",
    "Discipline-specific vocabulary.",
    "Applied scenarios.",
    "Student deliverables.",
    "Meaningful assessment criteria.",
    "Outcome alignment.",
    "Instructor-editable placeholders.",
    "Module-specific learning paths."
  ]
};

export const structuredOutputValidationRules = [
  "Blueprint module count matches settings.moduleCount.",
  "Every content module has objectives and workload hours.",
  "Every assignment aligns to at least one outcome and one rubric when rubrics are enabled.",
  "Every graded discussion has prompt expectations, reply expectations, points, and rubric alignment.",
  "Every quiz question includes type, stem, points, difficulty, feedback, and outcome alignment.",
  "Every rubric has criteria, levels, descriptors, aligned outcomes, and total points that match the target object.",
  "Gradebook groups total 100 percent.",
  "Contact hours reconcile to credit hours and term length.",
  "Every Canvas page body is Canvas-safe HTML.",
  "Resource recommendations use placeholders unless verified source material is supplied.",
  "Instructor-only materials are unpublished or marked for unpublished export when supported."
];

export const fullCourseObjectTargets = {
  homepage: 1,
  syllabus: 1,
  startHereModules: 1,
  instructionalModules: "8 to 16 based on settings",
  finalModules: "1 when final project or synthesis is selected",
  instructorOnlyModules: 1,
  lessonPagesPerInstructionalModule: "2 to 4",
  overviewPagesPerModule: 1,
  recapPagesPerModule: 1,
  gradebookTotalPercent: 100
};
