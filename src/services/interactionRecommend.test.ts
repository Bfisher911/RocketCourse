import { describe, expect, it } from "vitest";
import { sampleProject } from "./courseGenerator";
import type { CourseProject } from "../types";
import {
  buildEditorSampleContent,
  INSERTABLE_PATTERNS,
  recommendCoverageGaps,
  recommendInteractionsForItem,
} from "./interactionSelection";
import { interactionPatternById } from "../data/interactionPatterns";

const clone = (c: CourseProject = sampleProject): CourseProject => JSON.parse(JSON.stringify(c));
const insertableIds = new Set(INSERTABLE_PATTERNS.map(p => p.id));

// A page that classifies as real content and carries some existing interactions.
function aContentPage(course: CourseProject) {
  return course.pages.find(p => (p.interactionBlocks?.length ?? 0) > 0) ?? course.pages[0];
}

describe("recommendInteractionsForItem (Phase 8 — deterministic)", () => {
  it("returns positive-scored, buildable, in-catalogue suggestions with reasons", () => {
    const course = clone();
    const page = aContentPage(course);
    const recs = recommendInteractionsForItem(course, "page", page.id, 3);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.length).toBeLessThanOrEqual(3);
    for (const r of recs) {
      expect(r.score).toBeGreaterThan(0);
      expect(insertableIds.has(r.patternId)).toBe(true);
      expect(r.reasons.length).toBeGreaterThan(0);
      // every suggestion inserts real, course-aware content — never a shell
      expect(buildEditorSampleContent(r.patternId, course)).toBeTruthy();
      expect(interactionPatternById(r.patternId)).toBeTruthy();
    }
    // ranked descending
    for (let i = 1; i < recs.length; i += 1) expect(recs[i - 1].score).toBeGreaterThanOrEqual(recs[i].score);
  });

  it("is deterministic — identical input yields identical output", () => {
    const course = clone();
    const page = aContentPage(course);
    const a = recommendInteractionsForItem(course, "page", page.id, 5);
    const b = recommendInteractionsForItem(clone(), "page", page.id, 5);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("never re-suggests a pattern already on the item (complements, not duplicates)", () => {
    const course = clone();
    const page = aContentPage(course);
    const present = new Set((page.interactionBlocks ?? []).map(b => b.patternId));
    const recs = recommendInteractionsForItem(course, "page", page.id, 20);
    for (const r of recs) expect(present.has(r.patternId)).toBe(false);
  });

  it("adding a recommended pattern removes it from the next round's suggestions", () => {
    const course = clone();
    const page = aContentPage(course);
    const top = recommendInteractionsForItem(course, "page", page.id, 1)[0];
    expect(top).toBeTruthy();
    // simulate inserting it
    const target = course.pages.find(p => p.id === page.id)!;
    target.interactionBlocks = [...(target.interactionBlocks ?? []), {
      id: "blk-test-" + top.patternId, patternId: top.patternId,
      content: buildEditorSampleContent(top.patternId, course)!, source: "inserted", createdAt: course.updatedAt,
    }];
    const next = recommendInteractionsForItem(course, "page", page.id, 20);
    expect(next.some(r => r.patternId === top.patternId)).toBe(false);
  });

  it("respects the limit and returns [] for an unknown item", () => {
    const course = clone();
    const page = aContentPage(course);
    expect(recommendInteractionsForItem(course, "page", page.id, 2).length).toBeLessThanOrEqual(2);
    expect(recommendInteractionsForItem(course, "page", "no-such-id", 3)).toEqual([]);
    expect(recommendInteractionsForItem(course, "quiz", "no-such-id", 3)).toEqual([]);
  });

  it("recommends surface-appropriate patterns (top pick fits the item's page type)", () => {
    const course = clone();
    // a discussion surface → top suggestion should be valid on a discussion
    const discussion = course.discussions[0];
    if (discussion) {
      const recs = recommendInteractionsForItem(course, "discussion", discussion.id, 3);
      expect(recs.length).toBeGreaterThan(0);
      expect(interactionPatternById(recs[0].patternId)!.pageTypes).toContain("discussion");
    }
  });
});

describe("recommendCoverageGaps (Phase 8 — course-level, read-only)", () => {
  it("does not mutate the course", () => {
    const course = clone();
    const before = JSON.stringify(course);
    recommendCoverageGaps(course);
    expect(JSON.stringify(course)).toBe(before);
  });

  it("only reports surfaces below the density floor, worst-first, each with a valid pick", () => {
    // strip every interaction so all eligible surfaces are under-served
    const course = clone();
    for (const list of [course.pages, course.assignments, course.discussions, course.quizzes]) {
      for (const item of list as Array<{ interactionBlocks?: unknown }>) item.interactionBlocks = undefined;
    }
    const gaps = recommendCoverageGaps(course, 50);
    expect(gaps.length).toBeGreaterThan(0);
    for (const g of gaps) {
      expect(g.count).toBeLessThan(g.floor);
      if (g.topPick) expect(insertableIds.has(g.topPick.patternId)).toBe(true);
    }
    // worst-first ordering by deficit
    for (let i = 1; i < gaps.length; i += 1) {
      expect(gaps[i - 1].count - gaps[i - 1].floor).toBeLessThanOrEqual(gaps[i].count - gaps[i].floor);
    }
  });
});
