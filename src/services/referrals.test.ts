import { describe, expect, it } from "vitest";
import {
  buildReferralUrl,
  canAttributeReferral,
  deriveRewardStatus,
  generateReferralCode,
  isValidReferralCode,
  normalizeEmail,
  normalizeReferralCode,
  readReferralCodeFromQuery,
  referralProgress
} from "./referrals";

// A deterministic RNG that walks a fixed sequence, so generated codes are reproducible in tests.
const seededRand = (values: number[]): (() => number) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe("generateReferralCode", () => {
  it("produces an RC-prefixed 6-char code from the unambiguous alphabet", () => {
    const code = generateReferralCode(seededRand([0, 0.5, 0.99, 0.1, 0.3, 0.7]));
    expect(code).toMatch(/^RC-[0-9ABCDEFGHJKMNPQRSTVWXYZ]{6}$/);
    expect(isValidReferralCode(code)).toBe(true);
  });

  it("never emits ambiguous characters (I, L, O, U)", () => {
    // Sweep the whole alphabet by stepping rand across [0,1).
    for (let n = 0; n < 32; n += 1) {
      const code = generateReferralCode(() => n / 32);
      expect(code.slice(3)).not.toMatch(/[ILOU]/);
    }
  });

  it("is deterministic for a fixed RNG and varies with it", () => {
    const a = generateReferralCode(seededRand([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]));
    const b = generateReferralCode(seededRand([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]));
    const c = generateReferralCode(seededRand([0.9, 0.8, 0.7, 0.6, 0.5, 0.4]));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("isValidReferralCode / normalizeReferralCode", () => {
  it("accepts well-formed codes case-insensitively and upper-cases them", () => {
    expect(normalizeReferralCode("rc-7k2qf9")).toBe("RC-7K2QF9");
    expect(normalizeReferralCode("  RC-ABCDEF  ")).toBe("RC-ABCDEF");
  });
  it("rejects malformed or empty codes", () => {
    expect(isValidReferralCode("")).toBe(false);
    expect(isValidReferralCode("RC-123")).toBe(false); // too short
    expect(isValidReferralCode("XX-ABCDEF")).toBe(false); // wrong prefix
    expect(isValidReferralCode("RC-ABCDEI")).toBe(false); // contains ambiguous I
    expect(normalizeReferralCode("not-a-code")).toBeNull();
    expect(normalizeReferralCode(null)).toBeNull();
  });
});

describe("readReferralCodeFromQuery", () => {
  it("reads ?ref= and ?referral_code= and normalizes", () => {
    expect(readReferralCodeFromQuery("?ref=rc-7k2qf9")).toBe("RC-7K2QF9");
    expect(readReferralCodeFromQuery("utm_source=x&referral_code=RC-ABCDEF")).toBe("RC-ABCDEF");
  });
  it("returns null when absent or invalid", () => {
    expect(readReferralCodeFromQuery("")).toBeNull();
    expect(readReferralCodeFromQuery("?ref=garbage")).toBeNull();
    expect(readReferralCodeFromQuery("?utm_source=newsletter")).toBeNull();
  });
});

describe("buildReferralUrl", () => {
  it("joins origin + path + ?ref= cleanly regardless of trailing/leading slashes", () => {
    expect(buildReferralUrl("https://site.com/", "founding-cohort", "RC-7K2QF9")).toBe(
      "https://site.com/founding-cohort?ref=RC-7K2QF9"
    );
    expect(buildReferralUrl("https://site.com", "/founding-cohort", "RC-7K2QF9")).toBe(
      "https://site.com/founding-cohort?ref=RC-7K2QF9"
    );
  });
});

describe("canAttributeReferral (self-referral guard)", () => {
  it("rejects identical emails regardless of case/whitespace", () => {
    expect(canAttributeReferral("Pat@uni.edu", " pat@uni.edu ")).toBe(false);
    expect(normalizeEmail("  A@B.COM ")).toBe("a@b.com");
  });
  it("allows distinct emails and rejects missing data", () => {
    expect(canAttributeReferral("a@uni.edu", "b@uni.edu")).toBe(true);
    expect(canAttributeReferral("", "b@uni.edu")).toBe(false);
    expect(canAttributeReferral("a@uni.edu", null)).toBe(false);
  });
});

describe("referralProgress", () => {
  it("tracks progress toward a threshold", () => {
    expect(referralProgress(0, 3)).toMatchObject({ remaining: 3, earned: false, percent: 0 });
    expect(referralProgress(2, 3)).toMatchObject({ remaining: 1, earned: false, percent: 67 });
    expect(referralProgress(3, 3)).toMatchObject({ remaining: 0, earned: true, percent: 100 });
    expect(referralProgress(5, 3)).toMatchObject({ remaining: 0, earned: true, percent: 100 });
  });
  it("treats an absent/zero threshold as uncapped", () => {
    expect(referralProgress(4, null)).toMatchObject({ threshold: null, remaining: null, earned: true });
    expect(referralProgress(0, 0)).toMatchObject({ earned: false, percent: 100 });
  });
});

describe("deriveRewardStatus", () => {
  it("moves pending → earned at the threshold", () => {
    expect(deriveRewardStatus(2, 3)).toBe("pending");
    expect(deriveRewardStatus(3, 3)).toBe("earned");
  });
  it("never auto-reverts a terminal status", () => {
    expect(deriveRewardStatus(0, 3, "granted")).toBe("granted");
    expect(deriveRewardStatus(9, 3, "disqualified")).toBe("disqualified");
  });
});
