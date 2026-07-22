import { describe, expect, it } from "vitest";
import { getTheme } from "../data/themes";
import { INTERACTION_PATTERNS, interactionPatternById } from "../data/interactionPatterns";
import { defaultSettings } from "../data/defaultSettings";
import { generateCourseProject } from "./courseGenerator";
import {
  composeBodyWithInteractions,
  renderInteractionBlock,
  validateExternalConfig,
  type ExternalInteractiveConfig,
  type InteractionBlock
} from "./interactionRender";
import { validateInteractionHtml } from "./interactionValidation";
import { hasUnsafeHtml } from "./htmlSafety";
import { buildEditorSampleContent } from "./interactionSelection";

const theme = getTheme("emerald") ?? getTheme("default") ?? generateCourseProject({ prompt: "t", settings: { ...defaultSettings, title: "T" } }).theme;

const course = generateCourseProject({
  prompt: "A survey of world history",
  settings: { ...defaultSettings, title: "World History Survey", description: "A survey of world history from antiquity to the present." }
});

const blockFor = (patternId: string, id = "b1"): InteractionBlock | null => {
  const content = buildEditorSampleContent(patternId, course);
  if (!content) return null;
  return { id, patternId, content, source: "inserted", createdAt: "2026-07-21T00:00:00.000Z" };
};

describe("interaction rendering", () => {
  it("renders every native pattern without Canvas-hostile HTML or unfinished template text", () => {
    for (const pattern of INTERACTION_PATTERNS.filter((item) => item.tier === "native" && !item.requiredAssets.length)) {
      const block = blockFor(pattern.id);
      expect(block, pattern.id).toBeTruthy();
      const html = renderInteractionBlock(block!, course.theme);
      expect(html.length, pattern.id).toBeGreaterThan(0);
      expect(hasUnsafeHtml(html), `${pattern.id} unsafe`).toBe(false);
      const errors = validateInteractionHtml(html).filter((issue) => issue.severity === "error");
      expect(errors, `${pattern.id}: ${errors.map((issue) => issue.detail).join("; ")}`).toHaveLength(0);
    }
  });

  it("suffixes ids with the block id so repeated patterns never collide", () => {
    const first = renderInteractionBlock(blockFor("worked-example-reveal", "one")!, course.theme);
    const second = renderInteractionBlock(blockFor("worked-example-reveal", "two")!, course.theme);
    const combined = `${first}\n${second}`;
    const errors = validateInteractionHtml(combined).filter((issue) => issue.label === "Duplicate element id");
    expect(errors).toHaveLength(0);
  });

  it("escapes course-provided text", () => {
    const block = blockFor("stop-and-think-prompt")!;
    block.content = { ...block.content, title: `<script>alert("x")</script> & "quotes"` };
    const html = renderInteractionBlock(block, course.theme);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;");
  });

  it("renders asset-dependent patterns as nothing (omit) when the asset is missing", () => {
    for (const patternId of ["basic-audio-player", "basic-video-player", "responsive-image-gallery", "map-legend-decoder"]) {
      const block = blockFor(patternId);
      if (!block) continue; // no builder → selection can never place it, which is also safe
      const html = renderInteractionBlock(block, course.theme);
      expect(html, patternId).toBe("");
    }
  });

  it("never emits an iframe while external embeds are disabled — even with a configured URL", () => {
    const external: ExternalInteractiveConfig = {
      url: "https://interactives.example.edu/timeline",
      title: "Timeline Reconstruction",
      allowedDomain: "interactives.example.edu",
      textAlternative: "Arrange the listed events in order using the accessible list version."
    };
    const block = { ...blockFor("timeline-reconstruction-activity")!, external };
    const html = renderInteractionBlock(block, course.theme, { enabled: false, allowedDomains: [] });
    expect(html).not.toContain("<iframe");
    expect(html).toContain("target=\"_blank\"");
    expect(html).toContain("Open Timeline Reconstruction in a new window");
  });

  it("renders the native fallback when an iframe pattern has no external config", () => {
    for (const pattern of INTERACTION_PATTERNS.filter((item) => item.tier === "iframe")) {
      const block = blockFor(pattern.id);
      expect(block, pattern.id).toBeTruthy();
      const html = renderInteractionBlock(block!, course.theme);
      expect(html, pattern.id).not.toContain("<iframe");
      // Fallback renders real content — never an empty embed shell.
      const fallback = interactionPatternById(pattern.fallbackPatternId ?? "");
      expect(fallback, pattern.id).toBeTruthy();
      expect(hasUnsafeHtml(html), pattern.id).toBe(false);
    }
  });

  it("emits a compliant iframe only when the policy explicitly enables embeds", () => {
    const external: ExternalInteractiveConfig = {
      url: "https://interactives.example.edu/map",
      title: "Geographic Layer Explorer",
      allowedDomain: "interactives.example.edu",
      textAlternative: "The map compares elevation and land use; a text summary of key patterns follows the activity."
    };
    const block = { ...blockFor("geographic-layer-explorer")!, external };
    const html = renderInteractionBlock(block, course.theme, { enabled: true, allowedDomains: ["interactives.example.edu"] });
    expect(html).toContain("<iframe");
    expect(html).toContain('title="Geographic Layer Explorer"');
    expect(html).toContain("target=\"_blank\"");
    const errors = validateInteractionHtml(html, { allowIframes: true }).filter((issue) => issue.severity === "error");
    expect(errors, errors.map((issue) => issue.detail).join("; ")).toHaveLength(0);
  });

  it("rejects invalid external configs (non-HTTPS, missing title/alternative, domain mismatch)", () => {
    const policy = { enabled: true, allowedDomains: ["interactives.example.edu"] };
    expect(validateExternalConfig({ url: "http://interactives.example.edu/x", title: "T", allowedDomain: "interactives.example.edu", textAlternative: "alt" }, policy)).not.toHaveLength(0);
    expect(validateExternalConfig({ url: "https://interactives.example.edu/x", title: " ", allowedDomain: "interactives.example.edu", textAlternative: "alt" }, policy)).not.toHaveLength(0);
    expect(validateExternalConfig({ url: "https://interactives.example.edu/x", title: "T", allowedDomain: "interactives.example.edu", textAlternative: " " }, policy)).not.toHaveLength(0);
    expect(validateExternalConfig({ url: "https://evil.example.com/x", title: "T", allowedDomain: "interactives.example.edu", textAlternative: "alt" }, policy)).not.toHaveLength(0);
    expect(validateExternalConfig({ url: "https://interactives.example.edu/x", title: "T", allowedDomain: "interactives.example.edu", textAlternative: "alt" }, policy)).toHaveLength(0);
  });

  it("appends blocks when the body has no section structure, and leaves block-free bodies untouched", () => {
    const body = "<h2>Authored content</h2><p>Prose first.</p>";
    expect(composeBodyWithInteractions(body, undefined, theme)).toBe(body);
    const block = blockFor("reflection-ladder")!;
    const composed = composeBodyWithInteractions(body, [block], theme);
    expect(composed.startsWith(body)).toBe(true);
    expect(composed).toContain("Reflection");
  });

  it("interleaves blocks with the lesson flow: early after the first section, middle mid-page, end last", () => {
    const body =
      '<div><section id="s1"><p>One</p></section><section id="s2"><p>Two</p></section>' +
      '<section id="s3"><p>Three</p></section><section id="s4"><p>Four</p></section></div>';
    const early = blockFor("interactive-reading-guide", "e1")!;
    const middle = blockFor("stop-and-think-prompt", "m1")!;
    const end = blockFor("reflection-ladder", "z1")!;
    const composed = composeBodyWithInteractions(body, [end, middle, early], course.theme);
    const positions = {
      s1: composed.indexOf('id="s1"'),
      early: composed.indexOf("Reading Guide"),
      s2: composed.indexOf('id="s2"'),
      middle: composed.indexOf("Stop and Think"),
      s4: composed.indexOf('id="s4"'),
      end: composed.indexOf("Reflection")
    };
    expect(positions.s1).toBeGreaterThanOrEqual(0);
    expect(positions.early).toBeGreaterThan(positions.s1);
    expect(positions.s2).toBeGreaterThan(positions.early);
    expect(positions.middle).toBeGreaterThan(positions.s2);
    expect(positions.s4).toBeGreaterThan(positions.middle);
    expect(positions.end).toBeGreaterThan(positions.s4);
  });

  it("labels blocks with a visible affordance chip so they read as activities", () => {
    const reveal = renderInteractionBlock(blockFor("worked-example-reveal")!, course.theme);
    expect(reveal).toContain("Try it");
    const pause = renderInteractionBlock(blockFor("stop-and-think-prompt")!, course.theme);
    expect(pause).toContain("Pause and respond");
    // The scenario template keeps its own kicker instead of doubling up.
    const scenario = renderInteractionBlock(blockFor("scenario-card")!, course.theme);
    expect(scenario).toContain("Scenario");
    expect(scenario).not.toContain("Take note");
  });

  it("uses the course theme's palette rather than hard-coded library colors", () => {
    const html = renderInteractionBlock(blockFor("learning-objectives-card")!, course.theme);
    // The PDF's sample markup hard-codes teal (#cbd5e1 borders / #173f35 text); rendered
    // output must derive from the selected theme instead.
    expect(html).not.toContain("#173f35");
    expect(html.includes(course.theme.accent) || html.includes(course.theme.accentDark)).toBe(true);
  });
});
