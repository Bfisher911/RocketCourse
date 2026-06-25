// Super Admin → Campaigns & waitlist. Create/edit campaigns that render on the public marketing
// site (incl. the Founding Cohort offer, webinar, and referral-reward config), manage their
// lifecycle, and work the waitlist: filter, search, segment, export (CSV + XLSX), set pipeline
// stage / notes, and manually assign a Stripe promo code. All writes go through the super-admin
// function (server re-checks the Super Admin role); reads are RLS-scoped.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Download, FileSpreadsheet, Loader2, Megaphone, Pause, Pencil, Play, Plus, Search, Square } from "lucide-react";
import {
  loadCampaignSignups,
  loadCampaigns,
  loadDiscounts,
  superAdminAction,
  type CampaignSignupRow,
  type DiscountRow
} from "../../services/platformClient";
import { remainingSlots, type Campaign } from "../../services/campaigns";
import {
  buildWaitlistCsv,
  buildWaitlistXlsx,
  exportFileBase,
  filterSegment,
  fullName,
  SEGMENTS,
  segmentCounts,
  type WaitlistSegment
} from "../../services/waitlistExport";
import { plans } from "../../data/plans";

const CAMPAIGN_STATUS_TONE: Record<string, string> = {
  active: "active",
  draft: "invited",
  paused: "past_due",
  ended: "removed",
  archived: "removed"
};

const PIPELINE_STAGES = ["new", "contacted", "invited", "converted", "not_fit"] as const;

const todayIso = () => new Date().toISOString();
const downloadBytes = (data: BlobPart, mime: string, filename: string) => {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

// The create/edit form's editable shape. Strings throughout (form inputs); the server normalizes.
const emptyForm = {
  name: "",
  type: "waitlist",
  placement: "homepage_banner",
  status: "draft",
  headline: "",
  subheadline: "",
  description: "",
  ctaText: "Request access",
  audienceLabel: "",
  maxSignups: "",
  whenFull: "waitlist",
  startsAt: "",
  endsAt: "",
  discountRecordId: "",
  planKey: "",
  webinarUrl: "",
  tutorialAt: "",
  confirmationMessage: "",
  requireApproval: false,
  // Founding-cohort offer + webinar + referral config
  offerSummary: "",
  discountPercent: "",
  discountDuration: "repeating",
  discountDurationMonths: "",
  annualDiscountPercent: "",
  webinarTitle: "",
  webinarDescription: "",
  webinarAt: "",
  webinarCapacity: "",
  webinarRsvpStatus: "open",
  referralRewardSummary: "",
  referralThreshold: "",
  referralRewardMonths: "",
  referralReferredDiscountPercent: ""
};
type FormState = typeof emptyForm;

const formFromCampaign = (c: Campaign): FormState => ({
  ...emptyForm,
  name: c.name ?? "",
  type: c.type,
  placement: c.placement,
  status: c.status,
  headline: c.headline ?? "",
  subheadline: c.subheadline ?? "",
  description: c.description ?? "",
  ctaText: c.ctaText ?? "Request access",
  audienceLabel: c.audienceLabel ?? "",
  maxSignups: c.maxSignups != null ? String(c.maxSignups) : "",
  whenFull: c.whenFull,
  discountRecordId: c.discountRecordId ?? "",
  planKey: c.planKey ?? "",
  webinarUrl: c.webinarUrl ?? "",
  confirmationMessage: c.confirmationMessage ?? "",
  requireApproval: c.requireApproval,
  offerSummary: c.offerSummary ?? "",
  discountPercent: c.discountPercent != null ? String(c.discountPercent) : "",
  discountDuration: c.discountDuration ?? "repeating",
  discountDurationMonths: c.discountDurationMonths != null ? String(c.discountDurationMonths) : "",
  annualDiscountPercent: c.annualDiscountPercent != null ? String(c.annualDiscountPercent) : "",
  webinarTitle: c.webinarTitle ?? "",
  webinarDescription: c.webinarDescription ?? "",
  webinarCapacity: c.webinarCapacity != null ? String(c.webinarCapacity) : "",
  webinarRsvpStatus: c.webinarRsvpStatus ?? "open",
  referralRewardSummary: c.referralRewardSummary ?? "",
  referralThreshold: c.referralThreshold != null ? String(c.referralThreshold) : "",
  referralRewardMonths: c.referralRewardMonths != null ? String(c.referralRewardMonths) : "",
  referralReferredDiscountPercent: c.referralReferredDiscountPercent != null ? String(c.referralReferredDiscountPercent) : ""
});

function CampaignForm({
  discounts,
  editing,
  onDone,
  onCancel
}: {
  discounts: DiscountRow[];
  editing?: Campaign | null;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [f, setF] = useState<FormState>(editing ? formFromCampaign(editing) : emptyForm);
  const [showAdvanced, setShowAdvanced] = useState(Boolean(editing?.offerSummary || editing?.discountPercent));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof FormState, v: string | boolean) => setF((prev) => ({ ...prev, [k]: v }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        ...f,
        maxSignups: f.maxSignups || undefined,
        discountRecordId: f.discountRecordId || undefined,
        planKey: f.planKey || undefined,
        startsAt: f.startsAt || undefined,
        endsAt: f.endsAt || undefined,
        tutorialAt: f.tutorialAt || undefined,
        webinarAt: f.webinarAt || undefined
      };
      if (editing) await superAdminAction("updateCampaign", { campaignId: editing.id, ...payload });
      else await superAdminAction("createCampaign", payload);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sa-discount-builder">
      <div className="sa-discount-grid">
        <label><span>Campaign name</span><input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="RocketCourse Founding Cohort" /></label>
        <label><span>Type</span>
          <select value={f.type} onChange={(e) => set("type", e.target.value)}>
            <option value="waitlist">Waitlist</option>
            <option value="limited_discount">Limited discount</option>
            <option value="semester_pilot">Semester pilot / webinar</option>
            <option value="private_invite">Private invite-only</option>
          </select>
        </label>
        <label><span>Placement</span>
          <select value={f.placement} onChange={(e) => set("placement", e.target.value)}>
            <option value="homepage_hero">Homepage hero</option>
            <option value="homepage_banner">Homepage banner</option>
            <option value="pricing_page">Pricing page</option>
            <option value="modal">Modal</option>
            <option value="footer">Footer CTA</option>
          </select>
        </label>
        <label><span>Status</span>
          <select value={f.status} onChange={(e) => set("status", e.target.value)}>
            <option value="draft">Draft</option>
            <option value="active">Active (live)</option>
            <option value="paused">Paused</option>
          </select>
        </label>
        <label><span>Public headline</span><input value={f.headline} onChange={(e) => set("headline", e.target.value)} /></label>
        <label><span>CTA button text</span><input value={f.ctaText} onChange={(e) => set("ctaText", e.target.value)} /></label>
        <label><span>Audience label</span><input value={f.audienceLabel} onChange={(e) => set("audienceLabel", e.target.value)} placeholder="Faculty, designers…" /></label>
        <label><span>Max signups</span><input type="number" min={1} value={f.maxSignups} onChange={(e) => set("maxSignups", e.target.value)} placeholder="unlimited" /></label>
        <label><span>When full</span>
          <select value={f.whenFull} onChange={(e) => set("whenFull", e.target.value)}>
            <option value="waitlist">Switch to waitlist</option>
            <option value="closed">Show closed</option>
          </select>
        </label>
        <label><span>Associated discount</span>
          <select value={f.discountRecordId} onChange={(e) => set("discountRecordId", e.target.value)}>
            <option value="">None</option>
            {discounts.map((d) => (
              <option key={d.id} value={d.id}>{d.code ?? d.name ?? d.id}</option>
            ))}
          </select>
        </label>
        <label><span>Associated plan</span>
          <select value={f.planKey} onChange={(e) => set("planKey", e.target.value)}>
            <option value="">None</option>
            {plans.map((p) => (
              <option key={p.key} value={p.key}>{p.name}</option>
            ))}
          </select>
        </label>
        <label><span>Valid from</span><input type="datetime-local" value={f.startsAt} onChange={(e) => set("startsAt", e.target.value)} /></label>
        <label><span>Valid until</span><input type="datetime-local" value={f.endsAt} onChange={(e) => set("endsAt", e.target.value)} /></label>
        <label className="sa-discount-notes"><span>Subheadline</span><textarea value={f.subheadline} onChange={(e) => set("subheadline", e.target.value)} rows={2} /></label>
        <label className="sa-discount-notes"><span>Public description</span><textarea value={f.description} onChange={(e) => set("description", e.target.value)} rows={2} /></label>
        <label className="sa-discount-notes"><span>Confirmation message</span><textarea value={f.confirmationMessage} onChange={(e) => set("confirmationMessage", e.target.value)} rows={2} /></label>
        <label className="sa-discount-check">
          <input type="checkbox" checked={f.requireApproval} onChange={(e) => set("requireApproval", e.target.checked)} />
          <span>Require manual approval of each signup</span>
        </label>
      </div>

      <button type="button" className="ghost-button fc-admin-advanced-toggle" onClick={() => setShowAdvanced((s) => !s)}>
        {showAdvanced ? "Hide" : "Show"} offer, webinar &amp; referral settings
      </button>
      {showAdvanced && (
        <div className="sa-discount-grid">
          <label className="sa-discount-notes"><span>Offer summary (shown on the landing page)</span><textarea value={f.offerSummary} onChange={(e) => set("offerSummary", e.target.value)} rows={2} placeholder="40% off your first 3 months…" /></label>
          <label><span>Discount %</span><input type="number" min={0} max={100} value={f.discountPercent} onChange={(e) => set("discountPercent", e.target.value)} placeholder="40" /></label>
          <label><span>Discount duration</span>
            <select value={f.discountDuration} onChange={(e) => set("discountDuration", e.target.value)}>
              <option value="once">Once</option>
              <option value="repeating">Repeating (months)</option>
              <option value="forever">Forever</option>
            </select>
          </label>
          <label><span>Duration months</span><input type="number" min={1} max={60} value={f.discountDurationMonths} onChange={(e) => set("discountDurationMonths", e.target.value)} placeholder="3" /></label>
          <label><span>Annual discount %</span><input type="number" min={0} max={100} value={f.annualDiscountPercent} onChange={(e) => set("annualDiscountPercent", e.target.value)} placeholder="30" /></label>
          <label><span>Webinar title</span><input value={f.webinarTitle} onChange={(e) => set("webinarTitle", e.target.value)} placeholder="AI Course Building Workshop" /></label>
          <label><span>Webinar date/time</span><input type="datetime-local" value={f.webinarAt} onChange={(e) => set("webinarAt", e.target.value)} /></label>
          <label><span>Webinar capacity</span><input type="number" min={1} value={f.webinarCapacity} onChange={(e) => set("webinarCapacity", e.target.value)} placeholder="100" /></label>
          <label><span>Webinar / Zoom link</span><input value={f.webinarUrl} onChange={(e) => set("webinarUrl", e.target.value)} placeholder="https://…" /></label>
          <label><span>Webinar RSVP status</span>
            <select value={f.webinarRsvpStatus} onChange={(e) => set("webinarRsvpStatus", e.target.value)}>
              <option value="open">Open</option>
              <option value="full">Full (waitlist)</option>
              <option value="closed">Closed</option>
            </select>
          </label>
          <label className="sa-discount-notes"><span>Webinar description</span><textarea value={f.webinarDescription} onChange={(e) => set("webinarDescription", e.target.value)} rows={2} /></label>
          <label className="sa-discount-notes"><span>Referral reward summary</span><textarea value={f.referralRewardSummary} onChange={(e) => set("referralRewardSummary", e.target.value)} rows={2} placeholder="Invite 3 colleagues, unlock one free month…" /></label>
          <label><span>Referral threshold (invites)</span><input type="number" min={1} value={f.referralThreshold} onChange={(e) => set("referralThreshold", e.target.value)} placeholder="3" /></label>
          <label><span>Referrer free months</span><input type="number" min={0} value={f.referralRewardMonths} onChange={(e) => set("referralRewardMonths", e.target.value)} placeholder="1" /></label>
          <label><span>Referred extra discount %</span><input type="number" min={0} max={100} value={f.referralReferredDiscountPercent} onChange={(e) => set("referralReferredDiscountPercent", e.target.value)} placeholder="10" /></label>
        </div>
      )}

      {error && <p className="intake-ai-error">{error}</p>}
      <div className="sa-credit-actions">
        <button type="button" className="primary" disabled={busy || !f.name.trim()} onClick={submit}>
          {busy ? <Loader2 size={14} className="spin" /> : <Megaphone size={14} />} {editing ? "Save changes" : "Create campaign"}
        </button>
        {onCancel && <button type="button" className="ghost-button" onClick={onCancel}>Cancel</button>}
      </div>
    </div>
  );
}

const uniqueValues = (rows: CampaignSignupRow[], pick: (r: CampaignSignupRow) => string | null): string[] =>
  Array.from(new Set(rows.map(pick).filter((v): v is string => Boolean(v && v.trim())))).sort();

function SignupDashboard({ campaign }: { campaign: Campaign }) {
  const [signups, setSignups] = useState<CampaignSignupRow[]>([]);
  const [busyExport, setBusyExport] = useState(false);
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<WaitlistSegment>("all");
  const [roleFilter, setRoleFilter] = useState("");
  const [institutionFilter, setInstitutionFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [sinceFilter, setSinceFilter] = useState("");

  const refresh = useCallback(async () => setSignups(await loadCampaignSignups(campaign.id)), [campaign.id]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const counts = useMemo(() => segmentCounts(signups), [signups]);
  const roles = useMemo(() => uniqueValues(signups, (s) => s.role), [signups]);
  const institutions = useMemo(() => uniqueValues(signups, (s) => s.institution), [signups]);
  const sources = useMemo(() => uniqueValues(signups, (s) => s.utmSource ?? s.referralSource), [signups]);

  const filtered = useMemo(() => {
    let rows = filterSegment(signups, segment);
    const q = search.trim().toLowerCase();
    if (q) rows = rows.filter((s) => `${fullName(s)} ${s.email} ${s.institution ?? ""}`.toLowerCase().includes(q));
    if (roleFilter) rows = rows.filter((s) => s.role === roleFilter);
    if (institutionFilter) rows = rows.filter((s) => s.institution === institutionFilter);
    if (sourceFilter) rows = rows.filter((s) => (s.utmSource ?? s.referralSource) === sourceFilter);
    if (sinceFilter) rows = rows.filter((s) => s.createdAt >= sinceFilter);
    return rows;
  }, [signups, segment, search, roleFilter, institutionFilter, sourceFilter, sinceFilter]);

  const remaining = remainingSlots(campaign.maxSignups, signups.filter((s) => s.status !== "rejected").length);
  const webinarRsvps = counts.webinar;
  const referralSignups = counts.referral;
  const issued = signups.filter((s) => s.discountCode).length;

  const baseName = exportFileBase(campaign.slug, segment, todayIso());
  // Record every export (PII leaves the system) — fire-and-forget, never blocks the download.
  const auditExport = (format: "csv" | "xlsx") =>
    void superAdminAction("logWaitlistExport", { campaignId: campaign.id, format, segment, count: filtered.length }).catch(() => {});
  const exportCsv = () => {
    downloadBytes(buildWaitlistCsv(filtered), "text/csv;charset=utf-8", `${baseName}.csv`);
    auditExport("csv");
  };
  const exportXlsx = async () => {
    setBusyExport(true);
    try {
      const bytes = await buildWaitlistXlsx(filtered);
      // Copy into a fresh ArrayBuffer-backed view so it satisfies the Blob constructor's BlobPart type.
      downloadBytes(new Uint8Array(bytes), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", `${baseName}.xlsx`);
      auditExport("xlsx");
    } finally {
      setBusyExport(false);
    }
  };

  const act = async (action: string, params: Record<string, unknown>) => {
    await superAdminAction(action, params);
    await refresh();
  };

  return (
    <div className="sa-campaign-dash">
      <div className="sa-stat-grid">
        <div className="sa-stat"><strong>{signups.length}</strong><span>Total signups</span></div>
        <div className="sa-stat"><strong>{webinarRsvps}</strong><span>Webinar RSVPs</span></div>
        <div className="sa-stat"><strong>{referralSignups}</strong><span>Referral signups</span></div>
        <div className="sa-stat"><strong>{issued}</strong><span>Codes issued</span></div>
        <div className="sa-stat"><strong>{remaining ?? "∞"}</strong><span>Remaining slots</span></div>
      </div>

      <div className="fc-admin-segments" role="tablist" aria-label="Waitlist segments">
        {(Object.keys(SEGMENTS) as WaitlistSegment[]).map((seg) => (
          <button
            key={seg}
            type="button"
            role="tab"
            aria-selected={segment === seg}
            className={`fc-admin-seg ${segment === seg ? "is-active" : ""}`}
            onClick={() => setSegment(seg)}
          >
            {SEGMENTS[seg].label} <em>{counts[seg]}</em>
          </button>
        ))}
      </div>

      <div className="sa-campaign-toolbar fc-admin-filters">
        <span className="sa-search"><Search size={14} /><input placeholder="Search name, email, institution" value={search} onChange={(e) => setSearch(e.target.value)} /></span>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="Filter by role">
          <option value="">All roles</option>
          {roles.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={institutionFilter} onChange={(e) => setInstitutionFilter(e.target.value)} aria-label="Filter by institution">
          <option value="">All institutions</option>
          {institutions.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} aria-label="Filter by source">
          <option value="">All sources</option>
          {sources.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="date" value={sinceFilter} onChange={(e) => setSinceFilter(e.target.value)} aria-label="Created on or after" />
        <button type="button" className="ghost-button" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download size={13} /> CSV
        </button>
        <button type="button" className="ghost-button" onClick={exportXlsx} disabled={filtered.length === 0 || busyExport}>
          {busyExport ? <Loader2 size={13} className="spin" /> : <FileSpreadsheet size={13} />} XLSX
        </button>
      </div>

      <p className="blog-muted fc-admin-count">{filtered.length} shown · exports respect the current segment + filters</p>

      <div className="ws-table-wrap">
        <table className="ws-table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Institution</th><th>Webinar</th><th>Referral</th><th>Code</th><th>Stage</th><th /></tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <SignupRow key={s.id} s={s} onAct={act} />
            ))}
            {filtered.length === 0 && <tr><td colSpan={9} className="blog-muted">No signups match the current segment + filters.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SignupRow({ s, onAct }: { s: CampaignSignupRow; onAct: (action: string, params: Record<string, unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(s.adminNotes ?? "");
  const [promo, setPromo] = useState(s.assignedStripePromoCode ?? "");
  const statusTone = s.status === "approved" || s.status === "converted" ? "active" : s.status === "rejected" ? "removed" : "invited";

  return (
    <>
      <tr className={open ? "is-open" : ""}>
        <td>
          <button type="button" className="sa-campaign-name" onClick={() => setOpen((o) => !o)}>
            <strong>{fullName(s) || "—"}</strong>
          </button>
        </td>
        <td>{s.email}</td>
        <td>{s.role ?? "—"}</td>
        <td>{s.institution ?? "—"}</td>
        <td>{s.wantsWebinarSeat ? "✓" : "—"}</td>
        <td>{s.referralCodeUsed ? <code>{s.referralCodeUsed}</code> : "—"}</td>
        <td>{s.discountCode ? <code>{s.discountCode}</code> : "—"}</td>
        <td>
          <select
            value={s.pipelineStage ?? "new"}
            onChange={(e) => void onAct("setSignupPipeline", { signupId: s.id, pipelineStage: e.target.value })}
            aria-label="Pipeline stage"
          >
            {PIPELINE_STAGES.map((st) => <option key={st} value={st}>{st.replace("_", " ")}</option>)}
          </select>
        </td>
        <td className="ws-actions">
          <span className={`ws-status ${statusTone}`}>{s.status}</span>
        </td>
      </tr>
      {open && (
        <tr className="fc-admin-detail">
          <td colSpan={9}>
            <div className="fc-admin-detail__grid">
              <div>
                <strong>Their referral code</strong>
                <p>{s.assignedReferralCode ? <code>{s.assignedReferralCode}</code> : "—"}</p>
                <strong>UTM</strong>
                <p>{[s.utmSource, s.utmMedium, s.utmCampaign].filter(Boolean).join(" · ") || "—"}</p>
                <strong>Landing</strong>
                <p>{s.landingPagePath ?? "—"}</p>
                <strong>Email consent</strong>
                <p>{s.consentToEmail ? "Yes" : "No"}</p>
              </div>
              <div>
                <strong>Use case / pain point</strong>
                <p>{s.primaryUseCase ?? "—"}{s.painPoint ? ` — ${s.painPoint}` : ""}</p>
                <label className="fc-admin-detail__field">
                  <span>Assign Stripe promo code</span>
                  <span className="fc-admin-inline">
                    <input value={promo} onChange={(e) => setPromo(e.target.value)} placeholder="PROMO_CODE" />
                    <button type="button" className="ghost-button" onClick={() => void onAct("assignSignupPromo", { signupId: s.id, promoCode: promo || null })}>Save</button>
                  </span>
                </label>
                <label className="fc-admin-detail__field">
                  <span>Admin notes</span>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} onBlur={() => void onAct("setSignupPipeline", { signupId: s.id, adminNotes: notes })} />
                </label>
              </div>
              <div className="fc-admin-detail__actions">
                {s.status !== "approved" && <button type="button" className="ghost-button" onClick={() => void onAct("setSignupStatus", { signupId: s.id, status: "approved" })}>Approve</button>}
                {s.status !== "converted" && <button type="button" className="ghost-button" onClick={() => void onAct("setSignupStatus", { signupId: s.id, status: "converted" })}>Mark converted</button>}
                {s.status !== "rejected" && <button type="button" className="ghost-button danger" onClick={() => void onAct("setSignupStatus", { signupId: s.id, status: "rejected" })}>Reject</button>}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function CampaignsManager() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [discounts, setDiscounts] = useState<DiscountRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setCampaigns(await loadCampaigns());
    setDiscounts(await loadDiscounts());
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setStatus = async (id: string, status: string) => {
    setError(null);
    try {
      await superAdminAction("setCampaignStatus", { campaignId: id, status });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const editing = editingId ? campaigns.find((c) => c.id === editingId) ?? null : null;

  return (
    <section className="overview-card">
      <header className="overview-card-head">
        <span className="hp-eyebrow"><Megaphone size={14} /> Campaigns &amp; waitlist</span>
      </header>

      {creating || editing ? (
        <CampaignForm
          discounts={discounts}
          editing={editing}
          onDone={() => {
            setCreating(false);
            setEditingId(null);
            void refresh();
          }}
          onCancel={() => {
            setCreating(false);
            setEditingId(null);
          }}
        />
      ) : (
        <button type="button" className="primary sa-discount-new" onClick={() => setCreating(true)}>
          <Plus size={14} /> New campaign
        </button>
      )}
      {error && <p className="intake-ai-error">{error}</p>}

      <div className="ws-table-wrap">
        <table className="ws-table">
          <thead>
            <tr><th>Campaign</th><th>Type</th><th>Placement</th><th>Signups</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className={openId === c.id ? "is-open" : ""}>
                <td>
                  <button type="button" className="sa-campaign-name" onClick={() => setOpenId(openId === c.id ? null : c.id)}>
                    <strong>{c.name}</strong>
                  </button>
                  {c.slug && <small className="sa-discount-campaign">/{c.slug}</small>}
                </td>
                <td>{c.type.replace(/_/g, " ")}</td>
                <td>{c.placement.replace(/_/g, " ")}</td>
                <td>{c.signupCount ?? 0}{c.maxSignups ? ` / ${c.maxSignups}` : ""}</td>
                <td><span className={`ws-status ${CAMPAIGN_STATUS_TONE[c.status] ?? "active"}`}>{c.status}</span></td>
                <td className="ws-actions sa-discount-actions">
                  <button type="button" className="ghost-button" title="Edit" onClick={() => { setEditingId(c.id); setCreating(false); }}><Pencil size={13} /></button>
                  {c.status !== "active" && c.status !== "archived" && (
                    <button type="button" className="ghost-button" title="Activate" onClick={() => setStatus(c.id, "active")}><Play size={13} /></button>
                  )}
                  {c.status === "active" && (
                    <button type="button" className="ghost-button" title="Pause" onClick={() => setStatus(c.id, "paused")}><Pause size={13} /></button>
                  )}
                  {c.status !== "ended" && c.status !== "archived" && (
                    <button type="button" className="ghost-button" title="End" onClick={() => setStatus(c.id, "ended")}><Square size={13} /></button>
                  )}
                  {c.status !== "archived" && (
                    <button type="button" className="ghost-button danger" title="Archive" onClick={() => setStatus(c.id, "archived")}><Archive size={13} /></button>
                  )}
                </td>
              </tr>
            ))}
            {campaigns.length === 0 && <tr><td colSpan={6} className="blog-muted">No campaigns yet. Create one above — set it Active to show it on the marketing site.</td></tr>}
          </tbody>
        </table>
      </div>

      {openId && campaigns.find((c) => c.id === openId) && (
        <SignupDashboard campaign={campaigns.find((c) => c.id === openId) as Campaign} />
      )}
    </section>
  );
}
