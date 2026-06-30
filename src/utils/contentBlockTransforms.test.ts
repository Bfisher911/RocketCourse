import { describe, expect, it } from "vitest";
import { ROCK_CONTENT_CATEGORIES, ROCK_QUICK_ACTIONS } from "../data/contentBlockToolkit";
import { sampleProject } from "../services/courseGenerator";
import { runRockQuickAction } from "./contentBlockTransforms";

const expectedCategories = [
  "Welcome",
  "Navigation",
  "Module",
  "Activity",
  "Assignment",
  "Discussion",
  "Quiz",
  "Syllabus",
  "Support",
  "Reflection",
  "Timeline",
  "Case Study",
  "Debate",
  "Project",
  "Wrap-Up",
  "Instructor Notes"
];

const expectedActions = [
  "Make this more visual",
  "Turn this paragraph into cards",
  "Turn this list into a timeline",
  "Add student-friendly scaffolding",
  "Add examples and non-examples",
  "Add accessibility improvements",
  "Add instructor voice",
  "Simplify this page layout",
  "Make this Canvas homepage-ready",
  "Convert this into a Start Here page"
];

const unsafeHtmlPattern = /<script|<iframe|<style|<form|<input|<button|<textarea|<select|<object|<embed|<link|<meta|\son[a-z]+\s*=|javascript:|vbscript:|data:\s*text\/html|url\(/i;

describe("rock content deterministic transforms", () => {
  it("ships the requested category and quick-action labels", () => {
    expect([...ROCK_CONTENT_CATEGORIES]).toEqual(expectedCategories);
    expect(ROCK_QUICK_ACTIONS.map((action) => action.label)).toEqual(expectedActions);
  });

  it("produces Canvas-safe deterministic HTML for every quick action", () => {
    const source = "<h1>Draft Page</h1><p>First idea. Second idea. Third idea.</p><ul><li>Prepare</li><li>Practice</li><li>Submit</li></ul>";

    ROCK_QUICK_ACTIONS.forEach((action) => {
      const result = runRockQuickAction(action.id, { course: sampleProject }, source);

      expect(result.label).toBe(action.label);
      expect(result.html.length, action.id).toBeGreaterThan(100);
      expect(result.html, action.id).toMatch(/<h[12]\b/i);
      expect(result.html, action.id).not.toMatch(unsafeHtmlPattern);
      expect(result.html, action.id).not.toContain("\u2014");
      expect(result.html, action.id).not.toContain("&mdash;");
    });
  });

  it("uses replacement mode only for page-scale transforms", () => {
    expect(runRockQuickAction("simplify-page-layout", { course: sampleProject }, "<p>Draft</p>").mode).toBe("replace");
    expect(runRockQuickAction("canvas-homepage-ready", { course: sampleProject }, "<p>Draft</p>").mode).toBe("replace");
    expect(runRockQuickAction("start-here-page", { course: sampleProject }, "<p>Draft</p>").mode).toBe("replace");
    expect(runRockQuickAction("make-more-visual", { course: sampleProject }, "<p>Draft</p>").mode).toBe("insert");
  });
});
