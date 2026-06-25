// Server-side campaign management (service role). Validation is the pure, unit-tested
// validateCampaignInput; this module owns slug-uniqueness and the DB writes. Called by the
// super-admin function, which adds the audit trail.

import { getSupabaseAdmin } from "./supabaseAdmin";
import { validateCampaignInput, type CampaignInput, type NormalizedCampaign } from "../../../src/services/campaigns";

export type CampaignResult = { ok: true; id?: string; slug?: string } | { ok: false; error: string; status?: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = ReturnType<typeof getSupabaseAdmin>;

const ensureUniqueSlug = async (admin: Admin, base: string, excludeId?: string): Promise<string> => {
  let slug = base || "campaign";
  for (let i = 0; i < 5; i += 1) {
    let q = admin.from("campaigns").select("id").eq("slug", slug);
    if (excludeId) q = q.neq("id", excludeId);
    const { data } = await q.maybeSingle();
    if (!data) return slug;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return slug;
};

const rowFromNormalized = (v: NormalizedCampaign, slug: string): Record<string, unknown> => ({
  name: v.name,
  slug,
  type: v.type,
  headline: v.headline,
  description: v.description,
  cta_text: v.ctaText,
  status: v.status,
  placement: v.placement,
  starts_at: v.startsAt,
  ends_at: v.endsAt,
  max_signups: v.maxSignups,
  when_full: v.whenFull,
  require_approval: v.requireApproval,
  discount_record_id: v.discountRecordId,
  plan_key: v.planKey,
  webinar_url: v.webinarUrl,
  tutorial_at: v.tutorialAt,
  audience_label: v.audienceLabel,
  confirmation_message: v.confirmationMessage,
  followup_email: v.followupEmail,
  subheadline: v.subheadline,
  offer_summary: v.offerSummary,
  discount_percent: v.discountPercent,
  discount_duration: v.discountDuration,
  discount_duration_months: v.discountDurationMonths,
  annual_discount_percent: v.annualDiscountPercent,
  stripe_coupon_id: v.stripeCouponId,
  stripe_promotion_code_id: v.stripePromotionCodeId,
  webinar_title: v.webinarTitle,
  webinar_description: v.webinarDescription,
  webinar_at: v.webinarAt,
  webinar_capacity: v.webinarCapacity,
  webinar_rsvp_status: v.webinarRsvpStatus,
  referral_reward_summary: v.referralRewardSummary,
  referral_threshold: v.referralThreshold,
  referral_reward_months: v.referralRewardMonths,
  referral_referred_discount_percent: v.referralReferredDiscountPercent
});

export const createCampaign = async (actorId: string, input: CampaignInput): Promise<CampaignResult> => {
  const valid = validateCampaignInput(input);
  if (!valid.ok) return { ok: false, error: valid.error, status: 400 };
  const admin = getSupabaseAdmin();
  const slug = await ensureUniqueSlug(admin, valid.value.slug ?? "campaign");
  const { data, error } = await admin
    .from("campaigns")
    .insert({ ...rowFromNormalized(valid.value, slug), created_by: actorId })
    .select("id,slug")
    .single();
  if (error) return { ok: false, error: error.message, status: 500 };
  return { ok: true, id: data?.id as string, slug: data?.slug as string };
};

export const updateCampaign = async (campaignId: string, input: CampaignInput): Promise<CampaignResult> => {
  const valid = validateCampaignInput(input);
  if (!valid.ok) return { ok: false, error: valid.error, status: 400 };
  const admin = getSupabaseAdmin();
  const slug = await ensureUniqueSlug(admin, valid.value.slug ?? "campaign", campaignId);
  const { error } = await admin.from("campaigns").update(rowFromNormalized(valid.value, slug)).eq("id", campaignId);
  if (error) return { ok: false, error: error.message, status: 500 };
  return { ok: true, id: campaignId, slug };
};

export const setCampaignStatus = async (
  campaignId: string,
  status: "draft" | "active" | "paused" | "ended" | "archived"
): Promise<CampaignResult> => {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("campaigns").update({ status }).eq("id", campaignId);
  if (error) return { ok: false, error: error.message, status: 500 };
  return { ok: true, id: campaignId };
};

export const setSignupStatus = async (
  signupId: string,
  status: "pending" | "approved" | "rejected" | "waitlisted" | "converted"
): Promise<CampaignResult> => {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("campaign_signups").update({ status }).eq("id", signupId);
  if (error) return { ok: false, error: error.message, status: 500 };
  return { ok: true, id: signupId };
};

const PIPELINE_STAGES = ["new", "contacted", "invited", "converted", "not_fit"] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];
export const isPipelineStage = (v: string): v is PipelineStage => PIPELINE_STAGES.includes(v as PipelineStage);

/** CRM pipeline stage + private admin notes for a waitlist entry. */
export const setSignupPipeline = async (
  signupId: string,
  fields: { pipelineStage?: PipelineStage; adminNotes?: string | null }
): Promise<CampaignResult> => {
  const patch: Record<string, unknown> = {};
  if (fields.pipelineStage) patch.pipeline_stage = fields.pipelineStage;
  if (fields.adminNotes !== undefined) patch.admin_notes = (fields.adminNotes ?? "").toString().slice(0, 4000) || null;
  if (Object.keys(patch).length === 0) return { ok: false, error: "Nothing to update.", status: 400 };
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("campaign_signups").update(patch).eq("id", signupId);
  if (error) return { ok: false, error: error.message, status: 500 };
  return { ok: true, id: signupId };
};

/** Manually assign a Stripe promotion code to a single waitlist entry. */
export const assignSignupPromo = async (signupId: string, promoCode: string | null): Promise<CampaignResult> => {
  const admin = getSupabaseAdmin();
  const value = (promoCode ?? "").toString().trim().slice(0, 120) || null;
  const { error } = await admin.from("campaign_signups").update({ assigned_stripe_promo_code: value }).eq("id", signupId);
  if (error) return { ok: false, error: error.message, status: 500 };
  return { ok: true, id: signupId };
};

const REFERRAL_EVENT_STATUSES = ["pending_signup", "signed_up", "paid", "rewarded", "disqualified"] as const;
export const isReferralEventStatus = (v: string): boolean =>
  (REFERRAL_EVENT_STATUSES as readonly string[]).includes(v);

/** Advance a referral event's status (e.g. signed_up → paid → rewarded) from the admin console. */
export const setReferralStatus = async (
  eventId: string,
  status: "pending_signup" | "signed_up" | "paid" | "rewarded" | "disqualified"
): Promise<CampaignResult> => {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("referral_events").update({ status }).eq("id", eventId);
  if (error) return { ok: false, error: error.message, status: 500 };
  return { ok: true, id: eventId };
};
