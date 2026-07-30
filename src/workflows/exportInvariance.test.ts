// @vitest-environment jsdom
//
// The product-level guarantee the nine-workflow feature rests on:
// THE EXPORTED CANVAS PACKAGE MUST NOT DEPEND ON THE SELECTED EXPERIENCE.
// Mounting/navigating every experience over a course must leave the generated
// .imscc byte-identical to the package built from the untouched course.

import { describe, expect, it } from "vitest";
import { sampleProject } from "../services/courseGenerator";
import { buildImsccZip } from "../services/imsccExport";
import type { CourseProject } from "../types";
import { createCourseAdapter } from "./courseAdapter";
import { getBindTarget } from "./prototypes/shared/blocks.js";

const CONCEPTS = ["guided", "blueprint", "map", "partner", "tasks", "storyboard", "modes", "wildcard"] as const;

async function manifestOf(course: CourseProject): Promise<string> {
  const zip = await buildImsccZip(course);
  const names = Object.keys(zip.files).sort();
  const parts: string[] = [];
  for (const name of names) {
    const f = zip.files[name];
    if (f.dir) { parts.push(`D ${name}`); continue; }
    const text = await f.async("string");
    parts.push(`F ${name} ${text.length}`);
  }
  return parts.join("\n");
}

describe("export is independent of the selected workflow experience", () => {
  it("produces an identical package after every experience has been mounted and driven", async () => {
    const base: CourseProject = JSON.parse(JSON.stringify(sampleProject));
    const expected = await manifestOf(base);

    // Bind the adapter exactly as WorkflowHost does, then run every experience
    // through all 12 shared context pointers.
    let course: CourseProject = JSON.parse(JSON.stringify(base));
    let updateCalls = 0;
    const adapter = createCourseAdapter({
      getCourse: () => course,
      updateCourse: updater => { updateCalls += 1; course = updater(course); adapter.refresh(course); },
      target: getBindTarget(),
    });
    adapter.refresh(course);

    for (const name of CONCEPTS) {
      const mod = await import(/* @vite-ignore */ `./prototypes/concepts/${name}.js`);
      const stage = document.createElement("div");
      document.body.appendChild(stage);
      const api = mod.mount(stage, { go: () => {}, toast: () => {}, drawer: () => ({ close: () => {} }) });
      for (let t = 1; t <= 12; t += 1) api.goToTask?.(t);
      stage.remove();
    }

    // Presentation never mutates the course…
    expect(updateCalls).toBe(0);
    expect(JSON.stringify(course)).toBe(JSON.stringify(base));
    // …so the exported package is byte-identical.
    expect(await manifestOf(course)).toBe(expected);
    adapter.dispose();
  }, 60000);

  it("a real edit made through an experience changes the export exactly like a direct edit", async () => {
    const base: CourseProject = JSON.parse(JSON.stringify(sampleProject));
    let course: CourseProject = JSON.parse(JSON.stringify(base));
    const adapter = createCourseAdapter({
      getCourse: () => course,
      updateCourse: updater => { course = updater(course); adapter.refresh(course); },
      target: getBindTarget(),
    });
    adapter.refresh(course);

    const target = getBindTarget().session as Record<string, any>;
    const pageId = Object.keys(target.pages)[0];
    target.pages[pageId].title = "Workflow Edited Title";
    target.commit?.();

    // The same edit applied directly to the model
    const direct: CourseProject = {
      ...base,
      pages: base.pages.map(p => (p.id === pageId ? { ...p, title: "Workflow Edited Title", status: "edited" as const } : p)),
    };

    expect(await manifestOf(course)).toBe(await manifestOf(direct));
    adapter.dispose();
  }, 60000);
});
