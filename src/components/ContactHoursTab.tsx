import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Clock, Gauge, RefreshCw, Scale, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { CourseProject, EditorTab } from "../types";
import {
  actualWorkloadEstimate,
  contactHoursBreakdown,
  contactHoursIssues,
  contactHoursSummary,
  recalculateContactHours,
  updateContactHour,
  updateJustification
} from "../services/contactHoursSummary";
import { aiGenerateContactHoursJustification } from "../services/aiBuilders";
import { useAiAction } from "../hooks/useAiAction";
import { AiGenerateButton, AiSourceNote } from "./AiGenerateButton";

type UpdateCourse = (updater: (current: CourseProject) => CourseProject) => void;

const variance = (actual: number, plan: number): { label: string; tone: "ok" | "warn" } => {
  if (plan <= 0) return { label: "no plan", tone: "warn" };
  const pct = Math.round(((actual - plan) / plan) * 100);
  return { label: `${pct > 0 ? "+" : ""}${pct}%`, tone: Math.abs(pct) <= 25 ? "ok" : "warn" };
};

export function ContactHoursTab({
  course,
  onUpdateCourse,
  onJumpToTab
}: {
  course: CourseProject;
  onUpdateCourse: UpdateCourse;
  onJumpToTab: (tab: EditorTab) => void;
}) {
  const summary = contactHoursSummary(course);
  const breakdown = contactHoursBreakdown(course);
  const issues = contactHoursIssues(course);
  const actual = actualWorkloadEstimate(course);
  const [confirmRecalc, setConfirmRecalc] = useState(false);
  const ai = useAiAction();

  const generateJustification = (): void => {
    void ai.run(
      () => aiGenerateContactHoursJustification(course),
      (justification) => onUpdateCourse((current) => updateJustification(current, justification))
    );
  };

  const planTotalVariance = variance(actual.moduleWorkload, summary.totalHours);
  const assignmentVariance = variance(actual.assignmentEstimate, course.contactHours.assignmentTime);

  const metrics: Array<{ label: string; value: string; tone?: "ok" | "warn" | "danger" }> = [
    { label: "Total hours", value: `${summary.totalHours}h`, tone: summary.totalHours > 0 ? (summary.status === "Balanced" ? "ok" : "warn") : "danger" },
    { label: "Hours / credit", value: summary.creditHours > 0 ? `${summary.hoursPerCredit}` : "—", tone: summary.creditHours > 0 && Math.abs(summary.hoursPerCredit - 45) <= 11 ? "ok" : "warn" },
    { label: "Hours / week", value: summary.totalHours > 0 ? `${summary.perWeek}` : "—", tone: summary.perWeek >= 3 && summary.perWeek <= 25 ? "ok" : "warn" },
    { label: "Weeks", value: String(summary.weeks) },
    { label: "Credit hours", value: String(summary.creditHours || "—") },
    { label: "vs expected", value: summary.creditHours > 0 ? `${summary.variancePct > 0 ? "+" : ""}${summary.variancePct}%` : "—", tone: Math.abs(summary.variancePct) <= 25 ? "ok" : "warn" }
  ];

  return (
    <div className="overview contact-hours">
      <section className="overview-hero">
        <div>
          <span className="hp-eyebrow">
            <Clock size={14} /> Workload command center
          </span>
          <h2>Contact Hours</h2>
          <p>Plan student workload across instruction, reading, assignments, discussions, quizzes, and the final project — and check it against the credit-hour expectation and the work you actually generated.</p>
        </div>
        <div className={`overview-health ${summary.status === "Balanced" ? "ready" : summary.status === "Missing" ? "blocked" : "review"}`}>
          {summary.status === "Balanced" ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          <strong>{summary.totalHours}h</strong>
          <span>{summary.status}</span>
        </div>
      </section>

      <section className="overview-card" aria-label="Workload snapshot">
        <header className="overview-card-head">
          <span className="hp-eyebrow">
            <Scale size={14} /> Workload snapshot
          </span>
          <div className="overview-head-actions">
            <span className={`overview-pill ${summary.sumsMatch ? "ok" : "warn"}`}>Categories {summary.categorySum}h / {summary.totalHours}h</span>
            <button type="button" className="secondary" onClick={() => setConfirmRecalc(true)} disabled={!summary.creditHours}>
              <RefreshCw size={15} /> Recalculate from credit hours
            </button>
          </div>
        </header>

        {confirmRecalc && (
          <div className="outcome-delete-confirm">
            <AlertTriangle size={15} />
            <p>
              Reset all six categories and the justification to the standard model (~{summary.expectedTotal}h for {summary.creditHours} credits)? This overwrites manual edits.
            </p>
            <button
              type="button"
              className="small-button danger"
              onClick={() => {
                onUpdateCourse((current) => recalculateContactHours(current));
                setConfirmRecalc(false);
              }}
            >
              Recalculate
            </button>
            <button type="button" className="small-button" onClick={() => setConfirmRecalc(false)}>
              Cancel
            </button>
          </div>
        )}

        <div className="overview-metric-grid">
          {metrics.map((metric) => (
            <div className={`gradebook-metric ${metric.tone ?? ""}`} key={metric.label}>
              <strong>{metric.value}</strong>
              <span>{metric.label}</span>
            </div>
          ))}
        </div>

        {summary.totalHours > 0 && (
          <div className="weight-bar" role="img" aria-label={`Workload distribution across ${breakdown.length} categories`}>
            {breakdown.map((category, index) => (
              <span key={category.key} className={`weight-seg seg-${index % 6} ${category.hours === 0 ? "empty" : ""}`} style={{ width: `${category.pct}%` }} title={`${category.label}: ${category.hours}h (${category.pct}%)`}>
                {category.pct >= 9 ? `${category.pct}%` : ""}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="overview-card" aria-label="Plan versus generated work">
        <header className="overview-card-head">
          <span className="hp-eyebrow">
            <CalendarClock size={14} /> Plan vs generated work
          </span>
        </header>
        <ul className="export-signals">
          <li className={planTotalVariance.tone}>
            <span>Module workload total vs plan</span>
            <strong>
              {actual.moduleWorkload}h / {summary.totalHours}h <em className="compare-delta">{planTotalVariance.label}</em>
            </strong>
          </li>
          <li className={assignmentVariance.tone}>
            <span>Generated assignment estimate vs assignment time</span>
            <strong>
              {actual.assignmentEstimate}h / {course.contactHours.assignmentTime}h <em className="compare-delta">{assignmentVariance.label}</em>
            </strong>
          </li>
        </ul>
        <p className="overview-empty contact-hint">Module workload comes from the Modules tab; assignment estimates come from each assignment. Large gaps suggest the plan and the generated work disagree.</p>
      </section>

      {issues.length > 0 && (
        <section className="overview-card" aria-label="Workload issues">
          <header className="overview-card-head">
            <span className="hp-eyebrow">
              <ShieldCheck size={14} /> Needs attention
            </span>
            <span className={`overview-pill ${issues.some((issue) => issue.severity === "error") ? "danger" : "warn"}`}>
              {issues.length} issue{issues.length === 1 ? "" : "s"}
            </span>
          </header>
          <div className="gradebook-issue-list">
            {issues.map((issue) => (
              <button type="button" className={`health-item jump ${issue.severity === "error" ? "danger" : "warn"}`} key={issue.id} onClick={() => onJumpToTab(issue.tab)} title={issue.detail}>
                <span>
                  <strong>{issue.title}.</strong> {issue.detail}
                </span>
                <small>
                  {issue.tab} <ArrowRight size={12} />
                </small>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="overview-card" aria-label="Workload categories">
        <header className="overview-card-head">
          <span className="hp-eyebrow">
            <Gauge size={14} /> Workload categories
          </span>
          <span className="overview-pill ok">{summary.categorySum}h planned</span>
        </header>
        <p className="overview-empty">
          Hours are what you edit — the percentage next to each category recalculates automatically from the total.
        </p>
        <div className="contact-cat-list">
          {breakdown.map((category) => (
            <article className="contact-cat-row" key={category.key}>
              <div className="contact-cat-info">
                <strong>{category.label}</strong>
                <small>{category.note}</small>
              </div>
              <label className="overview-field contact-cat-hours">
                <span className="sr-only">{category.label} hours</span>
                <div className="suffix-input">
                  <input type="number" min={0} max={500} value={category.hours} aria-label={`${category.label} hours`} onChange={(event) => onUpdateCourse((current) => updateContactHour(current, category.key, Number(event.target.value)))} />
                  <small>h</small>
                </div>
              </label>
              <span className="outcome-chip">{category.pct}%</span>
              <button type="button" className="small-button" onClick={() => onJumpToTab(category.tab)}>
                {category.tab} <ArrowRight size={12} />
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="overview-card" aria-label="Workload justification">
        <header className="overview-card-head">
          <span className="hp-eyebrow">
            <ShieldCheck size={14} /> Workload justification
          </span>
          <AiGenerateButton running={ai.running} onClick={generateJustification} label="Draft justification" busyLabel="Drafting…" />
        </header>
        <label className="overview-field">
          <span>How the workload was estimated (shown in the syllabus)</span>
          <textarea rows={4} value={course.contactHours.justification} onChange={(event) => onUpdateCourse((current) => updateJustification(current, event.target.value))} placeholder="Explain how the workload hours were estimated…" />
        </label>
        <AiSourceNote running={ai.running} error={ai.error} status={ai.status} />
      </section>
    </div>
  );
}
