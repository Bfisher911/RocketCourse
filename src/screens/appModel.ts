// App-level model constants + small formatters shared by App.tsx and the screens
// extracted from it (Editor, Intake, Progress, Dashboard).
//
// A LEAF module on purpose: App and the lazily-loaded screens both need these,
// so keeping them in App.tsx would make each screen import App while App lazily
// imported the screen back — a cycle that fails at runtime, not build time.

import type { } from "../types";

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

/**
 * THE single source of truth for the editor's build steps. Each step is one
 * tab, belongs to exactly one guided-rail phase, and carries the one-line
 * description shown in guided mode. `editorTabs`, `editorPhases`, and
 * `stepDescriptions` are all derived from this list — add or move a step here
 * and every surface follows.
 */
export const EDITOR_STEPS = [
  { tab: "Overview", phase: "Foundations", description: "Confirm the course title, description, and learning outcomes." },
  { tab: "Imagery", phase: "Foundations", description: "Prepare accessible course images and Canvas-sized crops." },
  { tab: "Homepage", phase: "Foundations", description: "Design the first page students see in Canvas." },
  { tab: "Syllabus", phase: "Foundations", description: "Review and polish the syllabus students will read." },
  { tab: "Modules", phase: "Content", description: "Organize lessons into modules and set their order." },
  { tab: "Pages", phase: "Content", description: "Edit the content pages inside your modules." },
  { tab: "Interactions", phase: "Content", description: "Review and adjust the Canvas interaction patterns placed on your pages." },
  { tab: "Assignments", phase: "Assessment", description: "Set up graded assignments and their instructions." },
  { tab: "Discussions", phase: "Assessment", description: "Write discussion prompts and participation guidance." },
  { tab: "Quizzes", phase: "Assessment", description: "Build quizzes, questions, and answer keys." },
  { tab: "Rubrics", phase: "Assessment", description: "Attach grading rubrics to your assessments." },
  { tab: "Gradebook Setup", phase: "Logistics", description: "Balance grading categories so they total 100%." },
  { tab: "Contact Hours", phase: "Logistics", description: "Verify instructional time meets your requirements." },
  { tab: "Theme", phase: "Finish", description: "Pick the visual style applied to exported Canvas pages." },
  { tab: "Transform", phase: "Finish", description: "Optional: apply bulk changes across the whole course." },
  { tab: "Export", phase: "Finish", description: "Validate everything and download your Canvas package." }
] as const;

export type EditorTab = (typeof EDITOR_STEPS)[number]["tab"];

export const editorTabs: readonly EditorTab[] = EDITOR_STEPS.map((step) => step.tab);

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
 * The build steps grouped into phases so the guided rail reads as a short,
 * approachable journey ("Phase 2 of 5") instead of a wall. Derived from
 * EDITOR_STEPS — phase order follows first appearance.
 */
export const editorPhases: Array<{ name: string; steps: EditorTab[] }> = EDITOR_STEPS.reduce<Array<{ name: string; steps: EditorTab[] }>>(
  (phases, step) => {
    const existing = phases.find((phase) => phase.name === step.phase);
    if (existing) existing.steps.push(step.tab);
    else phases.push({ name: step.phase, steps: [step.tab] });
    return phases;
  },
  []
);

export const phaseIndexForTab = (tab: EditorTab): number =>
  Math.max(0, editorPhases.findIndex((phase) => phase.steps.includes(tab)));

export const stepDescriptions: Record<EditorTab, string> = Object.fromEntries(
  EDITOR_STEPS.map((step) => [step.tab, step.description])
) as Record<EditorTab, string>;

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

export const formatDate = (iso: string): string => {
  const date = new Date(iso);
  // Missing/zero timestamps otherwise render as the Unix epoch ("Dec 31, 6:00 PM").
  if (!iso || Number.isNaN(date.getTime()) || date.getTime() === 0) return "recently";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
};
