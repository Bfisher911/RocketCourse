import { describe, expect, it } from "vitest";
import { DEFAULT_IMAGE_ECONOMICS } from "./platformClient";
import { simulateImageEconomics } from "./imageEconomics";

describe("image economics simulator", () => {
  it("includes provider, retry, storage, processing, payment, and support costs", () => {
    const result = simulateImageEconomics(DEFAULT_IMAGE_ECONOMICS, {
      activePremiumUsers: 100,
      averageImagesPerUser: 20,
      averageImagesPerCourse: 8,
      highQualityPercent: 10,
      creditPackRevenueUsd: 0,
      averageStoredMbPerImage: 0.4
    });
    expect(result.images).toBe(2000);
    expect(result.totalCostUsd).toBeGreaterThan(result.providerCostUsd);
    expect(result.grossMarginPercent).toBeGreaterThan(70);
    expect(result.breakEvenImagesPerUser).toBeGreaterThan(20);
  });

  it("warns when a high-usage scenario misses the margin target", () => {
    const result = simulateImageEconomics(DEFAULT_IMAGE_ECONOMICS, {
      activePremiumUsers: 100,
      averageImagesPerUser: 50,
      averageImagesPerCourse: 20,
      highQualityPercent: 25,
      creditPackRevenueUsd: 0,
      averageStoredMbPerImage: 0.5
    });
    expect(result.warnings.join(" ")).toMatch(/below the 70% target/i);
  });
});
