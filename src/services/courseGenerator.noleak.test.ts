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

  it("derives the title from a source-only course label", () => {
    const project = generateCourseProject({
      prompt: "The instructor provided the following source materials:\n--- Source: syllabus.txt ---\nCourse: Emergency Preparedness for School Leaders. Audience: K-12 administrators.",
      settings: { ...defaultSettings, lengthWeeks: 4, moduleCount: 4 }
    });
    expect(project.title).toBe("Emergency Preparedness for School Leaders");
    expect(project.modules.filter((module) => module.kind === "content")).toHaveLength(4);
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

  it("generates distinct, subject-specific learning outcomes instead of verb-swapped duplicates", () => {
    const project = generateCourseProject({
      prompt: "Build me a 10-week course on Marine Biology.",
      settings: { ...defaultSettings, moduleCount: 10, lengthWeeks: 10 }
    });
    const normalizedBodies = project.outcomes.map((outcome) =>
      outcome.text.toLowerCase().replace(/^[a-z-]+\s+/, "").replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ")
    );
    expect(new Set(normalizedBodies).size).toBe(project.outcomes.length);
    expect(project.outcomes.every((outcome) => /marine biology/i.test(outcome.text))).toBe(true);
    expect(project.outcomes.some((outcome) => /same course concepts, practices, and implications/i.test(outcome.text))).toBe(false);
    expect(project.outcomes.some((outcome) => /^Apply a field and lab analysis method to/i.test(outcome.text))).toBe(true);
    expect(project.outcomes.some((outcome) => /^Apply Marine Biology methods to a concrete/i.test(outcome.text))).toBe(false);
    expect(project.outcomes.some((outcome) => /^Apply with/i.test(outcome.text))).toBe(false);
  });

  it("keeps the public demo course intact", () => {
    expect(sampleProject.title).toBe("AI and Modern Society");
    expect(sampleProject.description).toContain("artificial intelligence");
  });
});
