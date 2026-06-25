// The dedicated public landing page for the RocketCourse Founding Cohort campaign (/founding-cohort).
// Premium, cosmic, conversion-focused: a full-screen animated hero, an offer section, a webinar
// section, and a richer waitlist form with a polished success + referral state. Everything that can
// be is driven by the live campaign config (loaded from Supabase, or the offline sample in local-dev)
// so the Super Admin can edit copy, the offer, the webinar, and the referral reward without a deploy.
// All motion respects prefers-reduced-motion; all inputs use real <label>s.

import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BadgePercent,
  CalendarClock,
  Check,
  CheckCircle2,
  Copy,
  GraduationCap,
  Loader2,
  Mail,
  Rocket,
  Share2,
  Sparkles,
  Star,
  Ticket,
  Users,
  Video
} from "lucide-react";
import { LogoMark } from "./brand";
import { loadFoundingCohort, submitWaitlist, type CampaignSignupResult } from "../services/platformClient";
import { FOUNDING_COHORT_SAMPLE, isValidEmail, type Campaign } from "../services/campaigns";
import { buildReferralUrl, readReferralCodeFromQuery, referralProgress } from "../services/referrals";

const FOUNDING_SLUG = "founding-cohort";

interface FoundingCohortPageProps {
  onStartBuilding: () => void;
  onTryDemo: () => void;
}

// ── prefers-reduced-motion (live) ───────────────────────────────────────────
const useReducedMotion = (): boolean => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);
  return reduced;
};

// ── Scroll-reveal: add `is-in` as elements enter the viewport (no-op when reduced) ──
// `ready` re-runs the effect once the async campaign has rendered the .fc-reveal nodes; otherwise
// the observer would attach during the loading state (when no nodes exist) and never reveal them.
const useScrollReveal = (reduced: boolean, ready: boolean): void => {
  useEffect(() => {
    if (typeof window === "undefined" || !ready) return;
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(".fc-reveal:not(.is-in)"));
    if (reduced || !("IntersectionObserver" in window)) {
      nodes.forEach((n) => n.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [reduced, ready]);
};

// ── Scroll parallax → sets a 0..1 CSS var on a ref (gated by reduced motion) ──
const useParallax = (reduced: boolean) => {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (reduced || typeof window === "undefined") return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        const el = ref.current;
        if (!el) return;
        const progress = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight || 1)));
        el.style.setProperty("--fc-scroll", progress.toFixed(3));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [reduced]);
  return ref;
};

/** Premium primary CTA with a glitch-on-hover label + sheen sweep. Plain <button>, fully accessible. */
function GlitchCta({
  children,
  onClick,
  type = "button",
  disabled
}: {
  children: string;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button type={type} className="fc-cta-glitch" onClick={onClick} data-text={children} disabled={disabled}>
      <span className="fc-cta-glitch__label">
        <Rocket size={18} aria-hidden /> {children}
      </span>
    </button>
  );
}

/** Cosmic backdrop: nebula gradients, a star field, a grid, and orbital paths. Decorative only. */
function HeroBackdrop() {
  return (
    <div className="fc-backdrop" aria-hidden="true">
      <div className="fc-nebula fc-nebula--cyan" />
      <div className="fc-nebula fc-nebula--pink" />
      <div className="fc-nebula fc-nebula--violet" />
      <div className="fc-grid" />
      <div className="fc-stars fc-stars--a" />
      <div className="fc-stars fc-stars--b" />
      <svg className="fc-orbits" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="fcOrbitGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(34,230,255,0.0)" />
            <stop offset="100%" stopColor="rgba(34,230,255,0.0)" />
          </radialGradient>
        </defs>
        <g className="fc-orbit-group" stroke="rgba(130,146,230,0.18)" fill="none">
          <ellipse cx="600" cy="400" rx="520" ry="230" />
          <ellipse cx="600" cy="400" rx="380" ry="160" />
          <ellipse cx="600" cy="400" rx="240" ry="100" />
        </g>
        <circle className="fc-orbit-dot fc-orbit-dot--1" r="4" fill="var(--cyan)" />
        <circle className="fc-orbit-dot fc-orbit-dot--2" r="3" fill="var(--pink)" />
      </svg>
    </div>
  );
}

/** Scroll-reactive "Canvas course shell" — a tilting stack of the things RocketCourse builds. */
function CourseShellVisual({ parallaxRef }: { parallaxRef: RefObject<HTMLDivElement | null> }) {
  const layers = [
    { icon: <GraduationCap size={15} aria-hidden />, label: "Modules", meta: "8 weeks · sequenced", tone: "cyan" },
    { icon: <Sparkles size={15} aria-hidden />, label: "Assignments & quizzes", meta: "rubrics attached", tone: "violet" },
    { icon: <Users size={15} aria-hidden />, label: "Discussions", meta: "prompts + outcomes", tone: "pink" },
    { icon: <Rocket size={15} aria-hidden />, label: "Canvas .imscc export", meta: "validated · ready", tone: "lime" }
  ];
  return (
    <div className="fc-shell" ref={parallaxRef}>
      <div className="fc-shell__scene">
        <div className="fc-shell__card fc-shell__card--head">
          <span className="fc-shell__dot" />
          <span className="fc-shell__dot" />
          <span className="fc-shell__dot" />
          <strong>Intro to Astrobiology</strong>
          <span className="fc-shell__badge">
            <Check size={12} aria-hidden /> Ready to export
          </span>
        </div>
        {layers.map((l) => (
          <div key={l.label} className={`fc-shell__card fc-shell__card--${l.tone}`}>
            <span className="fc-shell__ix">{l.icon}</span>
            <span className="fc-shell__name">{l.label}</span>
            <span className="fc-shell__meta">{l.meta}</span>
          </div>
        ))}
      </div>
      <div className="fc-shell__rocket" aria-hidden="true">
        <Rocket size={26} />
      </div>
    </div>
  );
}

const fmtDateTime = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" });
};

const ROLE_OPTIONS = ["Instructor / Faculty", "Instructional Designer", "Department Chair", "Administrator / Dean", "Other"];
const USE_CASE_OPTIONS = [
  "Build a new course from scratch",
  "Improve an existing course",
  "Convert / import an existing course",
  "Build quizzes & assessments",
  "Other"
];

export function FoundingCohortPage({ onStartBuilding, onTryDemo }: FoundingCohortPageProps) {
  const reduced = useReducedMotion();
  const parallaxRef = useParallax(reduced);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "fallback">("loading");
  const [webinarPrefill, setWebinarPrefill] = useState(false);
  const formRef = useRef<HTMLDivElement | null>(null);
  useScrollReveal(reduced, loadState !== "loading");

  // UTM + referral + landing path captured once on mount.
  const context = useMemo(() => {
    if (typeof window === "undefined") return { utm: {}, referralCode: null as string | null, path: `/${FOUNDING_SLUG}` };
    const params = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
      const v = params.get(k);
      if (v) utm[k.replace("utm_", "")] = v;
    }
    return { utm, referralCode: readReferralCodeFromQuery(window.location.search), path: window.location.pathname };
  }, []);

  useEffect(() => {
    let alive = true;
    loadFoundingCohort(FOUNDING_SLUG)
      .then((c) => {
        if (!alive) return;
        if (c) {
          setCampaign(c);
          setLoadState("ready");
        } else {
          setCampaign(FOUNDING_COHORT_SAMPLE); // configured but unseeded → still render with seeded copy
          setLoadState("fallback");
        }
      })
      .catch(() => {
        if (!alive) return;
        setCampaign(FOUNDING_COHORT_SAMPLE);
        setLoadState("fallback");
      });
    return () => {
      alive = false;
    };
  }, []);

  const scrollToForm = useCallback(
    (prefillWebinar: boolean) => {
      setWebinarPrefill(prefillWebinar);
      formRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    },
    [reduced]
  );

  if (loadState === "loading" && !campaign) {
    return (
      <main className="fc-page" id="main-content">
        <div className="fc-loading" role="status" aria-live="polite">
          <Loader2 className="spin" size={26} aria-hidden /> <span>Loading the Founding Cohort…</span>
        </div>
      </main>
    );
  }

  const c = campaign ?? FOUNDING_COHORT_SAMPLE;
  const webinarWhen = fmtDateTime(c.webinarAt);
  const remaining =
    typeof c.maxSignups === "number" && c.maxSignups > 0 ? Math.max(0, c.maxSignups - (c.signupCount ?? 0)) : null;

  return (
    <main className="fc-page" id="main-content">
      {/* ───────────────────────── HERO ───────────────────────── */}
      <section className={`fc-hero ${reduced ? "is-reduced" : ""}`} aria-labelledby="fc-hero-title">
        <HeroBackdrop />
        <div className="fc-hero__inner">
          <div className="fc-hero__copy">
            <span className="fc-eyebrow fc-reveal">
              <Star size={13} aria-hidden /> RocketCourse Founding Cohort
              <em>· Limited launch offer</em>
            </span>
            <h1 id="fc-hero-title" className="fc-hero__title fc-reveal">
              {c.headline ?? FOUNDING_COHORT_SAMPLE.headline}
            </h1>
            <p className="fc-hero__sub fc-reveal">{c.subheadline ?? c.description ?? FOUNDING_COHORT_SAMPLE.subheadline}</p>
            <div className="fc-hero__cta fc-reveal">
              <GlitchCta onClick={() => scrollToForm(false)}>{c.ctaText || "Join the Founding Cohort"}</GlitchCta>
              <button type="button" className="fc-cta-secondary" onClick={() => scrollToForm(true)}>
                <Video size={17} aria-hidden /> Reserve Workshop Seat
              </button>
            </div>
            <ul className="fc-trust fc-reveal" aria-label="Founding cohort highlights">
              {c.discountPercent ? (
                <li>
                  <BadgePercent size={15} aria-hidden /> {c.discountPercent}% off first {c.discountDurationMonths ?? 3} months
                </li>
              ) : null}
              <li>
                <Video size={15} aria-hidden /> Live {c.webinarTitle ?? "AI Course Building Workshop"}
              </li>
              <li>
                <Sparkles size={15} aria-hidden /> Early product access
              </li>
              {remaining !== null && (
                <li>
                  <Users size={15} aria-hidden /> {remaining} of {c.maxSignups} seats left
                </li>
              )}
            </ul>
          </div>
          <div className="fc-hero__visual fc-reveal">
            <CourseShellVisual parallaxRef={parallaxRef} />
          </div>
        </div>
        <button type="button" className="fc-scroll-hint" onClick={() => scrollToForm(false)} aria-label="Jump to the signup form">
          <span>Join the cohort</span>
          <ArrowRight size={16} aria-hidden />
        </button>
      </section>

      {/* ───────────────────────── OFFER ───────────────────────── */}
      <section className="fc-section fc-offer" aria-labelledby="fc-offer-title">
        <div className="fc-section__head fc-reveal">
          <span className="fc-kicker">
            <Ticket size={14} aria-hidden /> The founding offer
          </span>
          <h2 id="fc-offer-title">{c.offerSummary ?? FOUNDING_COHORT_SAMPLE.offerSummary}</h2>
        </div>
        <div className="fc-offer__grid">
          <article className="fc-offer__card fc-reveal">
            <div className="fc-offer__big">
              <BadgePercent size={20} aria-hidden />
              <strong>{c.discountPercent ?? 40}%</strong>
              <span>off</span>
            </div>
            <h3>First {c.discountDurationMonths ?? 3} months</h3>
            <p>Founding-member pricing on a monthly plan — your launch discount code is emailed the moment you join.</p>
          </article>
          <article className="fc-offer__card fc-reveal">
            <div className="fc-offer__big">
              <CalendarClock size={20} aria-hidden />
              <strong>{c.annualDiscountPercent ?? 30}%</strong>
              <span>off</span>
            </div>
            <h3>First year (annual)</h3>
            <p>Prefer to pay yearly? Founding members get {c.annualDiscountPercent ?? 30}% off the first year instead.</p>
          </article>
          <article className="fc-offer__card fc-reveal">
            <div className="fc-offer__perks">
              <span><Video size={15} aria-hidden /> Live workshop access</span>
              <span><Sparkles size={15} aria-hidden /> Early product access</span>
              <span><Ticket size={15} aria-hidden /> A launch discount code</span>
              <span><Share2 size={15} aria-hidden /> A personal referral link</span>
            </div>
            <h3>Founding perks</h3>
            <p>More than a discount — you help shape the roadmap and get first access to everything we ship.</p>
          </article>
        </div>
      </section>

      {/* ───────────────────────── WORKSHOP ───────────────────────── */}
      <section className="fc-section fc-workshop fc-reveal" aria-labelledby="fc-workshop-title">
        <div className="fc-workshop__panel">
          <span className="fc-kicker">
            <Video size={14} aria-hidden /> {webinarRsvpLabel(c.webinarRsvpStatus)}
          </span>
          <h2 id="fc-workshop-title">{c.webinarTitle ?? "AI Course Building Workshop"}</h2>
          <p>{c.webinarDescription ?? FOUNDING_COHORT_SAMPLE.webinarDescription}</p>
          <div className="fc-workshop__meta">
            {webinarWhen ? (
              <span className="fc-chip">
                <CalendarClock size={14} aria-hidden /> {webinarWhen}
              </span>
            ) : (
              <span className="fc-chip">
                <CalendarClock size={14} aria-hidden /> Date announced to cohort members
              </span>
            )}
            {typeof c.webinarCapacity === "number" && (
              <span className="fc-chip">
                <Users size={14} aria-hidden /> {c.webinarCapacity} seats
              </span>
            )}
          </div>
          <button type="button" className="fc-cta-secondary" onClick={() => scrollToForm(true)}>
            <Video size={17} aria-hidden /> Reserve Workshop Seat
          </button>
        </div>
      </section>

      {/* ───────────────────────── FORM ───────────────────────── */}
      <section className="fc-section fc-join" aria-labelledby="fc-join-title" ref={formRef}>
        <WaitlistForm
          campaign={c}
          context={context}
          webinarPrefill={webinarPrefill}
          unseeded={loadState === "fallback"}
          onStartBuilding={onStartBuilding}
          onTryDemo={onTryDemo}
        />
      </section>
    </main>
  );
}

const webinarRsvpLabel = (status: Campaign["webinarRsvpStatus"]): string => {
  if (status === "closed") return "Workshop · RSVPs closed";
  if (status === "full") return "Workshop · waitlist";
  return "Live launch workshop";
};

interface WaitlistFormProps {
  campaign: Campaign;
  context: { utm: Record<string, string>; referralCode: string | null; path: string };
  webinarPrefill: boolean;
  unseeded: boolean;
  onStartBuilding: () => void;
  onTryDemo: () => void;
}

function WaitlistForm({ campaign, context, webinarPrefill, unseeded, onStartBuilding, onTryDemo }: WaitlistFormProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [institution, setInstitution] = useState("");
  const [role, setRole] = useState("");
  const [courseArea, setCourseArea] = useState("");
  const [primaryUseCase, setPrimaryUseCase] = useState("");
  const [painPoint, setPainPoint] = useState("");
  const [wantsWebinarSeat, setWantsWebinarSeat] = useState(false);
  const [consent, setConsent] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CampaignSignupResult | null>(null);

  useEffect(() => {
    if (webinarPrefill) setWantsWebinarSeat(true);
  }, [webinarPrefill]);

  const emailValid = isValidEmail(email);
  const canSubmit = emailValid && consent && !busy;

  const submit = async () => {
    setError(null);
    if (!emailValid) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!consent) {
      setError("Please confirm you're happy for us to email you about the founding cohort.");
      return;
    }
    setBusy(true);
    try {
      const res = await submitWaitlist({
        campaignId: campaign.id?.startsWith("sample-") ? undefined : campaign.id,
        slug: campaign.slug ?? FOUNDING_SLUG,
        firstName,
        lastName,
        email,
        institution,
        role,
        courseArea,
        primaryUseCase,
        painPoint,
        wantsWebinarSeat,
        consentToEmail: consent,
        referralCode: context.referralCode ?? undefined,
        utm: context.utm,
        landingPagePath: context.path
      });
      setResult(res);
    } catch (e) {
      setError((e as Error).message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (result?.ok) {
    return (
      <SuccessState
        campaign={campaign}
        result={result}
        wantsWebinarSeat={wantsWebinarSeat}
        onStartBuilding={onStartBuilding}
        onTryDemo={onTryDemo}
      />
    );
  }

  return (
    <div className="fc-join__wrap fc-reveal">
      <div className="fc-join__intro">
        <span className="fc-kicker">
          <Rocket size={14} aria-hidden /> Join the Founding Cohort
        </span>
        <h2 id="fc-join-title">Claim your founding spot</h2>
        <p>Tell us a little about your course. We'll send your launch discount code, workshop details, and a personal referral link.</p>
        {context.referralCode && (
          <p className="fc-referred" role="status">
            <Sparkles size={14} aria-hidden /> You were invited with code <code>{context.referralCode}</code> — nice. You'll get an
            extra referral perk at checkout.
          </p>
        )}
        {unseeded && (
          <p className="fc-note">
            Preview mode — connect Supabase and run the seed migration to capture live signups.
          </p>
        )}
        <ul className="fc-join__assure">
          <li><CheckCircle2 size={14} aria-hidden /> No charge today</li>
          <li><CheckCircle2 size={14} aria-hidden /> Cancel anytime</li>
          <li><CheckCircle2 size={14} aria-hidden /> {campaign.discountPercent ?? 40}% founding discount</li>
        </ul>
      </div>

      <form
        className="fc-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        noValidate
      >
        <div className="fc-form__row">
          <div className="fc-field">
            <label htmlFor="fc-first">First name</label>
            <input id="fc-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
          </div>
          <div className="fc-field">
            <label htmlFor="fc-last">Last name</label>
            <input id="fc-last" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
          </div>
        </div>

        <div className="fc-field">
          <label htmlFor="fc-email">
            Work email <span className="fc-req" aria-hidden>*</span>
          </label>
          <input
            id="fc-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            aria-invalid={email.length > 0 && !emailValid}
            placeholder="you@university.edu"
          />
        </div>

        <div className="fc-form__row">
          <div className="fc-field">
            <label htmlFor="fc-inst">Institution / organization</label>
            <input id="fc-inst" value={institution} onChange={(e) => setInstitution(e.target.value)} autoComplete="organization" />
          </div>
          <div className="fc-field">
            <label htmlFor="fc-role">Your role</label>
            <select id="fc-role" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">Select a role…</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="fc-form__row">
          <div className="fc-field">
            <label htmlFor="fc-area">Course area / subject</label>
            <input id="fc-area" value={courseArea} onChange={(e) => setCourseArea(e.target.value)} placeholder="e.g. Biology, Composition" />
          </div>
          <div className="fc-field">
            <label htmlFor="fc-use">Primary use case</label>
            <select id="fc-use" value={primaryUseCase} onChange={(e) => setPrimaryUseCase(e.target.value)}>
              <option value="">Select…</option>
              {USE_CASE_OPTIONS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="fc-field">
          <label htmlFor="fc-pain">What's the hardest part of building your course right now?</label>
          <textarea id="fc-pain" rows={3} value={painPoint} onChange={(e) => setPainPoint(e.target.value)} />
        </div>

        <label className="fc-check" htmlFor="fc-webinar">
          <input id="fc-webinar" type="checkbox" checked={wantsWebinarSeat} onChange={(e) => setWantsWebinarSeat(e.target.checked)} />
          <span>
            Save me a seat at the live <strong>{campaign.webinarTitle ?? "AI Course Building Workshop"}</strong>.
          </span>
        </label>

        <label className="fc-check" htmlFor="fc-consent">
          <input id="fc-consent" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
          <span>
            Email me about the founding cohort, the workshop, and my launch discount. <span className="fc-req" aria-hidden>*</span>
          </span>
        </label>

        {error && (
          <p className="fc-error" role="alert">
            {error}
          </p>
        )}

        <GlitchCta type="submit" disabled={!canSubmit}>
          {busy ? "Joining…" : campaign.ctaText || "Join the Founding Cohort"}
        </GlitchCta>
        <p className="fc-fineprint">
          By joining you agree to our terms. We respect your inbox — unsubscribe anytime. No payment required to join.
        </p>
      </form>
    </div>
  );
}

function SuccessState({
  campaign,
  result,
  wantsWebinarSeat,
  onStartBuilding,
  onTryDemo
}: {
  campaign: Campaign;
  result: CampaignSignupResult;
  wantsWebinarSeat: boolean;
  onStartBuilding: () => void;
  onTryDemo: () => void;
}) {
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const referralUrl = result.referralCode ? buildReferralUrl(origin, `/${campaign.slug ?? FOUNDING_SLUG}`, result.referralCode) : null;
  const threshold = campaign.referralThreshold ?? 3;
  const progress = referralProgress(0, threshold);

  const copy = async (value: string, which: "link" | "code") => {
    try {
      await navigator.clipboard?.writeText(value);
      setCopied(which);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="fc-success fc-reveal is-in" role="status" aria-live="polite">
      <div className="fc-success__halo" aria-hidden />
      <div className="fc-success__badge">
        <CheckCircle2 size={30} aria-hidden />
      </div>
      <h2>{result.outcome === "waitlist" ? "You're on the waitlist!" : "You're in the Founding Cohort!"}</h2>
      <p className="fc-success__msg">{result.message}</p>
      {result.emailSent && (
        <p className="fc-success__email">
          <Mail size={14} aria-hidden /> We've emailed your details — check your inbox.
        </p>
      )}

      <div className="fc-success__cards">
        {result.discountCode && (
          <div className="fc-success__card">
            <span className="fc-success__label">
              <Ticket size={14} aria-hidden /> Your launch discount
            </span>
            <div className="fc-codeline">
              <code>{result.discountCode}</code>
              <button type="button" className="fc-copy" onClick={() => copy(result.discountCode ?? "", "code")}>
                {copied === "code" ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
                {copied === "code" ? "Copied" : "Copy"}
              </button>
            </div>
            <small>{campaign.discountPercent ?? 40}% off your first {campaign.discountDurationMonths ?? 3} months.</small>
          </div>
        )}

        {wantsWebinarSeat && result.webinarUrl && (
          <div className="fc-success__card">
            <span className="fc-success__label">
              <Video size={14} aria-hidden /> {campaign.webinarTitle ?? "Workshop"}
            </span>
            <a href={result.webinarUrl} target="_blank" rel="noopener noreferrer" className="fc-cta-secondary fc-cta-secondary--sm">
              <Video size={15} aria-hidden /> Add the workshop
            </a>
            <small>We'll also email you the calendar invite.</small>
          </div>
        )}
      </div>

      {referralUrl && (
        <div className="fc-refer">
          <span className="fc-success__label">
            <Share2 size={14} aria-hidden /> {campaign.referralRewardSummary ?? "Invite 3 colleagues, unlock one free month after launch."}
          </span>
          <div className="fc-codeline fc-codeline--wide">
            <input className="fc-refer__input" readOnly value={referralUrl} aria-label="Your referral link" onFocus={(e) => e.target.select()} />
            <button type="button" className="fc-copy" onClick={() => copy(referralUrl, "link")}>
              {copied === "link" ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
              {copied === "link" ? "Copied" : "Copy link"}
            </button>
          </div>
          <div className="fc-refer__progress" aria-hidden>
            {Array.from({ length: threshold }).map((_, i) => (
              <span key={i} className={`fc-refer__pip ${i < progress.uses ? "is-filled" : ""}`} />
            ))}
            <em>0 / {threshold} invites</em>
          </div>
        </div>
      )}

      <div className="fc-success__after">
        <button type="button" className="fc-cta-secondary" onClick={onStartBuilding}>
          <Rocket size={16} aria-hidden /> Start building now
        </button>
        <button type="button" className="fc-textlink" onClick={onTryDemo}>
          Explore the live demo <ArrowRight size={14} aria-hidden />
        </button>
      </div>

      <div className="fc-success__brand" aria-hidden>
        <LogoMark size={18} /> RocketCourse
      </div>
    </div>
  );
}
