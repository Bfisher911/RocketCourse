import { describe, expect, it } from "vitest";
import { can, imageCreditsRemaining, summarizeEntitlement, type EntitlementSubscription } from "./entitlement";

const premium = (patch: Partial<EntitlementSubscription> = {}): EntitlementSubscription => ({
  planKey: "rocketcourse_premium",
  status: "active",
  currentPeriodEnd: "2027-01-01T00:00:00.000Z",
  imageCreditsUsed: 0,
  ...patch
});

describe("Premium image entitlements", () => {
  const now = new Date("2026-07-20T12:00:00.000Z");

  it("allows Premium generation and starts with 50 credits", () => {
    expect(can("generate_image", premium(), now).allowed).toBe(true);
    expect(imageCreditsRemaining(premium())).toBe(50);
  });

  it("denies image generation when credits are exhausted", () => {
    const decision = can("generate_image", premium({ imageCreditsUsed: 50 }), now);
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe("image_credit_limit_reached");
  });

  it("folds append-only admin grants into remaining credits", () => {
    expect(imageCreditsRemaining(premium({ imageCreditsUsed: 49, imageCredits: 25 }))).toBe(26);
  });

  it("keeps ordinary paid plans upload-only", () => {
    const standard: EntitlementSubscription = { planKey: "monthly_instructor", status: "active", currentPeriodEnd: "2027-01-01T00:00:00.000Z" };
    const decision = can("generate_image", standard, now);
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe("plan_lacks_capability");
  });

  it("surfaces image usage in the shared entitlement summary", () => {
    const summary = summarizeEntitlement(premium({ imageCreditsUsed: 11 }), now);
    expect(summary.imageCreditsLimit).toBe(50);
    expect(summary.imageCreditsRemaining).toBe(39);
    expect(summary.canGenerateImages).toBe(true);
  });
});
