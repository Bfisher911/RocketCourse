// GuidedJourney — the W02 experience as a plain React component over the REAL
// CourseProject. Replaces the prototype (guided.js) + CourseAdapter + host
// mounting chain: every read comes straight off the course, every edit goes
// through App's updateCourse (undo, autosave, and project-list sync included).
//
// The journey: 8 linear stages with a persistent memory of settled decisions.
// A built course enters at Review with the first four stages shown as history;
// a from-scratch shell starts at Define.

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  Eye,
  FileText,
  ListChecks,
  MessageSquare,
  PencilLine,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import type { Assignment, CourseModule, CourseProject, Discussion, ModuleItem, Quiz } from "../types";
import type { ExportValidationReport } from "../types";
import type { EditorTab } from "../screens/appModel";
import type { FullFillProgress } from "../services/fullCourseContent";
import { buildReadinessReport } from "../services/readiness";
import { tabForCheck } from "../services/overviewSummary";
import { resolvePreviewImageSources } from "../services/canvasLinks";
import { sanitizeHtmlForPreview } from "../services/htmlSafety";
import { LEVEL_OPTIONS, MODALITY_OPTIONS } from "../data/defaultSettings";
import { stripHtml } from "../utils/text";
import "./guidedJourney.css";

export interface WorkflowFocusHandle {
  focusRef: (refId: string) => boolean;
  focusModule: (moduleId: string) => boolean;
}

interface GuidedJourneyProps {
  course: CourseProject;
  onUpdateCourse: (updater: (current: CourseProject) => CourseProject) => void;
  validationReport: ExportValidationReport | null;
  exportAllowed: boolean;
  isFillingContent: boolean;
  fillProgress: FullFillProgress | null;
  fillSummary: string | null;
  onRunValidation: () => void;
  onDownload: () => void;
  onFillFullContent: () => void;
  /** Run the automatic repair engine over the course; returns what was fixed. */
  onAutoRepair: () => string[];
  /** Public demo: the sample course is pre-filled and AI is unavailable, so the
   * full-course generation control is replaced with an explanation (matching
   * ExportTab). Without this the demo offers a button that can only fail. */
  demoMode: boolean;
  /** Start building a first draft for a course that has no content yet. */
  onStartBuild: () => void;
  /** Leave the workspace (e.g. the final "Back to dashboard"). */
  onExit: () => void;
  /** Open the detailed editor at a specific tab, layered over this journey (never a mode switch). */
  onOpenFullEditor: (tab: EditorTab) => void;
}

const STAGES = [
  { key: "define", label: "Define", verb: "What is this course?" },
  { key: "configure", label: "Configure", verb: "The shape of the course" },
  { key: "blueprint", label: "Blueprint", verb: "The plan behind the content" },
  { key: "generate", label: "Generate", verb: "The built first draft" },
  { key: "review", label: "Review", verb: "Walk the course and edit" },
  { key: "resolve", label: "Improve", verb: "AI fixes what it can — you approve the rest" },
  { key: "preview", label: "Student preview", verb: "See what students see" },
  { key: "export", label: "Export", verb: "Package for Canvas" }
] as const;

type StageKey = (typeof STAGES)[number]["key"];

/** Tags beyond simple prose mean a designed layout; plain-text editing would flatten it. */
const RICH_LAYOUT_TAG = /<(?!\/?(?:p|br|strong|em|b|i|u|ul|ol|li|a|h2|h3)\b)[a-z][^>]*>/i;

const textToHtml = (text: string): string =>
  text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
    .join("");

const htmlToText = (html: string): string =>
  html
    .replace(/<\/(?:p|h[1-6]|li|ul|ol|div|section|blockquote)>|<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const isBuiltCourse = (course: CourseProject): boolean => course.modules.some((module) => module.items.length > 0);

const quizNeedsKeyReview = (quiz: Quiz): boolean => quiz.questions.some((question) => question.instructorReviewRequired);

const itemAttention = (item: ModuleItem, course: CourseProject): string | null => {
  if (item.type === "quiz") {
    const quiz = course.quizzes.find((entry) => entry.id === item.refId);
    if (quiz && quizNeedsKeyReview(quiz)) return "Answer key unverified";
  }
  if (item.type === "assignment") {
    const assignment = course.assignments.find((entry) => entry.id === item.refId);
    const rubric = assignment?.rubricId ? course.rubrics.find((entry) => entry.id === assignment.rubricId) : undefined;
    if (rubric && rubric.criteria.some((criterion) => criterion.levels.length === 0)) return "Rubric incomplete";
  }
  return null;
};


export const GuidedJourney = forwardRef<WorkflowFocusHandle, GuidedJourneyProps>(function GuidedJourney(props, ref) {
  const { course, onUpdateCourse } = props;
  const built = isBuiltCourse(course);

  const [stageIndex, setStageIndex] = useState(() => (built ? 4 : 0));
  // Highest stage ever reached this session — stepping BACK through history
  // must never re-lock the steps ahead of where you've already been.
  const [maxReached, setMaxReached] = useState(() => (built ? 4 : 0));
  const [done, setDone] = useState<Set<number>>(() => (built ? new Set([0, 1, 2, 3]) : new Set()));
  const [sessionDecisions, setSessionDecisions] = useState<Array<{ label: string; value: string }>>([]);
  const [currentModuleId, setCurrentModuleId] = useState<string | null>(
    () => course.modules.find((module) => module.kind === "content")?.id ?? course.modules[0]?.id ?? null
  );
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [previewModuleId, setPreviewModuleId] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const readiness = useMemo(() => buildReadinessReport(course), [course]);

  // The settled-decision memory: seeded from the real course, extended by edits
  // made during this session.
  const decisions = useMemo(() => {
    const seeded: Array<{ label: string; value: string }> = [];
    if (built) {
      seeded.push({ label: "Course", value: course.title });
      if (course.settings.level) seeded.push({ label: "Level", value: course.settings.level });
      seeded.push({ label: "Length", value: `${course.settings.lengthWeeks} weeks` });
      if (course.settings.modality) seeded.push({ label: "Modality", value: course.settings.modality });
      seeded.push({ label: "Blueprint", value: "Approved" });
    }
    for (const decision of sessionDecisions) {
      const existing = seeded.find((entry) => entry.label === decision.label);
      if (existing) existing.value = decision.value;
      else seeded.push(decision);
    }
    return seeded;
  }, [built, course.title, course.settings.level, course.settings.lengthWeeks, course.settings.modality, sessionDecisions]);

  const recordDecision = (label: string, value: string): void =>
    setSessionDecisions((current) => {
      const next = current.filter((entry) => entry.label !== label);
      return [...next, { label, value }];
    });

  const goStage = (index: number): void => {
    const clamped = Math.max(0, Math.min(STAGES.length - 1, index));
    setStageIndex(clamped);
    setMaxReached((current) => Math.max(current, clamped));
    topRef.current?.scrollIntoView({ block: "start" });
  };
  const advance = (): void => {
    setDone((current) => new Set(current).add(stageIndex));
    if (stageIndex < STAGES.length - 1) goStage(stageIndex + 1);
  };

  useImperativeHandle(ref, () => ({
    focusRef: (refId: string): boolean => {
      for (const module of course.modules) {
        const item = module.items.find((entry) => entry.refId === refId);
        if (item) {
          setDone((current) => new Set([...current, 0, 1, 2, 3]));
          setCurrentModuleId(module.id);
          setOpenItemId(item.id);
          goStage(4);
          return true;
        }
      }
      return false;
    },
    focusModule: (moduleId: string): boolean => {
      if (!course.modules.some((module) => module.id === moduleId)) return false;
      setDone((current) => new Set([...current, 0, 1, 2, 3]));
      setCurrentModuleId(moduleId);
      setOpenItemId(null);
      goStage(4);
      return true;
    }
  }), [course.modules]);

  // Keep the selected module valid if the course changes underneath us.
  useEffect(() => {
    if (currentModuleId && !course.modules.some((module) => module.id === currentModuleId)) {
      setCurrentModuleId(course.modules.find((module) => module.kind === "content")?.id ?? course.modules[0]?.id ?? null);
      setOpenItemId(null);
    }
  }, [course.modules, currentModuleId]);

  const stage = STAGES[stageIndex];

  return (
    <div className="gj" ref={topRef}>
      <aside className="gj-rail" aria-label="Guided journey steps">
        <div className="gj-rail__head">
          <span className="gj-rail__eyebrow">Guided journey</span>
          <span className="gj-rail__prog">Step {stageIndex + 1} of {STAGES.length}</span>
        </div>
        <ol className="gj-steps">
          {STAGES.map((entry, index) => {
            // Linear by default, never a cage: once a course HAS content, every
            // step is reachable — someone returning to a finished course to grab
            // the package should not have to click through Review and Preview to
            // get there. Only a course with nothing in it still gates the steps
            // that would have nothing to show.
            const unlocked = built || index <= Math.max(maxReached, ...[...done, -1]) + 1;
            return (
              <li key={entry.key}>
                <button
                  type="button"
                  className={`gj-step ${index === stageIndex ? "is-cur" : ""} ${done.has(index) ? "is-done" : ""}`}
                  disabled={!unlocked}
                  title={unlocked ? undefined : "Available once your course has content — build the first draft in Generate."}
                  aria-label={`Step ${index + 1}: ${entry.label}${done.has(index) ? " (done)" : ""}${unlocked ? "" : " (available once your course has content)"}`}
                  aria-current={index === stageIndex ? "step" : undefined}
                  onClick={() => goStage(index)}
                >
                  <span className="gj-step__dot" aria-hidden="true">{done.has(index) ? "✓" : index + 1}</span>
                  <span>{entry.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <details className="gj-mem">
          <summary>Decisions so far ({decisions.length})</summary>
          {decisions.length ? (
            <ul>
              {decisions.map((decision) => (
                <li key={decision.label}>
                  <span className="gj-mem__k">{decision.label}</span>
                  <span>{decision.value}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="gj-tiny">Nothing settled yet. Each choice you confirm is remembered here.</p>
          )}
        </details>
      </aside>

      <div className="gj-main">
        <header className="gj-head">
          <p className="gj-head__crumb">RocketCourse · {course.title || "Your course"}</p>
          <h1>{stage.label}</h1>
          <p className="gj-head__verb">{stage.verb}</p>
        </header>

        <div className="gj-body">
          {stage.key === "define" && <DefineStage {...props} recordDecision={recordDecision} />}
          {stage.key === "configure" && <ConfigureStage {...props} recordDecision={recordDecision} />}
          {stage.key === "blueprint" && <BlueprintStage {...props} recordDecision={recordDecision} />}
          {stage.key === "generate" && <GenerateStage course={course} built={built} onStartBuild={props.onStartBuild} />}
          {stage.key === "review" && (
            <ReviewStage
              {...props}
              currentModuleId={currentModuleId}
              openItemId={openItemId}
              onSelectModule={(id) => { setCurrentModuleId(id); setOpenItemId(null); }}
              onOpenItem={setOpenItemId}
            />
          )}
          {stage.key === "resolve" && (
            <ResolveStage course={course} readiness={readiness} onAutoRepair={props.onAutoRepair} onOpenFullEditor={props.onOpenFullEditor} />
          )}
          {stage.key === "preview" && (
            <PreviewStage course={course} previewModuleId={previewModuleId} onSelectModule={setPreviewModuleId} />
          )}
          {stage.key === "export" && <ExportStage {...props} readinessBlockers={readiness.blockers} />}
        </div>

        <footer className="gj-foot">
          <button type="button" className="ghost-button" disabled={stageIndex === 0} onClick={() => goStage(stageIndex - 1)}>
            <ArrowLeft size={15} /> Back
          </button>
          <span className="gj-foot__hint gj-tiny">{stageHint(stage.key, readiness.blockers)}</span>
          {stage.key === "export" ? (
            <button type="button" className="primary" onClick={props.onExit}>
              Back to dashboard <ArrowRight size={15} />
            </button>
          ) : (
            <button type="button" className="primary" onClick={advance}>
              {stagePrimaryLabel(stage.key)} <ArrowRight size={15} />
            </button>
          )}
        </footer>
      </div>
    </div>
  );
});

const stagePrimaryLabel = (key: StageKey): string => {
  switch (key) {
    case "define": return "Save & continue";
    case "configure": return "Continue to blueprint";
    case "blueprint": return "Blueprint looks right";
    case "generate": return "Go to review";
    case "review": return "Everything looks right";
    case "resolve": return "Continue";
    case "preview": return "Looks good — to export";
    default: return "Continue";
  }
};

// Every hint tells the user something about THEIR course or their next move.
// (An earlier "One primary action per step." described our design principle to
// itself, which is not help — nobody reading it learned what to do.)
const stageHint = (key: StageKey, blockers: number): string => {
  switch (key) {
    case "define": return "Plain language is fine — this is read for structure, never invented from.";
    case "configure": return "These reflect the course as built — adjust anything that changed.";
    case "blueprint": return "The structure behind the content. Change course-level decisions here.";
    case "generate": return "A first draft to react to — everything stays editable.";
    case "review": return "Open any module to read and edit its items.";
    case "resolve": return blockers > 0 ? `${blockers} item${blockers === 1 ? "" : "s"} need${blockers === 1 ? "s" : ""} your judgment` : "Everything else was handled automatically.";
    case "preview": return "Exactly what students see once this is imported.";
    case "export": return "Import into Canvas is not verified until you test it.";
    default: return "";
  }
};

// ---------------------------------------------------------------------------
// Stage: Define
// ---------------------------------------------------------------------------

function DefineStage(props: GuidedJourneyProps & { recordDecision: (label: string, value: string) => void }) {
  const { course, onUpdateCourse } = props;
  const sources = course.settings.sourceFiles;
  return (
    <div className="gj-stack">
      <label className="gj-label" htmlFor="gj-brief">Describe your course in a sentence or two</label>
      <textarea
        id="gj-brief"
        className="gj-textarea"
        rows={4}
        value={course.description}
        onChange={(event) => {
          const description = event.target.value;
          onUpdateCourse((current) => ({ ...current, description }));
        }}
        onBlur={() => props.recordDecision("Course", course.title || "Your course")}
      />
      <p className="gj-tiny">
        Plain language is fine. Attach a syllabus or last year&rsquo;s Canvas export from the Create flow — we read them for structure, never invent facts.
      </p>
      <section>
        <h3 className="gj-h3">Source materials</h3>
        {sources.length === 0 ? (
          <p className="gj-tiny">No files attached.</p>
        ) : (
          <ul className="gj-chips">
            {sources.map((file) => (
              <li key={file.name} className="gj-chip"><FileText size={13} /> {file.name}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage: Configure
// ---------------------------------------------------------------------------

function ConfigureStage(props: GuidedJourneyProps & { recordDecision: (label: string, value: string) => void }) {
  const { course, onUpdateCourse, recordDecision } = props;
  const weeks = course.settings.lengthWeeks;
  const weekOptions = Array.from(new Set([weeks, 8, 12, 15, 16].filter((value) => Number.isFinite(value) && value > 0))).sort((a, b) => a - b);
  // A saved course may carry a custom value outside the canonical lists; keep
  // it selectable rather than showing nothing as active.
  const levelOptions = Array.from(new Set([course.settings.level, ...LEVEL_OPTIONS].filter(Boolean)));
  const modalityOptions = Array.from(new Set([course.settings.modality, ...MODALITY_OPTIONS].filter(Boolean)));
  return (
    <div className="gj-stack">
      <div className="gj-field">
        <span className="gj-field__k">Level</span>
        <div className="gj-seg" role="group" aria-label="Course level">
          {levelOptions.map((option) => (
            <button
              key={option}
              type="button"
              className={`gj-seg__b ${option === course.settings.level ? "is-on" : ""}`}
              onClick={() => {
                onUpdateCourse((current) => ({ ...current, settings: { ...current.settings, level: option } }));
                recordDecision("Level", option);
              }}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
      <div className="gj-field">
        <span className="gj-field__k">Length</span>
        <div className="gj-seg" role="group" aria-label="Course length">
          {weekOptions.map((option) => (
            <button
              key={option}
              type="button"
              className={`gj-seg__b ${option === weeks ? "is-on" : ""}`}
              onClick={() => {
                onUpdateCourse((current) => ({ ...current, settings: { ...current.settings, lengthWeeks: option } }));
                recordDecision("Length", `${option} weeks`);
              }}
            >
              {option} weeks
            </button>
          ))}
        </div>
      </div>
      <div className="gj-field">
        <span className="gj-field__k">Meets</span>
        <div className="gj-seg" role="group" aria-label="Modality">
          {modalityOptions.map((option) => (
            <button
              key={option}
              type="button"
              className={`gj-seg__b ${option === course.settings.modality ? "is-on" : ""}`}
              onClick={() => {
                onUpdateCourse((current) => ({ ...current, settings: { ...current.settings, modality: option } }));
                recordDecision("Modality", option);
              }}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
      <div className="gj-field">
        <span className="gj-field__k">Assessment mix</span>
        <span className="gj-tiny">
          {course.assignmentGroups.map((group) => `${group.name} ${group.weight}%`).join(" · ") || "No grade groups yet."}
        </span>
      </div>
      <p className="gj-callout gj-tiny">
        💡 Changing any of these reshapes the plan for the whole course. Finer details — individual pages, rubrics, due dates — are edited where they live, later on.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage: Blueprint
// ---------------------------------------------------------------------------

function BlueprintStage(props: GuidedJourneyProps & { recordDecision: (label: string, value: string) => void }) {
  const { course, onUpdateCourse, recordDecision } = props;
  const contentModules = course.modules.filter((module) => module.kind === "content");
  return (
    <div className="gj-stack">
      <p className="gj-lead">The approved architecture behind this course. Course-level decisions changed here apply everywhere.</p>

      <section className="gj-card">
        <h3 className="gj-h3">Outcomes <span className="gj-pill">{course.outcomes.length}</span></h3>
        <ul className="gj-list">
          {course.outcomes.map((outcome) => (
            <li key={outcome.id}><strong>{outcome.code}</strong> {outcome.text}</li>
          ))}
        </ul>
      </section>

      <section className="gj-card">
        <h3 className="gj-h3">Module sequence <span className="gj-pill">{course.modules.length} modules over {course.settings.lengthWeeks} weeks</span></h3>
        <ul className="gj-list">
          {course.modules.map((module) => (
            <li key={module.id}>{module.title} <span className="gj-tiny">· {module.workloadHours}h</span></li>
          ))}
        </ul>
      </section>

      <section className="gj-card">
        <h3 className="gj-h3">Assessment strategy <span className="gj-pill">{course.assignmentGroups.reduce((sum, group) => sum + group.weight, 0)}%</span></h3>
        <ul className="gj-list">
          {course.assignmentGroups.map((group) => (
            <li key={group.id}>{group.name} · {group.weight}%</li>
          ))}
        </ul>
      </section>

      <section className="gj-card">
        <h3 className="gj-h3">Change a course-level decision</h3>
        <p className="gj-tiny">🌐 Affects the whole course, not one item.</p>
        <div className="gj-field">
          <span className="gj-field__k">Course length</span>
          <div className="gj-seg" role="group" aria-label="Course length">
            {Array.from(new Set([course.settings.lengthWeeks, 8, 12, 15, 16])).sort((a, b) => a - b).map((option) => (
              <button
                key={option}
                type="button"
                className={`gj-seg__b ${option === course.settings.lengthWeeks ? "is-on" : ""}`}
                onClick={() => {
                  onUpdateCourse((current) => ({ ...current, settings: { ...current.settings, lengthWeeks: option } }));
                  recordDecision("Length", `${option} weeks`);
                }}
              >
                {option} wks
              </button>
            ))}
          </div>
        </div>
        <div className="gj-field">
          <span className="gj-field__k">Rubrics on graded work</span>
          <button
            type="button"
            role="switch"
            aria-checked={course.settings.includeRubrics}
            className={`gj-toggle ${course.settings.includeRubrics ? "is-on" : ""}`}
            onClick={() => {
              onUpdateCourse((current) => ({ ...current, settings: { ...current.settings, includeRubrics: !current.settings.includeRubrics } }));
              recordDecision("Rubrics", course.settings.includeRubrics ? "Off" : "On");
            }}
          >
            <span className="gj-toggle__dot" />
          </button>
        </div>
        <div className="gj-field">
          <span className="gj-field__k">Interaction density</span>
          <div className="gj-seg" role="group" aria-label="Interaction density">
            {(["minimal", "balanced", "rich", "immersive"] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={`gj-seg__b ${(course.settings.interactionDensity ?? "balanced") === option ? "is-on" : ""}`}
                onClick={() => {
                  onUpdateCourse((current) => ({ ...current, settings: { ...current.settings, interactionDensity: option } }));
                  recordDecision("Interactions", option);
                }}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
        <p className="gj-tiny">{contentModules.length} content modules · workload {contentModules.reduce((sum, module) => sum + module.workloadHours, 0)}h planned.</p>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage: Generate
// ---------------------------------------------------------------------------

function GenerateStage({ course, built, onStartBuild }: { course: CourseProject; built: boolean; onStartBuild: () => void }) {
  if (!built) {
    return (
      <div className="gj-stack">
        <p className="gj-lead">This course has no content yet — let&rsquo;s build the first draft.</p>
        <p className="gj-tiny">
          You&rsquo;ll describe the course, approve the plan RocketCourse proposes, and the draft lands back here for review. Nothing is published anywhere.
        </p>
        <div>
          <button type="button" className="primary" onClick={onStartBuild}>
            <Sparkles size={15} /> Build my first draft
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="gj-stack">
      <div className="gj-gencard">
        <Sparkles size={18} aria-hidden="true" />
        <div>
          <h3 className="gj-h3">Draft built</h3>
          <p className="gj-tiny">
            {course.modules.length} modules · {course.pages.length} pages · {course.assignments.length} assignments · {course.discussions.length} discussions · {course.quizzes.length} quizzes
          </p>
          <p className="gj-tiny">This is a first draft, not a finished course — everything is editable in Review, next.</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage: Review
// ---------------------------------------------------------------------------

function ReviewStage(props: GuidedJourneyProps & {
  currentModuleId: string | null;
  openItemId: string | null;
  onSelectModule: (id: string) => void;
  onOpenItem: (id: string | null) => void;
}) {
  const { course, currentModuleId, openItemId } = props;
  const module = course.modules.find((entry) => entry.id === currentModuleId) ?? course.modules[0];
  if (!module) return <p className="gj-tiny">No modules yet.</p>;
  const openItem = openItemId ? module.items.find((item) => item.id === openItemId) ?? null : null;

  const moveItem = (item: ModuleItem, direction: -1 | 1): void => {
    props.onUpdateCourse((current) => ({
      ...current,
      modules: current.modules.map((entry) => {
        if (entry.id !== module.id) return entry;
        const items = [...entry.items].sort((a, b) => a.order - b.order);
        const index = items.findIndex((candidate) => candidate.id === item.id);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= items.length) return entry;
        [items[index], items[target]] = [items[target], items[index]];
        return { ...entry, items: items.map((candidate, position) => ({ ...candidate, order: position + 1 })) };
      })
    }));
  };

  const moduleLabel = (entry: CourseModule): string =>
    entry.kind === "start" ? "Start" : entry.kind === "final" ? "Final" : entry.kind === "instructor" ? "Instr." : String(course.modules.filter((candidate) => candidate.kind === "content").findIndex((candidate) => candidate.id === entry.id) + 1);

  return (
    <div className="gj-stack">
      <div className="gj-modrail" role="tablist" aria-label="Modules">
        {course.modules.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={entry.id === module.id}
            className={`gj-modchip ${entry.id === module.id ? "is-on" : ""} ${entry.items.some((item) => itemAttention(item, course)) ? "has-attn" : ""}`}
            onClick={() => props.onSelectModule(entry.id)}
          >
            {moduleLabel(entry)}
          </button>
        ))}
      </div>
      <h3 className="gj-h3">{module.title}</h3>
      {module.description && <p className="gj-tiny">{module.description}</p>}
      <p className="gj-tiny">Reorder with ↑ ↓ · open an item to edit it. The scope of every edit is one item.</p>
      <ul className="gj-items">
        {[...module.items].sort((a, b) => a.order - b.order).map((item, index, all) => {
          const attention = itemAttention(item, course);
          return (
            <li key={item.id} className={`gj-item ${item.id === openItem?.id ? "is-open" : ""}`}>
              <button
                type="button"
                className="gj-item__open"
                aria-label={`${item.id === openItem?.id ? "Close" : "Open"} ${item.type} ${item.title}`}
                onClick={() => props.onOpenItem(item.id === openItem?.id ? null : item.id)}
              >
                <span className="gj-item__type">{item.type}</span>
                <span className="gj-item__title">{item.title}</span>
                {item.status === "edited" && <span className="gj-pill gj-pill--ok">edited</span>}
                {attention && <span className="gj-pill gj-pill--warn">{attention}</span>}
              </button>
              <span className="gj-item__move">
                <button type="button" aria-label="Move up" disabled={index === 0} onClick={() => moveItem(item, -1)}><ChevronUp size={14} /></button>
                <button type="button" aria-label="Move down" disabled={index === all.length - 1} onClick={() => moveItem(item, 1)}><ChevronDown size={14} /></button>
              </span>
            </li>
          );
        })}
      </ul>
      {openItem ? <ItemEditor {...props} item={openItem} /> : <p className="gj-tiny">Select an item to edit it here.</p>}
    </div>
  );
}

function ItemEditor(props: GuidedJourneyProps & { item: ModuleItem }) {
  const { course, item, onUpdateCourse, onOpenFullEditor } = props;
  if (item.type === "page") {
    const page = course.pages.find((entry) => entry.id === item.refId);
    if (!page) return null;
    const rich = RICH_LAYOUT_TAG.test(page.bodyHtml);
    return (
      <section className="gj-editor" aria-label={`Edit ${page.title}`}>
        <header className="gj-editor__bar">
          <span className="gj-pill"><FileText size={12} /> Page</span>
          <span className="gj-tiny">Scope · one page</span>
        </header>
        <input
          className="gj-input"
          aria-label="Page title"
          value={page.title}
          onChange={(event) => {
            const title = event.target.value;
            onUpdateCourse((current) => ({
              ...current,
              pages: current.pages.map((entry) => (entry.id === page.id ? { ...entry, title } : entry)),
              modules: current.modules.map((module) => ({
                ...module,
                items: module.items.map((entry) => (entry.refId === page.id ? { ...entry, title } : entry))
              }))
            }));
          }}
        />
        {rich ? (
          <>
            <p className="gj-tiny">Rich layout page · shown exactly as students will see it.</p>
            <article className="gj-preview prose" dangerouslySetInnerHTML={{ __html: resolvePreviewImageSources(sanitizeHtmlForPreview(page.bodyHtml)) }} />
            <button type="button" className="ghost-button" onClick={() => onOpenFullEditor("Pages")}>
              <ExternalLink size={14} /> Open the full layout editor
            </button>
          </>
        ) : (
          <textarea
            className="gj-textarea"
            aria-label="Page content"
            rows={10}
            defaultValue={htmlToText(page.bodyHtml)}
            onBlur={(event) => {
              const bodyHtml = textToHtml(event.target.value);
              onUpdateCourse((current) => ({
                ...current,
                pages: current.pages.map((entry) => (entry.id === page.id ? { ...entry, bodyHtml, status: "edited" } : entry))
              }));
            }}
          />
        )}
      </section>
    );
  }
  if (item.type === "assignment") {
    const assignment = course.assignments.find((entry) => entry.id === item.refId);
    if (!assignment) return null;
    return <AssignmentView assignment={assignment} course={course} onOpenFullEditor={onOpenFullEditor} />;
  }
  if (item.type === "discussion") {
    const discussion = course.discussions.find((entry) => entry.id === item.refId);
    if (!discussion) return null;
    return <DiscussionEditor discussion={discussion} onUpdateCourse={onUpdateCourse} />;
  }
  if (item.type === "quiz") {
    const quiz = course.quizzes.find((entry) => entry.id === item.refId);
    if (!quiz) return null;
    return <QuizView quiz={quiz} onUpdateCourse={onUpdateCourse} onOpenFullEditor={onOpenFullEditor} />;
  }
  return null;
}

function AssignmentView({ assignment, course, onOpenFullEditor }: { assignment: Assignment; course: CourseProject; onOpenFullEditor: (tab: EditorTab) => void }) {
  const rubric = assignment.rubricId ? course.rubrics.find((entry) => entry.id === assignment.rubricId) : undefined;
  const rubricIncomplete = rubric ? rubric.criteria.some((criterion) => criterion.levels.length === 0) : false;
  return (
    <section className="gj-editor" aria-label={`Assignment ${assignment.title}`}>
      <header className="gj-editor__bar">
        <span className="gj-pill"><PencilLine size={12} /> Assignment</span>
        <span className="gj-tiny">{assignment.points} pts · {assignment.submissionType}</span>
      </header>
      <h4 className="gj-h4">{assignment.title}</h4>
      <article className="gj-preview prose" dangerouslySetInnerHTML={{ __html: resolvePreviewImageSources(sanitizeHtmlForPreview(assignment.descriptionHtml)) }} />
      {rubric && (
        <p className="gj-tiny">
          Rubric: {rubric.title} · {rubric.criteria.length} criteria{rubricIncomplete ? " · some criteria have no levels yet" : " · complete"}
        </p>
      )}
      <button type="button" className="ghost-button" onClick={() => onOpenFullEditor("Assignments")}>
        <ExternalLink size={14} /> Edit this assignment in detail
      </button>
    </section>
  );
}

function DiscussionEditor({ discussion, onUpdateCourse }: { discussion: Discussion; onUpdateCourse: GuidedJourneyProps["onUpdateCourse"] }) {
  return (
    <section className="gj-editor" aria-label={`Discussion ${discussion.title}`}>
      <header className="gj-editor__bar">
        <span className="gj-pill"><MessageSquare size={12} /> Discussion</span>
        <span className="gj-tiny">{discussion.points} pts · Scope · one discussion</span>
      </header>
      <h4 className="gj-h4">{discussion.title}</h4>
      <textarea
        className="gj-textarea"
        aria-label="Discussion prompt"
        rows={5}
        defaultValue={stripHtml(discussion.promptHtml)}
        onBlur={(event) => {
          const promptHtml = textToHtml(event.target.value);
          onUpdateCourse((current) => ({
            ...current,
            discussions: current.discussions.map((entry) => (entry.id === discussion.id ? { ...entry, promptHtml, status: "edited" } : entry))
          }));
        }}
      />
      <p className="gj-tiny">Edits apply when you click away.</p>
    </section>
  );
}

function QuizView({ quiz, onUpdateCourse, onOpenFullEditor }: { quiz: Quiz; onUpdateCourse: GuidedJourneyProps["onUpdateCourse"]; onOpenFullEditor: (tab: EditorTab) => void }) {
  const needsReview = quizNeedsKeyReview(quiz);
  return (
    <section className="gj-editor" aria-label={`Quiz ${quiz.title}`}>
      <header className="gj-editor__bar">
        <span className="gj-pill"><ListChecks size={12} /> Quiz</span>
        <span className="gj-tiny">{quiz.questions.length} questions · {quiz.points} pts</span>
      </header>
      <h4 className="gj-h4">{quiz.title}</h4>
      <ol className="gj-list">
        {quiz.questions.slice(0, 5).map((question) => (
          <li key={question.id}>
            {stripHtml(question.stem).slice(0, 120)}
            {question.instructorReviewRequired && <span className="gj-pill gj-pill--warn">key unverified</span>}
          </li>
        ))}
        {quiz.questions.length > 5 && <li className="gj-tiny">…and {quiz.questions.length - 5} more</li>}
      </ol>
      {needsReview ? (
        <button
          type="button"
          className="primary"
          onClick={() =>
            onUpdateCourse((current) => ({
              ...current,
              quizzes: current.quizzes.map((entry) =>
                entry.id === quiz.id
                  ? { ...entry, questions: entry.questions.map((question) => ({ ...question, instructorReviewRequired: false })), status: "edited" }
                  : entry
              )
            }))
          }
        >
          <ShieldCheck size={15} /> Mark answer key verified
        </button>
      ) : (
        <p className="gj-tiny"><CheckCircle2 size={13} /> Answer key verified.</p>
      )}
      <button type="button" className="ghost-button" onClick={() => onOpenFullEditor("Quizzes")}>
        <ExternalLink size={14} /> Edit the questions in detail
      </button>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Stage: Fix issues
// ---------------------------------------------------------------------------

function ResolveStage({ course, readiness, onAutoRepair, onOpenFullEditor }: {
  course: CourseProject;
  readiness: ReturnType<typeof buildReadinessReport>;
  onAutoRepair: () => string[];
  onOpenFullEditor: (tab: EditorTab) => void;
}) {
  void course;
  // AI first: entering this stage runs the repair engine before showing the
  // user anything. What it fixed is celebrated quietly; only what genuinely
  // needs human judgment is left as work.
  const [autoFixes, setAutoFixes] = useState<string[] | null>(null);
  const ranRepair = useRef(false);
  useEffect(() => {
    if (ranRepair.current) return;
    ranRepair.current = true;
    setAutoFixes(onAutoRepair());
  }, [onAutoRepair]);

  const failing = readiness.checks.filter((check) => !check.passed);
  const blockers = failing.filter((check) => check.severity === "required");
  const advisories = failing.filter((check) => check.severity === "recommended");
  return (
    <div className="gj-stack">
      <p className="gj-lead">
        RocketCourse repairs structural problems automatically as you work. Anything left below needs your judgment — every item says exactly what to do.
      </p>
      {autoFixes && autoFixes.length > 0 && (
        <section className="gj-card gj-celebrate" role="status">
          <h3 className="gj-h3"><Sparkles size={15} aria-hidden="true" /> Fixed for you just now</h3>
          <ul className="gj-list">
            {autoFixes.map((fix) => (
              <li key={fix}><CheckCircle2 size={13} aria-hidden="true" /> {fix}</li>
            ))}
          </ul>
        </section>
      )}
      {failing.length === 0 && <p className="gj-tiny"><CheckCircle2 size={14} /> Everything checks out. Ready to export.</p>}
      {[{ title: "Needs your judgment before export", list: blockers, warn: true }, { title: "Ways to make it even better", list: advisories, warn: false }]
        .filter((group) => group.list.length > 0)
        .map((group) => (
          <section key={group.title} className="gj-card">
            <h3 className="gj-h3">{group.title} <span className={`gj-pill ${group.warn ? "gj-pill--warn" : ""}`}>{group.list.length}</span></h3>
            <ul className="gj-issues">
              {group.list.map((check) => {
                const tab = tabForCheck(check.id);
                return (
                  <li key={check.id}>
                    <div>
                      <strong>{check.label}</strong>
                      <p className="gj-tiny">{check.detail}</p>
                    </div>
                    <button type="button" className="ghost-button" onClick={() => onOpenFullEditor(tab)}>
                      Fix in {tab} <ExternalLink size={13} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage: Student preview
// ---------------------------------------------------------------------------

function PreviewStage({ course, previewModuleId, onSelectModule }: {
  course: CourseProject;
  previewModuleId: string | null;
  onSelectModule: (id: string | null) => void;
}) {
  const homepage = course.pages.find((page) => page.frontPage);
  const module = previewModuleId ? course.modules.find((entry) => entry.id === previewModuleId) : null;
  return (
    <div className="gj-stack">
      <p className="gj-lead">This is the student&rsquo;s view. Move between weeks; open any item to read it as a student would.</p>
      <div className="gj-spv">
        <div className="gj-spv__bar"><Eye size={13} /> Student view <span className="gj-tiny">Read-only · what students see in Canvas</span></div>
        <div className="gj-modrail">
          <button type="button" className={`gj-modchip ${!module ? "is-on" : ""}`} onClick={() => onSelectModule(null)}>Home</button>
          {course.modules.filter((entry) => entry.kind !== "instructor").map((entry, index) => (
            <button key={entry.id} type="button" className={`gj-modchip ${entry.id === module?.id ? "is-on" : ""}`} onClick={() => onSelectModule(entry.id)}>
              {entry.kind === "content" ? `Wk ${index}` : entry.title.split(" ")[0]}
            </button>
          ))}
        </div>
        {!module && homepage && (
          <article className="gj-preview prose" dangerouslySetInnerHTML={{ __html: resolvePreviewImageSources(sanitizeHtmlForPreview(homepage.bodyHtml)) }} />
        )}
        {module && (
          <div className="gj-stack">
            <h3 className="gj-h3">{module.title}</h3>
            {module.description && <p className="gj-tiny">{module.description}</p>}
            <ul className="gj-list">
              {[...module.items].sort((a, b) => a.order - b.order).map((item) => (
                <li key={item.id}><span className="gj-item__type">{item.type}</span> {item.title}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage: Export
// ---------------------------------------------------------------------------

function ExportStage(props: GuidedJourneyProps & { readinessBlockers: number }) {
  const { course, validationReport } = props;
  const filling = props.isFillingContent;
  const [exportFixes, setExportFixes] = useState<string[] | null>(null);
  const blockingIssues = validationReport?.issues.filter((issue) => issue.severity === "error").length ?? 0;
  return (
    <div className="gj-stack">
      <p className="gj-lead">Export to Canvas · Canvas-oriented Common Cartridge (.imscc)</p>
      <ol className="gj-expsteps">
        <li className="gj-card">
          {props.demoMode ? (
            <>
              <div className="gj-expstep__head">
                <strong>1 · Sample content</strong> <span className="gj-pill gj-pill--ok">Pre-populated</span>
              </div>
              <p className="gj-tiny">
                This demo course is already filled in. Full-course AI generation is available in a signed-in workspace,
                so exploring the demo never spends AI credit.
              </p>
            </>
          ) : (
            <>
              <div className="gj-expstep__head">
                <strong>1 · Generate full content</strong> <span className="gj-pill">recommended</span>
              </div>
              <p className="gj-tiny">Flesh every module into complete pages, assignments, and quizzes. Uses AI credit per empty item.</p>
              <button type="button" className="ghost-button" disabled={filling} onClick={props.onFillFullContent}>
                <Sparkles size={14} /> {filling ? "Generating…" : "Generate full content"}
              </button>
              {props.fillProgress && (
                <p className="gj-tiny" role="status">{props.fillProgress.completed}/{props.fillProgress.total} · {props.fillProgress.label}</p>
              )}
              {props.fillSummary && <p className="gj-tiny">{props.fillSummary}</p>}
            </>
          )}
        </li>
        <li className="gj-card">
          <div className="gj-expstep__head">
            <strong>2 · Remaining issues</strong>
            {props.readinessBlockers === 0 ? <span className="gj-pill gj-pill--ok">All clear</span> : <span className="gj-pill gj-pill--warn">{props.readinessBlockers} open</span>}
          </div>
          <p className="gj-tiny">
            {props.readinessBlockers === 0
              ? "Nothing needs attention — structural repairs are applied automatically."
              : "Try the automatic fix first; anything still listed afterwards needs your judgment in the Improve step."}
          </p>
          {props.readinessBlockers > 0 && (
            <button type="button" className="ghost-button" onClick={() => setExportFixes(props.onAutoRepair())}>
              <Sparkles size={14} /> Fix automatically
            </button>
          )}
          {exportFixes && (
            <p className="gj-tiny" role="status">
              {exportFixes.length > 0
                ? `✓ Applied ${exportFixes.length} automatic repair${exportFixes.length === 1 ? "" : "s"}.`
                : "Nothing here can be fixed automatically — what remains needs your judgment in the Improve step."}
            </p>
          )}
        </li>
        <li className="gj-card">
          <div className="gj-expstep__head"><strong>3 · Validate & download</strong></div>
          <p className="gj-tiny">Downloading always validates the package first — if anything would break the Canvas import, the download stops with a fix list.</p>
          <div className="gj-row">
            <button type="button" className="ghost-button" disabled={filling} onClick={props.onRunValidation}>Validate only</button>
            <button type="button" className="primary" disabled={filling || !props.exportAllowed} onClick={props.onDownload}>
              <Download size={15} /> Download Canvas package (.imscc)
            </button>
          </div>
          {validationReport && (
            <p className="gj-tiny" role="status">
              {validationReport.valid
                ? `✓ Package validated — ready for Canvas (score ${validationReport.score}).`
                : `${blockingIssues} issue${blockingIssues === 1 ? " needs" : "s need"} your judgment — automatic repairs were already applied. The Improve step lists each one.`}
            </p>
          )}
        </li>
      </ol>
      <p className="gj-tiny">
        Contents · {course.modules.length} modules · {course.pages.length} pages · {course.assignments.length} assignments · {course.discussions.length} discussions · {course.quizzes.length} quizzes
      </p>
      <p className="gj-tiny">🛈 Canvas import is not verified. Always test the package in a blank or sandbox Canvas course first.</p>
    </div>
  );
}
