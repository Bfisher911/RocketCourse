import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Gauge,
  HelpCircle,
  Layers,
  MessagesSquare,
  Plus,
  Scale,
  ShieldCheck,
  Sparkles,
  Trash2
} from "lucide-react";
import { useState } from "react";
import type { CourseProject, EditorTab } from "../types";
import {
  addAssignmentGroup,
  deleteAssignmentGroup,
  gradebookGroupBreakdown,
  gradebookIssues,
  gradebookSummary,
  rebalanceWeights,
  updateAssignmentGroup,
  type GradedItemType
} from "../services/gradebookSummary";

type UpdateCourse = (updater: (current: CourseProject) => CourseProject) => void;

const ITEM_ICON: Record<GradedItemType, typeof ClipboardList> = {
  assignment: ClipboardList,
  discussion: MessagesSquare,
  quiz: HelpCircle
};

const ITEM_TAB: Record<GradedItemType, EditorTab> = {
  assignment: "Assignments",
  discussion: "Discussions",
  quiz: "Quizzes"
};

export function GradebookTab({
  course,
  onUpdateCourse,
  onJumpToTab
}: {
  course: CourseProject;
  onUpdateCourse: UpdateCourse;
  onJumpToTab: (tab: EditorTab) => void;
}) {
  const breakdown = gradebookGroupBreakdown(course);
  const summary = gradebookSummary(course);
  const issues = gradebookIssues(course);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [reassignTargetId, setReassignTargetId] = useState<string>("");

  const openDelete = (groupId: string): void => {
    const firstOther = course.assignmentGroups.find((group) => group.id !== groupId);
    setReassignTargetId(firstOther?.id ?? "");
    setPendingDeleteId(groupId);
  };

  const confirmDelete = (groupId: string): void => {
    onUpdateCourse((current) => deleteAssignmentGroup(current, groupId, reassignTargetId || undefined));
    setPendingDeleteId(null);
  };

  const metrics: Array<{ label: string; value: string; tone?: "ok" | "warn" | "danger" }> = [
    { label: "Weight total", value: `${summary.weightTotal}%`, tone: summary.weightOk ? "ok" : "danger" },
    { label: "Groups", value: String(summary.groupCount) },
    { label: "Active groups", value: String(summary.activeGroupCount) },
    { label: "Graded items", value: String(summary.gradedItemCount) },
    { label: "Points in play", value: String(summary.pointsTotal) },
    { label: "Drop-lowest", value: String(summary.dropLowestGroups) }
  ];

  return (
    <div className="overview gradebook">
      <section className="overview-hero">
        <div>
          <span className="hp-eyebrow">
            <Gauge size={14} /> Gradebook command center
          </span>
          <h2>Gradebook Setup</h2>
          <p>Balance assignment-group weights to 100%, keep every graded item in a weighted group, and tune drop-lowest rules before export.</p>
        </div>
        <div className={`overview-health ${summary.status === "Balanced" ? "ready" : summary.status === "Blocked" ? "blocked" : "review"}`}>
          {summary.status === "Balanced" ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          <strong>{summary.weightTotal}%</strong>
          <span>{summary.status}</span>
        </div>
      </section>

      <section className="overview-card" aria-label="Gradebook snapshot">
        <header className="overview-card-head">
          <span className="hp-eyebrow">
            <Scale size={14} /> Weighting snapshot
          </span>
          <div className="overview-head-actions">
            <button type="button" className="secondary" onClick={() => onUpdateCourse((current) => rebalanceWeights(current))} disabled={course.assignmentGroups.length === 0}>
              <Sparkles size={15} /> Rebalance to 100%
            </button>
            <button type="button" className="secondary" onClick={() => onUpdateCourse((current) => addAssignmentGroup(current))}>
              <Plus size={15} /> Add group
            </button>
          </div>
        </header>
        <div className="overview-metric-grid">
          {metrics.map((metric) => (
            <div className={`gradebook-metric ${metric.tone ?? ""}`} key={metric.label}>
              <strong>{metric.value}</strong>
              <span>{metric.label}</span>
            </div>
          ))}
        </div>
        {course.assignmentGroups.length > 0 && (
          <div className="weight-bar" role="img" aria-label={`Weight distribution totaling ${summary.weightTotal}%`}>
            {breakdown.map((entry, index) => (
              <span
                key={entry.group.id}
                className={`weight-seg seg-${index % 6} ${entry.active ? "" : "empty"}`}
                style={{ width: `${Math.max(0, Math.min(100, Number(entry.group.weight || 0)))}%` }}
                title={`${entry.group.name}: ${entry.group.weight}%`}
              >
                {Number(entry.group.weight || 0) >= 8 ? `${entry.group.weight}%` : ""}
              </span>
            ))}
            {summary.weightTotal < 100 && <span className="weight-seg gap" style={{ width: `${100 - summary.weightTotal}%` }} title={`Unassigned: ${100 - summary.weightTotal}%`} />}
          </div>
        )}
      </section>

      {issues.length > 0 && (
        <section className="overview-card" aria-label="Gradebook issues">
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

      <section className="overview-card" aria-label="Assignment groups">
        <header className="overview-card-head">
          <span className="hp-eyebrow">
            <Layers size={14} /> Assignment groups
          </span>
          <span className="overview-pill ok">{summary.groupCount} groups</span>
        </header>

        {course.assignmentGroups.length === 0 ? (
          <p className="overview-empty">No assignment groups yet. Add a weighted group so graded work counts toward the final grade.</p>
        ) : (
          <div className="grade-group-list">
            {breakdown.map((entry) => {
              const share = summary.weightTotal > 0 ? Math.round((Number(entry.group.weight || 0) / summary.weightTotal) * 100) : 0;
              return (
                <article className={`grade-group-card ${entry.active && Number(entry.group.weight || 0) === 0 ? "warn" : ""}`} key={entry.group.id}>
                  <div className="grade-group-fields">
                    <label className="overview-field grade-group-name">
                      <span>Group name</span>
                      <input value={entry.group.name} onChange={(event) => onUpdateCourse((current) => updateAssignmentGroup(current, entry.group.id, { name: event.target.value }))} />
                    </label>
                    <label className="overview-field grade-group-weight">
                      <span>Weight</span>
                      <div className="suffix-input">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={entry.group.weight}
                          onChange={(event) => onUpdateCourse((current) => updateAssignmentGroup(current, entry.group.id, { weight: Number(event.target.value) }))}
                        />
                        <small>%</small>
                      </div>
                    </label>
                    <label className="overview-field grade-group-drop">
                      <span>Drop lowest</span>
                      <input
                        type="number"
                        min={0}
                        max={Math.max(0, entry.itemCount)}
                        value={entry.group.dropLowest ?? 0}
                        title={`This group has ${entry.itemCount} graded item${entry.itemCount === 1 ? "" : "s"}`}
                        onChange={(event) => {
                          // Clamp typed values — the native max only guards the spinner arrows.
                          const clamped = Math.max(0, Math.min(entry.itemCount, Number(event.target.value) || 0));
                          onUpdateCourse((current) => updateAssignmentGroup(current, entry.group.id, { dropLowest: clamped || undefined }));
                        }}
                      />
                    </label>
                    <button type="button" className="icon-button danger grade-group-delete" aria-label={`Delete ${entry.group.name}`} onClick={() => openDelete(entry.group.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="grade-group-meta">
                    <span className="outcome-chip">
                      {entry.itemCount} item{entry.itemCount === 1 ? "" : "s"}
                    </span>
                    <span className="outcome-chip">{entry.pointsTotal} pts</span>
                    <span className="outcome-chip">{share}% of grade</span>
                    {entry.active && Number(entry.group.weight || 0) === 0 && <span className="outcome-chip danger">Graded but 0%</span>}
                    {!entry.active && Number(entry.group.weight || 0) > 0 && <span className="outcome-chip warn">Empty but weighted</span>}
                  </div>

                  {entry.items.length > 0 && (
                    <div className="grade-group-items">
                      {entry.items.map((item) => {
                        const Icon = ITEM_ICON[item.type];
                        return (
                          <button type="button" className="grade-item-chip" key={item.id} onClick={() => onJumpToTab(ITEM_TAB[item.type])} title={`Open in ${ITEM_TAB[item.type]}`}>
                            <Icon size={12} /> {item.title} · {item.points}pt
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {pendingDeleteId === entry.group.id && (
                    <div className="outcome-delete-confirm">
                      <AlertTriangle size={15} />
                      <p>
                        Delete <strong>{entry.group.name}</strong>?
                        {entry.itemCount > 0 && course.assignmentGroups.length > 1 ? " Its graded items move to:" : course.assignmentGroups.length === 1 ? " You cannot delete the only group." : ""}
                      </p>
                      {entry.itemCount > 0 && course.assignmentGroups.length > 1 && (
                        <select value={reassignTargetId} onChange={(event) => setReassignTargetId(event.target.value)} aria-label="Reassign items to group">
                          {course.assignmentGroups
                            .filter((group) => group.id !== entry.group.id)
                            .map((group) => (
                              <option key={group.id} value={group.id}>
                                {group.name}
                              </option>
                            ))}
                        </select>
                      )}
                      <button type="button" className="small-button danger" onClick={() => confirmDelete(entry.group.id)} disabled={course.assignmentGroups.length === 1}>
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
    </div>
  );
}
