// Modules tab — extracted from App.tsx. Pure prop-driven: all module mutation
// still happens through App's updateCourse seam.

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BookOpen, CheckCircle2, ChevronDown, ChevronRight, ClipboardCheck, FileText, GripVertical, Layers, MessageSquareText, MoveRight, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { EmptyState } from "../../components/form";
import type { ModulePreviewFilter } from "../../services/modulePlanner";
import { getModuleItemTarget, itemCountsForModule, moduleItemTypeLabel, validateModulePlan } from "../../services/modulePlanner";
import type { } from "../../services/themeDesign";
import type { CourseModule, CourseProject, ModuleItem } from "../../types";

import type { EditorTab } from "../../types";
import { editMetadata, moveItem, renumberModules } from "./shared";

export function ModulesTab({
  course,
  draggedModuleId,
  onDragModule,
  onDropModule,
  onDragItem,
  onDropItem,
  onUpdateCourse,
  onDuplicateModule,
  onDeleteModule,
  onJumpToTab
}: {
  course: CourseProject;
  draggedModuleId: string | null;
  onDragModule: (moduleId: string | null) => void;
  onDropModule: (moduleId: string) => void;
  onDragItem: (item: { moduleId: string; itemId: string } | null) => void;
  onDropItem: (moduleId: string, itemId?: string) => void;
  onUpdateCourse: (updater: (current: CourseProject) => CourseProject) => void;
  onDuplicateModule: (moduleId: string) => void;
  onDeleteModule: (moduleId: string, moveItemsToModuleId?: string) => void;
  onJumpToTab: (tab: EditorTab) => void;
}) {
  const [selectedModuleId, setSelectedModuleId] = useState(course.modules[0]?.id ?? "");
  const [previewFilter, setPreviewFilter] = useState<ModulePreviewFilter>("all");
  const [pendingDeleteModuleId, setPendingDeleteModuleId] = useState<string | null>(null);
  const [moveTargetModuleId, setMoveTargetModuleId] = useState("");
  const validation = useMemo(() => validateModulePlan(course), [course]);
  const totalItems = course.modules.reduce((sum, module) => sum + module.items.length, 0);
  const emptyModules = course.modules.filter((module) => module.items.length === 0).length;
  const totalWorkload = course.modules.reduce((sum, module) => sum + Number(module.workloadHours || 0), 0);
  const selectedModule = course.modules.find((module) => module.id === selectedModuleId) ?? course.modules[0];

  useEffect(() => {
    if (!course.modules.some((module) => module.id === selectedModuleId)) {
      setSelectedModuleId(course.modules[0]?.id ?? "");
    }
  }, [course.modules, selectedModuleId]);

  const tabForItem = (type: ModuleItem["type"]): EditorTab => {
    if (type === "assignment") return "Assignments";
    if (type === "discussion") return "Discussions";
    if (type === "quiz") return "Quizzes";
    if (type === "syllabus") return "Syllabus";
    return "Pages";
  };

  const iconForType = (type: ModuleItem["type"]) => {
    if (type === "assignment") return <ClipboardCheck size={14} />;
    if (type === "discussion") return <MessageSquareText size={14} />;
    if (type === "quiz") return <CheckCircle2 size={14} />;
    return <FileText size={14} />;
  };

  const updateModuleField = <K extends keyof CourseModule>(moduleId: string, key: K, value: CourseModule[K]): void => {
    onUpdateCourse((current) => ({
      ...current,
      modules: current.modules.map((module) => (module.id === moduleId ? { ...module, [key]: value, status: "edited" } : module))
    }));
  };

  const renameModuleItem = (moduleId: string, item: ModuleItem, title: string): void => {
    onUpdateCourse((current) => ({
      ...current,
      modules: current.modules.map((module) =>
        module.id === moduleId
          ? {
              ...module,
              items: module.items.map((moduleItem) => (moduleItem.id === item.id ? { ...moduleItem, title, status: "edited" } : moduleItem))
            }
          : module
      ),
      pages: item.type === "page" || item.type === "syllabus" ? current.pages.map((page) => (page.id === item.refId ? { ...page, title, status: "edited" } : page)) : current.pages,
      assignments: item.type === "assignment" ? current.assignments.map((assignment) => (assignment.id === item.refId ? { ...assignment, title, status: "edited" } : assignment)) : current.assignments,
      discussions: item.type === "discussion" ? current.discussions.map((discussion) => (discussion.id === item.refId ? { ...discussion, title, status: "edited" } : discussion)) : current.discussions,
      quizzes: item.type === "quiz" ? current.quizzes.map((quiz) => (quiz.id === item.refId ? { ...quiz, title, status: "edited" } : quiz)) : current.quizzes
    }));
  };

  const moveModuleBy = (moduleId: string, offset: number): void => {
    const index = course.modules.findIndex((module) => module.id === moduleId);
    const targetIndex = index + offset;
    if (index < 0 || targetIndex < 0 || targetIndex >= course.modules.length) return;
    onUpdateCourse((current) => ({ ...current, modules: renumberModules(moveItem(current.modules, index, targetIndex)) }));
  };

  const startDelete = (module: CourseModule): void => {
    setPendingDeleteModuleId(module.id);
    setMoveTargetModuleId(course.modules.find((candidate) => candidate.id !== module.id)?.id ?? "");
  };

  const moduleSummaryFor = (moduleId: string) => validation.moduleSummaries.find((summary) => summary.moduleId === moduleId);
  const itemIssues = (itemId: string) => validation.issues.filter((issue) => issue.itemId === itemId);
  const visiblePreviewItems =
    selectedModule?.items
      .map((item) => ({ item, target: getModuleItemTarget(course, item), issues: itemIssues(item.id) }))
      .filter(({ item, target, issues }) => {
        if (previewFilter === "pages") return item.type === "page" || item.type === "syllabus";
        if (previewFilter === "graded") return item.type === "assignment" || item.type === "quiz" || (target?.points ?? 0) > 0;
        if (previewFilter === "risky") return issues.length > 0 || !target;
        return true;
      }) ?? [];

  if (course.modules.length === 0) {
    return <EmptyState title="No modules yet" body="Add a module to begin building the Canvas course sequence." />;
  }

  return (
    <div className="module-planner">
      <section className="module-planner-hero">
        <div>
          <span className="hp-eyebrow"><Layers size={14} /> Canvas module planner</span>
          <h2>Course Sequence Builder</h2>
          <p>Plan the student path, edit module metadata, move content safely, and catch broken Canvas references before export.</p>
        </div>
        <div className={`module-readiness-badge ${validation.status === "Ready" ? "ready" : "review"}`}>
          {validation.status === "Ready" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <strong>{validation.score}%</strong>
          <span>{validation.status}</span>
        </div>
      </section>

      <section className="module-metric-grid" aria-label="Module planner summary">
        <div>
          <strong>{course.modules.length}</strong>
          <span>Modules</span>
        </div>
        <div>
          <strong>{totalItems}</strong>
          <span>Items in sequence</span>
        </div>
        <div className={emptyModules ? "warn" : ""}>
          <strong>{emptyModules}</strong>
          <span>Empty modules</span>
        </div>
        <div>
          <strong>{totalWorkload}</strong>
          <span>Estimated hours</span>
        </div>
      </section>

      <section className="module-sequence" aria-label="Visual course sequence">
        {course.modules.map((module, index) => {
          const summary = moduleSummaryFor(module.id);
          return (
            <button key={module.id} className={selectedModule?.id === module.id ? "active" : ""} onClick={() => setSelectedModuleId(module.id)}>
              <span>{index + 1}</span>
              <strong>{module.title || "Untitled module"}</strong>
              <small>{summary?.status ?? "Ready"}</small>
            </button>
          );
        })}
      </section>

      <div className="module-planner-actions">
        <button
          type="button"
          className="secondary"
          onClick={() =>
            onUpdateCourse((current) => ({
              ...current,
              modules: renumberModules([
                ...current.modules,
                {
                  id: `module_custom_${Date.now()}`,
                  title: "New Module",
                  description: "Add a module description.",
                  objectives: ["Add a measurable module objective."],
                  workloadHours: 4,
                  order: current.modules.length,
                  kind: "content",
                  publishState: "published",
                  expanded: true,
                  items: [],
                  status: "draft",
                  metadata: editMetadata()
                }
              ])
            }))
          }
        >
          <Plus size={16} /> Add module
        </button>
      </div>

      <div className="module-planner-layout">
        <section className="module-board" aria-label="Editable module cards">
          {course.modules.map((module, moduleIndex) => {
            const counts = itemCountsForModule(module);
            const summary = moduleSummaryFor(module.id);
            const currentDelete = pendingDeleteModuleId === module.id;
            return (
              <article
                key={module.id}
                className={`module-editor ${draggedModuleId === module.id ? "dragging" : ""} ${summary?.status === "Needs review" ? "needs-review" : ""}`}
                draggable
                onDragStart={() => onDragModule(module.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => onDropModule(module.id)}
              >
                <header>
                  <span className="module-drag-handle" aria-label={`Drag ${module.title}`} title="Drag to reorder">
                    <GripVertical size={16} /> Drag
                  </span>
                  <button
                    className="icon-button"
                    onClick={() => updateModuleField(module.id, "expanded", !module.expanded)}
                    aria-label={`${module.expanded ? "Collapse" : "Expand"} ${module.title}`}
                  >
                    {module.expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </button>
                  <div className="module-title-block">
                    <input value={module.title} aria-label={`${module.title} title`} onChange={(event) => updateModuleField(module.id, "title", event.target.value)} />
                    <div className="module-card-meta">
                      <span>{module.objectives.filter(Boolean).length} objectives</span>
                      <span>{module.workloadHours} hours</span>
                      <span>{module.items.length} items</span>
                      <span className={summary?.status === "Needs review" ? "warn" : "ok"}>{summary?.status ?? "Ready"}</span>
                    </div>
                  </div>
                  <select value={module.publishState} aria-label={`${module.title} publish state`} onChange={(event) => updateModuleField(module.id, "publishState", event.target.value as CourseModule["publishState"])}>
                    <option value="published">Published</option>
                    <option value="unpublished">Unpublished</option>
                  </select>
                  <div className="module-card-actions">
                    <button className="small-button" onClick={() => moveModuleBy(module.id, -1)} disabled={moduleIndex === 0}>
                      Up
                    </button>
                    <button className="small-button" onClick={() => moveModuleBy(module.id, 1)} disabled={moduleIndex === course.modules.length - 1}>
                      Down
                    </button>
                    <button className="small-button" onClick={() => onDuplicateModule(module.id)}>
                      Duplicate
                    </button>
                  </div>
                </header>
                {module.expanded && (
                  <div className="module-body" onDragOver={(event) => event.preventDefault()} onDrop={() => onDropItem(module.id)}>
                    <div className="module-card-fields">
                      <label>
                        <span>Description</span>
                        <textarea value={module.description} onChange={(event) => updateModuleField(module.id, "description", event.target.value)} />
                      </label>
                      <label>
                        <span>Objectives</span>
                        <textarea value={module.objectives.join("\n")} onChange={(event) => updateModuleField(module.id, "objectives", event.target.value.split("\n").filter((value) => value.trim()))} />
                      </label>
                      <label>
                        <span>Workload hours</span>
                        <input type="number" min={0} step={0.5} value={module.workloadHours} onChange={(event) => updateModuleField(module.id, "workloadHours", Number(event.target.value))} />
                      </label>
                    </div>

                    <div className="module-count-row" aria-label={`${module.title} item counts`}>
                      {(Object.keys(counts) as ModuleItem["type"][]).map((type) =>
                        counts[type] > 0 ? (
                          <span key={type} className={`item-type ${type}`}>
                            {iconForType(type)} {counts[type]} {moduleItemTypeLabel(type)}
                          </span>
                        ) : null
                      )}
                      {module.items.length === 0 && <span className="module-empty-note">Drop items here or add content from another tab.</span>}
                    </div>

                    {summary && summary.issues.length > 0 && (
                      <div className="module-issue-list" aria-label={`${module.title} module checks`}>
                        {summary.issues.slice(0, 4).map((issue) => (
                          <p key={issue.id} className={issue.severity}>
                            {issue.severity === "error" ? <AlertTriangle size={14} /> : <ShieldCheck size={14} />}
                            <strong>{issue.title}:</strong> {issue.detail}
                          </p>
                        ))}
                      </div>
                    )}

                    <div className="module-items">
                      {module.items.map((item) => {
                        const target = getModuleItemTarget(course, item);
                        const issues = itemIssues(item.id);
                        return (
                          <div
                            key={item.id}
                            className={`module-item ${issues.length ? "risky" : ""}`}
                            draggable
                            onDragStart={(event) => {
                              event.stopPropagation();
                              onDragItem({ moduleId: module.id, itemId: item.id });
                            }}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => {
                              event.stopPropagation();
                              onDropItem(module.id, item.id);
                            }}
                          >
                            <GripVertical size={15} />
                            <span className={`item-type ${item.type}`}>{iconForType(item.type)} {moduleItemTypeLabel(item.type)}</span>
                            <input value={item.title} aria-label={`${item.title} module item title`} onChange={(event) => renameModuleItem(module.id, item, event.target.value)} />
                            <small>{target ? target.summary || "No preview text available yet." : "Missing referenced object."}</small>
                          </div>
                        );
                      })}
                    </div>

                    <div className="module-delete-zone">
                      {module.items.length === 0 ? (
                        <button className="small-button danger" onClick={() => onDeleteModule(module.id)}>
                          <Trash2 size={14} /> Delete empty module
                        </button>
                      ) : (
                        <>
                          <button className="small-button danger" onClick={() => startDelete(module)}>
                            <Trash2 size={14} /> Delete or move
                          </button>
                          {currentDelete && (
                            <div className="module-delete-panel">
                              <strong>Move items before deleting</strong>
                              <p>Non-empty modules cannot be deleted silently. Choose where the {module.items.length} item(s) should go.</p>
                              <select value={moveTargetModuleId} onChange={(event) => setMoveTargetModuleId(event.target.value)} aria-label="Move items to module">
                                {course.modules
                                  .filter((candidate) => candidate.id !== module.id)
                                  .map((candidate) => (
                                    <option key={candidate.id} value={candidate.id}>
                                      {candidate.title}
                                    </option>
                                  ))}
                              </select>
                              <div>
                                <button className="small-button" onClick={() => setPendingDeleteModuleId(null)}>
                                  Cancel
                                </button>
                                <button
                                  className="small-button"
                                  disabled={!moveTargetModuleId}
                                  onClick={() => {
                                    onDeleteModule(module.id, moveTargetModuleId);
                                    setPendingDeleteModuleId(null);
                                  }}
                                >
                                  <MoveRight size={14} /> Move items and delete
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </section>

        <aside className="module-preview-panel" aria-label="Module path preview">
          <div className="module-preview-sticky">
            <header>
              <span className="hp-eyebrow"><BookOpen size={14} /> Preview module path</span>
              <h2>{selectedModule?.title ?? "Select a module"}</h2>
              <p>{selectedModule?.description || "Choose a module to preview what students will see in order."}</p>
            </header>
            <div className="module-preview-tabs" role="tablist" aria-label="Module preview filter">
              {[
                ["all", "All items"],
                ["pages", "Pages only"],
                ["graded", "Graded"],
                ["risky", "Missing or risky"]
              ].map(([id, label]) => (
                <button key={id} className={previewFilter === id ? "active" : ""} onClick={() => setPreviewFilter(id as ModulePreviewFilter)} aria-pressed={previewFilter === id}>
                  {label}
                </button>
              ))}
            </div>
            <div className="module-preview-list">
              {visiblePreviewItems.length === 0 && <p className="module-empty-note">No items match this preview filter.</p>}
              {visiblePreviewItems.map(({ item, target, issues }, index) => (
                <article key={item.id} className={issues.length ? "risky" : ""}>
                  <span className={`item-type ${item.type}`}>{iconForType(item.type)} {moduleItemTypeLabel(item.type)}</span>
                  <strong>{index + 1}. {item.title}</strong>
                  <p>{target?.summary || "No linked content preview is available."}</p>
                  {issues.map((issue) => (
                    <small key={issue.id} className={issue.severity}>{issue.title}: {issue.detail}</small>
                  ))}
                  <button className="small-button" onClick={() => onJumpToTab(tabForItem(item.type))}>
                    Open {tabForItem(item.type)}
                  </button>
                </article>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
