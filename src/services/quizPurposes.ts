// Pedagogical quiz purposes offered in the intake. The chosen purpose shapes each generated quiz's
// title and its `purpose` text — which surfaces in the editor, the quiz PDF, and exports as the
// Canvas/QTI quiz <description>. The default ("knowledge-check") reproduces the original generator
// output exactly. Self-contained data (no I/O), shared by the generator, intake UI, and tests.
import type { QuizPurposeKey } from "../types";

export interface QuizPurpose {
  key: QuizPurposeKey;
  label: string;
  /** Short noun used in the quiz title and module item (e.g. "Knowledge Check"). */
  titleWord: string;
  description: string;
  /** Builds the quiz's purpose/description sentence for a module topic. */
  framing: (topic: string) => string;
}

export const QUIZ_PURPOSES: Record<QuizPurposeKey, QuizPurpose> = {
  "knowledge-check": {
    key: "knowledge-check",
    label: "Knowledge check",
    titleWord: "Knowledge Check",
    description: "A standard check of understanding of the module's concepts.",
    framing: (topic) => `Check understanding of ${topic}.`
  },
  "pre-assessment": {
    key: "pre-assessment",
    label: "Pre-assessment",
    titleWord: "Pre-Assessment",
    description: "Gauge prior knowledge before the module begins.",
    framing: (topic) => `Pre-assessment: gauge what you already know about ${topic} before working through the module.`
  },
  application: {
    key: "application",
    label: "Application",
    titleWord: "Application Quiz",
    description: "Apply concepts to answer realistic, problem-solving questions.",
    framing: (topic) => `Apply ${topic} concepts to answer applied, problem-solving questions.`
  },
  scenario: {
    key: "scenario",
    label: "Scenario-based",
    titleWord: "Scenario Quiz",
    description: "Answer questions grounded in a realistic case or scenario.",
    framing: (topic) => `Work through a realistic ${topic} scenario and answer questions about how to analyze and act on it.`
  },
  socratic: {
    key: "socratic",
    label: "Socratic",
    titleWord: "Socratic Quiz",
    description: "A guided sequence of questions that builds reasoning step by step.",
    framing: (topic) => `A guided sequence of questions that leads you to reason step by step through ${topic}.`
  },
  review: {
    key: "review",
    label: "Review & reinforce",
    titleWord: "Review Quiz",
    description: "Review and reinforce key concepts at the end of the module.",
    framing: (topic) => `Review and reinforce the key ${topic} concepts from this module.`
  }
};

export const QUIZ_PURPOSE_KEYS = Object.keys(QUIZ_PURPOSES) as QuizPurposeKey[];

export const DEFAULT_QUIZ_PURPOSE: QuizPurposeKey = "knowledge-check";

export const getQuizPurpose = (key?: string): QuizPurpose =>
  QUIZ_PURPOSES[key as QuizPurposeKey] ?? QUIZ_PURPOSES["knowledge-check"];
