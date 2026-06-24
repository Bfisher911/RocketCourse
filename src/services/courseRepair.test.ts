import { describe, expect, it } from "vitest";
import { sampleProject } from "./courseGenerator";
import { generateImsccBlob } from "./imsccExport";
import { repairCourse, unrepairableIssues } from "./courseRepair";
import type { CourseProject } from "../types";

const clone = (c: CourseProject): CourseProject => JSON.parse(JSON.stringify(c)) as CourseProject;

describe("repairCourse", () => {
  it("is a no-op on a clean generated course (no repairs reported)", () => {
    expect(repairCourse(sampleProject).repairs).toEqual([]);
  });

  it("drops module items that point to deleted content", () => {
    const c = clone(sampleProject);
    const quiz = c.quizzes[0];
    c.quizzes = c.quizzes.filter((q) => q.id !== quiz.id); // delete object, leave its module item dangling
    const { course, repairs } = repairCourse(c);
    expect(repairs.some((r) => /pointed to deleted content/i.test(r))).toBe(true);
    expect(course.modules.some((m) => m.items.some((i) => i.refId === quiz.id))).toBe(false);
  });

  it("re-syncs an object whose moduleId no longer exists to the module it appears in", () => {
    const c = clone(sampleProject);
    const assignment = c.assignments[0];
    assignment.moduleId = "nonexistent-module";
    const { course } = repairCourse(c);
    const fixed = course.assignments.find((a) => a.id === assignment.id)!;
    expect(course.modules.some((m) => m.id === fixed.moduleId)).toBe(true);
  });

  it("syncs quiz question moduleId to the quiz", () => {
    const c = clone(sampleProject);
    const quiz = c.quizzes.find((q) => q.questions.length > 0)!;
    quiz.questions[0].moduleId = "drifted";
    const { course } = repairCourse(c);
    const fixed = course.quizzes.find((q) => q.id === quiz.id)!;
    expect(fixed.questions.every((qn) => qn.moduleId === fixed.moduleId)).toBe(true);
  });

  it("reassigns a graded item pointing at a missing assignment group", () => {
    const c = clone(sampleProject);
    c.assignments[0].assignmentGroupId = "ghost-group";
    const { course, repairs } = repairCourse(c);
    const groupIds = new Set(course.assignmentGroups.map((g) => g.id));
    expect(groupIds.has(course.assignments[0].assignmentGroupId)).toBe(true);
    expect(repairs.some((r) => /assignment group/i.test(r))).toBe(true);
  });

  it("clears a dangling rubric link", () => {
    const c = clone(sampleProject);
    c.assignments[0].rubricId = "ghost-rubric";
    const { course, repairs } = repairCourse(c);
    expect(course.assignments[0].rubricId).toBeUndefined();
    expect(repairs.some((r) => /rubric link/i.test(r))).toBe(true);
  });

  it("generates a slug for a page missing one", () => {
    const c = clone(sampleProject);
    c.pages[0].slug = "";
    const { course, repairs } = repairCourse(c);
    expect(course.pages[0].slug).toBeTruthy();
    expect(repairs.some((r) => /slug/i.test(r))).toBe(true);
  });

  it("downgrades a multiple-choice question with no choices to short answer", () => {
    const c = clone(sampleProject);
    const quiz = c.quizzes.find((q) => q.questions.length > 0)!;
    quiz.questions[0].type = "multiple_choice";
    quiz.questions[0].choices = [];
    const { course } = repairCourse(c);
    expect(course.quizzes.find((q) => q.id === quiz.id)!.questions[0].type).toBe("short_answer");
  });

  it("defaults invalid quiz question points", () => {
    const c = clone(sampleProject);
    const quiz = c.quizzes.find((q) => q.questions.length > 0)!;
    // @ts-expect-error simulate corrupted persisted data
    quiz.questions[0].points = "oops";
    const { course } = repairCourse(c);
    expect(course.quizzes.find((q) => q.id === quiz.id)!.questions[0].points).toBe(1);
  });

  it("rebalances assignment-group weights to total 100", () => {
    const c = clone(sampleProject);
    c.assignmentGroups[0].weight = 999;
    const { course } = repairCourse(c);
    expect(course.assignmentGroups.reduce((s, g) => s + g.weight, 0)).toBe(100);
  });

  it("strips alignedOutcomeIds that reference deleted outcomes", () => {
    const c = clone(sampleProject);
    const a = c.assignments.find((x) => x.alignedOutcomeIds.length > 0)!;
    a.alignedOutcomeIds = [...a.alignedOutcomeIds, "ghost-outcome"];
    const { course } = repairCourse(c);
    expect(course.assignments.find((x) => x.id === a.id)!.alignedOutcomeIds).not.toContain("ghost-outcome");
  });

  it("fills an empty assignment description with a placeholder", () => {
    const c = clone(sampleProject);
    c.assignments[0].descriptionHtml = "   ";
    const { course } = repairCourse(c);
    expect(course.assignments[0].descriptionHtml).toMatch(/coming soon/i);
  });

  it("is idempotent — repairing the repaired course yields no further repairs", () => {
    const c = clone(sampleProject);
    c.assignments[0].assignmentGroupId = "ghost";
    c.pages[0].slug = "";
    c.assignmentGroups[0].weight = 50;
    const once = repairCourse(c);
    expect(repairCourse(once.course).repairs).toEqual([]);
  });
});

describe("export survives a corrupted editing session", () => {
  it("still builds and validates a package with no error-severity issues after several corruptions", async () => {
    const c = clone(sampleProject);
    c.assignments[0].assignmentGroupId = "ghost";
    if (c.assignments[1]) c.assignments[1].rubricId = "ghost";
    c.pages[0].slug = "";
    if (c.quizzes[0]) c.quizzes[0].moduleId = "ghost-module";
    c.assignmentGroups[0].weight = 999;
    c.outcomes.pop(); // leave dangling alignments

    const { report } = await generateImsccBlob(c);
    const errors = report.issues.filter((i) => i.severity === "error");
    expect(errors).toEqual([]);
  });
});

describe("unrepairableIssues", () => {
  it("reports a quiz with no questions", () => {
    const c = clone(sampleProject);
    if (c.quizzes[0]) c.quizzes[0].questions = [];
    expect(unrepairableIssues(c).some((i) => /no questions/i.test(i))).toBe(true);
  });
});
