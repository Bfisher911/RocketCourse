import { describe, expect, it } from "vitest";
import {
  campaignSignupState,
  isCampaignLive,
  isValidEmail,
  remainingSlots,
  slugifyCampaign,
  validateCampaignInput,
  validateWaitlistInput
} from "./campaigns";

describe("campaignSignupState", () => {
  it("is open while under the cap", () => {
    expect(campaignSignupState(50, 0, "waitlist")).toBe("open");
    expect(campaignSignupState(50, 49, "waitlist")).toBe("open");
  });
  it("switches to waitlist at the cap when configured", () => {
    expect(campaignSignupState(50, 50, "waitlist")).toBe("waitlist");
    expect(campaignSignupState(50, 51, "waitlist")).toBe("waitlist");
  });
  it("switches to closed at the cap when configured", () => {
    expect(campaignSignupState(50, 50, "closed")).toBe("closed");
    expect(campaignSignupState(100, 100, "closed")).toBe("closed");
  });
  it("is always open when uncapped", () => {
    expect(campaignSignupState(null, 9999, "closed")).toBe("open");
    expect(campaignSignupState(0, 9999, "waitlist")).toBe("open");
  });
});

describe("remainingSlots", () => {
  it("counts down and never goes negative", () => {
    expect(remainingSlots(50, 10)).toBe(40);
    expect(remainingSlots(50, 50)).toBe(0);
    expect(remainingSlots(50, 60)).toBe(0);
  });
  it("is null when uncapped", () => {
    expect(remainingSlots(null, 10)).toBeNull();
    expect(remainingSlots(0, 10)).toBeNull();
  });
});

describe("isCampaignLive", () => {
  const now = new Date("2026-06-24T12:00:00Z");
  it("requires active status", () => {
    expect(isCampaignLive({ status: "draft", startsAt: null, endsAt: null }, now)).toBe(false);
    expect(isCampaignLive({ status: "active", startsAt: null, endsAt: null }, now)).toBe(true);
  });
  it("respects the date window", () => {
    expect(isCampaignLive({ status: "active", startsAt: "2026-07-01T00:00:00Z", endsAt: null }, now)).toBe(false);
    expect(isCampaignLive({ status: "active", startsAt: null, endsAt: "2026-06-01T00:00:00Z" }, now)).toBe(false);
    expect(isCampaignLive({ status: "active", startsAt: "2026-06-01T00:00:00Z", endsAt: "2026-07-01T00:00:00Z" }, now)).toBe(true);
  });
});

describe("isValidEmail", () => {
  it("accepts well-formed emails", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("prof.name@university.edu")).toBe(true);
  });
  it("rejects malformed emails", () => {
    expect(isValidEmail("nope")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("@b.co")).toBe(false);
  });
});

describe("slugifyCampaign", () => {
  it("produces a url-safe slug", () => {
    expect(slugifyCampaign("Fall 2026 Faculty Pilot!")).toBe("fall-2026-faculty-pilot");
  });
});

describe("validateCampaignInput", () => {
  const ok = (r: ReturnType<typeof validateCampaignInput>) => {
    if (!r.ok) throw new Error(r.error);
    return r.value;
  };

  it("requires a name", () => {
    expect(validateCampaignInput({}).ok).toBe(false);
  });
  it("normalizes a basic waitlist campaign and auto-slugs", () => {
    const v = ok(validateCampaignInput({ name: "Spring Waitlist", type: "waitlist", status: "active" }));
    expect(v.slug).toBe("spring-waitlist");
    expect(v.type).toBe("waitlist");
    expect(v.whenFull).toBe("waitlist");
    expect(v.ctaText).toBe("Request access");
  });
  it("rejects a non-positive max signups", () => {
    expect(validateCampaignInput({ name: "X", maxSignups: 0 }).ok).toBe(false);
  });
  it("rejects start >= end", () => {
    expect(
      validateCampaignInput({ name: "X", startsAt: "2026-08-01T00:00:00Z", endsAt: "2026-07-01T00:00:00Z" }).ok
    ).toBe(false);
  });
  it("requires a discount for a limited_discount campaign", () => {
    expect(validateCampaignInput({ name: "First 50", type: "limited_discount" }).ok).toBe(false);
    expect(validateCampaignInput({ name: "First 50", type: "limited_discount", discountRecordId: "abc" }).ok).toBe(true);
  });

  it("normalizes the marketing offer + webinar + referral config", () => {
    const v = validateCampaignInput({
      name: "Founding Cohort",
      discountPercent: "40",
      discountDuration: "repeating",
      discountDurationMonths: "3",
      annualDiscountPercent: 30,
      webinarRsvpStatus: "open",
      webinarCapacity: "100",
      referralThreshold: 3,
      referralRewardMonths: 1,
      referralReferredDiscountPercent: 10
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value.discountPercent).toBe(40);
    expect(v.value.discountDuration).toBe("repeating");
    expect(v.value.discountDurationMonths).toBe(3);
    expect(v.value.annualDiscountPercent).toBe(30);
    expect(v.value.webinarRsvpStatus).toBe("open");
    expect(v.value.referralThreshold).toBe(3);
  });

  it("clamps percentages to 0–100 and rejects invalid duration/rsvp", () => {
    const v = validateCampaignInput({ name: "X", discountPercent: 250, discountDuration: "weird", webinarRsvpStatus: "bogus" });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value.discountPercent).toBe(100);
    expect(v.value.discountDuration).toBeNull();
    expect(v.value.webinarRsvpStatus).toBe("open"); // safe default
  });
});

describe("validateWaitlistInput", () => {
  it("requires a valid email", () => {
    expect(validateWaitlistInput({ email: "not-an-email" }).ok).toBe(false);
    expect(validateWaitlistInput({ email: "" }).ok).toBe(false);
    expect(validateWaitlistInput({ email: "person@uni.edu" }).ok).toBe(true);
  });

  it("lowercases email, builds a combined name, and coerces booleans", () => {
    const v = validateWaitlistInput({
      firstName: "  Pat ",
      lastName: "Lee",
      email: "Pat@UNI.edu",
      wantsWebinarSeat: true,
      consentToEmail: true
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value.email).toBe("pat@uni.edu");
    expect(v.value.name).toBe("Pat Lee");
    expect(v.value.wantsWebinarSeat).toBe(true);
    expect(v.value.consentToEmail).toBe(true);
  });

  it("normalizes the referral code and passes through UTM fields", () => {
    const v = validateWaitlistInput({
      email: "a@b.edu",
      referralCode: "rc-7k2qf9",
      utm: { source: "newsletter", medium: "email", campaign: "founding" }
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value.referralCode).toBe("RC-7K2QF9");
    expect(v.value.utm.source).toBe("newsletter");
    expect(v.value.utm.term).toBeNull();
  });

  it("drops an invalid referral code rather than failing the signup", () => {
    const v = validateWaitlistInput({ email: "a@b.edu", referralCode: "garbage" });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value.referralCode).toBeNull();
  });
});
