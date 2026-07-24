// @vitest-environment jsdom
//
// Smoke + content-invariance suite: every prototype experience mounts over the
// REAL deterministic sample course (via the CourseAdapter) and is driven
// through all 12 shared context pointers. The switching contract is asserted
// mechanically: mounting, navigating, and switching call updateCourse ZERO
// times and leave the course JSON byte-identical. A widget commit is then
// proven to flow through updateCourse exactly once.

import { describe, expect, it } from "vitest";
import { sampleProject } from "../services/courseGenerator";
import type { CourseProject } from "../types";
import { createCourseAdapter } from "./courseAdapter";
import { getBindTarget } from "./prototypes/shared/blocks.js";

const CONCEPTS = [
  "guided", "blueprint", "map", "partner", "tasks", "storyboard", "modes", "wildcard",
] as const;

interface Harness {
  course: CourseProject;
  updateCalls: number;
  adapter: ReturnType<typeof createCourseAdapter>;
}

function makeHarness(): Harness {
  const hz: Harness = {
    course: {
      ...JSON.parse(JSON.stringify(sampleProject)),
      id: `smoke-${Math.random().toString(36).slice(2, 8)}`,
    },
    updateCalls: 0,
    adapter: undefined as unknown as ReturnType<typeof createCourseAdapter>,
  };
  hz.adapter = createCourseAdapter({
    getCourse: () => hz.course,
    updateCourse: updater => {
      hz.updateCalls += 1;
      hz.course = updater(hz.course);
      hz.adapter.refresh(hz.course);
    },
    target: getBindTarget(),
  });
  hz.adapter.refresh(hz.course);
  return hz;
}

const hostCtx = () => ({
  go: () => {},
  toast: () => {},
  drawer: () => ({ close: () => {} }),
  onReady: () => {},
});

describe("experience smoke + switching invariance (real course)", () => {
  for (const name of CONCEPTS) {
    it(`${name}: mounts over the real course, runs all 12 pointers, never touches content`, async () => {
      const hz = makeHarness();
      const before = JSON.stringify(hz.course);
      const mod = await import(/* @vite-ignore */ `./prototypes/concepts/${name}.js`);
      const stage = document.createElement("div");
      document.body.appendChild(stage);
      const api = mod.mount(stage, hostCtx());
      expect(stage.children.length).toBeGreaterThan(0);
      for (let t = 1; t <= 12; t += 1) {
        expect(() => api.goToTask?.(t)).not.toThrow();
      }
      // The contract: presentation and navigation NEVER mutate the course.
      expect(hz.updateCalls).toBe(0);
      expect(JSON.stringify(hz.course)).toBe(before);
      hz.adapter.dispose();
      stage.remove();
    });
  }

  it("cycling through all eight experiences leaves the course byte-identical", async () => {
    const hz = makeHarness();
    const before = JSON.stringify(hz.course);
    for (const name of CONCEPTS) {
      const mod = await import(/* @vite-ignore */ `./prototypes/concepts/${name}.js`);
      const stage = document.createElement("div");
      document.body.appendChild(stage);
      mod.mount(stage, hostCtx()).goToTask?.(6);
      stage.remove();
    }
    expect(hz.updateCalls).toBe(0);
    expect(JSON.stringify(hz.course)).toBe(before);
    expect(hz.course.status).toBe(JSON.parse(before).status);
    expect(hz.course.updatedAt).toBe(JSON.parse(before).updatedAt);
    hz.adapter.dispose();
  });

  it("a widget commit flows through updateCourse exactly once and survives a refresh", () => {
    const hz = makeHarness();
    const target = getBindTarget();
    const s = target.session as Record<string, any>;
    const pageId = Object.keys(s.pages)[0];
    s.pages[pageId].title = "Committed From Experience";
    s.commit?.();
    expect(hz.updateCalls).toBe(1);
    expect(hz.course.pages.find(p => p.id === pageId)?.title).toBe("Committed From Experience");
    // and the facade still agrees after a fresh refresh
    hz.adapter.refresh(hz.course);
    expect(s.pages[pageId].title).toBe("Committed From Experience");
    hz.adapter.dispose();
  });
});
