// Client data layer for the team + admin platform. Reads are RLS-scoped via the browser Supabase
// client (super admins see everything via the *_super_read policies; workspace admins see their own
// workspace; members read the shared subscription). Sensitive WRITES go to Netlify Functions with
// the caller's JWT — the server re-checks the role. In local-dev mode (no Supabase) everything
// degrades to safe empties so the UI stays navigable for the offline demo.

import { getSupabaseClient, supabaseConfig } from "./supabaseClient";
import { getSession } from "../auth/authClient";
import { isBootstrapSuperAdminEmail } from "../data/platform";
import { getPlan, type PlanKey } from "../data/plans";
import { SAMPLE_CAMPAIGN, type Campaign } from "./campaigns";
import type { WorkspaceRole } from "./workspaceRoles";

const isLocal = (): boolean => !supabaseConfig.isConfigured;

const authToken = async (): Promise<string | null> => {
  const session = await getSession();
  return session?.accessToken ?? null;
};

/** POST to a Netlify Function with the caller's JWT. Throws Error(message) on a non-2xx response. */
export async function callFunction<T = Record<string, unknown>>(
  name: string,
  body: Record<string, unknown>
): Promise<T> {
  const token = await authToken();
  const res = await fetch(`/.netlify/functions/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body)
  });
  let data: unknown = {};
  try {
    data = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    const msg = (data as { error?: string })?.error ?? `Request failed (${res.status}).`;
    throw new Error(msg);
  }
  return data as T;
}

// ──────────────────────────────────────────────────────────────────────────
// Access (role + workspaces) — drives server-informed navigation gating.
// ──────────────────────────────────────────────────────────────────────────
export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string | null;
  planKey: string;
  seatLimit: number;
  status: string;
  ownerId: string;
  myRole: WorkspaceRole;
}

export interface PlatformAccess {
  isSuperAdmin: boolean;
  defaultWorkspaceId: string | null;
  workspaces: WorkspaceSummary[];
}

export const EMPTY_ACCESS: PlatformAccess = { isSuperAdmin: false, defaultWorkspaceId: null, workspaces: [] };

export const loadPlatformAccess = async (userId: string, email: string | null): Promise<PlatformAccess> => {
  // Local-dev: super-admin status mirrors the bootstrap email so nav gating is demoable offline.
  if (isLocal()) return { ...EMPTY_ACCESS, isSuperAdmin: isBootstrapSuperAdminEmail(email) };
  const client = await getSupabaseClient();
  if (!client) return EMPTY_ACCESS;

  const [{ data: profile }, { data: workspaces }, { data: memberships }] = await Promise.all([
    client.from("profiles").select("is_super_admin,default_workspace_id").eq("id", userId).maybeSingle(),
    client.from("workspaces").select("id,name,slug,plan_key,seat_limit,status,owner_id"),
    client.from("workspace_members").select("workspace_id,role,status").eq("user_id", userId).eq("status", "active")
  ]);

  const roleByWs = new Map<string, WorkspaceRole>(
    (memberships ?? []).map((m) => [m.workspace_id as string, m.role as WorkspaceRole])
  );
  const list: WorkspaceSummary[] = (workspaces ?? []).map((w) => ({
    id: w.id as string,
    name: w.name as string,
    slug: (w.slug as string) ?? null,
    planKey: w.plan_key as string,
    seatLimit: (w.seat_limit as number) ?? 1,
    status: w.status as string,
    ownerId: w.owner_id as string,
    myRole: w.owner_id === userId ? "owner" : roleByWs.get(w.id as string) ?? "member"
  }));

  return {
    isSuperAdmin: Boolean(profile?.is_super_admin),
    defaultWorkspaceId: (profile?.default_workspace_id as string) ?? null,
    workspaces: list
  };
};

// ──────────────────────────────────────────────────────────────────────────
// Workspace admin dashboard + actions
// ──────────────────────────────────────────────────────────────────────────
export const loadWorkspaceData = (workspaceId: string): Promise<Record<string, unknown>> =>
  callFunction("workspace-data", { workspaceId });

export const workspaceManage = (action: string, params: Record<string, unknown>): Promise<Record<string, unknown>> =>
  callFunction("workspace-manage", { action, ...params });

export const workspaceJoin = (token: string, type: "invite" | "join"): Promise<Record<string, unknown>> =>
  callFunction("workspace-join", { token, type });

// ──────────────────────────────────────────────────────────────────────────
// Super admin — sensitive writes go through the server function
// ──────────────────────────────────────────────────────────────────────────
export const superAdminAction = (action: string, params: Record<string, unknown>): Promise<Record<string, unknown>> =>
  callFunction("super-admin", { action, ...params });

export const blogManage = (action: string, params: Record<string, unknown>): Promise<Record<string, unknown>> =>
  callFunction("blog-manage", { action, ...params });

// ── Super admin reads (client RLS; super admin sees all) ──
const monthStartIso = (): string => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
};

export interface SuperOverview {
  totalWorkspaces: number;
  totalUsers: number;
  activeSubscriptions: number;
  pastDueSubscriptions: number;
  exportsThisMonth: number;
  aiThisMonth: number;
  estCostCents: number;
  estRevenueCents: number;
}

export const loadSuperOverview = async (): Promise<SuperOverview> => {
  const empty: SuperOverview = {
    totalWorkspaces: 0,
    totalUsers: 0,
    activeSubscriptions: 0,
    pastDueSubscriptions: 0,
    exportsThisMonth: 0,
    aiThisMonth: 0,
    estCostCents: 0,
    estRevenueCents: 0
  };
  if (isLocal()) return empty;
  const client = await getSupabaseClient();
  if (!client) return empty;
  const since = monthStartIso();

  // No generated DB types → use a loose handle for the head/count queries.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const c = client as any;
  const num = (r: any): number => r?.count ?? 0;
  const [wsC, usrC, actC, pastC, expC, aiC] = await Promise.all([
    c.from("workspaces").select("id", { count: "exact", head: true }),
    c.from("profiles").select("id", { count: "exact", head: true }),
    c.from("subscriptions").select("id", { count: "exact", head: true }).in("status", ["active", "trialing"]),
    c.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "past_due"),
    c.from("usage_events").select("id", { count: "exact", head: true }).eq("event_type", "export").gte("created_at", since),
    c.from("usage_events").select("id", { count: "exact", head: true }).eq("event_type", "ai_generation").gte("created_at", since)
  ]);
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const totalWorkspaces = num(wsC);
  const totalUsers = num(usrC);
  const activeSubscriptions = num(actC);
  const pastDueSubscriptions = num(pastC);
  const exportsThisMonth = num(expC);
  const aiThisMonth = num(aiC);

  // Estimated LLM cost this month from logged jobs.
  const { data: jobs } = await client
    .from("ai_generation_jobs")
    .select("estimated_cost_cents,created_at")
    .gte("created_at", since)
    .limit(2000);
  const estCostCents = (jobs ?? []).reduce((s, j) => s + ((j.estimated_cost_cents as number) ?? 0), 0);

  // Estimated annualized revenue from active subscriptions (catalog prices).
  const { data: subs } = await client.from("subscriptions").select("plan_key,status").in("status", ["active", "trialing"]);
  const estRevenueCents = (subs ?? []).reduce((s, sub) => {
    const plan = getPlan((sub.plan_key as PlanKey) ?? "free_preview");
    return s + (plan?.priceCents ?? 0);
  }, 0);

  return {
    totalWorkspaces,
    totalUsers,
    activeSubscriptions,
    pastDueSubscriptions,
    exportsThisMonth,
    aiThisMonth,
    estCostCents,
    estRevenueCents
  };
};

export interface DirectoryWorkspace {
  id: string;
  name: string;
  planKey: string;
  status: string;
  seatLimit: number;
  seatUsed: number;
  ownerEmail: string | null;
  createdAt: string;
}

export const loadWorkspacesDirectory = async (): Promise<DirectoryWorkspace[]> => {
  if (isLocal()) return [];
  const client = await getSupabaseClient();
  if (!client) return [];
  const [{ data: workspaces }, { data: members }, { data: profiles }] = await Promise.all([
    client.from("workspaces").select("id,name,plan_key,status,seat_limit,owner_id,created_at").order("created_at", { ascending: false }),
    client.from("workspace_members").select("workspace_id,status"),
    client.from("profiles").select("id,email")
  ]);
  const emailById = new Map((profiles ?? []).map((p) => [p.id as string, p.email as string]));
  const usedByWs = new Map<string, number>();
  for (const m of members ?? []) {
    if (m.status === "active") usedByWs.set(m.workspace_id as string, (usedByWs.get(m.workspace_id as string) ?? 0) + 1);
  }
  return (workspaces ?? []).map((w) => ({
    id: w.id as string,
    name: w.name as string,
    planKey: w.plan_key as string,
    status: w.status as string,
    seatLimit: (w.seat_limit as number) ?? 1,
    seatUsed: usedByWs.get(w.id as string) ?? 0,
    ownerEmail: emailById.get(w.owner_id as string) ?? null,
    createdAt: w.created_at as string
  }));
};

export interface DirectoryUser {
  id: string;
  email: string | null;
  fullName: string | null;
  isSuperAdmin: boolean;
  disabledAt: string | null;
  workspaceCount: number;
  createdAt: string;
}

export const loadUsersDirectory = async (): Promise<DirectoryUser[]> => {
  if (isLocal()) return [];
  const client = await getSupabaseClient();
  if (!client) return [];
  const [{ data: profiles }, { data: members }] = await Promise.all([
    client.from("profiles").select("id,email,full_name,is_super_admin,disabled_at,created_at").order("created_at", { ascending: false }),
    client.from("workspace_members").select("user_id,status")
  ]);
  const wsCount = new Map<string, number>();
  for (const m of members ?? []) {
    if (m.status === "active") wsCount.set(m.user_id as string, (wsCount.get(m.user_id as string) ?? 0) + 1);
  }
  return (profiles ?? []).map((p) => ({
    id: p.id as string,
    email: (p.email as string) ?? null,
    fullName: (p.full_name as string) ?? null,
    isSuperAdmin: Boolean(p.is_super_admin),
    disabledAt: (p.disabled_at as string) ?? null,
    workspaceCount: wsCount.get(p.id as string) ?? 0,
    createdAt: p.created_at as string
  }));
};

export interface AuditRow {
  id: string;
  eventType: string;
  actorEmail: string | null;
  targetType: string | null;
  targetId: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export const loadAuditLog = async (limit = 60): Promise<AuditRow[]> => {
  if (isLocal()) return [];
  const client = await getSupabaseClient();
  if (!client) return [];
  const { data } = await client
    .from("audit_events")
    .select("id,event_type,actor_email,target_type,target_id,metadata,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((a) => ({
    id: a.id as string,
    eventType: a.event_type as string,
    actorEmail: (a.actor_email as string) ?? null,
    targetType: (a.target_type as string) ?? null,
    targetId: (a.target_id as string) ?? null,
    createdAt: a.created_at as string,
    metadata: (a.metadata as Record<string, unknown>) ?? {}
  }));
};

export interface DiscountRow {
  id: string;
  code: string | null;
  name: string | null;
  campaignName: string | null;
  percentOff: number | null;
  amountOff: number | null;
  currency: string | null;
  duration: string | null;
  durationInMonths: number | null;
  status: string;
  active: boolean;
  visibility: string | null;
  appliesToPlan: string | null;
  appliesToInterval: string | null;
  maxRedemptions: number | null;
  timesRedeemed: number;
  perCustomerLimit: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
  createdByEmail: string | null;
  stripeCouponId: string | null;
  stripePromotionCodeId: string | null;
}

export const loadDiscounts = async (): Promise<DiscountRow[]> => {
  if (isLocal()) return [];
  const client = await getSupabaseClient();
  if (!client) return [];
  const [{ data }, { data: profiles }] = await Promise.all([
    client
      .from("discount_code_records")
      .select(
        "id,code,name,campaign_name,percent_off,amount_off,currency,duration,duration_in_months,status,active,visibility,applies_to_plan,applies_to_interval,max_redemptions,times_redeemed,per_customer_limit,starts_at,expires_at,notes,created_at,updated_at,created_by,stripe_coupon_id,stripe_promotion_code_id"
      )
      .order("created_at", { ascending: false }),
    client.from("profiles").select("id,email")
  ]);
  const emailById = new Map((profiles ?? []).map((p) => [p.id as string, p.email as string]));
  return (data ?? []).map((d) => ({
    id: d.id as string,
    code: (d.code as string) ?? null,
    name: (d.name as string) ?? null,
    campaignName: (d.campaign_name as string) ?? null,
    percentOff: (d.percent_off as number) ?? null,
    amountOff: (d.amount_off as number) ?? null,
    currency: (d.currency as string) ?? null,
    duration: (d.duration as string) ?? null,
    durationInMonths: (d.duration_in_months as number) ?? null,
    status: (d.status as string) ?? (d.active ? "active" : "archived"),
    active: Boolean(d.active),
    visibility: (d.visibility as string) ?? null,
    appliesToPlan: (d.applies_to_plan as string) ?? null,
    appliesToInterval: (d.applies_to_interval as string) ?? null,
    maxRedemptions: (d.max_redemptions as number) ?? null,
    timesRedeemed: (d.times_redeemed as number) ?? 0,
    perCustomerLimit: (d.per_customer_limit as number) ?? null,
    startsAt: (d.starts_at as string) ?? null,
    expiresAt: (d.expires_at as string) ?? null,
    notes: (d.notes as string) ?? null,
    createdAt: d.created_at as string,
    updatedAt: (d.updated_at as string) ?? null,
    createdByEmail: emailById.get(d.created_by as string) ?? null,
    stripeCouponId: (d.stripe_coupon_id as string) ?? null,
    stripePromotionCodeId: (d.stripe_promotion_code_id as string) ?? null
  }));
};

export interface DiscountRedemptionRow {
  id: string;
  code: string | null;
  discountRecordId: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  amountDiscountedCents: number | null;
  currency: string | null;
  redeemedAt: string;
}

export const loadDiscountRedemptions = async (recordId?: string): Promise<DiscountRedemptionRow[]> => {
  if (isLocal()) return [];
  const client = await getSupabaseClient();
  if (!client) return [];
  let query = client
    .from("discount_redemptions")
    .select("id,code,discount_record_id,stripe_customer_id,stripe_subscription_id,amount_discounted_cents,currency,redeemed_at")
    .order("redeemed_at", { ascending: false })
    .limit(200);
  if (recordId) query = query.eq("discount_record_id", recordId);
  const { data } = await query;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    code: (r.code as string) ?? null,
    discountRecordId: (r.discount_record_id as string) ?? null,
    stripeCustomerId: (r.stripe_customer_id as string) ?? null,
    stripeSubscriptionId: (r.stripe_subscription_id as string) ?? null,
    amountDiscountedCents: (r.amount_discounted_cents as number) ?? null,
    currency: (r.currency as string) ?? null,
    redeemedAt: r.redeemed_at as string
  }));
};

// ──────────────────────────────────────────────────────────────────────────
// Pilot campaigns
// ──────────────────────────────────────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
const mapCampaign = (c: any): Campaign => ({
  id: c.id as string,
  name: c.name as string,
  slug: (c.slug as string) ?? null,
  type: c.type as Campaign["type"],
  headline: (c.headline as string) ?? null,
  description: (c.description as string) ?? null,
  ctaText: (c.cta_text as string) ?? "Request access",
  status: c.status as Campaign["status"],
  placement: c.placement as Campaign["placement"],
  startsAt: (c.starts_at as string) ?? null,
  endsAt: (c.ends_at as string) ?? null,
  maxSignups: (c.max_signups as number) ?? null,
  whenFull: (c.when_full as Campaign["whenFull"]) ?? "waitlist",
  requireApproval: Boolean(c.require_approval),
  discountRecordId: (c.discount_record_id as string) ?? null,
  planKey: (c.plan_key as string) ?? null,
  webinarUrl: (c.webinar_url as string) ?? null,
  tutorialAt: (c.tutorial_at as string) ?? null,
  audienceLabel: (c.audience_label as string) ?? null,
  confirmationMessage: (c.confirmation_message as string) ?? null
});
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Public: active, in-window campaigns for the marketing site (with PII-free signup counts). */
export const loadActiveCampaigns = async (): Promise<Campaign[]> => {
  if (isLocal()) return [SAMPLE_CAMPAIGN];
  const client = await getSupabaseClient();
  if (!client) return [];
  const { data } = await client
    .from("campaigns")
    .select(
      "id,name,slug,type,headline,description,cta_text,status,placement,starts_at,ends_at,max_signups,when_full,require_approval,discount_record_id,plan_key,webinar_url,tutorial_at,audience_label,confirmation_message"
    )
    .eq("status", "active")
    .order("created_at", { ascending: false });
  const campaigns = (data ?? []).map(mapCampaign);
  // Best-effort signup counts via the safe RPC (drives "spots left"). Failure → leave undefined.
  await Promise.all(
    campaigns.map(async (c) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: count } = await (client as any).rpc("campaign_signup_count", { p_campaign: c.id });
        if (typeof count === "number") c.signupCount = count;
      } catch {
        /* ignore */
      }
    })
  );
  return campaigns;
};

export interface CampaignSignupResult {
  ok: boolean;
  outcome?: "open" | "waitlist" | "closed";
  message?: string;
  discountCode?: string | null;
  webinarUrl?: string | null;
  already?: boolean;
}

/** Public: submit a campaign signup. In local-dev, returns a safe simulated confirmation. */
export const submitCampaignSignup = async (payload: Record<string, unknown>): Promise<CampaignSignupResult> => {
  if (isLocal()) {
    return {
      ok: true,
      outcome: "open",
      message: SAMPLE_CAMPAIGN.confirmationMessage ?? "Thanks for signing up!",
      webinarUrl: SAMPLE_CAMPAIGN.webinarUrl,
      discountCode: "ROCKET-DEMO"
    };
  }
  return callFunction<CampaignSignupResult>("campaign-signup", payload);
};

/** Super admin: every campaign (any status) with its signup count. */
export const loadCampaigns = async (): Promise<Campaign[]> => {
  if (isLocal()) return [SAMPLE_CAMPAIGN];
  const client = await getSupabaseClient();
  if (!client) return [];
  const [{ data }, { data: signups }] = await Promise.all([
    client
      .from("campaigns")
      .select(
        "id,name,slug,type,headline,description,cta_text,status,placement,starts_at,ends_at,max_signups,when_full,require_approval,discount_record_id,plan_key,webinar_url,tutorial_at,audience_label,confirmation_message,created_at"
      )
      .order("created_at", { ascending: false }),
    client.from("campaign_signups").select("campaign_id,status")
  ]);
  const counts = new Map<string, number>();
  for (const s of signups ?? []) {
    if (s.status !== "rejected") counts.set(s.campaign_id as string, (counts.get(s.campaign_id as string) ?? 0) + 1);
  }
  return (data ?? []).map((c) => ({ ...mapCampaign(c), signupCount: counts.get(c.id as string) ?? 0 }));
};

export interface CampaignSignupRow {
  id: string;
  campaignId: string;
  name: string | null;
  email: string;
  institution: string | null;
  role: string | null;
  notes: string | null;
  status: string;
  isWaitlisted: boolean;
  referralSource: string | null;
  discountCode: string | null;
  createdAt: string;
}

export const loadCampaignSignups = async (campaignId?: string): Promise<CampaignSignupRow[]> => {
  if (isLocal()) return [];
  const client = await getSupabaseClient();
  if (!client) return [];
  let query = client
    .from("campaign_signups")
    .select("id,campaign_id,name,email,institution,role,notes,status,is_waitlisted,referral_source,discount_code,created_at")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (campaignId) query = query.eq("campaign_id", campaignId);
  const { data } = await query;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    campaignId: r.campaign_id as string,
    name: (r.name as string) ?? null,
    email: r.email as string,
    institution: (r.institution as string) ?? null,
    role: (r.role as string) ?? null,
    notes: (r.notes as string) ?? null,
    status: r.status as string,
    isWaitlisted: Boolean(r.is_waitlisted),
    referralSource: (r.referral_source as string) ?? null,
    discountCode: (r.discount_code as string) ?? null,
    createdAt: r.created_at as string
  }));
};
