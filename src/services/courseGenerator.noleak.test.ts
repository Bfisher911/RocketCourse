// Regression guard for the demo-content leak: every generated project must derive
// entirely from the user's intake. The "AI and Modern Society" sample exists only as
// the explicit public demo (sampleProject) and must never appear in a real generation.

import { describe, expect, it } from "vitest";
import { generateCourseProject, sampleProject } from "./courseGenerator";
import { defaultSettings } from "../data/defaultSettings";

const DEMO_MARKERS = [/AI and Modern Society/i, /civic dimensions of artificial intelligence/i];

describe("generated courses never contain demo placeholder content", () => {
  it("derives the title from a short prompt with no 'course on' phrasing", () => {
    const project = generateCourseProject({
      prompt: "Cartography of Lost Things. Students map objects, memories, and places that no longer exist.",
      settings: defaultSettings
    });
    expect(project.title).toBe("Cartography of Lost Things");
    const serialized = JSON.stringify(project);
    for (const marker of DEMO_MARKERS) expect(serialized).not.toMatch(marker);
    expect(serialized).toContain("Cartography of Lost Things");
  });

  it("prefers the explicit title setting over prompt inference", () => {
    const project = generateCourseProject({
      prompt: "Build me a 10-week course on Marine Biology with weekly quizzes.",
      settings: { ...defaultSettings, title: "Cartography of Lost Things" }
    });
    expect(project.title).toBe("Cartography of Lost Things");
  });

  it("still infers from 'course on X' phrasing when no title is set", () => {
    const project = generateCourseProject({
      prompt: "Build me a 10-week course on Marine Biology with weekly quizzes.",
      settings: defaultSettings
    });
    expect(project.title).toBe("Marine Biology");
    expect(JSON.stringify(project)).not.toMatch(DEMO_MARKERS[0]);
  });

  it("falls back to Untitled Course when the intake is empty, without leaking demo copy", () => {
    const project = generateCourseProject({ prompt: "", settings: defaultSettings });
    expect(project.title).toBe("Untitled Course");
    const serialized = JSON.stringify(project);
    for (const marker of DEMO_MARKERS) expect(serialized).not.toMatch(marker);
  });

  it("writes a topic-specific description when the intake left it blank", () => {
    const project = generateCourseProject({
      prompt: "Cartography of Lost Things. Students map objects, memories, and places that no longer exist.",
      settings: defaultSettings
    });
    expect(project.description).toContain("Cartography of Lost Things");
  });

  it("keeps the public demo course intact", () => {
    expect(sampleProject.title).toBe("AI and Modern Society");
    expect(sampleProject.description).toContain("artificial intelligence");
  });
});
