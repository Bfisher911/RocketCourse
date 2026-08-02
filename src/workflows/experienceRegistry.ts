// ============================================================================
// Workflow-Experience Registry (Phase 2).
// One typed source of truth for the nine interchangeable course-building
// experiences. Adding a future experience means adding one entry here — the
// selector and host read this list, so nothing else needs rewriting.
//
// IMPORTANT: an experience only changes navigation / presentation / guidance.
// It never owns course content. All experiences render the SAME shared course
// state (see host.ts) and call the SAME shared actions.
//
// TIERING: only W01 (the real editor) and W02 (the recommended guided journey)
// ship enabled in the app. W03–W09 stay registered but disabled — the app's
// pickers hide/deactivate them, while the standalone lab (workflows.html)
// ignores `enabled` and keeps every concept explorable.
//
// NOTE: the app renders W02 natively (components/GuidedJourney.tsx, a React
// component over CourseProject). `prototypeKey` is read only by the lab's
// host. Promoting another concept means building it as a React surface the
// same way — not flipping `enabled` alone.
// ============================================================================

export type GuidanceLevel = "high" | "medium" | "adaptive" | "switchable" | "low";
export type NavModel =
  | "linear-wizard" | "decision-canvas" | "spatial-tree" | "chat-plus-canvas"
  | "job-board" | "zoom-filmstrip" | "density-toggle" | "document-desk" | "legacy-tabs";

export interface WorkflowExperience {
  /** Stable identifier (never a DB id; safe to expose in URLs). */
  id: string;
  /** Sectional workflow code shown in the UI (W01…W09). */
  code: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  bestFor: string;
  guidance: GuidanceLevel;
  navModel: NavModel;
  /** Prototype concept module id under ./prototypes/concepts/<key>.js, or null for the legacy app. */
  prototypeKey: string | null;
  demoAvailable: boolean;
  isDefault: boolean;
  enabled: boolean;
  accent: string;           // CSS var for the selector card accent (semantic, paired with label)
}

export const EXPERIENCES: WorkflowExperience[] = [
  {
    id: "guided-journey", code: "W02", name: "Guided Course Journey",
    shortDescription: "One decision at a time, with a memory of what's settled.",
    longDescription:
      "A linear set of milestones (Define, Plan, Build, Review, Refine, Preview, Export). Shows only the decisions relevant to the current phase and keeps a running record of prior choices. The recommended default.",
    bestFor: "First-time or occasional course builders",
    guidance: "high", navModel: "linear-wizard", prototypeKey: "guided",
    demoAvailable: true, isDefault: true, enabled: true,
    accent: "--rc-green",
  },
  {
    id: "original", code: "W01", name: "Original RocketCourse",
    shortDescription: "The familiar tabbed workflow, preserved.",
    longDescription:
      "The current RocketCourse editor, kept available unchanged as a selectable experience so existing users lose nothing.",
    bestFor: "Returning users who know the current app",
    guidance: "medium", navModel: "legacy-tabs", prototypeKey: null,
    demoAvailable: false, isDefault: false, enabled: true,
    accent: "--rc-ink",
  },
  {
    id: "blueprint-studio", code: "W03", name: "Blueprint-First Studio",
    shortDescription: "Approve the architecture before any prose is written.",
    longDescription:
      "Outcomes, module sequence, assessment strategy, workload and policies are approved first; content generation follows an approved structure.",
    bestFor: "Instructional designers; pedagogy-first instructors",
    guidance: "medium", navModel: "decision-canvas", prototypeKey: "blueprint",
    demoAvailable: true, isDefault: false, enabled: false,
    accent: "--rc-blue",
  },
  {
    id: "course-map", code: "W04", name: "Course Map Workspace",
    shortDescription: "A course→module→item tree with a contextual inspector.",
    longDescription:
      "One persistent spatial map is the primary navigation; the centre shows the selected object and a contextual inspector shows only the controls relevant to it.",
    bestFor: "Visual thinkers; anyone reorganizing a course",
    guidance: "low", navModel: "spatial-tree", prototypeKey: "map",
    demoAvailable: true, isDefault: false, enabled: false,
    accent: "--rc-lilac",
  },
  {
    id: "course-partner", code: "W05", name: "Conversational Course Partner",
    shortDescription: "A guide that proposes scoped, approved changes beside the course.",
    longDescription:
      "The live course and student preview stay primary; a bounded conversation proposes checkpointed changes with explicit scope and Accept / Modify / Reject / Undo.",
    bestFor: "Instructors who want help without a form",
    guidance: "adaptive", navModel: "chat-plus-canvas", prototypeKey: "partner",
    demoAvailable: true, isDefault: false, enabled: false,
    accent: "--rc-lilac",
  },
  {
    id: "task-command-center", code: "W06", name: "Task-Based Command Center",
    shortDescription: "A prioritized board answering “what needs my attention?”",
    longDescription:
      "Work is organized around meaningful jobs (strengthen assessments, improve accessibility, balance workload) with computed status and a single recommended next action.",
    bestFor: "Returning builders with a half-finished course",
    guidance: "medium", navModel: "job-board", prototypeKey: "tasks",
    demoAvailable: true, isDefault: false, enabled: false,
    accent: "--rc-orange",
  },
  {
    id: "visual-storyboard", code: "W07", name: "Visual Storyboard",
    shortDescription: "A zoomable filmstrip of the student journey; height shows workload.",
    longDescription:
      "The course is a sequence of student experiences you zoom through (course → module → learning sequence → item). Scene height encodes workload so pacing problems are visible.",
    bestFor: "Designers thinking about the week-to-week arc",
    guidance: "low", navModel: "zoom-filmstrip", prototypeKey: "storyboard",
    demoAvailable: true, isDefault: false, enabled: false,
    accent: "--rc-yellow",
  },
  {
    id: "guided-expert", code: "W08", name: "Guided & Expert Modes",
    shortDescription: "One information architecture; a toggle changes density, not destination.",
    longDescription:
      "Guided mode emphasizes explanation and sequencing; Expert mode emphasizes density, shortcuts and direct access. Switching modes preserves exact context.",
    bestFor: "Teams spanning novices and instructional designers",
    guidance: "switchable", navModel: "density-toggle", prototypeKey: "modes",
    demoAvailable: true, isDefault: false, enabled: false,
    accent: "--rc-blue",
  },
  {
    id: "wildcard", code: "W09", name: "Wildcard · Reading-Room Desk",
    shortDescription: "The syllabus as a manuscript; readiness as margin notes.",
    longDescription:
      "A calm, content-first departure from dashboard idiom for humanities instructors: the course document is the spine, tools live in a desk drawer, and readiness is self-erasing marginalia.",
    bestFor: "Humanities instructors put off by ‘AI dashboards’",
    guidance: "low", navModel: "document-desk", prototypeKey: "wildcard",
    demoAvailable: true, isDefault: false, enabled: false,
    accent: "--rc-raspberry",
  },
];

export const DEFAULT_EXPERIENCE_ID = "guided-journey";

export function getExperience(id: string): WorkflowExperience | undefined {
  return EXPERIENCES.find(e => e.id === id);
}

/** Preference hierarchy: explicit course-specific → user preferred → default. */
export function resolveExperienceId(courseSpecific?: string | null, userPreferred?: string | null): string {
  if (courseSpecific && getExperience(courseSpecific)?.enabled) return courseSpecific;
  if (userPreferred && getExperience(userPreferred)?.enabled) return userPreferred;
  return DEFAULT_EXPERIENCE_ID;
}

/** Ordered by workflow code (W01…W09) for display. */
export function experiencesByCode(): WorkflowExperience[] {
  return [...EXPERIENCES].sort((a, b) => a.code.localeCompare(b.code));
}
