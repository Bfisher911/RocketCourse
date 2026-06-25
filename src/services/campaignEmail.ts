// Pure builder for the Founding Cohort waitlist welcome/confirmation email (subject + HTML + text).
// Framework-free so the copy + escaping are unit-testable; the campaign-signup function imports this
// and hands the result to the Resend transport (netlify/functions/_shared/email.ts), best-effort.
// This is a transactional confirmation of the user's own signup — it delivers their discount code,
// referral link, and (if requested) workshop details. No network/DB access.

export interface WaitlistWelcomeParams {
  firstName?: string | null;
  campaignName: string;
  outcome: "open" | "waitlist";
  discountCode?: string | null;
  discountPercent?: number | null;
  discountMonths?: number | null;
  referralUrl?: string | null;
  referralRewardSummary?: string | null;
  wantsWebinar?: boolean;
  webinarTitle?: string | null;
  webinarUrl?: string | null;
  webinarWhen?: string | null; // already-formatted, human-readable
}

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch] ?? ch));

export const buildWaitlistWelcomeEmail = (p: WaitlistWelcomeParams): EmailContent => {
  const name = (p.firstName ?? "").trim();
  const hi = name ? `Hi ${name},` : "Hi there,";
  const campaign = p.campaignName?.trim() || "the RocketCourse Founding Cohort";
  const isWaitlist = p.outcome === "waitlist";

  const subject = isWaitlist
    ? `You're on the ${campaign} waitlist`
    : `Welcome to the ${campaign} 🚀`;

  const intro = isWaitlist
    ? `Thanks for your interest in ${campaign}! It's currently full, so you're on the waitlist — we'll reach out the moment a spot opens.`
    : `You're in! Thanks for joining ${campaign}. Here's everything you need to get started.`;

  const discountLine =
    p.discountCode && !isWaitlist
      ? `Your founding discount code: ${p.discountCode}` +
        (p.discountPercent ? ` — ${p.discountPercent}% off your first ${p.discountMonths ?? 3} months.` : ".")
      : "";

  const webinarLine =
    p.wantsWebinar && p.webinarUrl
      ? `${p.webinarTitle ?? "Workshop"}${p.webinarWhen ? ` — ${p.webinarWhen}` : ""}: ${p.webinarUrl}`
      : "";

  const referralLine = p.referralUrl
    ? `${p.referralRewardSummary ?? "Invite colleagues and earn rewards."} Share your link: ${p.referralUrl}`
    : "";

  const text = [
    hi,
    "",
    intro,
    discountLine ? `\n${discountLine}` : "",
    webinarLine ? `\n${webinarLine}` : "",
    referralLine ? `\n${referralLine}` : "",
    "",
    "— The RocketCourse team",
    "If you didn't sign up, you can safely ignore this email."
  ]
    .filter((l) => l !== "")
    .join("\n");

  const btn = (href: string, label: string, bg: string) =>
    `<a href="${escapeHtml(href)}" style="display:inline-block;background:${bg};color:#05071a;text-decoration:none;padding:11px 22px;border-radius:10px;font-weight:700;margin:4px 0">${escapeHtml(label)}</a>`;

  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#1a1a2e;max-width:520px;margin:0 auto;padding:8px">
  <h2 style="margin:0 0 12px;font-size:22px">${escapeHtml(isWaitlist ? "You're on the waitlist" : "Welcome to the Founding Cohort")} <span>🚀</span></h2>
  <p style="margin:0 0 16px">${escapeHtml(hi)}</p>
  <p style="margin:0 0 18px">${escapeHtml(intro)}</p>
  ${
    discountLine
      ? `<p style="margin:0 0 8px"><strong>Your founding discount code</strong></p>
  <p style="margin:0 0 16px"><code style="background:#f1f0fb;border:1px dashed #6a5bff;border-radius:8px;padding:8px 12px;font-size:16px;color:#3a2d9e;letter-spacing:.04em">${escapeHtml(p.discountCode ?? "")}</code>${p.discountPercent ? ` <span style="color:#666;font-size:13px">— ${p.discountPercent}% off your first ${p.discountMonths ?? 3} months</span>` : ""}</p>`
      : ""
  }
  ${
    webinarLine
      ? `<p style="margin:0 0 6px"><strong>${escapeHtml(p.webinarTitle ?? "Workshop")}</strong>${p.webinarWhen ? ` <span style="color:#666;font-size:13px">${escapeHtml(p.webinarWhen)}</span>` : ""}</p>
  <p style="margin:0 0 18px">${btn(p.webinarUrl ?? "#", "Add the workshop", "#22e6ff")}</p>`
      : ""
  }
  ${
    referralLine
      ? `<p style="margin:0 0 6px"><strong>${escapeHtml(p.referralRewardSummary ?? "Invite colleagues and earn rewards.")}</strong></p>
  <p style="margin:0 0 6px;color:#666;font-size:13px">Share your personal link:</p>
  <p style="margin:0 0 18px;word-break:break-all"><a href="${escapeHtml(p.referralUrl ?? "#")}" style="color:#6a5bff">${escapeHtml(p.referralUrl ?? "")}</a></p>`
      : ""
  }
  <p style="margin:18px 0 0;color:#888;font-size:12px">— The RocketCourse team<br/>If you didn't sign up, you can safely ignore this email.</p>
</div>`;

  return { subject, html, text };
};
