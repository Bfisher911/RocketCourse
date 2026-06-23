// Pure workspace role + seat logic. Shared by the client (advisory UI) and the server (the real
// enforcement, which re-derives these from trusted DB rows). No I/O here — just the rules.

export type WorkspaceRole = "owner" | "admin" | "editor" | "reviewer" | "member";
export type MemberStatus = "active" | "invited" | "removed";
export type InviteRole = "admin" | "editor" | "reviewer" | "member";

export interface WorkspaceMemberLike {
  role: WorkspaceRole;
  status: MemberStatus;
}

export const WORKSPACE_ROLES: WorkspaceRole[] = ["owner", "admin", "editor", "reviewer", "member"];
/** Roles a member can be invited/assigned as (owner is reserved for the workspace creator). */
export const ASSIGNABLE_ROLES: InviteRole[] = ["admin", "editor", "reviewer", "member"];

export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: "Owner",
  admin: "Workspace Admin",
  editor: "Designer",
  reviewer: "Reviewer",
  member: "Member"
};

export const ROLE_DESCRIPTIONS: Record<WorkspaceRole, string> = {
  owner: "Full control, billing, and seat management.",
  admin: "Manage seats, members, and workspace settings.",
  editor: "Create and edit course content.",
  reviewer: "View and comment on course content.",
  member: "Create and edit their own courses in the workspace."
};

const ADMIN_ROLES: WorkspaceRole[] = ["owner", "admin"];
const EDIT_ROLES: WorkspaceRole[] = ["owner", "admin", "editor", "member"];

/** Can manage seats, members, invites, and workspace settings. */
export const isWorkspaceAdminRole = (role: WorkspaceRole): boolean => ADMIN_ROLES.includes(role);
/** Can create/edit course content. Reviewers cannot. */
export const canEditContent = (role: WorkspaceRole): boolean => EDIT_ROLES.includes(role);
/** Can open billing / manage the subscription. */
export const canManageBilling = (role: WorkspaceRole): boolean => ADMIN_ROLES.includes(role);

/** Seat usage = active members only. Pending invites do NOT consume a seat. */
export const seatUsage = (members: WorkspaceMemberLike[]): number =>
  members.filter((m) => m.status === "active").length;

export interface SeatAvailability {
  used: number;
  limit: number;
  available: number;
  full: boolean;
}

export const seatAvailability = (members: WorkspaceMemberLike[], seatLimit: number): SeatAvailability => {
  const used = seatUsage(members);
  const available = Math.max(0, seatLimit - used);
  return { used, limit: seatLimit, available, full: available <= 0 };
};

/**
 * Whether one more person can be accepted into the workspace. An existing member re-accepting does
 * not need a free seat; a brand-new member does.
 */
export const canAcceptInvite = (
  members: WorkspaceMemberLike[],
  seatLimit: number,
  alreadyActiveMember: boolean
): boolean => alreadyActiveMember || seatAvailability(members, seatLimit).available > 0;

/** Count active owners + admins (used to protect the last admin). */
export const activeAdminCount = (members: WorkspaceMemberLike[]): number =>
  members.filter((m) => m.status === "active" && ADMIN_ROLES.includes(m.role)).length;

/**
 * True when removing/demoting `target` would leave the workspace with zero admins. The UI and the
 * server both refuse this.
 */
export const wouldOrphanWorkspace = (members: WorkspaceMemberLike[], target: WorkspaceMemberLike): boolean =>
  target.status === "active" && ADMIN_ROLES.includes(target.role) && activeAdminCount(members) <= 1;
