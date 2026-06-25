import { describe, expect, it } from "vitest";
import { bestTextOn, contrastRatio, isLight, lighten, meetsAaLarge, mix, parseHex, rgbToHex, shiftHue } from "./color";

describe("color utilities", () => {
  it("parses 3- and 6-digit hex", () => {
    expect(parseHex("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHex("000000")).toEqual({ r: 0, g: 0, b: 0 });
    expect(parseHex("#276ef1")).toEqual({ r: 39, g: 110, b: 241 });
  });

  it("returns null for unparseable values", () => {
    expect(parseHex("rgb(1,2,3)")).toBeNull();
    expect(parseHex("")).toBeNull();
  });

  it("computes the canonical black/white contrast ratio of 21", () => {
    expect(Math.round(contrastRatio("#000000", "#ffffff"))).toBe(21);
  });

  it("picks white text on dark backgrounds and dark text on light backgrounds", () => {
    expect(bestTextOn("#111827")).toBe("#ffffff");
    expect(bestTextOn("#f3f4f6")).toBe("#0b1020");
  });

  it("the chosen text color always clears AA-large contrast on theme accents", () => {
    ["#276ef1", "#0f766e", "#a5402d", "#2563eb", "#7c3aed", "#15803d", "#111827"].forEach((accent) => {
      expect(meetsAaLarge(bestTextOn(accent), accent)).toBe(true);
    });
  });

  it("classifies light vs dark", () => {
    expect(isLight("#ffffff")).toBe(true);
    expect(isLight("#05060f")).toBe(false);
  });

  it("rgbToHex round-trips a parsed color", () => {
    expect(rgbToHex({ r: 39, g: 110, b: 241 })).toBe("#276ef1");
    expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe("#000000");
  });

  it("lighten moves toward white, darken's counterpart", () => {
    expect(lighten("#000000", 1)).toBe("#ffffff");
    expect(lighten("#000000", 0)).toBe("#000000");
    expect(lighten("#808080", 0.5)).toBe("#c0c0c0");
  });

  it("mix blends two colors linearly", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mix("#ff0000", "#0000ff", 0)).toBe("#ff0000");
    expect(mix("#ff0000", "#0000ff", 1)).toBe("#0000ff");
  });

  it("shiftHue rotates hue but preserves the color (360° = identity, 0° = identity)", () => {
    expect(shiftHue("#276ef1", 0)).toBe("#276ef1");
    expect(shiftHue("#276ef1", 360)).toBe("#276ef1");
    // A 180° rotation of a saturated blue lands in the warm half (more red than blue).
    const rotated = parseHex(shiftHue("#276ef1", 180))!;
    expect(rotated.r).toBeGreaterThan(rotated.b);
  });

  it("shifted module accents stay saturated siblings, not greys", () => {
    const base = "#7c3aed";
    const shifted = shiftHue(base, 40);
    expect(shifted).not.toBe(base);
    expect(parseHex(shifted)).not.toBeNull();
  });
});
