// CONCEPT 7 — GUIDED ↔ EXPERT MODES
// ONE information architecture. A single toggle changes reveal + density, never
// the destination. Switching modes preserves your exact location & selection.
import { h, clear, toast, itemGlyph, ring, ATTN } from "../shared/ui.js";
import * as B from "../shared/blocks.js";
ensureCss("modes", ["../shared/blocks.css", "./concepts/modes.css"]);

export function mount(stage, ctx) {
  let mode = "guided";                     // guided | expert
  let loc = { section: "modules", modId: B.focusModuleId(), itemId: null };

  const SECTIONS = [
    ["overview", "Overview"], ["sources", "Sources"], ["blueprint", "Blueprint"],
    ["modules", "Modules"], ["readiness", "Readiness"], ["preview", "Student preview"], ["export", "Export"],
  ];

  const root = h("div", { class: "gx" });
  stage.append(root);

  function render() {
    root.className = "gx gx--" + mode;
    clear(root);
    root.append(topbar(), h("div", { class: "gx-body" }, nav(), h("section", { class: "gx-main" }, mainNode())));
  }

  function topbar() {
    return h("div", { class: "gx-topbar" },
      h("div", { class: "gx-loc tiny" }, (B.D.course?.title || "Course") + " · " + sectionLabel(loc.section) + (loc.section === "modules" ? " · " + B.moduleById(loc.modId).title.replace(/^\d+ · /, "") : "")),
      h("div", { class: "gx-modeswitch", role: "group", "aria-label": "Interface mode" },
        h("span", { class: "tiny muted" }, "Mode"),
        modeBtn("guided", "Guided"), modeBtn("expert", "Expert"),
        mode === "expert" && h("span", { class: "gx-kbd tiny" }, "⌘K commands")));
  }
  function modeBtn(id, label) {
    return h("button", { class: "gx-modebtn" + (mode === id ? " is-on" : ""), "aria-pressed": String(mode === id),
      onClick: () => { mode = id; toast("Switched to " + label + " mode — same place, kept your selection", "info"); render(); } }, label);
  }

  function nav() {
    return h("aside", { class: "gx-nav" },
      mode === "guided" && h("p", { class: "gx-nav__hint tiny muted" }, "Work top to bottom, or jump anywhere."),
      h("ul", { class: "gx-nav__list" }, SECTIONS.map(([id, label]) => h("li", {}, h("button", {
        class: "gx-nav__item" + (loc.section === id ? " is-on" : ""), onClick: () => { loc.section = id; loc.itemId = null; render(); } },
        h("span", { class: "gx-nav__lbl" }, label),
        id === "readiness" && B.openIssuesCount() > 0 && h("span", { class: "gx-nav__badge" }, B.openIssuesCount()))))),
      mode === "guided" && h("div", { class: "gx-nav__foot tiny muted" }, "Guided hides advanced controls until you need them. Switch to Expert for everything at once."));
  }

  function mainNode() {
    const wrap = h("div", {});
    const R = { overview: overview, sources: sources, blueprint: blueprint, modules: modules, readiness: readiness, preview: preview, export: exportS };
    R[loc.section](wrap);
    return wrap;
  }

  // ---- sections (render differently per mode) ------------------------------
  function overview(w) {
    w.append(secHead("Overview", "Course identity and health."));
    if (mode === "guided") {
      w.append(h("div", { class: "gx-guidecard" }, h("h2", {}, B.D.course.title), h("p", { class: "muted" }, B.D.course.subtitle),
        h("p", {}, B.D.course.description.slice(0, 220) + "…"),
        h("p", { class: "gx-help" }, "This is your course at a glance. When you're ready, move to Modules to review content, or Readiness to see what needs fixing.")));
    } else {
      w.append(h("div", { class: "gx-cols" },
        h("div", { class: "gx-panel" }, h("h4", {}, "Identity"), kv([["Title", B.D.course.title], ["Code", B.D.course.code], ["Term", B.D.course.term], ["Level", B.D.course.level], ["Modality", B.D.course.modality]])),
        h("div", { class: "gx-panel" }, h("h4", {}, "Health"), ring(B.session.readiness.score, B.session.readiness.status, B.openIssuesCount() + " open"), h("div", { class: "gx-qgrid" }, B.session.readiness.quality.slice(0, 6).map(q => h("div", { class: "gx-qcell" }, h("span", { class: "tiny muted" }, q.label), h("strong", {}, q.score))))),
        h("div", { class: "gx-panel" }, h("h4", {}, "Structure"), h("div", { class: "gx-qgrid" }, [["13", "modules"], ["22", "pages"], ["9", "assign."], ["6", "quizzes"]].map(([n, l]) => h("div", { class: "gx-qcell" }, h("strong", {}, n), h("span", { class: "tiny muted" }, l)))))));
    }
  }
  function sources(w) { w.append(secHead("Sources", "Material read for structure."), B.sourceList()); }
  function blueprint(w) {
    w.append(secHead("Blueprint", mode === "guided" ? "The plan behind your course. Approve changes before regenerating." : "Outcomes · sequence · assessment · workload."), B.blueprintView({}));
    // Course-level controls are available in BOTH modes (Expert just shows them denser).
    w.append(h("div", { class: "gx-panel", style: { marginTop: "14px" } },
      h("h4", {}, "Course-level controls"),
      mode === "guided" && h("p", { class: "gx-help", style: { marginTop: 0 } }, "These decisions affect the whole course. Change them here in either mode."),
      B.courseChange({ onChanged: render })));
  }
  function readiness(w) { w.append(secHead("Readiness", "What blocks a confident export.")); w.append(B.readinessPanel({ onResolveGoto: it => gotoRef(it.refId) })); }
  function preview(w) { w.append(secHead("Student preview", "Exactly what students see.")); w.append(B.studentPreview({ moduleId: loc.modId })); }
  function exportS(w) { w.append(secHead("Export", "Package for Canvas.")); w.append(B.exportPanel({ onGoResolve: () => { loc.section = "readiness"; render(); } })); }

  function modules(w) {
    w.append(secHead("Modules", mode === "guided" ? "Pick a module, then walk its items one at a time." : "All modules and items. Click any item to edit inline."));
    if (mode === "guided") {
      // guided: module picker chips + single-column item list + inline editor for the open item
      w.append(h("div", { class: "gx-modchips" }, B.session.modules.map(m => h("button", { class: "gx-modchip" + (loc.modId === m.id ? " is-on" : ""), onClick: () => { loc.modId = m.id; loc.itemId = null; render(); } }, m.kind === "start" ? "Start" : m.order, m.status !== "approved" && h("span", { class: "gx-dot" })))));
      const mod = B.moduleById(loc.modId);
      w.append(h("h3", { class: "gx-modtitle" }, mod.title), h("p", { class: "muted" }, mod.summary));
      if (!loc.itemId) {
        w.append(h("p", { class: "gx-help" }, "Open an item to read and edit it. Reorder with the arrows. We show one thing at a time here on purpose."),
          B.moduleItemList(mod.id, { onOpen: it => { loc.itemId = it.id; render(); }, onReorder: () => {} }));
      } else {
        const it = mod.items.find(x => x.id === loc.itemId);
        w.append(h("button", { class: "btn btn--sm btn--ghost", onClick: () => { loc.itemId = null; render(); } }, "‹ Back to " + mod.title.replace(/^\d+ · /, "")),
          h("div", { class: "gx-guideditor" }, B.itemEditor(it, { scopeMod: mod, onChange: render })));
      }
    } else {
      // expert: two-pane, dense table of items + editor, plus module list column
      const mod = B.moduleById(loc.modId);
      w.append(h("div", { class: "gx-expert" },
        h("div", { class: "gx-expert__mods" }, B.session.modules.map(m => h("button", { class: "gx-expmod" + (loc.modId === m.id ? " is-on" : ""), onClick: () => { loc.modId = m.id; loc.itemId = null; render(); } }, h("span", { class: "gx-expmod__n" }, m.kind === "start" ? "S" : m.order), h("span", { class: "grow" }, m.title.replace(/^\d+ · /, "")), m.status !== "approved" && h("span", { class: "gx-dot" })))),
        h("div", { class: "gx-expert__items" },
          h("div", { class: "gx-expert__mhead" }, h("strong", {}, mod.title), h("span", { class: "pill" + (mod.workloadHours > 6 ? " warn" : "") + " tiny" }, mod.workloadHours + "h")),
          B.moduleItemList(mod.id, { selectedItemId: loc.itemId, onOpen: it => { loc.itemId = it.id; render(); }, onReorder: () => {} })),
        h("div", { class: "gx-expert__editor" }, loc.itemId ? B.itemEditor(mod.items.find(x => x.id === loc.itemId), { scopeMod: mod, onChange: render }) : h("div", { class: "muted", style: { padding: "30px", textAlign: "center" } }, "Select an item — edits apply inline."))));
    }
  }

  render();

  function gotoRef(refId) { for (const m of B.session.modules) { const it = m.items.find(i => i.refId === refId); if (it) { loc.section = "modules"; loc.modId = m.id; loc.itemId = it.id; render(); return; } } }

  function goToTask(n) {
    const acts = {
      1: () => loc.section = "overview", 2: () => loc.section = "sources", 3: () => loc.section = "blueprint",
      4: () => loc.section = "blueprint", 5: () => { loc.section = "blueprint"; },
      6: () => { const fm = B.focusModuleId(); loc.section = "modules"; loc.modId = fm; loc.itemId = null; },
      7: () => { const fm = B.focusModuleId(); loc.section = "modules"; loc.modId = fm; loc.itemId = B.focusItemId(fm, "page"); },
      8: () => { const fm = B.focusModuleId(); loc.section = "modules"; loc.modId = fm; loc.itemId = B.focusItemId(fm, "assignment"); },
      9: () => { const fm = B.focusModuleId(); loc.section = "modules"; loc.modId = fm; loc.itemId = null; },
      10: () => loc.section = "readiness", 11: () => loc.section = "preview", 12: () => loc.section = "export",
    };
    (acts[n] || acts[1])(); render();
  }
  function focusModule(id) { if (!B.moduleById(id)) return; loc.section = "modules"; loc.modId = id; loc.itemId = null; render(); }
  return { goToTask, focusRef: gotoRef, focusModule };

  function secHead(t, s) { return h("header", { class: "gx-sechead" }, h("h1", { class: "gx-h1" }, t), s && h("p", { class: "gx-sub" }, s)); }
  function sectionLabel(id) { return SECTIONS.find(s => s[0] === id)?.[1] || id; }
}
function kv(rows) { return h("dl", { class: "gx-kv" }, rows.map(([k, v]) => [h("dt", {}, k), h("dd", {}, v)]).flat()); }

export function rationale() {
  return h("div", { class: "prose" },
    h("h2", {}, "Hypothesis"),
    h("p", {}, "Tools usually solve the novice/expert gap by shipping two products or by burying pros in beginner scaffolding. Neither is necessary if the information architecture is the same for both — and a single switch changes only density and progressive reveal, never where things live."),
    h("h3", {}, "Information architecture"),
    h("p", {}, "One section model (Overview · Sources · Blueprint · Modules · Readiness · Preview · Export) and one selection state (section → module → item). Guided mode renders each section as a single-focus panel with helper text and hides advanced controls; Expert mode renders the same sections as dense multi-pane surfaces with everything visible and a command affordance. The toggle preserves your exact location and open item."),
    h("h3", {}, "Key moves"),
    h("ul", {}, h("li", {}, "Switching mode keeps context — the location line proves you didn't teleport."),
      h("li", {}, "Guided reveals one item at a time; Expert shows the module list, item list and editor together."),
      h("li", {}, "No feature is exclusive to one mode; Expert just surfaces it sooner.")),
    h("h3", {}, "Trade-offs"),
    h("p", {}, "Two presentations double the design and QA surface, and the toggle must be genuinely lossless or it erodes trust. But it avoids the far worse cost of maintaining two separate products."));
}
function ensureCss(id, hrefs) { (Array.isArray(hrefs) ? hrefs : [hrefs]).forEach((href, i) => { const key = "css-" + id + "-" + i; if (document.getElementById(key)) return; const l = document.createElement("link"); l.id = key; l.rel = "stylesheet"; l.href = href; document.head.append(l); }); }
