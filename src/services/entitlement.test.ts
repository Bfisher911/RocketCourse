import { describe, expect, it } from "vitest";
import { plans, planByKey, getPlan, formatPlanPrice, type PlanKey } from "../data/plans";
import {
  aiGenerationsRemaining,
  allows,
  can,
  exportsRemaining,
  freeSubscription,
  isSubscriptionActive,
  summarizeEntitlement,
  type EntitlementSubscription
} from "./entitlement";

const NOW = new Date("2026-06-21T12:00:00.000Z");
const future = new Date("2026-12-01T00:00:00.000Z").toISOString();
const past = new Date("2026-01-01T00:00:00.000Z").toISOString();

const sub = (over: Partial<EntitlementSubscription> & { planKey: PlanKey }): EntitlementSubscription => ({
  status: "active",
  currentPeriodEnd: future,
  exportsUsed: 0,
  aiGenerationsUsed: 0,
  ...over
});

describe("plans catalog", () => {
  it("has a unique key and non-negative order for every plan", () => {
    const keys = plans.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const plan of plans) {
      expect(plan.order).toBeGreaterThanOrEqual(0);
      expect(planByKey[plan.key]).toBe(plan);
    }
  });

  it("covers every required pricing tier from the PRD", () => {
    const required: PlanKey[] = [
      "free_preview",
      "individual_semester",
      "individual_annual",
      "monthly_instructor",
      "designer_pro",
      "team",
      "department_pilot",
      "institution"
    ];
    for (const key of required) expect(planByKey[key]).toBeDefined();
  });

  it("prices the semester pass at $79 one-time granting 4 months", () => {
    const semester = getPlan("individual_semester");
    expect(semester.priceCents).toBe(7900);
    expect(semester.billingInterval).toBe("one_time");
    expect(semester.checkoutMode).toBe("payment");
    expect(semester.entitlementMonths).toBe(4);
  });

  it("formats prices for each billing interval", () => {
    expect(formatPlanPrice(getPlan("free_preview"))).toBe("Free");
    expect(formatPlanPrice(getPlan("monthly_instructor"))).toBe("$29/mo");
    expect(formatPlanPrice(getPlan("individual_annual"))).toBe("$199/yr");
    expect(formatPlanPrice(getPlan("individual_semester"))).toBe("$79");
    expect(formatPlanPrice(getPlan("institution"))).toBe("Contact sales");
  });

  it("self-serve paid plans declare a Stripe price env var", () => {
    for (const plan of plans) {
      if (plan.checkoutMode === "subscription" || plan.checkoutMode === "payment") {
        expect(plan.stripePriceEnvVar, `${plan.key} needs a Stripe price env var`).toBeTruthy();
      }
    }
  });

  it("free plan grants no paid capabilities", () => {
    const free = getPlan("free_preview");
    expect(free.capabilities.aiGeneration).toBe(false);
    expect(free.capabilities.privateExport).toBe(false);
    expect(free.capabilities.privateProjects).toBe(false);
  });
});

describe("isSubscriptionActive", () => {
  it("is false for a free/no subscription", () => {
    expect(isSubscriptionActive(freeSubscription(), NOW)).toBe(false);
  });

  it("is true for an active subscription with a future period end", () => {
    expect(isSubscriptionActive(sub({ planKey: "individual_annual" }), NOW)).toBe(true);
  });

  it("is false once the period has lapsed (semester pass expiry)", () => {
    expect(isSubscriptionActive(sub({ planKey: "individual_semester", currentPeriodEnd: past }), NOW)).toBe(false);
  });

  it("is false for past_due / canceled statuses", () => {
    expect(isSubscriptionActive(sub({ planKey: "individual_annual", status: "past_due" }), NOW)).toBe(false);
    expect(isSubscriptionActive(sub({ planKey: "individual_annual", status: "canceled" }), NOW)).toBe(false);
  });

  it("treats trialing as active", () => {
    expect(isSubscriptionActive(sub({ planKey: "individual_annual", status: "trialing" }), NOW)).toBe(true);
  });
});

describe("can() — capability gating", () => {
  it("blocks AI generation and export for free users", () => {
    const free = freeSubscription();
    expect(can("generate_blueprint", free, NOW).allowed).toBe(false);
    expect(can("generate_full_course", free, NOW).code).toBe("no_active_subscription");
    expect(can("export", free, NOW).allowed).toBe(false);
    expect(can("create_project", free, NOW).allowed).toBe(false);
  });

  it("allows AI generation and export for an active paid user with remaining credits", () => {
    const paid = sub({ planKey: "individual_semester" });
    expect(allows("generate_blueprint", paid, NOW)).toBe(true);
    expect(allows("generate_full_course", paid, NOW)).toBe(true);
    expect(allows("export", paid, NOW)).toBe(true);
    expect(allows("create_project", paid, NOW)).toBe(true);
    expect(allows("create_custom_theme", paid, NOW)).toBe(true);
  });

  it("allows dashboard access regardless of plan (gating is per-action)", () => {
    expect(allows("access_dashboard", freeSubscription(), NOW)).toBe(true);
  });

  it("blocks team workspace creation unless the plan includes it", () => {
    expect(allows("create_team_workspace", sub({ planKey: "individual_annual" }), NOW)).toBe(false);
    expect(allows("create_team_workspace", sub({ planKey: "team" }), NOW)).toBe(true);
  });
});

describe("can() — usage limits", () => {
  it("blocks AI generation when the limit is reached", () => {
    const maxed = sub({ planKey: "individual_semester", aiGenerationsUsed: 10 });
    const decision = can("generate_full_course", maxed, NOW);
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe("ai_limit_reached");
  });

  it("blocks export when the export limit is reached", () => {
    const maxed = sub({ planKey: "individual_semester", exportsUsed: 15 });
    const decision = can("export", maxed, NOW);
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe("export_limit_reached");
  });

  it("computes remaining credits, clamped at zero, null = unlimited", () => {
    expect(aiGenerationsRemaining(sub({ planKey: "individual_semester", aiGenerationsUsed: 3 }))).toBe(7);
    expect(exportsRemaining(sub({ planKey: "individual_semester", exportsUsed: 20 }))).toBe(0);
    expect(aiGenerationsRemaining(sub({ planKey: "designer_pro", aiGenerationsUsed: 50 }))).toBe(50);
    // department_pilot has null (unlimited) limits
    expect(aiGenerationsRemaining(sub({ planKey: "department_pilot", aiGenerationsUsed: 999 }))).toBeNull();
    expect(exportsRemaining(sub({ planKey: "department_pilot", exportsUsed: 999 }))).toBeNull();
  });

  it("honors per-subscription limit overrides", () => {
    const overridden = sub({ planKey: "individual_semester", aiGenerationsUsed: 12, aiGenerationsLimitOverride: 20 });
    expect(aiGenerationsRemaining(overridden)).toBe(8);
    expect(allows("generate_full_course", overridden, NOW)).toBe(true);
  });

  it("adds granted credits on top of the plan limit (additive, not override)", () => {
    // individual_semester: 15 exports. Used all 15, but +5 export credits → 5 remaining.
    const exportCredited = sub({ planKey: "individual_semester", exportsUsed: 15, exportCredits: 5 });
    expect(exportsRemaining(exportCredited)).toBe(5);
    expect(allows("export", exportCredited, NOW)).toBe(true);
    // 10 AI gens, all used, +3 credits → 3 remaining.
    const aiCredited = sub({ planKey: "individual_semester", aiGenerationsUsed: 10, aiCredits: 3 });
    expect(aiGenerationsRemaining(aiCredited)).toBe(3);
    expect(allows("generate_full_course", aiCredited, NOW)).toBe(true);
    // credits never make an unlimited plan finite
    expect(exportsRemaining(sub({ planKey: "department_pilot", exportsUsed: 999, exportCredits: 10 }))).toBeNull();
  });

  it("denies once an expired paid plan lapses even with credits left", () => {
    const expired = sub({ planKey: "individual_semester", currentPeriodEnd: past, aiGenerationsUsed: 0 });
    expect(can("generate_full_course", expired, NOW).code).toBe("no_active_subscription");
  });
});

describe("summarizeEntitlement", () => {
  it("produces a dashboard-ready snapshot for a paid user", () => {
    const summary = summarizeEntitlement(sub({ planKey: "individual_annual", aiGenerationsUsed: 5, exportsUsed: 2 }), NOW);
    expect(summary.planName).toBe("Individual Annual");
    expect(summary.active).toBe(true);
    expect(summary.aiGenerationsRemaining).toBe(25);
    expect(summary.exportsRemaining).toBe(48);
    expect(summary.canGenerate).toBe(true);
    expect(summary.canExport).toBe(true);
  });

  it("produces a locked snapshot for a free user", () => {
    const summary = summarizeEntitlement(freeSubscription(), NOW);
    expect(summary.active).toBe(false);
    expect(summary.canGenerate).toBe(false);
    expect(summary.canExport).toBe(false);
    expect(summary.canCreateProject).toBe(false);
  });
});
