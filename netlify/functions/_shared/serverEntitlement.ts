// Server-side entitlement enforcement. Loads the trusted `subscriptions` row (service role) and
// runs the SAME entitlement service the client uses (src/services/entitlement.ts) — single source
// of truth. This is the real gate: client UI is advisory, this is authoritative.

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

export const loadServerSubscription = async (userId: string): Promise<EntitlementSubscription> => {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      "plan_key,status,current_period_end,cancel_at_period_end,exports_limit,exports_used,ai_generations_limit,ai_generations_used"
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return freeSubscription();
  return {
    planKey: (data.plan_key as PlanKey) ?? "free_preview",
    status: (data.status as SubscriptionStatus) ?? "none",
    currentPeriodEnd: data.current_period_end as string | null,
    cancelAtPeriodEnd: Boolean(data.cancel_at_period_end),
    exportsUsed: (data.exports_used as number) ?? 0,
    aiGenerationsUsed: (data.ai_generations_used as number) ?? 0,
    exportsLimitOverride: (data.exports_limit as number | null) ?? undefined,
    aiGenerationsLimitOverride: (data.ai_generations_limit as number | null) ?? undefined
  };
};

export const checkServerEntitlement = async (
  userId: string,
  action: EntitlementAction
): Promise<{ decision: EntitlementDecision; subscription: EntitlementSubscription }> => {
  const subscription = await loadServerSubscription(userId);
  return { decision: can(action, subscription), subscription };
};

/** Record a consumed unit after a successful paid action (export / ai_generation) + usage event. */
export const recordUsage = async (
  userId: string,
  kind: "export" | "ai_generation",
  metadata: Record<string, unknown> = {}
): Promise<void> => {
  const supabase = getSupabaseAdmin();
  const column = kind === "export" ? "exports_used" : "ai_generations_used";
  // Atomic increment via RPC would be ideal; for the MVP we read-modify-write the latest row.
  const { data } = await supabase
    .from("subscriptions")
    .select("id," + column)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data?.id) {
    const current = (data as Record<string, number>)[column] ?? 0;
    await supabase.from("subscriptions").update({ [column]: current + 1 }).eq("id", data.id);
  }
  await supabase.from("usage_events").insert({ user_id: userId, event_type: kind, units: 1, metadata });
};
