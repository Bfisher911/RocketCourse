import { describe, expect, it } from "vitest";
import { normalizeCode, validateDiscountInput } from "./discountValidation";

const ok = (r: ReturnType<typeof validateDiscountInput>) => {
  if (!r.ok) throw new Error(`expected ok, got error: ${r.error}`);
  return r.value;
};

describe("normalizeCode", () => {
  it("uppercases and strips invalid chars", () => {
    expect(normalizeCode("launch 20!")).toBe("LAUNCH20");
    expect(normalizeCode("save-50_now")).toBe("SAVE-50_NOW");
  });
  it("returns null for empty/garbage", () => {
    expect(normalizeCode("")).toBeNull();
    expect(normalizeCode("!!!")).toBeNull();
    expect(normalizeCode(null)).toBeNull();
  });
  it("caps length at 40", () => {
    expect(normalizeCode("A".repeat(60))?.length).toBe(40);
  });
});

describe("validateDiscountInput — percent", () => {
  it("accepts a valid percent", () => {
    const v = ok(validateDiscountInput({ name: "Launch 20", discountType: "percent", percentOff: 20, duration: "once" }));
    expect(v.percentOff).toBe(20);
    expect(v.amountOffCents).toBeNull();
    expect(v.discountType).toBe("percent");
  });
  it("rejects percent <= 0 or > 100", () => {
    expect(validateDiscountInput({ discountType: "percent", percentOff: 0 }).ok).toBe(false);
    expect(validateDiscountInput({ discountType: "percent", percentOff: 101 }).ok).toBe(false);
    expect(validateDiscountInput({ discountType: "percent", percentOff: -5 }).ok).toBe(false);
  });
  it("allows up to 2 decimal places", () => {
    expect(ok(validateDiscountInput({ discountType: "percent", percentOff: 12.5 })).percentOff).toBe(12.5);
  });
});

describe("validateDiscountInput — fixed amount", () => {
  it("normalizes dollars to cents and requires a currency", () => {
    const v = ok(validateDiscountInput({ discountType: "amount", amountOff: 15, currency: "usd", duration: "once" }));
    expect(v.amountOffCents).toBe(1500);
    expect(v.currency).toBe("usd");
    expect(v.percentOff).toBeNull();
  });
  it("rejects a fixed amount with no currency", () => {
    const r = validateDiscountInput({ discountType: "amount", amountOff: 15 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/currency/i);
  });
  it("rejects a non-positive amount", () => {
    expect(validateDiscountInput({ discountType: "amount", amountOff: 0, currency: "usd" }).ok).toBe(false);
  });
  it("rejects a malformed currency", () => {
    expect(validateDiscountInput({ discountType: "amount", amountOff: 10, currency: "dollars" }).ok).toBe(false);
  });
});

describe("validateDiscountInput — duration", () => {
  it("requires durationInMonths for repeating", () => {
    const r = validateDiscountInput({ discountType: "percent", percentOff: 10, duration: "repeating" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/month/i);
  });
  it("accepts repeating with months", () => {
    const v = ok(validateDiscountInput({ discountType: "percent", percentOff: 10, duration: "repeating", durationInMonths: 3 }));
    expect(v.duration).toBe("repeating");
    expect(v.durationInMonths).toBe(3);
  });
  it("ignores months for once/forever", () => {
    expect(ok(validateDiscountInput({ discountType: "percent", percentOff: 10, duration: "forever", durationInMonths: 5 })).durationInMonths).toBeNull();
  });
});

describe("validateDiscountInput — limits + dates + targeting", () => {
  it("rejects non-positive max redemptions / per-customer limit", () => {
    expect(validateDiscountInput({ discountType: "percent", percentOff: 10, maxRedemptions: 0 }).ok).toBe(false);
    expect(validateDiscountInput({ discountType: "percent", percentOff: 10, perCustomerLimit: -1 }).ok).toBe(false);
  });
  it("accepts positive limits", () => {
    const v = ok(validateDiscountInput({ discountType: "percent", percentOff: 10, maxRedemptions: 50, perCustomerLimit: 1 }));
    expect(v.maxRedemptions).toBe(50);
    expect(v.perCustomerLimit).toBe(1);
  });
  it("rejects start >= end", () => {
    const r = validateDiscountInput({
      discountType: "percent",
      percentOff: 10,
      startsAt: "2026-08-01T00:00:00Z",
      endsAt: "2026-07-01T00:00:00Z"
    });
    expect(r.ok).toBe(false);
  });
  it("rejects an unknown plan", () => {
    expect(validateDiscountInput({ discountType: "percent", percentOff: 10, appliesToPlan: "not_a_plan" }).ok).toBe(false);
  });
  it("accepts a known plan and 'all'", () => {
    expect(ok(validateDiscountInput({ discountType: "percent", percentOff: 10, appliesToPlan: "team" })).appliesToPlan).toBe("team");
    expect(ok(validateDiscountInput({ discountType: "percent", percentOff: 10, appliesToPlan: "all" })).appliesToPlan).toBeNull();
  });
  it("rejects an unknown interval and defaults visibility", () => {
    expect(validateDiscountInput({ discountType: "percent", percentOff: 10, appliesToInterval: "weekly" }).ok).toBe(false);
    expect(ok(validateDiscountInput({ discountType: "percent", percentOff: 10 })).visibility).toBe("public");
  });
});
