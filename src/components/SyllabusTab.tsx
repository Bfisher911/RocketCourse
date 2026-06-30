import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Code2,
  Eye,
  FileText,
  LayoutTemplate,
  Monitor,
  Plus,
  Printer,
  RotateCcw,
  Smartphone,
  Sparkles,
  Tablet,
  Trash2,
  Undo2,
  Wand2,
  X
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_SYLLABUS_TEMPLATE_ID,
  PRINTABLE_HTML_HREF,
  PRINTABLE_PDF_HREF,
  SYLLABUS_REVISE_ACTIONS,
  SYLLABUS_TEMPLATES,
  chooseSyllabusTemplate,
  createSyllabusState,
  defaultSyllabusContent,
  renderSyllabus,
  reviseSyllabusContent,
  syllabusContextFromCourse,
  syllabusTemplateMeta,
  type SyllabusReviseAction
} from "../services/syllabusTemplates";
import { validateSyllabus, type SyllabusValidationResult } from "../services/syllabusValidation";
import { canvasRefTargets } from "../services/canvasLinks";
import { slugify, stripHtml } from "../utils/text";
import { aiGenerateSyllabusContent } from "../services/aiBuilders";
import { useAiAction } from "../hooks/useAiAction";
import { AiGenerateButton, AiSourceNote } from "./AiGenerateButton";
import { ReadinessRing } from "./ReadinessRing";
import { RockContentToolbox } from "./RockContentToolbox";
import type { CourseProject, SyllabusContent, SyllabusSnapshot, SyllabusState } from "../types";

type UpdateCourse = (updater: (current: CourseProject) => CourseProject) => void;
type PreviewMode = "desktop" | "tablet" | "mobile" | "printFriendly";

const MAX_SNAPSHOTS = 12;

const newId = (prefix: string): string => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

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

const knownTargetsFor = (course: CourseProject): Set<string> => {
  const targets = new Set<string>([PRINTABLE_HTML_HREF, PRINTABLE_PDF_HREF]);
  course.pages.forEach((page) => {
    const slug = slugify(page.slug || page.title);
    targets.add(`${slug}.html`);
    targets.add(`wiki_content/${slug}.html`);
    if (page.slug) targets.add(`${page.slug}.html`);
  });
  course.fileAssets.forEach((asset) => {
    targets.add(asset.path);
    targets.add(`../${asset.path}`);
    targets.add(asset.fileName);
  });
  canvasRefTargets(course).forEach((target) => targets.add(target));
  return targets;
};

const plainSnippet = (value: string): string => {
  const text = stripHtml(value).replace(/\s+/g, " ").trim();
  return text.length > 140 ? `${text.slice(0, 137)}...` : text;
};

const statusOf = (value: string | string[]): "Complete" | "Needs review" | "Missing" => {
  const joined = Array.isArray(value) ? value.join(" ") : value;
  if (!joined.trim()) return "Missing";
  if (/(instructor should|placeholder|before publishing|official|local policy|add required|verify)/i.test(joined)) return "Needs review";
  return "Complete";
};

const compareContents = (current: SyllabusContent, previous: SyllabusContent, currentTemplate: string, previousTemplate: string, score: number, previousScore: number): string[] => {
  const changes: string[] = [];
  if (currentTemplate !== previousTemplate) changes.push(`Template: ${syllabusTemplateMeta(previousTemplate).name} -> ${syllabusTemplateMeta(currentTemplate).name}`);
  if (score !== previousScore) changes.push(`Validation score: ${previousScore} -> ${score}`);
  (Object.keys(current) as Array<keyof SyllabusContent>).forEach((key) => {
    const currentValue = Array.isArray(current[key]) ? (current[key] as string[]).join("|") : String(current[key]);
    const previousValue = Array.isArray(previous[key]) ? (previous[key] as string[]).join("|") : String(previous[key]);
    if (currentValue !== previousValue) changes.push(`${String(key)} changed`);
  });
  return changes.length ? changes.slice(0, 8) : ["No structured differences detected."];
};

const sectionConfigs: Array<{
  key: keyof SyllabusContent;
  title: string;
  type: "text" | "textarea" | "list";
  hint: string;
}> = [
  { key: "courseDescription", title: "Course description", type: "textarea", hint: "Student-facing course purpose and scope." },
  { key: "learningOutcomes", title: "Course learning outcomes", type: "list", hint: "Measurable outcomes students should be able to demonstrate." },
  { key: "requiredMaterials", title: "Required materials", type: "list", hint: "Verified readings, OER, software, media, and instructor-added materials." },
  { key: "scheduleSummary", title: "Weekly rhythm or schedule summary", type: "textarea", hint: "The plain-language pacing explanation." },
  { key: "weeklySchedule", title: "Weekly schedule", type: "list", hint: "Module-by-module schedule lines or pacing notes." },
  { key: "gradingBreakdown", title: "Grading breakdown", type: "list", hint: "Gradebook categories, weights, and grading notes." },
  { key: "assignmentOverview", title: "Assignment overview", type: "list", hint: "Major assignments, discussions, quizzes, and final work." },
  { key: "communicationExpectations", title: "Communication expectations", type: "textarea", hint: "Office hours, announcements, contact methods, and response-time expectations." },
  { key: "lateWorkPolicy", title: "Late work policy", type: "textarea", hint: "Institution- or instructor-specific policy placeholder." },
  { key: "academicIntegrityPolicy", title: "Academic integrity policy", type: "textarea", hint: "Official integrity policy or instructor-editable placeholder." },
  { key: "aiUsePolicy", title: "AI use policy", type: "textarea", hint: "Course AI-use expectations with honest local-policy placeholders." },
  { key: "accessibilityAccommodations", title: "Accessibility and accommodations", type: "textarea", hint: "Accommodation process, accessible materials, and media expectations." },
  { key: "studentSupportResources", title: "Student support resources", type: "list", hint: "Canvas help, library, tutoring, advising, accessibility, and student success." },
  { key: "instructorContactBlock", title: "Instructor contact block", type: "textarea", hint: "Instructor name, office hours, contact method, and response time." },
  { key: "workloadContactHours", title: "Workload and contact hours", type: "textarea", hint: "Credit-hour, workload, and time-on-task explanation." },
  { key: "technologyRequirements", title: "Technology requirements", type: "textarea", hint: "Canvas access, files, browser/device/software, and media requirements." },
  { key: "instructorReviewNotes", title: "Instructor review notes", type: "list", hint: "Local policy, resource, and schedule checks before publication." }
];

export function SyllabusTab({ course, onUpdateCourse }: { course: CourseProject; onUpdateCourse: UpdateCourse }) {
  const page = course.pages.find((item) => item.slug === "syllabus") ?? course.pages[1];
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const [showGallery, setShowGallery] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    courseDescription: true,
    learningOutcomes: true,
    gradingBreakdown: true,
    assignmentOverview: true
  });
  const [compareId, setCompareId] = useState<string | null>(null);
  const htmlEditorRef = useRef<HTMLTextAreaElement | null>(null);
  const ai = useAiAction();

  useEffect(() => {
    if (page && !course.syllabus) {
      const context = syllabusContextFromCourse(course);
      const content = defaultSyllabusContent(context);
      const templateId = chooseSyllabusTemplate(context);
      const initial: SyllabusState = { ...createSyllabusState(content, templateId, course.theme.id, new Date().toISOString()), mode: "custom" };
      onUpdateCourse((current) => ({ ...current, syllabus: initial }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page?.id, course.syllabus]);

  const knownTargets = useMemo(() => knownTargetsFor(course), [course.pages, course.fileAssets]);
  const validation: SyllabusValidationResult = useMemo(
    () => validateSyllabus(page?.bodyHtml ?? "", { knownTargets, includeContactHours: course.settings.includeContactHours }),
    [page?.bodyHtml, knownTargets, course.settings.includeContactHours]
  );
  const state = course.syllabus;
  const context = useMemo(() => syllabusContextFromCourse(course), [course]);
  const content = state?.content;
  const isCustom = state?.mode === "custom";
  const themeDrift = Boolean(state && state.mode === "builder" && state.themeId !== course.theme.id);
  const compareSnapshot = state?.snapshots.find((snapshot) => snapshot.id === compareId) ?? null;
  const printableReady = course.fileAssets.some((asset) => asset.path === "web_resources/syllabus-printable.html") && course.fileAssets.some((asset) => asset.path === "web_resources/syllabus-printable.pdf");

  if (!page) return <div className="hp-empty"><h2>Syllabus missing</h2><p>Generate or add a syllabus page before export.</p></div>;

  const writeSyllabus = (nextState: SyllabusState, bodyHtml: string): void => {
    const updatedAt = new Date().toISOString();
    onUpdateCourse((current) => ({
      ...current,
      syllabus: { ...nextState, updatedAt },
      pages: current.pages.map((item) =>
        item.id === page.id
          ? { ...item, bodyHtml, status: "edited", metadata: { ...item.metadata, updatedAt, source: "edited" } }
          : item
      )
    }));
  };

  const snapshotOf = (label: string): SyllabusSnapshot | null => {
    if (!state) return null;
    return {
      id: newId("syllabus_snap"),
      label,
      takenAt: new Date().toISOString(),
      mode: state.mode,
      templateId: state.templateId,
      content: state.content,
      bodyHtml: page.bodyHtml,
      validationScore: validation.score
    };
  };

  const withSnapshot = (label: string, snapshots: SyllabusSnapshot[]): SyllabusSnapshot[] => {
    const snap = snapshotOf(label);
    if (!snap) return snapshots;
    return [snap, ...snapshots].slice(0, MAX_SNAPSHOTS);
  };

  const updateContent = (patch: Partial<SyllabusContent> | ((prev: SyllabusContent) => SyllabusContent)): void => {
    if (!state) return;
    const nextContent = typeof patch === "function" ? patch(state.content) : { ...state.content, ...patch };
    const html = renderSyllabus(state.templateId, nextContent, course.theme);
    writeSyllabus({ ...state, content: nextContent, mode: "builder", themeId: course.theme.id }, html);
  };

  const applyTemplate = (templateId: string): void => {
    if (!state) return;
    const html = renderSyllabus(templateId, state.content, course.theme);
    writeSyllabus(
      { ...state, templateId, mode: "builder", themeId: course.theme.id, snapshots: withSnapshot(`Before applying ${syllabusTemplateMeta(templateId).name}`, state.snapshots) },
      html
    );
    setShowGallery(false);
  };

  const refreshTheme = (): void => {
    if (!state) return;
    const html = renderSyllabus(state.templateId, state.content, course.theme);
    writeSyllabus({ ...state, mode: "builder", themeId: course.theme.id, snapshots: withSnapshot("Before theme refresh", state.snapshots) }, html);
  };

  const runRevise = (action: SyllabusReviseAction): void => {
    if (!state) return;
    const meta = SYLLABUS_REVISE_ACTIONS.find((item) => item.id === action);
    const nextContent = reviseSyllabusContent(action, state.content, context);
    const html = renderSyllabus(state.templateId, nextContent, course.theme);
    writeSyllabus(
      { ...state, content: nextContent, mode: "builder", themeId: course.theme.id, snapshots: withSnapshot(`Before "${meta?.label ?? action}"`, state.snapshots) },
      html
    );
  };

  const generateWithAi = (): void => {
    if (!state) return;
    const baseState = state;
    void ai.run(
      () => aiGenerateSyllabusContent(course, baseState.content),
      (next) => {
        const html = renderSyllabus(baseState.templateId, next, course.theme);
        writeSyllabus(
          { ...baseState, content: next, mode: "builder", themeId: course.theme.id, snapshots: withSnapshot("Before Generate with AI", baseState.snapshots) },
          html
        );
      }
    );
  };

  const saveSnapshot = (): void => {
    if (!state) return;
    onUpdateCourse((current) => ({ ...current, syllabus: current.syllabus ? { ...current.syllabus, snapshots: withSnapshot("Manual save", current.syllabus.snapshots) } : current.syllabus }));
  };

  const enterCustomMode = (): void => {
    if (!state) return;
    onUpdateCourse((current) => ({ ...current, syllabus: current.syllabus ? { ...current.syllabus, mode: "custom", snapshots: withSnapshot("Before advanced HTML edit", current.syllabus.snapshots) } : current.syllabus }));
    setAdvancedOpen(true);
  };

  const editRawHtml = (value: string): void => {
    if (!state) return;
    const updatedAt = new Date().toISOString();
    onUpdateCourse((current) => ({
      ...current,
      syllabus: current.syllabus ? { ...current.syllabus, mode: "custom", updatedAt } : current.syllabus,
      pages: current.pages.map((item) => (item.id === page.id ? { ...item, bodyHtml: value, status: "edited", metadata: { ...item.metadata, updatedAt, source: "edited" } } : item))
    }));
  };

  const applyRockContent = (bodyHtml: string, reason: string): void => {
    if (!state) return;
    const updatedAt = new Date().toISOString();
    onUpdateCourse((current) => ({
      ...current,
      syllabus: current.syllabus
        ? { ...current.syllabus, mode: "custom", updatedAt, snapshots: withSnapshot(`Before ${reason}`, current.syllabus.snapshots) }
        : current.syllabus,
      pages: current.pages.map((item) => (item.id === page.id ? { ...item, bodyHtml, status: "edited", metadata: { ...item.metadata, updatedAt, source: "edited" } } : item))
    }));
    setAdvancedOpen(true);
  };

  const rebuildFromStructured = (): void => {
    if (!state) return;
    const html = renderSyllabus(state.templateId, state.content, course.theme);
    writeSyllabus({ ...state, mode: "builder", themeId: course.theme.id, snapshots: withSnapshot("Before rebuilding from structured fields", state.snapshots) }, html);
  };

  const restoreSnapshot = (snapshot: SyllabusSnapshot): void => {
    if (!state) return;
    writeSyllabus(
      { ...state, mode: snapshot.mode, templateId: snapshot.templateId, content: snapshot.content, themeId: course.theme.id, snapshots: withSnapshot("Before restore", state.snapshots) },
      snapshot.bodyHtml
    );
    setCompareId(null);
  };

  const changeListField = (key: keyof SyllabusContent, items: string[]): void => updateContent((prev) => ({ ...prev, [key]: items }) as SyllabusContent);
  const changeTextField = (key: keyof SyllabusContent, value: string): void => updateContent((prev) => ({ ...prev, [key]: value }) as SyllabusContent);

  const previewHtml = page.bodyHtml;
  const currentTemplateName = state ? syllabusTemplateMeta(state.templateId).name : syllabusTemplateMeta(DEFAULT_SYLLABUS_TEMPLATE_ID).name;
  const statusText = validation.failures ? `${validation.failures} fixes` : validation.warnings ? `${validation.warnings} reviews` : "Ready";

  return (
    <div className="homepage-tab syllabus-tab">
      <section className="hp-summary" aria-label="Syllabus summary">
        <div className="hp-summary-main">
          <span className="hp-eyebrow"><FileText size={14} /> Student-facing Canvas syllabus builder</span>
          <input
            className="hp-title-input"
            aria-label="Syllabus page title"
            value={page.title}
            onChange={(event) => onUpdateCourse((current) => ({ ...current, pages: current.pages.map((item) => (item.id === page.id ? { ...item, title: event.target.value, status: "edited" } : item)) }))}
          />
          <p className="hp-purpose">Course: {course.title} | Theme: {course.theme.name} | Printable copy: {printableReady ? "HTML and simple PDF included in export" : "Not available yet"}</p>
          <div className="hp-meta-row">
            <span><Eye size={13} /> {isCustom ? "Custom HTML" : `${currentTemplateName} template`}</span>
            <span><Printer size={13} /> {printableReady ? "Printable workflow ready" : "Printable copy missing"}</span>
            <span><RotateCcw size={13} /> Updated {relativeTime(state?.updatedAt ?? page.metadata.updatedAt)}</span>
          </div>
        </div>
        <ScoreRing score={validation.score} failures={validation.failures} warnings={validation.warnings} label="syllabus" />
      </section>

      <div className="hp-toolbar">
        <div className="hp-toolbar-group">
          <button className={`hp-btn ${showGallery ? "active" : ""}`} onClick={() => setShowGallery((prev) => !prev)} aria-expanded={showGallery}>
            <LayoutTemplate size={16} /> Templates
          </button>
          <button className="hp-btn" onClick={saveSnapshot}><Undo2 size={16} /> Save snapshot</button>
        </div>
        <div className="hp-toolbar-group">
          {themeDrift && <button className="hp-btn hp-btn-warn" onClick={refreshTheme}><Wand2 size={16} /> Refresh theme styling</button>}
          <button className={`hp-btn ${advancedOpen ? "active" : ""}`} onClick={() => setAdvancedOpen((prev) => !prev)} aria-expanded={advancedOpen}>
            <Code2 size={16} /> Advanced HTML
          </button>
        </div>
      </div>

      {showGallery && content && (
        <section className="hp-gallery" aria-label="Syllabus templates">
          {SYLLABUS_TEMPLATES.map((template) => (
            <div key={template.id} className={`hp-template-card ${state?.templateId === template.id && !isCustom ? "selected" : ""}`}>
              <div className="hp-template-thumb syllabus-template-thumb" aria-hidden="true" dangerouslySetInnerHTML={{ __html: renderSyllabus(template.id, content, course.theme) }} />
              <div className="hp-template-body">
                <div className="hp-template-head">
                  <strong>{template.name}</strong>
                  <span>{template.tagline}</span>
                </div>
                <p>{template.description}</p>
                <small>{template.bestFor}</small>
                <button className="hp-btn hp-btn-primary" onClick={() => applyTemplate(template.id)}>
                  {state?.templateId === template.id && !isCustom ? "Re-apply" : "Apply template"}
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <div className="hp-split syllabus-split">
        <div className="hp-editor">
          <RockContentToolbox
            course={course}
            value={page.bodyHtml}
            surface="syllabus"
            textareaRef={htmlEditorRef}
            onChange={applyRockContent}
          />

          {isCustom ? (
            <div className="hp-custom-panel">
              <div className="hp-mode-banner">
                <AlertTriangle size={15} />
                <span>Custom HTML mode is active. Structured fields remain available, but manual HTML is preserved until you rebuild from the template.</span>
              </div>
              <button className="hp-btn" onClick={rebuildFromStructured}><RotateCcw size={15} /> Restore from structured template</button>
              <p className="hp-hint">This saves a snapshot before replacing the current HTML with the selected template and structured fields.</p>
            </div>
          ) : (
            <>
              <div className="hp-revise" aria-label="Syllabus revise actions">
                <span className="hp-revise-label"><Sparkles size={13} /> Deterministic improvements</span>
                <div className="hp-revise-grid">
                  {SYLLABUS_REVISE_ACTIONS.map((action) => (
                    <button key={action.id} className="hp-chip" title={action.hint} onClick={() => runRevise(action.id)}>
                      {action.label}
                    </button>
                  ))}
                </div>
                <AiGenerateButton running={ai.running} onClick={generateWithAi} label="Generate syllabus with AI" />
                <AiSourceNote running={ai.running} error={ai.error} status={ai.status} />
              </div>

              {content && sectionConfigs.map((section) => {
                const value = content[section.key] as string | string[];
                const status = statusOf(value);
                return (
                  <SyllabusBuilderSection
                    key={section.key}
                    title={section.title}
                    status={status}
                    hint={section.hint}
                    preview={Array.isArray(value) ? value.slice(0, 2).join(" | ") : value}
                    open={Boolean(openSections[section.key])}
                    onToggle={() => setOpenSections((prev) => ({ ...prev, [section.key]: !prev[section.key] }))}
                  >
                    {section.type === "list" ? (
                      <ListEditor items={value as string[]} onChange={(items) => changeListField(section.key, items)} addLabel={`Add ${section.title.toLowerCase()}`} />
                    ) : section.type === "textarea" ? (
                      <TextAreaField label={section.title} value={value as string} onChange={(next) => changeTextField(section.key, next)} />
                    ) : (
                      <TextField label={section.title} value={value as string} onChange={(next) => changeTextField(section.key, next)} />
                    )}
                  </SyllabusBuilderSection>
                );
              })}
            </>
          )}

          {advancedOpen && (
            <div className="hp-advanced">
              <div className="hp-advanced-head">
                <strong><Code2 size={15} /> Advanced Canvas HTML</strong>
                {!isCustom && <button className="hp-chip" onClick={enterCustomMode}>Edit raw HTML</button>}
              </div>
              <p className="hp-hint">Changes here affect Canvas export. The editor saves a snapshot before raw HTML editing begins.</p>
              <textarea ref={htmlEditorRef} className="hp-html-textarea" aria-label="Syllabus Canvas HTML" spellCheck={false} rows={18} value={page.bodyHtml} readOnly={!isCustom} onChange={(event) => editRawHtml(event.target.value)} />
              {!isCustom && <p className="hp-hint">This is read-only until you choose "Edit raw HTML." Use structured fields for safer edits.</p>}
            </div>
          )}
        </div>

        <div className="hp-preview-pane syllabus-preview-pane">
          <div className="hp-device-controls" role="group" aria-label="Preview mode">
            <button className={previewMode === "desktop" ? "active" : ""} onClick={() => setPreviewMode("desktop")} aria-pressed={previewMode === "desktop"}><Monitor size={15} /> Desktop</button>
            <button className={previewMode === "tablet" ? "active" : ""} onClick={() => setPreviewMode("tablet")} aria-pressed={previewMode === "tablet"}><Tablet size={15} /> Tablet</button>
            <button className={previewMode === "mobile" ? "active" : ""} onClick={() => setPreviewMode("mobile")} aria-pressed={previewMode === "mobile"}><Smartphone size={15} /> Mobile</button>
            <button className={previewMode === "printFriendly" ? "active" : ""} onClick={() => setPreviewMode("printFriendly")} aria-pressed={previewMode === "printFriendly"}><Printer size={15} /> Print</button>
          </div>
          <div className="sy-preview-label">
            <span>{currentTemplateName}</span>
            <span>{course.theme.name}</span>
            <span className={validation.failures ? "danger" : validation.warnings ? "warn" : "ok"}>{statusText}</span>
            <span>{previewMode === "printFriendly" ? "print" : previewMode}</span>
          </div>
          <div className="hp-canvas-stage">
            <div className={`hp-canvas-frame device-${previewMode === "printFriendly" ? "desktop sy-print-frame" : previewMode}`}>
              <div className="hp-canvas-chrome" aria-hidden="true">
                <span className="hp-dot" /><span className="hp-dot" /><span className="hp-dot" />
                <span className="hp-canvas-url">Canvas | Syllabus</span>
              </div>
              <div className="hp-canvas-scroll">
                <div className={`hp-canvas-page ${previewMode === "printFriendly" ? "sy-print-page" : ""}`} dangerouslySetInnerHTML={{ __html: previewHtml }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="hp-bottom">
        <section className="hp-validation" aria-label="Syllabus checks">
          <header>
            <strong>Syllabus checks</strong>
            <span className={validation.failures ? "hp-badge danger" : validation.warnings ? "hp-badge warn" : "hp-badge ok"}>
              {validation.failures ? `${validation.failures} to fix` : validation.warnings ? `${validation.warnings} to review` : "All clear"}
            </span>
          </header>
          <ul>
            {validation.checks.map((check) => (
              <li key={check.id} className={`hp-check ${check.status}`}>
                <span className="hp-check-icon">{check.status === "pass" ? <CheckCircle2 size={15} /> : check.status === "warn" ? <AlertTriangle size={15} /> : <X size={15} />}</span>
                <span className="hp-check-body"><strong>{check.label}</strong><small>{check.detail}</small></span>
              </li>
            ))}
          </ul>
        </section>

        <section className="hp-snapshots" aria-label="Syllabus snapshots">
          <header>
            <strong>Syllabus snapshots</strong>
            <small>{state?.snapshots.length ?? 0} saved</small>
          </header>
          {state && state.snapshots.length > 0 ? (
            <ul>
              {state.snapshots.map((snapshot) => (
                <li key={snapshot.id} className="hp-snapshot">
                  <div className="hp-snapshot-info">
                    <strong>{snapshot.label}</strong>
                    <small>{syllabusTemplateMeta(snapshot.templateId).name} | score {snapshot.validationScore} | {relativeTime(snapshot.takenAt)}</small>
                  </div>
                  <div className="hp-snapshot-actions">
                    <button className="hp-chip" onClick={() => setCompareId(compareId === snapshot.id ? null : snapshot.id)}>{compareId === snapshot.id ? "Hide" : "Compare"}</button>
                    <button className="hp-chip hp-chip-primary" onClick={() => restoreSnapshot(snapshot)}>Restore</button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="hp-hint">Snapshots are saved before templates, revise actions, theme refreshes, Advanced HTML edits, rebuilds, and restores. Use "Save snapshot" anytime.</p>
          )}
        </section>
      </div>

      {compareSnapshot && content && state && (
        <section className="hp-compare" aria-label="Compare syllabus versions">
          <header>
            <strong>Comparing current vs "{compareSnapshot.label}"</strong>
            <button className="hp-icon-btn" onClick={() => setCompareId(null)} aria-label="Close comparison"><X size={16} /></button>
          </header>
          <div className="hp-compare-summary">
            <p className="hp-hint">What changed since this snapshot:</p>
            <ul>
              {compareContents(content, compareSnapshot.content, state.templateId, compareSnapshot.templateId, validation.score, compareSnapshot.validationScore).map((line, index) => (
                <li key={index}>{line}</li>
              ))}
            </ul>
          </div>
          <div className="hp-compare-grid">
            <figure>
              <figcaption>Previous ({relativeTime(compareSnapshot.takenAt)})</figcaption>
              <div className="hp-canvas-page mini" dangerouslySetInnerHTML={{ __html: compareSnapshot.bodyHtml }} />
            </figure>
            <figure>
              <figcaption>Current</figcaption>
              <div className="hp-canvas-page mini" dangerouslySetInnerHTML={{ __html: page.bodyHtml }} />
            </figure>
          </div>
          <button className="hp-btn hp-btn-primary" onClick={() => restoreSnapshot(compareSnapshot)}><RotateCcw size={15} /> Restore this previous version</button>
        </section>
      )}
    </div>
  );
}

function ScoreRing({ score, failures, warnings, label }: { score: number; failures: number; warnings: number; label: string }) {
  return (
    <ReadinessRing
      score={score}
      size={72}
      tone="auto"
      failures={failures}
      warnings={warnings}
      caption="ready"
      ariaLabel={`${label} readiness ${score} out of 100`}
    />
  );
}

function SyllabusBuilderSection({
  title,
  status,
  hint,
  preview,
  open,
  onToggle,
  children
}: {
  title: string;
  status: "Complete" | "Needs review" | "Missing";
  hint: string;
  preview: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className={`hp-section sy-section ${open ? "open" : ""}`}>
      <button className="hp-section-head" onClick={onToggle} aria-expanded={open}>
        <span className="hp-section-title"><FileText size={15} /> {title}</span>
        <span className={`sy-status ${status === "Complete" ? "ok" : status === "Needs review" ? "warn" : "danger"}`}>{status}</span>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      <div className="sy-section-preview">{plainSnippet(preview) || hint}</div>
      {open && <div className="hp-section-body">{children}<p className="hp-hint">{hint}</p></div>}
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="hp-field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextAreaField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="hp-field">
      <span>{label}</span>
      <textarea rows={4} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function ListEditor({ items, onChange, addLabel }: { items: string[]; onChange: (items: string[]) => void; addLabel: string }) {
  return (
    <div className="hp-list-editor">
      {items.map((item, index) => (
        <div className="hp-list-row" key={index}>
          <input value={item} onChange={(event) => onChange(items.map((value, itemIndex) => (itemIndex === index ? event.target.value : value)))} />
          <button className="hp-icon-btn" aria-label="Remove item" onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={15} /></button>
        </div>
      ))}
      <button className="hp-chip" onClick={() => onChange([...items, ""])}><Plus size={14} /> {addLabel}</button>
    </div>
  );
}
