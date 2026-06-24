import { describe, expect, it } from "vitest";
import { buildInviteEmail } from "./inviteEmail";

describe("buildInviteEmail", () => {
  const base = {
    workspaceName: "Biology Department",
    inviterEmail: "lead@school.edu",
    role: "editor",
    inviteLink: "https://app.example.com/join?invite=tok123",
    expiresInDays: 14
  };

  it("puts the workspace name in the subject", () => {
    expect(buildInviteEmail(base).subject).toBe("You're invited to Biology Department on RocketCourse");
  });

  it("includes the invite link in both html and text", () => {
    const e = buildInviteEmail(base);
    expect(e.html).toContain("https://app.example.com/join?invite=tok123");
    expect(e.text).toContain("https://app.example.com/join?invite=tok123");
  });

  it("maps the role to a friendly word", () => {
    expect(buildInviteEmail({ ...base, role: "admin" }).text).toContain("as an admin");
    expect(buildInviteEmail({ ...base, role: "member" }).text).toContain("as a member");
    expect(buildInviteEmail({ ...base, role: "weird" }).text).toContain("as a weird");
  });

  it("includes an expiry note only when expiresInDays is set", () => {
    expect(buildInviteEmail(base).text).toContain("expires in 14 days");
    expect(buildInviteEmail({ ...base, expiresInDays: undefined }).text).not.toContain("expires in");
  });

  it("escapes html in the inviter email and workspace name", () => {
    const e = buildInviteEmail({ ...base, workspaceName: "A & B <Team>", inviterEmail: 'x"<y>@z.edu' });
    expect(e.html).toContain("A &amp; B &lt;Team&gt;");
    expect(e.html).toContain("x&quot;&lt;y&gt;@z.edu");
    expect(e.html).not.toContain("<Team>");
  });

  it("falls back to a generic name when workspaceName is blank", () => {
    expect(buildInviteEmail({ ...base, workspaceName: "" }).subject).toContain("a RocketCourse workspace");
  });
});
