import type { ContentBlockId } from "./contentBlocks";

export const ROCK_CONTENT_CATEGORIES = [
  "Welcome",
  "Navigation",
  "Module",
  "Activity",
  "Assignment",
  "Discussion",
  "Quiz",
  "Syllabus",
  "Support",
  "Reflection",
  "Timeline",
  "Case Study",
  "Debate",
  "Project",
  "Wrap-Up",
  "Instructor Notes"
] as const;

export type RockContentCategory = (typeof ROCK_CONTENT_CATEGORIES)[number];

export const ROCK_CATEGORY_BLOCKS: Record<RockContentCategory, ContentBlockId[]> = {
  Welcome: ["hero-banner", "course-promise-statement", "instructor-welcome-card", "course-trailer-video-placeholder"],
  Navigation: ["start-here-button-panel", "navigation-tile-grid", "course-journey-map", "student-success-path"],
  Module: ["module-mission-briefing", "module-objectives-chips", "before-you-begin-checklist", "module-map", "key-terms-cards", "prior-module-connection-card", "next-module-preview-card"],
  Activity: ["read-watch-do-layout", "try-this-now-activity-block", "process-diagram", "card-grid", "resource-list"],
  Assignment: ["assignment-brief", "deliverable-checklist", "rubric-preview", "starter-prompts", "ai-use-guidance", "submission-survival-kit", "stretch-goal"],
  Discussion: ["discussion-role-card", "first-post-and-reply-guidance", "conversation-moves-cards", "sample-strong-reply", "peer-response-starters"],
  Quiz: ["quiz-study-cards", "confidence-check", "quiz-review-and-remediation-block"],
  Syllabus: [
    "syllabus-policy-cards",
    "grading-breakdown-visual",
    "weekly-schedule-visual-table",
    "communication-expectations-block",
    "technology-needed-block",
    "late-work-policy-at-a-glance",
    "accessibility-and-inclusion-panel",
    "student-success-path",
    "need-help-support-panel",
    "ai-use-guidance"
  ],
  Support: ["need-help-support-panel", "accessibility-and-inclusion-panel", "student-success-path", "technology-needed-block"],
  Reflection: ["pause-and-think-reflection-box", "quote-block", "field-note-box"],
  Timeline: ["timeline", "process-diagram", "course-journey-map"],
  "Case Study": ["case-file-layout", "student-decision-point", "comparison-table", "field-note-box"],
  Debate: ["big-question-banner", "myth-vs-reality-cards", "discussion-role-card", "conversation-moves-cards"],
  Project: ["assignment-brief", "timeline", "process-diagram", "stretch-goal", "course-journey-map"],
  "Wrap-Up": ["prior-module-connection-card", "next-module-preview-card", "student-success-path", "quiz-review-and-remediation-block", "stretch-goal"],
  "Instructor Notes": ["instructor-margin-note", "instructor-facilitation-notes", "announcement-bank", "course-launch-checklist", "mid-course-pulse-check-survey-template"]
};

export type RockQuickActionId =
  | "make-more-visual"
  | "paragraph-to-cards"
  | "list-to-timeline"
  | "student-friendly-scaffolding"
  | "examples-and-non-examples"
  | "accessibility-improvements"
  | "instructor-voice"
  | "simplify-page-layout"
  | "canvas-homepage-ready"
  | "start-here-page";

export interface RockQuickAction {
  id: RockQuickActionId;
  label: string;
  description: string;
}

export const ROCK_QUICK_ACTIONS: RockQuickAction[] = [
  { id: "make-more-visual", label: "Make this more visual", description: "Adds curated visual structure without calling live AI." },
  { id: "paragraph-to-cards", label: "Turn this paragraph into cards", description: "Extracts sentences into editable card-style blocks." },
  { id: "list-to-timeline", label: "Turn this list into a timeline", description: "Turns detected list items into a Canvas-safe timeline." },
  { id: "student-friendly-scaffolding", label: "Add student-friendly scaffolding", description: "Adds before-you-begin, support, and success-path blocks." },
  { id: "examples-and-non-examples", label: "Add examples and non-examples", description: "Adds concept/example plus myth/reality patterns." },
  { id: "accessibility-improvements", label: "Add accessibility improvements", description: "Adds access, technology, and support guidance." },
  { id: "instructor-voice", label: "Add instructor voice", description: "Adds a welcome or instructor note pattern." },
  { id: "simplify-page-layout", label: "Simplify this page layout", description: "Rebuilds the current text into a simpler scan-friendly layout." },
  { id: "canvas-homepage-ready", label: "Make this Canvas homepage-ready", description: "Builds a curated homepage-ready block set." },
  { id: "start-here-page", label: "Convert this into a Start Here page", description: "Builds a Start Here page with launch and support patterns." }
];
