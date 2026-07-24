// CONCEPT 3 — COURSE MAP WORKSPACE
// A persistent course→module→item tree is the primary navigation. The centre
// shows the selected object; a contextual inspector shows ONLY controls
// relevant to that object (never a permanent crowded control panel).
import { h, clear, toast, itemGlyph, ring } from "../shared/ui.js";
import * as B from "../shared/blocks.js";
ensureCss("map", ["../shared/blocks.css", "./concepts/map.css"]);

export function mount(stage, ctx) {
  let sel = { kind: "course" };           // course | node:<id> | module:<id> | item:<modId>:<itemId>
  const expanded = new Set([B.focusModuleId()].filter(Boolean));

  const tree = h("aside", { class: "mp-tree" });
  const canvas = h("section", { class: "mp-canvas" });
  const inspector = h("aside", { class: "mp-inspector" });
  stage.append(h("div", { class: "mp" }, tree, canvas, inspector));

  function isSel(kind, id, itemId) {
    if (kind === "course") return sel.kind === "course";
    if (kind === "node") return sel.kind === "node" && sel.id === id;
    if (kind === "module") return sel.kind === "module" && sel.id === id;
    if (kind === "item") return sel.kind === "item" && sel.itemId === itemId;
    return false;
  }

  function renderTree() {
    clear(tree);
    const t = h("div", { class: "mp-tree__inner" });
    t.append(h("button", { class: "mp-node mp-node--root" + (isSel("course") ? " is-on" : ""), onClick: () => { sel = { kind: "course" }; render(); } },
      h("span", { class: "mp-node__ico" }, "📕"), h("span", { class: "mp-node__label" }, "The Meaning of Life"), h("span", { class: "mp-node__meta tiny" }, "course")));
    [["sources", "Sources"], ["setup", "Setup"], ["blueprint", "Blueprint"], ["homepage", "Homepage"], ["syllabus", "Syllabus"], ["gradebook", "Gradebook"], ["theme", "Theme"]].forEach(([id, lbl]) => t.append(courseNode(id, lbl)));
    t.append(h("div", { class: "mp-tree__sec" }, "Modules"));
    B.session.modules.forEach(m => {
      const open = expanded.has(m.id);
      t.append(h("button", { class: "mp-node mp-node--mod" + (isSel("module", m.id) ? " is-on" : ""), onClick: () => { toggle(m.id); sel = { kind: "module", id: m.id }; render(); } },
        h("span", { class: "mp-node__tw" }, open ? "▾" : "▸"),
        h("span", { class: "mp-node__label" }, m.kind === "start" ? "Start Here" : m.title.replace(/^(\d+) · /, "$1 · ")),
        m.status !== "approved" && h("span", { class: "mp-dot", title: "needs attention" })));
      if (open) m.items.forEach(it => t.append(h("button", { class: "mp-node mp-node--item" + (isSel("item", m.id, it.id) ? " is-on" : ""), onClick: () => { sel = { kind: "item", id: m.id, itemId: it.id }; render(); } },
        h("span", { class: "mp-node__ig" }, itemGlyph(it.type)), h("span", { class: "mp-node__label" }, it.title),
        it.needsAttention && h("span", { class: "mp-dot" }))));
    });
    t.append(h("div", { class: "mp-tree__sec" }, "Course checks"));
    ["Readiness", "Student preview", "Export"].forEach(lbl => t.append(courseNode(lbl.toLowerCase().replace(/ /g, "-"), lbl)));
    tree.append(t);
  }
  function courseNode(id, label) {
    return h("button", { class: "mp-node mp-node--x" + (isSel("node", id) ? " is-on" : ""), onClick: () => { sel = { kind: "node", id }; render(); } },
      h("span", { class: "mp-node__ico" }, nodeIcon(id)), h("span", { class: "mp-node__label" }, label),
      id === "readiness" && B.openIssuesCount() > 0 && h("span", { class: "mp-count" }, B.openIssuesCount()));
  }
  function toggle(id) { expanded.has(id) ? expanded.delete(id) : expanded.add(id); }

  function render() {
    renderTree(); clear(canvas); clear(inspector);
    if (sel.kind === "course") return renderCourse();
    if (sel.kind === "node") return renderNode(sel.id);
    if (sel.kind === "module") return renderModule(sel.id);
    if (sel.kind === "item") return renderItem(sel.id, sel.itemId);
  }

  function crumb(parts) { return h("nav", { class: "mp-crumb tiny" }, parts.map((p, i) => [i ? h("span", { class: "mp-crumb__sep" }, "›") : null, h("span", {}, p)]).flat().filter(Boolean)); }

  function renderCourse() {
    canvas.append(crumb(["Course"]),
      h("h1", { class: "mp-h1" }, B.D.course.title),
      h("p", { class: "mp-sub" }, B.D.course.subtitle + " · " + B.D.course.code),
      h("p", { class: "mp-prose" }, B.D.course.description),
      h("div", { class: "mp-tiles" }, [
        tile("13", "modules"), tile("22", "pages"), tile("9", "assignments"), tile("6", "quizzes"), tile("3", "rubrics"), tile("6", "outcomes"),
      ]));
    inspectorFor("course");
  }
  function renderNode(id) {
    const map = {
      sources: () => { canvas.append(crumb(["Course", "Sources"]), h("h1", { class: "mp-h1" }, "Source materials"), h("p", { class: "mp-sub" }, "Read for structure, never invented from."), B.sourceList()); inspectorFor("sources"); },
      setup: () => { canvas.append(crumb(["Course", "Setup"]), h("h1", { class: "mp-h1" }, "Course setup"), h("p", { class: "mp-sub" }, "Course-level decisions — they affect the whole map."), B.courseChange({ onChanged: () => render() })); inspectorFor("setup"); },
      blueprint: () => { canvas.append(crumb(["Course", "Blueprint"]), h("h1", { class: "mp-h1" }, "Blueprint"), h("p", { class: "mp-sub" }, "The plan the map was generated from."), B.blueprintView({})); inspectorFor("blueprint"); },
      homepage: () => { canvas.append(crumb(["Course", "Homepage"]), h("h1", { class: "mp-h1" }, "Homepage"), h("p", { class: "mp-sub" }, "The first page students see."), B.homepageEditor({ onChange: () => {} })); inspectorFor("setup"); },
      syllabus: () => { canvas.append(crumb(["Course", "Syllabus"]), h("h1", { class: "mp-h1" }, "Syllabus"), h("p", { class: "mp-sub" }, "All seven policy sections."), B.syllabusEditor({ onChange: () => renderTree() })); inspectorFor("setup"); },
      gradebook: () => { canvas.append(crumb(["Course", "Gradebook"]), h("h1", { class: "mp-h1" }, "Gradebook"), h("p", { class: "mp-sub" }, "Category weights — must total 100%."), B.gradebookEditor({ onChange: () => {} })); inspectorFor("setup"); },
      theme: () => { canvas.append(crumb(["Course", "Theme"]), h("h1", { class: "mp-h1" }, "Theme"), h("p", { class: "mp-sub" }, "Visual style applied to exported pages."), B.themeEditor({ onChange: () => renderTree() })); inspectorFor("setup"); },
      readiness: () => { canvas.append(crumb(["Course", "Readiness"]), h("h1", { class: "mp-h1" }, "Readiness"), B.readinessPanel({ onResolveGoto: it => gotoRef(it.refId) })); inspectorFor("readiness"); },
      "student-preview": () => { canvas.append(crumb(["Course", "Student preview"]), h("h1", { class: "mp-h1" }, "Student preview"), B.studentPreview({})); inspectorFor("preview"); },
      export: () => { canvas.append(crumb(["Course", "Export"]), h("h1", { class: "mp-h1" }, "Export"), B.exportPanel({ onGoResolve: () => { sel = { kind: "node", id: "readiness" }; render(); } })); inspectorFor("export"); },
    };
    (map[id] || (() => canvas.append(h("p", {}, id))))();
  }
  function renderModule(id) {
    const m = B.moduleById(id);
    canvas.append(crumb(["Course", m.kind === "start" ? "Start Here" : "Module " + m.order]),
      h("h1", { class: "mp-h1" }, m.title), h("p", { class: "mp-sub" }, m.summary),
      h("p", { class: "tiny muted" }, "Select an item in the tree to edit it, or reorder items here."),
      B.moduleItemList(m.id, { onOpen: it => { sel = { kind: "item", id: m.id, itemId: it.id }; render(); }, onReorder: () => renderTree() }));
    inspectorFor("module", m);
  }
  function renderItem(modId, itemId) {
    const m = B.moduleById(modId);
    const it = m.items.find(x => x.id === itemId);
    canvas.append(crumb(["Course", "Module " + m.order, it.title]),
      B.itemEditor(it, { scopeMod: m, onChange: () => render() }));
    inspectorFor("item", { m, it });
  }

  // ---- contextual inspector — ONLY what's relevant to the selection --------
  function inspectorFor(kind, ctxObj) {
    const head = h("div", { class: "mp-insp__head" }, h("span", { class: "mp-insp__eyebrow" }, "Inspector"), h("span", { class: "tiny muted" }, kind));
    inspector.append(head);
    if (kind === "course") {
      inspector.append(inspBlock("Readiness", h("div", {}, ring(B.session.readiness.score, B.session.readiness.status, B.openIssuesCount() + " open"),
        h("button", { class: "btn btn--sm", style: { marginTop: "10px", width: "100%" }, onClick: () => { sel = { kind: "node", id: "readiness" }; render(); } }, "Open readiness"))));
      inspector.append(inspBlock("Scope", h("p", { class: "tiny muted" }, "Selecting the course root shows course-wide facts only. Item controls appear when you select an item.")));
    } else if (kind === "module") {
      const m = ctxObj;
      inspector.append(inspBlock("This module", metaRows([["Items", m.items.length], ["Student time", m.workloadHours + " h"], ["Type", m.kind]])));
      if (m.status === "workload-high") inspector.append(inspNote("warn", "Workload " + m.workloadHours + "h is well above the 3.5–4.5h norm. Consider splitting across two weeks."));
      inspector.append(inspBlock("Actions", h("div", { class: "stack gap-8" },
        h("button", { class: "btn btn--sm", onClick: () => toast("Duplicate module (mock)", "ok") }, "Duplicate module"),
        h("button", { class: "btn btn--sm", onClick: () => toast("Move module (mock)", "ok") }, "Move in sequence"))));
    } else if (kind === "item") {
      const { it } = ctxObj;
      const c = B.contentFor(it);
      inspector.append(inspBlock("This item", metaRows([["Type", it.type], ["Status", c?.edited ? "Edited" : "AI draft"]].concat(
        it.type === "assignment" ? [["Points", c.points], ["Aligned", c.alignedOutcomeIds.join(", ")]] : []))));
      inspector.append(inspBlock("Scope", inspNote("info", "Edits here affect this one item only — Module " + ctxObj.m.order + ".")));
      if (it.needsAttention) inspector.append(inspNote("warn", "Flagged: this needs your review before publishing."));
      inspector.append(inspBlock("Publish", h("label", { class: "row gap-8" }, h("input", { type: "checkbox" }), h("span", { class: "tiny" }, "Publish to students"))));
    } else if (kind === "setup") {
      inspector.append(inspNote("info", "These are course-level decisions. Changing them can ripple across many modules — the map updates live."));
    } else if (kind === "readiness") {
      inspector.append(inspBlock("How to read this", inspNote("info", "Must-fix items block a confident export. Advisory items are recommendations. Resolve moves you straight to the fix.")));
    } else {
      inspector.append(inspNote("info", "No item selected. The inspector fills with controls when you pick a module or item in the tree."));
    }
  }

  render();

  function gotoRef(refId) { for (const m of B.session.modules) { const it = m.items.find(i => i.refId === refId); if (it) { expanded.add(m.id); sel = { kind: "item", id: m.id, itemId: it.id }; render(); return; } } }

  function goToTask(n) {
    const acts = {
      1: () => sel = { kind: "course" },
      2: () => sel = { kind: "node", id: "sources" },
      3: () => sel = { kind: "node", id: "setup" },
      4: () => sel = { kind: "node", id: "blueprint" },
      5: () => sel = { kind: "node", id: "setup" },
      6: () => { const fm = B.focusModuleId(); expanded.add(fm); sel = { kind: "module", id: fm }; },
      7: () => { const fm = B.focusModuleId(); expanded.add(fm); sel = { kind: "item", id: fm, itemId: B.focusItemId(fm, "page") }; },
      8: () => { const fm = B.focusModuleId(); expanded.add(fm); sel = { kind: "item", id: fm, itemId: B.focusItemId(fm, "assignment") }; },
      9: () => { const fm = B.focusModuleId(); expanded.add(fm); sel = { kind: "module", id: fm }; },
      10: () => sel = { kind: "node", id: "readiness" },
      11: () => sel = { kind: "node", id: "student-preview" },
      12: () => sel = { kind: "node", id: "export" },
    };
    (acts[n] || acts[1])(); render();
  }
  return { goToTask };
}

function tile(n, l) { return h("div", { class: "mp-tile" }, h("strong", {}, n), h("span", { class: "tiny muted" }, l)); }
function inspBlock(title, body) { return h("div", { class: "mp-insp__blk" }, h("h4", { class: "mp-insp__t" }, title), body); }
function inspNote(tone, text) { return h("p", { class: "mp-insp__note mp-insp__note--" + tone }, text); }
function metaRows(rows) { return h("dl", { class: "mp-insp__meta" }, rows.map(([k, v]) => [h("dt", {}, k), h("dd", {}, String(v))]).flat()); }
function nodeIcon(id) { return { sources: "📄", setup: "⚙", blueprint: "📐", homepage: "⌂", syllabus: "☰", gradebook: "▤", theme: "◑", readiness: "◑", "student-preview": "👁", export: "⇧" }[id] || "•"; }

export function rationale() {
  return h("div", { class: "prose" },
    h("h2", {}, "Hypothesis"),
    h("p", {}, "The hard part of a 16-tab tool isn't any one screen — it's knowing where you are and how the pieces nest. Give people one spatial model: a course→module→item tree that is always visible. Navigation becomes structural, not a feature menu."),
    h("h3", {}, "Information architecture"),
    h("p", {}, "Three panes. The tree (persistent, primary). The canvas (the selected object, at any altitude). The inspector (contextual — it shows only the controls that belong to the current selection, and collapses to guidance when nothing item-level is selected). This directly answers “does this change affect one item, one module, or the course?” because the tree makes altitude literal."),
    h("h3", {}, "Key moves"),
    h("ul", {}, h("li", {}, "Course-level surfaces (Sources, Setup, Blueprint, Readiness, Preview, Export) are siblings of modules in one tree — no second navigation system."),
      h("li", {}, "The inspector is never a permanent wall of controls; it earns its space per selection."),
      h("li", {}, "Breadcrumb + tree highlight keep “where am I” answered at all times.")),
    h("h3", {}, "Trade-offs"),
    h("p", {}, "Powerful for reorganizing and for experts; the three-pane density needs care on tablet/mobile (the tree becomes a drawer). Readiness is a node you must visit, so it can be under-noticed — mitigated by a live count badge in the tree."));
}
function ensureCss(id, hrefs) { (Array.isArray(hrefs) ? hrefs : [hrefs]).forEach((href, i) => { const key = "css-" + id + "-" + i; if (document.getElementById(key)) return; const l = document.createElement("link"); l.id = key; l.rel = "stylesheet"; l.href = href; document.head.append(l); }); }
