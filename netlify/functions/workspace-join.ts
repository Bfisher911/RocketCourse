// POST /.netlify/functions/workspace-join  — the CURRENT user accepts an invite or a join link.
// Body: { token, type: "invite" | "join" }. Requires Authorization: Bearer <jwt>.
// Seats are enforced HERE (server-side): a brand-new member needs a free seat; an existing member
// re-accepting does not. This is the authoritative seat gate — never trust the client.

import { getAuthedUser, json } from "./_shared/http";
import { getSupabaseAdmin } from "./_shared/supabaseAdmin";
import { createAuditLog } from "./_shared/guards";
import { hashToken } from "./_shared/tokens";

interface MemberRow {
  user_id: string;
  status: string;
}

const activeSeatInfo = async (
  workspaceId: string
): Promise<{ activeCount: number; seatLimit: number; name: string }> => {
  const admin = getSupabaseAdmin();
  const [{ data: members }, { data: ws }] = await Promise.all([
    admin.from("workspace_members").select("user_id,status").eq("workspace_id", workspaceId),
    admin.from("workspaces").select("seat_limit,name").eq("id", workspaceId).maybeSingle()
  ]);
  const activeCount = ((members as MemberRow[] | null) ?? []).filter((m) => m.status === "active").length;
  return { activeCount, seatLimit: (ws?.seat_limit as number) ?? 1, name: (ws?.name as string) ?? "Workspace" };
};

const isActiveMember = async (workspaceId: string, userId: string): Promise<boolean> => {
  const { data } = await getSupabaseAdmin()
    .from("workspace_members")
    .select("status")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.status === "active";
};

export default async (request: Request): Promise<Response> => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed." });

  const user = await getAuthedUser(request);
  if (!user) return json(401, { error: "Sign in to join a workspace." });

  let body: { token?: string; type?: string };
  try {
    body = (await request.json()) as { token?: string; type?: string };
  } catch {
    return json(400, { error: "Body must be JSON: { token, type }." });
  }
  const token = String(body.token ?? "").trim();
  const type = body.type === "join" ? "join" : "invite";
  if (!token) return json(400, { error: "A token is required." });

  const admin = getSupabaseAdmin();
  const tokenHash = await hashToken(token);

  if (type === "invite") {
    const { data: invite } = await admin
      .from("workspace_invites")
      .select("id,workspace_id,role,status,expires_at,created_by")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (!invite || invite.status !== "pending") return json(404, { error: "This invite is invalid or already used." });
    if (invite.expires_at && new Date(invite.expires_at as string) < new Date()) {
      await admin.from("workspace_invites").update({ status: "expired" }).eq("id", invite.id);
      return json(410, { error: "This invite has expired. Ask the admin to send a new one." });
    }

    const seat = await activeSeatInfo(invite.workspace_id as string);
    const already = await isActiveMember(invite.workspace_id as string, user.id);
    if (!already && seat.activeCount >= seat.seatLimit) {
      return json(409, { error: "This workspace has no seats available. Ask the admin to free a seat or add capacity." });
    }

    await admin.from("workspace_members").upsert(
      {
        workspace_id: invite.workspace_id,
        user_id: user.id,
        role: invite.role,
        status: "active",
        invited_by: invite.created_by
      },
      { onConflict: "workspace_id,user_id" }
    );
    await admin
      .from("workspace_invites")
      .update({ status: "accepted", accepted_by: user.id, accepted_at: new Date().toISOString() })
      .eq("id", invite.id);
    await admin
      .from("profiles")
      .update({ default_workspace_id: invite.workspace_id })
      .eq("id", user.id)
      .is("default_workspace_id", null);

    await createAuditLog({
      actorUserId: user.id,
      actorEmail: user.email,
      workspaceId: invite.workspace_id as string,
      eventType: "invite_accepted",
      targetType: "workspace_member",
      targetId: user.id,
      metadata: { role: invite.role },
      request
    });
    return json(200, { ok: true, workspaceId: invite.workspace_id, workspaceName: seat.name });
  }

  // type === "join"
  const { data: link } = await admin
    .from("workspace_join_links")
    .select("id,workspace_id,default_role,max_uses,used_count,is_active,expires_at,created_by")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!link || !link.is_active) return json(404, { error: "This join link is invalid or has been revoked." });
  if (link.expires_at && new Date(link.expires_at as string) < new Date()) {
    return json(410, { error: "This join link has expired." });
  }
  if (link.max_uses !== null && (link.used_count as number) >= (link.max_uses as number)) {
    return json(409, { error: "This join link has reached its usage limit." });
  }

  const seat = await activeSeatInfo(link.workspace_id as string);
  const already = await isActiveMember(link.workspace_id as string, user.id);
  if (!already && seat.activeCount >= seat.seatLimit) {
    return json(409, { error: "This workspace has no seats available." });
  }

  await admin.from("workspace_members").upsert(
    {
      workspace_id: link.workspace_id,
      user_id: user.id,
      role: link.default_role,
      status: "active",
      invited_by: link.created_by
    },
    { onConflict: "workspace_id,user_id" }
  );
  if (!already) {
    await admin
      .from("workspace_join_links")
      .update({ used_count: (link.used_count as number) + 1 })
      .eq("id", link.id);
  }
  await admin
    .from("profiles")
    .update({ default_workspace_id: link.workspace_id })
    .eq("id", user.id)
    .is("default_workspace_id", null);

  await createAuditLog({
    actorUserId: user.id,
    actorEmail: user.email,
    workspaceId: link.workspace_id as string,
    eventType: "invite_accepted",
    targetType: "workspace_member",
    targetId: user.id,
    metadata: { via: "join_link", role: link.default_role },
    request
  });
  return json(200, { ok: true, workspaceId: link.workspace_id, workspaceName: seat.name });
};
