// Central entitlement service. This is PURE logic: it answers "can this user do X?" from a
// trusted subscription snapshot (the Supabase `subscriptions` row, written only by the Stripe
// webhook) plus the plan catalog. It must never be fed client-only state like a UI toggle.
//
// The server (Netlify Functions / Supabase Edge Functions) is the enforcement point: it loads
// the user's subscription row, builds an EntitlementContext, and calls `can(...)` before doing
// anything paid (AI generation, private export). The same functions run in the browser to drive
// honest UI affordances (disable a locked button), but the browser's answer is advisory only —
// the server re-checks.

import { getPlan, type Plan, type PlanCapabilities, type PlanKey } from "../data/plans";

/** Mirrors Stripe subscription statuses plus a `none` sentinel for users with no subscription. */
export type SubscriptionStatus =
  | "none"
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused";

/**
 * A snapshot of the user's subscription as stored in Supabase. `null`/absent fields fall back
 * to the plan catalog defaults. Usage counters are authoritative (server-incremented).
 */
export interface EntitlementSubscription {
  planKey: PlanKey;
  status: SubscriptionStatus;
  /** ISO timestamp. For one-time semester passes this is purchase + entitlementMonths. */
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  exportsUsed?: number;
  aiGenerationsUsed?: number;
  /** Optional overrides of the plan's catalog limits (e.g. negotiated department caps). */
  exportsLimitOverride?: number | null;
  aiGenerationsLimitOverride?: number | null;
  /**
   * Additive credits from the usage_adjustments ledger (granted by a Super Admin). Added ON TOP of
   * the (possibly overridden) plan limit — never rewrites usage history. Ignored for unlimited plans.
   */
  exportCredits?: number;
  aiCredits?: number;
}

export type EntitlementAction =
  | "access_dashboard"
  | "create_project"
  | "generate_blueprint"
  | "generate_full_course"
  | "revise_ai"
  | "export"
  | "create_custom_theme"
  | "create_team_workspace";

export type EntitlementDenyCode =
  | "no_active_subscription"
  | "plan_lacks_capability"
  | "ai_limit_reached"
  | "export_limit_reached";

export interface EntitlementDecision {
  allowed: boolean;
  /** Human-friendly explanation, safe to surface in the UI. */
  reason: string;
  /** Machine code for denials (drives upgrade prompts / specific errors). `null` when allowed. */
  code: EntitlementDenyCode | null;
}

const ALLOWED: EntitlementDecision = { allowed: true, reason: "Allowed.", code: null };

const deny = (code: EntitlementDenyCode, reason: string): EntitlementDecision => ({
  allowed: false,
  reason,
  code
});

/** Default snapshot for a visitor / free user with no paid subscription. */
export const freeSubscription = (): EntitlementSubscription => ({
  planKey: "free_preview",
  status: "none",
  exportsUsed: 0,
  aiGenerationsUsed: 0
});

/**
 * Active = the subscription currently grants access. True for active/trialing statuses whose
 * period has not ended. A one-time semester pass is modeled as status `active` with a future
 * `currentPeriodEnd`; it lapses purely by date.
 */
export const isSubscriptionActive = (sub: EntitlementSubscription, now: Date = new Date()): boolean => {
  if (sub.status !== "active" && sub.status !== "trialing") return false;
  if (sub.currentPeriodEnd) {
    const end = new Date(sub.currentPeriodEnd);
    if (!Number.isNaN(end.getTime()) && end.getTime() <= now.getTime()) return false;
  }
  return true;
};

const aiBaseLimit = (plan: Plan, sub: EntitlementSubscription): number | null =>
  sub.aiGenerationsLimitOverride !== undefined ? sub.aiGenerationsLimitOverride : plan.aiGenerationsLimit;

const exportBaseLimit = (plan: Plan, sub: EntitlementSubscription): number | null =>
  sub.exportsLimitOverride !== undefined ? sub.exportsLimitOverride : plan.exportsLimit;

/** Effective AI limit = base (plan or override) + granted credits. `null` stays unlimited. */
const aiLimit = (plan: Plan, sub: EntitlementSubscription): number | null => {
  const base = aiBaseLimit(plan, sub);
  return base === null ? null : base + Math.max(0, sub.aiCredits ?? 0);
};

/** Effective export limit = base (plan or override) + granted credits. `null` stays unlimited. */
const exportLimit = (plan: Plan, sub: EntitlementSubscription): number | null => {
  const base = exportBaseLimit(plan, sub);
  return base === null ? null : base + Math.max(0, sub.exportCredits ?? 0);
};

/** Remaining AI generations. `null` = unlimited. Never negative. */
export const aiGenerationsRemaining = (sub: EntitlementSubscription): number | null => {
  const plan = getPlan(sub.planKey);
  const limit = aiLimit(plan, sub);
  if (limit === null) return null;
  return Math.max(0, limit - (sub.aiGenerationsUsed ?? 0));
};

/** Remaining exports. `null` = unlimited. Never negative. */
export const exportsRemaining = (sub: EntitlementSubscription): number | null => {
  const plan = getPlan(sub.planKey);
  const limit = exportLimit(plan, sub);
  if (limit === null) return null;
  return Math.max(0, limit - (sub.exportsUsed ?? 0));
};

const requiresCapability = (
  capability: keyof PlanCapabilities,
  sub: EntitlementSubscription,
  now: Date
): EntitlementDecision | null => {
  if (!isSubscriptionActive(sub, now)) {
    return deny("no_active_subscription", "An active subscription is required for this action.");
  }
  const plan = getPlan(sub.planKey);
  if (!plan.capabilities[capability]) {
    return deny("plan_lacks_capability", `Your ${plan.name} plan does not include this feature.`);
  }
  return null;
};

/**
 * The one function every caller should use. Returns an allow/deny decision with a reason.
 * `now` is injectable for deterministic tests.
 */
export const can = (
  action: EntitlementAction,
  sub: EntitlementSubscription,
  now: Date = new Date()
): EntitlementDecision => {
  const plan = getPlan(sub.planKey);

  switch (action) {
    case "access_dashboard": {
      // The authenticated dashboard is available to any signed-in user; gating happens per-action.
      // Free users can reach it but see locked affordances. (Auth itself is checked upstream.)
      return ALLOWED;
    }

    case "create_project": {
      const blocked = requiresCapability("privateProjects", sub, now);
      return blocked ?? ALLOWED;
    }

    case "generate_blueprint":
    case "generate_full_course":
    case "revise_ai": {
      const blocked = requiresCapability("aiGeneration", sub, now);
      if (blocked) return blocked;
      const remaining = aiGenerationsRemaining(sub);
      if (remaining !== null && remaining <= 0) {
        return deny(
          "ai_limit_reached",
          `You've used all ${aiLimit(plan, sub)} AI generations on your ${plan.name} plan.`
        );
      }
      return ALLOWED;
    }

    case "export": {
      const blocked = requiresCapability("privateExport", sub, now);
      if (blocked) return blocked;
      const remaining = exportsRemaining(sub);
      if (remaining !== null && remaining <= 0) {
        return deny(
          "export_limit_reached",
          `You've used all ${exportLimit(plan, sub)} exports on your ${plan.name} plan.`
        );
      }
      return ALLOWED;
    }

    case "create_custom_theme": {
      const blocked = requiresCapability("customThemes", sub, now);
      return blocked ?? ALLOWED;
    }

    case "create_team_workspace": {
      const blocked = requiresCapability("teamWorkspace", sub, now);
      return blocked ?? ALLOWED;
    }

    default: {
      // Exhaustiveness guard: a new action must be handled explicitly.
      const _exhaustive: never = action;
      return deny("plan_lacks_capability", `Unknown action: ${String(_exhaustive)}`);
    }
  }
};

/** Convenience boolean wrapper. */
export const allows = (action: EntitlementAction, sub: EntitlementSubscription, now: Date = new Date()): boolean =>
  can(action, sub, now).allowed;

/**
 * A compact summary for the dashboard plan/usage panel. Derives everything from the trusted
 * subscription snapshot so the UI never computes entitlement on its own.
 */
export interface EntitlementSummary {
  planKey: PlanKey;
  planName: string;
  active: boolean;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  aiGenerationsUsed: number;
  aiGenerationsLimit: number | null;
  aiGenerationsRemaining: number | null;
  exportsUsed: number;
  exportsLimit: number | null;
  exportsRemaining: number | null;
  /** Granted credits folded into the limits above (for honest "+N from credits" UI). */
  exportCredits: number;
  aiCredits: number;
  canCreateProject: boolean;
  canGenerate: boolean;
  canExport: boolean;
  canCreateCustomTheme: boolean;
}

export const summarizeEntitlement = (
  sub: EntitlementSubscription,
  now: Date = new Date()
): EntitlementSummary => {
  const plan = getPlan(sub.planKey);
  return {
    planKey: sub.planKey,
    planName: plan.name,
    active: isSubscriptionActive(sub, now),
    status: sub.status,
    currentPeriodEnd: sub.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd ?? false,
    aiGenerationsUsed: sub.aiGenerationsUsed ?? 0,
    aiGenerationsLimit: aiLimit(plan, sub),
    aiGenerationsRemaining: aiGenerationsRemaining(sub),
    exportsUsed: sub.exportsUsed ?? 0,
    exportsLimit: exportLimit(plan, sub),
    exportsRemaining: exportsRemaining(sub),
    exportCredits: Math.max(0, sub.exportCredits ?? 0),
    aiCredits: Math.max(0, sub.aiCredits ?? 0),
    canCreateProject: allows("create_project", sub, now),
    canGenerate: allows("generate_full_course", sub, now),
    canExport: allows("export", sub, now),
    canCreateCustomTheme: allows("create_custom_theme", sub, now)
  };
};
