// The classic tabbed editor shell — extracted from App.tsx. Pure prop-driven;
// every mutation still flows through App's updateCourse seam, and all editor
// state (undo stack, autosave, active tab) stays in App above this boundary.

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, ChevronRight, ClipboardCheck, FileArchive, Gauge, GripVertical, Home, LayoutDashboard, ListChecks, Loader2, MessageSquareText, RotateCcw, RotateCw, Sparkles, X } from "lucide-react";
import { AiSpendBadge } from "../components/AiSpendBadge";
import { ScreenSkeleton } from "../components/ScreenSkeleton";
import { LogoMark } from "../components/brand";
import { ModulesTab } from "../components/editor/ModulesTab";
import { ReadinessPanel } from "../components/editor/ReadinessPanel";
import { ThemeTab } from "../components/editor/ThemeTab";
import { readinessTab } from "../components/editor/shared";
import { useModalFocus } from "../hooks/useModalFocus";
import { buildCourseQualityReport } from "../services/courseQuality";
import type { CustomThemeInput } from "../services/customThemes";
import type { FullFillProgress } from "../services/fullCourseContent";
import { buildReadinessReport } from "../services/readiness";
import type { CourseProject, ExportMode, ExportValidationReport, Quiz, Theme } from "../types";

import type { EditorTab } from "../types";
import {
  editorPhases,
  editorTabs,
  phaseIndexForTab,
  readStoredEditorView,
  stepDescriptions,
  storeEditorView,
  type EditorViewMode
} from "./appModel";
// The 14 editor tabs stay lazy — they were already separate files and this is
// what keeps the course-generation/readiness cluster off the first paint.
const AssignmentsTab = lazy(() => import("../components/AssignmentsTab").then(m => ({ default: m.AssignmentsTab })));
const ContactHoursTab = lazy(() => import("../components/ContactHoursTab").then(m => ({ default: m.ContactHoursTab })));
const DiscussionsTab = lazy(() => import("../components/DiscussionsTab").then(m => ({ default: m.DiscussionsTab })));
const ExportTab = lazy(() => import("../components/ExportTab").then(m => ({ default: m.ExportTab })));
const GradebookTab = lazy(() => import("../components/GradebookTab").then(m => ({ default: m.GradebookTab })));
const HomepageTab = lazy(() => import("../components/HomepageTab").then(m => ({ default: m.HomepageTab })));
const ImageryTab = lazy(() => import("../components/ImageryTab").then(m => ({ default: m.ImageryTab })));
const InteractionsTab = lazy(() => import("../components/InteractionsTab").then(m => ({ default: m.InteractionsTab })));
const OverviewTab = lazy(() => import("../components/OverviewTab").then(m => ({ default: m.OverviewTab })));
const PagesTab = lazy(() => import("../components/PagesTab").then(m => ({ default: m.PagesTab })));
const QuizzesTab = lazy(() => import("../components/QuizzesTab").then(m => ({ default: m.QuizzesTab })));
const RubricsTab = lazy(() => import("../components/RubricsTab").then(m => ({ default: m.RubricsTab })));
const SyllabusTab = lazy(() => import("../components/SyllabusTab").then(m => ({ default: m.SyllabusTab })));
const TransformTab = lazy(() => import("../components/TransformTab").then(m => ({ default: m.TransformTab })));

export function Editor({
  course,
  activeTab,
  setActiveTab,
  readiness,
  quality,
  subscriptionActive,
  imageSubscriptionActive,
  validationReport,
  isExporting,
  draggedModuleId,
  onDragModule,
  onDropModule,
  onDragItem,
  onDropItem,
  onUpdateCourse,
  onRunValidation,
  onDownload,
  onFillFullContent,
  isFillingContent,
  fillProgress,
  fillSummary,
  onDownloadPdf,
  onDownloadSyllabusPdf,
  onDownloadAllQti,
  onExportQuizQti,
  onExportQuizStudentPdf,
  onExportQuizAnswerKeyPdf,
  onDownloadAllQuizzesStudentPdf,
  onDownloadAllQuizzesAnswerKeyPdf,
  exportError,
  lastDownloadName,
  onDuplicateModule,
  onDeleteModule,
  exportMode,
  onExportModeChange,
  importNotes,
  saveState,
  customThemes,
  canCreateCustomTheme,
  onSaveCustomTheme,
  demoMode = false,
  onExitDemo,
  onOpenReview,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  focusMode = false
}: {
  course: CourseProject;
  activeTab: EditorTab;
  setActiveTab: (tab: EditorTab) => void;
  readiness: ReturnType<typeof buildReadinessReport>;
  quality: ReturnType<typeof buildCourseQualityReport>;
  subscriptionActive: boolean;
  imageSubscriptionActive: boolean;
  validationReport: ExportValidationReport | null;
  isExporting: boolean;
  draggedModuleId: string | null;
  onDragModule: (moduleId: string | null) => void;
  onDropModule: (moduleId: string) => void;
  onDragItem: (item: { moduleId: string; itemId: string } | null) => void;
  onDropItem: (moduleId: string, itemId?: string) => void;
  onUpdateCourse: (updater: (current: CourseProject) => CourseProject) => void;
  onRunValidation: () => void;
  onDownload: () => void;
  onFillFullContent: () => Promise<CourseProject | null>;
  isFillingContent: boolean;
  fillProgress: FullFillProgress | null;
  fillSummary: string | null;
  onDownloadPdf: () => void;
  onDownloadSyllabusPdf: () => void;
  onDownloadAllQti: () => void;
  onExportQuizQti: (quiz: Quiz) => void;
  onExportQuizStudentPdf: (quiz: Quiz) => void;
  onExportQuizAnswerKeyPdf: (quiz: Quiz) => void;
  onDownloadAllQuizzesStudentPdf: () => void;
  onDownloadAllQuizzesAnswerKeyPdf: () => void;
  exportError: string | null;
  lastDownloadName: string | null;
  onDuplicateModule: (moduleId: string) => void;
  onDeleteModule: (moduleId: string, moveItemsToModuleId?: string) => void;
  exportMode: ExportMode;
  onExportModeChange: (mode: ExportMode) => void;
  importNotes: string[];
  saveState: "idle" | "saving" | "saved" | "error";
  customThemes: Theme[];
  canCreateCustomTheme: boolean;
  onSaveCustomTheme: (input: CustomThemeInput) => Promise<{ ok: boolean; theme?: Theme; error?: string }>;
  demoMode?: boolean;
  onExitDemo?: () => void;
  onOpenReview?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  /** Opened as a layer over the guided journey rather than as the whole
   * workspace. The journey is already the guide, so this editor drops its own
   * phase wizard and gives direct access to the section the user asked for. */
  focusMode?: boolean;
}) {
  const tabsRef = useRef<HTMLDivElement>(null);
  const [storedViewMode, setViewMode] = useState<EditorViewMode>(readStoredEditorView);
  // Two guided systems stacked read as two competing wizards; in a layer the
  // journey owns guidance. The user's own saved preference is untouched — it
  // simply doesn't apply while the editor is a tool inside another flow.
  const viewMode: EditorViewMode = focusMode ? "tabs" : storedViewMode;
  // Readiness lives in a slide-over drawer (opened from the header chip) so the
  // editor is two calm columns instead of three competing ones.
  const [readinessOpen, setReadinessOpen] = useState(false);
  const readinessDialogRef = useModalFocus<HTMLElement>(readinessOpen, () => setReadinessOpen(false));

  const stepIndex = editorTabs.indexOf(activeTab);
  const stepCount = editorTabs.length;
  const currentPhaseIndex = phaseIndexForTab(activeTab);
  const currentPhase = editorPhases[currentPhaseIndex];

  // The rail doubles as a live status map: each step shows a check when its area has
  // no failing readiness checks, or an amber count when something needs attention.
  const tabIssueCounts = useMemo(() => {
    const counts = new Map<EditorTab, number>();
    for (const check of readiness.checks) {
      if (check.passed) continue;
      const tab = readinessTab(check.id);
      counts.set(tab, (counts.get(tab) ?? 0) + 1);
    }
    return counts;
  }, [readiness]);

  const changeViewMode = (mode: EditorViewMode): void => {
    setViewMode(mode);
    storeEditorView(mode);
  };

  const goToStep = (index: number): void => {
    const clamped = Math.min(stepCount - 1, Math.max(0, index));
    setActiveTab(editorTabs[clamped]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const active = tabsRef.current?.querySelector<HTMLButtonElement>("button.active");
    active?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [activeTab]);

  return (
    <main id="main-content" tabIndex={-1} className="editor-shell">
      <aside className="editor-rail" aria-label="Course navigation">
        <div className="rail-section">
          <strong>{course.title.trim() || "Untitled course"}</strong>
          <small>
            {course.modules.length} modules • {course.pages.length} pages
          </small>
        </div>
        {viewMode === "guided" ? (
          <>
            <span className="rail-label">Build phases</span>
            {editorPhases.map((phase, index) => {
              const activePhase = phase.steps.includes(activeTab);
              const phaseIssues = phase.steps.reduce((sum, tab) => sum + (tabIssueCounts.get(tab) ?? 0), 0);
              return (
                <div key={phase.name} className={`rail-phase${activePhase ? " active" : ""}`}>
                  <button
                    className={`step-link phase-link${activePhase ? " active" : ""}${phaseIssues === 0 ? " visited" : ""}`}
                    aria-expanded={activePhase}
                    title={phaseIssues > 0 ? `${phaseIssues} readiness check${phaseIssues === 1 ? "" : "s"} to address` : "All readiness checks pass"}
                    onClick={() => goToStep(editorTabs.indexOf(phase.steps[0]))}
                  >
                    <span className="step-num" aria-hidden="true">
                      {phaseIssues === 0 ? <Check size={13} /> : index + 1}
                    </span>
                    {phase.name}
                    <small className={`phase-count${phaseIssues > 0 ? " warn" : ""}`}>
                      {phaseIssues > 0 ? phaseIssues : phase.steps.length}
                    </small>
                  </button>
                  {activePhase && (
                    <div className="phase-steps">
                      {phase.steps.map((tab) => {
                        const tabIndex = editorTabs.indexOf(tab);
                        const issues = tabIssueCounts.get(tab) ?? 0;
                        return (
                          <button
                            key={tab}
                            className={`step-link phase-step${activeTab === tab ? " active" : ""}${issues === 0 ? " visited" : ""}`}
                            aria-current={activeTab === tab ? "step" : undefined}
                            title={issues > 0 ? `${issues} readiness check${issues === 1 ? "" : "s"} to address` : "All readiness checks pass"}
                            onClick={() => goToStep(tabIndex)}
                          >
                            <span className={`step-dot${issues > 0 ? " warn" : ""}`} aria-hidden="true">
                              {issues === 0 ? <Check size={11} /> : null}
                            </span>
                            {tab}
                            {issues > 0 && <small className="step-issues">{issues}</small>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        ) : (
          <>
            <span className="rail-label">Quick nav</span>
            {[
              ["Overview", BookOpen],
              ["Modules", GripVertical],
              ["Assignments", ClipboardCheck],
              ["Discussions", MessageSquareText],
              ["Export", FileArchive]
            ].map(([label, Icon]) => (
              <button key={String(label)} className={activeTab === label ? "active" : ""} onClick={() => setActiveTab(label as EditorTab)}>
                <Icon size={17} /> {String(label)}
              </button>
            ))}
          </>
        )}
      </aside>

      <section className="editor-main">
        {demoMode && (
          <div className="demo-banner" role="note">
            <span className="demo-banner-text">
              <Sparkles size={15} />
              <span>
                You're exploring the <strong>RocketCourse demo</strong> — a pre-populated AI and Modern Society course.
                No AI credits are used and edits here aren't saved.
              </span>
            </span>
            <button className="ghost-button" onClick={onExitDemo}>
              <Home size={15} /> Back to RocketCourse Home
            </button>
          </div>
        )}
        <div className="editor-header">
          <div className="editor-titlewrap">
            <LogoMark size={34} decorative className="editor-mark" />
            <div>
              <h1>{course.title.trim() || "Untitled course"}</h1>
            <p>
              Structured Canvas course preview and editor
              {saveState === "saving" && <span className="save-chip saving"><Loader2 size={12} className="spin" /> Saving…</span>}
              {saveState === "saved" && <span className="save-chip saved"><CheckCircle2 size={12} /> Saved</span>}
              {saveState === "error" && <span className="save-chip error"><AlertTriangle size={12} /> Save failed</span>}
              <AiSpendBadge courseId={course.id} />
            </p>
            </div>
          </div>
          <div className="editor-header-right">
            <div className="editor-header-chips">
            {onUndo && (
              <button
                type="button"
                className="readiness-chip history-chip"
                onClick={onUndo}
                disabled={!canUndo}
                title="Undo last change (Ctrl/Cmd+Z)"
              >
                <RotateCcw size={14} /> Undo
              </button>
            )}
            {onRedo && (
              <button
                type="button"
                className="readiness-chip history-chip"
                onClick={onRedo}
                disabled={!canRedo}
                title="Redo (Ctrl/Cmd+Shift+Z)"
                aria-label="Redo"
              >
                <RotateCw size={14} />
              </button>
            )}
            {onOpenReview && (
              <button type="button" className="readiness-chip" onClick={onOpenReview}>
                <ListChecks size={15} /> Review course
              </button>
            )}
            <button
              type="button"
              className={`readiness-chip ${readiness.blockers > 0 ? "blocked" : readiness.checks.some((item) => !item.passed) ? "review" : "ready"}`}
              onClick={() => setReadinessOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={readinessOpen}
            >
              <Gauge size={15} />
              {readiness.blockers > 0
                ? `${readiness.blockers} blocking issue${readiness.blockers === 1 ? "" : "s"}`
                : (() => {
                    const review = readiness.checks.filter((item) => !item.passed).length;
                    return review > 0 ? `Ready — ${review} to review` : "Ready to export";
                  })()}
              <ChevronRight size={14} aria-hidden="true" />
            </button>
            </div>
          </div>
        </div>
        <div className="editor-viewbar">
          {viewMode === "guided" ? (
            <div className="guided-bar" aria-label="Guided build steps">
              <div className="guided-info">
                <span className="guided-count">
                  Phase {currentPhaseIndex + 1} of {editorPhases.length} — {currentPhase.name}
                </span>
                <strong>{activeTab}</strong>
                <span className="guided-desc">{stepDescriptions[activeTab]}</span>
              </div>
              <div
                className="guided-progress"
                role="progressbar"
                aria-label="Course build progress"
                aria-valuemin={1}
                aria-valuemax={stepCount}
                aria-valuenow={stepIndex + 1}
              >
                <span className="guided-progress-fill" style={{ width: `${((stepIndex + 1) / stepCount) * 100}%` }} />
              </div>
            </div>
          ) : (
            <div className="tabs" role="tablist" aria-label="Course editor sections" ref={tabsRef}>
              {editorTabs.map((tab) => (
                <button key={tab} role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}>
                  {tab}
                </button>
              ))}
            </div>
          )}
          {!focusMode && (
            <div className="view-toggle" role="group" aria-label="Editor view mode">
              <button className={viewMode === "guided" ? "active" : ""} aria-pressed={viewMode === "guided"} onClick={() => changeViewMode("guided")}>
                <ListChecks size={14} /> Guided
              </button>
              <button className={viewMode === "tabs" ? "active" : ""} aria-pressed={viewMode === "tabs"} onClick={() => changeViewMode("tabs")}>
                <LayoutDashboard size={14} /> All sections
              </button>
            </div>
          )}
        </div>
        <div className="tab-body">
          {/* One boundary: exactly one tab renders at a time, so this is
              equivalent to a boundary per tab. It is scoped to the tab body so
              suspending never unmounts the editor chrome around it. */}
          <Suspense fallback={<ScreenSkeleton label="Loading section" />}>
          {activeTab === "Overview" && <OverviewTab course={course} onUpdateCourse={onUpdateCourse} onJumpToTab={setActiveTab} />}
          {activeTab === "Imagery" && <ImageryTab course={course} onUpdateCourse={onUpdateCourse} subscriptionActive={imageSubscriptionActive} demoMode={demoMode} />}
          {activeTab === "Homepage" && <HomepageTab course={course} onUpdateCourse={onUpdateCourse} />}
          {activeTab === "Syllabus" && <SyllabusTab course={course} onUpdateCourse={onUpdateCourse} />}
          {activeTab === "Modules" && (
            <ModulesTab
              course={course}
              draggedModuleId={draggedModuleId}
              onDragModule={onDragModule}
              onDropModule={onDropModule}
              onDragItem={onDragItem}
              onDropItem={onDropItem}
              onUpdateCourse={onUpdateCourse}
              onDuplicateModule={onDuplicateModule}
              onDeleteModule={onDeleteModule}
              onJumpToTab={setActiveTab}
            />
          )}
          {activeTab === "Pages" && <PagesTab course={course} onUpdateCourse={onUpdateCourse} onJumpToTab={setActiveTab} />}
          {activeTab === "Interactions" && <InteractionsTab course={course} onUpdateCourse={onUpdateCourse} />}
          {activeTab === "Assignments" && <AssignmentsTab course={course} onUpdateCourse={onUpdateCourse} onJumpToTab={setActiveTab} />}
          {activeTab === "Discussions" && <DiscussionsTab course={course} onUpdateCourse={onUpdateCourse} onJumpToTab={setActiveTab} />}
          {activeTab === "Quizzes" && (
            <QuizzesTab
              course={course}
              onUpdateCourse={onUpdateCourse}
              onJumpToTab={setActiveTab}
              onExportQti={onExportQuizQti}
              onExportStudentPdf={onExportQuizStudentPdf}
              onExportAnswerKeyPdf={onExportQuizAnswerKeyPdf}
            />
          )}
          {activeTab === "Rubrics" && <RubricsTab course={course} onUpdateCourse={onUpdateCourse} />}
          {activeTab === "Gradebook Setup" && <GradebookTab course={course} onUpdateCourse={onUpdateCourse} onJumpToTab={setActiveTab} />}
          {activeTab === "Contact Hours" && <ContactHoursTab course={course} onUpdateCourse={onUpdateCourse} onJumpToTab={setActiveTab} />}
          {activeTab === "Theme" && (
            <ThemeTab
              course={course}
              onUpdateCourse={onUpdateCourse}
              customThemes={customThemes}
              canCreateCustomTheme={canCreateCustomTheme}
              onSaveCustomTheme={onSaveCustomTheme}
            />
          )}
          {activeTab === "Transform" && <TransformTab course={course} onUpdateCourse={onUpdateCourse} />}
          {activeTab === "Export" && (
            <ExportTab
              course={course}
              demoMode={demoMode}
              readiness={readiness}
              validationReport={validationReport}
              isExporting={isExporting}
              exportMode={exportMode}
              onExportModeChange={onExportModeChange}
              importNotes={importNotes}
              subscriptionActive={subscriptionActive}
              exportError={exportError}
              lastDownloadName={lastDownloadName}
              onRunValidation={onRunValidation}
              onDownload={onDownload}
              onFillFullContent={onFillFullContent}
              isFillingContent={isFillingContent}
              fillProgress={fillProgress}
              fillSummary={fillSummary}
              onDownloadPdf={onDownloadPdf}
              onDownloadSyllabusPdf={onDownloadSyllabusPdf}
              onDownloadAllQti={onDownloadAllQti}
              onDownloadAllQuizzesStudentPdf={onDownloadAllQuizzesStudentPdf}
              onDownloadAllQuizzesAnswerKeyPdf={onDownloadAllQuizzesAnswerKeyPdf}
              onJumpToTab={setActiveTab}
            />
          )}
          </Suspense>
        </div>
        {viewMode === "guided" && (
          <nav className="guided-footer" aria-label="Step navigation">
            <button className="ghost-button" onClick={() => goToStep(stepIndex - 1)} disabled={stepIndex === 0}>
              <ArrowLeft size={15} /> Back{stepIndex > 0 ? `: ${editorTabs[stepIndex - 1]}` : ""}
            </button>
            <span className="guided-footer-count" aria-hidden="true">
              {stepIndex + 1} / {stepCount}
            </span>
            {stepIndex < stepCount - 1 ? (
              <button className="guided-next" onClick={() => goToStep(stepIndex + 1)}>
                Next: {editorTabs[stepIndex + 1]} <ArrowRight size={15} />
              </button>
            ) : (
              <span className="guided-done">
                <CheckCircle2 size={15} /> Final step — download your course above
              </span>
            )}
          </nav>
        )}
      </section>

      {readinessOpen && (
        <div className="readiness-drawer-backdrop" onClick={() => setReadinessOpen(false)}>
          <aside
            ref={readinessDialogRef}
            tabIndex={-1}
            className="readiness-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Course readiness"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="ghost-button readiness-drawer-close" onClick={() => setReadinessOpen(false)}>
              <X size={15} /> Close
            </button>
            <Suspense fallback={<ScreenSkeleton label="Loading readiness" />}>
            <ReadinessPanel
              course={course}
              readiness={readiness}
              quality={quality}
              validationReport={validationReport}
              subscriptionActive={subscriptionActive}
              onUpdateCourse={onUpdateCourse}
              onJumpToTab={(tab) => {
                setReadinessOpen(false);
                setActiveTab(tab);
              }}
            />
            </Suspense>
          </aside>
        </div>
      )}
    </main>
  );
}
