// ============================================================================
// Canvas Common Cartridge link tokens
// ----------------------------------------------------------------------------
// Plain relative links like "syllabus.html" are internally consistent inside the
// .imscc zip, but they DO NOT resolve once Canvas imports the course: wiki pages
// become /courses/:id/pages/:slug and assignments become /courses/:id/assignments/:id,
// never the ".html" files. Canvas only rewrites links that use its substitution
// tokens, which it replaces with live course URLs on import.
//
// Canvas resolves a token's id against the imported object's *migration id*, which
// for our package is the manifest <resource identifier="…"> — i.e. the object's own
// `id`. That is the exact same mechanism that powers <identifierref> (which the
// export validator already proves resolves), so keying links on `id` is guaranteed
// to line up with the imported objects.
//
// Tokens (verbatim from instructure/canvas-lms lib/cc/cc_helper.rb):
//   WIKI_TOKEN          $WIKI_REFERENCE$            wiki pages
//   OBJECT_TOKEN        $CANVAS_OBJECT_REFERENCE$   assignments / quizzes / discussions / module items
//   COURSE_TOKEN        $CANVAS_COURSE_REFERENCE$   course-level destinations (modules, syllabus)
//   FILE_TOKEN          $IMS-CC-FILEBASE$           files under web_resources/
// ============================================================================

import type { CourseProject } from "../types";

export const WIKI_TOKEN = "$WIKI_REFERENCE$";
export const OBJECT_TOKEN = "$CANVAS_OBJECT_REFERENCE$";
export const COURSE_TOKEN = "$CANVAS_COURSE_REFERENCE$";
export const FILE_TOKEN = "$IMS-CC-FILEBASE$";

export type CanvasObjectKind = "assignments" | "quizzes" | "discussion_topics" | "modules";

/** Link to a wiki page by its resource identifier (page.id). */
export const wikiPageRef = (pageId: string): string => `${WIKI_TOKEN}/pages/${pageId}`;

/** Link to a graded/learning object (assignment, quiz, discussion) by its resource identifier. */
export const objectRef = (kind: CanvasObjectKind, id: string): string => `${OBJECT_TOKEN}/${kind}/${id}`;
export const assignmentRef = (id: string): string => objectRef("assignments", id);
export const quizRef = (id: string): string => objectRef("quizzes", id);
export const discussionRef = (id: string): string => objectRef("discussion_topics", id);

/** Link to the course Modules index (the natural "see all modules" destination). */
export const modulesIndexRef = (): string => `${COURSE_TOKEN}/modules`;

/** Reference a file packaged under web_resources/ (pass the path WITHOUT the web_resources/ prefix). */
export const fileRef = (nameUnderWebResources: string): string => `${FILE_TOKEN}/${nameUnderWebResources.replace(/^\/+/, "")}`;

// Stable ids for the well-known pages the homepage and course navigation link to.
// Shared by the generator (which stamps them onto the created pages) and the homepage
// templates (which link to them) so the two can never drift out of sync.
export const WELL_KNOWN_PAGE_IDS = {
  homepage: "page_homepage",
  syllabus: "page_syllabus",
  successGuide: "page_course_success_guide",
  calendar: "page_course_calendar_workload_plan"
} as const;

const TOKEN_PREFIXES = [WIKI_TOKEN, OBJECT_TOKEN, COURSE_TOKEN, FILE_TOKEN];

/** True when href is a Canvas substitution token (so validators should resolve it as a token, not a file path). */
export const isCanvasRef = (href: string): boolean => TOKEN_PREFIXES.some((token) => href.startsWith(token));

export interface ParsedCanvasRef {
  token: string;
  /** "pages" | "assignments" | "quizzes" | "discussion_topics" | "modules" | "file" | "course" */
  kind: string;
  /** The migration id / file name, when the token carries one. */
  id?: string;
}

/** Parse a Canvas token href into { token, kind, id }, ignoring any #fragment or ?query. */
export const parseCanvasRef = (href: string): ParsedCanvasRef | null => {
  const clean = href.split("#")[0].split("?")[0];
  if (clean.startsWith(`${WIKI_TOKEN}/pages/`)) return { token: WIKI_TOKEN, kind: "pages", id: clean.slice(`${WIKI_TOKEN}/pages/`.length) || undefined };
  if (clean.startsWith(`${OBJECT_TOKEN}/`)) {
    const [kind, id] = clean.slice(OBJECT_TOKEN.length + 1).split("/");
    return { token: OBJECT_TOKEN, kind: kind || "", id: id || undefined };
  }
  if (clean.startsWith(`${FILE_TOKEN}/`)) return { token: FILE_TOKEN, kind: "file", id: clean.slice(FILE_TOKEN.length + 1) || undefined };
  if (clean.startsWith(`${COURSE_TOKEN}`)) {
    const [kind, id] = clean.slice(COURSE_TOKEN.length + 1).split("/");
    return { token: COURSE_TOKEN, kind: kind || "course", id: id || undefined };
  }
  return null;
};

/**
 * Every Canvas token link that resolves against this course's objects. Validators add
 * this set to their existing page/file target sets so token links count as resolvable.
 */
export const canvasRefTargets = (course: CourseProject): Set<string> => {
  const targets = new Set<string>();
  course.pages.forEach((page) => targets.add(wikiPageRef(page.id)));
  course.assignments.forEach((assignment) => targets.add(assignmentRef(assignment.id)));
  course.quizzes.forEach((quiz) => targets.add(quizRef(quiz.id)));
  course.discussions.forEach((discussion) => targets.add(discussionRef(discussion.id)));
  course.fileAssets.forEach((asset) => {
    targets.add(fileRef(asset.path.replace(/^web_resources\//, "")));
    if (asset.fileName) targets.add(fileRef(asset.fileName));
  });
  targets.add(modulesIndexRef());
  return targets;
};

/**
 * Resolve a single Canvas token href against the course. Returns true when the token's
 * target object/page/file actually exists in the course (so a broken token link can be
 * flagged just like a broken relative link).
 */
export const canvasRefResolves = (href: string, course: CourseProject): boolean => {
  const ref = parseCanvasRef(href);
  if (!ref) return false;
  switch (ref.kind) {
    case "pages":
      return course.pages.some((page) => page.id === ref.id);
    case "assignments":
      return course.assignments.some((assignment) => assignment.id === ref.id);
    case "quizzes":
      return course.quizzes.some((quiz) => quiz.id === ref.id);
    case "discussion_topics":
      return course.discussions.some((discussion) => discussion.id === ref.id);
    case "file":
      return course.fileAssets.some(
        (asset) => asset.path.replace(/^web_resources\//, "") === ref.id || asset.fileName === ref.id
      );
    case "modules":
    case "course":
      return true; // course-level destinations always exist in an imported course
    default:
      return false;
  }
};
