import { describe, expect, it } from "vitest";
import { buildCourseFromBlueprint } from "./aiGeneration";
import { buildReadinessReport } from "./readiness";
import { defaultSettings } from "../data/defaultSettings";
import type { CourseBlueprint } from "../ai/blueprint";

// A blueprint with FEWER outcomes than the deterministic generator produces, and AI-specific
// module titles — the exact shape that previously desynced references/outcomes and produced false
// readiness blockers immediately after generation.
const blueprint: CourseBlueprint = {
  title: "Introduction to Marine Biology",
  description: "An 8-week survey of marine ecosystems for non-majors.",
  audience: "Undergraduate non-majors",
  level: "Undergraduate",
  modality: "Online asynchronous",
  creditHours: 3,
  lengthWeeks: 8,
  teachingApproach: "Inquiry-based with weekly case studies.",
  outcomes: [
    { code: "CO1", text: "Explain ocean zonation and its drivers." },
    { code: "CO2", text: "Analyze marine food webs." },
    { code: "CO3", text: "Evaluate a conservation tradeoff." }
  ],
  modules: Array.from({ length: 8 }, (_, i) => ({
    title: `Module ${i + 1}: ${["Ocean Zones", "Primary Production", "Invertebrates", "Fish", "Mammals", "Coral Reefs", "Human Impact", "Conservation"][i]}`,
    summary: "A specific, course-relevant overview.",
    objectives: ["Identify key concepts", "Apply them to a case"]
  })),
  majorAssessments: ["Ecosystem case study", "Final field report"],
  finalProject: "Design a marine protected area proposal.",
  accessibilityNotes: "Alt text on all diagrams.",
  validationWarnings: []
};

describe("buildCourseFromBlueprint", () => {
  const course = buildCourseFromBlueprint(blueprint, defaultSettings, "An 8-week marine biology course");

  it("reflects the AI blueprint in title, description, and module titles", () => {
    expect(course.title).toBe("Introduction to Marine Biology");
    expect(course.description).toContain("marine ecosystems");
    expect(course.modules[0].title).toContain("Ocean Zones");
  });

  it("produces NO false readiness blockers immediately after generation", () => {
    const readiness = buildReadinessReport(course);
    const failedRequired = readiness.checks.filter((c) => c.severity === "required" && !c.passed);
    expect(failedRequired.map((c) => c.label)).toEqual([]);
    expect(readiness.blockers).toBe(0);
  });

  it("keeps outcome references intact (no dangling outcome ids)", () => {
    const ids = new Set(course.outcomes.map((o) => o.id));
    const refs = [
      ...course.assignments.flatMap((a) => a.alignedOutcomeIds),
      ...course.quizzes.flatMap((q) => q.alignedOutcomeIds),
      ...course.rubrics.flatMap((r) => r.alignedOutcomeIds),
      ...course.discussions.flatMap((d) => d.alignedOutcomeIds)
    ];
    expect(refs.every((id) => ids.has(id))).toBe(true);
  });

  it("keeps the syllabus page in sync with course outcomes", () => {
    const syllabus = course.pages.find((p) => p.slug === "syllabus") ?? course.pages[1];
    expect(course.outcomes.every((o) => syllabus.bodyHtml.includes(o.code) && syllabus.bodyHtml.includes(o.text))).toBe(true);
  });
});
