// Pedagogical frameworks for learning outcomes. RocketCourse generates outcomes against a chosen
// instructional-design framework (Bloom, SOLO, Dimensions of Knowledge, Kolb) rather than Bloom
// only. Each framework supplies ordered "levels": a stored label (kept in CourseOutcome.bloomLevel)
// and a measurable leading verb used when the deterministic generator writes the outcome sentence.
// Self-contained data (no I/O) so it can be unit-tested and shared by the generator, editor, and
// readiness/quality checks.
import type { OutcomeFrameworkKey } from "../types";

export interface FrameworkLevel {
  /** Stored on CourseOutcome.bloomLevel and shown in the outcome-level picker. */
  label: string;
  /** Measurable action verb that leads a generated outcome sentence for this level. */
  verb: string;
}

export interface OutcomeFramework {
  key: OutcomeFrameworkKey;
  /** Full name for the intake picker. */
  label: string;
  /** Short noun for UI/aria (e.g. "Bloom level"). */
  short: string;
  /** One-line description for the picker. */
  description: string;
  levels: FrameworkLevel[];
}

export const OUTCOME_FRAMEWORKS: Record<OutcomeFrameworkKey, OutcomeFramework> = {
  bloom: {
    key: "bloom",
    label: "Bloom's (Revised) Taxonomy",
    short: "Bloom level",
    description: "Cognitive levels from recall to creation (Remember → Create).",
    // Bloom's level labels double as the leading verb, preserving the original generator output.
    levels: [
      { label: "Remember", verb: "Remember" },
      { label: "Understand", verb: "Understand" },
      { label: "Apply", verb: "Apply" },
      { label: "Analyze", verb: "Analyze" },
      { label: "Evaluate", verb: "Evaluate" },
      { label: "Create", verb: "Create" }
    ]
  },
  solo: {
    key: "solo",
    label: "SOLO Taxonomy",
    short: "SOLO level",
    description: "Structure of Observed Learning Outcomes — increasing structural complexity.",
    levels: [
      { label: "Unistructural", verb: "Identify" },
      { label: "Multistructural", verb: "Describe" },
      { label: "Relational", verb: "Analyze" },
      { label: "Extended Abstract", verb: "Evaluate" }
    ]
  },
  knowledge: {
    key: "knowledge",
    label: "Dimensions of Knowledge",
    short: "Knowledge dimension",
    description: "Factual, conceptual, procedural, and metacognitive knowledge.",
    levels: [
      { label: "Factual", verb: "Identify" },
      { label: "Conceptual", verb: "Explain" },
      { label: "Procedural", verb: "Apply" },
      { label: "Metacognitive", verb: "Evaluate" }
    ]
  },
  kolb: {
    key: "kolb",
    label: "Kolb's Experiential Cycle",
    short: "Kolb stage",
    description: "Concrete experience, reflective observation, abstract conceptualization, active experimentation.",
    levels: [
      { label: "Concrete Experience", verb: "Engage" },
      { label: "Reflective Observation", verb: "Reflect" },
      { label: "Abstract Conceptualization", verb: "Conceptualize" },
      { label: "Active Experimentation", verb: "Experiment" }
    ]
  }
};

export const OUTCOME_FRAMEWORK_KEYS = Object.keys(OUTCOME_FRAMEWORKS) as OutcomeFrameworkKey[];

export const DEFAULT_OUTCOME_FRAMEWORK: OutcomeFrameworkKey = "bloom";

/** Resolve a framework by key, falling back to Bloom for unknown/legacy/undefined values. */
export const getOutcomeFramework = (key?: string): OutcomeFramework =>
  OUTCOME_FRAMEWORKS[key as OutcomeFrameworkKey] ?? OUTCOME_FRAMEWORKS[DEFAULT_OUTCOME_FRAMEWORK];

/** Every leading verb used by any framework (lowercased), so the measurable-verb checks can accept
 * outcomes written against any framework. Kept in sync with the regexes in readiness.ts and
 * overviewSummary.ts. */
export const FRAMEWORK_VERBS: string[] = Array.from(
  new Set(Object.values(OUTCOME_FRAMEWORKS).flatMap((framework) => framework.levels.map((level) => level.verb.toLowerCase())))
);
