// Transactional email transport (Resend HTTP API), shared by server functions. Mirrors the
// contact-form integration: sends when RESEND_API_KEY is set, and DEGRADES GRACEFULLY when it
// isn't — sendEmail returns { sent: false, reason: "not_configured" } instead of throwing, so the
// invite flow keeps working (admin copies the link) until email is turned on. No cost when unset.

declare const process: { env: Record<string, string | undefined> };

/** True when a Resend API key is present, so callers can adapt their UX/messaging. */
export const isEmailConfigured = (): boolean => Boolean(process.env.RESEND_API_KEY?.trim());

// Reuse the contact-form sender by default; INVITE_FROM_EMAIL overrides it for invites if set.
const fromAddress = (): string =>
  process.env.INVITE_FROM_EMAIL?.trim() ||
  process.env.CONTACT_FROM_EMAIL?.trim() ||
  "RocketCourse <onboarding@resend.dev>";

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export interface SendResult {
  sent: boolean;
  reason?: string;
}

/** Send one email via Resend. Never throws — returns { sent } so callers branch on delivery. */
export const sendEmail = async (p: SendEmailParams): Promise<SendResult> => {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { sent: false, reason: "not_configured" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromAddress(),
        to: [p.to],
        subject: p.subject,
        html: p.html,
        text: p.text,
        ...(p.replyTo ? { reply_to: p.replyTo } : {})
      })
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { sent: false, reason: `resend_${res.status}${detail ? `: ${detail.slice(0, 120)}` : ""}` };
    }
    return { sent: true };
  } catch (error) {
    return { sent: false, reason: error instanceof Error ? error.message : "send_error" };
  }
};
