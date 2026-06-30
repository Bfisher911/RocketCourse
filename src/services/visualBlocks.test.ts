import { describe, expect, it } from "vitest";
import { sampleProject } from "./courseGenerator";
import { VISUAL_BLOCKS, buildVisualBlockHtml, type VisualBlockId } from "./visualBlocks";

const expectedBlockIds: VisualBlockId[] = [
  "hero-banner",
  "start-here-button-panel",
  "course-journey-map",
  "this-week-at-a-glance",
  "course-promise-statement",
  "instructor-welcome-card",
  "navigation-tile-grid",
  "how-to-succeed-checklist",
  "need-help-support-panel",
  "course-trailer-video-placeholder",
  "module-mission-briefing",
  "module-objectives-chips",
  "before-you-begin-checklist",
  "module-map",
  "key-terms-cards",
  "big-question-banner",
  "prior-module-connection-card",
  "next-module-preview-card",
  "common-mistake-callout",
  "instructor-margin-note",
  "read-watch-do-layout",
  "concept-and-example-block",
  "myth-vs-reality-cards",
  "pause-and-think-reflection-box",
  "try-this-now-activity-block",
  "case-file-layout",
  "field-note-box",
  "student-decision-point",
  "timeline",
  "process-diagram",
  "card-grid",
  "quote-block",
  "resource-list",
  "comparison-table",
  "assignment-brief",
  "deliverable-checklist",
  "rubric-preview",
  "starter-prompts",
  "ai-use-guidance",
  "submission-survival-kit",
  "stretch-goal",
  "discussion-role-card",
  "first-post-and-reply-guidance",
  "conversation-moves-cards",
  "sample-strong-reply",
  "peer-response-starters",
  "quiz-study-cards",
  "confidence-check",
  "quiz-review-and-remediation-block",
  "syllabus-policy-cards",
  "grading-breakdown-visual",
  "weekly-schedule-visual-table",
  "communication-expectations-block",
  "technology-needed-block",
  "late-work-policy-at-a-glance",
  "accessibility-and-inclusion-panel",
  "student-success-path",
  "instructor-facilitation-notes",
  "announcement-bank",
  "course-launch-checklist",
  "mid-course-pulse-check-survey-template"
];

const unsafeHtmlPattern =
  /<script|<iframe|<frame|<style|<form|<input|<button|<textarea|<select|<object|<embed|<link|<meta|<base|\son[a-z]+\s*=|javascript:|vbscript:|data:\s*text\/html|url\(/i;

describe("visual blocks", () => {
  it("ships the full Phase 1 reusable Canvas block catalog", () => {
    expect(VISUAL_BLOCKS).toHaveLength(61);
    expect(new Set(VISUAL_BLOCKS.map((block) => block.id)).size).toBe(VISUAL_BLOCKS.length);
    expect(VISUAL_BLOCKS.map((block) => block.id)).toEqual(expectedBlockIds);
  });

  it("renders every block as editable, theme-aware, Canvas-safe HTML", () => {
    const page = sampleProject.pages.find((item) => item.moduleId && !item.frontPage);

    VISUAL_BLOCKS.forEach((block) => {
      const html = buildVisualBlockHtml(block.id, { course: sampleProject, page });

      expect(html.length, block.id).toBeGreaterThan(120);
      expect(html, block.id).toMatch(/<h2\b/i);
      expect(html, block.id).not.toMatch(unsafeHtmlPattern);
      expect(html, block.id).not.toMatch(/href\s*=\s*["']\s*#/i);
      expect(html.includes(sampleProject.theme.accent) || html.includes(sampleProject.theme.accentDark), block.id).toBe(true);
      expect(html, block.id).not.toContain("\u2014");
      expect(html, block.id).not.toContain("&mdash;");
      expect(html.toLowerCase(), block.id).not.toContain("not just");
    });
  });

  it("includes visible alt-text guidance for media placeholders", () => {
    ["hero-banner", "course-trailer-video-placeholder"].forEach((id) => {
      const html = buildVisualBlockHtml(id as VisualBlockId, { course: sampleProject });
      expect(html, id).toContain("Alt text placeholder");
      expect(html, id).toContain('role="img"');
    });
  });

  it("uses accessible table headers for table-style blocks", () => {
    ["comparison-table", "rubric-preview", "grading-breakdown-visual", "weekly-schedule-visual-table"].forEach((id) => {
      const html = buildVisualBlockHtml(id as VisualBlockId, { course: sampleProject });

      expect(html, id).toContain('<th scope="col"');
      expect(html, id).toContain('<th scope="row"');
    });
  });
});
