import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  Gauge,
  HelpCircle,
  Layers,
  LayoutDashboard,
  ListChecks,
  MessagesSquare,
  Palette,
  Plus,
  ShieldCheck,
  Target,
  Trash2
} from "lucide-react";
import { useMemo, useState } from "react";
import type { CourseOutcome, CourseProject, EditorTab } from "../types";
import {
  addOutcome,
  buildOverviewModel,
  deleteOutcome,
  isOrphanOutcome,
  moveOutcome,
  outcomeAlignment,
  outcomeIsMeasurable,
  outcomeTag,
  updateOutcome,
  type DesignCheckStatus
} from "../services/overviewSummary";
import { getOutcomeFramework } from "../services/outcomeFrameworks";
import { aiGenerateCourseOverview } from "../services/aiBuilders";
import { useAiAction } from "../hooks/useAiAction";
import { AiGenerateButton, AiSourceNote } from "./AiGenerateButton";

type UpdateCourse = (updater: (current: CourseProject) => CourseProject) => void;

const formatDate = (iso?: string): string => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const titleCase = (value: string): string => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value);

const statusTone = (status: DesignCheckStatus): string => (status === "pass" ? "ok" : status === "warn" ? "warn" : "danger");

export function OverviewTab({
  course,
  onUpdateCourse,
  onJumpToTab
}: {
  course: CourseProject;
  onUpdateCourse: UpdateCourse;
  onJumpToTab: (tab: EditorTab) => void;
}) {
  const model = useMemo(() => buildOverviewModel(course), [course]);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const ai = useAiAction();

  const generateOverview = (): void => {
    void ai.run(
      () => aiGenerateCourseOverview(course),
      (draft) => onUpdateCourse((current) => ({ ...current, description: draft.description, updatedAt: new Date().toISOString() }))
    );
  };

  const { structure, health, exportReadiness, designChecks, alignment } = model;
  const orphanCount = exportReadiness.orphanedOutcomes;

  const structureTiles: Array<{ label: string; value: number; tab: EditorTab; icon: typeof BookOpen }> = [
    { label: "Modules", value: structure.modules, tab: "Modules", icon: Layers },
    { label: "Pages", value: structure.pages, tab: "Pages", icon: FileText },
    { label: "Assignments", value: structure.assignments, tab: "Assignments", icon: ClipboardList },
    { label: "Discussions", value: structure.discussions, tab: "Discussions", icon: MessagesSquare },
    { label: "Quizzes", value: structure.quizzes, tab: "Quizzes", icon: HelpCircle },
    { label: "Rubrics", value: structure.rubrics, tab: "Rubrics", icon: ListChecks },
    { label: "Grade groups", value: structure.assignmentGroups, tab: "Gradebook Setup", icon: Gauge },
    { label: "Contact hours", value: structure.contactHours, tab: "Contact Hours", icon: Clock }
  ];

  const identityMeta: Array<{ label: string; value: string }> = [
    { label: "Level", value: course.settings.level || "—" },
    { label: "Modality", value: course.settings.modality || "—" },
    { label: "Credit hours", value: String(course.settings.creditHours ?? "—") },
    { label: "Length", value: `${course.settings.lengthWeeks || structure.contentModules} weeks` },
    { label: "Modules", value: String(structure.modules) },
    { label: "Status", value: titleCase(course.status) },
    { label: "Updated", value: formatDate(course.updatedAt) }
  ];

  const removeOutcome = (outcomeId: string): void => {
    onUpdateCourse((current) => deleteOutcome(current, outcomeId));
    setPendingDeleteId(null);
  };

  return (
    <div className="overview">
      <section className="overview-hero">
        <div>
          <span className="hp-eyebrow">
            <LayoutDashboard size={14} /> Course command center
          </span>
          <h2>{course.title || "Untitled course"}</h2>
          <p>Manage course identity, outcomes, structure, and readiness from one place — then jump straight to the tab that needs attention.</p>
        </div>
        <button
          type="button"
          className={`overview-health ${exportReadiness.status === "Ready" ? "ready" : exportReadiness.status === "Blocked" ? "blocked" : "review"}`}
          onClick={() => onJumpToTab("Export")}
        >
          {exportReadiness.status === "Ready" ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          <strong>{health.score}%</strong>
          <span>{exportReadiness.status}</span>
        </button>
      </section>

      <section className="overview-card identity-card" aria-label="Course identity">
        <header className="overview-card-head">
          <span className="hp-eyebrow">
            <BookOpen size={14} /> Course identity
          </span>
          <AiGenerateButton running={ai.running} onClick={generateOverview} label="Draft description with AI" busyLabel="Drafting…" />
        </header>
        <label className="overview-field">
          <span>Course title</span>
          <input
            value={course.title}
            onChange={(event) => onUpdateCourse((current) => ({ ...current, title: event.target.value, settings: { ...current.settings, title: event.target.value }, updatedAt: new Date().toISOString() }))}
            placeholder="Course title"
          />
        </label>
        <label className="overview-field">
          <span>Description</span>
          <textarea
            rows={3}
            value={course.description}
            onChange={(event) => onUpdateCourse((current) => ({ ...current, description: event.target.value, updatedAt: new Date().toISOString() }))}
            placeholder="A short, student-facing description of the course."
          />
        </label>
        <AiSourceNote running={ai.running} error={ai.error} status={ai.status} />
        <div className="identity-grid">
          {identityMeta.map((meta) => (
            <div className="identity-meta" key={meta.label}>
              <span>{meta.label}</span>
              <strong>{meta.value}</strong>
            </div>
          ))}
          <button type="button" className="identity-meta identity-theme" onClick={() => onJumpToTab("Theme")}>
            <span>
              <Palette size={12} /> Theme
            </span>
            <strong>
              <i style={{ background: course.theme.accent }} aria-hidden="true" /> {course.theme.name}
            </strong>
          </button>
        </div>
      </section>

      <div className="overview-grid">
        <section className="overview-card" aria-label="Readiness snapshot">
          <header className="overview-card-head">
            <span className="hp-eyebrow">
              <ShieldCheck size={14} /> Readiness snapshot
            </span>
            <span className={`overview-pill ${health.blockers ? "danger" : health.warnings ? "warn" : "ok"}`}>
              {health.passed}/{health.total} checks · {health.blockers} blocker{health.blockers === 1 ? "" : "s"}
            </span>
          </header>
          <div className="health-columns">
            <div className="health-list">
              <h4>
                <CheckCircle2 size={14} /> Strengths
              </h4>
              {health.strengths.length === 0 ? (
                <p className="overview-empty">No checks pass yet.</p>
              ) : (
                health.strengths.map((item) => (
                  <div className="health-item ok" key={item.id}>
                    <span>{item.label}</span>
                  </div>
                ))
              )}
            </div>
            <div className="health-list">
              <h4>
                <AlertTriangle size={14} /> Needs attention
              </h4>
              {health.attention.length === 0 ? (
                <p className="overview-empty">Everything checks out. 🎉</p>
              ) : (
                health.attention.map((item) => (
                  <button type="button" className={`health-item jump ${item.severity === "required" ? "danger" : "warn"}`} key={item.id} onClick={() => onJumpToTab(item.tab)} title={item.detail}>
                    <span>{item.label}</span>
                    <small>
                      {item.tab} <ArrowRight size={12} />
                    </small>
                  </button>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="overview-card" aria-label="Export readiness">
          <header className="overview-card-head">
            <span className="hp-eyebrow">
              <Gauge size={14} /> Export readiness
            </span>
            <span className={`overview-pill ${exportReadiness.status === "Ready" ? "ok" : exportReadiness.status === "Blocked" ? "danger" : "warn"}`}>{exportReadiness.status}</span>
          </header>
          <ul className="export-signals">
            <li className={exportReadiness.gradeWeightOk ? "ok" : "danger"}>
              <span>Grade weights total</span>
              <strong>{exportReadiness.gradeWeightTotal}%</strong>
            </li>
            <li className={orphanCount === 0 ? "ok" : "warn"}>
              <span>Orphaned outcomes</span>
              <strong>{orphanCount}</strong>
            </li>
            <li className={exportReadiness.referencesResolve ? "ok" : "danger"}>
              <span>References resolve</span>
              <strong>{exportReadiness.referencesResolve ? "Yes" : "No"}</strong>
            </li>
            <li className={exportReadiness.unsafeHtmlClean ? "ok" : "danger"}>
              <span>Unsafe HTML</span>
              <strong>{exportReadiness.unsafeHtmlClean ? "None" : "Found"}</strong>
            </li>
            <li className={exportReadiness.warnings === 0 ? "ok" : "warn"}>
              <span>Open warnings</span>
              <strong>{exportReadiness.warnings}</strong>
            </li>
          </ul>
          <button type="button" className="secondary overview-jump-wide" onClick={() => onJumpToTab("Export")}>
            Review & export <ArrowRight size={15} />
          </button>
        </section>
      </div>

      <section className="overview-card" aria-label="Course structure">
        <header className="overview-card-head">
          <span className="hp-eyebrow">
            <Layers size={14} /> Course structure
          </span>
        </header>
        <div className="overview-metric-grid">
          {structureTiles.map((tile) => {
            const Icon = tile.icon;
            return (
              <button type="button" key={tile.label} onClick={() => onJumpToTab(tile.tab)}>
                <Icon size={15} />
                <strong>{tile.value}</strong>
                <span>{tile.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="overview-card outcome-manager" aria-label="Learning outcomes">
        <header className="overview-card-head">
          <span className="hp-eyebrow">
            <Target size={14} /> Learning outcomes
          </span>
          <div className="overview-head-actions">
            {orphanCount > 0 && (
              <span className="overview-pill warn">
                {orphanCount} orphaned outcome{orphanCount === 1 ? "" : "s"}
              </span>
            )}
            <span className="overview-pill ok">{course.outcomes.length} total</span>
            <button type="button" className="secondary" onClick={() => onUpdateCourse((current) => addOutcome(current))}>
              <Plus size={15} /> Add outcome
            </button>
          </div>
        </header>

        {course.outcomes.length === 0 ? (
          <p className="overview-empty">No outcomes yet. Add your first measurable learning outcome to anchor the course.</p>
        ) : (
          <div className="outcome-list">
            {course.outcomes.map((outcome, index) => {
              const alignment = outcomeAlignment(course, outcome.id);
              const orphan = isOrphanOutcome(course, outcome);
              const measurable = outcomeIsMeasurable(outcome);
              const levelOptions = getOutcomeFramework(course.settings.outcomeFramework).levels.map((level) => level.label);
              return (
                <article className={`outcome-row ${orphan ? "orphan" : ""}`} key={outcome.id}>
                  <div className="outcome-row-head">
                    <input
                      className="outcome-code"
                      value={outcome.code}
                      aria-label="Outcome code"
                      onChange={(event) => onUpdateCourse((current) => updateOutcome(current, outcome.id, { code: event.target.value }))}
                    />
                    <select
                      className="outcome-bloom"
                      value={outcome.bloomLevel}
                      aria-label="Outcome level"
                      onChange={(event) => onUpdateCourse((current) => updateOutcome(current, outcome.id, { bloomLevel: event.target.value }))}
                    >
                      {!levelOptions.includes(outcome.bloomLevel) && outcome.bloomLevel && <option value={outcome.bloomLevel}>{outcome.bloomLevel}</option>}
                      {levelOptions.map((level) => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      ))}
                    </select>
                    <div className="outcome-row-actions">
                      <button type="button" className="icon-button" aria-label="Move outcome up" disabled={index === 0} onClick={() => onUpdateCourse((current) => moveOutcome(current, outcome.id, "up"))}>
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="Move outcome down"
                        disabled={index === course.outcomes.length - 1}
                        onClick={() => onUpdateCourse((current) => moveOutcome(current, outcome.id, "down"))}
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button type="button" className="icon-button danger" aria-label="Delete outcome" onClick={() => setPendingDeleteId(outcome.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <textarea
                    className="outcome-text"
                    rows={2}
                    value={outcome.text}
                    aria-label="Outcome text"
                    placeholder="By the end of this course, students will be able to…"
                    onChange={(event) => onUpdateCourse((current) => updateOutcome(current, outcome.id, { text: event.target.value }))}
                  />

                  <div className="outcome-align">
                    <span className="outcome-chip outcome-tag" title={`Tag for ${outcome.code || "this outcome"} — a human-readable label; alignment uses the code`}>
                      {outcomeTag(outcome)}
                    </span>
                    {orphan && (
                      <span className="outcome-chip danger">
                        <AlertTriangle size={12} /> Orphaned
                      </span>
                    )}
                    {!measurable && outcome.text.trim() && (
                      <span className="outcome-chip warn" title="Lead with an observable action verb (e.g. Analyze, Apply, Evaluate).">
                        Not measurable
                      </span>
                    )}
                    <span className="outcome-chip">{alignment.modules.length} modules</span>
                    <span className="outcome-chip">{alignment.assignments.length} assignments</span>
                    <span className="outcome-chip">{alignment.discussions.length} discussions</span>
                    <span className="outcome-chip">{alignment.quizzes.length} quizzes</span>
                    {alignment.rubricCount > 0 && <span className="outcome-chip">{alignment.rubricCount} rubrics</span>}
                  </div>

                  {pendingDeleteId === outcome.id && (
                    <div className="outcome-delete-confirm">
                      <AlertTriangle size={15} />
                      <p>
                        Delete <strong>{outcome.code || "this outcome"}</strong>? Its alignment will be removed from any assignment, discussion, quiz, or rubric.
                      </p>
                      <button type="button" className="small-button danger" onClick={() => removeOutcome(outcome.id)}>
                        Delete
                      </button>
                      <button type="button" className="small-button" onClick={() => setPendingDeleteId(null)}>
                        Keep
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="overview-card" aria-label="Module and outcome alignment">
        <header className="overview-card-head">
          <span className="hp-eyebrow">
            <Target size={14} /> Module ↔ outcome alignment
          </span>
          <span className="overview-pill ok">{course.modules.length} modules · {course.outcomes.length} outcomes</span>
        </header>
        {course.outcomes.length === 0 ? (
          <p className="overview-empty">Add outcomes to see how each module aligns to them.</p>
        ) : (
          <div className="alignment-matrix">
            {alignment.map((row) => (
              <div className={`alignment-row ${row.isGap ? "gap" : ""}`} key={row.module.id}>
                <div className="alignment-module">
                  <strong>{row.module.title}</strong>
                </div>
                <div className="alignment-outcomes">
                  {row.outcomes.length === 0 ? (
                    <span className={`outcome-chip ${row.isGap ? "warn" : ""}`}>{row.isGap ? "No aligned outcome" : "—"}</span>
                  ) : (
                    row.outcomes.map((outcome) => (
                      <span className="outcome-chip outcome-tag" key={outcome.id} title={`${outcome.code}: ${outcome.text}`}>
                        {outcomeTag(outcome)}
                      </span>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="overview-card" aria-label="Course design checks">
        <header className="overview-card-head">
          <span className="hp-eyebrow">
            <ListChecks size={14} /> Course design checks
          </span>
        </header>
        <div className="design-check-grid">
          {designChecks.map((check) => (
            <button type="button" className={`design-check ${statusTone(check.status)}`} key={check.id} onClick={() => onJumpToTab(check.tab)} title={check.detail}>
              {check.status === "pass" ? <CheckCircle2 size={15} /> : check.status === "warn" ? <ShieldCheck size={15} /> : <AlertTriangle size={15} />}
              <div>
                <strong>{check.label}</strong>
                <small>{check.detail}</small>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
