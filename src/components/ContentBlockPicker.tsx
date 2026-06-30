import { Plus } from "lucide-react";
import { useMemo } from "react";
import { CONTENT_BLOCKS, CONTENT_BLOCK_CATEGORIES } from "../data/contentBlocks";
import type { ContentBlockId, ContentBlockMeta, ContentBlockSurface } from "../utils/contentBlocks";

interface ContentBlockPickerProps {
  blocks?: readonly ContentBlockMeta[];
  surface?: ContentBlockSurface;
  onSelect: (id: ContentBlockId) => void;
}

export function ContentBlockPicker({ blocks = CONTENT_BLOCKS, surface, onSelect }: ContentBlockPickerProps) {
  const visibleBlocks = useMemo(
    () => (surface ? blocks.filter((block) => block.surfaces.includes(surface)) : blocks),
    [blocks, surface]
  );

  const groupedBlocks = useMemo(
    () =>
      CONTENT_BLOCK_CATEGORIES.map((category) => ({
        category,
        blocks: visibleBlocks.filter((block) => block.category === category)
      })).filter((group) => group.blocks.length > 0),
    [visibleBlocks]
  );

  return (
    <div className="content-block-picker" aria-label="Structured content blocks">
      {groupedBlocks.map((group) => (
        <section key={group.category} className="content-block-picker-section">
          <h4>{group.category}</h4>
          <div className="page-block-grid">
            {group.blocks.map((block) => (
              <button key={block.id} onClick={() => onSelect(block.id as ContentBlockId)} title={block.description}>
                <Plus size={14} />
                <span>
                  <strong>{block.name}</strong>
                  <small>{block.description}</small>
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
