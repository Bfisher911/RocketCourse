import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  EyeOff,
  FileText,
  Filter,
  LayoutTemplate,
  Link2,
  Monitor,
  PanelTop,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Smartphone,
  Tablet,
  Trash2,
  Undo2
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CoursePage, CourseProject, ObjectMetadata, PublishState } from "../types";
import {
  PAGE_TEMPLATES,
  buildPageTemplateHtml,
  changePageModule,
  createPage,
  deletePage,
  duplicatePage,
  isRequiredPage,
  pageRole,
  restorePage,
  renamePageEverywhere,
  sanitizePageHtmlForPreview,
  updatePageSlug,
  validatePagePlan,
  type PageIssue,
  type PageTemplateId
} from "../services/pageBuilder";
import { stripHtml } from "../utils/text";
import { aiGeneratePageBody } from "../services/aiBuilders";
import { useAiAction } from "../hooks/useAiAction";
import { AiGenerateButton, AiSourceNote } from "./AiGenerateButton";
import { RockContentToolbox } from "./RockContentToolbox";

type UpdateCourse = (updater: (current: CourseProject) => CourseProject) => void;
type PageFilter = "all" | "module" | "front-page" | "draft" | "instructor-only" | "warnings";
type PreviewMode = "desktop" | "tablet" | "mobile";

interface PageSnapshot {
  id: string;
  reason: string;
  createdAt: string;
  page: CoursePage;
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
  return text.length > 180 ? `${text.slice(0, 177)}...` : text || "No student-facing page content yet.";
};

const issueLabel = (issues: PageIssue[]): string => {
  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.filter((issue) => issue.severity === "warning").length;
  if (errors > 0) return `${errors} blocker${errors === 1 ? "" : "s"}`;
  if (warnings > 0) return `${warnings} warning${warnings === 1 ? "" : "s"}`;
  return "Ready";
};

export function PagesTab({
  course,
  onUpdateCourse,
  onJumpToTab
}: {
  course: CourseProject;
  onUpdateCourse: UpdateCourse;
  onJumpToTab: (tab: "Modules" | "Homepage" | "Syllabus") => void;
}) {
  const validation = useMemo(() => validatePagePlan(course), [course]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(course.pages[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PageFilter>("all");
  const [selectedTemplateId, setSelectedTemplateId] = useState<PageTemplateId>("module-overview");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const [snapshots, setSnapshots] = useState<PageSnapshot[]>([]);
  const [pendingRequiredDeleteId, setPendingRequiredDeleteId] = useState<string | null>(null);
  const [copyState, setCopyState] = useState("Copy Canvas HTML");
  const htmlEditorRef = useRef<HTMLTextAreaElement | null>(null);

  const issueMap = useMemo(() => {
    const map = new Map<string, PageIssue[]>();
    validation.issues.forEach((issue) => map.set(issue.pageId, [...(map.get(issue.pageId) ?? []), issue]));
    return map;
  }, [validation.issues]);

  const summaryMap = useMemo(() => new Map(validation.summaries.map((summary) => [summary.pageId, summary])), [validation.summaries]);

  const filteredPages = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return course.pages.filter((page) => {
      const issues = issueMap.get(page.id) ?? [];
      const text = `${page.title} ${page.slug} ${pageRole(page)} ${stripHtml(page.bodyHtml)}`.toLowerCase();
      if (normalizedQuery && !text.includes(normalizedQuery)) return false;
      if (filter === "module" && (!page.moduleId || page.frontPage || page.slug === "syllabus")) return false;
      if (filter === "front-page" && !page.frontPage) return false;
      if (filter === "draft" && page.publishState !== "unpublished") return false;
      if (filter === "instructor-only" && pageRole(page) !== "Instructor-only") return false;
      if (filter === "warnings" && issues.length === 0) return false;
      return true;
    });
  }, [course.pages, filter, issueMap, query]);

  const selectedPage = course.pages.find((page) => page.id === selectedPageId) ?? filteredPages[0] ?? course.pages[0];
  const selectedIssues = selectedPage ? issueMap.get(selectedPage.id) ?? [] : [];
  const selectedSummary = selectedPage ? summaryMap.get(selectedPage.id) : undefined;
  const selectedSnapshots = selectedPage ? snapshots.filter((snapshot) => snapshot.page.id === selectedPage.id) : [];
  const latestSnapshot = selectedSnapshots[0];
  const publishedPages = course.pages.filter((page) => page.publishState === "published").length;
  const draftPages = course.pages.filter((page) => page.publishState === "unpublished").length;
  const warningPages = course.pages.filter((page) => (issueMap.get(page.id) ?? []).length > 0).length;
  const frontPage = course.pages.find((page) => page.frontPage);

  useEffect(() => {
    if (!selectedPage && course.pages.length > 0) setSelectedPageId(course.pages[0].id);
  }, [course.pages, selectedPage]);

  useEffect(() => {
    if (copyState === "Copy Canvas HTML") return;
    const timeout = window.setTimeout(() => setCopyState("Copy Canvas HTML"), 1600);
    return () => window.clearTimeout(timeout);
  }, [copyState]);

  const pushSnapshot = (page: CoursePage, reason: string): void => {
    const createdAt = new Date().toISOString();
    setSnapshots((current) =>
      [
        {
          id: `page_snapshot_${Date.now()}`,
          reason,
          createdAt,
          page: structuredClone(page),
          score: validation.score
        },
        ...current
      ].slice(0, MAX_SNAPSHOTS)
    );
  };

  const updatePage = (pageId: string, updater: (page: CoursePage, timestamp: string) => CoursePage): void => {
    onUpdateCourse((current) => {
      const timestamp = new Date().toISOString();
      return {
        ...current,
        pages: current.pages.map((page) => (page.id === pageId ? updater(page, timestamp) : page))
      };
    });
  };

  const addPage = (): void => {
    const pageId = `page_custom_${Date.now().toString(36)}`;
    onUpdateCourse((current) => createPage(current, { templateId: selectedTemplateId, pageId }));
    setSelectedPageId(pageId);
  };

  const ai = useAiAction();

  const generateWithAi = (page: CoursePage): void => {
    pushSnapshot(page, "Generate with AI");
    void ai.run(
      () => aiGeneratePageBody(course, page),
      (bodyHtml) =>
        updatePage(page.id, (item, timestamp) => ({
          ...item,
          bodyHtml,
          status: "edited",
          metadata: touchMetadata(item.metadata, timestamp)
        }))
    );
  };

  const applyTemplate = (page: CoursePage): void => {
    const template = PAGE_TEMPLATES.find((item) => item.id === selectedTemplateId) ?? PAGE_TEMPLATES[0];
    pushSnapshot(page, `Applied ${template.name} template`);
    onUpdateCourse((current) => ({
      ...current,
      pages: current.pages.map((item) =>
        item.id === page.id
          ? {
              ...item,
              bodyHtml: buildPageTemplateHtml(template.id, current, item),
              publishState: template.recommendedPublishState ?? item.publishState,
              status: "edited",
              metadata: touchMetadata(item.metadata, new Date().toISOString())
            }
          : item
      )
    }));
  };

  const applyRockContent = (page: CoursePage, bodyHtml: string, reason: string): void => {
    pushSnapshot(page, reason);
    updatePage(page.id, (item, timestamp) => ({
      ...item,
      bodyHtml,
      status: "edited",
      metadata: touchMetadata(item.metadata, timestamp)
    }));
  };

  const duplicateSelectedPage = (page: CoursePage): void => {
    pushSnapshot(page, "Duplicated page");
    const stamp = Date.now().toString(36);
    const copiedId = `${page.id}_copy_${stamp}`;
    onUpdateCourse((current) => duplicatePage(current, page.id, { stamp }));
    setSelectedPageId(copiedId);
  };

  const removePage = (page: CoursePage, allowRequired = false): void => {
    if (isRequiredPage(page) && !allowRequired) {
      setPendingRequiredDeleteId(page.id);
      return;
    }
    pushSnapshot(page, "Deleted page");
    const nextSelection = course.pages.find((item) => item.id !== page.id)?.id ?? null;
    onUpdateCourse((current) => deletePage(current, page.id, allowRequired));
    setPendingRequiredDeleteId(null);
    setSelectedPageId(nextSelection);
  };

  const restoreLatest = (): void => {
    if (!latestSnapshot) return;
    onUpdateCourse((current) => restorePage(current, latestSnapshot.page));
    setSelectedPageId(latestSnapshot.page.id);
    setSnapshots((current) => current.filter((snapshot) => snapshot.id !== latestSnapshot.id));
  };

  const copyCanvasHtml = async (page: CoursePage): Promise<void> => {
    try {
      await navigator.clipboard.writeText(page.bodyHtml);
      setCopyState("Copied");
    } catch {
      setCopyState("Clipboard blocked");
    }
  };

  const jumpForPage = (page: CoursePage): void => {
    if (page.frontPage) onJumpToTab("Homepage");
    else if (page.slug === "syllabus") onJumpToTab("Syllabus");
    else onJumpToTab("Modules");
  };

  if (course.pages.length === 0) {
    return (
      <div className="page-manager">
        <section className="page-hero">
          <div>
            <span className="hp-eyebrow">
              <FileText size={14} /> Canvas page manager
            </span>
            <h2>No pages yet</h2>
            <p>Create a Canvas-safe page with a template, stable slug, module placement, and export validation.</p>
          </div>
          <button className="secondary" onClick={addPage}>
            <Plus size={16} /> Create page
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="page-manager">
      <section className="page-hero">
        <div>
          <span className="hp-eyebrow">
            <FileText size={14} /> Canvas page manager
          </span>
          <h2>Pages</h2>
          <p>Manage Canvas pages with safe HTML, stable slugs, module-aware placement, reusable templates, and realistic previews.</p>
        </div>
        <div className={`page-readiness ${validation.status === "Ready" ? "ready" : "review"}`}>
          {validation.status === "Ready" ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          <strong>{validation.score}%</strong>
          <span>{validation.status}</span>
        </div>
      </section>

      <section className="page-metric-grid" aria-label="Page library summary">
        <div>
          <strong>{course.pages.length}</strong>
          <span>Total pages</span>
        </div>
        <div>
          <strong>{publishedPages}</strong>
          <span>Published</span>
        </div>
        <div>
          <strong>{draftPages}</strong>
          <span>Draft or private</span>
        </div>
        <div>
          <strong>{frontPage?.title ?? "Missing"}</strong>
          <span>Front page</span>
        </div>
        <div className={warningPages ? "warn" : ""}>
          <strong>{warningPages}</strong>
          <span>Need review</span>
        </div>
      </section>

      <section className="page-toolbar" aria-label="Search and filter pages">
        <label className="page-search">
          <Search size={15} />
          <span className="sr-only">Search pages</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pages, slugs, roles, or body text" />
        </label>
        <label>
          <Filter size={14} />
          <span>Filter</span>
          <select value={filter} onChange={(event) => setFilter(event.target.value as PageFilter)}>
            <option value="all">All pages</option>
            <option value="module">Module pages</option>
            <option value="front-page">Front page</option>
            <option value="draft">Draft/unpublished</option>
            <option value="instructor-only">Instructor-only</option>
            <option value="warnings">Validation warnings</option>
          </select>
        </label>
        <button className="secondary" onClick={addPage}>
          <Plus size={15} /> Create page
        </button>
      </section>

      <div className="page-layout">
        <section className="page-list" aria-label="Page list">
          {filteredPages.length === 0 && <p className="module-empty-note">No pages match the current filters.</p>}
          {filteredPages.map((page) => {
            const issues = issueMap.get(page.id) ?? [];
            const summary = summaryMap.get(page.id);
            const module = page.moduleId ? course.modules.find((item) => item.id === page.moduleId) : undefined;
            return (
              <button
                key={page.id}
                className={`page-list-card ${selectedPage?.id === page.id ? "active" : ""} ${issues.some((issue) => issue.severity === "error") ? "has-errors" : ""}`}
                onClick={() => setSelectedPageId(page.id)}
              >
                <span className="page-list-badges">
                  <span className={`page-status ${issues.length ? "review" : "ready"}`}>{issueLabel(issues)}</span>
                  <span className={`page-publish-badge ${page.publishState === "published" ? "published" : "draft"}`}>
                    {page.publishState === "published" ? <Eye size={12} /> : <EyeOff size={12} />}
                    {page.publishState === "published" ? "Published" : "Draft"}
                  </span>
                </span>
                <strong>{page.title || "Untitled page"}</strong>
                <small>{snippet(page.bodyHtml)}</small>
                <div>
                  <span>
                    <Link2 size={13} /> {page.slug || "missing slug"}
                  </span>
                  <span>
                    <BookOpen size={13} /> {module?.title ?? "No module"}
                  </span>
                  <span>
                    <PanelTop size={13} /> {summary?.role ?? pageRole(page)}
                  </span>
                  <span>
                    <FileText size={13} /> {summary?.wordCount ?? 0} words
                  </span>
                  <span>
                    <Clock size={13} /> {summary?.readingMinutes ?? 1} min read
                  </span>
                </div>
              </button>
            );
          })}
        </section>

        {selectedPage && (
          <section className="page-editor-panel" aria-label="Selected page editor">
            <header className="page-editor-header">
              <div>
                <span className="hp-eyebrow">
                  <FileText size={14} /> Editing page
                </span>
                <h3>{selectedPage.title || "Untitled page"}</h3>
                <p>
                  Last updated {relativeTime(selectedPage.metadata.updatedAt)}. {selectedIssues.length ? issueLabel(selectedIssues) : "Ready for Canvas page checks."}
                </p>
              </div>
              <div className="page-editor-actions">
                <button className="small-button" onClick={() => jumpForPage(selectedPage)}>
                  {selectedPage.frontPage ? "Homepage" : selectedPage.slug === "syllabus" ? "Syllabus" : "Modules"}
                </button>
                <button className="small-button" onClick={() => duplicateSelectedPage(selectedPage)}>
                  Copy
                </button>
                <button className="small-button danger" onClick={() => removePage(selectedPage)}>
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </header>

            {pendingRequiredDeleteId === selectedPage.id && (
              <section className="page-delete-panel" aria-label="Required page delete confirmation">
                <AlertTriangle size={16} />
                <div>
                  <strong>Required page safeguard</strong>
                  <p>This page anchors Canvas navigation or RocketCourse export expectations. Delete it only if you are rebuilding that structure intentionally.</p>
                </div>
                <button className="small-button danger" onClick={() => removePage(selectedPage, true)}>
                  Confirm delete
                </button>
                <button className="small-button" onClick={() => setPendingRequiredDeleteId(null)}>
                  Keep page
                </button>
              </section>
            )}

            <div className="page-form-grid">
              <label>
                <span>Title</span>
                <input value={selectedPage.title} onChange={(event) => onUpdateCourse((current) => renamePageEverywhere(current, selectedPage.id, event.target.value))} />
              </label>
              <label>
                <span>Slug</span>
                <input value={selectedPage.slug} onChange={(event) => onUpdateCourse((current) => updatePageSlug(current, selectedPage.id, event.target.value))} />
              </label>
              <label>
                <span>Module</span>
                <select value={selectedPage.moduleId ?? ""} onChange={(event) => onUpdateCourse((current) => changePageModule(current, selectedPage.id, event.target.value || undefined))}>
                  <option value="">No module</option>
                  {course.modules.map((module) => (
                    <option key={module.id} value={module.id}>
                      {module.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Status</span>
                <select
                  value={selectedPage.publishState}
                  onChange={(event) =>
                    updatePage(selectedPage.id, (page, timestamp) => ({
                      ...page,
                      publishState: event.target.value as PublishState,
                      status: "edited",
                      metadata: touchMetadata(page.metadata, timestamp)
                    }))
                  }
                >
                  <option value="published">Published</option>
                  <option value="unpublished">Unpublished</option>
                </select>
              </label>
              <label className="page-front-toggle">
                <span>Canvas front page</span>
                <input
                  type="checkbox"
                  checked={Boolean(selectedPage.frontPage)}
                  onChange={(event) => {
                    const makeFront = event.target.checked;
                    const timestamp = new Date().toISOString();
                    onUpdateCourse((current) => ({
                      ...current,
                      pages: current.pages.map((page) => {
                        const nextFront = makeFront ? page.id === selectedPage.id : page.id === selectedPage.id ? false : Boolean(page.frontPage);
                        const changed = Boolean(page.frontPage) !== nextFront;
                        return {
                          ...page,
                          frontPage: nextFront,
                          status: changed ? "edited" : page.status,
                          metadata: changed ? touchMetadata(page.metadata, timestamp) : page.metadata
                        };
                      })
                    }));
                  }}
                />
              </label>
            </div>

            <section className="page-template-panel" aria-label="Page templates and structured blocks">
              <div className="page-template-bar">
                <label>
                  <LayoutTemplate size={14} />
                  <span>Template</span>
                  <select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value as PageTemplateId)}>
                    {PAGE_TEMPLATES.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="secondary" onClick={() => applyTemplate(selectedPage)}>
                  <Save size={14} /> Apply template
                </button>
                <AiGenerateButton running={ai.running} onClick={() => generateWithAi(selectedPage)} />
                <button className="secondary" onClick={restoreLatest} disabled={!latestSnapshot}>
                  <Undo2 size={14} /> Restore previous
                </button>
              </div>
              <AiSourceNote running={ai.running} error={ai.error} status={ai.status} />
              {latestSnapshot && (
                <p className="page-snapshot-note">
                  Latest snapshot: {latestSnapshot.reason}, {relativeTime(latestSnapshot.createdAt)}. Score then: {latestSnapshot.score}%.
                </p>
              )}
              <div className="page-template-grid">
                {PAGE_TEMPLATES.map((template) => (
                  <button key={template.id} className={selectedTemplateId === template.id ? "active" : ""} onClick={() => setSelectedTemplateId(template.id)}>
                    <strong>{template.name}</strong>
                    <span>{template.description}</span>
                  </button>
                ))}
              </div>
            </section>

            <RockContentToolbox
              course={course}
              value={selectedPage.bodyHtml}
              surface="page"
              textareaRef={htmlEditorRef}
              onChange={(bodyHtml, reason) => applyRockContent(selectedPage, bodyHtml, reason)}
            />

            <label className="page-html-editor">
              <span>Advanced Canvas HTML</span>
              <textarea
                ref={htmlEditorRef}
                rows={18}
                value={selectedPage.bodyHtml}
                onChange={(event) => {
                  if (!snapshots.some((snapshot) => snapshot.reason === "Before advanced HTML edit" && snapshot.page.id === selectedPage.id)) {
                    pushSnapshot(selectedPage, "Before advanced HTML edit");
                  }
                  updatePage(selectedPage.id, (page, timestamp) => ({
                    ...page,
                    bodyHtml: event.target.value,
                    status: "edited",
                    metadata: touchMetadata(page.metadata, timestamp)
                  }));
                }}
              />
            </label>

            <section className="page-checklist" aria-label="Page validation checks">
              <header>
                <h4>Page checks</h4>
                <span className={selectedIssues.some((issue) => issue.severity === "error") ? "review" : "ready"}>{issueLabel(selectedIssues)}</span>
              </header>
              {selectedIssues.length === 0 ? (
                <p>
                  <CheckCircle2 size={15} /> This page has a clear structure, safe HTML, accessible headings and links, and export-friendly module placement.
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

        {selectedPage && (
          <aside className="page-preview-panel" aria-label="Page preview">
            <div className="page-preview-sticky">
              <header>
                <span className="hp-eyebrow">
                  <ShieldCheck size={14} /> Canvas preview
                </span>
                <h3>{selectedPage.title}</h3>
                <p>
                  {selectedSummary?.role ?? pageRole(selectedPage)}. {selectedSummary?.readingMinutes ?? 1} min read. Export path: wiki_content/{selectedPage.slug}.html.
                </p>
              </header>
              <div className="page-preview-tabs" role="tablist" aria-label="Preview mode">
                <button className={previewMode === "desktop" ? "active" : ""} onClick={() => setPreviewMode("desktop")}>
                  <Monitor size={14} /> Desktop
                </button>
                <button className={previewMode === "tablet" ? "active" : ""} onClick={() => setPreviewMode("tablet")}>
                  <Tablet size={14} /> Tablet
                </button>
                <button className={previewMode === "mobile" ? "active" : ""} onClick={() => setPreviewMode("mobile")}>
                  <Smartphone size={14} /> Mobile
                </button>
              </div>
              <div className="page-preview-label">
                <span>{course.theme.name}</span>
                <span className={selectedIssues.some((issue) => issue.severity === "error") ? "danger" : selectedIssues.length ? "warn" : "ok"}>{issueLabel(selectedIssues)}</span>
                <span>{previewMode}</span>
              </div>
              <div className={`canvas-preview page-canvas-preview ${previewMode}`} dangerouslySetInnerHTML={{ __html: sanitizePageHtmlForPreview(selectedPage.bodyHtml) }} />
              <div className="page-preview-footer">
                <button className="secondary" onClick={() => void copyCanvasHtml(selectedPage)}>
                  <Copy size={14} /> {copyState}
                </button>
                <span>
                  <ShieldCheck size={14} /> Preview strips hostile HTML; export validation blocks unsafe page content.
                </span>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
