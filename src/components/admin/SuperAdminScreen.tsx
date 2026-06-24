// RocketCourse Mission Control — the Super Admin command center. Access is enforced server-side on
// every write (super-admin function) and read (RLS *_super_read policies). Sections: global
// overview, workspace directory, user directory (+ read-only audited "view as"), usage/cost,
// discount codes (Stripe, server-side), blog manager, and the audit log.

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Archive,
  BadgePercent,
  Building2,
  Coins,
  Copy,
  ExternalLink,
  Eye,
  FlaskConical,
  Gauge,
  History,
  Loader2,
  Megaphone,
  Newspaper,
  Pause,
  Play,
  RefreshCw,
  ShieldAlert,
  UserX,
  Users
} from "lucide-react";
import { BrandBadge } from "../brand";
import { BlogManager } from "./BlogManager";
import { CampaignsManager } from "./CampaignsManager";
import {
  loadAuditLog,
  loadDiscountRedemptions,
  loadDiscounts,
  loadSuperOverview,
  loadUsersDirectory,
  loadWorkspacesDirectory,
  superAdminAction,
  type AuditRow,
  type DirectoryUser,
  type DirectoryWorkspace,
  type DiscountRedemptionRow,
  type DiscountRow,
  type SuperOverview
} from "../../services/platformClient";
import { selfServePlans } from "../../data/plans";

type Tab = "overview" | "workspaces" | "users" | "costs" | "discounts" | "campaigns" | "blog" | "audit";
const TABS: { key: Tab; label: string; icon: typeof Gauge }[] = [
  { key: "overview", label: "Overview", icon: Gauge },
  { key: "workspaces", label: "Workspaces", icon: Building2 },
  { key: "users", label: "Users", icon: Users },
  { key: "costs", label: "Usage & Cost", icon: Activity },
  { key: "discounts", label: "Discounts", icon: BadgePercent },
  { key: "campaigns", label: "Campaigns", icon: Megaphone },
  { key: "blog", label: "Blog", icon: Newspaper },
  { key: "audit", label: "Audit log", icon: ShieldAlert }
];

const dollars = (cents: number): string => `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

interface CreditTarget {
  type: "workspace" | "user";
  id: string;
  label: string;
}

function CreditGrantForm({ target, onClose, onGranted }: { target: CreditTarget; onClose: () => void; onGranted: () => void }) {
  const [kind, setKind] = useState<"export_credit" | "ai_credit">("export_credit");
  const [amount, setAmount] = useState(10);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="sa-credit-form">
      <strong>Grant credits to {target.label}</strong>
      <div className="sa-credit-row">
        <select value={kind} onChange={(e) => setKind(e.target.value as "export_credit" | "ai_credit")}>
          <option value="export_credit">Export credits</option>
          <option value="ai_credit">AI generation credits</option>
        </select>
        <input type="number" value={amount} min={1} onChange={(e) => setAmount(Number(e.target.value))} />
        <input placeholder="Reason (required, audited)" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      {error && <p className="intake-ai-error">{error}</p>}
      <div className="sa-credit-actions">
        <button
          type="button"
          className="primary"
          disabled={busy || !reason.trim() || amount <= 0}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await superAdminAction("grantCredits", { targetType: target.type, targetId: target.id, kind, amount, reason });
              onGranted();
              onClose();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Loader2 size={14} className="spin" /> : <Coins size={14} />} Grant
        </button>
        <button type="button" className="ghost-button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function SuperAdminScreen({ selfUserId }: { selfUserId: string }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<SuperOverview | null>(null);
  const [workspaces, setWorkspaces] = useState<DirectoryWorkspace[]>([]);
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [discounts, setDiscounts] = useState<DiscountRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [creditTarget, setCreditTarget] = useState<CreditTarget | null>(null);
  const [impersonating, setImpersonating] = useState<DirectoryUser | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (tab === "overview") setOverview(await loadSuperOverview());
    if (tab === "workspaces") setWorkspaces(await loadWorkspacesDirectory());
    if (tab === "users") setUsers(await loadUsersDirectory());
    if (tab === "costs") {
      setOverview(await loadSuperOverview());
      setWorkspaces(await loadWorkspacesDirectory());
    }
    if (tab === "discounts") setDiscounts(await loadDiscounts());
    if (tab === "audit") setAudit(await loadAuditLog());
  }, [tab]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const startImpersonation = async (u: DirectoryUser) => {
    await superAdminAction("impersonationStart", { targetUserId: u.id }).catch(() => undefined);
    setImpersonating(u);
  };
  const stopImpersonation = async () => {
    if (impersonating) await superAdminAction("impersonationEnd", { targetUserId: impersonating.id }).catch(() => undefined);
    setImpersonating(null);
  };

  return (
    <main id="main-content" tabIndex={-1} className="page-shell super-admin">
      {impersonating && (
        <div className="impersonation-banner" role="status">
          <Eye size={16} /> Viewing as <strong>{impersonating.email}</strong> (read-only, audited)
          <button type="button" className="ghost-button" onClick={() => void stopImpersonation()}>
            Exit view-as
          </button>
        </div>
      )}

      <section className="page-heading">
        <div>
          <BrandBadge label="Mission Control" className="dashboard-badge" />
          <h1>Super Admin</h1>
          <p>Platform analytics, workspaces, users, costs, discounts, pilot campaigns, and the blog.</p>
        </div>
      </section>

      <div className="tabs" role="tablist" aria-label="Super admin sections">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} className={tab === t.key ? "active" : ""} onClick={() => setTab(t.key)}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {notice && <p className="ws-notice ok">{notice}</p>}

      {tab === "overview" && (
        <section className="sa-stat-grid">
          {[
            ["Workspaces", overview?.totalWorkspaces],
            ["Users", overview?.totalUsers],
            ["Active subscriptions", overview?.activeSubscriptions],
            ["Past due", overview?.pastDueSubscriptions],
            ["Exports (this month)", overview?.exportsThisMonth],
            ["AI generations (this month)", overview?.aiThisMonth],
            ["Est. LLM cost (mo)", overview ? dollars(overview.estCostCents) : undefined],
            ["Est. revenue (annualized)", overview ? dollars(overview.estRevenueCents) : undefined]
          ].map(([label, value]) => (
            <div className="sa-stat" key={String(label)}>
              <strong>{value ?? "—"}</strong>
              <span>{label}</span>
            </div>
          ))}
        </section>
      )}

      {tab === "workspaces" && (
        <section className="overview-card">
          <header className="overview-card-head">
            <span className="hp-eyebrow"><Building2 size={14} /> Workspace directory</span>
          </header>
          <div className="ws-table-wrap">
            <table className="ws-table">
              <thead>
                <tr><th>Workspace</th><th>Owner</th><th>Plan</th><th>Seats</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {workspaces.map((w) => (
                  <tr key={w.id}>
                    <td><strong>{w.name}</strong></td>
                    <td>{w.ownerEmail ?? "—"}</td>
                    <td>{w.planKey}</td>
                    <td>{w.seatUsed} / {w.seatLimit}</td>
                    <td><span className={`ws-status ${w.status}`}>{w.status}</span></td>
                    <td className="ws-actions">
                      <button type="button" className="ghost-button" onClick={() => setCreditTarget({ type: "workspace", id: w.id, label: w.name })}>
                        <Coins size={13} /> Credits
                      </button>
                    </td>
                  </tr>
                ))}
                {workspaces.length === 0 && <tr><td colSpan={6} className="blog-muted">No workspaces yet.</td></tr>}
              </tbody>
            </table>
          </div>
          {creditTarget?.type === "workspace" && (
            <CreditGrantForm target={creditTarget} onClose={() => setCreditTarget(null)} onGranted={() => setNotice("Credits granted.")} />
          )}
        </section>
      )}

      {tab === "users" && (
        <section className="overview-card">
          <header className="overview-card-head">
            <span className="hp-eyebrow"><Users size={14} /> User directory</span>
          </header>
          <div className="ws-table-wrap">
            <table className="ws-table">
              <thead>
                <tr><th>User</th><th>Role</th><th>Workspaces</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="ws-member">
                        <div>
                          <strong>{u.fullName || u.email}</strong>
                          {u.email && <small>{u.email}</small>}
                        </div>
                      </div>
                    </td>
                    <td>{u.isSuperAdmin ? <span className="ws-role-tag super">Super Admin</span> : "Member"}</td>
                    <td>{u.workspaceCount}</td>
                    <td>{u.disabledAt ? <span className="ws-status removed">disabled</span> : <span className="ws-status active">active</span>}</td>
                    <td className="ws-actions">
                      <button type="button" className="ghost-button" disabled={u.id === selfUserId} onClick={() => void startImpersonation(u)}>
                        <Eye size={13} /> View as
                      </button>
                      <button type="button" className="ghost-button" onClick={() => setCreditTarget({ type: "user", id: u.id, label: u.email ?? u.id })}>
                        <Coins size={13} /> Credits
                      </button>
                      {!u.isSuperAdmin && (
                        <button
                          type="button"
                          className="ghost-button danger"
                          onClick={async () => {
                            await superAdminAction("setUserDisabled", { targetUserId: u.id, disabled: !u.disabledAt });
                            await refresh();
                          }}
                        >
                          <UserX size={13} /> {u.disabledAt ? "Enable" : "Disable"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && <tr><td colSpan={5} className="blog-muted">No users found.</td></tr>}
              </tbody>
            </table>
          </div>
          {creditTarget?.type === "user" && (
            <CreditGrantForm target={creditTarget} onClose={() => setCreditTarget(null)} onGranted={() => setNotice("Credits granted.")} />
          )}
        </section>
      )}

      {tab === "costs" && (
        <section className="overview-card">
          <header className="overview-card-head">
            <span className="hp-eyebrow"><Activity size={14} /> Usage & cost (this month)</span>
          </header>
          <div className="sa-stat-grid">
            <div className="sa-stat"><strong>{overview?.exportsThisMonth ?? "—"}</strong><span>Exports</span></div>
            <div className="sa-stat"><strong>{overview?.aiThisMonth ?? "—"}</strong><span>AI generations</span></div>
            <div className="sa-stat"><strong>{overview ? dollars(overview.estCostCents) : "—"}</strong><span>Est. LLM/API cost</span></div>
            <div className="sa-stat"><strong>{overview ? dollars(overview.estRevenueCents) : "—"}</strong><span>Est. revenue (annualized)</span></div>
            <div className="sa-stat">
              <strong>{overview && overview.estRevenueCents > 0 ? `${Math.round((1 - overview.estCostCents / overview.estRevenueCents) * 100)}%` : "—"}</strong>
              <span>Rough gross margin</span>
            </div>
          </div>
          <p className="blog-muted">Costs are estimated from logged token usage and the server-side model pricing table (src/data/platform.ts). Revenue is annualized from active-subscription catalog prices.</p>
        </section>
      )}

      {tab === "discounts" && <DiscountManager discounts={discounts} onChanged={refresh} />}

      {tab === "campaigns" && <CampaignsManager />}

      {tab === "blog" && <BlogManager />}

      {tab === "audit" && (
        <section className="overview-card">
          <header className="overview-card-head">
            <span className="hp-eyebrow"><ShieldAlert size={14} /> Audit log</span>
          </header>
          <ul className="ws-audit">
            {audit.map((a) => (
              <li key={a.id}>
                <span className="ws-audit-event">{a.eventType.replace(/_/g, " ")}</span>
                <span className="ws-audit-meta">
                  {a.actorEmail ?? "system"} → {a.targetType ?? ""} {a.targetId ?? ""} · {new Date(a.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
            {audit.length === 0 && <li className="blog-muted">No audit events yet.</li>}
          </ul>
        </section>
      )}
    </main>
  );
}

const STATUS_TONE: Record<string, string> = {
  active: "active",
  draft: "invited",
  paused: "past_due",
  expired: "removed",
  archived: "removed"
};

const discountAmountLabel = (d: DiscountRow): string => {
  if (d.percentOff !== null) return `${d.percentOff}% off`;
  if (d.amountOff !== null) return `${(d.amountOff / 100).toFixed(2)} ${(d.currency ?? "usd").toUpperCase()} off`;
  return "—";
};

const durationLabel = (d: DiscountRow): string => {
  if (d.duration === "repeating") return `repeating · ${d.durationInMonths ?? "?"} mo`;
  return d.duration ?? "—";
};

const dateShort = (iso: string | null): string => (iso ? new Date(iso).toLocaleDateString() : "—");

function DiscountCreateForm({ onChanged }: { onChanged: () => void }) {
  const plans = selfServePlans();
  const [campaignName, setCampaignName] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [percentOff, setPercentOff] = useState(20);
  const [amountOff, setAmountOff] = useState(10);
  const [currency, setCurrency] = useState("usd");
  const [duration, setDuration] = useState("once");
  const [durationInMonths, setDurationInMonths] = useState(3);
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [perCustomerLimit, setPerCustomerLimit] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [appliesToPlan, setAppliesToPlan] = useState("all");
  const [appliesToInterval, setAppliesToInterval] = useState("all");
  const [visibility, setVisibility] = useState("public");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await superAdminAction("createDiscount", {
        campaignName: campaignName || undefined,
        name,
        code: code || undefined,
        discountType,
        percentOff: discountType === "percent" ? percentOff : undefined,
        amountOff: discountType === "amount" ? amountOff : undefined,
        currency,
        duration,
        durationInMonths,
        maxRedemptions: maxRedemptions || undefined,
        perCustomerLimit: perCustomerLimit || undefined,
        startsAt: startsAt || undefined,
        endsAt: endsAt || undefined,
        appliesToPlan,
        appliesToInterval,
        visibility,
        notes: notes || undefined
      });
      setName("");
      setCode("");
      setCampaignName("");
      setNotes("");
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
        <BadgePercent size={14} /> New discount code
      </button>
    );
  }

  return (
    <div className="sa-discount-builder">
      <div className="sa-discount-grid">
        <label>
          <span>Campaign name (optional)</span>
          <input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Fall 2026 pilot" />
        </label>
        <label>
          <span>Internal name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Launch 20" />
        </label>
        <label>
          <span>Public code (optional)</span>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="auto-generated if blank" />
        </label>
        <label>
          <span>Discount type</span>
          <select value={discountType} onChange={(e) => setDiscountType(e.target.value as "percent" | "amount")}>
            <option value="percent">Percentage off</option>
            <option value="amount">Fixed amount off</option>
          </select>
        </label>
        {discountType === "percent" ? (
          <label>
            <span>Percent off (1–100)</span>
            <input type="number" min={1} max={100} value={percentOff} onChange={(e) => setPercentOff(Number(e.target.value))} />
          </label>
        ) : (
          <>
            <label>
              <span>Amount off (in dollars)</span>
              <input type="number" min={1} value={amountOff} onChange={(e) => setAmountOff(Number(e.target.value))} />
            </label>
            <label>
              <span>Currency</span>
              <input value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={3} placeholder="usd" />
            </label>
          </>
        )}
        <label>
          <span>Duration</span>
          <select value={duration} onChange={(e) => setDuration(e.target.value)}>
            <option value="once">Once</option>
            <option value="forever">Forever</option>
            <option value="repeating">Repeating</option>
          </select>
        </label>
        {duration === "repeating" && (
          <label>
            <span>Repeating months</span>
            <input type="number" min={1} value={durationInMonths} onChange={(e) => setDurationInMonths(Number(e.target.value))} />
          </label>
        )}
        <label>
          <span>Max total redemptions</span>
          <input type="number" min={1} value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)} placeholder="unlimited" />
        </label>
        <label>
          <span>Per-customer limit</span>
          <input type="number" min={1} value={perCustomerLimit} onChange={(e) => setPerCustomerLimit(e.target.value)} placeholder="none" />
        </label>
        <label>
          <span>Valid from</span>
          <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </label>
        <label>
          <span>Valid until</span>
          <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </label>
        <label>
          <span>Applies to plan</span>
          <select value={appliesToPlan} onChange={(e) => setAppliesToPlan(e.target.value)}>
            <option value="all">All plans</option>
            {plans.map((p) => (
              <option key={p.key} value={p.key}>{p.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Applies to interval</span>
          <select value={appliesToInterval} onChange={(e) => setAppliesToInterval(e.target.value)}>
            <option value="all">All intervals</option>
            <option value="month">Monthly</option>
            <option value="year">Annual</option>
            <option value="one_time">One-time (semester)</option>
          </select>
        </label>
        <label>
          <span>Visibility</span>
          <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
            <option value="public">Public</option>
            <option value="private">Private</option>
            <option value="campaign">Campaign-linked</option>
          </select>
        </label>
        <label className="sa-discount-notes">
          <span>Notes (internal)</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </label>
      </div>
      {error && <p className="intake-ai-error">{error}</p>}
      <div className="sa-credit-actions">
        <button type="button" className="primary" disabled={busy || !name.trim()} onClick={submit}>
          {busy ? <Loader2 size={14} className="spin" /> : <BadgePercent size={14} />} Create in Stripe
        </button>
        <button type="button" className="ghost-button" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}

function DiscountManager({ discounts, onChanged }: { discounts: DiscountRow[]; onChanged: () => void }) {
  const plans = selfServePlans();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [history, setHistory] = useState<DiscountRedemptionRow[]>([]);

  const run = async (id: string, action: string, params: Record<string, unknown>) => {
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      const res = await superAdminAction(action, params);
      if ((res as { url?: string }).url) {
        window.open((res as { url: string }).url, "_blank", "noopener");
      }
      if ((res as { warning?: string }).warning) setNotice((res as { warning: string }).warning);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const viewHistory = async (id: string) => {
    if (historyFor === id) {
      setHistoryFor(null);
      return;
    }
    setHistoryFor(id);
    setHistory(await loadDiscountRedemptions(id));
  };

  return (
    <section className="overview-card">
      <header className="overview-card-head">
        <span className="hp-eyebrow"><BadgePercent size={14} /> Discount codes (Stripe-backed)</span>
        <button type="button" className="ghost-button" onClick={() => void run("__all__", "syncDiscounts", {})}>
          <RefreshCw size={13} /> Sync from Stripe
        </button>
      </header>

      <DiscountCreateForm onChanged={onChanged} />

      {notice && <p className="ws-notice ok">{notice}</p>}
      {error && <p className="intake-ai-error">{error}</p>}

      <div className="ws-table-wrap">
        <table className="ws-table sa-discount-table">
          <thead>
            <tr>
              <th>Code</th><th>Discount</th><th>Duration</th><th>Plan / interval</th>
              <th>Redeemed</th><th>Status</th><th>Window</th><th>Created by</th><th />
            </tr>
          </thead>
          <tbody>
            {discounts.map((d) => (
              <DiscountRowView
                key={d.id}
                d={d}
                plans={plans}
                busy={busyId === d.id}
                onAction={run}
                onHistory={viewHistory}
                historyOpen={historyFor === d.id}
                history={history}
              />
            ))}
            {discounts.length === 0 && <tr><td colSpan={9} className="blog-muted">No discount codes yet. Create one above — it’s created in Stripe and applies at checkout.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DiscountRowView({
  d,
  plans,
  busy,
  onAction,
  onHistory,
  historyOpen,
  history
}: {
  d: DiscountRow;
  plans: ReturnType<typeof selfServePlans>;
  busy: boolean;
  onAction: (id: string, action: string, params: Record<string, unknown>) => void;
  onHistory: (id: string) => void;
  historyOpen: boolean;
  history: DiscountRedemptionRow[];
}) {
  const testPlan = (d.appliesToPlan && plans.some((p) => p.key === d.appliesToPlan) ? d.appliesToPlan : plans[0]?.key) ?? "team";
  const stripeUrl = d.stripePromotionCodeId ? `https://dashboard.stripe.com/promotion_codes/${d.stripePromotionCodeId}` : null;

  return (
    <>
      <tr>
        <td><code>{d.code ?? "—"}</code>{d.campaignName && <small className="sa-discount-campaign">{d.campaignName}</small>}</td>
        <td>{discountAmountLabel(d)}</td>
        <td>{durationLabel(d)}</td>
        <td>{d.appliesToPlan ?? "all"}{d.appliesToInterval ? ` / ${d.appliesToInterval}` : ""}</td>
        <td>{d.timesRedeemed}{d.maxRedemptions ? ` / ${d.maxRedemptions}` : ""}</td>
        <td><span className={`ws-status ${STATUS_TONE[d.status] ?? "active"}`}>{d.status}</span></td>
        <td className="sa-discount-window">{dateShort(d.startsAt)} – {dateShort(d.expiresAt)}</td>
        <td>{d.createdByEmail ?? "—"}</td>
        <td className="ws-actions sa-discount-actions">
          {busy && <Loader2 size={13} className="spin" />}
          {d.status !== "active" && d.status !== "archived" && (
            <button type="button" className="ghost-button" title="Activate" onClick={() => onAction(d.id, "updateDiscountStatus", { recordId: d.id, status: "active" })}>
              <Play size={13} /> Activate
            </button>
          )}
          {d.status === "active" && (
            <button type="button" className="ghost-button" title="Pause" onClick={() => onAction(d.id, "updateDiscountStatus", { recordId: d.id, status: "paused" })}>
              <Pause size={13} /> Pause
            </button>
          )}
          <button type="button" className="ghost-button" title="Duplicate" onClick={() => onAction(d.id, "duplicateDiscount", { recordId: d.id })}>
            <Copy size={13} />
          </button>
          <button type="button" className="ghost-button" title="Test checkout link" onClick={() => onAction(d.id, "testDiscountCheckout", { recordId: d.id, planKey: testPlan })}>
            <FlaskConical size={13} />
          </button>
          <button type="button" className="ghost-button" title="Redemption history" onClick={() => onHistory(d.id)}>
            <History size={13} />
          </button>
          {stripeUrl && (
            <a className="ghost-button" href={stripeUrl} target="_blank" rel="noopener noreferrer" title="Open in Stripe">
              <ExternalLink size={13} />
            </a>
          )}
          {d.status !== "archived" && (
            <button type="button" className="ghost-button danger" title="Archive" onClick={() => onAction(d.id, "updateDiscountStatus", { recordId: d.id, status: "archived" })}>
              <Archive size={13} />
            </button>
          )}
        </td>
      </tr>
      {historyOpen && (
        <tr className="sa-discount-history-row">
          <td colSpan={9}>
            <strong>Redemption history</strong>
            {history.length === 0 ? (
              <p className="blog-muted">No redemptions recorded yet.</p>
            ) : (
              <ul className="sa-discount-history">
                {history.map((r) => (
                  <li key={r.id}>
                    {new Date(r.redeemedAt).toLocaleString()} · {r.stripeCustomerId ?? "customer"} ·{" "}
                    {r.amountDiscountedCents !== null ? `${(r.amountDiscountedCents / 100).toFixed(2)} ${(r.currency ?? "usd").toUpperCase()} off` : "—"}
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
