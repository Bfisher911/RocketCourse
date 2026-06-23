// Server-side entitlement enforcement (service role). Resolves the user's WORKSPACE-AWARE effective
// subscription (own paid plan or the shared team plan), folds granted credits, and runs the SAME
// entitlement service the client uses (src/services/entitlement.ts). This is the real gate.

import { getSupabaseAdmin } from "./supabaseAdmin";
import {
  can,
  type EntitlementAction,
  type EntitlementDecision,
  type EntitlementSubscription
} from "../../../src/services/entitlement";
import { resolveEffectiveSubscription } from "./workspaceEntitlement";

export const loadServerSubscription = async (userId: string): Promise<EntitlementSubscription> =>
  (await resolveEffectiveSubscription(userId)).subscription;

export const checkServerEntitlement = async (
  userId: string,
  action: EntitlementAction
): Promise<{ decision: EntitlementDecision; subscription: EntitlementSubscription }> => {
  const eff = await resolveEffectiveSubscription(userId);
  return { decision: can(action, eff.subscription), subscription: eff.subscription };
};

/**
 * Record a consumed unit after a successful paid action against the EFFECTIVE subscription row
 * (which may be a team workspace owner's shared row) + a workspace-scoped usage event.
 */
export const recordUsage = async (
  userId: string,
  kind: "export" | "ai_generation",
  metadata: Record<string, unknown> = {}
): Promise<void> => {
  const supabase = getSupabaseAdmin();
  const column = kind === "export" ? "exports_used" : "ai_generations_used";
  const eff = await resolveEffectiveSubscription(userId);
  if (eff.rowId) {
    const { data } = await supabase.from("subscriptions").select(`id,${column}`).eq("id", eff.rowId).maybeSingle();
    if (data?.id) {
      const current = (data as Record<string, number>)[column] ?? 0;
      await supabase.from("subscriptions").update({ [column]: current + 1 }).eq("id", data.id);
    }
  }
  await supabase
    .from("usage_events")
    .insert({ user_id: userId, workspace_id: eff.workspaceId, event_type: kind, units: 1, metadata });
};
