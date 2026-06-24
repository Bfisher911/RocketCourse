import { describe, expect, it } from "vitest";
import { themes } from "../data/themes";
import {
  buildAssignmentCard,
  buildDiscussionCard,
  buildModuleRoadmap,
  buildObjectiveBadges,
  buildQuizCard,
  buildWorkloadTiles
} from "./themeDesign";

const theme = themes[0];

/** Canvas strips scripts, inline event handlers, javascript: URLs, and often url(). None may appear. */
const assertCanvasSafe = (html: string) => {
  expect(/<script/i.test(html)).toBe(false);
  expect(/\son\w+\s*=/i.test(html)).toBe(false);
  expect(/javascript:/i.test(html)).toBe(false);
  expect(/url\(/i.test(html)).toBe(false);
};

describe("specialized themed renderers — Canvas safety", () => {
  const samples: Array<[string, string]> = [
    ["objectiveBadges", buildObjectiveBadges(theme, ["Analyze sources", "Build an argument"])],
    ["assignmentCard", buildAssignmentCard(theme, { purpose: "Apply the method", task: "Write a brief", deliverable: "2-page PDF", successCriteria: "Clear claim + evidence", dueLabel: "Week 3", points: 100, estimatedHours: 4 })],
    ["discussionCard", buildDiscussionCard(theme, { prompt: "Take a position", preparation: "Read ch. 4", replyExpectations: "Reply to 2 peers", gradingCriteria: "Evidence + civility", points: 20 })],
    ["quizCard", buildQuizCard(theme, { purpose: "Check understanding", format: "10 questions", preparation: "Review notes", estimatedMinutes: 20, points: 10, integrityNote: "Individual, closed-book" })],
    ["workloadTiles", buildWorkloadTiles(theme, [{ label: "Reading", value: "3 hr" }, { label: "Writing", value: "2 hr" }])],
    ["moduleRoadmap", buildModuleRoadmap(theme, [{ label: "Foundations", sub: "Week 1" }, { label: "Applied", sub: "Week 2" }])]
  ];

  it.each(samples)("%s output is Canvas-safe", (_name, html) => {
    assertCanvasSafe(html);
  });

  it.each(samples)("%s carries the theme accent color", (_name, html) => {
    const themed = html.includes(theme.accent) || html.includes(theme.accentDark);
    expect(themed).toBe(true);
  });
});

describe("specialized themed renderers — content + escaping", () => {
  it("assignment card includes the structured labels and meta", () => {
    const html = buildAssignmentCard(theme, { purpose: "x", task: "y", deliverable: "z", successCriteria: "w", points: 100, dueLabel: "Week 3", estimatedHours: 4 });
    expect(html).toContain("Purpose");
    expect(html).toContain("Your task");
    expect(html).toContain("Deliverable");
    expect(html).toContain("Success criteria");
    expect(html).toContain("100 pts");
    expect(html).toContain("Due: Week 3");
    expect(html).toContain("~4 hr");
  });

  it("escapes HTML in user-supplied content (no injection)", () => {
    const html = buildObjectiveBadges(theme, ['<script>alert(1)</script>']);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("omits empty blocks and renders nothing for empty input", () => {
    expect(buildObjectiveBadges(theme, [])).toBe("");
    expect(buildObjectiveBadges(theme, ["", "  "])).toBe("");
    expect(buildWorkloadTiles(theme, [])).toBe("");
    const sparse = buildAssignmentCard(theme, { purpose: "only purpose" });
    expect(sparse).toContain("Purpose");
    expect(sparse).not.toContain("Deliverable");
  });
});
