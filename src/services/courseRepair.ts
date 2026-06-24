// Course model repair — the safety net behind the product's core promise: a user can always export
// a clean .imscc package, even after a messy editing session. repairCourse() takes a (possibly
// corrupted) course and returns a structurally-valid one plus a human-readable list of what it
// fixed. It is PURE and IDEMPOTENT: running it twice yields the same course and an empty repair list
// the second time. The export path (buildImsccZip) and the "Make export-ready" transform both run it
// first, so a fixable structural problem can never block export.
//
// What it repairs (the export-breaking classes):
//   - module item points to a missing object            → drop the dangling item, renumber
//   - object.moduleId out of sync with its module item   → sync object (and quiz questions) to it
//   - graded object on a non-existent module             → reassign to the first content module
//   - missing assignment group / invalid group ref       → create a default group / reassign
//   - assignment or discussion rubricId points to nothing→ clear the dangling rubric link
//   - page missing slug                                  → derive a slug from the title
//   - quiz question missing points / multiple-choice with no choices → default points / downgrade
//   - assignment with an empty description               → insert a minimal placeholder body
//   - alignedOutcomeIds referencing deleted outcomes     → strip them
//   - assignment-group weights not totaling 100          → rebalance
// It does NOT fabricate content it cannot know (a quiz with zero questions is reported, not invented).

import type { CourseProject, ModuleItem } from "../types";
import { nowIso, slugify } from "../utils/text";
import { rebalanceWeights } from "./gradebookSummary";

export interface RepairResult {
  course: CourseProject;
  repairs: string[];
}

const REF_ITEM_TYPES = new Set(["page", "assignment", "discussion", "quiz"]);

/** Repair a course in-place-immutably. Safe to call before every readiness score and export. */
export const repairCourse = (input: CourseProject): RepairResult => {
  const repairs: string[] = [];
  let course = input;

  const moduleIds = new Set(course.modules.map((m) => m.id));
  const outcomeIds = new Set(course.outcomes.map((o) => o.id));
  const rubricIds = new Set(course.rubrics.map((r) => r.id));
  const pageIds = new Set(course.pages.map((p) => p.id));
  const assignmentIds = new Set(course.assignments.map((a) => a.id));
  const discussionIds = new Set(course.discussions.map((d) => d.id));
  const quizIds = new Set(course.quizzes.map((q) => q.id));
  const idsByType: Record<string, Set<string>> = {
    page: pageIds,
    assignment: assignmentIds,
    discussion: discussionIds,
    quiz: quizIds
  };
  const fallbackModuleId =
    course.modules.find((m) => m.kind === "content")?.id ?? course.modules[0]?.id ?? undefined;

  // 1. Drop dangling module items (refId no longer resolves) and renumber what remains.
  let droppedItems = 0;
  const modules = course.modules.map((module) => {
    const kept = module.items.filter((item) => {
      if (!REF_ITEM_TYPES.has(item.type)) return true; // subheader / syllabus carry no array ref
      const exists = idsByType[item.type]?.has(item.refId);
      if (!exists) droppedItems += 1;
      return exists;
    });
    if (kept.length === module.items.length) return module;
    const renumbered: ModuleItem[] = kept.map((item, index) => ({ ...item, order: index + 1 }));
    return { ...module, items: renumbered };
  });
  if (droppedItems) {
    repairs.push(`Removed ${droppedItems} module item(s) that pointed to deleted content.`);
    course = { ...course, modules };
  }

  // 2. Build object → owning module from the (now valid) module items, and sync each object's
  //    moduleId (and quiz question moduleId) to where it actually lives.
  const moduleByObjectId = new Map<string, string>();
  for (const module of course.modules) {
    for (const item of module.items) {
      if (REF_ITEM_TYPES.has(item.type)) moduleByObjectId.set(item.refId, module.id);
    }
  }

  const resolveModuleId = (current: string, objectId: string): string => {
    const owning = moduleByObjectId.get(objectId);
    if (owning) return owning;
    if (moduleIds.has(current)) return current;
    return fallbackModuleId ?? current;
  };

  let moduleSyncs = 0;
  const assignments = course.assignments.map((a) => {
    const moduleId = resolveModuleId(a.moduleId, a.id);
    if (moduleId === a.moduleId) return a;
    moduleSyncs += 1;
    return { ...a, moduleId };
  });
  const discussions = course.discussions.map((d) => {
    const moduleId = resolveModuleId(d.moduleId, d.id);
    if (moduleId === d.moduleId) return d;
    moduleSyncs += 1;
    return { ...d, moduleId };
  });
  const quizzes = course.quizzes.map((q) => {
    const moduleId = resolveModuleId(q.moduleId, q.id);
    const questionsNeedSync = q.questions.some((question) => question.moduleId !== moduleId);
    if (moduleId === q.moduleId && !questionsNeedSync) return q;
    if (moduleId !== q.moduleId) moduleSyncs += 1;
    return { ...q, moduleId, questions: q.questions.map((question) => ({ ...question, moduleId })) };
  });
  const pages = course.pages.map((p) => {
    if (p.moduleId === undefined) return p;
    const owning = moduleByObjectId.get(p.id);
    const moduleId = owning ?? (moduleIds.has(p.moduleId) ? p.moduleId : undefined);
    if (moduleId === p.moduleId) return p;
    moduleSyncs += 1;
    return { ...p, moduleId };
  });
  if (moduleSyncs) repairs.push(`Re-synced ${moduleSyncs} object(s) to the module they appear in.`);
  course = { ...course, assignments, discussions, quizzes, pages };

  // 3. Ensure a default assignment group exists when graded items reference none.
  const gradedCount = course.assignments.length + course.discussions.length + course.quizzes.length;
  let groups = course.assignmentGroups;
  if (gradedCount > 0 && groups.length === 0) {
    groups = [{ id: `group_${Date.now().toString(36)}`, name: "Assignments", weight: 100 }];
    repairs.push("Created a default assignment group for graded items.");
    course = { ...course, assignmentGroups: groups };
  }
  const groupIds = new Set(groups.map((g) => g.id));
  const defaultGroupId = groups[0]?.id;

  // 4. Reassign graded items pointing at a missing assignment group.
  let groupFixes = 0;
  const fixGroup = <T extends { assignmentGroupId: string }>(obj: T): T => {
    if (groupIds.has(obj.assignmentGroupId) || !defaultGroupId) return obj;
    groupFixes += 1;
    return { ...obj, assignmentGroupId: defaultGroupId };
  };
  course = {
    ...course,
    assignments: course.assignments.map(fixGroup),
    discussions: course.discussions.map(fixGroup),
    quizzes: course.quizzes.map(fixGroup)
  };
  if (groupFixes) repairs.push(`Reassigned ${groupFixes} graded item(s) to a valid assignment group.`);

  // 5. Clear dangling rubric links, strip outcome alignments to deleted outcomes.
  let rubricFixes = 0;
  let outcomeStrips = 0;
  const stripOutcomes = (ids: string[]): string[] => {
    const kept = ids.filter((id) => outcomeIds.has(id));
    if (kept.length !== ids.length) outcomeStrips += 1;
    return kept;
  };
  course = {
    ...course,
    assignments: course.assignments.map((a) => {
      let next = a;
      if (a.rubricId && !rubricIds.has(a.rubricId)) {
        rubricFixes += 1;
        next = { ...next, rubricId: undefined };
      }
      const aligned = stripOutcomes(next.alignedOutcomeIds);
      if (aligned !== next.alignedOutcomeIds) next = { ...next, alignedOutcomeIds: aligned };
      return next;
    }),
    discussions: course.discussions.map((d) => {
      let next = d;
      if (d.rubricId && !rubricIds.has(d.rubricId)) {
        rubricFixes += 1;
        next = { ...next, rubricId: undefined };
      }
      const aligned = stripOutcomes(next.alignedOutcomeIds);
      if (aligned !== next.alignedOutcomeIds) next = { ...next, alignedOutcomeIds: aligned };
      return next;
    }),
    quizzes: course.quizzes.map((q) => {
      const aligned = stripOutcomes(q.alignedOutcomeIds);
      const questions = q.questions.map((question) => {
        const qa = stripOutcomes(question.alignedOutcomeIds);
        return qa === question.alignedOutcomeIds ? question : { ...question, alignedOutcomeIds: qa };
      });
      if (aligned === q.alignedOutcomeIds && questions.every((qn, i) => qn === q.questions[i])) return q;
      return { ...q, alignedOutcomeIds: aligned, questions };
    }),
    rubrics: course.rubrics.map((r) => {
      const aligned = stripOutcomes(r.alignedOutcomeIds);
      let criteriaChanged = false;
      const criteria = r.criteria.map((cr) => {
        if (cr.outcomeId && !outcomeIds.has(cr.outcomeId)) {
          criteriaChanged = true;
          return { ...cr, outcomeId: undefined };
        }
        return cr;
      });
      if (criteriaChanged) outcomeStrips += 1;
      if (aligned === r.alignedOutcomeIds && !criteriaChanged) return r;
      return { ...r, alignedOutcomeIds: aligned, criteria };
    }),
    // Outcomes that align to a now-deleted module would dangle in the outcome map.
    outcomes: course.outcomes.map((o) => {
      const kept = o.alignedModuleIds.filter((id) => moduleIds.has(id));
      if (kept.length === o.alignedModuleIds.length) return o;
      outcomeStrips += 1;
      return { ...o, alignedModuleIds: kept };
    })
  };
  if (rubricFixes) repairs.push(`Cleared ${rubricFixes} broken rubric link(s).`);
  if (outcomeStrips) repairs.push(`Removed ${outcomeStrips} alignment(s) to deleted outcomes or modules.`);

  // 6. Pages without a slug → derive one from the title.
  let slugFixes = 0;
  course = {
    ...course,
    pages: course.pages.map((p) => {
      if (p.slug && p.slug.trim()) return p;
      slugFixes += 1;
      return { ...p, slug: slugify(p.title) || `page-${p.id}` };
    })
  };
  if (slugFixes) repairs.push(`Generated slugs for ${slugFixes} page(s) that were missing one.`);

  // 7. Quiz question integrity: valid points; multiple-choice with no choices → short answer.
  let questionFixes = 0;
  course = {
    ...course,
    quizzes: course.quizzes.map((q) => {
      let changed = false;
      const questions = q.questions.map((question) => {
        let next = question;
        if (!Number.isFinite(Number(next.points)) || Number(next.points) < 0) {
          next = { ...next, points: 1 };
          changed = true;
          questionFixes += 1;
        }
        if (next.type === "multiple_choice" && (!next.choices || next.choices.filter(Boolean).length < 2)) {
          next = { ...next, type: "short_answer", choices: undefined };
          changed = true;
          questionFixes += 1;
        }
        return next;
      });
      return changed ? { ...q, questions } : q;
    })
  };
  if (questionFixes) repairs.push(`Repaired ${questionFixes} quiz question(s) with invalid points or missing choices.`);

  // 8. Assignments with an empty description → minimal placeholder so export emits a real body.
  let descFixes = 0;
  course = {
    ...course,
    assignments: course.assignments.map((a) => {
      if (a.descriptionHtml && a.descriptionHtml.replace(/<[^>]*>/g, "").trim()) return a;
      descFixes += 1;
      return { ...a, descriptionHtml: `<p>Assignment details for "${a.title}" are coming soon.</p>` };
    })
  };
  if (descFixes) repairs.push(`Added a placeholder description to ${descFixes} empty assignment(s).`);

  // 9. Rebalance assignment-group weights to total 100 when they drift.
  if (course.assignmentGroups.length) {
    const total = Math.round(course.assignmentGroups.reduce((sum, g) => sum + Number(g.weight || 0), 0));
    if (total !== 100) {
      course = rebalanceWeights(course);
      repairs.push("Rebalanced assignment-group weights to total 100%.");
    }
  }

  if (repairs.length) course = { ...course, updatedAt: nowIso() };
  return { course, repairs };
};

/** Issues repair cannot fix automatically (need human content). Surfaced as warnings, not blockers to repair. */
export const unrepairableIssues = (course: CourseProject): string[] => {
  const issues: string[] = [];
  for (const quiz of course.quizzes) {
    if (quiz.questions.length === 0) issues.push(`Quiz "${quiz.title}" has no questions — add at least one before export.`);
  }
  return issues;
};
