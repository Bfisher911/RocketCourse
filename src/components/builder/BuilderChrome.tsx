// Shared chrome for the builder tabs (Assignments, Discussions, Quizzes, Rubrics,
// Pages). These tabs were built from one cloned skeleton with per-tab class prefixes
// (assignment-*, discussion-*, quiz-*, …); each shared component takes that `prefix`
// and emits the tab's EXISTING class names, so the CSS and rendered markup stay
// byte-identical while the JSX is defined once. First slice of the "one editing
// pattern" unification — toolbar and list/detail layout are the next candidates.

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";

export function BuilderHero({
  prefix,
  eyebrow,
  title,
  description,
  action,
  score,
  status,
  badgeIconSize = 20
}: {
  prefix: string;
  /** Full eyebrow node — tabs differ (hp-eyebrow with icon vs plain .eyebrow text). */
  eyebrow: ReactNode;
  title: string;
  description: string;
  /** Right-side action button (used by empty states instead of the readiness badge). */
  action?: ReactNode;
  /** Together with `status`, renders the readiness badge. */
  score?: number;
  status?: string;
  badgeIconSize?: number;
}) {
  return (
    <section className={`${prefix}-hero`}>
      <div>
        {eyebrow}
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action}
      {score !== undefined && status !== undefined && (
        <div className={`${prefix}-readiness ${status === "Ready" ? "ready" : "review"}`}>
          {status === "Ready" ? <CheckCircle2 size={badgeIconSize} /> : <AlertTriangle size={badgeIconSize} />}
          <strong>{score}%</strong>
          <span>{status}</span>
        </div>
      )}
    </section>
  );
}

export interface BuilderMetric {
  label: string;
  value: ReactNode;
  warn?: boolean;
  /** Optional hover hint (e.g. Pages' "Front page: Not set" cell explains how to fix it). */
  title?: string;
}

export function BuilderMetricGrid({
  prefix,
  metrics,
  ariaLabel
}: {
  prefix: string;
  metrics: BuilderMetric[];
  ariaLabel?: string;
}) {
  return (
    <section className={`${prefix}-metric-grid`} aria-label={ariaLabel}>
      {metrics.map((metric) => (
        <div key={metric.label} className={metric.warn ? "warn" : ""} title={metric.title}>
          <strong>{metric.value}</strong>
          <span>{metric.label}</span>
        </div>
      ))}
    </section>
  );
}
