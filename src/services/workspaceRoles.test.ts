import { describe, expect, it } from "vitest";
import {
  activeAdminCount,
  canAcceptInvite,
  canEditContent,
  canManageBilling,
  isWorkspaceAdminRole,
  seatAvailability,
  seatUsage,
  wouldOrphanWorkspace,
  type WorkspaceMemberLike
} from "./workspaceRoles";

const m = (role: WorkspaceMemberLike["role"], status: WorkspaceMemberLike["status"] = "active"): WorkspaceMemberLike => ({
  role,
  status
});

describe("role capabilities", () => {
  it("only owner/admin manage the workspace and billing", () => {
    expect(isWorkspaceAdminRole("owner")).toBe(true);
    expect(isWorkspaceAdminRole("admin")).toBe(true);
    expect(isWorkspaceAdminRole("editor")).toBe(false);
    expect(isWorkspaceAdminRole("reviewer")).toBe(false);
    expect(canManageBilling("member")).toBe(false);
  });

  it("reviewers cannot edit content; editors/members can", () => {
    expect(canEditContent("reviewer")).toBe(false);
    expect(canEditContent("editor")).toBe(true);
    expect(canEditContent("member")).toBe(true);
    expect(canEditContent("admin")).toBe(true);
  });
});

describe("seat usage", () => {
  const members = [m("owner"), m("admin"), m("member"), m("member", "invited"), m("member", "removed")];

  it("counts only active members — pending invites and removed members do not consume seats", () => {
    expect(seatUsage(members)).toBe(3);
  });

  it("reports availability against the seat limit", () => {
    expect(seatAvailability(members, 5)).toEqual({ used: 3, limit: 5, available: 2, full: false });
    expect(seatAvailability(members, 3)).toEqual({ used: 3, limit: 3, available: 0, full: true });
    // never negative
    expect(seatAvailability(members, 2).available).toBe(0);
  });

  it("blocks accepting a new member when full, but allows an existing member to re-accept", () => {
    const full = [m("owner"), m("member"), m("member")];
    expect(canAcceptInvite(full, 3, false)).toBe(false);
    expect(canAcceptInvite(full, 3, true)).toBe(true);
    expect(canAcceptInvite(full, 5, false)).toBe(true);
  });
});

describe("last-admin protection", () => {
  it("counts active admins/owners", () => {
    expect(activeAdminCount([m("owner"), m("admin"), m("member")])).toBe(2);
    expect(activeAdminCount([m("owner"), m("admin", "removed")])).toBe(1);
  });

  it("refuses to remove/demote the only remaining admin", () => {
    const soloAdmin = [m("owner"), m("member"), m("reviewer")];
    expect(wouldOrphanWorkspace(soloAdmin, soloAdmin[0])).toBe(true);
    // a member is not an admin → removing them never orphans
    expect(wouldOrphanWorkspace(soloAdmin, soloAdmin[1])).toBe(false);
    // with two admins, removing one is fine
    const twoAdmins = [m("owner"), m("admin"), m("member")];
    expect(wouldOrphanWorkspace(twoAdmins, twoAdmins[0])).toBe(false);
  });
});
