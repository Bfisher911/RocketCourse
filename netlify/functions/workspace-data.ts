// POST /.netlify/functions/workspace-data — the workspace admin dashboard payload (server-computed,
// service role). Members are joined to their profile email/name (which workspace admins can't read
// via RLS), seat usage and analytics are derived from trusted rows, and management lists (invites,
// join links, audit) are returned only to admins. Any active member may load the read-only summary.

import { json } from "./_shared/http";
import { getSupabaseAdmin } from "./_shared/supabaseAdmin";
import { requireWorkspaceMember } from "./_shared/guards";
import { isSuperAdmin } from "./_shared/guards";
import { resolveEffectiveSubscription } from "./_shared/workspaceEntitlement";
import { summarizeEntitlement } from "../../src/services/entitlement";

export default async (request: Request): Promise<Response> => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed." });

  let body: { workspaceId?: string };
  try {
    body = (await request.json()) as { workspaceId?: string };
  } catch {
    return json(400, { error: "Body must be JSON: { workspaceId }." });
  }
  const workspaceId = String(body.workspaceId ?? "");
  if (!workspaceId) return json(400, { error: "workspaceId is required." });

  const guard = await requireWorkspaceMember(request, workspaceId);
  if (!guard.ok) return guard.response;
  const admin = getSupabaseAdmin();
  const isAdmin = guard.role === "owner" || guard.role === "admin" || (await isSuperAdmin(guard.user.id));

  const { data: ws } = await admin
    .from("workspaces")
    .select("id,name,slug,plan_key,seat_limit,status,owner_id,stripe_customer_id,created_at")
    .eq("id", workspaceId)
    .maybeSingle();
  if (!ws) return json(404, { error: "Workspace not found." });

  // Members joined to profiles (service role can read both).
  const { data: memberRows } = await admin
    .from("workspace_members")
    .select("user_id,role,status,joined_at,last_active_at")
    .eq("workspace_id", workspaceId)
    .order("joined_at", { ascending: true });
  const userIds = (memberRows ?? []).map((m) => m.user_id as string);
  const { data: profiles } = userIds.length
    ? await admin.from("profiles").select("id,email,full_name").in("id", userIds)
    : { data: [] as { id: string; email: string; full_name: string }[] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id as string, p]));
  const members = (memberRows ?? []).map((m) => ({
    userId: m.user_id,
    role: m.role,
    status: m.status,
    joinedAt: m.joined_at,
    lastActiveAt: m.last_active_at,
    email: profileById.get(m.user_id as string)?.email ?? null,
    fullName: profileById.get(m.user_id as string)?.full_name ?? null
  }));
  const seatUsed = members.filter((m) => m.status === "active").length;

  // Shared subscription + usage (resolve through the owner so credits fold in).
  const eff = await resolveEffectiveSubscription(ws.owner_id as string);
  const entitlement = summarizeEntitlement(eff.subscription);

  const { count: projectCount } = await admin
    .from("course_projects")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);

  // Admin-only management data.
  let invites: unknown[] = [];
  let joinLinks: unknown[] = [];
  let recentAudit: unknown[] = [];
  if (isAdmin) {
    const [{ data: inv }, { data: links }, { data: audit }] = await Promise.all([
      admin
        .from("workspace_invites")
        .select("id,email,role,status,expires_at,created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false }),
      admin
        .from("workspace_join_links")
        .select("id,default_role,max_uses,used_count,is_active,expires_at,created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false }),
      admin
        .from("audit_events")
        .select("id,event_type,actor_email,target_type,target_id,metadata,created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(25)
    ]);
    invites = (inv ?? []).filter((i) => i.status === "pending");
    joinLinks = links ?? [];
    recentAudit = audit ?? [];
  }

  return json(200, {
    workspace: {
      id: ws.id,
      name: ws.name,
      slug: ws.slug,
      planKey: ws.plan_key,
      seatLimit: ws.seat_limit,
      status: ws.status,
      ownerId: ws.owner_id,
      stripeCustomerId: isAdmin ? ws.stripe_customer_id : null,
      createdAt: ws.created_at
    },
    myRole: guard.role,
    isAdmin,
    seat: { used: seatUsed, limit: ws.seat_limit as number, available: Math.max(0, (ws.seat_limit as number) - seatUsed) },
    members,
    invites,
    joinLinks,
    projectCount: projectCount ?? 0,
    entitlement,
    recentAudit
  });
};
