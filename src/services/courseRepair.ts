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
//   - assignment with an empty description               → insert a usable review scaffold
//   - alignedOutcomeIds referencing deleted outcomes     → strip them
//   - assignment-group weights not totaling 100          → rebalance
// It does NOT fabricate content it cannot know (a quiz with zero questions is reported, not invented).

import type { CourseProject, ModuleItem } from "../types";
import { nowIso, slugify } from "../utils/text";
import { rebalanceWeights } from "./gradebookSummary";
import { demoteExtraH1s, stripUnresolvableHrefs } from "./htmlSafety";
import { normalizeTrueFalseAnswer, reconcileChoiceAnswer } from "./quizBuilder";

export interface RepairResult {
  course: CourseProject;
  repairs: string[];
}

const REF_ITEM_TYPES = new Set(["page", "assignment", "discussion", "quiz"]);

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

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
        // The export validator requires strictly positive points, so 0 must be repaired too.
        if (!Number.isFinite(Number(next.points)) || Number(next.points) <= 0) {
          next = { ...next, points: 1 };
          changed = true;
          questionFixes += 1;
        }
        if (next.type === "multiple_choice" && (!next.choices || next.choices.filter(Boolean).length < 2)) {
          next = { ...next, type: "short_answer", choices: undefined };
          changed = true;
          questionFixes += 1;
        } else if (next.type === "multiple_choice" && next.choices) {
          // Canvas blocks a multiple-choice key that isn't one of the choices. Reconcile it to the
          // choice it points at (letter/index/text); if nothing matches, downgrade to short answer so
          // the package stays import-ready instead of shipping a broken auto-graded question.
          const matched = reconcileChoiceAnswer(next.correctAnswer, next.choices.filter(Boolean));
          if (matched && matched !== next.correctAnswer) {
            next = { ...next, correctAnswer: matched };
            changed = true;
            questionFixes += 1;
          } else if (!matched) {
            next = { ...next, type: "short_answer", choices: undefined };
            changed = true;
            questionFixes += 1;
          }
        }
        if (next.type === "true_false") {
          const tf = normalizeTrueFalseAnswer(next.correctAnswer);
          if (tf && tf !== next.correctAnswer) {
            next = { ...next, correctAnswer: tf };
            changed = true;
            questionFixes += 1;
          } else if (!tf) {
            next = { ...next, type: "short_answer" };
            changed = true;
            questionFixes += 1;
          }
        }
        return next;
      });
      // A zero/invalid quiz total is a blocking export error even when every question is
      // individually valid; rebuild it from the questions. Intentional non-matching totals
      // (a valid positive number) are left alone — the validator only warns on those.
      const questionTotal = questions.reduce((sum, question) => sum + Number(question.points || 0), 0);
      if (questions.length > 0 && questionTotal > 0 && (!Number.isFinite(q.points) || q.points <= 0)) {
        questionFixes += 1;
        return { ...q, questions, points: questionTotal };
      }
      return changed ? { ...q, questions } : q;
    })
  };
  if (questionFixes) repairs.push(`Repaired ${questionFixes} quiz question(s) with invalid points or missing choices.`);

  // 7b. Pages with more than one <h1> (common in AI-written or pasted bodies) fail the
  // page-quality export gate; demote the extras to <h2> instead of blocking the download.
  let headingFixes = 0;
  course = {
    ...course,
    pages: course.pages.map((p) => {
      const demoted = demoteExtraH1s(p.bodyHtml);
      if (demoted === p.bodyHtml) return p;
      headingFixes += 1;
      return { ...p, bodyHtml: demoted };
    })
  };
  if (headingFixes) repairs.push(`Demoted extra <h1> headings to <h2> on ${headingFixes} page(s).`);

  // 7c. Links Canvas cannot resolve after import (hallucinated relative paths like
  // "modules/module_start", unfilled "{{...}}" tokens) become 404s in the imported course.
  // Drop just the dead href — the anchor text stays — across every exported HTML body.
  let linkScrubs = 0;
  const scrubHtml = (html: string): string => {
    const scrubbed = stripUnresolvableHrefs(html);
    if (scrubbed !== html) linkScrubs += 1;
    return scrubbed;
  };
  course = {
    ...course,
    pages: course.pages.map((p) => {
      const bodyHtml = scrubHtml(p.bodyHtml);
      return bodyHtml === p.bodyHtml ? p : { ...p, bodyHtml };
    }),
    assignments: course.assignments.map((a) => {
      const descriptionHtml = scrubHtml(a.descriptionHtml);
      return descriptionHtml === a.descriptionHtml ? a : { ...a, descriptionHtml };
    }),
    discussions: course.discussions.map((d) => {
      const promptHtml = scrubHtml(d.promptHtml);
      return promptHtml === d.promptHtml ? d : { ...d, promptHtml };
    }),
    announcements: course.announcements
      ? course.announcements.map((an) => {
          const bodyHtml = scrubHtml(an.bodyHtml);
          return bodyHtml === an.bodyHtml ? an : { ...an, bodyHtml };
        })
      : course.announcements
  };
  if (linkScrubs) repairs.push(`Removed unresolvable links (kept their text) in ${linkScrubs} content block(s).`);

  // 8. Assignments with an empty description → a subject-specific, immediately usable scaffold.
  // Avoid “coming soon” or fake-complete copy leaking into the student package. The scaffold is
  // intentionally modest: it restores a safe task/submission/success structure without inventing
  // institution policy, due dates, sources, or grading claims.
  let descFixes = 0;
  const courseTitle = escapeHtml(course.title || "this course");
  course = {
    ...course,
    assignments: course.assignments.map((a) => {
      if (a.descriptionHtml && a.descriptionHtml.replace(/<[^>]*>/g, "").trim()) return a;
      descFixes += 1;
      const assignmentTitle = escapeHtml(a.title || "this assignment");
      return {
        ...a,
        descriptionHtml: `<h2>Assignment overview</h2>
<p>Complete <strong>${assignmentTitle}</strong> to demonstrate your developing understanding of ${courseTitle}.</p>
<h2>Your task</h2>
<ol>
  <li>Review the related module materials and learning objectives.</li>
  <li>Create a clear response that uses relevant course concepts and evidence.</li>
  <li>Check your work against the attached rubric or grading criteria, then submit it in the requested format.</li>
</ol>
<h2>Before you submit</h2>
<ul>
  <li>Confirm that you addressed every part of the task.</li>
  <li>Explain how your evidence supports your decisions or conclusions.</li>
  <li>Use an accessible file format and descriptive link text when links are included.</li>
</ul>`
      };
    })
  };
  if (descFixes) repairs.push(`Restored a review-ready description scaffold for ${descFixes} empty assignment(s).`);

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
