import { describe, expect, it } from "vitest";
import type { CourseProject, ModuleItemType } from "../types";
import { sampleProject } from "./courseGenerator";
import { duplicateModuleWithContent, getModuleItemTarget, moveModuleItem, removeModule, validateModulePlan } from "./modulePlanner";

const clone = (course: CourseProject): CourseProject => structuredClone(course);

const findModuleWithItem = (course: CourseProject, type: ModuleItemType) => {
  const module = course.modules.find((entry) => entry.items.some((item) => item.type === type));
  expect(module, `expected module with ${type}`).toBeDefined();
  const item = module!.items.find((entry) => entry.type === type);
  expect(item, `expected ${type} item`).toBeDefined();
  return { module: module!, item: item! };
};

const targetModuleFor = (course: CourseProject, sourceModuleId: string) => {
  const target = course.modules.find((module) => module.id !== sourceModuleId && module.kind === "content") ?? course.modules.find((module) => module.id !== sourceModuleId);
  expect(target).toBeDefined();
  return target!;
};

describe("module planner operations", () => {
  it.each<ModuleItemType>(["page", "assignment", "discussion", "quiz"])("keeps %s objects aligned when moving items across modules", (type) => {
    const course = clone(sampleProject);
    const { module, item } = findModuleWithItem(course, type);
    const target = targetModuleFor(course, module.id);

    const moved = moveModuleItem(course, { moduleId: module.id, itemId: item.id }, target.id);
    const movedItem = moved.modules.find((entry) => entry.id === target.id)?.items.find((entry) => entry.id === item.id);
    const targetObject = getModuleItemTarget(moved, item);

    expect(movedItem).toBeDefined();
    expect(targetObject?.moduleId).toBe(target.id);
    moved.schedule.filter((entry) => entry.itemId === item.refId).forEach((entry) => expect(entry.moduleId).toBe(target.id));
    if (type === "quiz") {
      const quiz = moved.quizzes.find((entry) => entry.id === item.refId);
      expect(quiz?.questions.every((question) => question.moduleId === target.id)).toBe(true);
    }
    expect(validateModulePlan(moved).issues.filter((issue) => /module-mismatch/.test(issue.id))).toHaveLength(0);
  });

  it("deep-copies module content when duplicating a module", () => {
    const course = clone(sampleProject);
    const source = course.modules.find((module) => module.kind === "content" && module.items.some((item) => item.type === "quiz" || item.type === "assignment"));
    expect(source).toBeDefined();
    const originalRefIds = new Set(source!.items.map((item) => item.refId));

    const duplicated = duplicateModuleWithContent(course, source!.id, { stamp: "unit", timestamp: "2026-01-01T00:00:00.000Z" });
    const copy = duplicated.modules.find((module) => module.id === `${source!.id}_copy_unit`);

    expect(copy).toBeDefined();
    expect(copy?.items.length).toBe(source!.items.length);
    // Text-header (subheader) items legitimately have no backing object (empty refId), so the
    // copied-content assertions only apply to real content items.
    copy!.items.filter((item) => item.type !== "subheader").forEach((item) => {
      expect(originalRefIds.has(item.refId), `${item.title} should not point at original content`).toBe(false);
      const target = getModuleItemTarget(duplicated, item);
      expect(target?.moduleId).toBe(copy!.id);
      if (item.type === "quiz") {
        const quiz = duplicated.quizzes.find((entry) => entry.id === item.refId);
        expect(quiz?.questions.every((question) => question.moduleId === copy!.id)).toBe(true);
      }
    });
    expect(validateModulePlan(duplicated).issues.filter((issue) => /missing-target|module-mismatch/.test(issue.id))).toHaveLength(0);
  });

  it("flags module item references whose underlying object belongs elsewhere", () => {
    const course = clone(sampleProject);
    const { module, item } = findModuleWithItem(course, "assignment");
    const otherModule = targetModuleFor(course, module.id);
    course.assignments = course.assignments.map((assignment) => (assignment.id === item.refId ? { ...assignment, moduleId: otherModule.id } : assignment));

    const validation = validateModulePlan(course);

    expect(validation.issues.some((issue) => issue.itemId === item.id && /module-mismatch/.test(issue.id))).toBe(true);
  });

  it("moves items before deleting a non-empty module", () => {
    const course = clone(sampleProject);
    const source = course.modules.find((module) => module.kind === "content" && module.items.length > 0)!;
    const target = targetModuleFor(course, source.id);
    const movedRefIds = new Set(source.items.map((item) => item.refId));

    const updated = removeModule(course, source.id, target.id, "2026-01-01T00:00:00.000Z");

    expect(updated.modules.some((module) => module.id === source.id)).toBe(false);
    const targetModule = updated.modules.find((module) => module.id === target.id);
    expect(source.items.every((item) => targetModule?.items.some((targetItem) => targetItem.id === item.id))).toBe(true);
    targetModule?.items.filter((item) => item.type !== "subheader" && movedRefIds.has(item.refId)).forEach((item) => expect(getModuleItemTarget(updated, item)?.moduleId).toBe(target.id));
  });
});
