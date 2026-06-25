import { describe, expect, it } from "vitest";
import { hashString, seededBannerDecor, seededRandom } from "./generativeArt";

describe("generativeArt", () => {
  it("hashString is deterministic and varies by input", () => {
    expect(hashString("AI and Modern Society")).toBe(hashString("AI and Modern Society"));
    expect(hashString("Course A")).not.toBe(hashString("Course B"));
    expect(hashString("")).toBe(hashString("course")); // empty falls back to "course"
  });

  it("seededRandom produces a stable sequence per seed and differs across seeds", () => {
    const a = seededRandom(123);
    const b = seededRandom(123);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
    seqA.forEach((n) => expect(n).toBeGreaterThanOrEqual(0));
    seqA.forEach((n) => expect(n).toBeLessThan(1));
    const c = seededRandom(124);
    expect([c(), c(), c()]).not.toEqual(seqA);
  });

  it("banner decor is identical for the same title (no shimmer between renders/exports)", () => {
    expect(seededBannerDecor("Organic Chemistry")).toBe(seededBannerDecor("Organic Chemistry"));
  });

  it("banner decor differs across courses (subtly unique per title)", () => {
    expect(seededBannerDecor("Organic Chemistry")).not.toBe(seededBannerDecor("World History"));
  });

  it("is Canvas-safe inline SVG (a <g> of marks, no url()/script)", () => {
    const decor = seededBannerDecor("Test Course", "#ffffff");
    expect(decor.startsWith("<g")).toBe(true);
    expect(decor).toMatch(/<circle|<path/);
    expect(decor).not.toMatch(/url\(|<script|<style/i);
  });

  it("respects the ink color (uses the on-gradient color, not a hardcoded white)", () => {
    expect(seededBannerDecor("Dark Theme Course", "#0b1020")).toContain('fill="#0b1020"');
  });
});
