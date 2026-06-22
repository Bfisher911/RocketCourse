// Resolves a user's EntitlementSubscription snapshot for the UI.
//   • supabase mode — reads the trusted `subscriptions` row (RLS: user can read their own).
//     This row is written ONLY by the Stripe webhook, so the client only ever READS it.
//   • local mode    — a dev-only store (localStorage) so the offline demo can simulate having a
//     plan without Stripe/Supabase. Clearly not a source of real entitlement.
//
// Either way, the browser's entitlement is advisory: every paid server action re-checks against
// the database. This module never grants access — it only reports what the trusted record says.

import { getSupabaseClient, supabaseConfig } from "../services/supabaseClient";
import { freeSubscription, type EntitlementSubscription, type SubscriptionStatus } from "../services/entitlement";
import type { PlanKey } from "../data/plans";
import { getPlan } from "../data/plans";
import type { AuthSession } from "../auth/authClient";

const LOCAL_PLAN_KEY = "cf_local_plan";

const isLocal = (): boolean => !supabaseConfig.isConfigured;

/** DEV ONLY: simulate an active plan locally so the demo flow works without Stripe. */
export const setLocalPlan = (planKey: PlanKey): void => {
  localStorage.setItem(LOCAL_PLAN_KEY, planKey);
};

export const getLocalPlanKey = (): PlanKey => {
  const stored = localStorage.getItem(LOCAL_PLAN_KEY) as PlanKey | null;
  return stored ?? "free_preview";
};

const buildLocalSubscription = (): EntitlementSubscription => {
  const planKey = getLocalPlanKey();
  if (planKey === "free_preview") return freeSubscription();
  const plan = getPlan(planKey);
  // Simulate an active subscription whose period ends `entitlementMonths` out from now.
  const end = new Date();
  end.setMonth(end.getMonth() + Math.max(1, plan.entitlementMonths));
  return {
    planKey,
    status: "active",
    currentPeriodEnd: end.toISOString(),
    cancelAtPeriodEnd: false,
    exportsUsed: 0,
    aiGenerationsUsed: 0
  };
};

/**
 * Load the entitlement snapshot for the signed-in user. Returns the free snapshot for signed-out
 * users or when no subscription row exists yet (e.g. before the webhook lands).
 */
export const loadSubscription = async (session: AuthSession | null): Promise<EntitlementSubscription> => {
  if (!session) return freeSubscription();
  if (isLocal()) return buildLocalSubscription();

  const client = await getSupabaseClient();
  if (!client) return freeSubscription();

  const { data, error } = await client
    .from("subscriptions")
    .select(
      "plan_key,status,current_period_end,cancel_at_period_end,exports_limit,exports_used,ai_generations_limit,ai_generations_used"
    )
    .eq("user_id", session.user.id)
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
