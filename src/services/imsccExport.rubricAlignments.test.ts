import { describe, expect, it } from "vitest";
import { defaultSettings } from "../data/defaultSettings";
import { generateCourseProject } from "./courseGenerator";
import { buildImsccZip } from "./imsccExport";

// Regression: Canvas rejects a rubric whose criteria align the SAME learning outcome more than once
// (Rubric::RubricUniqueAlignments → save! raises → "Import Error: Rubric - <title>" on import). The
// generator legitimately reuses an outcome across criteria (e.g. 3 criteria, 2 aligned outcomes), so
// the export must emit each outcome's <learning_outcome_identifierref> at most once per rubric.

const outcomeRefsByRubric = (rubricsXml: string): Map<string, string[]> => {
  const map = new Map<string, string[]>();
  const rubricRe = /<rubric identifier="([^"]+)">([\s\S]*?)<\/rubric>/g;
  let match: RegExpExecArray | null;
  while ((match = rubricRe.exec(rubricsXml)) !== null) {
    const [, id, body] = match;
    const refs = Array.from(body.matchAll(/<learning_outcome_identifierref>([^<]+)<\/learning_outcome_identifierref>/g)).map((m) => m[1]);
    map.set(id, refs);
  }
  return map;
};

const makeCourse = () =>
  generateCourseProject({
    prompt: "Build me a 12-week course on Dracula and Victorian anxiety.",
    settings: { ...defaultSettings, title: "Blood Lines", moduleCount: 12, lengthWeeks: 12, assignmentCadence: "every-module", discussionFrequency: "weekly" }
  });

describe("rubric outcome alignment export", () => {
  it("never aligns the same outcome to more than one criterion within a rubric", async () => {
    const course = makeCourse();
    // Guard: the generated course really does reuse outcomes across criteria (otherwise the test
    // would pass trivially and not protect against the bug).
    const reusesOutcome = course.rubrics.some((rubric) => {
      const ids = rubric.criteria.map((criterion) => criterion.outcomeId).filter(Boolean);
      return new Set(ids).size !== ids.length;
    });
    expect(reusesOutcome).toBe(true);

    const zip = await buildImsccZip(course);
    const xml = await zip.file("course_settings/rubrics.xml")!.async("string");
    const refsByRubric = outcomeRefsByRubric(xml);

    expect(refsByRubric.size).toBe(course.rubrics.length);
    for (const [rubricId, refs] of refsByRubric) {
      expect(new Set(refs).size, `rubric ${rubricId} aligns an outcome more than once`).toBe(refs.length);
    }
  });

  it("still aligns each rubric to its outcomes (dedup drops duplicates, not all alignments)", async () => {
    const course = makeCourse();
    const zip = await buildImsccZip(course);
    const xml = await zip.file("course_settings/rubrics.xml")!.async("string");
    const refsByRubric = outcomeRefsByRubric(xml);

    // Every rubric whose criteria reference an outcome keeps at least one alignment.
    course.rubrics.forEach((rubric) => {
      if (rubric.criteria.some((criterion) => criterion.outcomeId)) {
        expect((refsByRubric.get(rubric.id) ?? []).length).toBeGreaterThan(0);
      }
    });
  });
});
