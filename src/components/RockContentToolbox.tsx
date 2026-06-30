import { Blocks, LayoutGrid, Sparkles } from "lucide-react";
import { type RefObject, useMemo, useState } from "react";
import { CONTENT_BLOCKS } from "../data/contentBlocks";
import { ROCK_CATEGORY_BLOCKS, ROCK_CONTENT_CATEGORIES, ROCK_QUICK_ACTIONS, type RockContentCategory, type RockQuickActionId } from "../data/contentBlockToolkit";
import type { CourseProject } from "../types";
import { buildContentBlockHtml, contentBlockById, type ContentBlockId, type ContentBlockSurface } from "../utils/contentBlocks";
import { runRockQuickAction } from "../utils/contentBlockTransforms";

type RockContentSurface = ContentBlockSurface | "page" | "assignment" | "discussion" | "quiz";

interface RockContentToolboxProps {
  course: CourseProject;
  value: string;
  surface: RockContentSurface;
  onChange: (nextValue: string, reason: string) => void;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  title?: string;
  compact?: boolean;
}

const surfaceToContentSurface = (surface: RockContentSurface): ContentBlockSurface => {
  switch (surface) {
    case "page":
      return "contentPage";
    case "assignment":
      return "assignment";
    case "discussion":
      return "discussion";
    case "quiz":
      return "quiz";
    default:
      return surface;
  }
};

const previewKindFor = (id: ContentBlockId): string => {
  if (/hero|banner|welcome|promise|briefing/i.test(id)) return "hero";
  if (/timeline|journey|map|path|process/i.test(id)) return "timeline";
  if (/table|grading|schedule|rubric/i.test(id)) return "table";
  if (/checklist|survival|success|before/i.test(id)) return "checklist";
  if (/video|trailer/i.test(id)) return "media";
  if (/card|grid|tile|role|terms|policy/i.test(id)) return "cards";
  return "stack";
};

const insertAtCursor = (value: string, insert: string, textarea?: HTMLTextAreaElement | null): { next: string; cursor: number } => {
  const insertion = `\n\n${insert.trim()}\n\n`;
  if (!textarea || typeof textarea.selectionStart !== "number") {
    const trimmed = value.trimEnd();
    const next = trimmed ? `${trimmed}${insertion}` : insert.trim();
    return { next, cursor: next.length };
  }
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const before = value.slice(0, start).trimEnd();
  const after = value.slice(end).trimStart();
  const next = `${before}${insertion}${after}`;
  return { next, cursor: before.length + insertion.length };
};

export function RockContentToolbox({ course, value, surface, onChange, textareaRef, title = "Rock Content", compact = false }: RockContentToolboxProps) {
  const contentSurface = surfaceToContentSurface(surface);
  const [activeCategory, setActiveCategory] = useState<RockContentCategory>("Welcome");
  const categoryBlocks = useMemo(() => {
    const blockIds = ROCK_CATEGORY_BLOCKS[activeCategory];
    return blockIds
      .map((id) => contentBlockById(id))
      .filter((block): block is (typeof CONTENT_BLOCKS)[number] => Boolean(block))
      .filter((block) => (block.surfaces as readonly ContentBlockSurface[]).includes(contentSurface) || surface === "page" || surface === "homepage");
  }, [activeCategory, contentSurface, surface]);

  const applyInsert = (html: string, reason: string): void => {
    const target = textareaRef?.current;
    const { next, cursor } = insertAtCursor(value, html, target);
    onChange(next, reason);
    if (target) {
      window.setTimeout(() => {
        target.focus();
        target.setSelectionRange(cursor, cursor);
      }, 0);
    }
  };

  const insertBlock = (blockId: ContentBlockId): void => {
    const block = contentBlockById(blockId);
    applyInsert(buildContentBlockHtml(blockId, { course }), `Inserted ${block?.name ?? "content block"}`);
  };

  const runAction = (actionId: RockQuickActionId): void => {
    const result = runRockQuickAction(actionId, { course }, value);
    if (result.mode === "replace") {
      onChange(result.html, result.label);
      return;
    }
    applyInsert(result.html, result.label);
  };

  return (
    <section className={`rock-toolbox ${compact ? "compact" : ""}`} aria-label={`${title} block insertion toolkit`}>
      <header className="rock-toolbox-head">
        <div>
          <span><Blocks size={14} /> {title}</span>
          <p>Insert curated Canvas-safe patterns or run deterministic layout actions. No live AI is used here.</p>
        </div>
        <span className="rock-toolbox-badge">{textareaRef?.current ? "Cursor insert ready" : "Adds to end"}</span>
      </header>

      <div className="rock-category-row" aria-label="Block categories">
        {ROCK_CONTENT_CATEGORIES.map((category) => (
          <button key={category} className={activeCategory === category ? "active" : ""} onClick={() => setActiveCategory(category)}>
            {category}
          </button>
        ))}
      </div>

      <div className="rock-block-grid" aria-label={`${activeCategory} blocks`}>
        {categoryBlocks.map((block) => (
          <button key={block.id} onClick={() => insertBlock(block.id)} title={block.description}>
            <span className={`rock-block-preview ${previewKindFor(block.id)}`} aria-hidden="true">
              <i /><i /><i /><i />
            </span>
            <span>
              <strong>{block.name}</strong>
              <small>{block.description}</small>
            </span>
          </button>
        ))}
      </div>

      <div className="rock-actions" aria-label="Quick deterministic actions">
        <span className="rock-actions-label"><Sparkles size={13} /> Quick actions</span>
        <div>
          {ROCK_QUICK_ACTIONS.map((action) => (
            <button key={action.id} onClick={() => runAction(action.id)} title={action.description}>
              <LayoutGrid size={13} /> {action.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
