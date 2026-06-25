import { describe, expect, it } from "vitest";
import { defaultSettings } from "../data/defaultSettings";
import { generateCourseProject } from "./courseGenerator";
import { buildImsccZip } from "./imsccExport";

const build = (moduleHeaderImages: boolean) =>
  generateCourseProject({
    prompt: "A four-week introductory course.",
    settings: {
      ...defaultSettings,
      moduleCount: 4,
      lengthWeeks: 4,
      imageSettings: { ...defaultSettings.imageSettings, moduleHeaderImages }
    }
  });

describe("per-module header images (imageSettings.moduleHeaderImages)", () => {
  it("writes one header SVG per CONTENT module, references it on the overview page, and registers the asset — when ON", async () => {
    const course = build(true);
    const zip = await buildImsccZip(course);
    // Only content modules (id "module_<N>") get headers — not Start Here / Final / Instructor.
    const contentNumbers = course.modules
      .map((module) => /^module_(\d+)$/.exec(module.id)?.[1])
      .filter((value): value is string => value !== undefined)
      .map(Number);
    expect(contentNumbers.length).toBeGreaterThanOrEqual(4);

    for (const n of contentNumbers) {
      const svg = await zip.file(`web_resources/module-${n}-header.svg`)?.async("text");
      expect(svg, `module-${n}-header.svg present`).toBeTruthy();
      expect(svg, `module-${n}-header.svg is an svg`).toContain("<svg");
      expect(svg).toContain(`>${n}<`); // the module-number monogram
    }
    // Overview pages reference the header file via the Canvas file token.
    expect(course.pages.some((page) => page.bodyHtml.includes("module-1-header.svg"))).toBe(true);
    // Registered as a manifest file asset — exactly one per content module, no extras.
    expect(course.fileAssets.some((asset) => asset.path === `web_resources/module-1-header.svg`)).toBe(true);
    expect(course.fileAssets.filter((asset) => /web_resources\/module-\d+-header\.svg/.test(asset.path))).toHaveLength(contentNumbers.length);
    // No stray header file for a non-content module (e.g., module-5 when there are 4 content modules).
    const maxContent = Math.max(...contentNumbers);
    expect(zip.file(`web_resources/module-${maxContent + 1}-header.svg`)).toBeNull();
  });

  it("omits module headers entirely when OFF (the default) — no files, refs, or assets", async () => {
    const course = build(false);
    const zip = await buildImsccZip(course);
    expect(zip.file("web_resources/module-1-header.svg")).toBeNull();
    expect(course.pages.some((page) => page.bodyHtml.includes("module-1-header.svg"))).toBe(false);
    expect(course.fileAssets.some((asset) => /module-\d+-header/.test(asset.path))).toBe(false);
  });
});
