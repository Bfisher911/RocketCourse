export const CONTENT_BLOCK_SURFACES = [
  "homepage",
  "syllabus",
  "contentPage",
  "moduleOverview",
  "assignment",
  "discussion",
  "quiz",
  "startHere",
  "wrapUp",
  "instructor"
] as const;

export type ContentBlockSurface = (typeof CONTENT_BLOCK_SURFACES)[number];

export const CONTENT_BLOCK_CATEGORIES = [
  "Course Start",
  "Module Flow",
  "Learning Content",
  "Activities",
  "Assignment",
  "Discussion",
  "Quiz",
  "Syllabus",
  "Instructor"
] as const;

export type ContentBlockCategory = (typeof CONTENT_BLOCK_CATEGORIES)[number];

export interface ContentBlockMeta {
  id: string;
  name: string;
  description: string;
  category: ContentBlockCategory;
  surfaces: ContentBlockSurface[];
}

export const CONTENT_BLOCKS = [
  {
    id: "hero-banner",
    name: "Hero Banner",
    description: "A theme-aware course or page opener with plain-text image guidance.",
    category: "Course Start",
    surfaces: ["homepage", "contentPage", "startHere", "moduleOverview"]
  },
  {
    id: "start-here-button-panel",
    name: "Start Here Button Panel",
    description: "Primary Canvas-safe navigation actions for the first student visit.",
    category: "Course Start",
    surfaces: ["homepage", "startHere"]
  },
  {
    id: "course-journey-map",
    name: "Course Journey Map",
    description: "A visual path from orientation through final synthesis.",
    category: "Course Start",
    surfaces: ["homepage", "syllabus", "startHere"]
  },
  {
    id: "this-week-at-a-glance",
    name: "This Week at a Glance",
    description: "A compact weekly overview for workload, activities, and due work.",
    category: "Course Start",
    surfaces: ["homepage", "moduleOverview", "contentPage"]
  },
  {
    id: "course-promise-statement",
    name: "Course Promise Statement",
    description: "A clear statement of what students will practice and leave with.",
    category: "Course Start",
    surfaces: ["homepage", "syllabus", "startHere"]
  },
  {
    id: "instructor-welcome-card",
    name: "Instructor Welcome Card",
    description: "A friendly editable welcome with contact and support cues.",
    category: "Course Start",
    surfaces: ["homepage", "syllabus", "startHere"]
  },
  {
    id: "navigation-tile-grid",
    name: "Navigation Tile Grid",
    description: "A grid of Canvas-safe destinations for common student tasks.",
    category: "Course Start",
    surfaces: ["homepage", "startHere", "contentPage"]
  },
  {
    id: "how-to-succeed-checklist",
    name: "How to Succeed Checklist",
    description: "Actionable habits students can scan before beginning.",
    category: "Course Start",
    surfaces: ["homepage", "syllabus", "startHere"]
  },
  {
    id: "need-help-support-panel",
    name: "Need Help Support Panel",
    description: "A support routing block for course, technology, and access issues.",
    category: "Course Start",
    surfaces: ["homepage", "contentPage", "assignment", "discussion", "quiz", "startHere"]
  },
  {
    id: "course-trailer-video-placeholder",
    name: "Course Trailer Video Placeholder",
    description: "A Canvas-safe video placeholder with caption and alt-text reminders.",
    category: "Course Start",
    surfaces: ["homepage", "startHere", "contentPage"]
  },
  {
    id: "module-mission-briefing",
    name: "Module Mission Briefing",
    description: "A concise module purpose, scenario, and outcome framing block.",
    category: "Module Flow",
    surfaces: ["moduleOverview", "contentPage"]
  },
  {
    id: "module-objectives-chips",
    name: "Module Objectives Chips",
    description: "Theme-tinted objective chips for quick scanning.",
    category: "Module Flow",
    surfaces: ["moduleOverview", "contentPage"]
  },
  {
    id: "before-you-begin-checklist",
    name: "Before You Begin Checklist",
    description: "A readiness checklist for materials, time, and questions.",
    category: "Module Flow",
    surfaces: ["moduleOverview", "contentPage", "assignment", "discussion", "quiz"]
  },
  {
    id: "module-map",
    name: "Module Map",
    description: "A Canvas-friendly sequence of module moves and deliverables.",
    category: "Module Flow",
    surfaces: ["moduleOverview", "contentPage"]
  },
  {
    id: "key-terms-cards",
    name: "Key Terms Cards",
    description: "Editable glossary cards with term, definition, and student use.",
    category: "Module Flow",
    surfaces: ["moduleOverview", "contentPage", "quiz"]
  },
  {
    id: "big-question-banner",
    name: "Big Question Banner",
    description: "A high-visibility inquiry question for a module or lesson.",
    category: "Module Flow",
    surfaces: ["moduleOverview", "contentPage", "discussion"]
  },
  {
    id: "prior-module-connection-card",
    name: "Prior Module Connection Card",
    description: "A bridge from previous learning into the current module.",
    category: "Module Flow",
    surfaces: ["moduleOverview", "contentPage", "wrapUp"]
  },
  {
    id: "next-module-preview-card",
    name: "Next Module Preview Card",
    description: "A forward-looking preview that prepares students for what comes next.",
    category: "Module Flow",
    surfaces: ["moduleOverview", "contentPage", "wrapUp"]
  },
  {
    id: "common-mistake-callout",
    name: "Common Mistake Callout",
    description: "A misconception warning with a concrete repair move.",
    category: "Module Flow",
    surfaces: ["moduleOverview", "contentPage", "assignment", "quiz"]
  },
  {
    id: "instructor-margin-note",
    name: "Instructor Margin Note",
    description: "A narrow instructor note that remains editable in HTML.",
    category: "Module Flow",
    surfaces: ["contentPage", "moduleOverview", "instructor"]
  },
  {
    id: "read-watch-do-layout",
    name: "Read Watch Do Layout",
    description: "Three-column lesson flow for readings, media, and practice.",
    category: "Learning Content",
    surfaces: ["contentPage", "moduleOverview", "startHere"]
  },
  {
    id: "concept-and-example-block",
    name: "Concept and Example Block",
    description: "A paired explanation and worked example layout.",
    category: "Learning Content",
    surfaces: ["contentPage", "moduleOverview", "assignment"]
  },
  {
    id: "myth-vs-reality-cards",
    name: "Myth vs Reality Cards",
    description: "Contrasting cards for misconceptions and corrected understanding.",
    category: "Learning Content",
    surfaces: ["contentPage", "moduleOverview", "discussion"]
  },
  {
    id: "pause-and-think-reflection-box",
    name: "Pause and Think Reflection Box",
    description: "A brief reflection prompt students can answer privately.",
    category: "Learning Content",
    surfaces: ["contentPage", "discussion", "wrapUp"]
  },
  {
    id: "try-this-now-activity-block",
    name: "Try This Now Activity Block",
    description: "A low-stakes practice activity with steps and success markers.",
    category: "Activities",
    surfaces: ["contentPage", "moduleOverview", "assignment"]
  },
  {
    id: "case-file-layout",
    name: "Case File Layout",
    description: "A structured case, evidence, stakeholder, and decision layout.",
    category: "Activities",
    surfaces: ["contentPage", "assignment", "discussion"]
  },
  {
    id: "field-note-box",
    name: "Field Note Box",
    description: "An observation note for examples, data, or local context.",
    category: "Activities",
    surfaces: ["contentPage", "assignment", "discussion"]
  },
  {
    id: "student-decision-point",
    name: "Student Decision Point",
    description: "A decision prompt with options, evidence, and tradeoffs.",
    category: "Activities",
    surfaces: ["contentPage", "assignment", "discussion"]
  },
  {
    id: "timeline",
    name: "Timeline",
    description: "A vertical sequence for history, process, or milestone work.",
    category: "Activities",
    surfaces: ["contentPage", "moduleOverview", "assignment", "syllabus"]
  },
  {
    id: "process-diagram",
    name: "Process Diagram",
    description: "A step-by-step process diagram using plain HTML blocks.",
    category: "Activities",
    surfaces: ["contentPage", "assignment", "moduleOverview"]
  },
  {
    id: "card-grid",
    name: "Card Grid",
    description: "A responsive set of editable cards for concepts or resources.",
    category: "Activities",
    surfaces: ["contentPage", "moduleOverview", "homepage"]
  },
  {
    id: "quote-block",
    name: "Quote Block",
    description: "A styled quotation block with source placeholder guidance.",
    category: "Activities",
    surfaces: ["contentPage", "discussion", "wrapUp"]
  },
  {
    id: "resource-list",
    name: "Resource List",
    description: "A vetted resource list with access and use notes.",
    category: "Activities",
    surfaces: ["contentPage", "moduleOverview", "syllabus"]
  },
  {
    id: "comparison-table",
    name: "Comparison Table",
    description: "An accessible table for comparing concepts, methods, or options.",
    category: "Activities",
    surfaces: ["contentPage", "assignment", "quiz", "syllabus"]
  },
  {
    id: "assignment-brief",
    name: "Assignment Brief",
    description: "A clear assignment overview with task, purpose, and submission cues.",
    category: "Assignment",
    surfaces: ["assignment", "contentPage"]
  },
  {
    id: "deliverable-checklist",
    name: "Deliverable Checklist",
    description: "A checklist students can use before submitting work.",
    category: "Assignment",
    surfaces: ["assignment", "contentPage"]
  },
  {
    id: "rubric-preview",
    name: "Rubric Preview",
    description: "A small accessible criteria table students can review early.",
    category: "Assignment",
    surfaces: ["assignment", "contentPage", "syllabus"]
  },
  {
    id: "starter-prompts",
    name: "Starter Prompts",
    description: "Sentence starters and planning prompts for assignment drafting.",
    category: "Assignment",
    surfaces: ["assignment", "discussion", "contentPage"]
  },
  {
    id: "ai-use-guidance",
    name: "AI Use Guidance",
    description: "Editable guidance for permitted, limited, and prohibited AI use.",
    category: "Assignment",
    surfaces: ["assignment", "syllabus", "contentPage"]
  },
  {
    id: "submission-survival-kit",
    name: "Submission Survival Kit",
    description: "Final checks for file access, rubric review, and technical issues.",
    category: "Assignment",
    surfaces: ["assignment", "quiz", "contentPage"]
  },
  {
    id: "stretch-goal",
    name: "Stretch Goal",
    description: "Optional extension challenge for students who want to go further.",
    category: "Assignment",
    surfaces: ["assignment", "contentPage", "wrapUp"]
  },
  {
    id: "discussion-role-card",
    name: "Discussion Role Card",
    description: "Student roles for a more purposeful discussion thread.",
    category: "Discussion",
    surfaces: ["discussion", "contentPage"]
  },
  {
    id: "first-post-and-reply-guidance",
    name: "First Post and Reply Guidance",
    description: "Guidance for initial posts and substantive peer replies.",
    category: "Discussion",
    surfaces: ["discussion", "contentPage"]
  },
  {
    id: "conversation-moves-cards",
    name: "Conversation Moves Cards",
    description: "A card set of respectful discussion moves students can use.",
    category: "Discussion",
    surfaces: ["discussion", "contentPage"]
  },
  {
    id: "sample-strong-reply",
    name: "Sample Strong Reply",
    description: "A model reply with annotations students can adapt.",
    category: "Discussion",
    surfaces: ["discussion", "contentPage"]
  },
  {
    id: "peer-response-starters",
    name: "Peer Response Starters",
    description: "Useful peer reply starters without requiring agreement-only posts.",
    category: "Discussion",
    surfaces: ["discussion", "contentPage"]
  },
  {
    id: "quiz-study-cards",
    name: "Quiz Study Cards",
    description: "Study cards for concept, example, and retrieval practice.",
    category: "Quiz",
    surfaces: ["quiz", "contentPage", "moduleOverview"]
  },
  {
    id: "confidence-check",
    name: "Confidence Check",
    description: "A pre-quiz readiness check students can complete privately.",
    category: "Quiz",
    surfaces: ["quiz", "contentPage", "moduleOverview"]
  },
  {
    id: "quiz-review-and-remediation-block",
    name: "Quiz Review and Remediation Block",
    description: "A post-quiz review plan with targeted next steps.",
    category: "Quiz",
    surfaces: ["quiz", "contentPage", "wrapUp"]
  },
  {
    id: "syllabus-policy-cards",
    name: "Syllabus Policy Cards",
    description: "Compact policy cards for academic integrity, support, and grading.",
    category: "Syllabus",
    surfaces: ["syllabus", "startHere"]
  },
  {
    id: "grading-breakdown-visual",
    name: "Grading Breakdown Visual",
    description: "A visual grade-weight summary using accessible text.",
    category: "Syllabus",
    surfaces: ["syllabus", "homepage"]
  },
  {
    id: "weekly-schedule-visual-table",
    name: "Weekly Schedule Visual Table",
    description: "An accessible weekly schedule table with workload cues.",
    category: "Syllabus",
    surfaces: ["syllabus", "homepage", "startHere"]
  },
  {
    id: "communication-expectations-block",
    name: "Communication Expectations Block",
    description: "Clear instructor response, student posting, and channel expectations.",
    category: "Syllabus",
    surfaces: ["syllabus", "startHere"]
  },
  {
    id: "technology-needed-block",
    name: "Technology Needed Block",
    description: "Required technology and access expectations.",
    category: "Syllabus",
    surfaces: ["syllabus", "startHere", "assignment", "quiz"]
  },
  {
    id: "late-work-policy-at-a-glance",
    name: "Late Work Policy at a Glance",
    description: "A plain-language late-work summary with local-policy placeholders.",
    category: "Syllabus",
    surfaces: ["syllabus", "assignment"]
  },
  {
    id: "accessibility-and-inclusion-panel",
    name: "Accessibility and Inclusion Panel",
    description: "An editable access, accommodations, and inclusion reminder.",
    category: "Syllabus",
    surfaces: ["syllabus", "homepage", "startHere", "contentPage"]
  },
  {
    id: "student-success-path",
    name: "Student Success Path",
    description: "A sequence students can follow from setup through feedback.",
    category: "Syllabus",
    surfaces: ["syllabus", "homepage", "startHere", "wrapUp"]
  },
  {
    id: "instructor-facilitation-notes",
    name: "Instructor Facilitation Notes",
    description: "Private facilitation prompts for teaching moves and interventions.",
    category: "Instructor",
    surfaces: ["instructor", "moduleOverview", "contentPage"]
  },
  {
    id: "announcement-bank",
    name: "Announcement Bank",
    description: "Reusable announcement drafts for launch, pacing, and reminders.",
    category: "Instructor",
    surfaces: ["instructor", "moduleOverview"]
  },
  {
    id: "course-launch-checklist",
    name: "Course Launch Checklist",
    description: "Instructor-only launch checks before the course opens.",
    category: "Instructor",
    surfaces: ["instructor", "startHere"]
  },
  {
    id: "mid-course-pulse-check-survey-template",
    name: "Mid-Course Pulse Check Survey Template",
    description: "A Canvas-safe mid-course survey prompt template.",
    category: "Instructor",
    surfaces: ["instructor", "contentPage", "moduleOverview"]
  }
] as const satisfies readonly ContentBlockMeta[];

export type ContentBlockId = (typeof CONTENT_BLOCKS)[number]["id"];

export const getContentBlock = (id: ContentBlockId): (typeof CONTENT_BLOCKS)[number] | undefined =>
  CONTENT_BLOCKS.find((block) => block.id === id);
