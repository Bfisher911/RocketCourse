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
import { computeUsageCost, type CostBreakdown, type TokenUsage } from "./aiPricing";

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

export interface RecordAiUsageMeta {
  model?: string;
  promptSnapshot?: string;
  /** OpenAI `usage` from the chat completion; priced + persisted so spend is measured, not guessed. */
  usage?: TokenUsage | null;
  /** App-level course id (CourseProject.id) so spend can be grouped per course in usage_events. */
  courseId?: string;
  /**
   * Whether this call counts against the plan's ai_generations quota. Defaults to true so existing
   * metered routes (blueprint, revise) are unchanged. The generic builder proxy passes false: those
   * clicks are logged for cost telemetry but, as today, do not decrement the AI-generation allowance.
   */
  meter?: boolean;
}

/**
 * Best-effort: price the call from its token usage, log a job + usage event with real tokens/cost
 * (queryable per course via usage_events.metadata.courseId), and — when metered — increment the
 * EFFECTIVE subscription's ai_generations_used. Always returns the computed cost (even if the DB
 * write is skipped because the service role isn't configured) so callers can echo it to the client.
 */
export const recordAiUsage = async (
  userId: string,
  jobType: string,
  meta: RecordAiUsageMeta = {}
): Promise<CostBreakdown> => {
  const cost = computeUsageCost(meta.model, meta.usage);
  const hasUsage = Boolean(meta.usage);
  try {
    const admin = getSupabaseAdmin();
    const eff = await resolveEffectiveSubscription(userId);
    if (meta.meter !== false && eff.rowId) {
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
      input_tokens: hasUsage ? cost.inputTokens : null,
      output_tokens: hasUsage ? cost.outputTokens : null,
      estimated_cost_cents: hasUsage ? cost.costCents : null,
      prompt_snapshot: meta.promptSnapshot,
      completed_at: new Date().toISOString()
    });
    await admin.from("usage_events").insert({
      user_id: userId,
      workspace_id: eff.workspaceId,
      event_type: "ai_generation",
      units: 1,
      metadata: {
        jobType,
        model: meta.model ?? null,
        courseId: meta.courseId ?? null,
        metered: meta.meter !== false,
        inputTokens: cost.inputTokens,
        outputTokens: cost.outputTokens,
        totalTokens: cost.totalTokens,
        costUsd: cost.costUsd,
        costMicroUsd: cost.costMicroUsd
      }
    });
  } catch {
    // Service role not configured yet — generation still succeeds; usage tracking lights up later.
  }
  return cost;
};
