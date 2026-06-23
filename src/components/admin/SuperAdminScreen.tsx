// RocketCourse Mission Control — the Super Admin command center. Access is enforced server-side on
// every write (super-admin function) and read (RLS *_super_read policies). Sections: global
// overview, workspace directory, user directory (+ read-only audited "view as"), usage/cost,
// discount codes (Stripe, server-side), blog manager, and the audit log.

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  BadgePercent,
  Building2,
  Coins,
  Eye,
  Gauge,
  Loader2,
  Newspaper,
  ShieldAlert,
  UserX,
  Users
} from "lucide-react";
import { BrandBadge } from "../brand";
import { BlogManager } from "./BlogManager";
import {
  loadAuditLog,
  loadDiscounts,
  loadSuperOverview,
  loadUsersDirectory,
  loadWorkspacesDirectory,
  superAdminAction,
  type AuditRow,
  type DirectoryUser,
  type DirectoryWorkspace,
  type DiscountRow,
  type SuperOverview
} from "../../services/platformClient";

type Tab = "overview" | "workspaces" | "users" | "costs" | "discounts" | "blog" | "audit";
const TABS: { key: Tab; label: string; icon: typeof Gauge }[] = [
  { key: "overview", label: "Overview", icon: Gauge },
  { key: "workspaces", label: "Workspaces", icon: Building2 },
  { key: "users", label: "Users", icon: Users },
  { key: "costs", label: "Usage & Cost", icon: Activity },
  { key: "discounts", label: "Discounts", icon: BadgePercent },
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
    <main className="page-shell super-admin">
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
          <p>Platform analytics, workspaces, users, costs, discounts, and the blog.</p>
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

function DiscountManager({ discounts, onChanged }: { discounts: DiscountRow[]; onChanged: () => void }) {
  const [name, setName] = useState("");
  const [percentOff, setPercentOff] = useState(20);
  const [code, setCode] = useState("");
  const [duration, setDuration] = useState("once");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="overview-card">
      <header className="overview-card-head">
        <span className="hp-eyebrow"><BadgePercent size={14} /> Discount codes (Stripe)</span>
      </header>
      <div className="sa-discount-form">
        <input placeholder="Name (e.g. Launch 20)" value={name} onChange={(e) => setName(e.target.value)} />
        <input type="number" min={1} max={100} value={percentOff} onChange={(e) => setPercentOff(Number(e.target.value))} aria-label="Percent off" />
        <input placeholder="CODE (optional)" value={code} onChange={(e) => setCode(e.target.value)} />
        <select value={duration} onChange={(e) => setDuration(e.target.value)}>
          <option value="once">Once</option>
          <option value="forever">Forever</option>
          <option value="repeating">Repeating</option>
        </select>
        <button
          type="button"
          className="primary"
          disabled={busy || !name.trim()}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await superAdminAction("createDiscount", { name, percentOff, code: code || undefined, duration });
              setName("");
              setCode("");
              onChanged();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Loader2 size={14} className="spin" /> : <BadgePercent size={14} />} Create code
        </button>
      </div>
      {error && <p className="intake-ai-error">{error}</p>}
      <div className="ws-table-wrap">
        <table className="ws-table">
          <thead>
            <tr><th>Code</th><th>Name</th><th>Off</th><th>Duration</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {discounts.map((d) => (
              <tr key={d.id}>
                <td><code>{d.code ?? "—"}</code></td>
                <td>{d.name ?? "—"}</td>
                <td>{d.percentOff !== null ? `${d.percentOff}%` : d.amountOff !== null ? `$${(d.amountOff / 100).toFixed(2)}` : "—"}</td>
                <td>{d.duration ?? "—"}</td>
                <td>{d.active ? <span className="ws-status active">active</span> : <span className="ws-status removed">inactive</span>}</td>
                <td className="ws-actions">
                  {d.active && (
                    <button
                      type="button"
                      className="ghost-button danger"
                      onClick={async () => {
                        await superAdminAction("deactivateDiscount", { recordId: d.id });
                        onChanged();
                      }}
                    >
                      Deactivate
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {discounts.length === 0 && <tr><td colSpan={6} className="blog-muted">No discount codes yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
