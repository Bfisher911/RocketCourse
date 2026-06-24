// POST /.netlify/functions/campaign-signup — PUBLIC campaign signup (no auth required; an optional
// Bearer token links the signup to a user). The max-signup cap and waitlist/closed switch are
// enforced HERE against a trusted DB count — the client's view is advisory only. When a campaign
// links a Stripe-backed discount and a slot is open, the code is issued/reserved to the signup.
// Every signup is audit-logged.

import { getAuthedUser, json } from "./_shared/http";
import { getSupabaseAdmin } from "./_shared/supabaseAdmin";
import { createAuditLog } from "./_shared/guards";
import { campaignSignupState, isCampaignLive, isValidEmail } from "../../src/services/campaigns";

interface SignupBody {
  campaignId?: string;
  slug?: string;
  name?: string;
  email?: string;
  institution?: string;
  role?: string;
  notes?: string;
  referralSource?: string;
  utm?: Record<string, unknown>;
}

export default async (request: Request): Promise<Response> => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed. Use POST." });

  let body: SignupBody;
  try {
    body = (await request.json()) as SignupBody;
  } catch {
    return json(400, { error: "Body must be JSON." });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  if (!isValidEmail(email)) return json(400, { error: "A valid email is required." });

  const admin = getSupabaseAdmin();

  // Resolve the campaign by id or public slug.
  let query = admin
    .from("campaigns")
    .select(
      "id,name,slug,type,status,starts_at,ends_at,max_signups,when_full,require_approval,discount_record_id,confirmation_message,webinar_url,tutorial_at"
    );
  if (body.campaignId) query = query.eq("id", body.campaignId);
  else if (body.slug) query = query.eq("slug", body.slug);
  else return json(400, { error: "A campaign id or slug is required." });

  const { data: campaign } = await query.maybeSingle();
  if (!campaign) return json(404, { error: "Campaign not found." });

  // Server-side liveness gate (status + window).
  if (!isCampaignLive({ status: campaign.status as "active", startsAt: campaign.starts_at as string | null, endsAt: campaign.ends_at as string | null })) {
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
    name: String(body.name ?? "").trim().slice(0, 160) || null,
    email,
    institution: String(body.institution ?? "").trim().slice(0, 200) || null,
    role: String(body.role ?? "").trim().slice(0, 120) || null,
    notes: String(body.notes ?? "").trim().slice(0, 2000) || null,
    status,
    is_waitlisted: outcome === "waitlist",
    referral_source: String(body.referralSource ?? "").trim().slice(0, 200) || null,
    utm: body.utm && typeof body.utm === "object" ? body.utm : {},
    discount_code: discountCode,
    user_id: optionalUser?.id ?? null,
    stripe_customer_id: null as string | null
  };

  const { data: inserted, error } = await admin.from("campaign_signups").insert(row).select("id").single();

  if (error) {
    // Duplicate email for this campaign → return their existing signup (idempotent for the user).
    if ((error as { code?: string }).code === "23505") {
      const { data: existing } = await admin
        .from("campaign_signups")
        .select("status,is_waitlisted,discount_code")
        .eq("campaign_id", campaign.id)
        .eq("email", email)
        .maybeSingle();
      return json(200, {
        ok: true,
        already: true,
        outcome: existing?.is_waitlisted ? "waitlist" : "open",
        discountCode: (existing?.discount_code as string) ?? null,
        message: "You're already signed up for this campaign — we'll be in touch.",
        webinarUrl: campaign.webinar_url ?? null
      });
    }
    return json(500, { error: error.message });
  }

  await createAuditLog({
    actorUserId: optionalUser?.id ?? null,
    actorEmail: email,
    eventType: "campaign_signup",
    targetType: "campaign",
    targetId: campaign.id as string,
    metadata: { outcome, status, discountIssued: Boolean(discountCode) },
    request
  });

  return json(200, {
    ok: true,
    id: inserted?.id,
    outcome,
    status,
    discountCode,
    message:
      outcome === "waitlist"
        ? "This campaign is full — you've been added to the waitlist and we'll reach out if a spot opens."
        : (campaign.confirmation_message as string) ?? "Thanks for signing up! Check your email for next steps.",
    webinarUrl: campaign.webinar_url ?? null,
    tutorialAt: campaign.tutorial_at ?? null
  });
};
