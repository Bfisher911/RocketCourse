// Pure, framework-free referral logic shared by the public landing page, the campaign-signup
// server function, and the Super Admin dashboard. No network or DB access lives here so every rule
// is unit-testable. The server is always authoritative: it re-derives attribution against trusted
// DB rows before writing a referral_event, exactly as it does for campaign capacity.

export type ReferralEventStatus = "pending_signup" | "signed_up" | "paid" | "rewarded" | "disqualified";
export type ReferralRewardStatus = "pending" | "earned" | "granted" | "disqualified";

// Crockford base32 minus ambiguous glyphs (I, L, O, U) so codes are easy to read aloud and type.
const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_PREFIX = "RC";
const CODE_BODY_LENGTH = 6;

/** Lowercased, trimmed email — the canonical key for de-dupe and self-referral checks. */
export const normalizeEmail = (email: string | null | undefined): string => (email ?? "").trim().toLowerCase();

/**
 * Generate a short, human-friendly, hard-to-guess personal referral code (e.g. "RC-7K2QF9").
 * `rand` is injectable so tests are deterministic; production passes Math.random. Collisions are
 * astronomically unlikely (32^6 ≈ 1.07e9) and are caught by the DB unique index + a retry anyway.
 */
export const generateReferralCode = (rand: () => number = Math.random): string => {
  let body = "";
  for (let i = 0; i < CODE_BODY_LENGTH; i += 1) {
    const idx = Math.min(CODE_ALPHABET.length - 1, Math.max(0, Math.floor(rand() * CODE_ALPHABET.length)));
    body += CODE_ALPHABET[idx];
  }
  return `${CODE_PREFIX}-${body}`;
};

/** A referral code is well-formed if it matches the generator's shape (case-insensitive). */
export const isValidReferralCode = (code: string | null | undefined): boolean =>
  /^RC-[0-9ABCDEFGHJKMNPQRSTVWXYZ]{6}$/i.test((code ?? "").trim());

/** Normalize a submitted referral code to canonical upper-case form, or null when absent/invalid. */
export const normalizeReferralCode = (code: string | null | undefined): string | null => {
  const trimmed = (code ?? "").trim().toUpperCase();
  return isValidReferralCode(trimmed) ? trimmed : null;
};

/** Read a referral code from a URL query string (?ref=…, with ?referral_code=… as a fallback). */
export const readReferralCodeFromQuery = (search: string): string | null => {
  if (!search) return null;
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  return normalizeReferralCode(params.get("ref") ?? params.get("referral_code"));
};

/** Absolute, shareable referral link for a code (e.g. https://site/founding-cohort?ref=RC-7K2QF9). */
export const buildReferralUrl = (origin: string, path: string, code: string): string => {
  const cleanOrigin = origin.replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${cleanOrigin}${cleanPath}?ref=${encodeURIComponent(code)}`;
};

/**
 * Whether a referral can be attributed. Rejects self-referral (same normalized email) and missing
 * data. This is the client-visible rule; the server additionally rejects when the code's owner
 * cannot be found or the referred email already counted against this code.
 */
export const canAttributeReferral = (
  referrerEmail: string | null | undefined,
  referredEmail: string | null | undefined
): boolean => {
  const referrer = normalizeEmail(referrerEmail);
  const referred = normalizeEmail(referredEmail);
  if (!referrer || !referred) return false;
  return referrer !== referred;
};

export interface ReferralProgress {
  uses: number;
  threshold: number | null;
  remaining: number | null;
  earned: boolean;
  /** 0–100 for a progress bar; 100 when there is no threshold (nothing to chase). */
  percent: number;
}

/** Referrer progress toward the reward (e.g. "2 of 3 invites"). Uncapped → already "earned". */
export const referralProgress = (uses: number, threshold: number | null | undefined): ReferralProgress => {
  const safeUses = Math.max(0, Math.floor(uses || 0));
  if (threshold === null || threshold === undefined || threshold <= 0) {
    return { uses: safeUses, threshold: null, remaining: null, earned: safeUses > 0, percent: 100 };
  }
  const remaining = Math.max(0, threshold - safeUses);
  return {
    uses: safeUses,
    threshold,
    remaining,
    earned: safeUses >= threshold,
    percent: Math.min(100, Math.round((safeUses / threshold) * 100))
  };
};

/** The reward_status a referral code should hold given its use count and threshold (pre-grant). */
export const deriveRewardStatus = (
  uses: number,
  threshold: number | null | undefined,
  current: ReferralRewardStatus = "pending"
): ReferralRewardStatus => {
  if (current === "granted" || current === "disqualified") return current; // terminal — never auto-revert
  return referralProgress(uses, threshold).earned ? "earned" : "pending";
};
