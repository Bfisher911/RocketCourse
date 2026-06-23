// Instructional-design models offered in the intake: a course-level structure framework (how the
// whole course is sequenced/framed) and a per-module pattern (how each module's learning path is
// structured). These shape generated framing — the module-overview design-approach line and the
// learning-path steps — without changing the Canvas item graph, so readiness/export stay valid.
// Self-contained data (no I/O), shared by the generator, intake UI, and tests.
import type { ModulePatternKey, StructureFrameworkKey } from "../types";

export interface StructureFramework {
  key: StructureFrameworkKey;
  label: string;
  description: string;
  /** One-sentence statement of the course's design approach, surfaced in each module overview. */
  approach: string;
}

export interface ModulePattern {
  key: ModulePatternKey;
  label: string;
  description: string;
  /** Ordered learning-path steps shown on each module overview. */
  steps: string[];
}

export const STRUCTURE_FRAMEWORKS: Record<StructureFrameworkKey, StructureFramework> = {
  linear: {
    key: "linear",
    label: "Subject-centred (linear)",
    description: "Logical, cumulative progression — each module builds on the last.",
    approach: "This course is organized as a logical, cumulative progression: each module builds directly on the one before it."
  },
  backward: {
    key: "backward",
    label: "Backward design (UbD)",
    description: "Start from outcomes and the evidence that demonstrates them, then design backward.",
    approach: "This course is built with backward design: every module works toward the evidence you'll produce for the course outcomes."
  },
  spiral: {
    key: "spiral",
    label: "Spiral",
    description: "Revisit core ideas at increasing depth across the course.",
    approach: "This course uses a spiral structure: core ideas return in later modules at greater depth and complexity."
  },
  thematic: {
    key: "thematic",
    label: "Thematic",
    description: "Organize modules around recurring themes and big questions.",
    approach: "This course is organized thematically: each module connects back to the course's recurring themes and big questions."
  },
  competency: {
    key: "competency",
    label: "Competency-based",
    description: "Each module is designed around specific, assessable competencies.",
    approach: "This course is competency-based: each module is designed around specific, assessable skills you'll demonstrate."
  }
};

export const MODULE_PATTERNS: Record<ModulePatternKey, ModulePattern> = {
  // The default mirrors the generator's original learning-path checklist exactly, so default courses
  // are unchanged.
  standard: {
    key: "standard",
    label: "Standard learning path",
    description: "Overview → resources → lecture → practice → graded work → recap.",
    steps: [
      "Read the resource page and note which sources require instructor replacement.",
      "Work through the mini-lecture and examples.",
      "Complete the practice activity before graded work.",
      "Use discussion, quiz, or assignment feedback to prepare for the module recap."
    ]
  },
  addie: {
    key: "addie",
    label: "ADDIE",
    description: "Analyze, Design, Develop, Implement, Evaluate.",
    steps: [
      "Analyze what you already know and what this module asks of you.",
      "Design your approach using the overview and resources.",
      "Develop understanding through the lecture and worked examples.",
      "Implement it in the practice activity and graded work.",
      "Evaluate your work against the outcomes in the recap."
    ]
  },
  gagne: {
    key: "gagne",
    label: "Gagné's Nine Events",
    description: "Gain attention, recall prior learning, present content, guide, practice, assess, retain.",
    steps: [
      "Connect to prior knowledge and this module's goals.",
      "Take in new content from the readings and lecture.",
      "Study the guided worked example.",
      "Practice with feedback in the activity.",
      "Demonstrate mastery in graded work, then review retention in the recap."
    ]
  },
  inquiry: {
    key: "inquiry",
    label: "Inquiry-based",
    description: "Question, investigate, make sense, share, reflect.",
    steps: [
      "Start from the module's driving question.",
      "Investigate using the readings and resources.",
      "Make sense of the evidence in the lecture and examples.",
      "Test your thinking in the practice activity.",
      "Share, defend, and reflect through graded work and the recap."
    ]
  },
  conceptual: {
    key: "conceptual",
    label: "Conceptual framework",
    description: "Anchor, build, connect, apply, and integrate a core concept.",
    steps: [
      "Anchor on the module's core concept.",
      "Build the concept with the readings and lecture.",
      "Connect it to examples and related ideas.",
      "Apply it in the practice activity and graded work.",
      "Integrate it into the bigger picture in the recap."
    ]
  }
};

export const STRUCTURE_FRAMEWORK_KEYS = Object.keys(STRUCTURE_FRAMEWORKS) as StructureFrameworkKey[];
export const MODULE_PATTERN_KEYS = Object.keys(MODULE_PATTERNS) as ModulePatternKey[];

export const getStructureFramework = (key?: string): StructureFramework =>
  STRUCTURE_FRAMEWORKS[key as StructureFrameworkKey] ?? STRUCTURE_FRAMEWORKS.linear;

export const getModulePattern = (key?: string): ModulePattern =>
  MODULE_PATTERNS[key as ModulePatternKey] ?? MODULE_PATTERNS.standard;
