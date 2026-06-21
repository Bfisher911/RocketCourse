import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  Filter,
  GraduationCap,
  LayoutTemplate,
  Link2,
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
import {
  ASSIGNMENT_REVISE_ACTIONS,
  ASSIGNMENT_SUBMISSION_TYPES,
  ASSIGNMENT_TEMPLATES,
  buildAssignmentTemplateHtml,
  changeAssignmentModule,
  createAssignment,
  deleteAssignment,
  renameAssignmentEverywhere,
  restoreAssignment,
  reviseAssignmentInstructions,
  rubricForAssignment,
  sanitizeAssignmentHtmlForPreview,
  validateAssignmentPlan,
  type AssignmentIssue,
  type AssignmentReviseAction,
  type AssignmentTemplateId
} from "../services/assignmentBuilder";
import { stripHtml } from "../utils/text";
import type { Assignment, CourseProject, ObjectMetadata, PublishState } from "../types";

type UpdateCourse = (updater: (current: CourseProject) => CourseProject) => void;

interface AssignmentSnapshot {
  id: string;
  reason: string;
  createdAt: string;
  assignment: Assignment;
  score: number;
}

type RubricFilter = "all" | "with-rubric" | "without-rubric";

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
  return text.length > 180 ? `${text.slice(0, 177)}...` : text || "No student-facing instructions yet.";
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

const issueLabel = (issues: AssignmentIssue[]): string => {
  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.filter((issue) => issue.severity === "warning").length;
  if (errors > 0) return `${errors} blocker${errors === 1 ? "" : "s"}`;
  if (warnings > 0) return `${warnings} warning${warnings === 1 ? "" : "s"}`;
  return "Ready";
};

export function AssignmentsTab({
  course,
  onUpdateCourse,
  onJumpToTab
}: {
  course: CourseProject;
  onUpdateCourse: UpdateCourse;
  onJumpToTab: (tab: "Modules" | "Rubrics" | "Gradebook Setup") => void;
}) {
  const validation = useMemo(() => validateAssignmentPlan(course), [course]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(course.assignments[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [rubricFilter, setRubricFilter] = useState<RubricFilter>("all");
  const [outcomeFilter, setOutcomeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedTemplateId, setSelectedTemplateId] = useState<AssignmentTemplateId>("essay-paper");
  const [snapshots, setSnapshots] = useState<AssignmentSnapshot[]>([]);

  const issueMap = useMemo(() => {
    const map = new Map<string, AssignmentIssue[]>();
    validation.issues.forEach((issue) => map.set(issue.assignmentId, [...(map.get(issue.assignmentId) ?? []), issue]));
    return map;
  }, [validation.issues]);

  const filteredAssignments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return course.assignments.filter((assignment) => {
      const text = `${assignment.title} ${stripHtml(assignment.descriptionHtml)}`.toLowerCase();
      if (normalizedQuery && !text.includes(normalizedQuery)) return false;
      if (moduleFilter !== "all" && assignment.moduleId !== moduleFilter) return false;
      if (groupFilter !== "all" && assignment.assignmentGroupId !== groupFilter) return false;
      if (rubricFilter === "with-rubric" && !assignment.rubricId) return false;
      if (rubricFilter === "without-rubric" && assignment.rubricId) return false;
      if (outcomeFilter !== "all" && !assignment.alignedOutcomeIds.includes(outcomeFilter)) return false;
      if (statusFilter !== "all" && assignment.publishState !== statusFilter) return false;
      return true;
    });
  }, [course.assignments, groupFilter, moduleFilter, outcomeFilter, query, rubricFilter, statusFilter]);

  const selectedAssignment = course.assignments.find((assignment) => assignment.id === selectedAssignmentId) ?? filteredAssignments[0] ?? course.assignments[0];
  const selectedIssues = selectedAssignment ? issueMap.get(selectedAssignment.id) ?? [] : [];
  const selectedRubric = selectedAssignment ? rubricForAssignment(course, selectedAssignment) : undefined;
  const totalPoints = course.assignments.reduce((sum, assignment) => sum + Number(assignment.points || 0), 0);
  const groupsRepresented = new Set(course.assignments.map((assignment) => assignment.assignmentGroupId)).size;
  const rubricsAttached = course.assignments.filter((assignment) => assignment.rubricId).length;
  const outcomesAligned = course.assignments.filter((assignment) => assignment.alignedOutcomeIds.length > 0).length;
  const warningCount = validation.issues.length;
  const latestSnapshot = snapshots[0];

  useEffect(() => {
    if (!selectedAssignment && course.assignments.length > 0) setSelectedAssignmentId(course.assignments[0].id);
  }, [course.assignments, selectedAssignment]);

  const pushSnapshot = (assignment: Assignment, reason: string): void => {
    const createdAt = new Date().toISOString();
    setSnapshots((current) =>
      [
        {
          id: `assignment_snapshot_${Date.now()}`,
          reason,
          createdAt,
          assignment: structuredClone(assignment),
          score: validation.score
        },
        ...current
      ].slice(0, MAX_SNAPSHOTS)
    );
  };

  const updateAssignment = (assignmentId: string, updater: (assignment: Assignment, timestamp: string) => Assignment): void => {
    onUpdateCourse((current) => {
      const timestamp = new Date().toISOString();
      return {
        ...current,
        assignments: current.assignments.map((assignment) => (assignment.id === assignmentId ? updater(assignment, timestamp) : assignment))
      };
    });
  };

  const updateTitle = (assignment: Assignment, title: string): void => {
    onUpdateCourse((current) => renameAssignmentEverywhere(current, assignment.id, title));
  };

  const updateModule = (assignment: Assignment, moduleId: string): void => {
    onUpdateCourse((current) => changeAssignmentModule(current, assignment.id, moduleId));
  };

  const applyTemplate = (assignment: Assignment): void => {
    const template = ASSIGNMENT_TEMPLATES.find((item) => item.id === selectedTemplateId) ?? ASSIGNMENT_TEMPLATES[0];
    pushSnapshot(assignment, `Applied ${template.name} template`);
    onUpdateCourse((current) => {
      const target = current.assignments.find((item) => item.id === assignment.id) ?? assignment;
      return {
        ...current,
        assignments: current.assignments.map((item) =>
          item.id === assignment.id
            ? {
                ...item,
                descriptionHtml: buildAssignmentTemplateHtml(template.id, current, target),
                points: template.recommendedPoints,
                estimatedHours: template.recommendedHours,
                submissionType: template.submissionType,
                status: "edited",
                metadata: touchMetadata(item.metadata, new Date().toISOString())
              }
            : item
        )
      };
    });
  };

  const runReviseAction = (assignment: Assignment, action: AssignmentReviseAction): void => {
    const meta = ASSIGNMENT_REVISE_ACTIONS.find((item) => item.id === action);
    pushSnapshot(assignment, meta ? `Revise: ${meta.label}` : "Assignment revision");
    onUpdateCourse((current) => ({
      ...current,
      assignments: current.assignments.map((item) =>
        item.id === assignment.id
          ? {
              ...item,
              descriptionHtml: reviseAssignmentInstructions(item, current, action),
              status: "edited",
              metadata: touchMetadata(item.metadata, new Date().toISOString())
            }
          : item
      )
    }));
  };

  const addAssignment = (): void => {
    const assignmentId = `assignment_custom_${Date.now().toString(36)}`;
    onUpdateCourse((current) => createAssignment(current, { templateId: selectedTemplateId, assignmentId }));
    setSelectedAssignmentId(assignmentId);
  };

  const removeAssignment = (assignment: Assignment): void => {
    pushSnapshot(assignment, "Deleted assignment");
    const nextSelection = course.assignments.find((item) => item.id !== assignment.id)?.id ?? null;
    onUpdateCourse((current) => deleteAssignment(current, assignment.id));
    setSelectedAssignmentId(nextSelection);
  };

  const restoreLatest = (): void => {
    if (!latestSnapshot) return;
    onUpdateCourse((current) => restoreAssignment(current, latestSnapshot.assignment));
    setSelectedAssignmentId(latestSnapshot.assignment.id);
    setSnapshots((current) => current.slice(1));
  };

  const toggleOutcome = (assignment: Assignment, outcomeId: string): void => {
    updateAssignment(assignment.id, (item, timestamp) => {
      const exists = item.alignedOutcomeIds.includes(outcomeId);
      const alignedOutcomeIds = exists ? item.alignedOutcomeIds.filter((id) => id !== outcomeId) : [...item.alignedOutcomeIds, outcomeId];
      return { ...item, alignedOutcomeIds, status: "edited", metadata: touchMetadata(item.metadata, timestamp) };
    });
  };

  if (course.assignments.length === 0) {
    return (
      <div className="assignment-builder">
        <section className="assignment-hero">
          <div>
            <span className="hp-eyebrow">
              <ClipboardCheck size={14} /> Assignment builder
            </span>
            <h2>No assignments yet</h2>
            <p>Create a student-facing Canvas assignment with module placement, gradebook group, outcomes, rubric alignment, and export-safe instructions.</p>
          </div>
          <button className="secondary" onClick={addAssignment}>
            <Plus size={16} /> Create assignment
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="assignment-builder">
      <section className="assignment-hero">
        <div>
          <span className="hp-eyebrow">
            <ClipboardCheck size={14} /> Assignment builder
          </span>
          <h2>Assignments</h2>
          <p>Plan Canvas assignments with clear student instructions, gradebook alignment, rubric coverage, outcome mapping, and module-safe placement.</p>
        </div>
        <div className={`assignment-readiness ${validation.status === "Ready" ? "ready" : "review"}`}>
          {validation.status === "Ready" ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          <strong>{validation.score}%</strong>
          <span>{validation.status}</span>
        </div>
      </section>

      <section className="assignment-metric-grid" aria-label="Assignment summary">
        <div>
          <strong>{course.assignments.length}</strong>
          <span>Total assignments</span>
        </div>
        <div>
          <strong>{totalPoints}</strong>
          <span>Total points</span>
        </div>
        <div>
          <strong>{groupsRepresented}</strong>
          <span>Groups represented</span>
        </div>
        <div>
          <strong>{rubricsAttached}/{course.assignments.length}</strong>
          <span>Rubrics attached</span>
        </div>
        <div>
          <strong>{outcomesAligned}/{course.assignments.length}</strong>
          <span>Outcome aligned</span>
        </div>
        <div className={warningCount > 0 ? "warn" : ""}>
          <strong>{warningCount}</strong>
          <span>Warnings</span>
        </div>
      </section>

      <section className="assignment-toolbar" aria-label="Search and filter assignments">
        <label className="assignment-search">
          <Search size={15} />
          <span className="sr-only">Search assignments</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search assignments or instructions" />
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
          <span>Group</span>
          <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}>
            <option value="all">All groups</option>
            {course.assignmentGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
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
          <span>Outcome</span>
          <select value={outcomeFilter} onChange={(event) => setOutcomeFilter(event.target.value)}>
            <option value="all">All outcomes</option>
            {course.outcomes.map((outcome) => (
              <option key={outcome.id} value={outcome.id}>
                {outcome.code}
              </option>
            ))}
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
        <button className="secondary" onClick={addAssignment}>
          <Plus size={15} /> Add assignment
        </button>
      </section>

      <div className="assignment-layout">
        <section className="assignment-list" aria-label="Assignment list">
          {filteredAssignments.length === 0 && <p className="module-empty-note">No assignments match the current filters.</p>}
          {filteredAssignments.map((assignment) => {
            const issues = issueMap.get(assignment.id) ?? [];
            const module = course.modules.find((item) => item.id === assignment.moduleId);
            const group = course.assignmentGroups.find((item) => item.id === assignment.assignmentGroupId);
            const rubric = rubricForAssignment(course, assignment);
            return (
              <button
                key={assignment.id}
                className={`assignment-list-card ${selectedAssignment?.id === assignment.id ? "active" : ""} ${issues.some((issue) => issue.severity === "error") ? "has-errors" : ""}`}
                onClick={() => setSelectedAssignmentId(assignment.id)}
              >
                <span className={`assignment-status ${issues.length ? "review" : "ready"}`}>{issueLabel(issues)}</span>
                <strong>{assignment.title || "Untitled assignment"}</strong>
                <small>{snippet(assignment.descriptionHtml)}</small>
                <div>
                  <span>
                    <BookOpen size={13} /> {module?.title ?? "Missing module"}
                  </span>
                  <span>
                    <GraduationCap size={13} /> {group?.name ?? "Missing group"}
                  </span>
                  <span>
                    <ClipboardCheck size={13} /> {assignment.points} pts
                  </span>
                  <span>
                    <Clock size={13} /> {assignment.estimatedHours} hrs
                  </span>
                  <span>
                    <ShieldCheck size={13} /> {rubric?.title ?? "No rubric"}
                  </span>
                  <span>
                    <Link2 size={13} /> {assignment.alignedOutcomeIds.length} outcomes
                  </span>
                </div>
              </button>
            );
          })}
        </section>

        {selectedAssignment && (
          <section className="assignment-editor-panel" aria-label="Selected assignment editor">
            <header className="assignment-editor-header">
              <div>
                <span className="hp-eyebrow">
                  <FileText size={14} /> Editing assignment
                </span>
                <h3>{selectedAssignment.title || "Untitled assignment"}</h3>
                <p>
                  Last updated {relativeTime(selectedAssignment.metadata.updatedAt)}. {selectedIssues.length ? issueLabel(selectedIssues) : "Ready for Canvas export checks."}
                </p>
              </div>
              <div className="assignment-editor-actions">
                <button className="small-button" onClick={() => onJumpToTab("Modules")}>
                  Modules
                </button>
                <button className="small-button" onClick={() => onJumpToTab("Rubrics")}>
                  Rubrics
                </button>
                <button className="small-button" onClick={() => onJumpToTab("Gradebook Setup")}>
                  Gradebook
                </button>
                <button className="small-button danger" onClick={() => removeAssignment(selectedAssignment)}>
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </header>

            <div className="assignment-form-grid">
              <label>
                <span>Title</span>
                <input value={selectedAssignment.title} onChange={(event) => updateTitle(selectedAssignment, event.target.value)} />
              </label>
              <label>
                <span>Points</span>
                <input
                  type="number"
                  min={0}
                  value={selectedAssignment.points}
                  onChange={(event) =>
                    updateAssignment(selectedAssignment.id, (assignment, timestamp) => ({ ...assignment, points: Number(event.target.value), status: "edited", metadata: touchMetadata(assignment.metadata, timestamp) }))
                  }
                />
              </label>
              <label>
                <span>Estimated hours</span>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={selectedAssignment.estimatedHours}
                  onChange={(event) =>
                    updateAssignment(selectedAssignment.id, (assignment, timestamp) => ({
                      ...assignment,
                      estimatedHours: Number(event.target.value),
                      status: "edited",
                      metadata: touchMetadata(assignment.metadata, timestamp)
                    }))
                  }
                />
              </label>
              <label>
                <span>Submission type</span>
                <select
                  value={selectedAssignment.submissionType}
                  onChange={(event) =>
                    updateAssignment(selectedAssignment.id, (assignment, timestamp) => ({
                      ...assignment,
                      submissionType: event.target.value,
                      status: "edited",
                      metadata: touchMetadata(assignment.metadata, timestamp)
                    }))
                  }
                >
                  {ASSIGNMENT_SUBMISSION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Module</span>
                <select value={selectedAssignment.moduleId} onChange={(event) => updateModule(selectedAssignment, event.target.value)}>
                  {course.modules.map((module) => (
                    <option key={module.id} value={module.id}>
                      {module.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Assignment group</span>
                <select
                  value={selectedAssignment.assignmentGroupId}
                  onChange={(event) =>
                    updateAssignment(selectedAssignment.id, (assignment, timestamp) => ({
                      ...assignment,
                      assignmentGroupId: event.target.value,
                      status: "edited",
                      metadata: touchMetadata(assignment.metadata, timestamp)
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
                <span>Rubric</span>
                <select
                  value={selectedAssignment.rubricId ?? ""}
                  onChange={(event) =>
                    updateAssignment(selectedAssignment.id, (assignment, timestamp) => ({
                      ...assignment,
                      rubricId: event.target.value || undefined,
                      status: "edited",
                      metadata: touchMetadata(assignment.metadata, timestamp)
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
                <span>Status</span>
                <select
                  value={selectedAssignment.publishState}
                  onChange={(event) =>
                    updateAssignment(selectedAssignment.id, (assignment, timestamp) => ({
                      ...assignment,
                      publishState: event.target.value as PublishState,
                      status: "edited",
                      metadata: touchMetadata(assignment.metadata, timestamp)
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
                  value={toDateTimeLocal(selectedAssignment.dueAt)}
                  onChange={(event) =>
                    updateAssignment(selectedAssignment.id, (assignment, timestamp) => ({
                      ...assignment,
                      dueAt: fromDateTimeLocal(event.target.value),
                      status: "edited",
                      metadata: touchMetadata(assignment.metadata, timestamp)
                    }))
                  }
                />
              </label>
            </div>

            <section className="assignment-outcome-picker" aria-label="Aligned outcomes">
              <div>
                <h4>Outcome alignment</h4>
                <p>Select the outcomes this assignment gives students evidence for.</p>
              </div>
              <div>
                {course.outcomes.map((outcome) => (
                  <label key={outcome.id} className={selectedAssignment.alignedOutcomeIds.includes(outcome.id) ? "selected" : ""}>
                    <input type="checkbox" checked={selectedAssignment.alignedOutcomeIds.includes(outcome.id)} onChange={() => toggleOutcome(selectedAssignment, outcome.id)} />
                    <span>{outcome.code}</span>
                    <small>{outcome.text}</small>
                  </label>
                ))}
              </div>
            </section>

            <section className="assignment-template-panel" aria-label="Assignment templates and revise actions">
              <div className="assignment-template-bar">
                <label>
                  <LayoutTemplate size={14} />
                  <span>Template</span>
                  <select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value as AssignmentTemplateId)}>
                    {ASSIGNMENT_TEMPLATES.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="secondary" onClick={() => applyTemplate(selectedAssignment)}>
                  <Save size={14} /> Apply template
                </button>
                <button className="secondary" onClick={restoreLatest} disabled={!latestSnapshot}>
                  <Undo2 size={14} /> Restore previous
                </button>
              </div>
              {latestSnapshot && (
                <p className="assignment-snapshot-note">
                  Latest snapshot: {latestSnapshot.reason}, {relativeTime(latestSnapshot.createdAt)}. Score then: {latestSnapshot.score}%.
                </p>
              )}
              <div className="assignment-template-grid">
                {ASSIGNMENT_TEMPLATES.map((template) => (
                  <button key={template.id} className={selectedTemplateId === template.id ? "active" : ""} onClick={() => setSelectedTemplateId(template.id)}>
                    <strong>{template.name}</strong>
                    <span>{template.description}</span>
                  </button>
                ))}
              </div>
              <div className="assignment-revise-grid">
                {ASSIGNMENT_REVISE_ACTIONS.map((action) => (
                  <button key={action.id} onClick={() => runReviseAction(selectedAssignment, action.id)}>
                    <Sparkles size={14} />
                    <strong>{action.label}</strong>
                    <span>{action.description}</span>
                  </button>
                ))}
              </div>
            </section>

            <label className="assignment-instructions-editor">
              <span>Canvas-safe assignment instructions</span>
              <textarea
                rows={16}
                value={selectedAssignment.descriptionHtml}
                onChange={(event) =>
                  updateAssignment(selectedAssignment.id, (assignment, timestamp) => ({
                    ...assignment,
                    descriptionHtml: event.target.value,
                    status: "edited",
                    metadata: touchMetadata(assignment.metadata, timestamp)
                  }))
                }
              />
            </label>

            <section className="assignment-checklist" aria-label="Assignment validation checks">
              <header>
                <h4>Assignment checks</h4>
                <span className={selectedIssues.some((issue) => issue.severity === "error") ? "review" : "ready"}>{issueLabel(selectedIssues)}</span>
              </header>
              {selectedIssues.length === 0 ? (
                <p>
                  <CheckCircle2 size={15} /> This assignment has clear metadata, module placement, gradebook alignment, outcome mapping, rubric coverage, and Canvas-safe HTML.
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

        {selectedAssignment && (
          <aside className="assignment-preview-panel" aria-label="Assignment preview">
            <div className="assignment-preview-sticky">
              <header>
                <span className="hp-eyebrow">
                  <ShieldCheck size={14} /> Canvas preview
                </span>
                <h3>{selectedAssignment.title}</h3>
                <p>
                  {selectedAssignment.points} points, {selectedAssignment.estimatedHours} estimated hours, {selectedRubric ? selectedRubric.title : "no rubric attached"}.
                </p>
              </header>
              <div className="assignment-export-map">
                <span>
                  <BookOpen size={14} /> {course.modules.find((module) => module.id === selectedAssignment.moduleId)?.title ?? "Missing module"}
                </span>
                <span>
                  <GraduationCap size={14} /> {course.assignmentGroups.find((group) => group.id === selectedAssignment.assignmentGroupId)?.name ?? "Missing group"}
                </span>
                <span>
                  <ClipboardCheck size={14} /> {selectedAssignment.submissionType}
                </span>
              </div>
              <div className="canvas-preview assignment-canvas-preview" dangerouslySetInnerHTML={{ __html: sanitizeAssignmentHtmlForPreview(selectedAssignment.descriptionHtml) }} />
              <div className="assignment-preview-footer">
                <span>
                  <RotateCcw size={14} /> Export uses this instruction HTML after validation.
                </span>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
