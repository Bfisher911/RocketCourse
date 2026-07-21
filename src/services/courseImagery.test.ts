import { describe, expect, it } from "vitest";
import type { CourseImageAsset } from "../types";
import {
  activeImageForPlacement,
  buildImagePrompt,
  defaultImageCrop,
  detectImageMimeType,
  imageReadiness,
  imageSetCreditCost,
  packagePathForImage,
  selectedCourseImages,
  safeImageDownloadName,
  validateImageUpload
} from "./courseImagery";

const asset = (patch: Partial<CourseImageAsset> = {}): CourseImageAsset => ({
  id: "12345678-aaaa-bbbb-cccc-123456789abc",
  placement: "course-card",
  source: "upload",
  status: "ready",
  version: 1,
  fileName: "Card image.jpg",
  mimeType: "image/jpeg",
  width: 1048,
  height: 584,
  byteSize: 120_000,
  altText: "Students examining a model together.",
  decorative: false,
  crop: defaultImageCrop(),
  createdAt: "2026-07-20T12:00:00.000Z",
  ...patch
});

describe("course imagery", () => {
  it("detects supported image signatures instead of trusting extensions", () => {
    expect(detectImageMimeType(new Uint8Array([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe("image/jpeg");
    expect(detectImageMimeType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe("image/png");
    expect(detectImageMimeType(new TextEncoder().encode("definitely not an image"))).toBeNull();
  });

  it("rejects spoofed, oversized, and unsupported uploads", () => {
    const result = validateImageUpload({
      name: "fake.jpg",
      mimeType: "image/jpeg",
      byteSize: 10 * 1024 * 1024 + 1,
      signature: new TextEncoder().encode("not an image file")
    }, "course-card");
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/10 MB/);
    expect(result.errors.join(" ")).toMatch(/not a supported image/);
  });

  it("warns when a valid image is too small or will need a meaningful crop", () => {
    const result = validateImageUpload({
      name: "portrait.png",
      mimeType: "image/png",
      byteSize: 20_000,
      width: 500,
      height: 900,
      signature: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0])
    }, "homepage-banner");
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(2);
  });

  it("selects the newest ready version without deleting history", () => {
    const old = asset();
    const processing = asset({ id: "processing", version: 3, status: "processing" });
    const current = asset({ id: "current", version: 2 });
    expect(activeImageForPlacement({ imageAssets: [old, processing, current] }, "course-card")?.id).toBe("current");
  });

  it("keeps one active supporting version per concrete course-object target", () => {
    const pageOne = asset({ id: "page-one-old", placement: "supporting", contentObjectId: "page-1", contentObjectType: "page", version: 1 });
    const pageOneNew = asset({ id: "page-one-new", placement: "supporting", contentObjectId: "page-1", contentObjectType: "page", version: 2 });
    const pageTwo = asset({ id: "page-two", placement: "supporting", contentObjectId: "page-2", contentObjectType: "page", version: 1 });
    expect(selectedCourseImages({ imageAssets: [pageOne, pageTwo, pageOneNew] }).map((item) => item.id).sort()).toEqual(["page-one-new", "page-two"]);
  });

  it("computes set costs using quality weights", () => {
    expect(imageSetCreditCost("essential", "medium")).toBe(2);
    expect(imageSetCreditCost("expanded", "high")).toBe(12);
    expect(imageSetCreditCost("custom", "medium", ["homepage-banner"])).toBe(1);
  });

  it("requires an accessibility decision for active imagery", () => {
    const incomplete = imageReadiness({ imageAssets: [asset({ altText: "" })] });
    expect(incomplete.score).toBe(33);
    const decorative = imageReadiness({ imageAssets: [asset({ decorative: true, altText: "" })] });
    expect(decorative.score).toBe(67);
  });

  it("creates stable package paths and safe Unicode download names", () => {
    const courseAsset = asset({ fileName: "Écologie – été.jpg" });
    expect(packagePathForImage(courseAsset)).toBe("web_resources/course-card-12345678.jpg");
    expect(safeImageDownloadName("Écologie & Société", courseAsset)).toMatch(/course-card-v1\.jpg$/);
  });

  it("builds placement-aware prompts with a central safe-area instruction", () => {
    const prompt = buildImagePrompt({ title: "Biology", description: "Cells and systems" }, "homepage-banner", "Natural-light microscopy");
    expect(prompt).toContain("Homepage banner");
    expect(prompt).toContain("central safe area");
    expect(prompt).toContain("Do not include words");
    expect(prompt).toContain("Natural-light microscopy");
  });
});
