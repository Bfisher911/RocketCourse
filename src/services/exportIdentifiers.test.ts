import { describe, expect, it } from "vitest";
import { exportIdPrefix, namespaceCourseForExport } from "./exportIdentifiers";
import { generateCourseProject } from "./courseGenerator";
import { defaultSettings } from "../data/defaultSettings";

const build = (prompt: string) => generateCourseProject({ prompt, settings: defaultSettings });

describe("namespaceCourseForExport", () => {
  it("prefixes every object id and keeps references consistent", () => {
    const course = build("Build me a 6-week course on Marine Biology with weekly quizzes.");
    const ns = namespaceCourseForExport(course);
    const prefix = exportIdPrefix(course);

    expect(ns.modules.every((m) => m.id.startsWith(prefix))).toBe(true);
    expect(ns.assignments.every((a) => a.id.startsWith(prefix))).toBe(true);
    expect(ns.rubrics.every((r) => r.id.startsWith(prefix))).toBe(true);

    // References follow their targets.
    const moduleIds = new Set(ns.modules.map((m) => m.id));
    const rubricIds = new Set(ns.rubrics.map((r) => r.id));
    const outcomeIds = new Set(ns.outcomes.map((o) => o.id));
    ns.assignments.forEach((a) => {
      expect(moduleIds.has(a.moduleId)).toBe(true);
      if (a.rubricId) expect(rubricIds.has(a.rubricId)).toBe(true);
      a.alignedOutcomeIds.forEach((id) => expect(outcomeIds.has(id)).toBe(true));
    });
    const refIds = new Set([
      ...ns.pages.map((p) => p.id),
      ...ns.assignments.map((a) => a.id),
      ...ns.discussions.map((d) => d.id),
      ...ns.quizzes.map((q) => q.id)
    ]);
    ns.modules.forEach((m) =>
      m.items.filter((item) => item.type !== "subheader" && item.type !== "syllabus").forEach((item) => expect(refIds.has(item.refId)).toBe(true))
    );
  });

  it("rewrites Canvas link tokens inside HTML bodies", () => {
    const course = build("Build me a 6-week course on Marine Biology with weekly quizzes.");
    const ns = namespaceCourseForExport(course);
    const prefix = exportIdPrefix(course);
    const html = [...ns.pages.map((p) => p.bodyHtml), ...ns.assignments.map((a) => a.descriptionHtml)].join("\n");
    const tokenRefs = [...html.matchAll(/\$CANVAS_OBJECT_REFERENCE\$\/[a-z_]+\/([A-Za-z0-9_-]+)/g)].map((m) => m[1]);
    expect(tokenRefs.length).toBeGreaterThan(0);
    tokenRefs.forEach((refId) => expect(refId.startsWith(prefix)).toBe(true));
  });

  it("is deterministic and idempotent", () => {
    const course = build("Build me a 6-week course on Marine Biology with weekly quizzes.");
    const once = namespaceCourseForExport(course);
    const twice = namespaceCourseForExport(once);
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
    expect(JSON.stringify(namespaceCourseForExport(course))).toBe(JSON.stringify(once));
  });

  it("gives two different courses disjoint migration ids", () => {
    const a = namespaceCourseForExport({ ...build("A course on Marine Biology."), id: "course_aaa_111" });
    const b = namespaceCourseForExport({ ...build("A course on Field Botany."), id: "course_bbb_222" });
    const idsA = new Set(a.assignments.map((x) => x.id));
    b.assignments.forEach((x) => expect(idsA.has(x.id)).toBe(false));
  });
});
