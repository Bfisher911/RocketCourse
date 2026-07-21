import { describe, expect, it } from "vitest";
import {
  INTERACTION_CATEGORY_LABELS,
  INTERACTION_PATTERNS,
  interactionPatternById
} from "./interactionPatterns";

describe("interaction pattern registry", () => {
  it("represents all 113 patterns from the library", () => {
    expect(INTERACTION_PATTERNS).toHaveLength(113);
    const numbers = INTERACTION_PATTERNS.map((pattern) => pattern.number).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: 113 }, (_, index) => index + 1));
  });

  it("uses unique ids and unique numbers", () => {
    const ids = new Set(INTERACTION_PATTERNS.map((pattern) => pattern.id));
    const numbers = new Set(INTERACTION_PATTERNS.map((pattern) => pattern.number));
    expect(ids.size).toBe(113);
    expect(numbers.size).toBe(113);
  });

  it("gives every pattern complete metadata", () => {
    for (const pattern of INTERACTION_PATTERNS) {
      expect(pattern.name.trim().length, pattern.id).toBeGreaterThan(0);
      expect(pattern.bestUse.trim().length, pattern.id).toBeGreaterThan(0);
      expect(pattern.guidance.trim().length, pattern.id).toBeGreaterThan(0);
      expect(pattern.accessibilityNotes.trim().length, pattern.id).toBeGreaterThan(0);
      expect(pattern.purposes.length, pattern.id).toBeGreaterThan(0);
      expect(Object.keys(INTERACTION_CATEGORY_LABELS), pattern.id).toContain(pattern.category);
    }
  });

  it("keeps the tier model honest: iframe patterns require hosting and declare a native fallback", () => {
    const iframePatterns = INTERACTION_PATTERNS.filter((pattern) => pattern.tier === "iframe");
    expect(iframePatterns.length).toBeGreaterThanOrEqual(10);
    for (const pattern of iframePatterns) {
      expect(pattern.requiresExternalHosting, pattern.id).toBe(true);
      expect(pattern.fallbackPatternId, pattern.id).toBeTruthy();
      const fallback = interactionPatternById(pattern.fallbackPatternId ?? "");
      expect(fallback, `${pattern.id} fallback`).toBeTruthy();
      expect(fallback?.tier, `${pattern.id} fallback must be native`).toBe("native");
    }
  });

  it("never lets a native pattern claim grading support (grades need Canvas quizzes or LTI)", () => {
    for (const pattern of INTERACTION_PATTERNS.filter((item) => item.tier === "native")) {
      expect(pattern.supportsGrading, pattern.id).toBe(false);
    }
  });

  it("requires assets for media-dependent templates so they can never render empty shells", () => {
    const mediaTemplates = new Set(["media-audio", "media-video", "figure-panel", "gallery", "image-map", "instructor-panel"]);
    for (const pattern of INTERACTION_PATTERNS.filter((item) => mediaTemplates.has(item.template))) {
      expect(pattern.requiredAssets.length, pattern.id).toBeGreaterThan(0);
      expect(pattern.pageTypes, `${pattern.id} must be editor-only until assets exist`).toHaveLength(0);
    }
  });
});
