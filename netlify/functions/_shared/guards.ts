// Server-side authorization guards — the REAL gate for super-admin, workspace-admin, and audited
// actions. Client role checks are advisory; these run with the service role and are authoritative.

import { getAuthedUser, json, type AuthedUser } from "./http";
import { getSupabaseAdmin } from "./supabaseAdmin";
import type { WorkspaceRole } from "../../../src/services/workspaceRoles";

export interface RequestContext {
  ipAddress: string | null;
  userAgent: string | null;
}

/** Best-effort request metadata for audit logs. */
export const requestContext = (request: Request): RequestContext => ({
  ipAddress:
    request.headers.get("x-nf-client-connection-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null,
  userAgent: request.headers.get("user-agent") || null
});

/** Authoritative super-admin check against the trusted profiles row. */
export const isSuperAdmin = async (userId: string): Promise<boolean> => {
  const { data } = await getSupabaseAdmin()
    .from("profiles")
    .select("is_super_admin")
    .eq("id", userId)
    .maybeSingle();
  return Boolean(data?.is_super_admin);
};

export type Guard<Extra = unknown> =
  | ({ ok: true; user: AuthedUser } & Extra)
  | { ok: false; response: Response };

/** Require a signed-in Super Admin. Returns the user or a ready-to-send 401/403 response. */
export const requireSuperAdmin = async (request: Request): Promise<Guard> => {
  const user = await getAuthedUser(request);
  if (!user) return { ok: false, response: json(401, { error: "Authentication required." }) };
  if (!(await isSuperAdmin(user.id))) {
    return { ok: false, response: json(403, { error: "Super admin access required." }) };
  }
  return { ok: true, user };
};

/** The caller's effective role in a workspace (owner via ownership, else their active membership). */
export const getWorkspaceRole = async (
  userId: string,
  workspaceId: string
): Promise<WorkspaceRole | null> => {
  const admin = getSupabaseAdmin();
  const { data: ws } = await admin.from("workspaces").select("owner_id").eq("id", workspaceId).maybeSingle();
  if (ws?.owner_id === userId) return "owner";
  const { data: m } = await admin
    .from("workspace_members")
    .select("role,status")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!m || m.status !== "active") return null;
  return m.role as WorkspaceRole;
};

/** Require workspace owner/admin (Super Admins pass for any workspace, recorded as 'owner'). */
export const requireWorkspaceAdmin = async (
  request: Request,
  workspaceId: string
): Promise<Guard<{ role: WorkspaceRole; superAdmin: boolean }>> => {
  const user = await getAuthedUser(request);
  if (!user) return { ok: false, response: json(401, { error: "Authentication required." }) };
  if (await isSuperAdmin(user.id)) return { ok: true, user, role: "owner", superAdmin: true };
  const role = await getWorkspaceRole(user.id, workspaceId);
  if (!role || (role !== "owner" && role !== "admin")) {
    return { ok: false, response: json(403, { error: "Workspace admin access required." }) };
  }
  return { ok: true, user, role, superAdmin: false };
};

/** Require an active member (any role) of the workspace. */
export const requireWorkspaceMember = async (
  request: Request,
  workspaceId: string
): Promise<Guard<{ role: WorkspaceRole }>> => {
  const user = await getAuthedUser(request);
  if (!user) return { ok: false, response: json(401, { error: "Authentication required." }) };
  if (await isSuperAdmin(user.id)) return { ok: true, user, role: "owner" };
  const role = await getWorkspaceRole(user.id, workspaceId);
  if (!role) return { ok: false, response: json(403, { error: "You are not a member of this workspace." }) };
  return { ok: true, user, role };
};

/** Insert an audit_events row. Never throws — auditing must not block the action it records. */
export const createAuditLog = async (params: {
  actorUserId: string | null;
  actorEmail?: string | null;
  workspaceId?: string | null;
  eventType: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
  request?: Request;
}): Promise<void> => {
  const ctx = params.request ? requestContext(params.request) : { ipAddress: null, userAgent: null };
  try {
    await getSupabaseAdmin().from("audit_events").insert({
      actor_user_id: params.actorUserId,
      actor_email: params.actorEmail ?? null,
      workspace_id: params.workspaceId ?? null,
      event_type: params.eventType,
      target_type: params.targetType ?? null,
      target_id: params.targetId ?? null,
      metadata: params.metadata ?? {},
      ip_address: ctx.ipAddress,
      user_agent: ctx.userAgent
    });
  } catch {
    // best-effort
  }
};
