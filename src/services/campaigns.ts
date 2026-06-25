// Pure, framework-free campaign logic shared by the public site, the signup function, and the
// Super Admin dashboard. The capacity rules here are the SAME ones the server enforces — the
// client may render an "open/waitlist/closed" state, but campaign-signup re-derives it from a
// trusted DB count before writing. No network/DB access in this module.

import { normalizeReferralCode } from "./referrals";

export type CampaignType = "semester_pilot" | "limited_discount" | "waitlist" | "private_invite";
export type CampaignStatus = "draft" | "active" | "paused" | "ended" | "archived";
export type CampaignPlacement = "homepage_hero" | "homepage_banner" | "pricing_page" | "modal" | "footer";
export type WhenFull = "waitlist" | "closed";
export type SignupOutcome = "open" | "waitlist" | "closed";

export interface Campaign {
  id: string;
  name: string;
  slug: string | null;
  type: CampaignType;
  headline: string | null;
  description: string | null;
  ctaText: string;
  status: CampaignStatus;
  placement: CampaignPlacement;
  startsAt: string | null;
  endsAt: string | null;
  maxSignups: number | null;
  whenFull: WhenFull;
  requireApproval: boolean;
  discountRecordId: string | null;
  planKey: string | null;
  webinarUrl: string | null;
  tutorialAt: string | null;
  audienceLabel: string | null;
  confirmationMessage: string | null;
  signupCount?: number;
  // --- Marketing offer + webinar + referral config (drives the dedicated landing page) ---
  subheadline?: string | null;
  offerSummary?: string | null;
  discountPercent?: number | null;
  discountDuration?: string | null;          // once | repeating | forever
  discountDurationMonths?: number | null;
  annualDiscountPercent?: number | null;
  stripeCouponId?: string | null;
  stripePromotionCodeId?: string | null;
  webinarTitle?: string | null;
  webinarDescription?: string | null;
  webinarAt?: string | null;
  webinarCapacity?: number | null;
  webinarRsvpStatus?: "open" | "closed" | "full" | null;
  referralRewardSummary?: string | null;
  referralThreshold?: number | null;
  referralRewardMonths?: number | null;
  referralReferredDiscountPercent?: number | null;
}

/**
 * Server-authoritative capacity rule. With no cap (null/<=0), always open. Otherwise open while
 * the count is under the cap; at/over the cap, fall to the campaign's when_full behavior.
 */
export const campaignSignupState = (
  maxSignups: number | null,
  currentCount: number,
  whenFull: WhenFull
): SignupOutcome => {
  if (maxSignups === null || maxSignups <= 0) return "open";
  if (currentCount < maxSignups) return "open";
  return whenFull === "closed" ? "closed" : "waitlist";
};

/** Remaining slots, or null when the campaign is uncapped. Never negative. */
export const remainingSlots = (maxSignups: number | null, currentCount: number): number | null =>
  maxSignups === null || maxSignups <= 0 ? null : Math.max(0, maxSignups - currentCount);

/** True when a campaign should be visible on the public site right now. */
export const isCampaignLive = (c: Pick<Campaign, "status" | "startsAt" | "endsAt">, now = new Date()): boolean => {
  if (c.status !== "active") return false;
  if (c.startsAt && new Date(c.startsAt).getTime() > now.getTime()) return false;
  if (c.endsAt && new Date(c.endsAt).getTime() < now.getTime()) return false;
  return true;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isValidEmail = (email: string): boolean => EMAIL_RE.test(email.trim());

export interface CampaignInput {
  name?: string;
  slug?: string | null;
  type?: string;
  headline?: string | null;
  description?: string | null;
  ctaText?: string | null;
  status?: string;
  placement?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  maxSignups?: number | string | null;
  whenFull?: string;
  requireApproval?: boolean;
  discountRecordId?: string | null;
  planKey?: string | null;
  webinarUrl?: string | null;
  tutorialAt?: string | null;
  audienceLabel?: string | null;
  confirmationMessage?: string | null;
  followupEmail?: string | null;
  subheadline?: string | null;
  offerSummary?: string | null;
  discountPercent?: number | string | null;
  discountDuration?: string | null;
  discountDurationMonths?: number | string | null;
  annualDiscountPercent?: number | string | null;
  stripeCouponId?: string | null;
  stripePromotionCodeId?: string | null;
  webinarTitle?: string | null;
  webinarDescription?: string | null;
  webinarAt?: string | null;
  webinarCapacity?: number | string | null;
  webinarRsvpStatus?: string | null;
  referralRewardSummary?: string | null;
  referralThreshold?: number | string | null;
  referralRewardMonths?: number | string | null;
  referralReferredDiscountPercent?: number | string | null;
}

export interface NormalizedCampaign {
  name: string;
  slug: string | null;
  type: CampaignType;
  headline: string | null;
  description: string | null;
  ctaText: string;
  status: CampaignStatus;
  placement: CampaignPlacement;
  startsAt: string | null;
  endsAt: string | null;
  maxSignups: number | null;
  whenFull: WhenFull;
  requireApproval: boolean;
  discountRecordId: string | null;
  planKey: string | null;
  webinarUrl: string | null;
  tutorialAt: string | null;
  audienceLabel: string | null;
  confirmationMessage: string | null;
  followupEmail: string | null;
  subheadline: string | null;
  offerSummary: string | null;
  discountPercent: number | null;
  discountDuration: "once" | "repeating" | "forever" | null;
  discountDurationMonths: number | null;
  annualDiscountPercent: number | null;
  stripeCouponId: string | null;
  stripePromotionCodeId: string | null;
  webinarTitle: string | null;
  webinarDescription: string | null;
  webinarAt: string | null;
  webinarCapacity: number | null;
  webinarRsvpStatus: "open" | "closed" | "full";
  referralRewardSummary: string | null;
  referralThreshold: number | null;
  referralRewardMonths: number | null;
  referralReferredDiscountPercent: number | null;
}

export type CampaignValidation = { ok: true; value: NormalizedCampaign } | { ok: false; error: string };

const TYPES: CampaignType[] = ["semester_pilot", "limited_discount", "waitlist", "private_invite"];
const STATUSES: CampaignStatus[] = ["draft", "active", "paused", "ended", "archived"];
const PLACEMENTS: CampaignPlacement[] = ["homepage_hero", "homepage_banner", "pricing_page", "modal", "footer"];

export const slugifyCampaign = (input: string): string =>
  input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48)
    .replace(/^-|-$/g, "");

/** Coerce an optional numeric input to an integer in [min,max], or null when blank/invalid. */
const toIntOrNull = (
  v: number | string | null | undefined,
  { min = 0, max = Number.MAX_SAFE_INTEGER }: { min?: number; max?: number } = {}
): number | null => {
  if (v === undefined || v === null || String(v).trim() === "") return null;
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
};

const DISCOUNT_DURATIONS = ["once", "repeating", "forever"] as const;
const RSVP_STATUSES = ["open", "closed", "full"] as const;

export const validateCampaignInput = (input: CampaignInput): CampaignValidation => {
  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, error: "Campaign name is required." };

  const type = TYPES.includes(input.type as CampaignType) ? (input.type as CampaignType) : "waitlist";
  const status = STATUSES.includes(input.status as CampaignStatus) ? (input.status as CampaignStatus) : "draft";
  const placement = PLACEMENTS.includes(input.placement as CampaignPlacement)
    ? (input.placement as CampaignPlacement)
    : "homepage_banner";
  const whenFull: WhenFull = input.whenFull === "closed" ? "closed" : "waitlist";

  let maxSignups: number | null = null;
  if (input.maxSignups !== undefined && input.maxSignups !== null && String(input.maxSignups) !== "") {
    const n = Math.floor(Number(input.maxSignups));
    if (!Number.isFinite(n) || n < 1) return { ok: false, error: "Max signups must be a positive whole number." };
    maxSignups = n;
  }

  const startsAt = input.startsAt ? new Date(input.startsAt) : null;
  const endsAt = input.endsAt ? new Date(input.endsAt) : null;
  if (startsAt && Number.isNaN(startsAt.getTime())) return { ok: false, error: "Start date is invalid." };
  if (endsAt && Number.isNaN(endsAt.getTime())) return { ok: false, error: "End date is invalid." };
  if (startsAt && endsAt && startsAt.getTime() >= endsAt.getTime()) {
    return { ok: false, error: "Start date must be before the end date." };
  }

  if (type === "limited_discount" && !input.discountRecordId) {
    return { ok: false, error: "A limited-discount campaign needs an associated discount code." };
  }

  return {
    ok: true,
    value: {
      name: name.slice(0, 160),
      slug: (input.slug ?? "").trim() ? slugifyCampaign(String(input.slug)) : slugifyCampaign(name),
      type,
      headline: (input.headline ?? "").trim() || null,
      description: (input.description ?? "").trim() || null,
      ctaText: (input.ctaText ?? "").trim() || "Request access",
      status,
      placement,
      startsAt: startsAt ? startsAt.toISOString() : null,
      endsAt: endsAt ? endsAt.toISOString() : null,
      maxSignups,
      whenFull,
      requireApproval: Boolean(input.requireApproval),
      discountRecordId: (input.discountRecordId ?? "").toString().trim() || null,
      planKey: (input.planKey ?? "").trim() || null,
      webinarUrl: (input.webinarUrl ?? "").trim() || null,
      tutorialAt: input.tutorialAt ? new Date(input.tutorialAt).toISOString() : null,
      audienceLabel: (input.audienceLabel ?? "").trim() || null,
      confirmationMessage: (input.confirmationMessage ?? "").trim() || null,
      followupEmail: (input.followupEmail ?? "").trim() || null,
      subheadline: (input.subheadline ?? "").trim() || null,
      offerSummary: (input.offerSummary ?? "").trim() || null,
      discountPercent: toIntOrNull(input.discountPercent, { min: 0, max: 100 }),
      discountDuration: DISCOUNT_DURATIONS.includes(input.discountDuration as (typeof DISCOUNT_DURATIONS)[number])
        ? (input.discountDuration as "once" | "repeating" | "forever")
        : null,
      discountDurationMonths: toIntOrNull(input.discountDurationMonths, { min: 1, max: 60 }),
      annualDiscountPercent: toIntOrNull(input.annualDiscountPercent, { min: 0, max: 100 }),
      stripeCouponId: (input.stripeCouponId ?? "").trim() || null,
      stripePromotionCodeId: (input.stripePromotionCodeId ?? "").trim() || null,
      webinarTitle: (input.webinarTitle ?? "").trim() || null,
      webinarDescription: (input.webinarDescription ?? "").trim() || null,
      webinarAt: input.webinarAt ? new Date(input.webinarAt).toISOString() : null,
      webinarCapacity: toIntOrNull(input.webinarCapacity, { min: 1, max: 100000 }),
      webinarRsvpStatus: RSVP_STATUSES.includes(input.webinarRsvpStatus as (typeof RSVP_STATUSES)[number])
        ? (input.webinarRsvpStatus as "open" | "closed" | "full")
        : "open",
      referralRewardSummary: (input.referralRewardSummary ?? "").trim() || null,
      referralThreshold: toIntOrNull(input.referralThreshold, { min: 1, max: 100 }),
      referralRewardMonths: toIntOrNull(input.referralRewardMonths, { min: 0, max: 36 }),
      referralReferredDiscountPercent: toIntOrNull(input.referralReferredDiscountPercent, { min: 0, max: 100 })
    }
  };
};

// ──────────────────────────────────────────────────────────────────────────
// Waitlist signup input — the richer public form on the dedicated landing page.
// ──────────────────────────────────────────────────────────────────────────
export interface WaitlistUtm {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  content?: string | null;
  term?: string | null;
}

export interface WaitlistInput {
  campaignId?: string | null;
  slug?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  institution?: string | null;
  role?: string | null;
  courseArea?: string | null;
  primaryUseCase?: string | null;
  painPoint?: string | null;
  wantsWebinarSeat?: boolean;
  consentToEmail?: boolean;
  referralCode?: string | null;
  utm?: WaitlistUtm;
  landingPagePath?: string | null;
}

export interface NormalizedWaitlist {
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  email: string;
  institution: string | null;
  role: string | null;
  courseArea: string | null;
  primaryUseCase: string | null;
  painPoint: string | null;
  wantsWebinarSeat: boolean;
  consentToEmail: boolean;
  referralCode: string | null;
  utm: { source: string | null; medium: string | null; campaign: string | null; content: string | null; term: string | null };
  landingPagePath: string | null;
}

export type WaitlistValidation = { ok: true; value: NormalizedWaitlist } | { ok: false; error: string };

const clip = (value: string | null | undefined, max: number): string | null => {
  const t = (value ?? "").trim();
  return t ? t.slice(0, max) : null;
};

/**
 * Validate + normalize a public waitlist submission. Email is the only hard requirement (the form
 * additionally gates submit on the consent checkbox); everything else is trimmed, length-capped, and
 * defaulted. The same normalizer runs on the client (instant feedback) and the server (authoritative).
 */
export const validateWaitlistInput = (input: WaitlistInput): WaitlistValidation => {
  const email = (input.email ?? "").trim().toLowerCase();
  if (!isValidEmail(email)) return { ok: false, error: "Please enter a valid email address." };

  const firstName = clip(input.firstName, 80);
  const lastName = clip(input.lastName, 80);
  const name = [firstName, lastName].filter(Boolean).join(" ") || null;

  return {
    ok: true,
    value: {
      firstName,
      lastName,
      name,
      email,
      institution: clip(input.institution, 200),
      role: clip(input.role, 120),
      courseArea: clip(input.courseArea, 160),
      primaryUseCase: clip(input.primaryUseCase, 160),
      painPoint: clip(input.painPoint, 2000),
      wantsWebinarSeat: Boolean(input.wantsWebinarSeat),
      consentToEmail: Boolean(input.consentToEmail),
      referralCode: normalizeReferralCode(input.referralCode),
      utm: {
        source: clip(input.utm?.source, 200),
        medium: clip(input.utm?.medium, 200),
        campaign: clip(input.utm?.campaign, 200),
        content: clip(input.utm?.content, 200),
        term: clip(input.utm?.term, 200)
      },
      landingPagePath: clip(input.landingPagePath, 300)
    }
  };
};

/** A built-in sample campaign so the offline/local demo splash shows the feature (no real data). */
export const SAMPLE_CAMPAIGN: Campaign = {
  id: "sample-campaign",
  name: "Fall 2026 Faculty Pilot",
  slug: "fall-2026-pilot",
  type: "limited_discount",
  headline: "Join the Fall 2026 RocketCourse pilot",
  description:
    "The first 50 instructors get 40% off an Individual Annual plan, a live onboarding webinar, and direct support building a Canvas-ready course.",
  ctaText: "Claim a pilot seat",
  status: "active",
  placement: "homepage_banner",
  startsAt: null,
  endsAt: null,
  maxSignups: 50,
  whenFull: "waitlist",
  requireApproval: false,
  discountRecordId: null,
  planKey: "individual_annual",
  webinarUrl: "https://example.com/webinar",
  tutorialAt: null,
  audienceLabel: "Faculty & instructional designers",
  confirmationMessage: "You're in! Check your email for the pilot discount code and webinar link.",
  signupCount: 12
};

/**
 * The seeded Founding Cohort campaign, mirrored here so the dedicated /founding-cohort landing page
 * is fully demo-able offline (no Supabase). When Supabase is configured the real row from the
 * 0011 seed (and any Super-Admin edits) takes precedence over this.
 */
export const FOUNDING_COHORT_SAMPLE: Campaign = {
  id: "sample-founding-cohort",
  name: "RocketCourse Founding Cohort",
  slug: "founding-cohort",
  type: "waitlist",
  headline: "Build your next Canvas course before your coffee gets cold.",
  subheadline:
    "RocketCourse helps instructors and instructional designers turn a course idea into an editable Canvas-oriented course shell with modules, assignments, discussions, quizzes, rubrics, and export-ready structure.",
  description: "Join the founding cohort for early access, a live AI course-building workshop, and a launch discount.",
  ctaText: "Join the Founding Cohort",
  status: "active",
  placement: "homepage_hero",
  startsAt: null,
  endsAt: null,
  maxSignups: null,
  whenFull: "waitlist",
  requireApproval: false,
  discountRecordId: null,
  planKey: "individual_annual",
  webinarUrl: "https://example.com/workshop",
  tutorialAt: null,
  audienceLabel: "Instructors & instructional designers",
  confirmationMessage:
    "You're in! Check your email for your founding-cohort details — your launch discount code and workshop link are on the way.",
  signupCount: 38,
  offerSummary:
    "40% off your first 3 months as a founding member — plus workshop access, early product access, and a launch discount code.",
  discountPercent: 40,
  discountDuration: "repeating",
  discountDurationMonths: 3,
  annualDiscountPercent: 30,
  stripeCouponId: null,
  stripePromotionCodeId: null,
  webinarTitle: "AI Course Building Workshop",
  webinarDescription:
    "A practical launch workshop showing how to move from a rough course idea to a structured Canvas course shell.",
  webinarAt: null,
  webinarCapacity: 100,
  webinarRsvpStatus: "open",
  referralRewardSummary: "Invite 3 colleagues, unlock one free month after launch.",
  referralThreshold: 3,
  referralRewardMonths: 1,
  referralReferredDiscountPercent: 10
};
