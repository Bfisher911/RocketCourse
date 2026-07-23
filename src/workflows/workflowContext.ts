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

export function loadUserPreferred(): string | null {
  try { return localStorage.getItem(LS_USER_PREF); } catch { return null; }
}
export function saveUserPreferred(id: string): void {
  try { localStorage.setItem(LS_USER_PREF, id); } catch { /* no-op */ }
}
export function loadCoursePreferred(courseId: string): string | null {
  try { return localStorage.getItem(LS_COURSE_PREF(courseId)); } catch { return null; }
}
export function saveCoursePreferred(courseId: string, id: string): void {
  try { localStorage.setItem(LS_COURSE_PREF(courseId), id); } catch { /* no-op */ }
}

/** In-memory shared context for the current session. */
export function createContext(experienceId: string): WorkflowContext {
  return { experienceId, taskPointer: 1 };
}
