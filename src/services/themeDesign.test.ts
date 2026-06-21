import { describe, expect, it } from "vitest";
import { themes } from "../data/themes";
import type { Theme } from "../types";
import { buildThemePreviewHtml, buildThemedButton, validateTheme, type ThemePreviewKind } from "./themeDesign";

const unsafeHtmlPattern = /<script|<style|\son[a-z]+\s*=|javascript:/i;

describe("theme design system", () => {
  it("ships the required higher-ed theme set", () => {
    expect(themes.map((theme) => theme.name)).toEqual(
      expect.arrayContaining([
        "Bold University",
        "Clean Canvas",
        "Warm Seminar",
        "High Contrast",
        "STEM Lab",
        "Healthcare Professional",
        "Humanities Studio",
        "Executive Program"
      ])
    );
    expect(themes.length).toBeGreaterThanOrEqual(8);
  });

  it("keeps bundled themes above the contrast validation threshold", () => {
    themes.forEach((theme) => {
      const validation = validateTheme(theme);
      expect(validation.status, theme.name).toBe(theme.contrastStatus);
      expect(validation.status, theme.name).toBe("pass");
      expect(validation.warnings, theme.name).toBe(0);
    });
  });

  it("flags weak color pairings for review", () => {
    const weakTheme: Theme = {
      id: "weak-theme",
      name: "Weak Theme",
      accent: "#ffff66",
      accentDark: "#fff200",
      soft: "#fffbe6",
      contrastText: "#fff200",
      bannerLabel: "Weak contrast",
      contrastStatus: "review"
    };

    const validation = validateTheme(weakTheme);

    expect(validation.status).toBe("review");
    expect(validation.warnings).toBeGreaterThan(0);
  });

  it("sanitizes unsafe button links without dropping the button", () => {
    const html = buildThemedButton(themes[0], "Start", "javascript:alert(1)");

    expect(html).toContain('href="#"');
    expect(html).not.toMatch(/javascript:/i);
  });

  it("renders Canvas-safe preview HTML for every preview mode", () => {
    const modes: ThemePreviewKind[] = ["homepage", "syllabus", "assignment", "quiz", "rubric"];

    modes.forEach((mode) => {
      const html = buildThemePreviewHtml(themes[0], mode, "Theme QA");
      expect(html, mode).not.toMatch(unsafeHtmlPattern);
      expect(html, mode).toContain(themes[0].accent);
      expect(html, mode).toContain(themes[0].accentDark);
    });
  });
});
