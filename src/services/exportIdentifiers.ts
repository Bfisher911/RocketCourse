// Canvas migration-identifier namespacing.
//
// Canvas de-duplicates imported content by migration id (the manifest/resource identifiers and
// every identifierref). The generator's ids ("assignment_6", "rubric-assignment_6", "module_3")
// are IDENTICAL across every RocketCourse-generated course, so importing two different courses —
// or re-importing after a regeneration — into the same Canvas course makes Canvas treat unrelated
// objects as the same one: content overwrites, dropped rubric associations, and Frankenstein
// courses that mix old and new material. Canvas's own exporter hashes every id globally unique.
//
// `namespaceCourseForExport` prefixes every object id with a short hash derived from the course id,
// applied uniformly to the whole serialized course so ids, reference fields (moduleId, refId,
// rubricId, alignedOutcomeIds, …), and Canvas link tokens embedded in HTML
// ($CANVAS_OBJECT_REFERENCE$/discussion_topics/<id>) all stay consistent. It is DETERMINISTIC:
// re-exporting the same course yields the same ids, so a re-import updates content in place.

import type { CourseProject } from "../types";

/** djb2 — tiny, deterministic, good-enough dispersion for a per-course prefix. */
const hashString = (value: string): string => {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
};

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Every id that becomes a Canvas migration identifier in the package. */
const collectObjectIds = (course: CourseProject): string[] => {
  const ids = new Set<string>();
  course.modules.forEach((module) => {
    ids.add(module.id);
    module.items.forEach((item) => ids.add(item.id));
  });
  course.pages.forEach((page) => ids.add(page.id));
  course.assignments.forEach((assignment) => ids.add(assignment.id));
  course.discussions.forEach((discussion) => ids.add(discussion.id));
  (course.announcements ?? []).forEach((announcement) => ids.add(announcement.id));
  course.quizzes.forEach((quiz) => {
    ids.add(quiz.id);
    quiz.questions.forEach((question) => ids.add(question.id));
  });
  course.rubrics.forEach((rubric) => ids.add(rubric.id));
  course.outcomes.forEach((outcome) => ids.add(outcome.id));
  course.assignmentGroups.forEach((group) => ids.add(group.id));
  return [...ids].filter(Boolean);
};

export const exportIdPrefix = (course: CourseProject): string => `cf${hashString(course.id)}_`;

/**
 * Return a copy of the course whose object ids (and every textual reference to them, including
 * Canvas link tokens inside HTML bodies) carry a per-course prefix. Idempotent: already-prefixed
 * ids are left alone.
 */
export const namespaceCourseForExport = (course: CourseProject): CourseProject => {
  const prefix = exportIdPrefix(course);
  const ids = collectObjectIds(course)
    // Idempotency: skip ids that already carry this course's prefix.
    .filter((id) => !id.startsWith(prefix))
    // Longest first so "module_12" is rewritten before "module_1" can be considered.
    .sort((a, b) => b.length - a.length);
  if (ids.length === 0) return course;

  let serialized = JSON.stringify(course);
  for (const id of ids) {
    // Lookarounds keep id-shaped substrings inside LONGER ids intact ("discussion_1" inside
    // "item_discussion_1" or "module_1" inside "cfx_module_12" never match).
    const pattern = new RegExp(`(?<![A-Za-z0-9_-])${escapeRegex(id)}(?![A-Za-z0-9_-])`, "g");
    serialized = serialized.replace(pattern, `${prefix}${id}`);
  }
  return JSON.parse(serialized) as CourseProject;
};
