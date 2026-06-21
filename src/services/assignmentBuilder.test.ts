import { describe, expect, it } from "vitest";
import type { CourseProject } from "../types";
import { buildImsccZip, validateImsccZip } from "./imsccExport";
import {
  ASSIGNMENT_TEMPLATES,
  buildAssignmentTemplateHtml,
  changeAssignmentModule,
  createAssignment,
  deleteAssignment,
  restoreAssignment,
  validateAssignmentPlan
} from "./assignmentBuilder";
import { sampleProject } from "./courseGenerator";

const clone = (course: CourseProject): CourseProject => structuredClone(course);

const targetModuleFor = (course: CourseProject, sourceModuleId: string) => {
  const target = course.modules.find((module) => module.id !== sourceModuleId && module.kind === "content") ?? course.modules.find((module) => module.id !== sourceModuleId);
  expect(target).toBeDefined();
  return target!;
};

describe("assignment builder", () => {
  it("keeps assignment module changes aligned with module items and schedule entries", () => {
    const course = clone(sampleProject);
    const assignment = course.assignments[0];
    const target = targetModuleFor(course, assignment.moduleId);

    const moved = changeAssignmentModule(course, assignment.id, target.id, "2026-01-01T00:00:00.000Z");
    const moduleItems = moved.modules.flatMap((module) => module.items.filter((item) => item.type === "assignment" && item.refId === assignment.id).map((item) => ({ moduleId: module.id, item })));

    expect(moved.assignments.find((item) => item.id === assignment.id)?.moduleId).toBe(target.id);
    expect(moduleItems).toHaveLength(1);
    expect(moduleItems[0].moduleId).toBe(target.id);
    moved.schedule.filter((entry) => entry.itemId === assignment.id).forEach((entry) => expect(entry.moduleId).toBe(target.id));
    expect(validateAssignmentPlan(moved).issues.filter((issue) => /module-mismatch/.test(issue.id))).toHaveLength(0);
  });

  it("creates and deletes assignments with matching module items", () => {
    const course = clone(sampleProject);
    const created = createAssignment(course, { templateId: "portfolio-artifact", assignmentId: "assignment_unit_created", timestamp: "2026-01-01T00:00:00.000Z" });
    const assignment = created.assignments.find((item) => item.id === "assignment_unit_created");

    expect(assignment).toBeDefined();
    expect(created.modules.some((module) => module.items.some((item) => item.type === "assignment" && item.refId === "assignment_unit_created"))).toBe(true);
    expect(validateAssignmentPlan(created).issues.filter((issue) => issue.assignmentId === "assignment_unit_created" && issue.severity === "error")).toHaveLength(0);

    const deleted = deleteAssignment(created, "assignment_unit_created");
    expect(deleted.assignments.some((item) => item.id === "assignment_unit_created")).toBe(false);
    expect(deleted.modules.some((module) => module.items.some((item) => item.refId === "assignment_unit_created"))).toBe(false);
  });

  it("restores a deleted assignment snapshot and recreates its module item", () => {
    const course = clone(sampleProject);
    const assignment = course.assignments[0];
    const deleted = deleteAssignment(course, assignment.id);
    const restored = restoreAssignment(deleted, assignment, "2026-01-01T00:00:00.000Z");

    expect(restored.assignments.some((item) => item.id === assignment.id)).toBe(true);
    expect(restored.modules.some((module) => module.id === assignment.moduleId && module.items.some((item) => item.refId === assignment.id))).toBe(true);
  });

  it("template HTML includes required instructional sections and Canvas-safe markup", () => {
    const course = clone(sampleProject);
    const assignment = course.assignments[0];

    ASSIGNMENT_TEMPLATES.forEach((template) => {
      const html = buildAssignmentTemplateHtml(template.id, course, assignment);

      ["Purpose", "Task", "Deliverables", "Steps", "Format Requirements", "Example Success Markers", "Submission Instructions", "Grading Notes", "Accessibility Note", "Rubric Alignment Prompt"].forEach((heading) =>
        expect(html).toContain(`<h2>${heading}</h2>`)
      );
      expect(html).not.toMatch(/<script|javascript:|\son[a-z]+\s*=/i);
    });
  });

  it("flags unsafe or weak assignment content", () => {
    const course = clone(sampleProject);
    const assignment = course.assignments[0];
    course.assignments = course.assignments.map((item) =>
      item.id === assignment.id
        ? {
            ...item,
            title: "",
            descriptionHtml: '<p>click here</p><img src="x"><script>alert(1)</script>',
            points: 0,
            estimatedHours: 0,
            assignmentGroupId: "missing_group",
            rubricId: "missing_rubric",
            alignedOutcomeIds: [],
            submissionType: "unsupported_delivery"
          }
        : item
    );

    const validation = validateAssignmentPlan(course);
    const ids = validation.issues.filter((issue) => issue.assignmentId === assignment.id).map((issue) => issue.id);

    expect(ids).toEqual(expect.arrayContaining([`${assignment.id}-title`, `${assignment.id}-points`, `${assignment.id}-group`, `${assignment.id}-unsafe-html`, `${assignment.id}-image-alt`]));
  });

  it("fails export validation for unsafe assignment HTML", async () => {
    const course = clone(sampleProject);
    const assignment = course.assignments[0];
    course.assignments = course.assignments.map((item) => (item.id === assignment.id ? { ...item, descriptionHtml: `${item.descriptionHtml}<script>alert(1)</script>` } : item));

    const zip = await buildImsccZip(course);
    const report = await validateImsccZip(course, zip);

    expect(report.valid).toBe(false);
    expect(report.issues.some((issue) => issue.id.includes("assignment-quality") && issue.severity === "error")).toBe(true);
  });
});
