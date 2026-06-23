// Client data layer for the team + admin platform. Reads are RLS-scoped via the browser Supabase
// client (super admins see everything via the *_super_read policies; workspace admins see their own
// workspace; members read the shared subscription). Sensitive WRITES go to Netlify Functions with
// the caller's JWT — the server re-checks the role. In local-dev mode (no Supabase) everything
// degrades to safe empties so the UI stays navigable for the offline demo.

import { getSupabaseClient, supabaseConfig } from "./supabaseClient";
import { getSession } from "../auth/authClient";
import { isBootstrapSuperAdminEmail } from "../data/platform";
import { getPlan, type PlanKey } from "../data/plans";
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
  percentOff: number | null;
  amountOff: number | null;
  duration: string | null;
  active: boolean;
  maxRedemptions: number | null;
  createdAt: string;
  stripeCouponId: string | null;
}

export const loadDiscounts = async (): Promise<DiscountRow[]> => {
  if (isLocal()) return [];
  const client = await getSupabaseClient();
  if (!client) return [];
  const { data } = await client
    .from("discount_code_records")
    .select("id,code,name,percent_off,amount_off,duration,active,max_redemptions,created_at,stripe_coupon_id")
    .order("created_at", { ascending: false });
  return (data ?? []).map((d) => ({
    id: d.id as string,
    code: (d.code as string) ?? null,
    name: (d.name as string) ?? null,
    percentOff: (d.percent_off as number) ?? null,
    amountOff: (d.amount_off as number) ?? null,
    duration: (d.duration as string) ?? null,
    active: Boolean(d.active),
    maxRedemptions: (d.max_redemptions as number) ?? null,
    createdAt: d.created_at as string,
    stripeCouponId: (d.stripe_coupon_id as string) ?? null
  }));
};
