// Command palette (⌘K) — one shared, keyboard-driven command surface for every
// editor experience. Accessible: dialog role, focus trap, arrow navigation,
// Enter to run, Escape to close.

import { useEffect, useMemo, useRef, useState } from "react";
import { buildCommands, filterCommands, type Command, type CommandContext, type CommandGroup } from "../workflows/commandRegistry";
import { useModalFocus } from "../hooks/useModalFocus";
import "../design-system/tokens/rc-tokens.css";

const GROUP_ORDER: CommandGroup[] = ["Content", "Navigate", "Experience", "Actions"];

export function CommandPalette({ ctx, onClose }: { ctx: CommandContext; onClose: () => void }) {
  const dialogRef = useModalFocus<HTMLDivElement>(true, onClose);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const all = useMemo(() => buildCommands(ctx), [ctx]);
  const results = useMemo(() => {
    const filtered = filterCommands(all, query);
    // stable group ordering for scanability
    return [...filtered].sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group));
  }, [all, query]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const run = (cmd: Command | undefined) => { if (!cmd) return; onClose(); cmd.run(); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(i => Math.min(results.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(i => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); run(results[active]); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(results.length - 1); }
  };

  // render grouped, tracking a flat index for keyboard selection
  let flat = -1;
  const groups: Array<{ group: CommandGroup; items: Array<{ cmd: Command; idx: number }> }> = [];
  for (const cmd of results) {
    let g = groups.find(x => x.group === cmd.group);
    if (!g) { g = { group: cmd.group, items: [] }; groups.push(g); }
    flat += 1;
    g.items.push({ cmd, idx: flat });
  }

  return (
    <div className="rc-cmdk-overlay" data-rc-ds onClick={onClose}>
      <div
        ref={dialogRef}
        className="rc-cmdk"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={e => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="rc-cmdk__searchrow">
          <span className="rc-cmdk__glyph" aria-hidden="true">⌘K</span>
          <input
            ref={inputRef}
            className="rc-cmdk__input"
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="rc-cmdk-list"
            aria-activedescendant={results[active] ? `rc-cmd-${results[active].id}` : undefined}
            placeholder="Search commands, modules, and items…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <kbd className="rc-cmdk__esc">esc</kbd>
        </div>
        <div className="rc-cmdk__list" id="rc-cmdk-list" role="listbox" ref={listRef}>
          {results.length === 0 && <div className="rc-cmdk__empty">No matching commands.</div>}
          {groups.map(g => (
            <div key={g.group} className="rc-cmdk__group" role="group" aria-label={g.group}>
              <div className="rc-cmdk__glabel">{g.group}</div>
              {g.items.map(({ cmd, idx }) => (
                <div
                  key={cmd.id}
                  id={`rc-cmd-${cmd.id}`}
                  data-idx={idx}
                  role="option"
                  aria-selected={idx === active}
                  className={"rc-cmdk__item" + (idx === active ? " is-active" : "")}
                  onMouseMove={() => setActive(idx)}
                  onClick={() => run(cmd)}
                >
                  <span className="rc-cmdk__label">{cmd.label}</span>
                  {cmd.hint && <span className="rc-cmdk__hint">{cmd.hint}</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="rc-cmdk__foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> run</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
