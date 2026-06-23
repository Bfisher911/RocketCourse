// Workspace-aware entitlement resolution (service role). A user's effective subscription is their
// own paid sub OR the shared subscription of a team workspace they belong to — whichever is active.
// Granted credits (usage_adjustments ledger) are folded on top. This is the source of truth the
// server uses to meter and gate team members under the workspace plan.

import { getSupabaseAdmin } from "./supabaseAdmin";
import { freeSubscription, type EntitlementSubscription, type SubscriptionStatus } from "../../../src/services/entitlement";
import type { PlanKey } from "../../../src/data/plans";

const SUB_COLUMNS =
  "id,user_id,workspace_id,plan_key,status,current_period_end,cancel_at_period_end,exports_limit,exports_used,ai_generations_limit,ai_generations_used,updated_at";

interface SubRow {
  id: string;
  user_id: string | null;
  workspace_id: string | null;
  plan_key: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  exports_limit: number | null;
  exports_used: number | null;
  ai_generations_limit: number | null;
  ai_generations_used: number | null;
  updated_at: string | null;
}

const mapRow = (row: SubRow, credits: { exportCredits: number; aiCredits: number }): EntitlementSubscription => ({
  planKey: (row.plan_key as PlanKey) ?? "free_preview",
  status: (row.status as SubscriptionStatus) ?? "none",
  currentPeriodEnd: row.current_period_end,
  cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
  exportsUsed: row.exports_used ?? 0,
  aiGenerationsUsed: row.ai_generations_used ?? 0,
  exportsLimitOverride: row.exports_limit ?? undefined,
  aiGenerationsLimitOverride: row.ai_generations_limit ?? undefined,
  exportCredits: credits.exportCredits,
  aiCredits: credits.aiCredits
});

/** Sum of currently-valid granted credits for a user (and their workspaces). Best-effort. */
export const loadCredits = async (userId: string): Promise<{ exportCredits: number; aiCredits: number }> => {
  try {
    const admin = getSupabaseAdmin();
    const [ex, ai] = await Promise.all([
      admin.rpc("active_credit_balance", { p_user_id: userId, p_kind: "export_credit" }),
      admin.rpc("active_credit_balance", { p_user_id: userId, p_kind: "ai_credit" })
    ]);
    return {
      exportCredits: Math.max(0, Number(ex.data ?? 0) || 0),
      aiCredits: Math.max(0, Number(ai.data ?? 0) || 0)
    };
  } catch {
    return { exportCredits: 0, aiCredits: 0 };
  }
};

export interface EffectiveSubscription {
  subscription: EntitlementSubscription;
  /** The subscriptions row id to meter against (may be a workspace owner's row). */
  rowId: string | null;
  workspaceId: string | null;
}

const ACTIVE = new Set(["active", "trialing", "past_due"]);

/**
 * Resolve the user's effective subscription. Prefers an active subscription; among ties the most
 * recently updated wins. Folds granted credits. Falls back to the free snapshot.
 */
export const resolveEffectiveSubscription = async (userId: string): Promise<EffectiveSubscription> => {
  const admin = getSupabaseAdmin();

  const [{ data: owned }, { data: memberships }] = await Promise.all([
    admin.from("workspaces").select("id").eq("owner_id", userId),
    admin.from("workspace_members").select("workspace_id").eq("user_id", userId).eq("status", "active")
  ]);
  const wsIds = Array.from(
    new Set([...(owned ?? []).map((w) => w.id as string), ...(memberships ?? []).map((m) => m.workspace_id as string)])
  );

  const rows: SubRow[] = [];
  const { data: ownSubs } = await admin.from("subscriptions").select(SUB_COLUMNS).eq("user_id", userId);
  rows.push(...((ownSubs as SubRow[] | null) ?? []));
  if (wsIds.length) {
    const { data: wsSubs } = await admin.from("subscriptions").select(SUB_COLUMNS).in("workspace_id", wsIds);
    rows.push(...((wsSubs as SubRow[] | null) ?? []));
  }

  if (!rows.length) {
    const credits = await loadCredits(userId);
    return { subscription: { ...freeSubscription(), ...credits }, rowId: null, workspaceId: null };
  }

  const byUpdatedDesc = (a: SubRow, b: SubRow) =>
    new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime();
  const active = rows.filter((r) => ACTIVE.has(r.status)).sort(byUpdatedDesc);
  const chosen = (active[0] ?? rows.sort(byUpdatedDesc)[0])!;

  const credits = await loadCredits(userId);
  return { subscription: mapRow(chosen, credits), rowId: chosen.id, workspaceId: chosen.workspace_id };
};
