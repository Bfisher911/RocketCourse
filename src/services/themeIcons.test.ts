import { describe, expect, it } from "vitest";
import { ICON_NAMES, icon, iconLabel } from "./themeIcons";

describe("themeIcons", () => {
  it("renders a themed inline SVG with the requested color + size", () => {
    const svg = icon("objective", { color: "#7c3aed", size: 20 });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('stroke="#7c3aed"');
    expect(svg).toContain('width="20"');
    expect(svg).toContain('viewBox="0 0 24 24"');
  });

  it("is decorative (aria-hidden) by default and labelled when a title is given", () => {
    expect(icon("check")).toContain('aria-hidden="true"');
    const labelled = icon("warning", { title: "Warning" });
    expect(labelled).toContain('role="img"');
    expect(labelled).toContain('aria-label="Warning"');
    expect(labelled).toContain("<title>Warning</title>");
  });

  it("uses no Canvas-stripped constructs (no url(), <script>, <style>, or external refs)", () => {
    for (const name of ICON_NAMES) {
      const svg = icon(name, { color: "#0f766e" });
      expect(svg).not.toMatch(/url\(/i);
      expect(svg).not.toMatch(/<script|<style|xlink:href|href=/i);
      expect(svg.startsWith("<svg")).toBe(true);
    }
  });

  it("returns empty string for an unknown icon name (never throws)", () => {
    // @ts-expect-error intentionally invalid name
    expect(icon("not-a-real-icon")).toBe("");
  });

  it("iconLabel pairs an icon with escaped text", () => {
    const html = iconLabel("clock", "2 hours", { color: "#111" });
    expect(html).toContain("<svg");
    expect(html).toContain("2 hours");
  });

  it("ships a meaningful icon set (the labels the renderers rely on)", () => {
    for (const need of ["objective", "deadline", "reading", "discussion", "quiz", "rubric", "instructor", "tip", "warning"] as const) {
      expect(ICON_NAMES).toContain(need);
    }
    expect(ICON_NAMES.length).toBeGreaterThanOrEqual(24);
  });
});
