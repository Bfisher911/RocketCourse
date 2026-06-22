import { describe, expect, it } from "vitest";
import { getTheme, themes } from "../data/themes";
import type { Theme } from "../types";
import {
  buildBannerSvg,
  buildThemePreviewHtml,
  buildThemedButton,
  buildThemedShell,
  getThemeStyles,
  heroBackgroundCss,
  validateTheme,
  type ThemePreviewKind
} from "./themeDesign";

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

  it("ships the new gradient + pattern themes, all contrast-valid", () => {
    const ids = ["aurora", "sunrise-scholar", "deep-ocean", "forest-path", "royal-press", "graphite-pro"];
    ids.forEach((id) => {
      const theme = getTheme(id);
      expect(theme.id, id).toBe(id);
      expect(theme.gradientFrom, id).toBeTruthy();
      expect(theme.pattern, id).not.toBe("none");
      const validation = validateTheme(theme);
      expect(validation.status, id).toBe("pass");
      expect(validation.warnings, id).toBe(0);
    });
  });

  it("renders a Canvas-safe gradient hero with a pure-CSS pattern (no url())", () => {
    const theme = getTheme("aurora");
    const shell = buildThemedShell(theme, "Module 1: Foundations", "Start here", "<p>Body</p>");
    expect(shell).toContain("linear-gradient");
    expect(shell).not.toMatch(unsafeHtmlPattern);
    // Patterns must be CSS gradients, never url() images — Canvas can strip url() in inline styles.
    expect(shell).not.toContain("url(");
    expect(heroBackgroundCss(getThemeStyles(theme))).toContain("radial-gradient");
  });

  it("builds one themed banner SVG (gradient + label) shared by export and preview", () => {
    const theme = getTheme("deep-ocean");
    const svg = buildBannerSvg("Marine Biology", theme);
    expect(svg).toContain("<linearGradient");
    expect(svg).toContain(theme.gradientFrom as string);
    expect(svg).toContain(theme.gradientTo as string);
    expect(svg).toContain("Marine Biology");
    expect(svg).toContain(theme.bannerLabel);
    expect(svg).not.toMatch(/<script|\son[a-z]+\s*=/i);
  });
});
