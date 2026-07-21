import type { ImageEconomicsConfig } from "./platformClient";

export interface ImageEconomicsScenario {
  activePremiumUsers: number;
  averageImagesPerUser: number;
  averageImagesPerCourse: number;
  highQualityPercent: number;
  creditPackRevenueUsd: number;
  averageStoredMbPerImage: number;
}

export interface ImageEconomicsResult {
  images: number;
  premiumRevenueUsd: number;
  totalRevenueUsd: number;
  providerCostUsd: number;
  storageAndProcessingUsd: number;
  retryReserveUsd: number;
  paymentFeesUsd: number;
  supportReserveUsd: number;
  totalCostUsd: number;
  grossProfitUsd: number;
  grossMarginPercent: number;
  breakEvenImagesPerUser: number;
  warnings: string[];
}

const finite = (value: number, fallback = 0): number => Number.isFinite(value) ? value : fallback;

export const simulateImageEconomics = (
  config: ImageEconomicsConfig,
  scenario: ImageEconomicsScenario
): ImageEconomicsResult => {
  const users = Math.max(0, finite(scenario.activePremiumUsers));
  const imagesPerUser = Math.max(0, finite(scenario.averageImagesPerUser));
  const images = users * imagesPerUser;
  const highShare = Math.min(1, Math.max(0, finite(scenario.highQualityPercent) / 100));
  const averageProviderCost = config.mediumLandscapeCostUsd * (1 - highShare) + config.highLandscapeCostUsd * highShare;
  const premiumRevenueUsd = users * (config.premiumIncrementCents / 100);
  const totalRevenueUsd = premiumRevenueUsd + Math.max(0, finite(scenario.creditPackRevenueUsd));
  const providerCostUsd = images * averageProviderCost;
  const retryReserveUsd = providerCostUsd * Math.max(0, config.retryReservePercent) / 100;
  const storageGb = images * Math.max(0, finite(scenario.averageStoredMbPerImage)) / 1024;
  const storageAndProcessingUsd = storageGb * config.storageCostPerGbUsd + images * config.processingCostPerImageUsd;
  const paymentFeesUsd = totalRevenueUsd > 0
    ? totalRevenueUsd * config.paymentFeePercent / 100 + users * config.paymentFeeFixedUsd
    : 0;
  const supportReserveUsd = totalRevenueUsd * config.supportReservePercent / 100;
  const totalCostUsd = providerCostUsd + retryReserveUsd + storageAndProcessingUsd + paymentFeesUsd + supportReserveUsd;
  const grossProfitUsd = totalRevenueUsd - totalCostUsd;
  const grossMarginPercent = totalRevenueUsd > 0 ? grossProfitUsd / totalRevenueUsd * 100 : 0;
  const fixedPerUser = config.premiumIncrementCents / 100 * (config.paymentFeePercent + config.supportReservePercent) / 100 + config.paymentFeeFixedUsd;
  const variablePerImage = averageProviderCost * (1 + config.retryReservePercent / 100)
    + config.processingCostPerImageUsd
    + Math.max(0, finite(scenario.averageStoredMbPerImage)) / 1024 * config.storageCostPerGbUsd;
  const breakEvenImagesPerUser = variablePerImage > 0 ? Math.max(0, (config.premiumIncrementCents / 100 - fixedPerUser) / variablePerImage) : 0;
  const warnings: string[] = [];
  if (grossMarginPercent < config.targetGrossMarginPercent) warnings.push(`Projected margin is below the ${config.targetGrossMarginPercent}% target.`);
  if (users > 0 && providerCostUsd + retryReserveUsd > config.monthlyHardSpendUsd) warnings.push("Projected provider spend exceeds the monthly hard-spend limit.");
  if (imagesPerUser > config.includedCredits) warnings.push("Average usage exceeds included credits; confirm credit-pack conversion assumptions.");
  if (scenario.averageImagesPerCourse > config.maxImagesPerCourse) warnings.push("Average course usage exceeds the configured per-course limit.");
  return {
    images,
    premiumRevenueUsd,
    totalRevenueUsd,
    providerCostUsd,
    storageAndProcessingUsd,
    retryReserveUsd,
    paymentFeesUsd,
    supportReserveUsd,
    totalCostUsd,
    grossProfitUsd,
    grossMarginPercent,
    breakEvenImagesPerUser,
    warnings
  };
};
