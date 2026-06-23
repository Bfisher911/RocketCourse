// POST /.netlify/functions/super-admin — Super-Admin-only sensitive actions. Requires the caller to
// be a Super Admin (profiles.is_super_admin, checked server-side). Every action is audit-logged.
// Reads (directories, analytics) are done client-side via RLS super-admin SELECT policies; this
// function owns the WRITES that must never touch the client: credits, Stripe discounts, account
// disable, and impersonation audit markers.

import { json } from "./_shared/http";
import { getSupabaseAdmin } from "./_shared/supabaseAdmin";
import { createAuditLog, requireSuperAdmin } from "./_shared/guards";
import { getStripe } from "./_shared/stripe";

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

    // ---- Stripe discount codes (server-side only) ----
    case "createDiscount": {
      const name = String(body.name ?? "").trim() || "RocketCourse discount";
      const percentOff = body.percentOff !== undefined && body.percentOff !== null ? Number(body.percentOff) : null;
      const amountOff = body.amountOff !== undefined && body.amountOff !== null ? Math.floor(Number(body.amountOff)) : null;
      const currency = body.currency ? String(body.currency).toLowerCase() : "usd";
      const duration = ["once", "repeating", "forever"].includes(String(body.duration)) ? String(body.duration) : "once";
      const durationInMonths = Number(body.durationInMonths);
      const maxRedemptions = Number.isFinite(Number(body.maxRedemptions)) && Number(body.maxRedemptions) > 0 ? Math.floor(Number(body.maxRedemptions)) : null;
      const code = body.code ? String(body.code).trim().toUpperCase().slice(0, 40) : undefined;

      if (percentOff === null && amountOff === null) {
        return json(400, { error: "Provide either percentOff or amountOff." });
      }
      if (percentOff !== null && (percentOff <= 0 || percentOff > 100)) {
        return json(400, { error: "percentOff must be between 1 and 100." });
      }

      let stripe: ReturnType<typeof getStripe>;
      try {
        stripe = getStripe();
      } catch (error) {
        return json(503, { error: error instanceof Error ? error.message : "Stripe is not configured." });
      }

      try {
        const couponParams: Record<string, unknown> = { name, duration };
        if (percentOff !== null) couponParams.percent_off = percentOff;
        if (amountOff !== null) {
          couponParams.amount_off = amountOff;
          couponParams.currency = currency;
        }
        if (duration === "repeating" && Number.isFinite(durationInMonths) && durationInMonths > 0) {
          couponParams.duration_in_months = Math.floor(durationInMonths);
        }
        if (maxRedemptions) couponParams.max_redemptions = maxRedemptions;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const coupon = await stripe.coupons.create(couponParams as any);

        const promoParams: Record<string, unknown> = { coupon: coupon.id };
        if (code) promoParams.code = code;
        if (maxRedemptions) promoParams.max_redemptions = maxRedemptions;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const promo = await stripe.promotionCodes.create(promoParams as any);

        const { data, error } = await admin
          .from("discount_code_records")
          .insert({
            stripe_coupon_id: coupon.id,
            stripe_promotion_code_id: promo.id,
            code: promo.code,
            name,
            percent_off: percentOff,
            amount_off: amountOff,
            currency: amountOff !== null ? currency : null,
            duration,
            max_redemptions: maxRedemptions,
            active: true,
            created_by: actor.id,
            metadata: {}
          })
          .select("id")
          .single();
        if (error) return json(500, { error: error.message });
        await audit("discount_code_created", "discount_code", promo.code, { percentOff, amountOff, duration });
        return json(200, { ok: true, id: data?.id, code: promo.code, stripeCouponId: coupon.id });
      } catch (error) {
        return json(502, { error: error instanceof Error ? error.message : "Stripe could not create the discount." });
      }
    }

    case "deactivateDiscount": {
      const recordId = String(body.recordId ?? "");
      if (!recordId) return json(400, { error: "recordId is required." });
      const { data: record } = await admin
        .from("discount_code_records")
        .select("id,stripe_promotion_code_id,code")
        .eq("id", recordId)
        .maybeSingle();
      if (!record) return json(404, { error: "Discount record not found." });
      try {
        if (record.stripe_promotion_code_id) {
          await getStripe().promotionCodes.update(record.stripe_promotion_code_id as string, { active: false });
        }
      } catch (error) {
        // Reflect locally even if Stripe call fails, but report it.
        await admin.from("discount_code_records").update({ active: false }).eq("id", recordId);
        await audit("discount_code_deactivated", "discount_code", record.code as string, { stripeError: true });
        return json(200, { ok: true, warning: error instanceof Error ? error.message : "Stripe update failed; deactivated locally." });
      }
      await admin.from("discount_code_records").update({ active: false }).eq("id", recordId);
      await audit("discount_code_deactivated", "discount_code", record.code as string);
      return json(200, { ok: true });
    }

    default:
      return json(400, { error: `Unknown action: ${action}` });
  }
};
