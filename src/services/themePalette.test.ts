import { describe, expect, it } from "vitest";
import { derivePalette, semanticColors } from "./themePalette";
import { contrastRatio } from "../utils/color";

const isHex = (value: string): boolean => /^#[0-9a-f]{6}$/i.test(value);

describe("themePalette", () => {
  it("derives a full, all-hex palette from one accent", () => {
    const p = derivePalette("#4338ca");
    expect(p.accent).toBe("#4338ca");
    expect(isHex(p.accentDark)).toBe(true);
    expect(isHex(p.accentLight)).toBe(true);
    expect(isHex(p.soft)).toBe(true);
    expect(isHex(p.surface)).toBe(true);
    expect(p.tints).toHaveLength(5);
    expect(p.shades).toHaveLength(5);
    expect(p.tints.every(isHex)).toBe(true);
    expect(p.shades.every(isHex)).toBe(true);
  });

  it("picks a readable onAccent (WCAG-passing) for the accent", () => {
    for (const accent of ["#4338ca", "#0e7490", "#b45309", "#111827", "#9d174d"]) {
      const p = derivePalette(accent);
      expect(contrastRatio(p.onAccent, accent)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("soft is lighter than surface-adjacent and far lighter than the accent", () => {
    const p = derivePalette("#0e7490");
    expect(contrastRatio(p.accentDark, p.soft)).toBeGreaterThanOrEqual(4.5);
  });

  it("semantic colors keep meaning but harmonize toward the accent (not the raw canonical hue)", () => {
    const { success, info, warning, danger } = semanticColors("#4338ca");
    for (const pair of [success, info, warning, danger]) {
      expect(isHex(pair.base)).toBe(true);
      expect(isHex(pair.soft)).toBe(true);
      // The soft fill is much lighter than its base (a tinted background).
      expect(contrastRatio(pair.base, pair.soft)).toBeGreaterThan(1.5);
    }
    // Harmonized success differs from the raw canonical green.
    expect(success.base).not.toBe("#15803d");
  });
});
