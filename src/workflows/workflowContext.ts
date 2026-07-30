// Shared, experience-independent navigation context (Phase 4, foundation).
// This is the seam that lets switching experiences PRESERVE where the user is.
// It stores only *pointers* (which module/item/phase), never course content —
// course content lives in the shared course state (the prototypes' `session`
// today; a real CourseProject adapter in the next slice).

export interface WorkflowContext {
  experienceId: string;
  /** A shared 1–12 "task" pointer mapped across every experience (goToTask). */
  taskPointer: number;
  moduleId?: string;
  itemId?: string;
}

const LS_USER_PREF = "rc.workflow.userPreferred";
const LS_COURSE_PREF = (courseId: string) => `rc.workflow.course.${courseId}`;

// Preferences degrade to in-memory storage when browser storage is unavailable
// (blocked third-party contexts, some test environments) — same policy as
// adapterViewState: prefs then survive the session instead of silently no-oping.
const memoryPrefs = new Map<string, string>();
function readPref(key: string): string | null {
  try {
    const v = window.localStorage.getItem(key);
    if (typeof v === "string" || v === null) return v ?? memoryPrefs.get(key) ?? null;
  } catch { /* fall through to memory */ }
  return memoryPrefs.get(key) ?? null;
}
function writePref(key: string, value: string): void {
  memoryPrefs.set(key, value);
  try { window.localStorage.setItem(key, value); } catch { /* memory already has it */ }
}

export function loadUserPreferred(): string | null {
  return readPref(LS_USER_PREF);
}
export function saveUserPreferred(id: string): void {
  writePref(LS_USER_PREF, id);
}
export function loadCoursePreferred(courseId: string): string | null {
  return readPref(LS_COURSE_PREF(courseId));
}
export function saveCoursePreferred(courseId: string, id: string): void {
  writePref(LS_COURSE_PREF(courseId), id);
}

/** In-memory shared context for the current session. */
export function createContext(experienceId: string): WorkflowContext {
  return { experienceId, taskPointer: 1 };
}
