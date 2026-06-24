// Pure builder for the workspace-invite email (subject + HTML + text). Kept framework-free here so
// the copy and escaping are unit-testable; the Netlify function imports this and hands the result to
// the Resend transport (netlify/functions/_shared/email.ts). No network/DB access.

export interface InviteEmailParams {
  workspaceName: string;
  inviterEmail: string;
  role: string;
  inviteLink: string;
  expiresInDays?: number;
}

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch] ?? ch));

const ROLE_WORDS: Record<string, string> = {
  admin: "an admin",
  editor: "an editor",
  reviewer: "a reviewer",
  member: "a member"
};

export const buildInviteEmail = (p: InviteEmailParams): EmailContent => {
  const ws = p.workspaceName?.trim() || "a RocketCourse workspace";
  const roleWord = ROLE_WORDS[p.role] ?? `a ${p.role}`;
  const expiry = p.expiresInDays && p.expiresInDays > 0 ? `This invite expires in ${p.expiresInDays} days.` : "";
  const subject = `You're invited to ${ws} on RocketCourse`;

  const text = [
    `${p.inviterEmail} invited you to join the "${ws}" workspace on RocketCourse as ${roleWord}.`,
    "",
    `Accept your invite: ${p.inviteLink}`,
    expiry,
    "",
    "RocketCourse helps teaching teams build Canvas-ready courses fast.",
    "If you weren't expecting this, you can safely ignore this email."
  ]
    .filter(Boolean)
    .join("\n");

  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#1a1a2e;max-width:480px;margin:0 auto;padding:8px">
  <h2 style="margin:0 0 12px;font-size:20px">You're invited to <span style="color:#6a5bff">${escapeHtml(ws)}</span></h2>
  <p style="margin:0 0 18px"><strong>${escapeHtml(p.inviterEmail)}</strong> invited you to join the
    <strong>${escapeHtml(ws)}</strong> workspace on RocketCourse as ${escapeHtml(roleWord)}.</p>
  <p style="margin:0 0 20px"><a href="${escapeHtml(p.inviteLink)}"
    style="display:inline-block;background:#6a5bff;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:10px;font-weight:600">Accept invite</a></p>
  ${expiry ? `<p style="margin:0 0 10px;color:#666;font-size:13px">${escapeHtml(expiry)}</p>` : ""}
  <p style="margin:0;color:#888;font-size:12px">Or paste this link into your browser:<br/>${escapeHtml(p.inviteLink)}</p>
</div>`;

  return { subject, html, text };
};
