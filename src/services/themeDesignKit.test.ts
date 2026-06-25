import { describe, expect, it } from "vitest";
import {
  buildBannerSvg,
  buildCourseTileSvg,
  buildModuleHeaderSvg,
  buildThemedAchievement,
  buildThemedAtAGlance,
  buildThemedCard,
  buildThemedColophon,
  buildThemedDeadlineRibbon,
  buildThemedEffortMeter,
  buildThemedGlossary,
  buildThemedMatrix,
  buildThemedPanels,
  buildThemedPullQuote,
  buildThemedResourceCard,
  buildThemedShell,
  buildThemedStatBand,
  buildThemedTimeline,
  moduleAccentTheme,
  validateTheme
} from "./themeDesign";
import type { Theme } from "../types";

const base: Theme = {
  id: "vt-kit-test",
  name: "Kit Test",
  accent: "#0e7490",
  accentDark: "#155e75",
  soft: "#ecfeff",
  contrastText: "#164e63",
  bannerLabel: "Kit Test",
  contrastStatus: "pass",
  gradientFrom: "#0e7490",
  gradientTo: "#1d4ed8",
  pattern: "hexagon",
  motif: "gears",
  fontFamily: "mono",
  heroStyle: "console",
  cardStyle: "folder-tab"
};

const canvasSafe = (html: string): void => {
  expect(html).not.toMatch(/url\(/i);
  expect(html).not.toMatch(/<script|<iframe|on[a-z]+=|@font-face/i);
};

describe("themeDesign kit — new content primitives", () => {
  const blocks: Array<[string, string]> = [
    ["timeline", buildThemedTimeline(base, [{ label: "Week 1", date: "Aug 25", body: "Kickoff" }, { label: "Week 2" }])],
    ["pullQuote", buildThemedPullQuote(base, "All models are wrong, some are useful.", "George Box")],
    ["statBand", buildThemedStatBand(base, [{ value: "12", label: "Weeks" }, { value: "3", label: "Credits" }])],
    ["glossary", buildThemedGlossary(base, [{ term: "Construct", definition: "A measurable concept." }])],
    ["atAGlance", buildThemedAtAGlance(base, [{ icon: "clock", label: "Time", value: "2 hrs" }, { icon: "objective", label: "Points", value: "60" }])],
    ["effortMeter", buildThemedEffortMeter(base, 2, 3)],
    ["panels", buildThemedPanels(base, [{ label: "Overview", body: "<p>x</p>" }, { label: "Steps", body: "<p>y</p>" }])],
    ["matrix", buildThemedMatrix(base, ["Option A", "Option B"], [{ label: "Cost", cells: ["Low", "High"] }])],
    ["ribbon", buildThemedDeadlineRibbon(base, "Project due", "Dec 5")],
    ["achievement", buildThemedAchievement(base, "Module complete")],
    ["resourceCard", buildThemedResourceCard(base, { title: "Intro to X", kind: "Video", meta: "12 min" })],
    ["colophon", buildThemedColophon(base)]
  ];

  it("every new primitive returns non-empty, Canvas-safe HTML", () => {
    for (const [name, html] of blocks) {
      expect(html.length, name).toBeGreaterThan(20);
      canvasSafe(html);
    }
  });

  it("empty inputs degrade to empty strings (no crash, no orphan markup)", () => {
    expect(buildThemedTimeline(base, [])).toBe("");
    expect(buildThemedStatBand(base, [])).toBe("");
    expect(buildThemedGlossary(base, [])).toBe("");
  });

  it("resource card maps the kind to its icon and renders a typed chip", () => {
    expect(buildThemedResourceCard(base, { title: "Dataset", kind: "Dataset" })).toContain("Dataset");
    expect(buildThemedResourceCard(base, { title: "Paper", kind: "Article", href: "reading.html" })).toContain("href=");
  });
});

describe("themeDesign kit — new heroes, cards, motifs, patterns", () => {
  it("console hero renders terminal chrome; folder-tab card renders a tab", () => {
    const shell = buildThemedShell(base, "Course", "Subtitle", "<p>body</p>");
    expect(shell).toContain("rocketcourse open");
    canvasSafe(shell);
    const card = buildThemedCard(base, "Section", "<p>body</p>");
    expect(card).toContain("Section"); // the tab carries the title
    canvasSafe(card);
  });

  it("banner SVG renders the new motif + pattern, using only internal url(#…) refs", () => {
    const svg = buildBannerSvg("Engineering Bay", base);
    expect(svg).toContain("<svg");
    expect(svg).toContain("<pattern"); // hexagon pattern def
    // Internal references like fill="url(#bannerBg)" are fine; external url() is what Canvas strips.
    expect(svg).not.toMatch(/url\((?!#)/);
  });

  it("all five new hero styles and five new card styles are handled (distinct output)", () => {
    const heroStyles = ["ticket", "postcard", "console", "editorial", "medallion"] as const;
    const outputs = heroStyles.map((heroStyle) => buildThemedShell({ ...base, heroStyle }, "T", "S", "<p>b</p>"));
    expect(new Set(outputs).size).toBe(heroStyles.length); // each visually distinct
    const cardStyles = ["folder-tab", "index-card", "notch", "matted", "gradient-edge"] as const;
    const cards = cardStyles.map((cardStyle) => buildThemedCard({ ...base, cardStyle }, "T", "<p>b</p>"));
    expect(new Set(cards).size).toBe(cardStyles.length);
  });
});

describe("themeDesign kit — per-module identity", () => {
  it("module 0 keeps the theme; later modules get a sibling accent (different, still valid)", () => {
    expect(moduleAccentTheme(base, 0).accent).toBe(base.accent);
    const m4 = moduleAccentTheme(base, 4);
    expect(m4.accent).not.toBe(base.accent);
    expect(/^#[0-9a-f]{6}$/i.test(m4.accent)).toBe(true);
    // A shifted module theme should still pass WCAG validation.
    expect(validateTheme(m4).status).toBe("pass");
  });

  it("module header + course tile render SVG with the number/title", () => {
    const header = buildModuleHeaderSvg(base, 3, "Signals and Systems");
    expect(header).toContain("<svg");
    expect(header).toContain(">3<");
    expect(header).toContain("Signals and Systems");
    const tile = buildCourseTileSvg("Engineering Bay", base);
    expect(tile).toContain("<svg");
    expect(tile).toContain("Engineering Bay");
  });
});
