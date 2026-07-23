// CONCEPT 6 — VISUAL STORYBOARD
// The course is a sequence of student experiences you can zoom through:
// course → module → learning sequence → item. Pacing and workload are visible.
import { h, clear, toast, itemGlyph, ATTN } from "../shared/ui.js";
import * as B from "../shared/blocks.js";
ensureCss("storyboard", ["../shared/blocks.css", "./concepts/storyboard.css"]);

export function mount(stage, ctx) {
  let stageId = "board"; // production ribbon: sources|setup|blueprint|board|readiness|preview|export
  let zoom = "course";    // course | module | item
  let modId = "m4", itemId = null;

  const ribbon = h("nav", { class: "sb-ribbon" });
  const main = h("section", { class: "sb-main" });
  stage.append(h("div", { class: "sb" }, ribbon, main));

  const STAGES = [
    ["sources", "Sources"], ["setup", "Setup"], ["blueprint", "Blueprint"],
    ["board", "Storyboard"], ["readiness", "Readiness"], ["preview", "Student preview"], ["export", "Export"],
  ];

  function renderRibbon() {
    clear(ribbon);
    ribbon.append(h("span", { class: "sb-ribbon__lead" }, "Production"),
      h("div", { class: "sb-ribbon__stages" }, STAGES.map(([id, label]) => h("button", {
        class: "sb-ribbon__stage" + (stageId === id ? " is-on" : "") + (id === "board" ? " sb-ribbon__stage--hero" : ""),
        onClick: () => { stageId = id; if (id === "board") { zoom = "course"; } render(); } }, label))));
  }

  function render() {
    renderRibbon(); clear(main);
    if (stageId === "board") return renderBoard();
    const panels = {
      sources: () => main.append(sHead("Sources", "Raw material we read for structure."), B.sourceList()),
      setup: () => main.append(sHead("Setup", "Course-level decisions shape the whole storyboard."), B.courseChange({ onChanged: () => {} })),
      blueprint: () => main.append(sHead("Blueprint", "The plan behind the storyboard."), B.blueprintView({})),
      readiness: () => main.append(sHead("Readiness", "What must be fixed before export."), B.readinessPanel({ onResolveGoto: it => gotoRef(it.refId) })),
      preview: () => main.append(sHead("Student preview", "The finished experience."), B.studentPreview({ moduleId: "m4" })),
      export: () => main.append(sHead("Export", "Package for Canvas."), B.exportPanel({ onGoResolve: () => { stageId = "readiness"; render(); } })),
    };
    (panels[stageId] || panels.sources)();
  }
  function sHead(t, s) { return h("header", { class: "sb-head" }, h("h1", { class: "sb-h1" }, t), s && h("p", { class: "sb-sub" }, s)); }

  // ---- the storyboard, three zoom levels ----------------------------------
  function renderBoard() {
    main.append(zoomCrumb());
    if (zoom === "course") return renderCourseStrip();
    if (zoom === "module") return renderModuleSequence();
    if (zoom === "item") return renderItemScene();
  }
  function zoomCrumb() {
    const parts = [h("button", { class: "sb-zc" + (zoom === "course" ? " is-cur" : ""), onClick: () => { zoom = "course"; render(); } }, "Whole course")];
    if (zoom !== "course") parts.push(h("span", { class: "sb-zc__sep" }, "▸"), h("button", { class: "sb-zc" + (zoom === "module" ? " is-cur" : ""), onClick: () => { zoom = "module"; render(); } }, B.moduleById(modId).kind === "start" ? "Start Here" : "Module " + B.moduleById(modId).order));
    if (zoom === "item") { const it = B.moduleById(modId).items.find(x => x.id === itemId); parts.push(h("span", { class: "sb-zc__sep" }, "▸"), h("span", { class: "sb-zc is-cur" }, it?.title)); }
    return h("div", { class: "sb-zoomcrumb" }, h("span", { class: "tiny muted" }, "Zoom:"), parts);
  }

  function renderCourseStrip() {
    main.append(h("p", { class: "sb-lede" }, "Each scene is one week of the student's journey. Card height shows workload — spot the pacing at a glance. Click a scene to zoom in."));
    const strip = h("div", { class: "sb-strip" }, B.session.modules.map((m, i) => {
      const heavy = m.workloadHours > 6;
      const attn = m.status !== "approved";
      return h("button", { class: "sb-scene" + (heavy ? " is-heavy" : "") + (attn ? " has-attn" : ""), style: { "--load": Math.min(1, m.workloadHours / 10) },
        onClick: () => { modId = m.id; zoom = "module"; render(); } },
        h("div", { class: "sb-scene__idx" }, m.kind === "start" ? "Start" : "Week " + m.order),
        h("div", { class: "sb-scene__title" }, m.kind === "start" ? "Orientation" : m.title.replace(/^\d+ · /, "")),
        h("div", { class: "sb-scene__beats" }, m.items.slice(0, 6).map(it => h("span", { class: "sb-beat", title: it.title }, itemGlyph(it.type)))),
        h("div", { class: "sb-scene__foot" }, h("span", { class: "sb-load" + (heavy ? " is-heavy" : "") }, m.workloadHours + "h"), attn && h("span", { class: "sb-scene__flag" }, "review")));
    }));
    main.append(strip);
    main.append(h("div", { class: "sb-legend tiny muted" }, "▤ page · ❝ discussion · ✎ assignment · ◉ quiz · taller card = heavier week"));
  }

  function renderModuleSequence() {
    const m = B.moduleById(modId);
    main.append(h("header", { class: "sb-modhead" },
      h("div", {}, h("h1", { class: "sb-h1" }, m.title), h("p", { class: "sb-sub" }, m.summary)),
      h("span", { class: "pill" + (m.workloadHours > 6 ? " warn" : "") }, m.workloadHours + " student hours")));
    main.append(h("p", { class: "sb-lede" }, "The learning sequence, left to right. Reorder beats with ‹ ›; click a beat to open it."));
    const flow = h("div", { class: "sb-flow" });
    m.items.forEach((it, i) => {
      const c = B.contentFor(it), attn = it.needsAttention && ATTN[it.needsAttention];
      flow.append(h("div", { class: "sb-beatcard" + (attn ? " attn" : "") },
        h("div", { class: "sb-beatcard__type" }, h("span", {}, itemGlyph(it.type)), it.type),
        h("button", { class: "sb-beatcard__title", onClick: () => { itemId = it.id; zoom = "item"; render(); } }, it.title),
        c?.edited && h("span", { class: "pill ok tiny" }, "edited"),
        attn && h("span", { class: "pill " + attn.tone + " tiny" }, attn.label),
        h("div", { class: "sb-beatcard__mv" },
          h("button", { class: "sb-mv", "aria-label": "Move earlier", disabled: i === 0, onClick: () => moveBeat(i, -1) }, "‹"),
          h("button", { class: "sb-mv", "aria-label": "Move later", disabled: i === m.items.length - 1, onClick: () => moveBeat(i, 1) }, "›"))));
      if (i < m.items.length - 1) flow.append(h("span", { class: "sb-arrow" }, "→"));
    });
    main.append(flow);
    function moveBeat(i, dir) { const j = i + dir; if (j < 0 || j >= m.items.length) return; [m.items[i], m.items[j]] = [m.items[j], m.items[i]]; toast("Reordered beat · scope: Module " + m.order, "ok"); render(); }
  }

  function renderItemScene() {
    const m = B.moduleById(modId);
    const it = m.items.find(x => x.id === itemId);
    main.append(h("div", { class: "sb-itemscene" },
      h("aside", { class: "sb-itemscene__ctx" },
        h("h4", {}, "In this sequence"),
        h("ol", { class: "sb-minimap" }, m.items.map(x => h("li", { class: x.id === itemId ? "is-cur" : "" }, h("button", { class: "sb-minimap__b", "aria-current": x.id === itemId ? "true" : null, onClick: () => { itemId = x.id; render(); } }, h("span", {}, itemGlyph(x.type)), x.title))))),
      h("div", { class: "sb-itemscene__editor" }, B.itemEditor(it, { scopeMod: m, onChange: render }))));
  }

  render();

  function gotoRef(refId) { for (const m of B.session.modules) { const it = m.items.find(i => i.refId === refId); if (it) { stageId = "board"; modId = m.id; itemId = it.id; zoom = "item"; render(); return; } } }

  function goToTask(n) {
    const acts = {
      1: () => { stageId = "board"; zoom = "course"; },
      2: () => stageId = "sources", 3: () => stageId = "setup", 4: () => stageId = "blueprint", 5: () => stageId = "setup",
      6: () => { stageId = "board"; modId = "m4"; zoom = "module"; },
      7: () => { stageId = "board"; modId = "m4"; itemId = "i4a"; zoom = "item"; },
      8: () => { stageId = "board"; modId = "m4"; itemId = "i4d"; zoom = "item"; },
      9: () => { stageId = "board"; modId = "m4"; zoom = "module"; },
      10: () => stageId = "readiness", 11: () => stageId = "preview", 12: () => stageId = "export",
    };
    (acts[n] || acts[1])(); render();
  }
  return { goToTask };
}

export function rationale() {
  return h("div", { class: "prose" },
    h("h2", {}, "Hypothesis"),
    h("p", {}, "A course is lived by students as a sequence of experiences over weeks — not as rows in a database. If the builder shows that sequence directly, instructors design the journey (pacing, variety, load) instead of tending a schema, and problems like a lopsided week become visible rather than buried in numbers."),
    h("h3", {}, "Information architecture"),
    h("p", {}, "A production ribbon holds the non-scene stages (Sources, Setup, Blueprint, Readiness, Preview, Export); the Storyboard itself is a single object with three zoom levels — whole course (a filmstrip of week-scenes), a module's learning sequence (beats, left to right), and one item. Zoom is the only navigation you learn."),
    h("h3", {}, "Key moves"),
    h("ul", {}, h("li", {}, "Scene height encodes workload, so uneven pacing (Module 7) is literally taller than its neighbours."),
      h("li", {}, "Reordering is spatial — move a beat earlier/later in the flow, with the scope (this module) stated."),
      h("li", {}, "An item scene keeps a mini-map of the sequence so you never lose the surrounding arc.")),
    h("h3", {}, "Trade-offs"),
    h("p", {}, "Beautiful for pacing and story; detailed editing requires a disciplined drill-down, and dense text work can feel cramped inside a “scene.” Best paired with a more textual mode for heads-down editing."));
}
function ensureCss(id, hrefs) { (Array.isArray(hrefs) ? hrefs : [hrefs]).forEach((href, i) => { const key = "css-" + id + "-" + i; if (document.getElementById(key)) return; const l = document.createElement("link"); l.id = key; l.rel = "stylesheet"; l.href = href; document.head.append(l); }); }
