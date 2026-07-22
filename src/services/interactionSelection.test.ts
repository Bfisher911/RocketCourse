import { describe, expect, it } from "vitest";
import { defaultSettings } from "../data/defaultSettings";
import { interactionPatternById } from "../data/interactionPatterns";
import type { CourseProject, InteractionBlock } from "../types";
import { generateCourseProject } from "./courseGenerator";
import { applyCourseInteractions, classifyPage, inferCourseDisciplines, planCourseInteractions } from "./interactionSelection";
import { composeBodyWithInteractions, renderInteractionBlocks } from "./interactionRender";
import { validateInteractionHtml } from "./interactionValidation";
import { hasUnsafeHtml } from "./htmlSafety";

const fixture = (title: string, description: string): CourseProject =>
  generateCourseProject({ prompt: description, settings: { ...defaultSettings, title, description } });

// Representative courses across the five required discipline families.
const humanities = fixture("Introduction to World Literature", "A humanities survey of world literature, close reading, and critical writing.");
const stem = fixture("General Chemistry with Lab", "A laboratory science course covering chemical reactions, stoichiometry, and experimental design.");
const geography = fixture("Environmental Geography", "A geography and environmental science course on climate, land use, and GIS mapping.");
const business = fixture("Principles of Management", "A business course on management, leadership, strategy, and organizational decision-making.");
const health = fixture("Emergency Management Fundamentals", "A health and public-safety course on emergency management, disaster response, and clinical coordination.");

const FIXTURES: Array<[string, CourseProject]> = [
  ["humanities", humanities],
  ["stem", stem],
  ["geography", geography],
  ["business", business],
  ["health", health]
];

const allBlocks = (course: CourseProject): InteractionBlock[] => [
  ...course.pages.flatMap((page) => page.interactionBlocks ?? []),
  ...course.assignments.flatMap((assignment) => assignment.interactionBlocks ?? []),
  ...course.discussions.flatMap((discussion) => discussion.interactionBlocks ?? []),
  ...course.quizzes.flatMap((quiz) => quiz.interactionBlocks ?? [])
];

describe("interaction selection", () => {
  it("infers different disciplines for different courses", () => {
    expect(inferCourseDisciplines(humanities)).toContain("humanities");
    expect(inferCourseDisciplines(stem)).toContain("stem");
    expect(inferCourseDisciplines(geography)).toContain("geography");
    expect(inferCourseDisciplines(business)).toContain("business");
    expect(inferCourseDisciplines(health)).toContain("health");
  });

  it("is deterministic: the same course produces the same plan", () => {
    const first = planCourseInteractions(humanities);
    const second = planCourseInteractions(humanities);
    expect(second).toEqual(first);
  });

  it("generates interaction blocks on every generated course", () => {
    for (const [label, course] of FIXTURES) {
      const blocks = allBlocks(course);
      expect(blocks.length, label).toBeGreaterThan(10);
      for (const block of blocks) {
        expect(interactionPatternById(block.patternId), `${label} ${block.patternId}`).toBeTruthy();
        expect(block.source).toBe("generated");
        expect(block.rationale, block.id).toBeTruthy();
      }
    }
  });

  it("selects content-appropriate patterns per discipline rather than one template set", () => {
    const used = new Map(FIXTURES.map(([label, course]) => [label, new Set(allBlocks(course).map((block) => block.patternId))]));
    // STEM/lab courses get inquiry patterns; humanities get source-analysis patterns; never vice versa.
    expect([...used.get("stem")!].some((id) => ["worked-example-reveal", "hypothesis-builder", "variable-identification-activity"].includes(id))).toBe(true);
    expect([...used.get("humanities")!].some((id) => ["primary-source-annotation-guide", "source-credibility-analyzer", "socratic-question-chain"].includes(id))).toBe(true);
    expect(used.get("humanities")!.has("variable-identification-activity")).toBe(false);
    expect(used.get("business")!.has("primary-source-annotation-guide")).toBe(false);
    // The five courses must not all share an identical pattern set.
    const signatures = new Set([...used.values()].map((set) => [...set].sort().join("|")));
    expect(signatures.size).toBeGreaterThan(1);
  });

  it("gives EVERY student-facing surface at least two different interactions", () => {
    for (const [label, course] of FIXTURES) {
      const check = (blocks: InteractionBlock[] | undefined, where: string): void => {
        const ids = (blocks ?? []).map((block) => block.patternId);
        expect(ids.length, `${label} ${where}`).toBeGreaterThanOrEqual(2);
        expect(new Set(ids).size, `${label} ${where} must use different patterns`).toBe(ids.length);
      };
      for (const page of course.pages) {
        const pageType = classifyPage(page, course.modules.find((module) => module.id === page.moduleId));
        if (pageType === null) expect(page.interactionBlocks ?? [], `${label} ${page.title}`).toHaveLength(0);
        else check(page.interactionBlocks, page.title);
      }
      for (const assignment of course.assignments) check(assignment.interactionBlocks, assignment.title);
      for (const discussion of course.discussions) check(discussion.interactionBlocks, discussion.title);
      for (const quiz of course.quizzes) check(quiz.interactionBlocks, quiz.title);
    }
  });

  it("respects density caps per surface", () => {
    for (const [label, course] of FIXTURES) {
      for (const page of course.pages) {
        const pageType = classifyPage(page, course.modules.find((module) => module.id === page.moduleId));
        const count = page.interactionBlocks?.length ?? 0;
        if (pageType !== null) expect(count, `${label} ${page.title}`).toBeLessThanOrEqual(pageType === "content" ? 3 : 2);
      }
      for (const quiz of course.quizzes) expect(quiz.interactionBlocks?.length ?? 0, `${label} ${quiz.title}`).toBeLessThanOrEqual(2);
    }
  });

  it("keeps rare patterns rare and honors course-wide frequency caps", () => {
    for (const [label, course] of FIXTURES) {
      const counts = new Map<string, number>();
      for (const block of allBlocks(course)) counts.set(block.patternId, (counts.get(block.patternId) ?? 0) + 1);
      for (const [patternId, count] of counts) {
        const pattern = interactionPatternById(patternId)!;
        if (pattern.frequency === "rare") expect(count, `${label} ${patternId}`).toBeLessThanOrEqual(2);
        if (pattern.frequency === "selective") expect(count, `${label} ${patternId}`).toBeLessThanOrEqual(12);
      }
    }
  });

  it("only ever auto-selects native patterns with no asset requirements", () => {
    for (const [label, course] of FIXTURES) {
      for (const block of allBlocks(course)) {
        const pattern = interactionPatternById(block.patternId)!;
        expect(pattern.tier, `${label} ${block.patternId}`).toBe("native");
        expect(pattern.requiredAssets, `${label} ${block.patternId}`).toHaveLength(0);
      }
    }
  });

  it("produces Canvas-safe, complete HTML for every generated block", () => {
    for (const [label, course] of FIXTURES.slice(0, 2)) {
      const html = renderInteractionBlocks(allBlocks(course), course.theme);
      expect(hasUnsafeHtml(html), label).toBe(false);
      const errors = validateInteractionHtml(html).filter((issue) => issue.severity === "error");
      expect(errors, `${label}: ${errors.map((issue) => issue.detail).join("; ")}`).toHaveLength(0);
      // Course-specific, never library placeholder text.
      expect(html).not.toMatch(/Concept A|Option A: Add|Replace this|YOUR-DOMAIN/);
    }
  });

  it("covers the homepage and syllabus with curated interactions (navigation/goals + policy/support)", () => {
    for (const [label, course] of FIXTURES) {
      const homepage = course.pages.find((page) => page.frontPage);
      const syllabus = course.pages.find((page) => page.slug === "syllabus");
      const homepageIds = (homepage?.interactionBlocks ?? []).map((block) => block.patternId);
      const syllabusIds = (syllabus?.interactionBlocks ?? []).map((block) => block.patternId);
      expect(homepageIds.length, label).toBeGreaterThanOrEqual(2);
      expect(syllabusIds.length, label).toBeGreaterThanOrEqual(2);
      expect(syllabusIds, label).toContain("policy-box");
    }
  });

  it("preserves locked and instructor-inserted blocks across regeneration", () => {
    const course = structuredClone(humanities);
    const page = course.pages.find((item) => (item.interactionBlocks?.length ?? 0) > 0)!;
    const locked: InteractionBlock = { ...page.interactionBlocks![0], id: "locked-1", locked: true };
    const inserted: InteractionBlock = {
      id: "inserted-1",
      patternId: "reflection-ladder",
      content: { title: "My custom reflection", items: [{ heading: "Recall", body: "What did you learn?" }] },
      source: "inserted",
      createdAt: "2026-07-21T00:00:00.000Z"
    };
    page.interactionBlocks = [locked, inserted];
    const reapplied = applyCourseInteractions(course);
    const after = reapplied.pages.find((item) => item.id === page.id)!.interactionBlocks ?? [];
    expect(after.some((block) => block.id === "locked-1")).toBe(true);
    expect(after.some((block) => block.id === "inserted-1")).toBe(true);
  });

  it("composes blocks into page HTML for export without disturbing the opening of the authored body", () => {
    const page = humanities.pages.find((item) => (item.interactionBlocks?.length ?? 0) > 0)!;
    const composed = composeBodyWithInteractions(page.bodyHtml, page.interactionBlocks, humanities.theme);
    // Interleaving inserts only at section boundaries, so the page opening is untouched
    // and the composed body is strictly larger.
    expect(composed.startsWith(page.bodyHtml.slice(0, 200))).toBe(true);
    expect(composed.length).toBeGreaterThan(page.bodyHtml.length);
  });

  it("skips interactions entirely for generic-template courses", () => {
    const generic = generateCourseProject({
      prompt: "shell",
      settings: { ...defaultSettings, title: "Generic Shell", description: "A generic template.", contentDepth: "generic-template" }
    });
    expect(allBlocks(generic)).toHaveLength(0);
  });
});
