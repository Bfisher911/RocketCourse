// Creates / syncs a team workspace from a Stripe subscription. Called by the webhook when a
// team-capable plan activates. The purchaser becomes the Workspace Launchpad Admin (owner + an
// active 'owner' membership), seat_limit comes from the plan (or Stripe quantity, whichever is
// larger), and the subscription is linked to the workspace. Idempotent.

import { getSupabaseAdmin } from "./supabaseAdmin";
import { getPlan, type PlanKey } from "../../../src/data/plans";

const WS_STATUSES = ["active", "trialing", "past_due", "canceled", "paused"];

export const slugify = (input: string): string => {
  const base = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40)
    .replace(/^-|-$/g, "");
  return base || "workspace";
};

const randomSuffix = (): string => Math.random().toString(36).slice(2, 8);

export interface WorkspaceSyncParams {
  userId: string;
  planKey: PlanKey;
  status: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  seatQuantity?: number | null;
  workspaceName?: string | null;
}

/** Ensure a workspace exists for a team subscription and return its id (or null for non-team plans). */
export const ensureWorkspaceForSubscription = async (p: WorkspaceSyncParams): Promise<string | null> => {
  const plan = getPlan(p.planKey);
  if (!plan.capabilities.teamWorkspace) return null;

  const admin = getSupabaseAdmin();
  const seatLimit = Math.max(plan.seatsLimit ?? 1, p.seatQuantity ?? 0, 1);
  const wsStatus = WS_STATUSES.includes(p.status) ? p.status : "active";

  // Find an existing workspace: by subscription id first, else the user's earliest owned workspace.
  let workspaceId: string | null = null;
  if (p.stripeSubscriptionId) {
    const { data } = await admin
      .from("workspaces")
      .select("id")
      .eq("stripe_subscription_id", p.stripeSubscriptionId)
      .maybeSingle();
    workspaceId = (data?.id as string) ?? null;
  }
  if (!workspaceId) {
    const { data } = await admin
      .from("workspaces")
      .select("id")
      .eq("owner_id", p.userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    workspaceId = (data?.id as string) ?? null;
  }

  if (workspaceId) {
    await admin
      .from("workspaces")
      .update({
        plan_key: p.planKey,
        seat_limit: seatLimit,
        status: wsStatus,
        stripe_customer_id: p.stripeCustomerId,
        stripe_subscription_id: p.stripeSubscriptionId,
        updated_at: new Date().toISOString()
      })
      .eq("id", workspaceId);
  } else {
    // Build a friendly default name from the owner's email handle.
    const { data: profile } = await admin.from("profiles").select("email,full_name").eq("id", p.userId).maybeSingle();
    const handle = (profile?.email as string | undefined)?.split("@")[0] || "Team";
    const baseName = p.workspaceName?.trim() || `${handle}'s Workspace`;

    let slug = slugify(baseName);
    for (let i = 0; i < 4; i += 1) {
      const { data: clash } = await admin.from("workspaces").select("id").eq("slug", slug).maybeSingle();
      if (!clash) break;
      slug = `${slugify(baseName)}-${randomSuffix()}`;
    }

    const { data: created } = await admin
      .from("workspaces")
      .insert({
        name: baseName,
        slug,
        owner_id: p.userId,
        created_by: p.userId,
        plan_key: p.planKey,
        seat_limit: seatLimit,
        status: wsStatus,
        stripe_customer_id: p.stripeCustomerId,
        stripe_subscription_id: p.stripeSubscriptionId
      })
      .select("id")
      .single();
    workspaceId = (created?.id as string) ?? null;
  }

  if (!workspaceId) return null;

  // Purchaser is the Workspace Launchpad Admin: active 'owner' membership (idempotent).
  await admin
    .from("workspace_members")
    .upsert(
      { workspace_id: workspaceId, user_id: p.userId, role: "owner", status: "active" },
      { onConflict: "workspace_id,user_id" }
    );

  // Link the subscription to the workspace so members resolve the shared plan.
  const subQuery = admin.from("subscriptions").update({ workspace_id: workspaceId });
  if (p.stripeSubscriptionId) {
    await subQuery.eq("stripe_subscription_id", p.stripeSubscriptionId);
  } else {
    await subQuery.eq("user_id", p.userId);
  }

  // Default the owner into this workspace if they have none.
  await admin
    .from("profiles")
    .update({ default_workspace_id: workspaceId })
    .eq("id", p.userId)
    .is("default_workspace_id", null);

  await admin.from("audit_events").insert({
    actor_user_id: p.userId,
    workspace_id: workspaceId,
    event_type: "workspace_created",
    target_type: "workspace",
    target_id: workspaceId,
    metadata: { plan_key: p.planKey, seat_limit: seatLimit, source: "stripe_webhook" }
  });

  return workspaceId;
};
