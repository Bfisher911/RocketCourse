import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Filter,
  GraduationCap,
  LayoutTemplate,
  Link2,
  MessageSquareText,
  Plus,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Undo2
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { CourseProject, Discussion, ObjectMetadata, PublishState } from "../types";
import {
  DISCUSSION_REVISE_ACTIONS,
  DISCUSSION_TEMPLATES,
  buildDiscussionTemplateHtml,
  changeDiscussionModule,
  createDiscussion,
  deleteDiscussion,
  duplicateDiscussion,
  renameDiscussionEverywhere,
  restoreDiscussion,
  reviseDiscussionPrompt,
  rubricForDiscussion,
  sanitizeDiscussionHtmlForPreview,
  validateDiscussionPlan,
  type DiscussionIssue,
  type DiscussionReviseAction,
  type DiscussionTemplateId
} from "../services/discussionBuilder";
import { stripHtml } from "../utils/text";

type UpdateCourse = (updater: (current: CourseProject) => CourseProject) => void;
type RubricFilter = "all" | "with-rubric" | "without-rubric";
type GradingFilter = "all" | "graded" | "ungraded";
type OutcomeFilter = "all" | "aligned" | "unaligned";

interface DiscussionSnapshot {
  id: string;
  reason: string;
  createdAt: string;
  discussion: Discussion;
  score: number;
}

const MAX_SNAPSHOTS = 10;

const touchMetadata = (metadata: ObjectMetadata | undefined, timestamp: string): ObjectMetadata => ({
  createdAt: metadata?.createdAt ?? timestamp,
  updatedAt: timestamp,
  lastExportedAt: metadata?.lastExportedAt,
  exportVersion: metadata?.exportVersion ?? 0,
  source: "edited"
});

const relativeTime = (iso?: string): string => {
  if (!iso) return "just now";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "just now";
  const diffMin = Math.round((Date.now() - then) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const snippet = (html: string): string => {
  const text = stripHtml(html).replace(/\s+/g, " ").trim();
  return text.length > 180 ? `${text.slice(0, 177)}...` : text || "No student-facing discussion prompt yet.";
};

const issueLabel = (issues: DiscussionIssue[]): string => {
  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.filter((issue) => issue.severity === "warning").length;
  if (errors > 0) return `${errors} blocker${errors === 1 ? "" : "s"}`;
  if (warnings > 0) return `${warnings} warning${warnings === 1 ? "" : "s"}`;
  return "Ready";
};

const toDateTimeLocal = (iso?: string): string => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const fromDateTimeLocal = (value: string): string | undefined => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const sectionFromText = (title: string, value: string): string =>
  `<h2>${escapeHtml(title)}</h2>\n<p>${escapeHtml(value)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("</p>\n<p>")}</p>`;

const sectionText = (html: string, title: string): string => {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`<h2[^>]*>\\s*${escaped}\\s*<\\/h2>([\\s\\S]*?)(?=<h2\\b|$)`, "i"));
  return match ? stripHtml(match[1]).replace(/\s+/g, " ").trim() : "";
};

const replaceSection = (html: string, title: string, value: string): string => {
  const nextSection = sectionFromText(title, value);
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<h2[^>]*>\\s*${escaped}\\s*<\\/h2>[\\s\\S]*?(?=<h2\\b|$)`, "i");
  return pattern.test(html) ? html.replace(pattern, nextSection) : `${html.trim()}\n${nextSection}`;
};

export function DiscussionsTab({
  course,
  onUpdateCourse,
  onJumpToTab
}: {
  course: CourseProject;
  onUpdateCourse: UpdateCourse;
  onJumpToTab: (tab: "Modules" | "Rubrics" | "Gradebook Setup") => void;
}) {
  const validation = useMemo(() => validateDiscussionPlan(course), [course]);
  const [selectedDiscussionId, setSelectedDiscussionId] = useState<string | null>(course.discussions[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [gradingFilter, setGradingFilter] = useState<GradingFilter>("all");
  const [rubricFilter, setRubricFilter] = useState<RubricFilter>("all");
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedTemplateId, setSelectedTemplateId] = useState<DiscussionTemplateId>("evidence-based");
  const [snapshots, setSnapshots] = useState<DiscussionSnapshot[]>([]);

  const issueMap = useMemo(() => {
    const map = new Map<string, DiscussionIssue[]>();
    validation.issues.forEach((issue) => map.set(issue.discussionId, [...(map.get(issue.discussionId) ?? []), issue]));
    return map;
  }, [validation.issues]);

  const filteredDiscussions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return course.discussions.filter((discussion) => {
      const text = `${discussion.title} ${stripHtml(discussion.promptHtml)}`.toLowerCase();
      if (normalizedQuery && !text.includes(normalizedQuery)) return false;
      if (moduleFilter !== "all" && discussion.moduleId !== moduleFilter) return false;
      if (gradingFilter === "graded" && discussion.points <= 0) return false;
      if (gradingFilter === "ungraded" && discussion.points > 0) return false;
      if (rubricFilter === "with-rubric" && !discussion.rubricId) return false;
      if (rubricFilter === "without-rubric" && discussion.rubricId) return false;
      if (outcomeFilter === "aligned" && discussion.alignedOutcomeIds.length === 0) return false;
      if (outcomeFilter === "unaligned" && discussion.alignedOutcomeIds.length > 0) return false;
      if (statusFilter !== "all" && discussion.publishState !== statusFilter) return false;
      return true;
    });
  }, [course.discussions, gradingFilter, moduleFilter, outcomeFilter, query, rubricFilter, statusFilter]);

  const selectedDiscussion = course.discussions.find((discussion) => discussion.id === selectedDiscussionId) ?? filteredDiscussions[0] ?? course.discussions[0];
  const selectedIssues = selectedDiscussion ? issueMap.get(selectedDiscussion.id) ?? [] : [];
  const selectedRubric = selectedDiscussion ? rubricForDiscussion(course, selectedDiscussion) : undefined;
  const selectedSnapshots = selectedDiscussion ? snapshots.filter((snapshot) => snapshot.discussion.id === selectedDiscussion.id) : [];
  const latestSnapshot = selectedSnapshots[0];
  const gradedDiscussions = course.discussions.filter((discussion) => discussion.points > 0).length;
  const rubricsAttached = course.discussions.filter((discussion) => discussion.rubricId).length;
  const outcomesAligned = course.discussions.filter((discussion) => discussion.alignedOutcomeIds.length > 0).length;
  const warningCount = validation.issues.length;

  useEffect(() => {
    if (!selectedDiscussion && course.discussions.length > 0) setSelectedDiscussionId(course.discussions[0].id);
  }, [course.discussions, selectedDiscussion]);

  const pushSnapshot = (discussion: Discussion, reason: string): void => {
    const createdAt = new Date().toISOString();
    setSnapshots((current) =>
      [
        {
          id: `discussion_snapshot_${Date.now()}`,
          reason,
          createdAt,
          discussion: structuredClone(discussion),
          score: validation.score
        },
        ...current
      ].slice(0, MAX_SNAPSHOTS)
    );
  };

  const updateDiscussion = (discussionId: string, updater: (discussion: Discussion, timestamp: string) => Discussion): void => {
    onUpdateCourse((current) => {
      const timestamp = new Date().toISOString();
      return {
        ...current,
        discussions: current.discussions.map((discussion) => (discussion.id === discussionId ? updater(discussion, timestamp) : discussion))
      };
    });
  };

  const updatePromptHtml = (discussion: Discussion, promptHtml: string, snapshotReason = "Before prompt edit"): void => {
    if (!snapshots.some((snapshot) => snapshot.reason === snapshotReason && snapshot.discussion.id === discussion.id)) pushSnapshot(discussion, snapshotReason);
    updateDiscussion(discussion.id, (item, timestamp) => ({ ...item, promptHtml, status: "edited", metadata: touchMetadata(item.metadata, timestamp) }));
  };

  const updateSection = (discussion: Discussion, title: string, value: string): void => {
    updatePromptHtml(discussion, replaceSection(discussion.promptHtml, title, value), `Before editing ${title}`);
  };

  const applyTemplate = (discussion: Discussion): void => {
    const template = DISCUSSION_TEMPLATES.find((item) => item.id === selectedTemplateId) ?? DISCUSSION_TEMPLATES[0];
    pushSnapshot(discussion, `Applied ${template.name} template`);
    onUpdateCourse((current) => ({
      ...current,
      discussions: current.discussions.map((item) =>
        item.id === discussion.id
          ? {
              ...item,
              promptHtml: buildDiscussionTemplateHtml(template.id, current, item),
              points: template.recommendedPoints,
              status: "edited",
              metadata: touchMetadata(item.metadata, new Date().toISOString())
            }
          : item
      )
    }));
  };

  const runReviseAction = (discussion: Discussion, action: DiscussionReviseAction): void => {
    const meta = DISCUSSION_REVISE_ACTIONS.find((item) => item.id === action);
    pushSnapshot(discussion, meta ? `Revise: ${meta.label}` : "Discussion revision");
    onUpdateCourse((current) => ({
      ...current,
      discussions: current.discussions.map((item) =>
        item.id === discussion.id
          ? {
              ...item,
              promptHtml: reviseDiscussionPrompt(item, current, action),
              status: "edited",
              metadata: touchMetadata(item.metadata, new Date().toISOString())
            }
          : item
      )
    }));
  };

  const addDiscussion = (): void => {
    const discussionId = `discussion_custom_${Date.now().toString(36)}`;
    onUpdateCourse((current) => createDiscussion(current, { templateId: selectedTemplateId, discussionId }));
    setSelectedDiscussionId(discussionId);
  };

  const copyDiscussion = (discussion: Discussion): void => {
    pushSnapshot(discussion, "Duplicated discussion");
    const stamp = Date.now().toString(36);
    const copiedId = `${discussion.id}_copy_${stamp}`;
    onUpdateCourse((current) => duplicateDiscussion(current, discussion.id, { stamp }));
    setSelectedDiscussionId(copiedId);
  };

  const removeDiscussion = (discussion: Discussion): void => {
    pushSnapshot(discussion, "Deleted discussion");
    const nextSelection = course.discussions.find((item) => item.id !== discussion.id)?.id ?? null;
    onUpdateCourse((current) => deleteDiscussion(current, discussion.id));
    setSelectedDiscussionId(nextSelection);
  };

  const restoreLatest = (): void => {
    if (!latestSnapshot) return;
    onUpdateCourse((current) => restoreDiscussion(current, latestSnapshot.discussion));
    setSelectedDiscussionId(latestSnapshot.discussion.id);
    setSnapshots((current) => current.filter((snapshot) => snapshot.id !== latestSnapshot.id));
  };

  const toggleOutcome = (discussion: Discussion, outcomeId: string): void => {
    updateDiscussion(discussion.id, (item, timestamp) => {
      const exists = item.alignedOutcomeIds.includes(outcomeId);
      const alignedOutcomeIds = exists ? item.alignedOutcomeIds.filter((id) => id !== outcomeId) : [...item.alignedOutcomeIds, outcomeId];
      return { ...item, alignedOutcomeIds, status: "edited", metadata: touchMetadata(item.metadata, timestamp) };
    });
  };

  if (course.discussions.length === 0) {
    return (
      <div className="discussion-builder">
        <section className="discussion-hero">
          <div>
            <span className="hp-eyebrow">
              <MessageSquareText size={14} /> Discussion designer
            </span>
            <h2>No discussions yet</h2>
            <p>Create a Canvas discussion with student-facing prompt guidance, module placement, rubric alignment, outcome mapping, and export-safe HTML.</p>
          </div>
          <button className="secondary" onClick={addDiscussion}>
            <Plus size={16} /> Create discussion
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="discussion-builder">
      <section className="discussion-hero">
        <div>
          <span className="hp-eyebrow">
            <MessageSquareText size={14} /> Discussion designer
          </span>
          <h2>Discussions</h2>
          <p>Design Canvas discussions with evidence-rich prompts, clear participation rules, rubric coverage, outcome mapping, and safe export structure.</p>
        </div>
        <div className={`discussion-readiness ${validation.status === "Ready" ? "ready" : "review"}`}>
          {validation.status === "Ready" ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          <strong>{validation.score}%</strong>
          <span>{validation.status}</span>
        </div>
      </section>

      <section className="discussion-metric-grid" aria-label="Discussion summary">
        <div>
          <strong>{course.discussions.length}</strong>
          <span>Total discussions</span>
        </div>
        <div>
          <strong>{gradedDiscussions}</strong>
          <span>Graded</span>
        </div>
        <div>
          <strong>{rubricsAttached}/{course.discussions.length}</strong>
          <span>Rubrics attached</span>
        </div>
        <div>
          <strong>{outcomesAligned}/{course.discussions.length}</strong>
          <span>Outcome aligned</span>
        </div>
        <div className={warningCount > 0 ? "warn" : ""}>
          <strong>{warningCount}</strong>
          <span>Warnings</span>
        </div>
      </section>

      <section className="discussion-toolbar" aria-label="Search and filter discussions">
        <label className="discussion-search">
          <Search size={15} />
          <span className="sr-only">Search discussions</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search discussions or prompts" />
        </label>
        <label>
          <Filter size={14} />
          <span>Module</span>
          <select value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)}>
            <option value="all">All modules</option>
            {course.modules.map((module) => (
              <option key={module.id} value={module.id}>
                {module.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Grading</span>
          <select value={gradingFilter} onChange={(event) => setGradingFilter(event.target.value as GradingFilter)}>
            <option value="all">All grading states</option>
            <option value="graded">Graded</option>
            <option value="ungraded">Ungraded</option>
          </select>
        </label>
        <label>
          <span>Rubric</span>
          <select value={rubricFilter} onChange={(event) => setRubricFilter(event.target.value as RubricFilter)}>
            <option value="all">All rubric states</option>
            <option value="with-rubric">With rubric</option>
            <option value="without-rubric">Needs rubric</option>
          </select>
        </label>
        <label>
          <span>Outcomes</span>
          <select value={outcomeFilter} onChange={(event) => setOutcomeFilter(event.target.value as OutcomeFilter)}>
            <option value="all">All outcome states</option>
            <option value="aligned">Aligned</option>
            <option value="unaligned">Needs outcomes</option>
          </select>
        </label>
        <label>
          <span>Status</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All publish states</option>
            <option value="published">Published</option>
            <option value="unpublished">Unpublished</option>
          </select>
        </label>
        <button className="secondary" onClick={addDiscussion}>
          <Plus size={15} /> Add discussion
        </button>
      </section>

      <div className="discussion-layout">
        <section className="discussion-list" aria-label="Discussion list">
          {filteredDiscussions.length === 0 && <p className="module-empty-note">No discussions match the current filters.</p>}
          {filteredDiscussions.map((discussion) => {
            const issues = issueMap.get(discussion.id) ?? [];
            const module = course.modules.find((item) => item.id === discussion.moduleId);
            const rubric = rubricForDiscussion(course, discussion);
            return (
              <button
                key={discussion.id}
                className={`discussion-list-card ${selectedDiscussion?.id === discussion.id ? "active" : ""} ${issues.some((issue) => issue.severity === "error") ? "has-errors" : ""}`}
                onClick={() => setSelectedDiscussionId(discussion.id)}
              >
                <span className={`discussion-status ${issues.length ? "review" : "ready"}`}>{issueLabel(issues)}</span>
                <strong>{discussion.title || "Untitled discussion"}</strong>
                <small>{snippet(discussion.promptHtml)}</small>
                <div>
                  <span>
                    <BookOpen size={13} /> {module?.title ?? "Missing module"}
                  </span>
                  <span>
                    <ClipboardCheck size={13} /> {discussion.points} pts
                  </span>
                  <span>
                    <ShieldCheck size={13} /> {rubric?.title ?? "No rubric"}
                  </span>
                  <span>
                    <Link2 size={13} /> {discussion.alignedOutcomeIds.length} outcomes
                  </span>
                </div>
              </button>
            );
          })}
        </section>

        {selectedDiscussion && (
          <section className="discussion-editor-panel" aria-label="Selected discussion editor">
            <header className="discussion-editor-header">
              <div>
                <span className="hp-eyebrow">
                  <FileText size={14} /> Editing discussion
                </span>
                <h3>{selectedDiscussion.title || "Untitled discussion"}</h3>
                <p>
                  Last updated {relativeTime(selectedDiscussion.metadata.updatedAt)}. {selectedIssues.length ? issueLabel(selectedIssues) : "Ready for Canvas export checks."}
                </p>
              </div>
              <div className="discussion-editor-actions">
                <button className="small-button" onClick={() => onJumpToTab("Modules")}>
                  Modules
                </button>
                <button className="small-button" onClick={() => onJumpToTab("Rubrics")}>
                  Rubrics
                </button>
                <button className="small-button" onClick={() => onJumpToTab("Gradebook Setup")}>
                  Gradebook
                </button>
                <button className="small-button" onClick={() => copyDiscussion(selectedDiscussion)}>
                  Copy
                </button>
                <button className="small-button danger" onClick={() => removeDiscussion(selectedDiscussion)}>
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </header>

            <div className="discussion-form-grid">
              <label>
                <span>Title</span>
                <input value={selectedDiscussion.title} onChange={(event) => onUpdateCourse((current) => renameDiscussionEverywhere(current, selectedDiscussion.id, event.target.value))} />
              </label>
              <label>
                <span>Points</span>
                <input
                  type="number"
                  min={0}
                  value={selectedDiscussion.points}
                  onChange={(event) =>
                    updateDiscussion(selectedDiscussion.id, (discussion, timestamp) => ({ ...discussion, points: Number(event.target.value), status: "edited", metadata: touchMetadata(discussion.metadata, timestamp) }))
                  }
                />
              </label>
              <label>
                <span>Module</span>
                <select value={selectedDiscussion.moduleId} onChange={(event) => onUpdateCourse((current) => changeDiscussionModule(current, selectedDiscussion.id, event.target.value))}>
                  {course.modules.map((module) => (
                    <option key={module.id} value={module.id}>
                      {module.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Rubric</span>
                <select
                  value={selectedDiscussion.rubricId ?? ""}
                  onChange={(event) =>
                    updateDiscussion(selectedDiscussion.id, (discussion, timestamp) => ({
                      ...discussion,
                      rubricId: event.target.value || undefined,
                      status: "edited",
                      metadata: touchMetadata(discussion.metadata, timestamp)
                    }))
                  }
                >
                  <option value="">No rubric attached</option>
                  {course.rubrics.map((rubric) => (
                    <option key={rubric.id} value={rubric.id}>
                      {rubric.title} ({rubric.points} pts)
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Assignment group</span>
                <select
                  value={selectedDiscussion.assignmentGroupId}
                  onChange={(event) =>
                    updateDiscussion(selectedDiscussion.id, (discussion, timestamp) => ({
                      ...discussion,
                      assignmentGroupId: event.target.value,
                      status: "edited",
                      metadata: touchMetadata(discussion.metadata, timestamp)
                    }))
                  }
                >
                  {course.assignmentGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name} ({group.weight}%)
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Status</span>
                <select
                  value={selectedDiscussion.publishState}
                  onChange={(event) =>
                    updateDiscussion(selectedDiscussion.id, (discussion, timestamp) => ({
                      ...discussion,
                      publishState: event.target.value as PublishState,
                      status: "edited",
                      metadata: touchMetadata(discussion.metadata, timestamp)
                    }))
                  }
                >
                  <option value="published">Published</option>
                  <option value="unpublished">Unpublished</option>
                </select>
              </label>
              <label>
                <span>Due date</span>
                <input
                  type="datetime-local"
                  value={toDateTimeLocal(selectedDiscussion.dueAt)}
                  onChange={(event) =>
                    updateDiscussion(selectedDiscussion.id, (discussion, timestamp) => ({
                      ...discussion,
                      dueAt: fromDateTimeLocal(event.target.value),
                      status: "edited",
                      metadata: touchMetadata(discussion.metadata, timestamp)
                    }))
                  }
                />
              </label>
            </div>

            <section className="discussion-outcome-picker" aria-label="Aligned outcomes">
              <div>
                <h4>Outcome alignment</h4>
                <p>Select the outcomes this discussion should help students practice and demonstrate.</p>
              </div>
              <div>
                {course.outcomes.map((outcome) => (
                  <label key={outcome.id} className={selectedDiscussion.alignedOutcomeIds.includes(outcome.id) ? "selected" : ""}>
                    <input type="checkbox" checked={selectedDiscussion.alignedOutcomeIds.includes(outcome.id)} onChange={() => toggleOutcome(selectedDiscussion, outcome.id)} />
                    <span>{outcome.code}</span>
                    <small>{outcome.text}</small>
                  </label>
                ))}
              </div>
            </section>

            <section className="discussion-guidance-panel" aria-label="Participation requirements">
              <div>
                <h4>Participation guidance</h4>
                <p>Edit the student-facing discussion requirements without digging through the full HTML.</p>
              </div>
              <label>
                <span>Initial post guidance</span>
                <textarea value={sectionText(selectedDiscussion.promptHtml, "Initial Post Instructions")} onChange={(event) => updateSection(selectedDiscussion, "Initial Post Instructions", event.target.value)} />
              </label>
              <label>
                <span>Reply guidance</span>
                <textarea value={sectionText(selectedDiscussion.promptHtml, "Reply Instructions")} onChange={(event) => updateSection(selectedDiscussion, "Reply Instructions", event.target.value)} />
              </label>
              <label>
                <span>Evidence requirement</span>
                <textarea value={sectionText(selectedDiscussion.promptHtml, "Required Evidence")} onChange={(event) => updateSection(selectedDiscussion, "Required Evidence", event.target.value)} />
              </label>
              <label>
                <span>Tone and accessibility guidance</span>
                <textarea value={sectionText(selectedDiscussion.promptHtml, "Accessibility-Friendly Structure")} onChange={(event) => updateSection(selectedDiscussion, "Accessibility-Friendly Structure", event.target.value)} />
              </label>
            </section>

            <section className="discussion-template-panel" aria-label="Discussion templates and revise actions">
              <div className="discussion-template-bar">
                <label>
                  <LayoutTemplate size={14} />
                  <span>Template</span>
                  <select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value as DiscussionTemplateId)}>
                    {DISCUSSION_TEMPLATES.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="secondary" onClick={() => applyTemplate(selectedDiscussion)}>
                  <Save size={14} /> Apply template
                </button>
                <button className="secondary" onClick={restoreLatest} disabled={!latestSnapshot}>
                  <Undo2 size={14} /> Restore previous
                </button>
              </div>
              {latestSnapshot && (
                <p className="discussion-snapshot-note">
                  Latest snapshot: {latestSnapshot.reason}, {relativeTime(latestSnapshot.createdAt)}. Score then: {latestSnapshot.score}%.
                </p>
              )}
              <div className="discussion-template-grid">
                {DISCUSSION_TEMPLATES.map((template) => (
                  <button key={template.id} className={selectedTemplateId === template.id ? "active" : ""} onClick={() => setSelectedTemplateId(template.id)}>
                    <strong>{template.name}</strong>
                    <span>{template.description}</span>
                  </button>
                ))}
              </div>
              <div className="discussion-revise-grid">
                {DISCUSSION_REVISE_ACTIONS.map((action) => (
                  <button key={action.id} onClick={() => runReviseAction(selectedDiscussion, action.id)}>
                    <Sparkles size={14} />
                    <strong>{action.label}</strong>
                    <span>{action.description}</span>
                  </button>
                ))}
              </div>
            </section>

            <label className="discussion-prompt-editor">
              <span>Advanced Canvas discussion HTML</span>
              <textarea rows={16} value={selectedDiscussion.promptHtml} onChange={(event) => updatePromptHtml(selectedDiscussion, event.target.value)} />
            </label>

            <section className="discussion-checklist" aria-label="Discussion validation checks">
              <header>
                <h4>Discussion checks</h4>
                <span className={selectedIssues.some((issue) => issue.severity === "error") ? "review" : "ready"}>{issueLabel(selectedIssues)}</span>
              </header>
              {selectedIssues.length === 0 ? (
                <p>
                  <CheckCircle2 size={15} /> This discussion has a clear prompt, participation guidance, module placement, rubric and outcome alignment, and Canvas-safe HTML.
                </p>
              ) : (
                selectedIssues.map((issue) => (
                  <p key={issue.id} className={issue.severity}>
                    {issue.severity === "error" ? <AlertTriangle size={15} /> : <ShieldCheck size={15} />}
                    <strong>{issue.title}:</strong> {issue.detail}
                  </p>
                ))
              )}
            </section>
          </section>
        )}

        {selectedDiscussion && (
          <aside className="discussion-preview-panel" aria-label="Discussion preview">
            <div className="discussion-preview-sticky">
              <header>
                <span className="hp-eyebrow">
                  <ShieldCheck size={14} /> Canvas preview
                </span>
                <h3>{selectedDiscussion.title}</h3>
                <p>
                  {selectedDiscussion.points > 0 ? `${selectedDiscussion.points} points` : "Ungraded"}, threaded, initial post required, {selectedRubric ? selectedRubric.title : "no rubric attached"}.
                </p>
              </header>
              <div className="discussion-export-map">
                <span>
                  <BookOpen size={14} /> {course.modules.find((module) => module.id === selectedDiscussion.moduleId)?.title ?? "Missing module"}
                </span>
                <span>
                  <GraduationCap size={14} /> {course.assignmentGroups.find((group) => group.id === selectedDiscussion.assignmentGroupId)?.name ?? "Missing group"}
                </span>
                <span>
                  <MessageSquareText size={14} /> Threaded replies
                </span>
              </div>
              <div className="canvas-preview discussion-canvas-preview" dangerouslySetInnerHTML={{ __html: sanitizeDiscussionHtmlForPreview(selectedDiscussion.promptHtml) }} />
              <div className="discussion-preview-footer">
                <span>
                  <RotateCcw size={14} /> Export uses this prompt HTML after validation.
                </span>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
