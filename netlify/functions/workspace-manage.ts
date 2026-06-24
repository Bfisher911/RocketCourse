// POST /.netlify/functions/workspace-manage — workspace-admin write actions (seats & members).
// Body: { workspaceId, action, ...params }. Requires the caller to be the workspace owner/admin
// (or a Super Admin). Every mutation is server-enforced and audit-logged. Tokens are returned to
// the caller once (we store only their hash) so the UI can show a copyable link.

import { json } from "./_shared/http";
import { getSupabaseAdmin } from "./_shared/supabaseAdmin";
import { appUrl } from "./_shared/stripe";
import { createAuditLog, requireWorkspaceAdmin } from "./_shared/guards";
import { generateToken, hashToken } from "./_shared/tokens";
import { sendEmail } from "./_shared/email";
import { buildInviteEmail } from "../../src/services/inviteEmail";
import {
  ASSIGNABLE_ROLES,
  wouldOrphanWorkspace,
  type InviteRole,
  type WorkspaceMemberLike,
  type WorkspaceRole
} from "../../src/services/workspaceRoles";

const INVITE_TTL_DAYS = 14;
const JOIN_ROLES: InviteRole[] = ["editor", "reviewer", "member"];

interface MemberRow extends WorkspaceMemberLike {
  user_id: string;
}

const loadMembers = async (workspaceId: string): Promise<MemberRow[]> => {
  const { data } = await getSupabaseAdmin()
    .from("workspace_members")
    .select("user_id,role,status")
    .eq("workspace_id", workspaceId);
  return ((data as MemberRow[] | null) ?? []).map((m) => ({
    user_id: m.user_id,
    role: m.role as WorkspaceRole,
    status: m.status
  }));
};

const inviteLink = (token: string): string => `${appUrl()}/join?invite=${token}`;
const joinLinkUrl = (token: string): string => `${appUrl()}/join?link=${token}`;

const workspaceName = async (workspaceId: string): Promise<string> => {
  const { data } = await getSupabaseAdmin().from("workspaces").select("name").eq("id", workspaceId).maybeSingle();
  return (data?.name as string) ?? "your team workspace";
};

/** Email the invite (no-op-safe: returns false when RESEND_API_KEY is unset). */
const emailInvite = async (params: {
  to: string;
  workspaceId: string;
  inviterEmail: string;
  role: string;
  token: string;
}): Promise<boolean> => {
  const content = buildInviteEmail({
    workspaceName: await workspaceName(params.workspaceId),
    inviterEmail: params.inviterEmail,
    role: params.role,
    inviteLink: inviteLink(params.token),
    expiresInDays: INVITE_TTL_DAYS
  });
  const result = await sendEmail({
    to: params.to,
    subject: content.subject,
    html: content.html,
    text: content.text,
    replyTo: params.inviterEmail
  });
  return result.sent;
};

export default async (request: Request): Promise<Response> => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed." });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json(400, { error: "Body must be JSON." });
  }
  const workspaceId = String(body.workspaceId ?? "");
  const action = String(body.action ?? "");
  if (!workspaceId || !action) return json(400, { error: "workspaceId and action are required." });

  const guard = await requireWorkspaceAdmin(request, workspaceId);
  if (!guard.ok) return guard.response;
  const admin = getSupabaseAdmin();
  const actor = guard.user;

  const audit = (eventType: string, targetType: string, targetId: string | null, metadata: Record<string, unknown> = {}) =>
    createAuditLog({ actorUserId: actor.id, actorEmail: actor.email, workspaceId, eventType, targetType, targetId, metadata, request });

  switch (action) {
    case "invite": {
      const email = String(body.email ?? "").trim().toLowerCase();
      const role = body.role as InviteRole;
      if (!email || !email.includes("@")) return json(400, { error: "A valid email is required." });
      if (!ASSIGNABLE_ROLES.includes(role)) return json(400, { error: "Invalid role." });

      const token = generateToken();
      const tokenHash = await hashToken(token);
      // One live invite per email: retire any existing pending invite first.
      await admin
        .from("workspace_invites")
        .update({ status: "revoked" })
        .eq("workspace_id", workspaceId)
        .eq("status", "pending")
        .eq("email", email);
      const { error } = await admin.from("workspace_invites").insert({
        workspace_id: workspaceId,
        email,
        role,
        token_hash: tokenHash,
        status: "pending",
        expires_at: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000).toISOString(),
        created_by: actor.id
      });
      if (error) return json(500, { error: error.message });
      const emailed = await emailInvite({ to: email, workspaceId, inviterEmail: actor.email, role, token });
      await audit("member_invited", "workspace_invite", email, { role, emailed });
      return json(200, { ok: true, email, role, inviteLink: inviteLink(token), emailed });
    }

    case "resendInvite": {
      const inviteId = String(body.inviteId ?? "");
      if (!inviteId) return json(400, { error: "inviteId is required." });
      const { data: existing } = await admin
        .from("workspace_invites")
        .select("id,email,role,workspace_id,status")
        .eq("id", inviteId)
        .maybeSingle();
      if (!existing || existing.workspace_id !== workspaceId) return json(404, { error: "Invite not found." });
      const token = generateToken();
      const tokenHash = await hashToken(token);
      await admin
        .from("workspace_invites")
        .update({
          token_hash: tokenHash,
          status: "pending",
          expires_at: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000).toISOString()
        })
        .eq("id", inviteId);
      const emailed = await emailInvite({
        to: existing.email as string,
        workspaceId,
        inviterEmail: actor.email,
        role: existing.role as string,
        token
      });
      await audit("member_invited", "workspace_invite", existing.email as string, { role: existing.role, resent: true, emailed });
      return json(200, { ok: true, inviteLink: inviteLink(token), emailed });
    }

    case "revokeInvite": {
      const inviteId = String(body.inviteId ?? "");
      if (!inviteId) return json(400, { error: "inviteId is required." });
      const { data: existing } = await admin
        .from("workspace_invites")
        .select("id,email,workspace_id")
        .eq("id", inviteId)
        .maybeSingle();
      if (!existing || existing.workspace_id !== workspaceId) return json(404, { error: "Invite not found." });
      await admin.from("workspace_invites").update({ status: "revoked" }).eq("id", inviteId);
      await audit("invite_revoked", "workspace_invite", existing.email as string);
      return json(200, { ok: true });
    }

    case "createJoinLink": {
      const defaultRole = body.defaultRole as InviteRole;
      if (!JOIN_ROLES.includes(defaultRole)) return json(400, { error: "Invalid default role for a join link." });
      const maxUses = Number.isFinite(Number(body.maxUses)) && Number(body.maxUses) > 0 ? Math.floor(Number(body.maxUses)) : null;
      const expiresInDays =
        Number.isFinite(Number(body.expiresInDays)) && Number(body.expiresInDays) > 0 ? Math.floor(Number(body.expiresInDays)) : null;
      const token = generateToken();
      const tokenHash = await hashToken(token);
      const { error } = await admin.from("workspace_join_links").insert({
        workspace_id: workspaceId,
        token_hash: tokenHash,
        default_role: defaultRole,
        max_uses: maxUses,
        expires_at: expiresInDays ? new Date(Date.now() + expiresInDays * 86_400_000).toISOString() : null,
        is_active: true,
        created_by: actor.id
      });
      if (error) return json(500, { error: error.message });
      await audit("join_link_created", "workspace_join_link", null, { defaultRole, maxUses });
      return json(200, { ok: true, joinLink: joinLinkUrl(token) });
    }

    case "revokeJoinLink": {
      const linkId = String(body.linkId ?? "");
      if (!linkId) return json(400, { error: "linkId is required." });
      const { data: existing } = await admin
        .from("workspace_join_links")
        .select("id,workspace_id")
        .eq("id", linkId)
        .maybeSingle();
      if (!existing || existing.workspace_id !== workspaceId) return json(404, { error: "Join link not found." });
      await admin.from("workspace_join_links").update({ is_active: false }).eq("id", linkId);
      await audit("join_link_revoked", "workspace_join_link", linkId);
      return json(200, { ok: true });
    }

    case "removeMember": {
      const memberUserId = String(body.memberUserId ?? "");
      if (!memberUserId) return json(400, { error: "memberUserId is required." });
      const { data: ws } = await admin.from("workspaces").select("owner_id").eq("id", workspaceId).maybeSingle();
      if (ws?.owner_id === memberUserId) {
        return json(400, { error: "The workspace owner can't be removed. Transfer ownership or change the plan instead." });
      }
      const members = await loadMembers(workspaceId);
      const target = members.find((m) => m.user_id === memberUserId);
      if (!target) return json(404, { error: "Member not found." });
      if (wouldOrphanWorkspace(members, target)) {
        return json(400, { error: "You can't remove the last workspace admin." });
      }
      await admin
        .from("workspace_members")
        .update({ status: "removed" })
        .eq("workspace_id", workspaceId)
        .eq("user_id", memberUserId);
      await audit("member_removed", "workspace_member", memberUserId, { previousRole: target.role });
      return json(200, { ok: true });
    }

    case "changeRole": {
      const memberUserId = String(body.memberUserId ?? "");
      const role = body.role as WorkspaceRole;
      if (!memberUserId) return json(400, { error: "memberUserId is required." });
      if (!ASSIGNABLE_ROLES.includes(role as InviteRole)) {
        return json(400, { error: "Invalid role. (Owner can't be assigned here.)" });
      }
      const { data: ws } = await admin.from("workspaces").select("owner_id").eq("id", workspaceId).maybeSingle();
      if (ws?.owner_id === memberUserId) {
        return json(400, { error: "The workspace owner's role can't be changed here." });
      }
      const members = await loadMembers(workspaceId);
      const target = members.find((m) => m.user_id === memberUserId);
      if (!target) return json(404, { error: "Member not found." });
      // Demoting the last admin out of an admin role would orphan the workspace.
      const demotingFromAdmin = (target.role === "admin" || target.role === "owner") && role !== "admin";
      if (demotingFromAdmin && wouldOrphanWorkspace(members, target)) {
        return json(400, { error: "You can't demote the last workspace admin." });
      }
      await admin
        .from("workspace_members")
        .update({ role })
        .eq("workspace_id", workspaceId)
        .eq("user_id", memberUserId);
      await audit("role_changed", "workspace_member", memberUserId, { from: target.role, to: role });
      return json(200, { ok: true });
    }

    default:
      return json(400, { error: `Unknown action: ${action}` });
  }
};
