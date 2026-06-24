// Super Admin → Pilot Campaigns. Create/edit campaigns that render on the public marketing site,
// manage their lifecycle, and review signups (with CSV export). All writes go through the
// super-admin function (server re-checks the Super Admin role); reads are RLS-scoped.

import { useCallback, useEffect, useState } from "react";
import { Archive, Download, Loader2, Megaphone, Pause, Play, Plus, Search, Square } from "lucide-react";
import {
  loadCampaignSignups,
  loadCampaigns,
  loadDiscounts,
  superAdminAction,
  type CampaignSignupRow,
  type DiscountRow
} from "../../services/platformClient";
import { remainingSlots, type Campaign } from "../../services/campaigns";
import { plans } from "../../data/plans";

const CAMPAIGN_STATUS_TONE: Record<string, string> = {
  active: "active",
  draft: "invited",
  paused: "past_due",
  ended: "removed",
  archived: "removed"
};

function CampaignCreateForm({ discounts, onChanged }: { discounts: DiscountRow[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    name: "",
    type: "waitlist",
    placement: "homepage_banner",
    status: "draft",
    headline: "",
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
    requireApproval: false
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string | boolean) => setF((prev) => ({ ...prev, [k]: v }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await superAdminAction("createCampaign", {
        ...f,
        maxSignups: f.maxSignups || undefined,
        discountRecordId: f.discountRecordId || undefined,
        planKey: f.planKey || undefined,
        startsAt: f.startsAt || undefined,
        endsAt: f.endsAt || undefined,
        tutorialAt: f.tutorialAt || undefined
      });
      setF((prev) => ({ ...prev, name: "", headline: "", description: "" }));
      onChanged();
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button type="button" className="primary sa-discount-new" onClick={() => setOpen(true)}>
        <Plus size={14} /> New campaign
      </button>
    );
  }

  return (
    <div className="sa-discount-builder">
      <div className="sa-discount-grid">
        <label><span>Campaign name</span><input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Fall 2026 Faculty Pilot" /></label>
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
        <label><span>Webinar / Zoom link</span><input value={f.webinarUrl} onChange={(e) => set("webinarUrl", e.target.value)} placeholder="https://…" /></label>
        <label><span>Tutorial date/time</span><input type="datetime-local" value={f.tutorialAt} onChange={(e) => set("tutorialAt", e.target.value)} /></label>
        <label className="sa-discount-notes"><span>Public description</span><textarea value={f.description} onChange={(e) => set("description", e.target.value)} rows={2} /></label>
        <label className="sa-discount-notes"><span>Confirmation message</span><textarea value={f.confirmationMessage} onChange={(e) => set("confirmationMessage", e.target.value)} rows={2} /></label>
        <label className="sa-discount-check">
          <input type="checkbox" checked={f.requireApproval} onChange={(e) => set("requireApproval", e.target.checked)} />
          <span>Require manual approval of each signup</span>
        </label>
      </div>
      {error && <p className="intake-ai-error">{error}</p>}
      <div className="sa-credit-actions">
        <button type="button" className="primary" disabled={busy || !f.name.trim()} onClick={submit}>
          {busy ? <Loader2 size={14} className="spin" /> : <Megaphone size={14} />} Create campaign
        </button>
        <button type="button" className="ghost-button" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}

function SignupDashboard({ campaign }: { campaign: Campaign }) {
  const [signups, setSignups] = useState<CampaignSignupRow[]>([]);
  const [filter, setFilter] = useState("");
  const refresh = useCallback(async () => setSignups(await loadCampaignSignups(campaign.id)), [campaign.id]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const remaining = remainingSlots(campaign.maxSignups, signups.filter((s) => s.status !== "rejected").length);
  const waitlisted = signups.filter((s) => s.isWaitlisted || s.status === "waitlisted").length;
  const issued = signups.filter((s) => s.discountCode).length;

  const filtered = signups.filter((s) =>
    !filter ? true : `${s.name ?? ""} ${s.email} ${s.institution ?? ""}`.toLowerCase().includes(filter.toLowerCase())
  );

  const exportCsv = () => {
    const header = ["name", "email", "institution", "role", "status", "waitlisted", "discount_code", "referral", "created_at"];
    const esc = (v: string | null) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const rows = signups.map((s) =>
      [s.name, s.email, s.institution, s.role, s.status, String(s.isWaitlisted), s.discountCode, s.referralSource, s.createdAt].map(esc).join(",")
    );
    const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${campaign.slug ?? "campaign"}-signups.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="sa-campaign-dash">
      <div className="sa-stat-grid">
        <div className="sa-stat"><strong>{signups.length}</strong><span>Total signups</span></div>
        <div className="sa-stat"><strong>{remaining ?? "∞"}</strong><span>Remaining slots</span></div>
        <div className="sa-stat"><strong>{waitlisted}</strong><span>Waitlisted</span></div>
        <div className="sa-stat"><strong>{issued}</strong><span>Codes issued</span></div>
      </div>
      <div className="sa-campaign-toolbar">
        <span className="sa-search"><Search size={14} /><input placeholder="Search name, email, institution" value={filter} onChange={(e) => setFilter(e.target.value)} /></span>
        <button type="button" className="ghost-button" onClick={exportCsv} disabled={signups.length === 0}>
          <Download size={13} /> Export CSV
        </button>
      </div>
      <div className="ws-table-wrap">
        <table className="ws-table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Institution</th><th>Role</th><th>Status</th><th>Code</th><th /></tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id}>
                <td>{s.name ?? "—"}</td>
                <td>{s.email}</td>
                <td>{s.institution ?? "—"}</td>
                <td>{s.role ?? "—"}</td>
                <td><span className={`ws-status ${s.status === "approved" || s.status === "converted" ? "active" : s.status === "rejected" ? "removed" : "invited"}`}>{s.status}</span></td>
                <td>{s.discountCode ? <code>{s.discountCode}</code> : "—"}</td>
                <td className="ws-actions">
                  {s.status !== "approved" && (
                    <button type="button" className="ghost-button" onClick={async () => { await superAdminAction("setSignupStatus", { signupId: s.id, status: "approved" }); await refresh(); }}>Approve</button>
                  )}
                  {s.status !== "rejected" && (
                    <button type="button" className="ghost-button danger" onClick={async () => { await superAdminAction("setSignupStatus", { signupId: s.id, status: "rejected" }); await refresh(); }}>Reject</button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} className="blog-muted">No signups{filter ? " match your search" : " yet"}.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CampaignsManager() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [discounts, setDiscounts] = useState<DiscountRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
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

  return (
    <section className="overview-card">
      <header className="overview-card-head">
        <span className="hp-eyebrow"><Megaphone size={14} /> Pilot campaigns</span>
      </header>
      <CampaignCreateForm discounts={discounts} onChanged={refresh} />
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
