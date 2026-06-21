import type { Assignment, CourseModule, CoursePage, CourseProject, CourseScheduleEntry, Discussion, ModuleItem, ModuleItemType, ObjectMetadata, Quiz } from "../types";
import { nowIso, slugify, stripHtml } from "../utils/text";

export type ModuleIssueSeverity = "error" | "warning";
export type ModulePlannerStatus = "Ready" | "Needs review";
export type ModulePreviewFilter = "all" | "pages" | "graded" | "risky";

export interface ModulePlanIssue {
  id: string;
  moduleId: string;
  itemId?: string;
  severity: ModuleIssueSeverity;
  title: string;
  detail: string;
}

export interface ModuleSummary {
  moduleId: string;
  status: ModulePlannerStatus;
  issues: ModulePlanIssue[];
  itemCounts: Record<ModuleItemType, number>;
  gradedItems: number;
}

export interface ModulePlanValidation {
  score: number;
  status: ModulePlannerStatus;
  issues: ModulePlanIssue[];
  moduleSummaries: ModuleSummary[];
}

export interface ModuleItemTarget {
  id: string;
  type: ModuleItemType;
  title: string;
  moduleId?: string;
  summary: string;
  points?: number;
}

const emptyCounts = (): Record<ModuleItemType, number> => ({
  page: 0,
  syllabus: 0,
  assignment: 0,
  discussion: 0,
  quiz: 0
});

const touchedMetadata = (metadata: ObjectMetadata | undefined, timestamp: string): ObjectMetadata => ({
  createdAt: metadata?.createdAt ?? timestamp,
  updatedAt: timestamp,
  lastExportedAt: metadata?.lastExportedAt,
  exportVersion: metadata?.exportVersion ?? 0,
  source: "edited"
});

const uniqueValue = (base: string, existing: Set<string>): string => {
  let candidate = base;
  let index = 2;
  while (existing.has(candidate)) {
    candidate = `${base}-${index}`;
    index += 1;
  }
  existing.add(candidate);
  return candidate;
};

export const moduleItemTypeLabel = (type: ModuleItemType): string => {
  if (type === "page") return "Page";
  if (type === "syllabus") return "Syllabus";
  if (type === "assignment") return "Assignment";
  if (type === "discussion") return "Discussion";
  return "Quiz";
};

export const itemCountsForModule = (module: CourseModule): Record<ModuleItemType, number> =>
  module.items.reduce((counts, item) => ({ ...counts, [item.type]: counts[item.type] + 1 }), emptyCounts());

export const getModuleItemTarget = (course: CourseProject, item: ModuleItem): ModuleItemTarget | undefined => {
  if (item.type === "page" || item.type === "syllabus") {
    const page = course.pages.find((entry) => entry.id === item.refId);
    return page
      ? {
          id: page.id,
          type: item.type,
          title: page.title,
          moduleId: page.moduleId,
          summary: stripHtml(page.bodyHtml).slice(0, 180)
        }
      : undefined;
  }

  if (item.type === "assignment") {
    const assignment = course.assignments.find((entry) => entry.id === item.refId);
    return assignment
      ? {
          id: assignment.id,
          type: item.type,
          title: assignment.title,
          moduleId: assignment.moduleId,
          points: assignment.points,
          summary: stripHtml(assignment.descriptionHtml).slice(0, 180)
        }
      : undefined;
  }

  if (item.type === "discussion") {
    const discussion = course.discussions.find((entry) => entry.id === item.refId);
    return discussion
      ? {
          id: discussion.id,
          type: item.type,
          title: discussion.title,
          moduleId: discussion.moduleId,
          points: discussion.points,
          summary: stripHtml(discussion.promptHtml).slice(0, 180)
        }
      : undefined;
  }

  const quiz = course.quizzes.find((entry) => entry.id === item.refId);
  return quiz
    ? {
        id: quiz.id,
        type: item.type,
        title: quiz.title,
        moduleId: quiz.moduleId,
        points: quiz.points,
        summary: stripHtml(quiz.purpose).slice(0, 180)
      }
    : undefined;
};

const renumberModules = (modules: CourseModule[]): CourseModule[] => modules.map((module, index) => ({ ...module, order: index, status: "edited" }));

const renumberItems = (items: ModuleItem[]): ModuleItem[] => items.map((item, index) => ({ ...item, order: index + 1, status: "edited" }));

const syncItemObjectToModule = (course: CourseProject, item: ModuleItem, moduleId: string, timestamp: string): CourseProject => ({
  ...course,
  pages:
    item.type === "page" || item.type === "syllabus"
      ? course.pages.map((page) => (page.id === item.refId ? { ...page, moduleId, status: "edited", metadata: touchedMetadata(page.metadata, timestamp) } : page))
      : course.pages,
  assignments:
    item.type === "assignment"
      ? course.assignments.map((assignment) =>
          assignment.id === item.refId ? { ...assignment, moduleId, status: "edited", metadata: touchedMetadata(assignment.metadata, timestamp) } : assignment
        )
      : course.assignments,
  discussions:
    item.type === "discussion"
      ? course.discussions.map((discussion) =>
          discussion.id === item.refId ? { ...discussion, moduleId, status: "edited", metadata: touchedMetadata(discussion.metadata, timestamp) } : discussion
        )
      : course.discussions,
  quizzes:
    item.type === "quiz"
      ? course.quizzes.map((quiz) =>
          quiz.id === item.refId
            ? {
                ...quiz,
                moduleId,
                questions: quiz.questions.map((question) => ({ ...question, moduleId })),
                status: "edited",
                metadata: touchedMetadata(quiz.metadata, timestamp)
              }
            : quiz
        )
      : course.quizzes,
  schedule: course.schedule.map((entry) => (entry.itemId === item.refId ? { ...entry, moduleId } : entry))
});

export const moveModuleItem = (
  course: CourseProject,
  draggedItem: { moduleId: string; itemId: string },
  targetModuleId: string,
  targetItemId?: string,
  timestamp = nowIso()
): CourseProject => {
  const modules = course.modules.map((module) => ({ ...module, items: [...module.items] }));
  const sourceModule = modules.find((module) => module.id === draggedItem.moduleId);
  const targetModule = modules.find((module) => module.id === targetModuleId);
  if (!sourceModule || !targetModule) return course;
  const sourceIndex = sourceModule.items.findIndex((item) => item.id === draggedItem.itemId);
  if (sourceIndex < 0) return course;
  const [item] = sourceModule.items.splice(sourceIndex, 1);
  const targetIndex = targetItemId ? targetModule.items.findIndex((target) => target.id === targetItemId) : targetModule.items.length;
  targetModule.items.splice(targetIndex < 0 ? targetModule.items.length : targetIndex, 0, { ...item, status: "edited", metadata: touchedMetadata(item.metadata, timestamp) });

  const movedCourse = {
    ...course,
    modules: modules.map((module) => ({ ...module, items: renumberItems(module.items) }))
  };

  return syncItemObjectToModule(movedCourse, item, targetModuleId, timestamp);
};

export const removeModule = (course: CourseProject, moduleId: string, moveItemsToModuleId?: string, timestamp = nowIso()): CourseProject => {
  const module = course.modules.find((entry) => entry.id === moduleId);
  if (!module) return course;
  if (module.items.length > 0 && !moveItemsToModuleId) return course;
  if (moveItemsToModuleId === moduleId) return course;
  const targetModule = moveItemsToModuleId ? course.modules.find((entry) => entry.id === moveItemsToModuleId) : undefined;
  if (module.items.length > 0 && !targetModule) return course;

  const movingRefIds = new Set(module.items.map((item) => item.refId));
  const modules = course.modules
    .filter((entry) => entry.id !== moduleId)
    .map((entry) =>
      entry.id === moveItemsToModuleId
        ? { ...entry, items: renumberItems([...entry.items, ...module.items.map((item) => ({ ...item, status: "edited" as const, metadata: touchedMetadata(item.metadata, timestamp) }))]) }
        : entry
    );

  let next: CourseProject = {
    ...course,
    modules: renumberModules(modules),
    schedule: course.schedule
      .filter((entry) => entry.moduleId !== moduleId || (Boolean(moveItemsToModuleId) && typeof entry.itemId === "string" && movingRefIds.has(entry.itemId)))
      .map((entry) => (entry.moduleId === moduleId && entry.itemId && movingRefIds.has(entry.itemId) ? { ...entry, moduleId: moveItemsToModuleId as string } : entry))
  };

  if (moveItemsToModuleId) {
    module.items.forEach((item) => {
      next = syncItemObjectToModule(next, item, moveItemsToModuleId, timestamp);
    });
  }

  return next;
};

export const duplicateModuleWithContent = (
  course: CourseProject,
  moduleId: string,
  options: { stamp?: string | number; timestamp?: string } = {}
): CourseProject => {
  const original = course.modules.find((module) => module.id === moduleId);
  if (!original) return course;
  const stamp = options.stamp ?? Date.now();
  const timestamp = options.timestamp ?? nowIso();
  const copiedModuleId = uniqueValue(`${original.id}_copy_${stamp}`, new Set(course.modules.map((module) => module.id)));
  const existingPageSlugs = new Set(course.pages.map((page) => page.slug));
  const refMap = new Map<string, string>();

  const copiedPages: CoursePage[] = [];
  const copiedAssignments: Assignment[] = [];
  const copiedDiscussions: Discussion[] = [];
  const copiedQuizzes: Quiz[] = [];

  const copiedItems = original.items.map((item, index) => {
    const copiedItem: ModuleItem = {
      ...item,
      id: uniqueValue(`${item.id}_copy_${stamp}_${index}`, new Set(course.modules.flatMap((module) => module.items.map((moduleItem) => moduleItem.id)))),
      order: index + 1,
      status: "edited",
      metadata: touchedMetadata(item.metadata, timestamp)
    };

    if (item.type === "page" || item.type === "syllabus") {
      const page = course.pages.find((entry) => entry.id === item.refId);
      if (!page) return copiedItem;
      const copiedPageId = `${page.id}_copy_${stamp}_${index}`;
      refMap.set(page.id, copiedPageId);
      copiedPages.push({
        ...page,
        id: copiedPageId,
        title: `${page.title} Copy`,
        slug: uniqueValue(`${slugify(page.slug || page.title)}-copy-${stamp}`, existingPageSlugs),
        moduleId: copiedModuleId,
        frontPage: false,
        assetPath: undefined,
        status: "edited",
        metadata: touchedMetadata(page.metadata, timestamp)
      });
      return { ...copiedItem, refId: copiedPageId };
    }

    if (item.type === "assignment") {
      const assignment = course.assignments.find((entry) => entry.id === item.refId);
      if (!assignment) return copiedItem;
      const copiedAssignmentId = `${assignment.id}_copy_${stamp}_${index}`;
      refMap.set(assignment.id, copiedAssignmentId);
      copiedAssignments.push({
        ...assignment,
        id: copiedAssignmentId,
        title: `${assignment.title} Copy`,
        moduleId: copiedModuleId,
        status: "edited",
        metadata: touchedMetadata(assignment.metadata, timestamp)
      });
      return { ...copiedItem, refId: copiedAssignmentId };
    }

    if (item.type === "discussion") {
      const discussion = course.discussions.find((entry) => entry.id === item.refId);
      if (!discussion) return copiedItem;
      const copiedDiscussionId = `${discussion.id}_copy_${stamp}_${index}`;
      refMap.set(discussion.id, copiedDiscussionId);
      copiedDiscussions.push({
        ...discussion,
        id: copiedDiscussionId,
        title: `${discussion.title} Copy`,
        moduleId: copiedModuleId,
        status: "edited",
        metadata: touchedMetadata(discussion.metadata, timestamp)
      });
      return { ...copiedItem, refId: copiedDiscussionId };
    }

    const quiz = course.quizzes.find((entry) => entry.id === item.refId);
    if (!quiz) return copiedItem;
    const copiedQuizId = `${quiz.id}_copy_${stamp}_${index}`;
    refMap.set(quiz.id, copiedQuizId);
    copiedQuizzes.push({
      ...quiz,
      id: copiedQuizId,
      title: `${quiz.title} Copy`,
      moduleId: copiedModuleId,
      questions: quiz.questions.map((question, questionIndex) => ({ ...question, id: `${question.id}_copy_${stamp}_${questionIndex}`, moduleId: copiedModuleId })),
      status: "edited",
      metadata: touchedMetadata(quiz.metadata, timestamp)
    });
    return { ...copiedItem, refId: copiedQuizId };
  });

  const copy: CourseModule = {
    ...original,
    id: copiedModuleId,
    title: `${original.title} Copy`,
    order: original.order + 1,
    status: "edited",
    expanded: true,
    metadata: touchedMetadata(original.metadata, timestamp),
    items: copiedItems
  };
  const modules = [...course.modules];
  modules.splice(original.order + 1, 0, copy);
  const copiedSchedule: CourseScheduleEntry[] = course.schedule
    .filter((entry) => entry.moduleId === original.id)
    .flatMap((entry, index) => {
      const copiedItemId = entry.itemId ? refMap.get(entry.itemId) : undefined;
      if (entry.itemId && !copiedItemId) return [];
      return [
        {
          ...entry,
          id: `${entry.id}_copy_${stamp}_${index}`,
          title: `${entry.title} Copy`,
          moduleId: copiedModuleId,
          itemId: copiedItemId
        }
      ];
    });

  return {
    ...course,
    modules: renumberModules(modules),
    pages: [...course.pages, ...copiedPages],
    assignments: [...course.assignments, ...copiedAssignments],
    discussions: [...course.discussions, ...copiedDiscussions],
    quizzes: [...course.quizzes, ...copiedQuizzes],
    schedule: [...course.schedule, ...copiedSchedule]
  };
};

export const validateModulePlan = (course: CourseProject): ModulePlanValidation => {
  const issues: ModulePlanIssue[] = [];
  const pushIssue = (issue: ModulePlanIssue): void => {
    issues.push(issue);
  };

  course.modules.forEach((module) => {
    const moduleIssues: ModulePlanIssue[] = [];
    const addModuleIssue = (issue: Omit<ModulePlanIssue, "moduleId">): void => {
      const fullIssue = { ...issue, moduleId: module.id };
      moduleIssues.push(fullIssue);
      pushIssue(fullIssue);
    };

    if (!module.title.trim()) {
      addModuleIssue({ id: `${module.id}-title`, severity: "error", title: "Module title missing", detail: "Canvas modules need a clear student-facing title." });
    }
    if (module.objectives.filter((objective) => objective.trim()).length === 0) {
      addModuleIssue({ id: `${module.id}-objectives`, severity: "warning", title: "Objectives missing", detail: "Add at least one measurable objective so students understand the purpose." });
    }
    if (module.items.length === 0) {
      addModuleIssue({ id: `${module.id}-empty`, severity: "error", title: "Empty module", detail: "Add or move at least one item before exporting this module." });
    }
    if (module.workloadHours <= 0 || !Number.isFinite(module.workloadHours)) {
      addModuleIssue({ id: `${module.id}-workload-empty`, severity: "error", title: "Workload missing", detail: "Set a positive workload estimate for pacing guidance." });
    } else if (module.workloadHours > 18) {
      addModuleIssue({ id: `${module.id}-workload-heavy`, severity: "warning", title: "Workload looks heavy", detail: `${module.workloadHours} hours may overload one module unless this is intentional.` });
    }

    const targets = module.items.map((item) => ({ item, target: getModuleItemTarget(course, item) }));
    const pageTargets = targets.filter(({ target }) => target?.type === "page" || target?.type === "syllabus");
    const gradedTargets = targets.filter(({ target }) => (target?.points ?? 0) > 0 || target?.type === "assignment" || target?.type === "quiz");
    if (module.kind !== "instructor" && module.items.length > 0 && pageTargets.length === 0) {
      addModuleIssue({ id: `${module.id}-content-page`, severity: "warning", title: "No content page", detail: "Students usually need at least one page that explains the module path." });
    }
    if (module.kind === "content" && !module.items.some((item) => item.type === "page" && /(overview|intro|orientation)/i.test(item.title))) {
      addModuleIssue({ id: `${module.id}-overview`, severity: "warning", title: "Overview missing", detail: "Add an overview or intro page at the start of the module." });
    }
    if (module.kind === "content" && !module.items.some((item) => item.type === "page" && /(wrap|recap|synthesis|next)/i.test(item.title))) {
      addModuleIssue({ id: `${module.id}-recap`, severity: "warning", title: "Recap missing", detail: "Add a recap or wrap-up page so students know how to close the module." });
    }
    if (gradedTargets.length > 3) {
      addModuleIssue({ id: `${module.id}-graded-bunching`, severity: "warning", title: "Many graded items", detail: `${gradedTargets.length} graded items appear in this module. Confirm the workload is intentional.` });
    }
    if (module.kind === "final" && course.settings.finalProject && !module.items.some((item) => item.type === "assignment" && /(final|project|portfolio|capstone)/i.test(item.title))) {
      addModuleIssue({ id: `${module.id}-final-project`, severity: "error", title: "Final project missing", detail: "The final module should include a final assignment or project item." });
    }
    if (module.kind === "instructor" && module.publishState !== "unpublished") {
      addModuleIssue({ id: `${module.id}-instructor-published`, severity: "error", title: "Instructor module published", detail: "Instructor-only modules should remain unpublished before export." });
    }

    targets.forEach(({ item, target }) => {
      if (!target) {
        addModuleIssue({ id: `${item.id}-missing-target`, itemId: item.id, severity: "error", title: "Broken item reference", detail: `${item.title} points to a missing ${moduleItemTypeLabel(item.type).toLowerCase()} object.` });
        return;
      }
      if (target.moduleId !== module.id) {
        addModuleIssue({ id: `${item.id}-module-mismatch`, itemId: item.id, severity: "error", title: "Module location mismatch", detail: `${target.title} is listed here but its underlying object belongs to ${target.moduleId || "no module"}.` });
      }
    });
  });

  const moduleSummaries = course.modules.map((module) => {
    const moduleIssues = issues.filter((issue) => issue.moduleId === module.id);
    return {
      moduleId: module.id,
      status: moduleIssues.some((issue) => issue.severity === "error") ? "Needs review" : "Ready",
      issues: moduleIssues,
      itemCounts: itemCountsForModule(module),
      gradedItems: module.items.filter((item) => item.type === "assignment" || item.type === "quiz").length
    } satisfies ModuleSummary;
  });
  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.filter((issue) => issue.severity === "warning").length;
  return {
    score: Math.max(0, Math.round(100 - errors * 8 - warnings * 3)),
    status: errors > 0 ? "Needs review" : "Ready",
    issues,
    moduleSummaries
  };
};
