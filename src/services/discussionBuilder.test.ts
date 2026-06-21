import { describe, expect, it } from "vitest";
import type { CourseProject } from "../types";
import { buildImsccZip, validateImsccZip } from "./imsccExport";
import {
  DISCUSSION_TEMPLATES,
  buildDiscussionTemplateHtml,
  changeDiscussionModule,
  createDiscussion,
  deleteDiscussion,
  duplicateDiscussion,
  restoreDiscussion,
  validateDiscussionPlan
} from "./discussionBuilder";
import { sampleProject } from "./courseGenerator";

const clone = (course: CourseProject): CourseProject => structuredClone(course);

const targetModuleFor = (course: CourseProject, sourceModuleId: string) => {
  const target = course.modules.find((module) => module.id !== sourceModuleId && module.kind === "content") ?? course.modules.find((module) => module.id !== sourceModuleId);
  expect(target).toBeDefined();
  return target!;
};

describe("discussion builder", () => {
  it("generates Canvas-safe templates with required participation sections", () => {
    const course = clone(sampleProject);
    const discussion = course.discussions[0];

    expect(DISCUSSION_TEMPLATES).toHaveLength(10);
    DISCUSSION_TEMPLATES.forEach((template) => {
      const html = buildDiscussionTemplateHtml(template.id, course, discussion);

      ["Purpose", "Prompt", "Required Evidence", "Initial Post Instructions", "Reply Instructions", "Quality Criteria", "Rubric Alignment", "Accessibility-Friendly Structure"].forEach((heading) =>
        expect(html).toContain(`<h2>${heading}</h2>`)
      );
      expect(html).not.toMatch(/<script|javascript:|\son[a-z]+\s*=/i);
    });
  });

  it("creates, duplicates, deletes, and restores discussions with module placement", () => {
    const created = createDiscussion(clone(sampleProject), {
      templateId: "case-response",
      discussionId: "discussion_unit_created",
      timestamp: "2026-01-01T00:00:00.000Z"
    });
    const discussion = created.discussions.find((item) => item.id === "discussion_unit_created");

    expect(discussion).toBeDefined();
    expect(created.modules.some((module) => module.items.some((item) => item.type === "discussion" && item.refId === "discussion_unit_created"))).toBe(true);
    expect(validateDiscussionPlan(created).issues.filter((issue) => issue.discussionId === "discussion_unit_created" && issue.severity === "error")).toHaveLength(0);

    const duplicated = duplicateDiscussion(created, "discussion_unit_created", { stamp: "unit", timestamp: "2026-01-01T00:00:00.000Z" });
    const copy = duplicated.discussions.find((item) => item.id === "discussion_unit_created_copy_unit");
    expect(copy).toBeDefined();
    expect(copy?.title).toContain("Copy");
    expect(duplicated.modules.some((module) => module.items.some((item) => item.type === "discussion" && item.refId === copy?.id))).toBe(true);

    const deleted = deleteDiscussion(duplicated, copy!.id);
    expect(deleted.discussions.some((item) => item.id === copy!.id)).toBe(false);
    expect(deleted.modules.some((module) => module.items.some((item) => item.refId === copy!.id))).toBe(false);

    const restored = restoreDiscussion(deleted, copy!, "2026-01-01T00:00:00.000Z");
    expect(restored.discussions.some((item) => item.id === copy!.id)).toBe(true);
    expect(restored.modules.some((module) => module.id === copy!.moduleId && module.items.some((item) => item.refId === copy!.id))).toBe(true);
  });

  it("keeps discussion module changes aligned with module items and schedule entries", () => {
    const course = clone(sampleProject);
    const discussion = course.discussions.find((item) => item.moduleId) ?? course.discussions[0];
    const target = targetModuleFor(course, discussion.moduleId);

    const moved = changeDiscussionModule(course, discussion.id, target.id, "2026-01-01T00:00:00.000Z");
    const moduleItems = moved.modules.flatMap((module) => module.items.filter((item) => item.type === "discussion" && item.refId === discussion.id).map((item) => ({ moduleId: module.id, item })));

    expect(moved.discussions.find((item) => item.id === discussion.id)?.moduleId).toBe(target.id);
    expect(moduleItems).toHaveLength(1);
    expect(moduleItems[0].moduleId).toBe(target.id);
    moved.schedule.filter((entry) => entry.itemId === discussion.id).forEach((entry) => expect(entry.moduleId).toBe(target.id));
    expect(validateDiscussionPlan(moved).issues.filter((issue) => /module-mismatch/.test(issue.id))).toHaveLength(0);
  });

  it("flags unsafe, weak, unaligned, and misplaced discussion prompts", () => {
    const course = clone(sampleProject);
    const discussion = course.discussions[0];
    course.discussions = course.discussions.map((item) =>
      item.id === discussion.id
        ? {
            ...item,
            title: "",
            promptHtml: '<p>click here</p><a href="missing.html">here</a><script>alert(1)</script>',
            points: -1,
            moduleId: "missing_module",
            assignmentGroupId: "missing_group",
            rubricId: "missing_rubric",
            alignedOutcomeIds: []
          }
        : item
    );

    const validation = validateDiscussionPlan(course);
    const ids = validation.issues.filter((issue) => issue.discussionId === discussion.id).map((issue) => issue.id);

    expect(ids).toEqual(
      expect.arrayContaining([
        `${discussion.id}-title`,
        `${discussion.id}-prompt-detail`,
        `${discussion.id}-points`,
        `${discussion.id}-module`,
        `${discussion.id}-outcomes`,
        `${discussion.id}-unsafe-html`,
        `${discussion.id}-link-text`,
        `${discussion.id}-broken-links`,
        `${discussion.id}-module-mismatch`
      ])
    );
  });

  it("exports discussions and fails validation for unsafe discussion HTML", async () => {
    const course = createDiscussion(clone(sampleProject), {
      templateId: "student-led-seminar",
      discussionId: "discussion_export_created",
      timestamp: "2026-01-01T00:00:00.000Z"
    });

    const zip = await buildImsccZip(course);
    expect(zip.file("discussion_export_created.xml")).toBeTruthy();
    expect(zip.file("discussion_export_created_meta.xml")).toBeTruthy();

    const broken = clone(course);
    broken.discussions = broken.discussions.map((item) => (item.id === "discussion_export_created" ? { ...item, promptHtml: `${item.promptHtml}<script>alert(1)</script>` } : item));
    const report = await validateImsccZip(broken, await buildImsccZip(broken));

    expect(report.valid).toBe(false);
    expect(report.issues.some((issue) => issue.id.includes("discussion-quality") && issue.severity === "error")).toBe(true);
  });
});
