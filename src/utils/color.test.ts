import { describe, expect, it } from "vitest";
import { bestTextOn, contrastRatio, isLight, meetsAaLarge, parseHex } from "./color";

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
});
