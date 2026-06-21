import { describe, expect, it } from "vitest";
import { defaultSettings } from "../data/defaultSettings";
import type { CourseProject } from "../types";
import { buildCourseQualityReport } from "./courseQuality";
import { generateCourseProject, sampleProject } from "./courseGenerator";
import { buildReadinessReport } from "./readiness";

const clone = (course: CourseProject): CourseProject => structuredClone(course);
const report = (course: CourseProject) => buildReadinessReport(course);
const checkOf = (course: CourseProject, id: string) => report(course).checks.find((entry) => entry.id === id);
const failed = (course: CourseProject, id: string): boolean => checkOf(course, id)?.passed === false;

// Each degrader mutates a clone in one dimension and returns it.
const degraders = {
  // 1. Empty content — blanked bodies (markup only, no visible text) across all graded work and
  // every lesson/practice/resource page (structural pages like overview/recap are left intact).
  emptyContent: (c: CourseProject) => {
    c.assignments.forEach((assignment) => {
      assignment.descriptionHtml = "";
    });
    c.discussions.forEach((discussion) => {
      discussion.promptHtml = "<p> </p>";
    });
    c.pages.filter((page) => /lecture|notes|practice|resource/i.test(page.title)).forEach((page) => {
      page.bodyHtml = "<div></div>";
    });
    return c;
  },
  // 2a. Empty module — a content module with no items at all.
  emptyModule: (c: CourseProject) => {
    const module = c.modules.find((m) => m.kind === "content")!;
    module.items = [];
    return c;
  },
  // 2b. Hollow modules — every content module keeps its overview/recap bookends, but the middle
  // of the learning path (readings, lecture, practice, graded work) is removed.
  hollowModule: (c: CourseProject) => {
    c.modules
      .filter((m) => m.kind === "content")
      .forEach((module) => {
        module.items = module.items.filter((item) => /overview/i.test(item.title) || /(wrap|recap)/i.test(item.title));
      });
    return c;
  },
  // 3a. Shallow rubrics — criteria stripped out.
  stripRubricCriteria: (c: CourseProject) => {
    c.rubrics.forEach((rubric) => {
      rubric.criteria = [];
    });
    return c;
  },
  // 3b. Missing rubric references on graded work.
  removeRubricRefs: (c: CourseProject) => {
    c.assignments.forEach((assignment) => {
      assignment.rubricId = undefined;
    });
    return c;
  },
  // 4a. Dangling reference — module item points at a non-existent object. Targets the last
  // content module so it stays independent of the Start Here / first-module degraders below.
  danglingItemRef: (c: CourseProject) => {
    const contentModules = c.modules.filter((m) => m.kind === "content");
    const module = contentModules[contentModules.length - 1];
    module.items[0].refId = "ghost_object_id";
    return c;
  },
  // 4b. Type-mismatched reference — page item retyped as a quiz (object still exists).
  typeMismatchRef: (c: CourseProject) => {
    const module = c.modules.find((m) => m.items.some((item) => item.type === "page"))!;
    module.items.find((item) => item.type === "page")!.type = "quiz";
    return c;
  },
  // 4c. Module-object drift — module item stayed in place but the underlying object's moduleId
  // points elsewhere, which causes planning/export confusion.
  moduleObjectDrift: (c: CourseProject) => {
    const module = c.modules.find((m) => m.items.some((item) => item.type === "assignment"))!;
    const item = module.items.find((entry) => entry.type === "assignment")!;
    const otherModule = c.modules.find((candidate) => candidate.id !== module.id && candidate.kind === "content")!;
    c.assignments = c.assignments.map((assignment) => (assignment.id === item.refId ? { ...assignment, moduleId: otherModule.id } : assignment));
    return c;
  },
  // 5a. Unsafe element the broadened detector now catches (a <form>, which the old regex missed).
  unsafeForm: (c: CourseProject) => {
    c.pages[c.pages.length - 1].bodyHtml += `<form action="/x"><input name="y"></form>`;
    return c;
  },
  // 5b. Unsafe markup inside a quiz question (now scanned).
  unsafeQuestion: (c: CourseProject) => {
    c.quizzes[0].questions[0].stem += `<script>alert(1)</script>`;
    return c;
  },
  // 6a. Unbalanced gradebook weights.
  unbalancedWeights: (c: CourseProject) => {
    c.assignmentGroups[0].weight = 10;
    return c;
  },
  // 6b. Negative weight that still sums to 100 (passes the total check, fails the bounds check).
  negativeWeight: (c: CourseProject) => {
    const original = c.assignmentGroups[0].weight;
    c.assignmentGroups[0].weight = -20;
    c.assignmentGroups[1].weight += original + 20;
    return c;
  },
  // 7. Hollow Start Here — orientation pages removed, module kept non-empty.
  hollowStartHere: (c: CourseProject) => {
    const start = c.modules.find((m) => m.kind === "start")!;
    start.items = start.items.filter((item) => item.type === "discussion");
    return c;
  },
  // 8. Shallow objectives — thin, non-measurable outcome text.
  shallowObjectives: (c: CourseProject) => {
    c.outcomes.forEach((outcome) => {
      outcome.text = "things";
    });
    return c;
  }
};

const goodCourses: Array<{ name: string; course: CourseProject }> = [
  { name: "sample project", course: sampleProject },
  {
    name: "4-week community health",
    course: generateCourseProject({
      prompt: "Build me a 4-week professional course on Community Health Program Design.",
      settings: { ...defaultSettings, courseLengthPreset: "4-weeks", lengthWeeks: 4, moduleCount: 4, organizationPattern: "weeks", assignmentCadence: "every-module" }
    })
  },
  {
    name: "8-module museum planning",
    course: generateCourseProject({
      prompt: "Build me an 8-module course on Museum Exhibit Planning with quizzes and discussions.",
      settings: { ...defaultSettings, courseLengthPreset: "8-weeks", lengthWeeks: 8, moduleCount: 8, quizFrequency: "module", discussionFrequency: "module" }
    })
  }
];

describe("readiness depth", () => {
  it("rates genuinely good generated courses as import-ready (no false positives)", () => {
    goodCourses.forEach(({ name, course }) => {
      const result = report(course);
      expect(result.blockers, `${name} blockers`).toBe(0);
      expect(result.score, `${name} score`).toBeGreaterThanOrEqual(95);
      // The deepened checks all pass on a real course.
      ["empty-content", "content-module-depth", "rubric-depth", "reference-integrity", "accessibility", "weight-bounds", "start-here-content", "objective-quality"].forEach((id) => {
        expect(checkOf(course, id)?.passed, `${name} ${id}`).toBe(true);
      });
    });
  });

  it("flags empty content blocks", () => {
    const c = degraders.emptyContent(clone(sampleProject));
    expect(failed(c, "empty-content")).toBe(true);
    expect(report(c).blockers).toBeGreaterThan(0);
    expect(report(c).score).toBeLessThan(report(sampleProject).score);
  });

  it("flags an empty module", () => {
    const c = degraders.emptyModule(clone(sampleProject));
    expect(failed(c, "module-not-empty")).toBe(true);
    expect(report(c).blockers).toBeGreaterThan(0);
  });

  it("flags a hollow module that the old overview/recap boundary check would still pass", () => {
    const c = degraders.hollowModule(clone(sampleProject));
    // Bookends remain, so the shallow boundary check passes...
    expect(checkOf(c, "module-boundaries")?.passed).toBe(true);
    // ...but the deeper learning-path check catches the missing middle.
    expect(failed(c, "content-module-depth")).toBe(true);
  });

  it("flags shallow rubrics and missing rubric references", () => {
    const stripped = degraders.stripRubricCriteria(clone(sampleProject));
    expect(failed(stripped, "rubric-depth")).toBe(true);

    const unreferenced = degraders.removeRubricRefs(clone(sampleProject));
    expect(failed(unreferenced, "rubrics")).toBe(true);
  });

  it("flags a dangling reference and a type-mismatched reference the old check would miss", () => {
    const dangling = degraders.danglingItemRef(clone(sampleProject));
    expect(failed(dangling, "module-refs")).toBe(true);
    expect(failed(dangling, "reference-integrity")).toBe(true);

    const mismatch = degraders.typeMismatchRef(clone(sampleProject));
    // The referenced object still exists, so the existence-only check passes...
    expect(checkOf(mismatch, "module-refs")?.passed).toBe(true);
    // ...but reference-integrity catches that the item type disagrees with the object kind.
    expect(failed(mismatch, "reference-integrity")).toBe(true);
  });

  it("flags module items whose referenced object belongs to a different module", () => {
    const drifted = degraders.moduleObjectDrift(clone(sampleProject));
    expect(failed(drifted, "module-object-alignment")).toBe(true);
    expect(report(drifted).blockers).toBeGreaterThan(0);
  });

  it("flags unsafe HTML in bodies and quiz questions, including elements the old regex missed", () => {
    const form = degraders.unsafeForm(clone(sampleProject));
    expect(failed(form, "accessibility")).toBe(true);

    const question = degraders.unsafeQuestion(clone(sampleProject));
    expect(failed(question, "accessibility")).toBe(true);
  });

  it("flags missing and malformed gradebook weights", () => {
    const unbalanced = degraders.unbalancedWeights(clone(sampleProject));
    expect(failed(unbalanced, "weights")).toBe(true);

    const negative = degraders.negativeWeight(clone(sampleProject));
    // Total still rounds to 100, so the legacy total check passes...
    expect(checkOf(negative, "weights")?.passed).toBe(true);
    // ...but the bounds check rejects a negative weight.
    expect(failed(negative, "weight-bounds")).toBe(true);
  });

  it("flags a Start Here module missing orientation content", () => {
    const c = degraders.hollowStartHere(clone(sampleProject));
    expect(checkOf(c, "module-not-empty")?.passed).toBe(true);
    expect(failed(c, "start-here-content")).toBe(true);
  });

  it("flags shallow objectives", () => {
    const c = degraders.shallowObjectives(clone(sampleProject));
    expect(failed(c, "objective-quality")).toBe(true);
    expect(failed(c, "objective-measurable")).toBe(true);
  });

  it("tracks real course quality: readiness falls in step with the quality scorer as a course degrades", () => {
    const steps = [
      degraders.emptyContent,
      degraders.hollowModule,
      degraders.stripRubricCriteria,
      degraders.danglingItemRef,
      degraders.unsafeForm,
      degraders.unbalancedWeights,
      degraders.hollowStartHere,
      degraders.shallowObjectives
    ];
    let course = clone(sampleProject);
    const ladder = [course];
    for (const degrade of steps) {
      course = degrade(clone(course));
      ladder.push(course);
    }

    const readinessScores = ladder.map((entry) => buildReadinessReport(entry).score);
    const qualityScores = ladder.map((entry) => buildCourseQualityReport(entry).score);
    const blockerCounts = ladder.map((entry) => buildReadinessReport(entry).blockers);

    // Pristine: both scorers rate it highly and it is import-ready.
    expect(readinessScores[0]).toBeGreaterThanOrEqual(95);
    expect(qualityScores[0]).toBeGreaterThanOrEqual(95);
    expect(blockerCounts[0]).toBe(0);

    // Each cumulative degradation never raises either score, adds blockers monotonically, and the
    // two independent scorers stay within a quarter-scale of each other — they track, not diverge.
    for (let i = 1; i < ladder.length; i += 1) {
      expect(readinessScores[i], `readiness step ${i}`).toBeLessThanOrEqual(readinessScores[i - 1]);
      expect(qualityScores[i], `quality step ${i}`).toBeLessThanOrEqual(qualityScores[i - 1]);
      expect(blockerCounts[i], `blockers step ${i}`).toBeGreaterThanOrEqual(blockerCounts[i - 1]);
      expect(Math.abs(readinessScores[i] - qualityScores[i]), `score gap step ${i}`).toBeLessThanOrEqual(25);
    }

    // The fully degraded course is clearly not ready, and both scorers agree it is poor.
    expect(readinessScores[readinessScores.length - 1]).toBeLessThan(75);
    expect(qualityScores[qualityScores.length - 1]).toBeLessThan(75);
    expect(blockerCounts[blockerCounts.length - 1]).toBeGreaterThanOrEqual(7);

    // Readiness and quality move together rather than diverging: every step's drop is mirrored.
    const readinessDrop = readinessScores[0] - readinessScores[readinessScores.length - 1];
    const qualityDrop = qualityScores[0] - qualityScores[qualityScores.length - 1];
    expect(readinessDrop).toBeGreaterThan(25);
    expect(qualityDrop).toBeGreaterThan(25);
  });
});
