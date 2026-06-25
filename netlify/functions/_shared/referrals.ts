// Server-side referral graph writes (service role). The pure rules — code shape, self-referral,
// reward thresholds — live in src/services/referrals and are unit-tested; this module owns the
// DB-touching parts: minting a collision-free personal code and attributing one referral
// idempotently. Called by the campaign-signup function, which adds the audit trail.

import { getSupabaseAdmin } from "./supabaseAdmin";
import {
  deriveRewardStatus,
  generateReferralCode,
  normalizeEmail,
  type ReferralRewardStatus
} from "../../../src/services/referrals";

type Admin = ReturnType<typeof getSupabaseAdmin>;

/**
 * Mint a unique personal referral code for a signup and link it back onto the signup row.
 * Retries on the (astronomically rare) unique-index collision. Best-effort: returns null on a hard
 * failure so a referral hiccup can never block the signup itself.
 */
export const issueReferralCode = async (
  admin: Admin,
  params: { campaignId: string; signupId: string; email: string; rewardThreshold: number | null }
): Promise<string | null> => {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = generateReferralCode();
    const { error } = await admin.from("referral_codes").insert({
      code,
      campaign_id: params.campaignId,
      signup_id: params.signupId,
      email: normalizeEmail(params.email),
      uses_count: 0,
      reward_threshold: params.rewardThreshold,
      reward_status: "pending"
    });
    if (!error) {
      await admin.from("campaign_signups").update({ assigned_referral_code: code }).eq("id", params.signupId);
      return code;
    }
    // 23505 = unique violation → the code collided; try another. Anything else → give up quietly.
    if ((error as { code?: string }).code !== "23505") return null;
  }
  return null;
};

export interface AttributionResult {
  attributed: boolean;
  reason?: "invalid_code" | "self_referral" | "already_counted" | "error";
  referrerSignupId?: string | null;
  referrerEmail?: string | null;
  uses?: number;
  rewardEarned?: boolean;
}

/**
 * Attribute a referred signup to the code it arrived with. Idempotent: the unique index on
 * (referral_code_id, lower(referred_email)) means a duplicate attempt records nothing extra. Rejects
 * self-referral (same email). Bumps the referrer's use count and recomputes their reward status.
 */
export const attributeReferral = async (
  admin: Admin,
  params: { campaignId: string; code: string; referredSignupId: string; referredEmail: string }
): Promise<AttributionResult> => {
  const { data: owner } = await admin
    .from("referral_codes")
    .select("id,email,uses_count,reward_threshold,reward_status,signup_id")
    .eq("code", params.code)
    .eq("campaign_id", params.campaignId)
    .maybeSingle();
  if (!owner) return { attributed: false, reason: "invalid_code" };

  const referredEmail = normalizeEmail(params.referredEmail);
  if (normalizeEmail(owner.email as string) === referredEmail) {
    return { attributed: false, reason: "self_referral", referrerSignupId: (owner.signup_id as string) ?? null };
  }

  const { error: insErr } = await admin.from("referral_events").insert({
    campaign_id: params.campaignId,
    referral_code_id: owner.id,
    code: params.code,
    referrer_signup_id: owner.signup_id,
    referred_signup_id: params.referredSignupId,
    referred_email: referredEmail,
    status: "signed_up"
  });

  if (insErr) {
    // Duplicate (this email already counted for this code) → idempotent no-op.
    if ((insErr as { code?: string }).code === "23505") {
      return { attributed: false, reason: "already_counted", referrerSignupId: (owner.signup_id as string) ?? null };
    }
    return { attributed: false, reason: "error" };
  }

  const uses = ((owner.uses_count as number) ?? 0) + 1;
  const threshold = (owner.reward_threshold as number) ?? null;
  const rewardStatus: ReferralRewardStatus = deriveRewardStatus(
    uses,
    threshold,
    (owner.reward_status as ReferralRewardStatus) ?? "pending"
  );
  await admin.from("referral_codes").update({ uses_count: uses, reward_status: rewardStatus }).eq("id", owner.id);

  return {
    attributed: true,
    referrerSignupId: (owner.signup_id as string) ?? null,
    referrerEmail: (owner.email as string) ?? null,
    uses,
    rewardEarned: rewardStatus === "earned" || rewardStatus === "granted"
  };
};

/**
 * When a waitlist signer becomes a paid subscriber, mark their waitlist entries `converted` and
 * advance any inbound referral that brought them in from `signed_up` → `paid`. Matched by email
 * (campaign_signups stores it lowercased). Best-effort: returns the number of referrals advanced and
 * never throws, so it can't disrupt the Stripe webhook's billing writes. The referrer's reward
 * (e.g. a free month) is granted separately/manually so money never moves automatically.
 */
export const markReferredConverted = async (admin: Admin, email: string): Promise<number> => {
  const e = normalizeEmail(email);
  if (!e) return 0;
  const { data: signups } = await admin.from("campaign_signups").select("id").eq("email", e);
  const ids = (signups ?? []).map((s) => s.id as string);
  if (ids.length === 0) return 0;
  await admin.from("campaign_signups").update({ status: "converted" }).in("id", ids);
  const { data: advanced } = await admin
    .from("referral_events")
    .update({ status: "paid" })
    .in("referred_signup_id", ids)
    .in("status", ["pending_signup", "signed_up"])
    .select("id");
  return (advanced ?? []).length;
};
