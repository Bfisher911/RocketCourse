// Workspace Launchpad — the workspace admin's command center: seat usage, members, invites, join
// links, and analytics. All mutations call the server (workspace-manage) which re-checks the role
// and enforces seats + last-admin protection. Read data comes from the workspace-data function.

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Copy,
  CreditCard,
  Link2,
  Loader2,
  Mail,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users
} from "lucide-react";
import { BrandBadge, LogoMark } from "../brand";
import { loadWorkspaceData, workspaceManage } from "../../services/platformClient";
import { ASSIGNABLE_ROLES, ROLE_LABELS, type InviteRole, type WorkspaceRole } from "../../services/workspaceRoles";

interface Member {
  userId: string;
  role: WorkspaceRole;
  status: string;
  joinedAt: string | null;
  lastActiveAt: string | null;
  email: string | null;
  fullName: string | null;
}
interface Invite {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string | null;
  created_at: string;
}
interface JoinLink {
  id: string;
  default_role: string;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}
interface AuditRow {
  id: string;
  event_type: string;
  actor_email: string | null;
  created_at: string;
}
interface WorkspaceData {
  workspace: { id: string; name: string; planKey: string; seatLimit: number; status: string; ownerId: string; stripeCustomerId: string | null };
  myRole: WorkspaceRole;
  isAdmin: boolean;
  seat: { used: number; limit: number; available: number };
  members: Member[];
  invites: Invite[];
  joinLinks: JoinLink[];
  projectCount: number;
  entitlement: {
    planName: string;
    status: string;
    exportsUsed: number;
    exportsLimit: number | null;
    aiGenerationsUsed: number;
    aiGenerationsLimit: number | null;
  };
  recentAudit: AuditRow[];
}

const fmtDate = (iso: string | null): string => (iso ? new Date(iso).toLocaleDateString() : "—");
const eventLabel = (e: string): string => e.replace(/_/g, " ");
const copy = (text: string): void => {
  void navigator.clipboard?.writeText(text);
};

export function WorkspaceAdminScreen({
  workspaceId,
  onOpenBilling
}: {
  workspaceId: string;
  onOpenBilling: () => void;
}) {
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [linkEmailed, setLinkEmailed] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteRole>("member");
  const [linkRole, setLinkRole] = useState<InviteRole>("member");

  const reload = useCallback(async () => {
    setError(null);
    try {
      setData((await loadWorkspaceData(workspaceId)) as unknown as WorkspaceData);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [workspaceId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const act = async (action: string, params: Record<string, unknown>, successMsg?: string): Promise<Record<string, unknown> | null> => {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const res = await workspaceManage(action, { workspaceId, ...params });
      if (successMsg) setNotice(successMsg);
      await reload();
      return res;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  if (error && !data) {
    return (
      <main id="main-content" tabIndex={-1} className="page-shell">
        <div className="empty-state">
          <AlertTriangle size={36} />
          <h2>Couldn't load this workspace</h2>
          <p>{error}</p>
        </div>
      </main>
    );
  }
  if (!data) {
    return (
      <main id="main-content" tabIndex={-1} className="page-shell">
        <p className="blog-muted">Loading workspace…</p>
      </main>
    );
  }

  const { workspace, seat, members, invites, joinLinks, entitlement, recentAudit, projectCount, isAdmin } = data;
  const activeMembers = members.filter((m) => m.status === "active");

  return (
    <main id="main-content" tabIndex={-1} className="page-shell ws-admin">
      <section className="page-heading">
        <div>
          <BrandBadge label="Launchpad" className="dashboard-badge" />
          <h1>{workspace.name}</h1>
          <p>Seats, members, and workspace analytics · {entitlement.planName}</p>
        </div>
        {isAdmin && (
          <button type="button" className="secondary" onClick={onOpenBilling}>
            <CreditCard size={16} /> Manage billing
          </button>
        )}
      </section>

      {notice && <p className="ws-notice ok">{notice}</p>}
      {error && <p className="intake-ai-error">{error}</p>}

      <section className="ws-stat-grid">
        <div className="ws-stat">
          <span className="ws-stat-icon cyan"><Users size={18} /></span>
          <strong>{seat.used} / {seat.limit}</strong>
          <span>Seats used</span>
        </div>
        <div className="ws-stat">
          <span className="ws-stat-icon pink"><Mail size={18} /></span>
          <strong>{invites.length}</strong>
          <span>Pending invites</span>
        </div>
        <div className="ws-stat">
          <span className="ws-stat-icon orange"><Rocket size={18} /></span>
          <strong>{projectCount}</strong>
          <span>Workspace projects</span>
        </div>
        <div className="ws-stat">
          <span className="ws-stat-icon violet"><ShieldCheck size={18} /></span>
          <strong>
            {entitlement.exportsUsed}
            {entitlement.exportsLimit !== null ? ` / ${entitlement.exportsLimit}` : ""}
          </strong>
          <span>Exports this period</span>
        </div>
      </section>

      {isAdmin && (
        <section className="overview-card">
          <header className="overview-card-head">
            <span className="hp-eyebrow"><UserPlus size={14} /> Invite a member</span>
          </header>
          <div className="ws-invite-row">
            <input
              type="email"
              placeholder="name@school.edu"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as InviteRole)}>
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
            <button
              type="button"
              className="primary"
              disabled={busy || !inviteEmail.includes("@")}
              onClick={async () => {
                const target = inviteEmail;
                const res = await act("invite", { email: inviteEmail, role: inviteRole });
                if (res?.inviteLink) {
                  setGeneratedLink(res.inviteLink as string);
                  setLinkEmailed(Boolean(res.emailed));
                  setNotice(res.emailed ? `Invite emailed to ${target}.` : "Invite created — share the link below.");
                  setInviteEmail("");
                }
              }}
            >
              {busy ? <Loader2 size={15} className="spin" /> : <Mail size={15} />} Send invite
            </button>
          </div>
          {generatedLink && (
            <div className="ws-link-out">
              <span>{linkEmailed ? "Invite emailed. You can also share this link directly:" : "Share this link directly:"}</span>
              <code>{generatedLink}</code>
              <button type="button" className="ghost-button" onClick={() => copy(generatedLink)}>
                <Copy size={14} /> Copy
              </button>
            </div>
          )}
        </section>
      )}

      <section className="overview-card">
        <header className="overview-card-head">
          <span className="hp-eyebrow"><Users size={14} /> Members ({activeMembers.length})</span>
        </header>
        <div className="ws-table-wrap">
          <table className="ws-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                {isAdmin && <th aria-label="Actions" />}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const isOwner = m.userId === workspace.ownerId;
                return (
                  <tr key={m.userId} className={m.status !== "active" ? "ws-row-dim" : ""}>
                    <td>
                      <div className="ws-member">
                        <LogoMark size={26} decorative />
                        <div>
                          <strong>{m.fullName || m.email || m.userId.slice(0, 8)}</strong>
                          {m.email && <small>{m.email}</small>}
                        </div>
                      </div>
                    </td>
                    <td>
                      {isAdmin && !isOwner ? (
                        <select
                          value={ASSIGNABLE_ROLES.includes(m.role as InviteRole) ? m.role : "member"}
                          disabled={busy}
                          onChange={(e) => void act("changeRole", { memberUserId: m.userId, role: e.target.value }, "Role updated.")}
                        >
                          {ASSIGNABLE_ROLES.map((r) => (
                            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="ws-role-tag">{ROLE_LABELS[m.role]}</span>
                      )}
                    </td>
                    <td>
                      <span className={`ws-status ${m.status}`}>{m.status}</span>
                    </td>
                    <td>{fmtDate(m.joinedAt)}</td>
                    {isAdmin && (
                      <td className="ws-actions">
                        {!isOwner && m.status === "active" && (
                          <button
                            type="button"
                            className="ghost-button danger"
                            disabled={busy}
                            onClick={() => void act("removeMember", { memberUserId: m.userId }, "Member removed.")}
                          >
                            <Trash2 size={14} /> Remove
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {isAdmin && invites.length > 0 && (
        <section className="overview-card">
          <header className="overview-card-head">
            <span className="hp-eyebrow"><Mail size={14} /> Pending invites</span>
          </header>
          <ul className="ws-invite-list">
            {invites.map((inv) => (
              <li key={inv.id}>
                <span>
                  <strong>{inv.email}</strong> · {ROLE_LABELS[(inv.role as WorkspaceRole) ?? "member"]} · expires {fmtDate(inv.expires_at)}
                </span>
                <span className="ws-invite-actions">
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={busy}
                    onClick={async () => {
                      const res = await act("resendInvite", { inviteId: inv.id });
                      if (res?.inviteLink) {
                        setGeneratedLink(res.inviteLink as string);
                        setLinkEmailed(Boolean(res.emailed));
                        setNotice(res.emailed ? `Invite re-emailed to ${inv.email}.` : "Invite link refreshed — share it below.");
                      }
                    }}
                  >
                    <RefreshCw size={13} /> Resend
                  </button>
                  <button type="button" className="ghost-button danger" disabled={busy} onClick={() => void act("revokeInvite", { inviteId: inv.id }, "Invite revoked.")}>
                    <Trash2 size={13} /> Revoke
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isAdmin && (
        <section className="overview-card">
          <header className="overview-card-head">
            <span className="hp-eyebrow"><Link2 size={14} /> Join links</span>
          </header>
          <div className="ws-invite-row">
            <select value={linkRole} onChange={(e) => setLinkRole(e.target.value as InviteRole)}>
              {(["member", "editor", "reviewer"] as InviteRole[]).map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={async () => {
                const res = await act("createJoinLink", { defaultRole: linkRole }, "Join link created.");
                if (res?.joinLink) {
                  setGeneratedLink(res.joinLink as string);
                  setLinkEmailed(false);
                }
              }}
            >
              <Link2 size={15} /> Create join link
            </button>
          </div>
          {joinLinks.filter((l) => l.is_active).length > 0 && (
            <ul className="ws-invite-list">
              {joinLinks
                .filter((l) => l.is_active)
                .map((l) => (
                  <li key={l.id}>
                    <span>
                      {ROLE_LABELS[(l.default_role as WorkspaceRole) ?? "member"]} · used {l.used_count}
                      {l.max_uses ? ` / ${l.max_uses}` : ""} · created {fmtDate(l.created_at)}
                    </span>
                    <button type="button" className="ghost-button danger" disabled={busy} onClick={() => void act("revokeJoinLink", { linkId: l.id }, "Join link revoked.")}>
                      <Trash2 size={13} /> Revoke
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </section>
      )}

      {isAdmin && recentAudit.length > 0 && (
        <section className="overview-card">
          <header className="overview-card-head">
            <span className="hp-eyebrow"><ShieldCheck size={14} /> Recent activity</span>
          </header>
          <ul className="ws-audit">
            {recentAudit.map((a) => (
              <li key={a.id}>
                <span className="ws-audit-event">{eventLabel(a.event_type)}</span>
                <span className="ws-audit-meta">
                  {a.actor_email ?? "system"} · {new Date(a.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
