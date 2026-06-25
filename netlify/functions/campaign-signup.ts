// POST /.netlify/functions/campaign-signup — PUBLIC waitlist signup (no auth required; an optional
// Bearer token links the signup to a user). The max-signup cap and waitlist/closed switch are
// enforced HERE against a trusted DB count — the client's view is advisory only. When a campaign
// links a Stripe-backed discount and a slot is open, the code is issued/reserved to the signup.
// Every signup mints a personal referral code; an inbound referral code is attributed (server-side,
// self-referral-guarded). Every signup is audit-logged.

import { getAuthedUser, json } from "./_shared/http";
import { getSupabaseAdmin } from "./_shared/supabaseAdmin";
import { createAuditLog } from "./_shared/guards";
import { sendEmail } from "./_shared/email";
import { attributeReferral, issueReferralCode } from "./_shared/referrals";
import { campaignSignupState, isCampaignLive, validateWaitlistInput, type WaitlistInput } from "../../src/services/campaigns";
import { buildReferralUrl } from "../../src/services/referrals";
import { buildWaitlistWelcomeEmail } from "../../src/services/campaignEmail";

declare const process: { env: Record<string, string | undefined> };

interface SignupBody extends WaitlistInput {
  // Legacy fields kept for the existing homepage CampaignBanner form.
  name?: string;
  notes?: string;
  referralSource?: string;
}

export default async (request: Request): Promise<Response> => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed. Use POST." });

  let body: SignupBody;
  try {
    body = (await request.json()) as SignupBody;
  } catch {
    return json(400, { error: "Body must be JSON." });
  }

  // Validate + normalize the richer waitlist payload (email is the only hard requirement).
  const valid = validateWaitlistInput(body);
  if (!valid.ok) return json(400, { error: valid.error });
  const w = valid.value;
  const email = w.email;

  const admin = getSupabaseAdmin();

  // Resolve the campaign by id or public slug.
  let query = admin
    .from("campaigns")
    .select(
      "id,name,slug,type,status,starts_at,ends_at,max_signups,when_full,require_approval,discount_record_id,confirmation_message,webinar_url,webinar_title,webinar_at,tutorial_at,referral_threshold,discount_percent,discount_duration_months,referral_reward_summary"
    );
  if (body.campaignId) query = query.eq("id", body.campaignId);
  else if (body.slug) query = query.eq("slug", body.slug);
  else return json(400, { error: "A campaign id or slug is required." });

  const { data: campaign } = await query.maybeSingle();
  if (!campaign) return json(404, { error: "Campaign not found." });

  // Server-side liveness gate (status + window).
  if (
    !isCampaignLive({
      status: campaign.status as "active",
      startsAt: campaign.starts_at as string | null,
      endsAt: campaign.ends_at as string | null
    })
  ) {
    return json(403, { error: "This campaign is not currently accepting signups." });
  }

  const optionalUser = await getAuthedUser(request); // null when no token; links the signup if present

  // Authoritative count → capacity decision. Rejected signups don't consume a slot.
  const { count } = await admin
    .from("campaign_signups")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaign.id)
    .neq("status", "rejected");
  const currentCount = count ?? 0;

  const outcome = campaignSignupState(
    (campaign.max_signups as number) ?? null,
    currentCount,
    (campaign.when_full as "waitlist" | "closed") ?? "waitlist"
  );
  if (outcome === "closed") {
    return json(200, { ok: true, outcome: "closed", message: "This campaign is full and is no longer accepting signups." });
  }

  // Issue/reserve the linked discount code only when a real slot is open (the "first N" gate).
  let discountCode: string | null = null;
  if (outcome === "open" && campaign.discount_record_id) {
    const { data: disc } = await admin
      .from("discount_code_records")
      .select("code,status,active")
      .eq("id", campaign.discount_record_id)
      .maybeSingle();
    if (disc && (disc.active || disc.status === "active")) discountCode = (disc.code as string) ?? null;
  }

  const requireApproval = Boolean(campaign.require_approval);
  const status = outcome === "waitlist" ? "waitlisted" : requireApproval ? "pending" : "approved";

  const row = {
    campaign_id: campaign.id,
    first_name: w.firstName,
    last_name: w.lastName,
    // Prefer the first/last from the rich form; fall back to the legacy single `name` (the homepage
    // CampaignBanner sends only `name`) so no campaign loses the signer's name.
    name: w.name ?? (String(body.name ?? "").trim().slice(0, 160) || null),
    email,
    institution: w.institution,
    role: w.role,
    course_area: w.courseArea,
    primary_use_case: w.primaryUseCase,
    pain_point: w.painPoint,
    notes: (body.notes ?? "").toString().trim().slice(0, 2000) || null,
    wants_webinar_seat: w.wantsWebinarSeat,
    consent_to_email: w.consentToEmail,
    referral_code_used: w.referralCode,
    landing_page_path: w.landingPagePath,
    utm_source: w.utm.source,
    utm_medium: w.utm.medium,
    utm_campaign: w.utm.campaign,
    utm_content: w.utm.content,
    utm_term: w.utm.term,
    status,
    is_waitlisted: outcome === "waitlist",
    referral_source: (body.referralSource ?? "").toString().trim().slice(0, 200) || null,
    // Keep the jsonb mirror populated for back-compat with anything reading `utm`.
    utm: { source: w.utm.source, medium: w.utm.medium, campaign: w.utm.campaign, content: w.utm.content, term: w.utm.term },
    discount_code: discountCode,
    user_id: optionalUser?.id ?? null,
    stripe_customer_id: null as string | null
  };

  const { data: inserted, error } = await admin.from("campaign_signups").insert(row).select("id").single();

  if (error) {
    // Duplicate email for this campaign → return their existing signup (idempotent for the user),
    // including their personal referral code so the success state can still show the share link.
    if ((error as { code?: string }).code === "23505") {
      const { data: existing } = await admin
        .from("campaign_signups")
        .select("status,is_waitlisted,discount_code,assigned_referral_code")
        .eq("campaign_id", campaign.id)
        .eq("email", email)
        .maybeSingle();
      return json(200, {
        ok: true,
        already: true,
        outcome: existing?.is_waitlisted ? "waitlist" : "open",
        discountCode: (existing?.discount_code as string) ?? null,
        referralCode: (existing?.assigned_referral_code as string) ?? null,
        message: "You're already on the list for this campaign — we'll be in touch.",
        webinarUrl: campaign.webinar_url ?? null
      });
    }
    return json(500, { error: error.message });
  }

  const signupId = inserted?.id as string;

  // Mint this signup's personal referral code (best-effort; never blocks the signup).
  const referralCode = await issueReferralCode(admin, {
    campaignId: campaign.id as string,
    signupId,
    email,
    rewardThreshold: (campaign.referral_threshold as number) ?? null
  });

  // Attribute the inbound referral, if any (server-side, self-referral-guarded).
  let referredBy: string | null = null;
  if (w.referralCode) {
    const attribution = await attributeReferral(admin, {
      campaignId: campaign.id as string,
      code: w.referralCode,
      referredSignupId: signupId,
      referredEmail: email
    });
    if (attribution.attributed) referredBy = attribution.referrerEmail ?? null;
    await createAuditLog({
      actorUserId: optionalUser?.id ?? null,
      actorEmail: email,
      eventType: "referral_attribution",
      targetType: "campaign",
      targetId: campaign.id as string,
      metadata: { code: w.referralCode, attributed: attribution.attributed, reason: attribution.reason ?? null },
      request
    });
  }

  // Best-effort welcome/confirmation email (Resend). Degrades silently when RESEND_API_KEY is unset
  // and never blocks the signup. Transactional: it delivers the user's own code + referral link.
  let emailSent = false;
  try {
    const appUrl = (process.env.APP_URL || process.env.VITE_APP_URL || "").trim();
    const landingPath = w.landingPagePath || (campaign.slug ? `/${campaign.slug}` : "/");
    const referralUrl = referralCode && appUrl ? buildReferralUrl(appUrl, landingPath, referralCode) : null;
    let webinarWhen: string | null = null;
    if (campaign.webinar_at) {
      const d = new Date(campaign.webinar_at as string);
      if (!Number.isNaN(d.getTime())) {
        webinarWhen = d.toLocaleString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZoneName: "short"
        });
      }
    }
    const content = buildWaitlistWelcomeEmail({
      firstName: w.firstName,
      campaignName: (campaign.name as string) ?? "the RocketCourse Founding Cohort",
      outcome: outcome === "waitlist" ? "waitlist" : "open",
      discountCode,
      discountPercent: (campaign.discount_percent as number) ?? null,
      discountMonths: (campaign.discount_duration_months as number) ?? null,
      referralUrl,
      referralRewardSummary: (campaign.referral_reward_summary as string) ?? null,
      wantsWebinar: w.wantsWebinarSeat,
      webinarTitle: (campaign.webinar_title as string) ?? null,
      webinarUrl: (campaign.webinar_url as string) ?? null,
      webinarWhen
    });
    const res = await sendEmail({ to: email, subject: content.subject, html: content.html, text: content.text });
    emailSent = res.sent;
  } catch {
    /* never block the signup on email */
  }

  await createAuditLog({
    actorUserId: optionalUser?.id ?? null,
    actorEmail: email,
    eventType: "campaign_signup",
    targetType: "campaign",
    targetId: campaign.id as string,
    metadata: { outcome, status, discountIssued: Boolean(discountCode), wantsWebinarSeat: w.wantsWebinarSeat, referredBy, emailSent },
    request
  });

  return json(200, {
    ok: true,
    id: signupId,
    outcome,
    status,
    discountCode,
    referralCode,
    emailSent,
    message:
      outcome === "waitlist"
        ? "This campaign is full — you've been added to the waitlist and we'll reach out if a spot opens."
        : (campaign.confirmation_message as string) ?? "Thanks for joining! Check your email for next steps.",
    webinarUrl: campaign.webinar_url ?? null,
    tutorialAt: campaign.tutorial_at ?? null
  });
};
