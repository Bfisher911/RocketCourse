import { describe, expect, it } from "vitest";
import { buildHeroSceneSvg, sceneArt, type ScenePalette, type ThemeHeroScene } from "./heroScenes";
import { buildBannerSvg, buildThemedShell } from "./themeDesign";
import type { Theme } from "../types";

const pal: ScenePalette = {
  gradientFrom: "#0e7490",
  gradientTo: "#1d4ed8",
  accent: "#0e7490",
  accentDark: "#155e75",
  onGradient: "#ffffff"
};
const scenes: ThemeHeroScene[] = ["lab", "city", "manuscript", "mountains", "tech", "cosmos"];

const sceneTheme: Theme = {
  id: "vt-scene-test",
  name: "Scene Test",
  accent: "#0e7490",
  accentDark: "#155e75",
  soft: "#ecfeff",
  contrastText: "#164e63",
  bannerLabel: "Scene Test",
  contrastStatus: "pass",
  gradientFrom: "#0e7490",
  gradientTo: "#1d4ed8",
  motif: "lab",
  heroScene: "city"
};

describe("heroScenes", () => {
  it("renders a full-bleed SVG per scene — Canvas-safe (only internal url(#) refs, no raster/href)", () => {
    for (const scene of scenes) {
      const svg = buildHeroSceneSvg(scene, pal);
      expect(svg.startsWith("<svg"), scene).toBe(true);
      expect(svg).toContain("preserveAspectRatio");
      expect(svg).toContain(pal.gradientFrom);
      expect(svg).not.toMatch(/url\((?!#)/);
      expect(svg).not.toMatch(/<script|<image\b|xlink:href|href=|@font-face/i);
    }
  });

  it("each scene is visually distinct", () => {
    expect(new Set(scenes.map((scene) => buildHeroSceneSvg(scene, pal))).size).toBe(scenes.length);
  });

  it("paints silhouettes in the theme accent-dark (as rgba)", () => {
    // accentDark #155e75 -> rgb(21, 94, 117)
    expect(buildHeroSceneSvg("mountains", pal)).toContain("rgba(21, 94, 117");
    expect(sceneArt("lab", pal).length).toBeGreaterThan(20);
  });

  it("the banner becomes the scene illustration when heroScene is set (no motif art)", () => {
    const banner = buildBannerSvg("Civic Life", sceneTheme);
    expect(banner).toContain("Illustrated city scene banner");
    expect(banner).toContain(sceneTheme.bannerLabel); // title card label preserved
    expect(banner).toContain("linearGradient");
    // a no-scene theme still renders the gradient/motif banner
    const plain = buildBannerSvg("Plain", { ...sceneTheme, heroScene: undefined });
    expect(plain).toContain("Gradient banner");
  });

  it("buildThemedShell renders the full-bleed scene hero with the title overlaid", () => {
    const shell = buildThemedShell(sceneTheme, "Urban Studies", "A city-scale course", "<p>body</p>");
    expect(shell).toContain("<svg");
    expect(shell).toContain("Urban Studies");
    expect(shell).toContain("text-shadow"); // readability treatment over the scene
  });
});
