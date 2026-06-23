// Reads the caller's own/workspace subscription via their JWT (RLS now lets active workspace members
// read the shared team subscription) and runs the shared entitlement service. Granted credits are
// folded in best-effort via the service role. Usage recording meters the effective subscription row.

import { getSupabaseForUser } from "./supabaseAnon";
import { getSupabaseAdmin } from "./supabaseAdmin";
import {
  can,
  freeSubscription,
  type EntitlementAction,
  type EntitlementDecision,
  type EntitlementSubscription,
  type SubscriptionStatus
} from "../../../src/services/entitlement";
import type { PlanKey } from "../../../src/data/plans";
import { loadCredits, resolveEffectiveSubscription } from "./workspaceEntitlement";

export const loadUserSubscription = async (token: string, userId?: string): Promise<EntitlementSubscription> => {
  try {
    const supabase = getSupabaseForUser(token);
    const { data, error } = await supabase
      .from("subscriptions")
      .select(
        "plan_key,status,current_period_end,cancel_at_period_end,exports_limit,exports_used,ai_generations_limit,ai_generations_used"
      )
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return freeSubscription();
    const sub: EntitlementSubscription = {
      planKey: (data.plan_key as PlanKey) ?? "free_preview",
      status: (data.status as SubscriptionStatus) ?? "none",
      currentPeriodEnd: data.current_period_end as string | null,
      cancelAtPeriodEnd: Boolean(data.cancel_at_period_end),
      exportsUsed: (data.exports_used as number) ?? 0,
      aiGenerationsUsed: (data.ai_generations_used as number) ?? 0,
      exportsLimitOverride: (data.exports_limit as number | null) ?? undefined,
      aiGenerationsLimitOverride: (data.ai_generations_limit as number | null) ?? undefined
    };
    if (userId) {
      const credits = await loadCredits(userId);
      sub.exportCredits = credits.exportCredits;
      sub.aiCredits = credits.aiCredits;
    }
    return sub;
  } catch {
    return freeSubscription();
  }
};

export const checkUserEntitlement = async (
  token: string,
  action: EntitlementAction,
  userId?: string
): Promise<{ decision: EntitlementDecision; subscription: EntitlementSubscription }> => {
  const subscription = await loadUserSubscription(token, userId);
  return { decision: can(action, subscription), subscription };
};

/**
 * Best-effort: increment AI-generation usage on the EFFECTIVE subscription row (own or shared team
 * row) + log a job + usage event. Silently skips if the service role isn't configured.
 */
export const recordAiUsage = async (
  userId: string,
  jobType: string,
  meta: { model?: string; promptSnapshot?: string } = {}
): Promise<void> => {
  try {
    const admin = getSupabaseAdmin();
    const eff = await resolveEffectiveSubscription(userId);
    if (eff.rowId) {
      const { data } = await admin
        .from("subscriptions")
        .select("id,ai_generations_used")
        .eq("id", eff.rowId)
        .maybeSingle();
      if (data?.id) {
        await admin
          .from("subscriptions")
          .update({ ai_generations_used: ((data.ai_generations_used as number) ?? 0) + 1 })
          .eq("id", data.id);
      }
    }
    await admin.from("ai_generation_jobs").insert({
      user_id: userId,
      workspace_id: eff.workspaceId,
      job_type: jobType,
      status: "completed",
      model: meta.model,
      prompt_snapshot: meta.promptSnapshot,
      completed_at: new Date().toISOString()
    });
    await admin
      .from("usage_events")
      .insert({ user_id: userId, workspace_id: eff.workspaceId, event_type: "ai_generation", units: 1, metadata: { jobType } });
  } catch {
    // Service role not configured yet — generation still succeeds; usage tracking lights up later.
  }
};
