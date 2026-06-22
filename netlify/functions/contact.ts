// POST /.netlify/functions/contact — public contact-form intake (no auth required).
//
// Routes inquiries to the RocketCourse inbox. Because that inbox (rocketproof.ai@gmail.com) also
// receives Rocketproof inquiries, every subject is prefixed "[RocketCourse Inquiry]" so the two
// products stay sortable.
//
// Sending is done through Resend's HTTP API when RESEND_API_KEY is configured. If it is not yet
// configured, the function returns 503 with { fallback: true } so the client can fall back to a
// prefilled mailto: link — the form is never a dead end. See docs/SAAS_SETUP.md for the env vars.

declare const process: { env: Record<string, string | undefined> };

const json = (status: number, body: Record<string, unknown>): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

interface ContactPayload {
  name?: string;
  email?: string;
  institution?: string;
  role?: string;
  inquiryType?: string;
  message?: string;
  pilot?: boolean;
  website?: string; // honeypot — must be empty
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TO_EMAIL = (): string => process.env.CONTACT_TO_EMAIL?.trim() || "rocketproof.ai@gmail.com";
const FROM_EMAIL = (): string => process.env.CONTACT_FROM_EMAIL?.trim() || "RocketCourse <onboarding@resend.dev>";

// Best-effort, warm-instance rate limiting. Serverless instances are recycled, so this is a cheap
// burst guard, not a durable limiter — durable limiting would need a shared store (noted in docs).
const recent = new Map<string, number>();
const RATE_WINDOW_MS = 15_000;
const clientKey = (request: Request): string =>
  request.headers.get("x-nf-client-connection-ip") ||
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  "unknown";

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch] ?? ch));

export default async (request: Request): Promise<Response> => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed. Use POST." });

  let payload: ContactPayload;
  try {
    payload = (await request.json()) as ContactPayload;
  } catch {
    return json(400, { error: "Invalid request body." });
  }

  // Honeypot: a bot filled the hidden field. Accept silently and drop — never send, never error.
  if (payload.website && payload.website.trim().length > 0) {
    return json(200, { ok: true, dropped: true });
  }

  const name = (payload.name ?? "").trim();
  const email = (payload.email ?? "").trim();
  const message = (payload.message ?? "").trim();
  const institution = (payload.institution ?? "").trim();
  const role = (payload.role ?? "").trim();
  const inquiryType = (payload.inquiryType ?? "General question").trim();
  const pilot = Boolean(payload.pilot);

  const errors: string[] = [];
  if (name.length < 2) errors.push("A name is required.");
  if (!EMAIL_RE.test(email)) errors.push("A valid email is required.");
  if (message.length < 10) errors.push("Please include a short message.");
  if (errors.length) return json(422, { error: errors.join(" ") });

  // Burst guard
  const key = clientKey(request);
  const now = Date.now();
  const last = recent.get(key) ?? 0;
  if (now - last < RATE_WINDOW_MS) {
    return json(429, { error: "Please wait a few seconds before sending another message." });
  }
  recent.set(key, now);
  if (recent.size > 500) recent.clear(); // bound memory on long-lived instances

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    // Not configured yet — tell the client to use the mailto fallback. Honest, not a fake success.
    return json(503, {
      error: "Email delivery is not configured yet.",
      fallback: true
    });
  }

  const subject = `[RocketCourse Inquiry] ${inquiryType}${pilot ? " · pilot/department interest" : ""}`;
  const lines = [
    `Name: ${name}`,
    `Email: ${email}`,
    institution ? `Institution/Org: ${institution}` : null,
    role ? `Role: ${role}` : null,
    `Inquiry type: ${inquiryType}`,
    `Pilot / department / institutional demo: ${pilot ? "Yes" : "No"}`,
    "",
    "Message:",
    message
  ].filter((line): line is string => line !== null);
  const text = lines.join("\n");
  const html = `<div style="font-family:system-ui,sans-serif;line-height:1.5">${lines
    .map((line) => (line === "" ? "<br/>" : `<p style="margin:0 0 6px">${escapeHtml(line)}</p>`))
    .join("")}</div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_EMAIL(),
        to: [TO_EMAIL()],
        reply_to: email,
        subject,
        text,
        html
      })
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return json(502, { error: "Could not send your message right now.", fallback: true, detail: detail.slice(0, 300) });
    }
    return json(200, { ok: true });
  } catch (error) {
    return json(502, {
      error: error instanceof Error ? error.message : "Could not send your message right now.",
      fallback: true
    });
  }
};
