import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Code2,
  Eye,
  GraduationCap,
  Info,
  LayoutTemplate,
  Monitor,
  Plus,
  RotateCcw,
  Smartphone,
  Sparkles,
  Tablet,
  Trash2,
  Undo2,
  Wand2,
  X
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_TEMPLATE_ID,
  HOMEPAGE_REVISE_ACTIONS,
  HOMEPAGE_TEMPLATES,
  createHomepageState,
  defaultHomepageContent,
  homepageContextFromCourse,
  renderHomepage,
  reviseHomepageContent,
  templateMeta,
  BANNER_SRC,
  type HomepageReviseAction
} from "../services/homepageTemplates";
import { validateHomepage, type HomepageValidationResult } from "../services/homepageValidation";
import { canvasRefTargets } from "../services/canvasLinks";
import { buildBannerSvg } from "../services/themeDesign";
import { slugify } from "../utils/text";
import { aiGenerateHomepageContent } from "../services/aiBuilders";
import { useAiAction } from "../hooks/useAiAction";
import { AiGenerateButton, AiSourceNote } from "./AiGenerateButton";
import type { CourseProject, HomepageContent, HomepageLink, HomepageSnapshot, HomepageState } from "../types";

type UpdateCourse = (updater: (current: CourseProject) => CourseProject) => void;
type DeviceMode = "desktop" | "tablet" | "mobile";

const MAX_SNAPSHOTS = 12;

const newId = (prefix: string): string => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

// The exported banner lives at ../web_resources/course-banner.svg, which the dev app does not
// serve — so the live preview would show a broken image. For PREVIEW ONLY we swap that path for a
// themed inline SVG that mirrors the exported banner. The stored/exported bodyHtml is untouched,
// so the preview stays faithful to what Canvas will render while never showing a broken asset.
// Build the data URI from the SAME banner SVG the export writes, so the preview is faithful.
const bannerDataUri = (course: CourseProject): string => `data:image/svg+xml,${encodeURIComponent(buildBannerSvg(course.title, course.theme))}`;

// Swap the exported banner reference for a themed inline SVG in the preview. Handles the current
// Canvas file token ($IMS-CC-FILEBASE$/course-banner.svg) and the legacy relative path that older
// or imported homepages may still carry. split/join avoids escaping the token's regex-special "$".
const withPreviewAssets = (html: string, course: CourseProject): string => {
  const dataUri = bannerDataUri(course);
  return html.split(BANNER_SRC).join(dataUri).split("../web_resources/course-banner.svg").join(dataUri);
};

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

// Recover a few builder fields from an existing (imported / hand-edited) homepage so the friendly
// editor starts populated rather than blank.
const deriveContentFromHtml = (html: string, base: HomepageContent): HomepageContent => {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, "").trim();
  const firstP = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1]?.replace(/<[^>]+>/g, "").trim();
  return {
    ...base,
    heroHeading: h1 || base.heroHeading,
    welcome: firstP && firstP.length > 12 ? firstP : base.welcome
  };
};

// Known export targets, mirrored from the readiness check, so the validator can verify the
// homepage's internal links resolve against the files the package will actually contain.
const knownTargetsFor = (course: CourseProject): Set<string> => {
  const targets = new Set<string>();
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

const compareContents = (a: HomepageContent, b: HomepageContent, aTemplate: string, bTemplate: string, aMode: string, bMode: string): string[] => {
  const changes: string[] = [];
  if (aTemplate !== bTemplate) changes.push(`Template: ${templateMeta(bTemplate).name} → ${templateMeta(aTemplate).name}`);
  if (aMode !== bMode) changes.push(`Editing mode: ${bMode} → ${aMode}`);
  if (a.heroHeading !== b.heroHeading) changes.push("Hero heading changed");
  if (a.welcome !== b.welcome) changes.push("Welcome message changed");
  if (a.instructorNote !== b.instructorNote) changes.push("Instructor note changed");
  if (a.primaryButton.label !== b.primaryButton.label || a.primaryButton.target !== b.primaryButton.target) changes.push("Primary button changed");
  if (a.secondaryButton.label !== b.secondaryButton.label || a.secondaryButton.target !== b.secondaryButton.target) changes.push("Secondary button changed");
  if (a.pathItems.join("|") !== b.pathItems.join("|")) changes.push(`Course path items (${b.pathItems.length} → ${a.pathItems.length})`);
  if (a.weeklyItems.join("|") !== b.weeklyItems.join("|")) changes.push("Weekly rhythm changed");
  if (a.resourceLinks.map((l) => l.target).join("|") !== b.resourceLinks.map((l) => l.target).join("|")) changes.push("Helpful links changed");
  return changes.length ? changes : ["No structured differences — only minor text edits."];
};

export function HomepageTab({ course, onUpdateCourse }: { course: CourseProject; onUpdateCourse: UpdateCourse }) {
  const page = course.pages.find((item) => item.frontPage) ?? course.pages[0];
  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [showGallery, setShowGallery] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ hero: true, buttons: true, path: true });
  const [compareId, setCompareId] = useState<string | null>(null);
  const ai = useAiAction();

  // Lazily initialize builder state for legacy / imported courses that predate the homepage model.
  useEffect(() => {
    if (page && !course.homepage) {
      const base = defaultHomepageContent(homepageContextFromCourse(course));
      const content = deriveContentFromHtml(page.bodyHtml, base);
      const initial: HomepageState = { ...createHomepageState(content, DEFAULT_TEMPLATE_ID, course.theme.id, new Date().toISOString()), mode: "custom" };
      onUpdateCourse((current) => ({ ...current, homepage: initial }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page?.id, course.homepage]);

  const state = course.homepage;
  const knownTargets = useMemo(() => knownTargetsFor(course), [course.pages, course.fileAssets]);
  const validation: HomepageValidationResult = useMemo(() => validateHomepage(page?.bodyHtml ?? "", { knownTargets }), [page?.bodyHtml, knownTargets]);
  const themeDrift = Boolean(state && state.mode === "builder" && state.themeId !== course.theme.id);

  if (!page) {
    return (
      <div className="hp-empty">
        <h2>Homepage missing</h2>
        <p>Generate or add a front page before editing the homepage.</p>
      </div>
    );
  }

  // ---- commit helpers -------------------------------------------------------

  const writeHomepage = (nextState: HomepageState, bodyHtml: string): void => {
    onUpdateCourse((current) => ({
      ...current,
      homepage: nextState,
      pages: current.pages.map((item) => (item.id === page.id ? { ...item, bodyHtml, status: "edited", metadata: { ...item.metadata, updatedAt: new Date().toISOString(), source: "edited" } } : item))
    }));
  };

  const snapshotOf = (label: string): HomepageSnapshot | null => {
    if (!state) return null;
    return { id: newId("snap"), label, takenAt: new Date().toISOString(), mode: state.mode, templateId: state.templateId, content: state.content, bodyHtml: page.bodyHtml };
  };

  const withSnapshot = (label: string, snapshots: HomepageSnapshot[]): HomepageSnapshot[] => {
    const snap = snapshotOf(label);
    if (!snap) return snapshots;
    return [snap, ...snapshots].slice(0, MAX_SNAPSHOTS);
  };

  // Update structured content (builder mode) and re-render the page HTML from it.
  const updateContent = (patch: Partial<HomepageContent> | ((prev: HomepageContent) => HomepageContent)): void => {
    if (!state) return;
    const nextContent = typeof patch === "function" ? patch(state.content) : { ...state.content, ...patch };
    const html = renderHomepage(state.templateId, nextContent, course.theme);
    writeHomepage({ ...state, content: nextContent, mode: "builder", themeId: course.theme.id, updatedAt: new Date().toISOString() }, html);
  };

  const applyTemplate = (templateId: string): void => {
    if (!state) return;
    const html = renderHomepage(templateId, state.content, course.theme);
    writeHomepage(
      { ...state, templateId, mode: "builder", themeId: course.theme.id, updatedAt: new Date().toISOString(), snapshots: withSnapshot(`Before applying ${templateMeta(templateId).name}`, state.snapshots) },
      html
    );
    setShowGallery(false);
  };

  const runRevise = (action: HomepageReviseAction): void => {
    if (!state) return;
    const meta = HOMEPAGE_REVISE_ACTIONS.find((item) => item.id === action);
    const nextContent = reviseHomepageContent(action, state.content, homepageContextFromCourse(course));
    const html = renderHomepage(state.templateId, nextContent, course.theme);
    writeHomepage(
      { ...state, content: nextContent, mode: "builder", themeId: course.theme.id, updatedAt: new Date().toISOString(), snapshots: withSnapshot(`Before "${meta?.label ?? action}"`, state.snapshots) },
      html
    );
  };

  const refreshTheme = (): void => {
    if (!state) return;
    const html = renderHomepage(state.templateId, state.content, course.theme);
    writeHomepage({ ...state, mode: "builder", themeId: course.theme.id, updatedAt: new Date().toISOString(), snapshots: withSnapshot("Before theme refresh", state.snapshots) }, html);
  };

  const generateWithAi = (): void => {
    if (!state) return;
    const baseState = state;
    void ai.run(
      () => aiGenerateHomepageContent(course, baseState.content),
      (next) => {
        const html = renderHomepage(baseState.templateId, next, course.theme);
        writeHomepage(
          { ...baseState, content: next, mode: "builder", themeId: course.theme.id, updatedAt: new Date().toISOString(), snapshots: withSnapshot("Before Generate with AI", baseState.snapshots) },
          html
        );
      }
    );
  };

  const saveSnapshot = (): void => {
    if (!state) return;
    onUpdateCourse((current) => ({ ...current, homepage: current.homepage ? { ...current.homepage, snapshots: withSnapshot("Manual save", current.homepage.snapshots) } : current.homepage }));
  };

  const restoreSnapshot = (snapshot: HomepageSnapshot): void => {
    if (!state) return;
    writeHomepage(
      { ...state, mode: snapshot.mode, templateId: snapshot.templateId, content: snapshot.content, themeId: course.theme.id, updatedAt: new Date().toISOString(), snapshots: withSnapshot("Before restore", state.snapshots) },
      snapshot.bodyHtml
    );
    setCompareId(null);
  };

  const editRawHtml = (value: string): void => {
    if (!state) return;
    onUpdateCourse((current) => ({
      ...current,
      homepage: current.homepage ? { ...current.homepage, mode: "custom", updatedAt: new Date().toISOString() } : current.homepage,
      pages: current.pages.map((item) => (item.id === page.id ? { ...item, bodyHtml: value, status: "edited", metadata: { ...item.metadata, updatedAt: new Date().toISOString(), source: "edited" } } : item))
    }));
  };

  const enterCustomMode = (): void => {
    if (!state) return;
    onUpdateCourse((current) => ({ ...current, homepage: current.homepage ? { ...current.homepage, mode: "custom", snapshots: withSnapshot("Before advanced HTML edit", current.homepage.snapshots) } : current.homepage }));
    setAdvancedOpen(true);
  };

  const returnToBuilder = (): void => {
    if (!state) return;
    const html = renderHomepage(state.templateId, state.content, course.theme);
    writeHomepage({ ...state, mode: "builder", themeId: course.theme.id, updatedAt: new Date().toISOString(), snapshots: withSnapshot("Before returning to builder", state.snapshots) }, html);
  };

  const toggleSection = (key: string): void => setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const content = state?.content;
  const isCustom = state?.mode === "custom";
  const compareSnapshot = state?.snapshots.find((snap) => snap.id === compareId) ?? null;

  return (
    <div className="homepage-tab">
      {/* ---------- Summary strip ---------- */}
      <section className="hp-summary" aria-label="Homepage summary">
        <div className="hp-summary-main">
          <span className="hp-eyebrow"><GraduationCap size={14} /> Student-facing course homepage</span>
          <input
            className="hp-title-input"
            aria-label="Page title"
            value={page.title}
            onChange={(event) => onUpdateCourse((current) => ({ ...current, pages: current.pages.map((item) => (item.id === page.id ? { ...item, title: event.target.value } : item)) }))}
          />
          <p className="hp-purpose">{content?.purpose ?? "This is the first page students see when they open the course."}</p>
          <div className="hp-meta-row">
            <span><Eye size={13} /> {isCustom ? "Custom HTML" : `${templateMeta(state?.templateId ?? DEFAULT_TEMPLATE_ID).name} template`}</span>
            <span><RotateCcw size={13} /> Updated {relativeTime(state?.updatedAt ?? page.metadata.updatedAt)}</span>
          </div>
        </div>
        <ScoreRing score={validation.score} failures={validation.failures} warnings={validation.warnings} />
      </section>

      {/* ---------- Action toolbar ---------- */}
      <div className="hp-toolbar">
        <div className="hp-toolbar-group">
          <button className={`hp-btn ${showGallery ? "active" : ""}`} onClick={() => setShowGallery((prev) => !prev)} aria-expanded={showGallery}>
            <LayoutTemplate size={16} /> Templates
          </button>
          <button className="hp-btn" onClick={saveSnapshot}><Undo2 size={16} /> Save snapshot</button>
        </div>
        <div className="hp-toolbar-group">
          {themeDrift && (
            <button className="hp-btn hp-btn-warn" onClick={refreshTheme}>
              <Wand2 size={16} /> Refresh theme styling
            </button>
          )}
          <button className={`hp-btn ${advancedOpen ? "active" : ""}`} onClick={() => setAdvancedOpen((prev) => !prev)} aria-expanded={advancedOpen}>
            <Code2 size={16} /> Advanced HTML
          </button>
        </div>
      </div>

      {/* ---------- Template gallery ---------- */}
      {showGallery && (
        <section className="hp-gallery" aria-label="Homepage templates">
          {HOMEPAGE_TEMPLATES.map((template) => (
            <div key={template.id} className={`hp-template-card ${state?.templateId === template.id && !isCustom ? "selected" : ""}`}>
              <div className="hp-template-thumb" aria-hidden="true" dangerouslySetInnerHTML={{ __html: withPreviewAssets(renderHomepage(template.id, content ?? defaultHomepageContent(homepageContextFromCourse(course)), course.theme), course) }} />
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

      {/* ---------- Split editor / preview ---------- */}
      <div className="hp-split">
        <div className="hp-editor">
          {isCustom ? (
            <div className="hp-custom-panel">
              <div className="hp-mode-banner">
                <AlertTriangle size={15} />
                <span>You are editing raw HTML. The structured builder is paused so your manual edits are never overwritten.</span>
              </div>
              <button className="hp-btn" onClick={returnToBuilder}><RotateCcw size={15} /> Return to the builder</button>
              <p className="hp-hint">Returning regenerates the page from your structured fields and the current theme. A snapshot is saved first.</p>
            </div>
          ) : (
            <>
              <div className="hp-revise" aria-label="Homepage revise actions">
                <span className="hp-revise-label"><Sparkles size={13} /> Quick improvements</span>
                <div className="hp-revise-grid">
                  {HOMEPAGE_REVISE_ACTIONS.map((action) => (
                    <button key={action.id} className="hp-chip" title={action.hint} onClick={() => runRevise(action.id)}>
                      {action.label}
                    </button>
                  ))}
                </div>
                <AiGenerateButton running={ai.running} onClick={generateWithAi} label="Generate homepage with AI" />
                <AiSourceNote running={ai.running} error={ai.error} status={ai.status} />
              </div>

              {content && (
                <>
                  <BuilderSection title="Hero" icon={<GraduationCap size={15} />} open={openSections.hero} onToggle={() => toggleSection("hero")}>
                    <TextField label="Eyebrow / kicker" value={content.heroEyebrow} onChange={(value) => updateContent({ heroEyebrow: value })} />
                    <TextField label="Hero heading" value={content.heroHeading} onChange={(value) => updateContent({ heroHeading: value })} />
                    <TextAreaField label="Short course welcome" value={content.welcome} onChange={(value) => updateContent({ welcome: value })} />
                    <TextField label="Banner image alt text" value={content.bannerAlt} onChange={(value) => updateContent({ bannerAlt: value })} hint="Describes the banner for screen readers." />
                  </BuilderSection>

                  <BuilderSection title="Buttons" icon={<ChevronRight size={15} />} open={openSections.buttons} onToggle={() => toggleSection("buttons")}>
                    <LinkEditor label="Primary button" link={content.primaryButton} onChange={(link) => updateContent({ primaryButton: link })} />
                    <LinkEditor label="Secondary button" link={content.secondaryButton} onChange={(link) => updateContent({ secondaryButton: link })} />
                  </BuilderSection>

                  <BuilderSection title="Course path" icon={<CheckCircle2 size={15} />} open={openSections.path} onToggle={() => toggleSection("path")}>
                    <ListEditor items={content.pathItems} onChange={(items) => updateContent({ pathItems: items })} addLabel="Add a step" placeholder="e.g. Read the module overview first" />
                  </BuilderSection>

                  <BuilderSection title="Instructor note" icon={<Info size={15} />} open={Boolean(openSections.instructor)} onToggle={() => toggleSection("instructor")}>
                    <TextAreaField label="Welcome note from the instructor" value={content.instructorNote} onChange={(value) => updateContent({ instructorNote: value })} hint="Leave blank to hide this section." />
                  </BuilderSection>

                  <BuilderSection title="Weekly rhythm" icon={<RotateCcw size={15} />} open={Boolean(openSections.weekly)} onToggle={() => toggleSection("weekly")}>
                    <ListEditor items={content.weeklyItems} onChange={(items) => updateContent({ weeklyItems: items })} addLabel="Add a weekly step" placeholder="e.g. Join the weekly discussion" />
                  </BuilderSection>

                  <BuilderSection title="Helpful links" icon={<ChevronRight size={15} />} open={Boolean(openSections.links)} onToggle={() => toggleSection("links")}>
                    <LinkListEditor items={content.resourceLinks} onChange={(items) => updateContent({ resourceLinks: items })} />
                  </BuilderSection>
                </>
              )}
            </>
          )}

          {advancedOpen && (
            <div className="hp-advanced">
              <div className="hp-advanced-head">
                <strong><Code2 size={15} /> Advanced HTML editor</strong>
                {!isCustom && <button className="hp-chip" onClick={enterCustomMode}>Edit raw HTML</button>}
              </div>
              <textarea
                className="hp-html-textarea"
                aria-label="Canvas HTML"
                spellCheck={false}
                rows={16}
                value={page.bodyHtml}
                readOnly={!isCustom}
                onChange={(event) => editRawHtml(event.target.value)}
              />
              <p className="hp-hint">{isCustom ? "Editing here keeps you in custom mode." : "Read-only preview of the generated HTML. Click “Edit raw HTML” to take manual control (a snapshot is saved first)."}</p>
            </div>
          )}
        </div>

        {/* ---------- Preview ---------- */}
        <div className="hp-preview-pane">
          <div className="hp-device-controls" role="group" aria-label="Preview size">
            <button className={device === "desktop" ? "active" : ""} onClick={() => setDevice("desktop")} aria-pressed={device === "desktop"}><Monitor size={15} /> Desktop</button>
            <button className={device === "tablet" ? "active" : ""} onClick={() => setDevice("tablet")} aria-pressed={device === "tablet"}><Tablet size={15} /> Tablet</button>
            <button className={device === "mobile" ? "active" : ""} onClick={() => setDevice("mobile")} aria-pressed={device === "mobile"}><Smartphone size={15} /> Mobile</button>
          </div>
          <div className="hp-canvas-stage">
            <div className={`hp-canvas-frame device-${device}`}>
              <div className="hp-canvas-chrome" aria-hidden="true">
                <span className="hp-dot" /><span className="hp-dot" /><span className="hp-dot" />
                <span className="hp-canvas-url">Canvas · Home</span>
              </div>
              <div className="hp-canvas-scroll">
                <div className="hp-canvas-page" dangerouslySetInnerHTML={{ __html: withPreviewAssets(page.bodyHtml, course) }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- Validation + snapshots ---------- */}
      <div className="hp-bottom">
        <section className="hp-validation" aria-label="Homepage checks">
          <header>
            <strong>Homepage checks</strong>
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

        <section className="hp-snapshots" aria-label="Homepage snapshots">
          <header>
            <strong>Version history</strong>
            <small>{state?.snapshots.length ?? 0} saved</small>
          </header>
          {state && state.snapshots.length > 0 ? (
            <ul>
              {state.snapshots.map((snapshot) => (
                <li key={snapshot.id} className="hp-snapshot">
                  <div className="hp-snapshot-info">
                    <strong>{snapshot.label}</strong>
                    <small>{templateMeta(snapshot.templateId).name} · {relativeTime(snapshot.takenAt)}</small>
                  </div>
                  <div className="hp-snapshot-actions">
                    <button className="hp-chip" onClick={() => setCompareId(compareId === snapshot.id ? null : snapshot.id)}>{compareId === snapshot.id ? "Hide" : "Compare"}</button>
                    <button className="hp-chip hp-chip-primary" onClick={() => restoreSnapshot(snapshot)}>Restore</button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="hp-hint">Snapshots are saved automatically before you apply a template, run a quick improvement, refresh the theme, or switch to raw HTML. Use “Save snapshot” to capture the current version anytime.</p>
          )}
        </section>
      </div>

      {/* ---------- Compare overlay ---------- */}
      {compareSnapshot && content && state && (
        <section className="hp-compare" aria-label="Compare versions">
          <header>
            <strong>Comparing current vs “{compareSnapshot.label}”</strong>
            <button className="hp-icon-btn" onClick={() => setCompareId(null)} aria-label="Close comparison"><X size={16} /></button>
          </header>
          <div className="hp-compare-summary">
            <p className="hp-hint">What changed since this snapshot:</p>
            <ul>
              {compareContents(content, compareSnapshot.content, state.templateId, compareSnapshot.templateId, state.mode, compareSnapshot.mode).map((line, index) => (
                <li key={index}>{line}</li>
              ))}
            </ul>
          </div>
          <div className="hp-compare-grid">
            <figure>
              <figcaption>Previous ({relativeTime(compareSnapshot.takenAt)})</figcaption>
              <div className="hp-canvas-page mini" dangerouslySetInnerHTML={{ __html: withPreviewAssets(compareSnapshot.bodyHtml, course) }} />
            </figure>
            <figure>
              <figcaption>Current</figcaption>
              <div className="hp-canvas-page mini" dangerouslySetInnerHTML={{ __html: withPreviewAssets(page.bodyHtml, course) }} />
            </figure>
          </div>
          <button className="hp-btn hp-btn-primary" onClick={() => restoreSnapshot(compareSnapshot)}><RotateCcw size={15} /> Restore this previous version</button>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

function ScoreRing({ score, failures, warnings }: { score: number; failures: number; warnings: number }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const tone = failures ? "danger" : warnings ? "warn" : "ok";
  return (
    <div className={`hp-score-ring ${tone}`} aria-label={`Homepage readiness ${score} out of 100`}>
      <svg viewBox="0 0 64 64" width="72" height="72">
        <circle cx="32" cy="32" r={radius} className="hp-ring-track" />
        <circle cx="32" cy="32" r={radius} className="hp-ring-fill" strokeDasharray={circumference} strokeDashoffset={offset} transform="rotate(-90 32 32)" />
      </svg>
      <div className="hp-score-num">
        <strong>{score}</strong>
        <small>ready</small>
      </div>
    </div>
  );
}

function BuilderSection({ title, icon, open, onToggle, children }: { title: string; icon: ReactNode; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className={`hp-section ${open ? "open" : ""}`}>
      <button className="hp-section-head" onClick={onToggle} aria-expanded={open}>
        <span className="hp-section-title">{icon} {title}</span>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {open && <div className="hp-section-body">{children}</div>}
    </div>
  );
}

function TextField({ label, value, onChange, hint }: { label: string; value: string; onChange: (value: string) => void; hint?: string }) {
  return (
    <label className="hp-field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
      {hint && <small>{hint}</small>}
    </label>
  );
}

function TextAreaField({ label, value, onChange, hint }: { label: string; value: string; onChange: (value: string) => void; hint?: string }) {
  return (
    <label className="hp-field">
      <span>{label}</span>
      <textarea rows={3} value={value} onChange={(event) => onChange(event.target.value)} />
      {hint && <small>{hint}</small>}
    </label>
  );
}

function LinkEditor({ label, link, onChange }: { label: string; link: HomepageLink; onChange: (link: HomepageLink) => void }) {
  return (
    <div className="hp-link-editor">
      <span className="hp-field-label">{label}</span>
      <div className="hp-link-row">
        <label>
          <small>Text</small>
          <input value={link.label} onChange={(event) => onChange({ ...link, label: event.target.value })} />
        </label>
        <label>
          <small>Target</small>
          <input value={link.target} onChange={(event) => onChange({ ...link, target: event.target.value })} />
        </label>
      </div>
    </div>
  );
}

function ListEditor({ items, onChange, addLabel, placeholder }: { items: string[]; onChange: (items: string[]) => void; addLabel: string; placeholder?: string }) {
  return (
    <div className="hp-list-editor">
      {items.map((item, index) => (
        <div className="hp-list-row" key={index}>
          <input value={item} placeholder={placeholder} onChange={(event) => onChange(items.map((value, i) => (i === index ? event.target.value : value)))} />
          <button className="hp-icon-btn" aria-label="Remove item" onClick={() => onChange(items.filter((_, i) => i !== index))}><Trash2 size={15} /></button>
        </div>
      ))}
      <button className="hp-chip" onClick={() => onChange([...items, ""])}><Plus size={14} /> {addLabel}</button>
    </div>
  );
}

function LinkListEditor({ items, onChange }: { items: HomepageLink[]; onChange: (items: HomepageLink[]) => void }) {
  return (
    <div className="hp-list-editor">
      {items.map((item, index) => (
        <div className="hp-list-row" key={index}>
          <input aria-label="Link text" value={item.label} placeholder="Link text" onChange={(event) => onChange(items.map((value, i) => (i === index ? { ...value, label: event.target.value } : value)))} />
          <input aria-label="Link target" value={item.target} placeholder="target.html" onChange={(event) => onChange(items.map((value, i) => (i === index ? { ...value, target: event.target.value } : value)))} />
          <button className="hp-icon-btn" aria-label="Remove link" onClick={() => onChange(items.filter((_, i) => i !== index))}><Trash2 size={15} /></button>
        </div>
      ))}
      <button className="hp-chip" onClick={() => onChange([...items, { label: "", target: "" }])}><Plus size={14} /> Add a link</button>
    </div>
  );
}
