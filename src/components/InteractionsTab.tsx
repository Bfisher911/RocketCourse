import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, Layers, Lock, LockOpen, Plus, Search, Sparkles, Trash2, TriangleAlert } from "lucide-react";
import type { CourseProject, InteractionBlock } from "../types";
import {
  INTERACTION_CATEGORY_LABELS,
  INTERACTION_PATTERNS,
  INTERACTION_TIER_LABELS,
  interactionPatternById,
  type InteractionCategory
} from "../data/interactionPatterns";
import { renderInteractionBlock } from "../services/interactionRender";
import { validateInteractionHtml } from "../services/interactionValidation";
import { AUTO_SELECTABLE_PATTERN_IDS, buildEditorSampleContent, classifyPage } from "../services/interactionSelection";
import { sanitizeHtmlForPreview } from "../services/htmlSafety";
// Code-split editor-tab styles: arrives with whichever tab loads first.
import "../styles.editor-tabs.css";

type UpdateCourse = (updater: (current: CourseProject) => CourseProject) => void;

interface InteractionsTabProps {
  course: CourseProject;
  onUpdateCourse: UpdateCourse;
}

type SurfaceKind = "page" | "assignment" | "discussion" | "quiz";

interface SurfaceRef {
  kind: SurfaceKind;
  id: string;
  title: string;
  blocks: InteractionBlock[];
}

const surfaceList = (course: CourseProject): SurfaceRef[] => {
  const pages: SurfaceRef[] = course.pages
    .filter((page) => classifyPage(page, course.modules.find((module) => module.id === page.moduleId)) !== null)
    .map((page) => ({ kind: "page" as const, id: page.id, title: page.title, blocks: page.interactionBlocks ?? [] }));
  const assignments: SurfaceRef[] = course.assignments.map((assignment) => ({ kind: "assignment" as const, id: assignment.id, title: `Assignment: ${assignment.title}`, blocks: assignment.interactionBlocks ?? [] }));
  const discussions: SurfaceRef[] = course.discussions.map((discussion) => ({ kind: "discussion" as const, id: discussion.id, title: `Discussion: ${discussion.title}`, blocks: discussion.interactionBlocks ?? [] }));
  const quizzes: SurfaceRef[] = course.quizzes.map((quiz) => ({ kind: "quiz" as const, id: quiz.id, title: `Quiz: ${quiz.title}`, blocks: quiz.interactionBlocks ?? [] }));
  return [...pages, ...assignments, ...discussions, ...quizzes];
};

const updateSurfaceBlocks = (course: CourseProject, surface: SurfaceRef, blocks: InteractionBlock[]): CourseProject => {
  const value = blocks.length ? blocks : undefined;
  if (surface.kind === "page") return { ...course, pages: course.pages.map((page) => (page.id === surface.id ? { ...page, interactionBlocks: value } : page)) };
  if (surface.kind === "assignment") return { ...course, assignments: course.assignments.map((item) => (item.id === surface.id ? { ...item, interactionBlocks: value } : item)) };
  if (surface.kind === "quiz") return { ...course, quizzes: course.quizzes.map((item) => (item.id === surface.id ? { ...item, interactionBlocks: value } : item)) };
  return { ...course, discussions: course.discussions.map((item) => (item.id === surface.id ? { ...item, interactionBlocks: value } : item)) };
};

export const InteractionsTab = ({ course, onUpdateCourse }: InteractionsTabProps) => {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<InteractionCategory | "all">("all");
  const [selectedPatternId, setSelectedPatternId] = useState<string>(INTERACTION_PATTERNS[0].id);
  const surfaces = useMemo(() => surfaceList(course), [course]);
  const [surfaceKey, setSurfaceKey] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);

  const activeSurface = surfaces.find((surface) => `${surface.kind}:${surface.id}` === surfaceKey) ?? surfaces[0];

  const filteredPatterns = useMemo(() => {
    const term = search.trim().toLowerCase();
    return INTERACTION_PATTERNS.filter((pattern) => {
      if (category !== "all" && pattern.category !== category) return false;
      if (!term) return true;
      return `${pattern.name} ${pattern.bestUse} ${pattern.purposes.join(" ")} ${pattern.disciplines.join(" ")}`.toLowerCase().includes(term);
    });
  }, [search, category]);

  const selectedPattern = interactionPatternById(selectedPatternId) ?? INTERACTION_PATTERNS[0];
  const sampleContent = useMemo(() => buildEditorSampleContent(selectedPattern.id, course), [selectedPattern.id, course]);

  const previewHtml = useMemo(() => {
    if (!sampleContent) return "";
    const block: InteractionBlock = { id: "preview", patternId: selectedPattern.id, content: sampleContent, source: "inserted", createdAt: new Date(0).toISOString() };
    return sanitizeHtmlForPreview(renderInteractionBlock(block, course.theme));
  }, [sampleContent, selectedPattern.id, course.theme]);

  const previewIssues = useMemo(() => (previewHtml ? validateInteractionHtml(previewHtml).filter((issue) => issue.severity === "error") : []), [previewHtml]);

  const insert = (): void => {
    if (!activeSurface || !sampleContent) return;
    const block: InteractionBlock = {
      id: `${activeSurface.id}-ix-${Date.now().toString(36)}`,
      patternId: selectedPattern.id,
      content: sampleContent,
      source: "inserted",
      rationale: "Inserted from the Interaction Library.",
      createdAt: new Date().toISOString()
    };
    onUpdateCourse((current) => {
      const refreshed = surfaceList(current).find((surface) => surface.kind === activeSurface.kind && surface.id === activeSurface.id);
      if (!refreshed) return current;
      return updateSurfaceBlocks(current, refreshed, [...refreshed.blocks, block]);
    });
    setMessage(`Added “${selectedPattern.name}” to ${activeSurface.title}. Edit its content below before export.`);
  };

  const mutateBlocks = (mutate: (blocks: InteractionBlock[]) => InteractionBlock[]): void => {
    if (!activeSurface) return;
    onUpdateCourse((current) => {
      const refreshed = surfaceList(current).find((surface) => surface.kind === activeSurface.kind && surface.id === activeSurface.id);
      if (!refreshed) return current;
      return updateSurfaceBlocks(current, refreshed, mutate(refreshed.blocks));
    });
  };

  const move = (index: number, delta: number): void =>
    mutateBlocks((blocks) => {
      const next = [...blocks];
      const target = index + delta;
      if (target < 0 || target >= next.length) return blocks;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const totalBlocks = surfaces.reduce((sum, surface) => sum + surface.blocks.length, 0);

  return (
    <div className="interactions-tab">
      <section className="interactions-hero">
        <div>
          <span className="hp-eyebrow"><Layers size={14} /> Interaction Library</span>
          <h2>113 Canvas-safe interaction patterns</h2>
          <p>
            The generator already placed {totalBlocks} interaction{totalBlocks === 1 ? "" : "s"} across this course based on subject, page purpose,
            and density guardrails. Browse the full library, preview any pattern in your course theme, and add or remove blocks per page.
          </p>
        </div>
      </section>

      <div className="interactions-workspace">
        <section className="interactions-library" aria-label="Pattern library">
          <div className="interactions-filters">
            <label className="interactions-search"><Search size={14} aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search patterns…" aria-label="Search interaction patterns" /></label>
            <select value={category} onChange={(event) => setCategory(event.target.value as InteractionCategory | "all")} aria-label="Filter by category">
              <option value="all">All categories</option>
              {Object.entries(INTERACTION_CATEGORY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </div>
          <ul className="interactions-pattern-list">
            {filteredPatterns.map((pattern) => (
              <li key={pattern.id}>
                <button type="button" className={pattern.id === selectedPatternId ? "active" : ""} onClick={() => setSelectedPatternId(pattern.id)}>
                  <strong>{pattern.number}. {pattern.name}</strong>
                  <small>{pattern.bestUse}</small>
                  <span className={`tier tier-${pattern.tier}`}>{pattern.tier === "native" ? "Native HTML" : pattern.tier === "iframe" ? "External (fallback active)" : "Canvas/LTI"}</span>
                  {AUTO_SELECTABLE_PATTERN_IDS.includes(pattern.id) && <span className="tier tier-auto"><Sparkles size={11} /> auto-selected</span>}
                </button>
              </li>
            ))}
            {!filteredPatterns.length && <li className="interactions-empty">No patterns match this search.</li>}
          </ul>
        </section>

        <section className="interactions-detail" aria-label="Pattern preview and insertion">
          <header>
            <h3>{selectedPattern.number}. {selectedPattern.name}</h3>
            <p>{selectedPattern.bestUse}</p>
            <p className="interactions-meta">
              <span>{INTERACTION_TIER_LABELS[selectedPattern.tier]}</span>
              <span>Complexity {selectedPattern.complexity}/3</span>
              <span>{selectedPattern.frequency}</span>
              {selectedPattern.supportsGrading && <span>Graded form needs a Canvas quiz or LTI</span>}
            </p>
            <p className="interactions-a11y"><TriangleAlert size={13} aria-hidden="true" /> {selectedPattern.accessibilityNotes}</p>
          </header>

          {previewHtml ? (
            <div className="interactions-preview" aria-label="Pattern preview in course theme">
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          ) : (
            <p className="interactions-empty">
              This pattern needs {selectedPattern.requiredAssets.join(", ") || "additional configuration"} before it can render. It stays available
              here so you can plan for it, but it will not export until the requirement is met.
            </p>
          )}

          {previewIssues.length > 0 && (
            <p className="interactions-a11y" role="alert"><TriangleAlert size={13} aria-hidden="true" /> {previewIssues.map((issue) => issue.detail).join("; ")}</p>
          )}

          <details className="interactions-html">
            <summary>View generated Canvas HTML</summary>
            <pre>{previewHtml || "(nothing renders until requirements are met)"}</pre>
          </details>

          <div className="interactions-insert">
            <label>
              <span>Add to</span>
              <select value={activeSurface ? `${activeSurface.kind}:${activeSurface.id}` : ""} onChange={(event) => setSurfaceKey(event.target.value)} aria-label="Choose where to insert this pattern">
                {surfaces.map((surface) => <option key={`${surface.kind}:${surface.id}`} value={`${surface.kind}:${surface.id}`}>{surface.title}{surface.blocks.length ? ` (${surface.blocks.length})` : ""}</option>)}
              </select>
            </label>
            <button className="primary" type="button" disabled={!previewHtml || !activeSurface} onClick={insert}><Plus size={15} /> Insert pattern</button>
          </div>

          {message && <p className="interactions-message" role="status"><Check size={14} aria-hidden="true" /> {message}</p>}

          {activeSurface && activeSurface.blocks.length > 0 && (
            <section className="interactions-blocks" aria-label="Interactions on the selected item">
              <h4>On “{activeSurface.title}”</h4>
              <ul>
                {activeSurface.blocks.map((block, index) => {
                  const pattern = interactionPatternById(block.patternId);
                  return (
                    <li key={block.id}>
                      <div>
                        <strong>{pattern?.name ?? block.patternId}</strong>
                        <small>{block.source === "generated" ? "Selected by the generator" : "Inserted manually"}{block.rationale ? ` — ${block.rationale}` : ""}</small>
                      </div>
                      <div className="interactions-block-actions">
                        <button type="button" className="ghost-button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move ${pattern?.name ?? "block"} up`}><ArrowUp size={13} /></button>
                        <button type="button" className="ghost-button" onClick={() => move(index, 1)} disabled={index === activeSurface.blocks.length - 1} aria-label={`Move ${pattern?.name ?? "block"} down`}><ArrowDown size={13} /></button>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => mutateBlocks((blocks) => blocks.map((item) => (item.id === block.id ? { ...item, locked: !item.locked } : item)))}
                          aria-label={block.locked ? "Unlock block (AI may replace it on regeneration)" : "Lock block (AI regeneration keeps it)"}
                        >
                          {block.locked ? <Lock size={13} /> : <LockOpen size={13} />}
                        </button>
                        <button type="button" className="ghost-button danger" onClick={() => mutateBlocks((blocks) => blocks.filter((item) => item.id !== block.id))} aria-label={`Remove ${pattern?.name ?? "block"}`}><Trash2 size={13} /></button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="interactions-note">Locked blocks survive AI regeneration. Removing a block never touches the page's own prose.</p>
            </section>
          )}
        </section>
      </div>
    </div>
  );
};
