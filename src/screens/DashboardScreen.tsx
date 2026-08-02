// Dashboard — extracted from App.tsx. Renders the user's saved projects with
// per-project readiness scores.

import { useState, type ReactNode } from "react";
import { AlertTriangle, ArrowRight, BookOpen, CreditCard, FileArchive, Gauge, Plus, RefreshCw } from "lucide-react";
import type { AuthSessionState } from "../auth/useAuthSession";
import { BrandBadge } from "../components/brand";
import { EmptyState } from "../components/form";
import { buildReadinessReport } from "../services/readiness";
import type { ProjectSummary } from "../services/projectStore";
import { buildCourseTileSvg } from "../services/themeDesign";
import type { CourseProject } from "../types";

import { formatDate } from "./appModel";

export function Dashboard({
  projects,
  summaries = [],
  entitlement,
  onCreate,
  onPricing,
  onRefreshStatus,
  onBillingPortal,
  billingError,
  onOpen
}: {
  projects: CourseProject[];
  /** Lightweight rows shown while the full project payloads download. */
  summaries?: ProjectSummary[];
  entitlement: AuthSessionState["entitlement"];
  onCreate: () => void;
  onPricing: () => void;
  onRefreshStatus: () => Promise<void>;
  onBillingPortal: () => void;
  billingError?: string | null;
  /** Opens the project in its last-used experience (resolved by the app). */
  onOpen: (project: CourseProject) => void;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const fmtLimit = (used: number, remaining: number | null): string =>
    remaining === null ? `${used} used · unlimited` : `${remaining} of ${used + remaining} left`;
  // Visual meter that turns amber near the limit and red when exhausted, so users
  // aren't surprised mid-build by running out of generations or exports.
  const usageMeter = (used: number, remaining: number | null): ReactNode => {
    if (remaining === null) return null;
    const total = used + remaining;
    const pct = total === 0 ? 0 : Math.round((used / total) * 100);
    const level = remaining === 0 ? "empty" : used / total >= 0.75 ? "low" : "ok";
    return (
      <span className={`usage-meter ${level}`} aria-hidden="true">
        <i style={{ width: `${pct}%` }} />
      </span>
    );
  };
  const refresh = async (): Promise<void> => {
    setRefreshing(true);
    try {
      await onRefreshStatus();
    } finally {
      setRefreshing(false);
    }
  };
  return (
    <main id="main-content" tabIndex={-1} className="dashboard page-shell">
      <section className="page-heading">
        <div>
          <BrandBadge className="dashboard-badge" />
          <h1>Dashboard</h1>
          <p>Your projects, exports, plan, and usage.</p>
        </div>
        <button className="primary" onClick={onCreate} disabled={!entitlement.canCreateProject} title={entitlement.canCreateProject ? "Create a new course" : "Upgrade to create private courses"}>
          <Plus size={18} /> Create new course
        </button>
      </section>

      {/* Plan + usage panel — driven by the trusted subscription snapshot */}
      <section className={`plan-panel ${entitlement.active ? "active" : "free"}`}>
        <div className="plan-panel-main">
          <span className="hp-eyebrow">
            <CreditCard size={14} /> {entitlement.active ? "Active plan" : "No active plan"}
          </span>
          <h2>{entitlement.planName}</h2>
          <p>
            {entitlement.active
              ? entitlement.currentPeriodEnd
                ? `Access through ${new Date(entitlement.currentPeriodEnd).toLocaleDateString()}`
                : "Active subscription"
              : "Choose a plan to generate and export private Canvas courses."}
          </p>
        </div>
        <div className="plan-usage">
          <div>
            <strong>{entitlement.aiGenerationsLimit === null ? "Unlimited" : fmtLimit(entitlement.aiGenerationsUsed, entitlement.aiGenerationsRemaining)}</strong>
            <span>AI generations</span>
            {usageMeter(entitlement.aiGenerationsUsed, entitlement.aiGenerationsRemaining)}
          </div>
          <div>
            <strong>{entitlement.exportsLimit === null ? "Unlimited" : fmtLimit(entitlement.exportsUsed, entitlement.exportsRemaining)}</strong>
            <span>Exports</span>
            {usageMeter(entitlement.exportsUsed, entitlement.exportsRemaining)}
          </div>
        </div>
        <div className="plan-panel-actions">
          <button className="secondary" onClick={onPricing}>
            {entitlement.active ? "Change plan" : "View pricing"}
          </button>
          {entitlement.active && (
            <button className="ghost-button" onClick={onBillingPortal} title="Manage payment method, invoices, cancellation">
              <CreditCard size={15} /> Billing portal
            </button>
          )}
          <button className="ghost-button" onClick={refresh} disabled={refreshing} title="Re-check subscription status (after checkout)">
            <RefreshCw size={15} className={refreshing ? "spin" : ""} /> Refresh status
          </button>
        </div>
        {billingError && (
          <p className="intake-ai-error" role="alert" style={{ marginTop: 12 }}>
            <AlertTriangle size={15} /> {billingError}
          </p>
        )}
      </section>

      <section className="dashboard-grid">
        <div className="stat-panel">
          <span className="stat-icon">
            <BookOpen size={20} />
          </span>
          <span>{projects.length || summaries.length}</span>
          <p>Course projects</p>
        </div>
        <div className="stat-panel pink">
          <span className="stat-icon">
            <FileArchive size={20} />
          </span>
          <span>{projects.reduce((sum, project) => sum + project.exportHistory.length, 0)}</span>
          <p>Validated exports</p>
        </div>
        <div className="stat-panel orchid">
          <span className="stat-icon">
            <Gauge size={20} />
          </span>
          <span>{projects.length ? Math.round(projects.reduce((sum, project) => sum + buildReadinessReport(project).score, 0) / projects.length) : summaries.length ? Math.round(summaries.reduce((sum, item) => sum + item.readinessScore, 0) / summaries.length) : 0}%</span>
          <p>Avg readiness</p>
        </div>
      </section>
      {projects.length === 0 && summaries.length > 0 ? (
        <section className="project-list" aria-label="Course projects loading">
          {summaries.map((item) => (
            <div key={item.id} className="project-row">
              <div className="project-open project-open--loading" aria-label={`${item.title.trim() || "Untitled course"} — loading`}>
                <span className="project-main">
                  <span className="project-glyph project-tile" aria-hidden="true">
                    <BookOpen size={20} />
                  </span>
                  <span>
                    <strong>{item.title.trim() || "Untitled course"}</strong>
                    <small>Loading course… • updated {formatDate(item.updatedAt)}</small>
                  </span>
                </span>
                <span className="project-meta">
                  <span className="readiness-mini" title={`Readiness ${item.readinessScore}%`}>
                    <span className="bar" aria-hidden="true">
                      <i style={{ width: `${item.readinessScore}%` }} />
                    </span>
                    {item.readinessScore}%
                  </span>
                  <span className={`status-pill ${item.status}`}>{item.status}</span>
                </span>
              </div>
            </div>
          ))}
        </section>
      ) : projects.length === 0 ? (
        <EmptyState title="No course projects yet" body="Start a new RocketCourse build to see it here with readiness and export status." />
      ) : (
        <section className="project-list" aria-label="Course projects">
          {projects.map((project) => {
            const score = buildReadinessReport(project).score;
            return (
              <div key={project.id} className="project-row">
                <button className="project-open" onClick={() => onOpen(project)} aria-label={`Open ${project.title.trim() || "Untitled course"}`}>
                  <span className="project-main">
                    <span className="project-glyph project-tile" aria-hidden="true">
                      {project.theme ? (
                        <img
                          src={`data:image/svg+xml;utf8,${encodeURIComponent(buildCourseTileSvg(project.title, project.theme))}`}
                          alt=""
                          style={{ display: "block", objectFit: "cover" }}
                        />
                      ) : (
                        <BookOpen size={20} />
                      )}
                    </span>
                    <span>
                      <strong>{project.title.trim() || "Untitled course"}</strong>
                      <small>
                        {project.modules.length} modules • {project.assignments.length} assignments • updated {formatDate(project.updatedAt)}
                      </small>
                    </span>
                  </span>
                  <span className="project-meta">
                    <span className="readiness-mini" title={`Readiness ${score}%`}>
                      <span className="bar" aria-hidden="true">
                        <i style={{ width: `${score}%` }} />
                      </span>
                      {score}%
                    </span>
                    <span className={`status-pill ${project.status}`}>{project.status}</span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </span>
                </button>
              </div>
            );
          })}
        </section>
      )}
    </main>
  );
}
