import { AlertTriangle, CheckCircle2, ClipboardCheck, Copy, GraduationCap, Link2, Plus, RotateCcw, Search, Trash2, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { CourseProject, Rubric } from "../types";
import {
  RUBRIC_TEMPLATES,
  applyRubricTemplate,
  attachRubricToAssignment,
  attachRubricToDiscussion,
  buildRubricFromTemplate,
  getRubricUsage,
  updateRubric,
  validateRubricPlan,
  type RubricTemplateId
} from "../services/rubricBuilder";

interface RubricsTabProps {
  course: CourseProject;
  onUpdateCourse: (updater: (current: CourseProject) => CourseProject) => void;
}

interface RubricSnapshot {
  id: string;
  rubric: Rubric;
  reason: string;
  createdAt: string;
}

const label = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

export function RubricsTab({ course, onUpdateCourse }: RubricsTabProps) {
  const validation = useMemo(() => validateRubricPlan(course), [course]);
  const [selectedRubricId, setSelectedRubricId] = useState(course.rubrics[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [templateId, setTemplateId] = useState<RubricTemplateId>("project");
  const [previewMode, setPreviewMode] = useState<"student" | "instructor">("student");
  const [snapshots, setSnapshots] = useState<RubricSnapshot[]>([]);

  const selectedRubric = course.rubrics.find((rubric) => rubric.id === selectedRubricId) ?? course.rubrics[0];
  const selectedIssues = selectedRubric ? validation.issues.filter((issue) => issue.rubricId === selectedRubric.id) : [];
  const latestSnapshot = snapshots.find((snapshot) => snapshot.rubric.id === selectedRubric?.id);
  const usedAssignments = new Set(course.assignments.map((assignment) => assignment.rubricId).filter(Boolean));
  const usedDiscussions = new Set(course.discussions.map((discussion) => discussion.rubricId).filter(Boolean));
  const unusedCount = course.rubrics.filter((rubric) => !usedAssignments.has(rubric.id) && !usedDiscussions.has(rubric.id)).length;
  const averagePoints = course.rubrics.length ? Math.round(course.rubrics.reduce((sum, rubric) => sum + rubric.points, 0) / course.rubrics.length) : 0;

  const filteredRubrics = course.rubrics.filter((rubric) => {
    const usage = getRubricUsage(course, rubric.id);
    const issues = validation.issues.filter((issue) => issue.rubricId === rubric.id);
    const matchesSearch = `${rubric.title} ${rubric.criteria.map((criterion) => criterion.title).join(" ")}`.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === "assignments" && usage.assignments.length === 0) return false;
    if (filter === "discussions" && usage.discussions.length === 0) return false;
    if (filter === "unused" && (usage.assignments.length || usage.discussions.length)) return false;
    if (filter === "outcomes" && rubric.alignedOutcomeIds.length > 0) return false;
    if (filter === "warnings" && issues.length === 0) return false;
    return true;
  });

  const pushSnapshot = (rubric: Rubric, reason: string) => {
    setSnapshots((current) => [{ id: `${rubric.id}_${Date.now()}`, rubric: structuredClone(rubric), reason, createdAt: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) }, ...current].slice(0, 8));
  };

  const mutateSelected = (updater: (rubric: Rubric) => Rubric) => {
    if (!selectedRubric) return;
    onUpdateCourse((current) => updateRubric(current, selectedRubric.id, updater));
  };

  const addRubric = () => {
    const rubricId = `rubric_${Date.now().toString(36)}`;
    onUpdateCourse((current) => ({ ...current, rubrics: [...current.rubrics, buildRubricFromTemplate(templateId, current, { rubricId })] }));
    setSelectedRubricId(rubricId);
  };

  const addCriterion = () => {
    if (!selectedRubric) return;
    pushSnapshot(selectedRubric, "Added criterion");
    mutateSelected((rubric) => ({
      ...rubric,
      criteria: [
        ...rubric.criteria,
        {
          id: `${rubric.id}_criterion_${Date.now().toString(36)}`,
          title: "New criterion",
          description: "Describe the specific student-facing evidence this criterion evaluates.",
          outcomeId: rubric.alignedOutcomeIds[0],
          levels: [
            { label: "Exemplary", points: 5, description: "Complete and specific." },
            { label: "Proficient", points: 3, description: "Mostly complete." },
            { label: "Developing", points: 1, description: "Partially complete." }
          ]
        }
      ]
    }));
  };

  const detachAssignment = (assignmentId: string) => {
    if (!selectedRubric || !window.confirm("Detach this rubric from the assignment? The rubric itself will stay available.")) return;
    onUpdateCourse((current) => ({
      ...current,
      assignments: current.assignments.map((assignment) => assignment.id === assignmentId ? { ...assignment, rubricId: undefined, status: "edited" } : assignment)
    }));
  };

  const detachDiscussion = (discussionId: string) => {
    if (!selectedRubric || !window.confirm("Detach this rubric from the discussion? The rubric itself will stay available.")) return;
    onUpdateCourse((current) => ({
      ...current,
      discussions: current.discussions.map((discussion) => discussion.id === discussionId ? { ...discussion, rubricId: undefined, status: "edited" } : discussion)
    }));
  };

  if (!selectedRubric) {
    return (
      <div className="rubric-builder">
        <section className="rubric-hero">
          <div><span className="eyebrow">Canvas rubric builder</span><h2>Rubrics</h2><p>Create a first rubric with criteria, levels, points, outcomes, and Canvas export structure.</p></div>
          <button className="primary" onClick={addRubric}><Plus size={16} /> Add rubric</button>
        </section>
      </div>
    );
  }

  const selectedUsage = getRubricUsage(course, selectedRubric.id);

  return (
    <div className="rubric-builder">
      <section className="rubric-hero">
        <div><span className="eyebrow">Canvas rubric builder</span><h2>Rubrics</h2><p>Edit criteria, performance levels, descriptions, points, outcome mapping, and graded-item alignment from one guided workspace.</p></div>
        <div className={`rubric-readiness ${validation.status === "Ready" ? "ready" : "review"}`}>{validation.status === "Ready" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}<strong>{validation.score}%</strong><span>{validation.status}</span></div>
      </section>

      <section className="rubric-metric-grid">
        <div><strong>{course.rubrics.length}</strong><span>Total rubrics</span></div>
        <div><strong>{course.rubrics.reduce((sum, rubric) => sum + rubric.criteria.length, 0)}</strong><span>Total criteria</span></div>
        <div><strong>{averagePoints}</strong><span>Average points</span></div>
        <div><strong>{course.assignments.filter((assignment) => assignment.rubricId).length}</strong><span>Attached assignments</span></div>
        <div><strong>{course.discussions.filter((discussion) => discussion.rubricId).length}</strong><span>Attached discussions</span></div>
        <div className={unusedCount ? "warn" : ""}><strong>{unusedCount}</strong><span>Unused rubrics</span></div>
        <div className={validation.issues.length ? "warn" : ""}><strong>{validation.issues.length}</strong><span>Warnings</span></div>
      </section>

      <section className="rubric-toolbar">
        <label className="rubric-search"><Search size={15} /><input value={search} placeholder="Search rubrics or criteria" onChange={(event) => setSearch(event.target.value)} /></label>
        <label><Link2 size={14} /> Filter<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All rubrics</option><option value="assignments">Used by assignments</option><option value="discussions">Used by discussions</option><option value="unused">Unused</option><option value="outcomes">Missing outcomes</option><option value="warnings">Needs review</option></select></label>
        <label><Wand2 size={14} /> Template<select value={templateId} onChange={(event) => setTemplateId(event.target.value as RubricTemplateId)}>{RUBRIC_TEMPLATES.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
        <button className="primary" onClick={addRubric}><Plus size={16} /> Add rubric</button>
      </section>

      <div className="rubric-layout">
        <section className="rubric-list">
          {filteredRubrics.map((rubric) => {
            const usage = getRubricUsage(course, rubric.id);
            const issues = validation.issues.filter((issue) => issue.rubricId === rubric.id);
            return (
              <button key={rubric.id} className={`rubric-list-card ${rubric.id === selectedRubric.id ? "active" : ""} ${issues.some((issue) => issue.severity === "error") ? "has-errors" : ""}`} onClick={() => setSelectedRubricId(rubric.id)}>
                <span className={`rubric-status ${issues.length ? "review" : "ready"}`}>{issues.length ? `${issues.length} warning${issues.length === 1 ? "" : "s"}` : "Ready"}</span>
                <strong>{rubric.title}</strong>
                <small>{rubric.points} points • {label(rubric.criteria.length, "criterion")} • {label(usage.assignments.length, "assignment")} • {label(usage.discussions.length, "discussion")}</small>
              </button>
            );
          })}
        </section>

        <section className="rubric-editor-panel">
          <header className="rubric-editor-header">
            <div><span className={`rubric-status ${selectedIssues.length ? "review" : "ready"}`}>{selectedIssues.length ? `${selectedIssues.length} to review` : "Ready"}</span><h3>{selectedRubric.title}</h3><p>{selectedRubric.points} points • used by {label(selectedUsage.assignments.length, "assignment")} and {label(selectedUsage.discussions.length, "discussion")}.</p></div>
            <div className="rubric-editor-actions">
              <button onClick={() => { pushSnapshot(selectedRubric, "Applied template"); onUpdateCourse((current) => applyRubricTemplate(current, selectedRubric.id, templateId)); }}><Wand2 size={15} /> Apply template</button>
              <button disabled={!latestSnapshot} onClick={() => { if (!latestSnapshot) return; onUpdateCourse((current) => updateRubric(current, selectedRubric.id, () => latestSnapshot.rubric)); setSnapshots((current) => current.filter((snapshot) => snapshot.id !== latestSnapshot.id)); }}><RotateCcw size={15} /> Restore previous</button>
            </div>
          </header>

          {latestSnapshot && <p className="rubric-snapshot-note">Latest snapshot: {latestSnapshot.reason}, {latestSnapshot.createdAt}.</p>}
          <label className="rubric-title-field">Rubric title<input value={selectedRubric.title} onChange={(event) => mutateSelected((rubric) => ({ ...rubric, title: event.target.value }))} /></label>

          <section className="rubric-outcome-picker">
            <header><h4>Rubric outcomes</h4><p>These outcomes appear in export metadata and can be assigned to individual criteria.</p></header>
            <div>
              {course.outcomes.map((outcome) => {
                const selected = selectedRubric.alignedOutcomeIds.includes(outcome.id);
                return <label key={outcome.id} className={selected ? "selected" : ""}><input type="checkbox" checked={selected} onChange={(event) => mutateSelected((rubric) => ({ ...rubric, alignedOutcomeIds: event.target.checked ? [...rubric.alignedOutcomeIds, outcome.id] : rubric.alignedOutcomeIds.filter((id) => id !== outcome.id) }))} /><span>{outcome.code}</span><small>{outcome.text}</small></label>;
              })}
            </div>
          </section>

          <section className="rubric-attach-panel">
            <header><h4>Alignment workflow</h4><p>Attach this rubric to graded assignments or discussions without orphaning content.</p></header>
            <label>Attach to assignment<select defaultValue="" onChange={(event) => event.target.value && onUpdateCourse((current) => attachRubricToAssignment(current, event.target.value, selectedRubric.id))}><option value="">Choose assignment</option>{course.assignments.map((assignment) => <option key={assignment.id} value={assignment.id}>{assignment.title}</option>)}</select></label>
            <label>Attach to discussion<select defaultValue="" onChange={(event) => event.target.value && onUpdateCourse((current) => attachRubricToDiscussion(current, event.target.value, selectedRubric.id))}><option value="">Choose discussion</option>{course.discussions.filter((discussion) => discussion.points > 0).map((discussion) => <option key={discussion.id} value={discussion.id}>{discussion.title}</option>)}</select></label>
            <div>
              {selectedUsage.assignments.map((item) => (
                <span key={item.id}>Assignment: {item.title}<button type="button" onClick={() => detachAssignment(item.id)}>Detach</button></span>
              ))}
              {selectedUsage.discussions.map((item) => (
                <span key={item.id}>Discussion: {item.title}<button type="button" onClick={() => detachDiscussion(item.id)}>Detach</button></span>
              ))}
              {selectedUsage.assignments.length === 0 && selectedUsage.discussions.length === 0 && <span>No graded items use this rubric yet.</span>}
            </div>
          </section>

          <section className="rubric-criteria-panel">
            <header><h4>Criteria and levels</h4><button className="primary" onClick={addCriterion}><Plus size={15} /> Add criterion</button></header>
            {selectedRubric.criteria.map((criterion, criterionIndex) => (
              <article className="rubric-criterion-card" key={criterion.id}>
                <header>
                  <strong>Criterion {criterionIndex + 1}</strong>
                  <div>
                    <button disabled={criterionIndex === 0} onClick={() => mutateSelected((rubric) => { const criteria = [...rubric.criteria]; [criteria[criterionIndex - 1], criteria[criterionIndex]] = [criteria[criterionIndex], criteria[criterionIndex - 1]]; return { ...rubric, criteria }; })}>Up</button>
                    <button disabled={criterionIndex === selectedRubric.criteria.length - 1} onClick={() => mutateSelected((rubric) => { const criteria = [...rubric.criteria]; [criteria[criterionIndex], criteria[criterionIndex + 1]] = [criteria[criterionIndex + 1], criteria[criterionIndex]]; return { ...rubric, criteria }; })}>Down</button>
                    <button onClick={() => mutateSelected((rubric) => ({ ...rubric, criteria: [...rubric.criteria, { ...criterion, id: `${criterion.id}_copy_${Date.now().toString(36)}`, title: `${criterion.title} Copy` }] }))}><Copy size={14} /> Copy</button>
                    <button className="danger" onClick={() => mutateSelected((rubric) => ({ ...rubric, criteria: rubric.criteria.filter((item) => item.id !== criterion.id) }))}><Trash2 size={14} /> Delete</button>
                  </div>
                </header>
                <div className="rubric-criterion-grid">
                  <label>Title<input value={criterion.title} onChange={(event) => mutateSelected((rubric) => ({ ...rubric, criteria: rubric.criteria.map((item) => item.id === criterion.id ? { ...item, title: event.target.value } : item) }))} /></label>
                  <label>Outcome<select value={criterion.outcomeId ?? ""} onChange={(event) => mutateSelected((rubric) => ({ ...rubric, criteria: rubric.criteria.map((item) => item.id === criterion.id ? { ...item, outcomeId: event.target.value || undefined } : item) }))}><option value="">No criterion outcome</option>{course.outcomes.map((outcome) => <option key={outcome.id} value={outcome.id}>{outcome.code}</option>)}</select></label>
                </div>
                <label>Description<textarea value={criterion.description} onChange={(event) => mutateSelected((rubric) => ({ ...rubric, criteria: rubric.criteria.map((item) => item.id === criterion.id ? { ...item, description: event.target.value } : item) }))} /></label>
                <div className="rubric-level-grid">
                  {criterion.levels.map((level, levelIndex) => (
                    <div key={`${criterion.id}_${levelIndex}`} className="rubric-level-card">
                      <label>Label<input value={level.label} onChange={(event) => mutateSelected((rubric) => ({ ...rubric, criteria: rubric.criteria.map((item) => item.id === criterion.id ? { ...item, levels: item.levels.map((entry, index) => index === levelIndex ? { ...entry, label: event.target.value } : entry) } : item) }))} /></label>
                      <label>Points<input type="number" min={0} value={level.points} onChange={(event) => mutateSelected((rubric) => ({ ...rubric, criteria: rubric.criteria.map((item) => item.id === criterion.id ? { ...item, levels: item.levels.map((entry, index) => index === levelIndex ? { ...entry, points: Number(event.target.value) } : entry) } : item) }))} /></label>
                      <label>Description<textarea value={level.description} onChange={(event) => mutateSelected((rubric) => ({ ...rubric, criteria: rubric.criteria.map((item) => item.id === criterion.id ? { ...item, levels: item.levels.map((entry, index) => index === levelIndex ? { ...entry, description: event.target.value } : entry) } : item) }))} /></label>
                      <button className="danger" disabled={criterion.levels.length <= 2} onClick={() => mutateSelected((rubric) => ({ ...rubric, criteria: rubric.criteria.map((item) => item.id === criterion.id ? { ...item, levels: item.levels.filter((_, index) => index !== levelIndex) } : item) }))}>Delete level</button>
                    </div>
                  ))}
                  <button onClick={() => mutateSelected((rubric) => ({ ...rubric, criteria: rubric.criteria.map((item) => item.id === criterion.id ? { ...item, levels: [...item.levels, { label: "New level", points: 0, description: "Describe this performance level." }] } : item) }))}><Plus size={14} /> Add level</button>
                </div>
              </article>
            ))}
          </section>
        </section>

        <aside className="rubric-preview-panel">
          <div className="rubric-preview-sticky">
            <header><span className="eyebrow">Preview</span><h3>{previewMode === "student" ? "Student view" : "Instructor review"}</h3><p>{previewMode === "student" ? "Student-facing criteria and performance levels." : "Usage, outcomes, and validation metadata."}</p></header>
            <div className="rubric-preview-toggle"><button className={previewMode === "student" ? "active" : ""} onClick={() => setPreviewMode("student")}>Student view</button><button className={previewMode === "instructor" ? "active" : ""} onClick={() => setPreviewMode("instructor")}>Instructor review</button></div>
            <section className="rubric-checklist">{selectedIssues.length === 0 ? <p><CheckCircle2 size={14} /> This rubric has criteria, distinct levels, positive points, outcome alignment, and valid export structure.</p> : selectedIssues.slice(0, 8).map((issue) => <p key={issue.id} className={issue.severity}><AlertTriangle size={14} /> {issue.title}: {issue.detail}</p>)}</section>
            <div className="rubric-table-wrap">
              <table className="rubric-preview-table">
                <thead><tr><th>Criterion</th>{selectedRubric.criteria[0]?.levels.map((level) => <th key={level.label}>{level.label}</th>)}</tr></thead>
                <tbody>{selectedRubric.criteria.map((criterion) => <tr key={criterion.id}><th>{criterion.title}<small>{previewMode === "instructor" ? `Outcome: ${course.outcomes.find((outcome) => outcome.id === criterion.outcomeId)?.code ?? "None"}` : criterion.description}</small></th>{criterion.levels.map((level, index) => <td key={`${criterion.id}_${index}`}><strong>{level.points} pts</strong><span>{level.description}</span></td>)}</tr>)}</tbody>
              </table>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
