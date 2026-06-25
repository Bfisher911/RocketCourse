// POST /.netlify/functions/super-admin — Super-Admin-only sensitive actions. Requires the caller to
// be a Super Admin (profiles.is_super_admin, checked server-side). Every action is audit-logged.
// Reads (directories, analytics) are done client-side via RLS super-admin SELECT policies; this
// function owns the WRITES that must never touch the client: credits, Stripe discounts, account
// disable, and impersonation audit markers.

import { json } from "./_shared/http";
import { getSupabaseAdmin } from "./_shared/supabaseAdmin";
import { createAuditLog, requireSuperAdmin } from "./_shared/guards";
import {
  buildTestCheckoutLink,
  createDiscountCode,
  duplicateDiscount,
  setDiscountStatus,
  syncDiscounts
} from "./_shared/discounts";
import {
  assignSignupPromo,
  createCampaign,
  isPipelineStage,
  isReferralEventStatus,
  setCampaignStatus,
  setReferralStatus,
  setSignupPipeline,
  setSignupStatus,
  updateCampaign,
  type PipelineStage
} from "./_shared/campaignsAdmin";
import type { DiscountInput } from "../../src/billing/discountValidation";
import type { CampaignInput } from "../../src/services/campaigns";

export default async (request: Request): Promise<Response> => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed." });

  const guard = await requireSuperAdmin(request);
  if (!guard.ok) return guard.response;
  const actor = guard.user;
  const admin = getSupabaseAdmin();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json(400, { error: "Body must be JSON." });
  }
  const action = String(body.action ?? "");

  const audit = (eventType: string, targetType: string, targetId: string | null, metadata: Record<string, unknown> = {}) =>
    createAuditLog({ actorUserId: actor.id, actorEmail: actor.email, eventType, targetType, targetId, metadata, request });

  switch (action) {
    // ---- Grant export / AI credits (adjustment ledger; never rewrites usage history) ----
    case "grantCredits": {
      const targetType = body.targetType === "user" ? "user" : "workspace";
      const targetId = String(body.targetId ?? "");
      const kind = body.kind === "ai_credit" ? "ai_credit" : "export_credit";
      const amount = Math.floor(Number(body.amount));
      const reason = String(body.reason ?? "").trim();
      const expiresInDays = Number(body.expiresInDays);
      if (!targetId) return json(400, { error: "targetId is required." });
      if (!Number.isFinite(amount) || amount === 0) return json(400, { error: "A non-zero amount is required." });
      if (!reason) return json(400, { error: "A reason is required (for the audit trail)." });

      const row: Record<string, unknown> = {
        adjustment_type: kind,
        amount,
        reason,
        created_by: actor.id,
        expires_at: Number.isFinite(expiresInDays) && expiresInDays > 0 ? new Date(Date.now() + expiresInDays * 86_400_000).toISOString() : null
      };
      if (targetType === "user") row.user_id = targetId;
      else row.workspace_id = targetId;

      const { data, error } = await admin.from("usage_adjustments").insert(row).select("id").single();
      if (error) return json(500, { error: error.message });
      await audit("export_credit_granted", targetType, targetId, { kind, amount, reason });
      return json(200, { ok: true, id: data?.id });
    }

    // ---- Disable / enable a user account (does not delete data) ----
    case "setUserDisabled": {
      const targetUserId = String(body.targetUserId ?? "");
      const disabled = Boolean(body.disabled);
      if (!targetUserId) return json(400, { error: "targetUserId is required." });
      await admin
        .from("profiles")
        .update({ disabled_at: disabled ? new Date().toISOString() : null })
        .eq("id", targetUserId);
      await audit(disabled ? "user_disabled" : "user_enabled", "user", targetUserId);
      return json(200, { ok: true });
    }

    // ---- Impersonation audit markers (the UI does read-only "view as"; no session is minted) ----
    case "impersonationStart":
    case "impersonationEnd": {
      const targetUserId = String(body.targetUserId ?? "");
      if (!targetUserId) return json(400, { error: "targetUserId is required." });
      await audit(action === "impersonationStart" ? "impersonation_started" : "impersonation_ended", "user", targetUserId, {
        mode: "view_as_readonly"
      });
      return json(200, { ok: true });
    }

    // ---- Stripe discount codes (server-side only; validation + Stripe in _shared/discounts) ----
    case "createDiscount": {
      const input = body as unknown as DiscountInput;
      const result = await createDiscountCode(actor.id, input);
      if (!result.ok) return json(result.status ?? 400, { error: result.error });
      await audit("discount_code_created", "discount_code", result.code ?? null, {
        discountType: input.discountType,
        appliesToPlan: input.appliesToPlan ?? "all",
        campaignName: input.campaignName ?? null
      });
      return json(200, { ok: true, id: result.id, code: result.code, stripeCouponId: result.couponId, status: result.status });
    }

    case "updateDiscountStatus": {
      const recordId = String(body.recordId ?? "");
      const status = String(body.status ?? "");
      if (!recordId) return json(400, { error: "recordId is required." });
      if (!["draft", "active", "paused", "expired", "archived"].includes(status)) {
        return json(400, { error: "Invalid status." });
      }
      const result = await setDiscountStatus(recordId, status as "draft" | "active" | "paused" | "expired" | "archived");
      if (!result.ok) return json(result.status ?? 400, { error: result.error });
      await audit("discount_code_status_changed", "discount_code", result.code ?? recordId, { status });
      return json(200, { ok: true, warning: result.warning });
    }

    // Back-compat alias for the old "Deactivate" button → archive.
    case "deactivateDiscount": {
      const recordId = String(body.recordId ?? "");
      if (!recordId) return json(400, { error: "recordId is required." });
      const result = await setDiscountStatus(recordId, "archived");
      if (!result.ok) return json(result.status ?? 400, { error: result.error });
      await audit("discount_code_deactivated", "discount_code", result.code ?? recordId);
      return json(200, { ok: true, warning: result.warning });
    }

    case "duplicateDiscount": {
      const recordId = String(body.recordId ?? "");
      if (!recordId) return json(400, { error: "recordId is required." });
      const result = await duplicateDiscount(actor.id, recordId);
      if (!result.ok) return json(result.status ?? 400, { error: result.error });
      await audit("discount_code_duplicated", "discount_code", result.code ?? null, { from: recordId });
      return json(200, { ok: true, id: result.id, code: result.code });
    }

    case "syncDiscounts": {
      const result = await syncDiscounts();
      if (!result.ok) return json(result.status ?? 400, { error: result.error });
      await audit("discount_codes_synced", "discount_code", null, { synced: result.synced });
      return json(200, { ok: true, synced: result.synced });
    }

    case "testDiscountCheckout": {
      const recordId = String(body.recordId ?? "");
      const planKey = String(body.planKey ?? "");
      if (!recordId || !planKey) return json(400, { error: "recordId and planKey are required." });
      const result = await buildTestCheckoutLink(recordId, planKey);
      if (!result.ok) return json(result.status ?? 400, { error: result.error });
      await audit("discount_test_checkout", "discount_code", result.code ?? recordId, { planKey });
      return json(200, { ok: true, url: result.url });
    }

    // ---- Pilot campaigns ----
    case "createCampaign": {
      const result = await createCampaign(actor.id, body as unknown as CampaignInput);
      if (!result.ok) return json(result.status ?? 400, { error: result.error });
      await audit("campaign_created", "campaign", result.id ?? null, { name: body.name, type: body.type });
      return json(200, { ok: true, id: result.id, slug: result.slug });
    }

    case "updateCampaign": {
      const campaignId = String(body.campaignId ?? "");
      if (!campaignId) return json(400, { error: "campaignId is required." });
      const result = await updateCampaign(campaignId, body as unknown as CampaignInput);
      if (!result.ok) return json(result.status ?? 400, { error: result.error });
      await audit("campaign_updated", "campaign", campaignId, {});
      return json(200, { ok: true, id: campaignId, slug: result.slug });
    }

    case "setCampaignStatus": {
      const campaignId = String(body.campaignId ?? "");
      const status = String(body.status ?? "");
      if (!campaignId) return json(400, { error: "campaignId is required." });
      if (!["draft", "active", "paused", "ended", "archived"].includes(status)) {
        return json(400, { error: "Invalid campaign status." });
      }
      const result = await setCampaignStatus(campaignId, status as "draft" | "active" | "paused" | "ended" | "archived");
      if (!result.ok) return json(result.status ?? 400, { error: result.error });
      await audit("campaign_status_changed", "campaign", campaignId, { status });
      return json(200, { ok: true });
    }

    case "setSignupStatus": {
      const signupId = String(body.signupId ?? "");
      const status = String(body.status ?? "");
      if (!signupId) return json(400, { error: "signupId is required." });
      if (!["pending", "approved", "rejected", "waitlisted", "converted"].includes(status)) {
        return json(400, { error: "Invalid signup status." });
      }
      const result = await setSignupStatus(signupId, status as "pending" | "approved" | "rejected" | "waitlisted" | "converted");
      if (!result.ok) return json(result.status ?? 400, { error: result.error });
      await audit("campaign_signup_status_changed", "campaign_signup", signupId, { status });
      return json(200, { ok: true });
    }

    // ---- Waitlist CRM: pipeline stage + private admin notes ----
    case "setSignupPipeline": {
      const signupId = String(body.signupId ?? "");
      if (!signupId) return json(400, { error: "signupId is required." });
      const stageRaw = body.pipelineStage === undefined ? undefined : String(body.pipelineStage);
      if (stageRaw !== undefined && !isPipelineStage(stageRaw)) return json(400, { error: "Invalid pipeline stage." });
      const result = await setSignupPipeline(signupId, {
        pipelineStage: stageRaw as PipelineStage | undefined,
        adminNotes: body.adminNotes === undefined ? undefined : String(body.adminNotes ?? "")
      });
      if (!result.ok) return json(result.status ?? 400, { error: result.error });
      await audit("campaign_signup_pipeline_changed", "campaign_signup", signupId, { stage: stageRaw ?? null });
      return json(200, { ok: true });
    }

    // ---- Manually assign a Stripe promotion code to a waitlist entry ----
    case "assignSignupPromo": {
      const signupId = String(body.signupId ?? "");
      if (!signupId) return json(400, { error: "signupId is required." });
      const result = await assignSignupPromo(signupId, body.promoCode === null ? null : String(body.promoCode ?? ""));
      if (!result.ok) return json(result.status ?? 400, { error: result.error });
      await audit("campaign_signup_promo_assigned", "campaign_signup", signupId, { promoCode: body.promoCode ?? null });
      return json(200, { ok: true });
    }

    // ---- Advance a referral event's status ----
    case "setReferralStatus": {
      const eventId = String(body.eventId ?? "");
      const status = String(body.status ?? "");
      if (!eventId) return json(400, { error: "eventId is required." });
      if (!isReferralEventStatus(status)) return json(400, { error: "Invalid referral status." });
      const result = await setReferralStatus(
        eventId,
        status as "pending_signup" | "signed_up" | "paid" | "rewarded" | "disqualified"
      );
      if (!result.ok) return json(result.status ?? 400, { error: result.error });
      await audit("referral_status_changed", "referral_event", eventId, { status });
      return json(200, { ok: true });
    }

    // ---- Audit a waitlist export (PII leaves the system; record who/what/when) ----
    case "logWaitlistExport": {
      const campaignId = String(body.campaignId ?? "") || null;
      const format = String(body.format ?? "csv");
      const segment = String(body.segment ?? "all");
      const count = Math.max(0, Math.floor(Number(body.count) || 0));
      await audit("waitlist_exported", "campaign", campaignId, { format, segment, count });
      return json(200, { ok: true });
    }

    default:
      return json(400, { error: `Unknown action: ${action}` });
  }
};
