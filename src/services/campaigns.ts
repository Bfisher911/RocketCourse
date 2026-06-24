// Pure, framework-free campaign logic shared by the public site, the signup function, and the
// Super Admin dashboard. The capacity rules here are the SAME ones the server enforces — the
// client may render an "open/waitlist/closed" state, but campaign-signup re-derives it from a
// trusted DB count before writing. No network/DB access in this module.

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
      followupEmail: (input.followupEmail ?? "").trim() || null
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
