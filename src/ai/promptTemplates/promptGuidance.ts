// Turns the authored prompt-quality material into actual system messages.
//
// Every prompt template carries a `qualityChecklist` and `failureModes`, and
// qualityStandard.ts carries the course-architecture standard — but none of it
// was ever sent to the model. buildChatMessages() and the two Netlify AI
// functions only forwarded systemInstructions + developerInstructions, so the
// quality bar the team wrote existed purely as documentation. This module is
// the single place that renders it into prompt text.
//
// Cost is deliberate: the per-stage checklist is a handful of lines and rides
// along on EVERY call, while the much larger course-architecture standard is
// blueprint-only (one call per course) rather than repeated per object.

import type { PromptTemplate } from "./types";
import {
  antiBeigeRules,
  fullCourseObjectTargets,
  fullyFledgedCourseStandard,
  structuredOutputValidationRules
} from "./qualityStandard";

const bullets = (lines: readonly string[]): string => lines.map((line) => `- ${line}`).join("\n");

/**
 * The stage's own quality bar and known failure modes, as one system message.
 * Returns null when a template defines neither, so no empty message is sent.
 */
export const qualityGuidanceMessage = (
  template: Pick<PromptTemplate, "qualityChecklist" | "failureModes">
): string | null => {
  const sections: string[] = [];
  if (template.qualityChecklist?.length) {
    sections.push(`Your output must satisfy every one of these:\n${bullets(template.qualityChecklist)}`);
  }
  if (template.failureModes?.length) {
    sections.push(`These are known failure modes. Do not produce them:\n${bullets(template.failureModes)}`);
  }
  return sections.length ? sections.join("\n\n") : null;
};

/**
 * The course-architecture standard: what a complete course contains, the object
 * targets, the structural rules the output is validated against, and the
 * anti-generic content rules. Blueprint stage only — it defines the contract
 * every downstream object is drafted against.
 */
export const courseStandardMessage = (): string =>
  [
    `A fully-fledged course contains all of the following:\n${bullets(fullyFledgedCourseStandard)}`,
    `Structural rules the blueprint is validated against:\n${bullets(structuredOutputValidationRules)}`,
    `Object targets:\n${bullets(
      Object.entries(fullCourseObjectTargets).map(([key, value]) => `${key}: ${value}`)
    )}`,
    `Never produce these:\n${bullets(antiBeigeRules.prevent)}`,
    `Always include these:\n${bullets(antiBeigeRules.require)}`
  ].join("\n\n");
