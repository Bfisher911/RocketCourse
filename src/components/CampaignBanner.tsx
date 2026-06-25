// Public pilot-campaign surface for the marketing site. Renders active campaigns that match the
// requested placement(s) and captures signups through the server-enforced campaign-signup function.
// The cap/waitlist state shown here is advisory — the server re-derives it before writing — so a
// stale "spots left" can never let someone past a full campaign.

import { useEffect, useMemo, useState } from "react";
import { Calendar, CheckCircle2, Copy, Loader2, Rocket, Users, Video } from "lucide-react";
import {
  loadActiveCampaigns,
  submitCampaignSignup,
  type CampaignSignupResult
} from "../services/platformClient";
import { remainingSlots, type Campaign, type CampaignPlacement } from "../services/campaigns";

// Returns the unified UTM shape the signup function expects ({ source, medium, ... }), stripping the
// "utm_" prefix from the query params.
const readUtm = (): Record<string, string> => {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
    const v = params.get(key);
    if (v) utm[key.replace("utm_", "")] = v;
  }
  return utm;
};

// The Founding Cohort has its own dedicated landing page (/founding-cohort) with a richer form, so it
// is not also rendered as an inline banner card here (avoids two competing signup CTAs on the homepage).
const DEDICATED_PAGE_SLUGS = new Set(["founding-cohort"]);

export function CampaignBanner({ placements }: { placements: CampaignPlacement[] }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  useEffect(() => {
    let alive = true;
    loadActiveCampaigns()
      .then((c) => {
        if (alive) setCampaigns(c);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const matching = useMemo(
    () => campaigns.filter((c) => placements.includes(c.placement) && !(c.slug && DEDICATED_PAGE_SLUGS.has(c.slug))),
    [campaigns, placements]
  );
  if (matching.length === 0) return null;

  return (
    <div className="campaign-stack">
      {matching.map((c) => (
        <CampaignCard key={c.id} campaign={c} />
      ))}
    </div>
  );
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<CampaignSignupResult | null>(null);
  const remaining = remainingSlots(campaign.maxSignups, campaign.signupCount ?? 0);
  const isHero = campaign.placement === "homepage_hero";

  return (
    <section className={`campaign-card ${isHero ? "hero" : ""}`} aria-label={campaign.name}>
      <div className="campaign-main">
        <span className="campaign-eyebrow">
          <Rocket size={14} /> {campaign.type === "limited_discount" ? "Limited offer" : campaign.type === "semester_pilot" ? "Pilot program" : campaign.type === "private_invite" ? "Invite only" : "Early access"}
          {campaign.audienceLabel && <em> · {campaign.audienceLabel}</em>}
        </span>
        <h2>{campaign.headline ?? campaign.name}</h2>
        {campaign.description && <p>{campaign.description}</p>}
        <div className="campaign-meta">
          {remaining !== null && (
            <span className={`campaign-chip ${remaining === 0 ? "full" : ""}`}>
              <Users size={14} /> {remaining > 0 ? `${remaining} of ${campaign.maxSignups} spots left` : "Waitlist open"}
            </span>
          )}
          {campaign.tutorialAt && (
            <span className="campaign-chip">
              <Calendar size={14} /> {new Date(campaign.tutorialAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
      <div className="campaign-cta">
        {!open && !result && (
          <button type="button" className="primary" onClick={() => setOpen(true)}>
            {campaign.ctaText}
          </button>
        )}
      </div>

      {open && !result && <CampaignSignupForm campaign={campaign} onDone={setResult} />}

      {result && (
        <div className="campaign-result" role="status">
          <CheckCircle2 size={18} />
          <div>
            <strong>{result.outcome === "waitlist" ? "You're on the waitlist" : "You're signed up!"}</strong>
            <p>{result.message}</p>
            {result.discountCode && (
              <p className="campaign-code">
                Your code: <code>{result.discountCode}</code>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => navigator.clipboard?.writeText(result.discountCode ?? "")}
                  aria-label="Copy discount code"
                >
                  <Copy size={13} />
                </button>
              </p>
            )}
            {result.webinarUrl && (
              <p>
                <a href={result.webinarUrl} target="_blank" rel="noopener noreferrer" className="campaign-webinar">
                  <Video size={14} /> Join the webinar
                </a>
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function CampaignSignupForm({ campaign, onDone }: { campaign: Campaign; onDone: (r: CampaignSignupResult) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [institution, setInstitution] = useState("");
  const [role, setRole] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await submitCampaignSignup({
        campaignId: campaign.id,
        slug: campaign.slug ?? undefined,
        name,
        email,
        institution,
        role,
        notes,
        referralSource: typeof document !== "undefined" ? document.referrer || undefined : undefined,
        utm: readUtm()
      });
      onDone(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="campaign-form"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="campaign-form-grid">
        <input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        <input
          type="email"
          required
          placeholder="Work email *"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <input placeholder="Institution / organization" value={institution} onChange={(e) => setInstitution(e.target.value)} />
        <input placeholder="Your role (e.g. Instructor)" value={role} onChange={(e) => setRole(e.target.value)} />
      </div>
      <textarea placeholder="Anything we should know? (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      {error && <p className="intake-ai-error">{error}</p>}
      <button type="submit" className="primary" disabled={busy || !email.trim()}>
        {busy ? <Loader2 size={15} className="spin" /> : <Rocket size={15} />} {campaign.ctaText}
      </button>
    </form>
  );
}
