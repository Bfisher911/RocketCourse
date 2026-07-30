// App-level model constants + small formatters shared by App.tsx and the screens
// extracted from it (Editor, Intake, Progress, Dashboard).
//
// A LEAF module on purpose: App and the lazily-loaded screens both need these,
// so keeping them in App.tsx would make each screen import App while App lazily
// imported the screen back — a cycle that fails at runtime, not build time.

import type { CourseProject } from "../types";

export const progressSteps = [
  "Reading course prompt and uploads",
  "Building course blueprint",
  "Creating learning objectives",
  "Designing modules",
  "Creating assignments and discussions",
  "Creating quizzes and rubrics",
  "Building homepage and syllabus",
  "Preparing Canvas export structure",
  "Validating course package"
];

export const editorTabs = [
  "Overview",
  "Imagery",
  "Homepage",
  "Syllabus",
  "Modules",
  "Pages",
  "Interactions",
  "Assignments",
  "Discussions",
  "Quizzes",
  "Rubrics",
  "Gradebook Setup",
  "Contact Hours",
  "Theme",
  "Transform",
  "Export"
] as const;

export type EditorTab = (typeof editorTabs)[number];

/**
 * Guided mode shows one build step (tab) at a time with back/next controls so new
 * users never face all fourteen sections at once. "tabs" restores the full strip.
 */
export type EditorViewMode = "guided" | "tabs";

export const EDITOR_VIEW_STORAGE_KEY = "rocketcourse.editor-view";

export const readStoredEditorView = (): EditorViewMode => {
  try {
    return window.localStorage.getItem(EDITOR_VIEW_STORAGE_KEY) === "tabs" ? "tabs" : "guided";
  } catch {
    return "guided";
  }
};

export const storeEditorView = (mode: EditorViewMode): void => {
  try {
    window.localStorage.setItem(EDITOR_VIEW_STORAGE_KEY, mode);
  } catch {
    // Storage unavailable (private mode) — the choice just won't persist.
  }
};

/**
 * The build steps grouped into 5 phases so the guided rail reads as a short,
 * approachable journey ("Phase 2 of 5") instead of a wall. Order must
 * match editorTabs — every tab appears in exactly one phase.
 */
export const editorPhases: Array<{ name: string; steps: EditorTab[] }> = [
  { name: "Foundations", steps: ["Overview", "Imagery", "Homepage", "Syllabus"] },
  { name: "Content", steps: ["Modules", "Pages", "Interactions"] },
  { name: "Assessment", steps: ["Assignments", "Discussions", "Quizzes", "Rubrics"] },
  { name: "Logistics", steps: ["Gradebook Setup", "Contact Hours"] },
  { name: "Finish", steps: ["Theme", "Transform", "Export"] }
];

export const phaseIndexForTab = (tab: EditorTab): number =>
  Math.max(0, editorPhases.findIndex((phase) => phase.steps.includes(tab)));

export const stepDescriptions: Record<EditorTab, string> = {
  Overview: "Confirm the course title, description, and learning outcomes.",
  Imagery: "Prepare accessible course images and Canvas-sized crops.",
  Homepage: "Design the first page students see in Canvas.",
  Syllabus: "Review and polish the syllabus students will read.",
  Modules: "Organize lessons into modules and set their order.",
  Pages: "Edit the content pages inside your modules.",
  Interactions: "Review and adjust the Canvas interaction patterns placed on your pages.",
  Assignments: "Set up graded assignments and their instructions.",
  Discussions: "Write discussion prompts and participation guidance.",
  Quizzes: "Build quizzes, questions, and answer keys.",
  Rubrics: "Attach grading rubrics to your assessments.",
  "Gradebook Setup": "Balance grading categories so they total 100%.",
  "Contact Hours": "Verify instructional time meets your requirements.",
  Theme: "Pick the visual style applied to exported Canvas pages.",
  Transform: "Optional: apply bulk changes across the whole course.",
  Export: "Validate everything and download your Canvas package."
};

export const weekdayOptions = ["0", "1", "2", "3", "4", "5", "6"];
export const weekdayLabels: Record<string, string> = {
  "0": "Sunday",
  "1": "Monday",
  "2": "Tuesday",
  "3": "Wednesday",
  "4": "Thursday",
  "5": "Friday",
  "6": "Saturday"
};

export const formatDate = (iso: string): string =>
  new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
