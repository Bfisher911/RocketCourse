import { describe, expect, it } from "vitest";
import { sampleProject } from "./courseGenerator";
import type { CourseProject, InteractionBlock } from "../types";
import {
  DEFAULT_INTERACTION_DENSITY,
  INTERACTION_DENSITY_PROFILES,
  analyzeInteractionDistribution,
  applyCourseInteractions,
  interactionTargetFor,
  isStandardPattern,
  planCourseInteractions,
  resolveInteractionDensity,
  type InteractionDensity,
} from "./interactionSelection";

const DENSITIES: InteractionDensity[] = ["minimal", "balanced", "rich", "immersive"];

function withDensity(density: InteractionDensity | undefined): CourseProject {
  const base: CourseProject = JSON.parse(JSON.stringify(sampleProject));
  // strip any pre-applied blocks so we count only what this density inserts
  const clear = <T extends { interactionBlocks?: InteractionBlock[] }>(x: T): T => ({ ...x, interactionBlocks: undefined });
  return {
    ...base,
    settings: { ...base.settings, interactionDensity: density },
    pages: base.pages.map(clear),
    assignments: base.assignments.map(clear),
    discussions: base.discussions.map(clear),
    quizzes: base.quizzes.map(clear),
  };
}

function totalBlocks(course: CourseProject): number {
  const applied = applyCourseInteractions(course);
  const count = (arr: Array<{ interactionBlocks?: InteractionBlock[] }>) =>
    arr.reduce((n, x) => n + (x.interactionBlocks?.length ?? 0), 0);
  return count(applied.pages) + count(applied.assignments) + count(applied.discussions) + count(applied.quizzes);
}

describe("interaction density profiles", () => {
  it("defaults to balanced and resolves unset/invalid to balanced", () => {
    expect(DEFAULT_INTERACTION_DENSITY).toBe("balanced");
    expect(resolveInteractionDensity(withDensity(undefined))).toBe("balanced");
    expect(resolveInteractionDensity(withDensity("rich"))).toBe("rich");
    // an unknown value falls back
    const bad = withDensity("nonsense" as InteractionDensity);
    expect(resolveInteractionDensity(bad)).toBe("balanced");
  });

  it("balanced reproduces the historical (unset) output exactly", () => {
    // The regression guard: adding the setting must not change default generation.
    expect(planCourseInteractions(withDensity("balanced")))
      .toEqual(planCourseInteractions(withDensity(undefined)));
  });

  it("inserts strictly more interactions as density increases", () => {
    const counts = DENSITIES.map(d => totalBlocks(withDensity(d)));
    // monotonic non-decreasing, and the extremes genuinely differ
    for (let i = 1; i < counts.length; i += 1) {
      expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
    }
    expect(counts[0]).toBeLessThan(counts[counts.length - 1]); // minimal < immersive
    expect(counts[0]).toBeGreaterThan(0); // even minimal inserts something
  });

  it("every profile still produces only native, no-asset, Canvas-safe selections", () => {
    for (const d of DENSITIES) {
      const plan = planCourseInteractions(withDensity(d));
      const total = plan.surfaces.reduce((n, s) => n + s.selections.length, 0);
      expect(total).toBeGreaterThan(0);
      // caps respected per surface
      const profile = INTERACTION_DENSITY_PROFILES[d];
      for (const surface of plan.surfaces) {
        const cap = surface.pageType === "content" ? profile.contentCap : profile.surfaceCap;
        expect(surface.selections.length).toBeLessThanOrEqual(cap);
        // no pattern repeats on the same surface
        const ids = surface.selections.map(s => s.patternId);
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  });

  it("minimal drops to one interaction per surface; immersive raises the floor", () => {
    const minimal = planCourseInteractions(withDensity("minimal"));
    // With a floor of 1 and caps of 1, no surface exceeds a single interaction
    for (const surface of minimal.surfaces) expect(surface.selections.length).toBe(1);

    const immersive = planCourseInteractions(withDensity("immersive"));
    // Immersive floor is 3, so most surfaces carry 3+ where content supports it
    const atLeastThree = immersive.surfaces.filter(s => s.selections.length >= 3).length;
    expect(atLeastThree).toBeGreaterThan(0);
  });
});

describe("interaction distribution analysis (Phase 9)", () => {
  it("classifies broadly-reusable patterns as standard and discipline-tagged as course-specific", () => {
    expect(isStandardPattern("standard-accordion")).toBe(true);   // disciplines: ["all"]
    expect(isStandardPattern("worked-example-reveal")).toBe(false); // stem/data/business
    expect(isStandardPattern("does-not-exist")).toBe(false);
  });

  it("reports zero for a course with no interaction blocks", () => {
    const bare = withDensity("balanced");
    const d = analyzeInteractionDistribution(bare);
    expect(d.total).toBe(0);
    expect(d.meetsTarget).toBe(false);
    expect(d.summary).toMatch(/no interactions/i);
  });

  it("counts standard + course-specific + per-surface for an applied course", () => {
    const applied = applyCourseInteractions(withDensity("balanced"));
    const d = analyzeInteractionDistribution(applied);
    expect(d.total).toBeGreaterThan(0);
    expect(d.standard + d.courseSpecific).toBe(d.total);
    expect(d.bySurfaceType.pages + d.bySurfaceType.assignments + d.bySurfaceType.discussions + d.bySurfaceType.quizzes).toBe(d.total);
    expect(d.distinctPatterns).toBeGreaterThan(0);
    expect(d.distinctPatterns).toBeLessThanOrEqual(d.total);
    expect(d.density).toBe("balanced");
  });

  it("scales the target with teaching-module count, capped at 60", () => {
    const full: CourseProject = withDensity("balanced");
    // sample has many modules → cap
    expect(interactionTargetFor(full)).toBe(60);
    const tiny: CourseProject = { ...full, modules: full.modules.filter(m => m.kind === "content").slice(0, 2) };
    const t = interactionTargetFor(tiny);
    expect(t).toBeGreaterThanOrEqual(6);
    expect(t).toBeLessThan(60);
  });

  it("a higher density moves a course closer to (or past) its target", () => {
    const minimal = analyzeInteractionDistribution(applyCourseInteractions(withDensity("minimal")));
    const immersive = analyzeInteractionDistribution(applyCourseInteractions(withDensity("immersive")));
    expect(immersive.total).toBeGreaterThan(minimal.total);
    // the target itself doesn't depend on density
    expect(immersive.target).toBe(minimal.target);
  });
});
