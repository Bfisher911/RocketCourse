// ============================================================================
// Sample course — identity + lazy materialization
// ----------------------------------------------------------------------------
// `courseGenerator.ts` builds the demo course by CALLING generateCourseProject
// at module-evaluation time. Importing `sampleProject` anywhere therefore does
// two expensive things on every page load, including the marketing landing page
// where no course is ever rendered:
//
//   1. runs a full course generation (~73 ms measured warm, worse cold) and
//      allocates a ~2 MB object, before React paints; and
//   2. pins the entire generation engine — every content builder, template and
//      theme module it reaches — into the initial JS payload.
//
// This module breaks that. Callers that only need the demo course's IDENTITY
// (comparisons like `course.id === SAMPLE_PROJECT_ID`) import a plain constant
// and pull in nothing. Callers that need the course itself await
// getSampleProject(), which code-splits the generator and memoises the result,
// so entering the demo twice generates once.
// ============================================================================

import type { CourseProject, ExportMode } from "../types";
import { defaultSettings } from "../data/defaultSettings";
import { themes } from "../data/themes";

/**
 * The demo course's stable id. Derived by slugifying its title, so it is fixed
 * — `sampleCourse.identity.test.ts` asserts this constant still equals the
 * generated `sampleProject.id`, which is what makes it safe to compare against
 * without materializing the course.
 */
export const SAMPLE_PROJECT_ID = "course_ai-and-modern-society";

/** The demo course's export mode (literal in the generator's seed). */
export const SAMPLE_PROJECT_EXPORT_MODE: ExportMode = "full";

/** The seed the demo course is generated from. Kept here so materializing it
 * needs nothing from `courseGenerator` except the generator function itself. */
export const SAMPLE_PROJECT_PROMPT =
  "Build me a 12-week undergraduate course on AI and Modern Society. It is a three-credit course with weekly modules, discussions, short quizzes, a final project, and a clean modern theme.";

let cached: CourseProject | null = null;
let inFlight: Promise<CourseProject> | null = null;

/**
 * Materialize the demo course, code-splitting the generator and memoising the
 * result. Concurrent callers share one generation.
 */
export async function getSampleProject(): Promise<CourseProject> {
  if (cached) return cached;
  inFlight ??= import("./courseGenerator").then(({ sampleProject }) => {
    cached = sampleProject;
    inFlight = null;
    return sampleProject;
  });
  return inFlight;
}

/** True once the demo course has been generated (no work triggered). */
export const sampleProjectLoaded = (): boolean => cached !== null;

/**
 * A valid, empty CourseProject used purely as the initial value of App's
 * `course` state. It is never rendered: the editor is unreachable at boot
 * (`pathToScreen` cannot return "editor"), so a real course is always set —
 * by opening a project, finishing generation, or entering the demo — before
 * anything reads it. Existing only to keep `course` non-nullable and avoid
 * threading null-checks through ~100 call sites.
 */
export const PLACEHOLDER_COURSE: CourseProject = {
  id: "course_placeholder",
  title: "",
  description: "",
  prompt: "",
  settings: defaultSettings,
  theme: themes[0],
  status: "draft",
  updatedAt: "1970-01-01T00:00:00.000Z",
  outcomes: [],
  announcements: [],
  modules: [],
  pages: [],
  assignments: [],
  discussions: [],
  quizzes: [],
  rubrics: [],
  resources: [],
  schedule: [],
  reviewChecklist: [],
  assignmentGroups: [],
  fileAssets: [],
  navigation: [],
  contactHours: {
    instructionalTime: 0,
    readingMediaTime: 0,
    assignmentTime: 0,
    discussionTime: 0,
    quizStudyTime: 0,
    finalProjectTime: 0,
    totalHours: 0,
    justification: ""
  },
  exportHistory: [],
  exportMode: SAMPLE_PROJECT_EXPORT_MODE,
  metadata: {
    createdAt: "1970-01-01T00:00:00.000Z",
    updatedAt: "1970-01-01T00:00:00.000Z",
    exportVersion: 0,
    source: "generated"
  }
};
