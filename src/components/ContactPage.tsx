import { useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Loader2,
  Mail,
  Send,
  Sparkles,
  User
} from "lucide-react";

// Public contact page for RocketCourse. Self-contained: holds its own form state, validates
// client-side, and POSTs to the `/.netlify/functions/contact` serverless endpoint. The page is
// resilient, if the network request fails (offline, cold function, non-2xx) it never shows a hard
// dead end. It falls back to a prefilled `mailto:` so the visitor can always reach the team.
//
// Email routing: inquiries go to rocketproofai@gmail.com. That inbox also receives Rocketproof
// inquiries, so every subject is prefixed with "[RocketCourse Inquiry]" to keep the two products
// from getting tangled.

const CONTACT_ENDPOINT = "/.netlify/functions/contact";
const CONTACT_EMAIL = "rocketproofai@gmail.com";
const SUBJECT_PREFIX = "[RocketCourse Inquiry]";
// Ignore submits fired within this window of the previous attempt (ms), guards against
// double-clicks and rapid re-submits.
const SUBMIT_COOLDOWN_MS = 3000;
// How long the submit button stays disabled after a successful send (ms).
const SUCCESS_COOLDOWN_MS = 4000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FormStatus = "idle" | "sending" | "success" | "error-fallback";

const ROLE_OPTIONS = [
  "Instructor / Faculty",
  "Instructional designer",
  "Instructional technologist",
  "Department / program lead",
  "Administrator",
  "Student",
  "Other"
] as const;

const INQUIRY_OPTIONS = [
  "General question",
  "Pilot or trial",
  "Department plan",
  "Institutional demo",
  "Billing",
  "Technical support",
  "Other"
] as const;

type FieldErrors = {
  name?: string;
  email?: string;
  message?: string;
};

type Touched = {
  name?: boolean;
  email?: boolean;
  message?: boolean;
};

function validate(name: string, email: string, message: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!name.trim()) {
    errors.name = "Please tell us your name.";
  }
  if (!email.trim()) {
    errors.email = "Please enter your email so we can reply.";
  } else if (!EMAIL_RE.test(email.trim())) {
    errors.email = "That email doesn't look quite right.";
  }
  if (!message.trim()) {
    errors.message = "Please add a short message.";
  } else if (message.trim().length < 10) {
    errors.message = "A little more detail helps, at least 10 characters.";
  }
  return errors;
}

export function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [institution, setInstitution] = useState("");
  const [role, setRole] = useState<string>(ROLE_OPTIONS[0]);
  const [inquiryType, setInquiryType] = useState<string>(INQUIRY_OPTIONS[0]);
  const [message, setMessage] = useState("");
  const [pilot, setPilot] = useState(false);
  // Honeypot. Real users never see or fill this; bots that auto-fill every field will.
  const [website, setWebsite] = useState("");

  const [status, setStatus] = useState<FormStatus>("idle");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState<Touched>({});
  const [lastSubmitAt, setLastSubmitAt] = useState(0);

  const errors = validate(name, email, message);
  const errorKeys = Object.keys(errors) as Array<keyof FieldErrors>;
  const hasErrors = errorKeys.length > 0;

  // Only reveal a field's error after a submit attempt or once that field has been blurred.
  const showError = (field: keyof FieldErrors): string | undefined => {
    if (!submitAttempted && !touched[field]) return undefined;
    return errors[field];
  };

  const markTouched = (field: keyof Touched) =>
    setTouched((prev) => ({ ...prev, [field]: true }));

  const buildPrefilledBody = (): string => {
    const pilotLine = pilot
      ? "Interested in a pilot, department plan, or institutional demo: Yes"
      : "Interested in a pilot, department plan, or institutional demo: No";
    return [
      `Name: ${name.trim()}`,
      `Email: ${email.trim()}`,
      `Institution or organization: ${institution.trim() || "(not provided)"}`,
      `Role: ${role}`,
      `Inquiry type: ${inquiryType}`,
      pilotLine,
      "",
      "Message:",
      message.trim()
    ].join("\n");
  };

  const mailtoHref = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
    `${SUBJECT_PREFIX} Contact form submission`
  )}&body=${encodeURIComponent(buildPrefilledBody())}`;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitAttempted(true);

    // Ignore submits fired in quick succession (double-click, Enter spam) or while a send is
    // already in flight.
    const now = Date.now();
    if (status === "sending") return;
    if (now - lastSubmitAt < SUBMIT_COOLDOWN_MS) return;
    setLastSubmitAt(now);

    // Honeypot tripped: a bot filled the hidden field. Pretend success and drop it silently,
    // never actually send.
    if (website.trim()) {
      setStatus("success");
      window.setTimeout(() => {
        setStatus((current) => (current === "success" ? "idle" : current));
      }, SUCCESS_COOLDOWN_MS);
      return;
    }

    if (hasErrors) return;

    setStatus("sending");
    try {
      const response = await fetch(CONTACT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          institution: institution.trim(),
          role,
          inquiryType,
          message: message.trim(),
          pilot,
          website
        })
      });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      setStatus("success");
      window.setTimeout(() => {
        setStatus((current) => (current === "success" ? "idle" : current));
      }, SUCCESS_COOLDOWN_MS);
    } catch {
      // No hard error state. Offer the visitor a direct path instead.
      setStatus("error-fallback");
    }
  };

  const sending = status === "sending";
  // Disable the submit while sending and during the brief post-success cooldown.
  const submitDisabled = sending || status === "success";

  return (
    <main id="main-content" tabIndex={-1} className="contact page-shell">
      <section className="page-heading">
        <div>
          <span className="section-eyebrow">
            <Mail size={14} /> Contact
          </span>
          <h1>
            Let&apos;s talk about your <span className="accent-text">courses</span>
          </h1>
          <p>
            Questions about RocketCourse, or ready to bring it to your classroom? Pilots, department
            plans, and institutional demos are all welcome. We read every message and reply from the
            RocketCourse team.
          </p>
        </div>
      </section>

      <section className="panel contact-panel">
        {status === "success" ? (
          <div className="contact-success" role="status">
            <CheckCircle2 size={22} />
            <div>
              <h2>Message sent</h2>
              <p>
                Thanks, your message is on its way. We&apos;ll reply from the RocketCourse team.
              </p>
            </div>
          </div>
        ) : (
          <form
            className="contact-form"
            onSubmit={handleSubmit}
            aria-labelledby="contact-heading"
            noValidate
          >
            <h2 id="contact-heading" className="contact-form-title">
              <Sparkles size={16} /> Send us a note
            </h2>

            {submitAttempted && hasErrors && (
              <p className="intake-ai-error" role="alert">
                <AlertTriangle size={15} /> Please fix the highlighted fields and try again.
              </p>
            )}

            <div className="contact-grid">
              <label className="field">
                <span>
                  <User size={13} /> Name <span aria-hidden="true">*</span>
                </span>
                <input
                  id="contact-name"
                  type="text"
                  value={name}
                  required
                  autoComplete="name"
                  placeholder="Dr. Jane Smith"
                  onChange={(event) => setName(event.target.value)}
                  onBlur={() => markTouched("name")}
                  aria-invalid={Boolean(showError("name"))}
                  aria-describedby={showError("name") ? "contact-name-error" : undefined}
                />
                {showError("name") && (
                  <span id="contact-name-error" className="field-error" role="alert">
                    {showError("name")}
                  </span>
                )}
              </label>

              <label className="field">
                <span>
                  <Mail size={13} /> Email <span aria-hidden="true">*</span>
                </span>
                <input
                  id="contact-email"
                  type="email"
                  value={email}
                  required
                  autoComplete="email"
                  placeholder="you@university.edu"
                  onChange={(event) => setEmail(event.target.value)}
                  onBlur={() => markTouched("email")}
                  aria-invalid={Boolean(showError("email"))}
                  aria-describedby={showError("email") ? "contact-email-error" : undefined}
                />
                {showError("email") && (
                  <span id="contact-email-error" className="field-error" role="alert">
                    {showError("email")}
                  </span>
                )}
              </label>

              <label className="field">
                <span>
                  <Building2 size={13} /> Institution or organization
                </span>
                <input
                  id="contact-institution"
                  type="text"
                  value={institution}
                  autoComplete="organization"
                  placeholder="Optional, e.g. State University"
                  onChange={(event) => setInstitution(event.target.value)}
                />
              </label>

              <label className="field">
                <span>Role</span>
                <select
                  id="contact-role"
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Inquiry type</span>
                <select
                  id="contact-inquiry"
                  value={inquiryType}
                  onChange={(event) => setInquiryType(event.target.value)}
                >
                  {INQUIRY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="field contact-message">
              <span>
                Message <span aria-hidden="true">*</span>
              </span>
              <textarea
                id="contact-message"
                value={message}
                required
                rows={6}
                placeholder="Tell us what you're hoping to do with RocketCourse…"
                onChange={(event) => setMessage(event.target.value)}
                onBlur={() => markTouched("message")}
                aria-invalid={Boolean(showError("message"))}
                aria-describedby={showError("message") ? "contact-message-error" : undefined}
              />
              {showError("message") && (
                <span id="contact-message-error" className="field-error" role="alert">
                  {showError("message")}
                </span>
              )}
            </label>

            <label className="contact-checkbox">
              <input
                type="checkbox"
                checked={pilot}
                onChange={(event) => setPilot(event.target.checked)}
              />
              <span>I am interested in a pilot, department plan, or institutional demo.</span>
            </label>

            {/* Honeypot: visually hidden, off-screen, and out of the tab order. A non-empty value
                on submit means a bot filled it, so we drop the message silently. */}
            <div style={{ position: "absolute", left: "-9999px" }} aria-hidden="true">
              <label>
                Website
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                />
              </label>
            </div>

            {status === "error-fallback" && (
              <div className="contact-fallback" role="alert">
                <p className="intake-ai-error">
                  <AlertTriangle size={15} /> We couldn&apos;t reach the server. You can send your
                  message directly instead.
                </p>
                <a className="secondary link-button" href={mailtoHref}>
                  <Mail size={16} /> Email us directly
                </a>
              </div>
            )}

            <div className="contact-actions">
              <button type="submit" className="primary" disabled={submitDisabled}>
                {sending ? (
                  <>
                    <Loader2 size={16} className="spin" /> Sending…
                  </>
                ) : (
                  <>
                    <Send size={16} /> Send message
                  </>
                )}
              </button>
              <p className="contact-reassure">
                Prefer email? Reach us any time at{" "}
                <a href={mailtoHref}>{CONTACT_EMAIL}</a>.
              </p>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
