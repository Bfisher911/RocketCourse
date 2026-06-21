import { describe, expect, it } from "vitest";
import type { CourseProject } from "../types";
import { buildImsccZip, validateImsccZip } from "./imsccExport";
import {
  RUBRIC_TEMPLATES,
  applyRubricTemplate,
  attachRubricToAssignment,
  attachRubricToDiscussion,
  buildRubricFromTemplate,
  createRubric,
  getRubricUsage,
  validateRubricPlan
} from "./rubricBuilder";
import { sampleProject } from "./courseGenerator";

const clone = (course: CourseProject): CourseProject => structuredClone(course);

describe("rubric builder", () => {
  it("generates student-facing rubric templates with criteria, levels, points, and outcomes", () => {
    const course = clone(sampleProject);

    expect(RUBRIC_TEMPLATES).toHaveLength(10);
    RUBRIC_TEMPLATES.forEach((template) => {
      const rubric = buildRubricFromTemplate(template.id, course, { rubricId: `rubric_unit_${template.id}` });

      expect(rubric.title).toContain("Rubric");
      expect(rubric.criteria.length).toBeGreaterThanOrEqual(4);
      expect(rubric.points).toBeGreaterThan(0);
      expect(rubric.alignedOutcomeIds.length).toBeGreaterThan(0);
      rubric.criteria.forEach((criterion) => {
        expect(criterion.description.length).toBeGreaterThan(24);
        expect(criterion.levels.length).toBeGreaterThanOrEqual(4);
        expect(Math.max(...criterion.levels.map((level) => level.points))).toBeGreaterThan(0);
      });
    });
  });

  it("creates rubrics and applies templates without breaking existing attachments", () => {
    const course = clone(sampleProject);
    const created = createRubric(course, "portfolio");
    const rubric = created.rubrics[created.rubrics.length - 1];

    expect(rubric).toBeDefined();
    expect(validateRubricPlan(created).issues.filter((issue) => issue.rubricId === rubric!.id && issue.severity === "error")).toHaveLength(0);

    const applied = applyRubricTemplate(created, rubric!.id, "discussion");
    const updated = applied.rubrics.find((item) => item.id === rubric!.id);
    expect(updated?.title).toBe(rubric!.title);
    expect(updated?.criteria.some((criterion) => /reply|post/i.test(`${criterion.title} ${criterion.description}`))).toBe(true);
  });

  it("attaches rubrics to assignments and discussions", () => {
    const course = clone(sampleProject);
    const rubric = course.rubrics[0];
    const assignment = course.assignments.find((item) => item.rubricId !== rubric.id) ?? course.assignments[0];
    const discussion = course.discussions.find((item) => item.points > 0 && item.rubricId !== rubric.id) ?? course.discussions.find((item) => item.points > 0)!;

    const attachedAssignment = attachRubricToAssignment(course, assignment.id, rubric.id);
    expect(attachedAssignment.assignments.find((item) => item.id === assignment.id)?.rubricId).toBe(rubric.id);

    const attachedDiscussion = attachRubricToDiscussion(attachedAssignment, discussion.id, rubric.id);
    expect(attachedDiscussion.discussions.find((item) => item.id === discussion.id)?.rubricId).toBe(rubric.id);
    const usage = getRubricUsage(attachedDiscussion, rubric.id);
    expect(usage.assignments.some((item) => item.id === assignment.id)).toBe(true);
    expect(usage.discussions.some((item) => item.id === discussion.id)).toBe(true);
  });

  it("flags weak rubric titles, criteria, levels, points, outcomes, and unused rubrics", () => {
    const course = clone(sampleProject);
    const rubric = course.rubrics[0];
    course.assignments = course.assignments.map((assignment) => (assignment.rubricId === rubric.id ? { ...assignment, rubricId: undefined } : assignment));
    course.discussions = course.discussions.map((discussion) => (discussion.rubricId === rubric.id ? { ...discussion, rubricId: undefined } : discussion));
    course.rubrics = course.rubrics.map((item) =>
      item.id === rubric.id
        ? {
            ...item,
            title: "",
            points: 0,
            alignedOutcomeIds: [],
            criteria: [{ ...item.criteria[0], title: "", description: "thin", outcomeId: "missing_outcome", levels: [{ label: "", points: -1, description: "" }] }]
          }
        : item
    );

    const ids = validateRubricPlan(course).issues.filter((issue) => issue.rubricId === rubric.id).map((issue) => issue.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        `${rubric.id}-title`,
        `${rubric.id}-points`,
        `${rubric.id}-outcomes`,
        `${rubric.id}-unused`,
        `${rubric.id}-${rubric.criteria[0].id}-criterion-title`,
        `${rubric.id}-${rubric.criteria[0].id}-criterion-description`,
        `${rubric.id}-${rubric.criteria[0].id}-levels`,
        `${rubric.id}-${rubric.criteria[0].id}-level-points`,
        `${rubric.id}-${rubric.criteria[0].id}-criterion-outcome`
      ])
    );
  });

  it("exports rubric criteria and fails package validation for broken rubric structure", async () => {
    const course = clone(sampleProject);
    const rubric = course.rubrics[0];
    const zip = await buildImsccZip(course);
    const xml = (await zip.file("course_settings/rubrics.xml")?.async("text")) ?? "";

    expect(xml).toContain(`<rubric identifier="${rubric.id}">`);
    expect(xml).toContain(`<criterion_id>${rubric.criteria[0].id}</criterion_id>`);
    expect(xml).toContain(`<description>${rubric.criteria[0].levels[0].label}</description>`);

    const broken = clone(course);
    broken.rubrics = broken.rubrics.map((item) => (item.id === rubric.id ? { ...item, criteria: [] } : item));
    const report = await validateImsccZip(broken, await buildImsccZip(broken));
    expect(report.valid).toBe(false);
    expect(report.issues.some((issue) => issue.id.includes("rubric-quality") && issue.severity === "error")).toBe(true);
  });
});
