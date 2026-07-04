// Infers course settings from the user's plain-language course description so the
// one-question intake can pre-fill later steps. Deliberately conservative: only
// fields with a clear signal are returned, and the caller applies them only over
// untouched defaults — never over a value the user already changed.

import type { CourseLengthPreset, CourseSettings } from "../types";

export type InferredSettings = Partial<
  Pick<CourseSettings, "lengthWeeks" | "courseLengthPreset" | "moduleCount" | "level" | "modality">
>;

export interface PromptInference {
  updates: InferredSettings;
  /** Human-readable summary chips, e.g. ["8 weeks", "Undergraduate", "Online asynchronous"]. */
  notes: string[];
}

const WEEK_PRESETS: Partial<Record<number, CourseLengthPreset>> = {
  4: "4-weeks",
  6: "6-weeks",
  8: "8-weeks",
  12: "12-weeks",
  15: "15-weeks",
  16: "16-weeks"
};

export const inferSettingsFromPrompt = (prompt: string): PromptInference => {
  const text = prompt.toLowerCase();
  const updates: InferredSettings = {};
  const notes: string[] = [];

  const weeksMatch = text.match(/(\d{1,2})\s*-?\s*week/);
  if (weeksMatch) {
    const weeks = Math.min(18, Math.max(3, Number(weeksMatch[1])));
    updates.lengthWeeks = weeks;
    updates.moduleCount = weeks;
    updates.courseLengthPreset = WEEK_PRESETS[weeks] ?? "custom";
    notes.push(`${weeks} weeks`);
  } else if (/\bmaymester\b/.test(text)) {
    updates.courseLengthPreset = "maymester";
    updates.lengthWeeks = 3;
    updates.moduleCount = 3;
    notes.push("Maymester");
  } else if (/\bsemester\b/.test(text)) {
    updates.courseLengthPreset = "16-weeks";
    updates.lengthWeeks = 16;
    updates.moduleCount = 16;
    notes.push("Semester (16 weeks)");
  }

  if (/\bgrad(uate)?\b|master'?s|doctoral|\bphd\b/.test(text)) {
    updates.level = "Graduate";
    notes.push("Graduate");
  } else if (/undergrad|freshman|first-year|non-major|sophomore|\bgen[- ]ed\b/.test(text)) {
    updates.level = "Undergraduate";
    notes.push("Undergraduate");
  } else if (/high school|secondary school/.test(text)) {
    updates.level = "High school";
    notes.push("High school");
  } else if (/professional development|workplace training|corporate training|new supervisors?/.test(text)) {
    updates.level = "Professional";
    notes.push("Professional");
  } else if (/continuing education/.test(text)) {
    updates.level = "Continuing education";
    notes.push("Continuing education");
  }

  if (/\baccelerated\b/.test(text)) {
    updates.modality = "Accelerated";
    notes.push("Accelerated");
  } else if (/hybrid|blended/.test(text)) {
    updates.modality = "Hybrid";
    notes.push("Hybrid");
  } else if (/asynchronous|self-paced/.test(text)) {
    updates.modality = "Online asynchronous";
    notes.push("Online asynchronous");
  } else if (/\bsynchronous\b/.test(text)) {
    updates.modality = "Online synchronous";
    notes.push("Online synchronous");
  } else if (/face-to-face|in-person|on-campus/.test(text)) {
    updates.modality = "Face-to-face";
    notes.push("Face-to-face");
  } else if (/\bonline\b/.test(text)) {
    updates.modality = "Online asynchronous";
    notes.push("Online");
  }

  return { updates, notes };
};
