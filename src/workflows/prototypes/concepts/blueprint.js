// CONCEPT 2 — BLUEPRINT-FIRST STUDIO
// You approve the instructional architecture (outcomes, sequence, assessment,
// workload, policies) BEFORE any prose exists. Then the content studio unlocks.
import { h, clear, toast } from "../shared/ui.js";
import * as B from "../shared/blocks.js";
ensureCss("blueprint", ["../shared/blocks.css", "./concepts/blueprint.css"]);

export function mount(stage, ctx) {
  let approved = false;
  let sel = "brief";      // current blueprint section OR content module id
  let phase = "blueprint"; // blueprint | studio
  let openItemId = null;

  const nav = h("aside", { class: "bp2-nav" });
  const main = h("section", { class: "bp2-main" });
  const root = h("div", { class: "bp2" }, nav, main);
  stage.append(root);

  const BP_SECTIONS = [
    { id: "brief", label: "Course brief", n: 1 },
    { id: "sources", label: "Source materials", n: 2 },
    { id: "setup", label: "Setup & scope", n: 3 },
    { id: "outcomes", label: "Learning outcomes", n: 4 },
    { id: "sequence", label: "Module sequence", n: 5 },
    { id: "assessment", label: "Assessment strategy", n: 6 },
    { id: "workload", label: "Workload balance", n: 7 },
    { id: "policies", label: "Policies & support", n: 8 },
  ];

  function renderNav() {
    clear(nav);
    nav.append(
      h("div", { class: "bp2-nav__seg" }, h("span", { class: "bp2-nav__eyebrow" }, "1 · Blueprint"),
        h("span", { class: "tiny muted" }, "Decisions before prose")),
      h("ul", { class: "bp2-nav__list" }, BP_SECTIONS.map(s => h("li", {},
        h("button", { class: "bp2-nav__item" + (phase === "blueprint" && sel === s.id ? " is-on" : ""), onClick: () => { phase = "blueprint"; sel = s.id; render(); } },
          h("span", { class: "bp2-nav__num" }, s.n), s.label)))),
      h("div", { class: "bp2-gate" },
        approved ? h("div", { class: "bp2-gate__done" }, "✓ Blueprint approved") :
          h("button", { class: "btn btn--primary", style: { width: "100%" }, onClick: approve }, "Review & approve blueprint")),
      h("div", { class: "bp2-nav__seg" }, h("span", { class: "bp2-nav__eyebrow" }, "2 · Course content"),
        h("span", { class: "tiny muted" }, approved ? "Unlocked" : "Locked until approval")),
      h("ul", { class: "bp2-nav__list" + (approved ? "" : " is-locked") }, [
        ...B.session.modules.map(m => h("li", {}, h("button", {
          class: "bp2-nav__item bp2-nav__item--mod" + (phase === "studio" && sel === m.id ? " is-on" : ""),
          disabled: !approved, onClick: () => { phase = "studio"; sel = m.id; openItemId = null; render(); } },
          h("span", { class: "bp2-nav__num" }, m.kind === "start" ? "S" : m.order),
          m.kind === "start" ? "Start Here" : m.title.replace(/^\d+ · /, ""),
          m.status !== "approved" && h("span", { class: "bp2-dot" })))),
        h("li", {}, extraNav("Readiness", "readiness")),
        h("li", {}, extraNav("Student preview", "preview")),
        h("li", {}, extraNav("Export", "export")),
      ]),
    );
  }
  function extraNav(label, id) {
    return h("button", { class: "bp2-nav__item bp2-nav__item--x" + (phase === "studio" && sel === id ? " is-on" : ""), disabled: !approved, onClick: () => { phase = "studio"; sel = id; render(); } }, label);
  }

  function approve() {
    // show a confirm-style summary in main
    phase = "blueprint"; sel = "__review"; render();
  }

  function render() {
    renderNav(); clear(main);
    if (phase === "blueprint") return renderBlueprint();
    return renderStudio();
  }

  function renderBlueprint() {
    if (sel === "__review") return renderApproveGate();
    const s = BP_SECTIONS.find(x => x.id === sel);
    main.append(h("header", { class: "bp2-head" },
      h("p", { class: "bp2-head__eyebrow" }, "Blueprint · step " + s.n + " of 8"),
      h("h1", {}, s.label)));
    const body = h("div", { class: "bp2-body" });
    main.append(body);
    ({
      brief: () => body.append(h("p", { class: "bp2-lead" }, "The one-sentence intent that everything else is built to serve."),
        h("textarea", { class: "blk-textarea", rows: 4, html: B.D.course?.description || "" }),
        h("p", { class: "tiny muted", style: { marginTop: "8px" } }, "No prose is generated from this yet — it only shapes the architecture you'll approve.")),
      sources: () => body.append(h("p", { class: "bp2-lead" }, "Materials we read for structure. We extract outcomes, policies, and sequence — we never invent facts."), B.sourceList()),
      setup: () => body.append(h("p", { class: "bp2-lead" }, "The scope decisions that constrain the whole blueprint."), B.courseChange({ onChanged: () => toast("Scope updated — the blueprint below reflects it", "ok") })),
      outcomes: () => body.append(h("p", { class: "bp2-lead" }, "Approve the outcomes first — every module, assignment, and quiz will be aligned to these."),
        outcomesEditor()),
      sequence: () => body.append(h("p", { class: "bp2-lead" }, "The order and shape of the " + B.session.modules.length + " modules. Any unusually heavy week is flagged."),
        B.blueprintView({}).querySelector(".blk-bp__card:nth-child(2)") ? B.blueprintView({}) : B.blueprintView({})),
      assessment: () => body.append(h("p", { class: "bp2-lead" }, "Five graded categories totalling 100%. Weights are decisions — change them before content exists."), assessmentEditor()),
      workload: () => body.append(h("p", { class: "bp2-lead" }, "Planned student time, by activity. Module 7 is well above the norm."), B.blueprintView({})),
      policies: () => body.append(h("p", { class: "bp2-lead" }, "Required policies and support content. Two are still empty."), policiesList()),
    })[sel]?.();
    // footer with move-to-next / approve
    const i = BP_SECTIONS.findIndex(x => x.id === sel);
    main.append(h("footer", { class: "bp2-foot" },
      i > 0 && h("button", { class: "btn", onClick: () => { sel = BP_SECTIONS[i - 1].id; render(); } }, "‹ " + BP_SECTIONS[i - 1].label),
      h("span", { class: "grow" }),
      i < BP_SECTIONS.length - 1
        ? h("button", { class: "btn btn--primary", onClick: () => { sel = BP_SECTIONS[i + 1].id; render(); } }, BP_SECTIONS[i + 1].label + " ›")
        : h("button", { class: "btn btn--primary", onClick: approve }, "Review & approve →")));
  }

  function renderApproveGate() {
    main.append(h("header", { class: "bp2-head" }, h("p", { class: "bp2-head__eyebrow" }, "Approve the architecture"),
      h("h1", {}, "This is the plan. Approve it to generate content.")));
    main.append(h("p", { class: "bp2-lead" }, "Nothing has been written yet. When you approve, RocketCourse writes pages, discussions, assignments and quizzes to fit this exact structure — so review is targeted, not a firehose."));
    main.append(B.blueprintView({}));
    main.append(h("div", { class: "bp2-approvebar" },
      h("label", { class: "row gap-8" }, h("input", { type: "checkbox", id: "bp2-ack" }), h("span", { class: "tiny" }, "I've reviewed the outcomes, sequence, and assessment plan.")),
      h("button", { class: "btn btn--primary", onClick: () => {
        if (!main.querySelector("#bp2-ack").checked) { toast("Confirm you've reviewed the plan first", "info"); return; }
        approved = true; phase = "studio"; sel = B.focusModuleId(); toast("Blueprint approved — content generated to fit it", "ok"); render();
      } }, "Approve & generate content")));
  }

  function renderStudio() {
    if (sel === "readiness") { main.append(studioHead("Readiness", "What must be fixed before a confident export.")); main.append(B.readinessPanel({ onResolveGoto: it => { const m = findModuleOf(it.refId); if (m) { sel = m.id; openItemId = itemIdOf(it.refId); render(); } } })); return; }
    if (sel === "preview") { main.append(studioHead("Student preview", "Exactly what students see in Canvas.")); main.append(B.studentPreview({})); return; }
    if (sel === "export") { main.append(studioHead("Export", "The honest export decision.")); main.append(B.exportPanel({ onGoResolve: () => { sel = "readiness"; render(); } })); return; }
    // a module
    const mod = B.moduleById(sel);
    main.append(studioHead(mod.title, mod.summary));
    const layout = h("div", { class: "bp2-studio" },
      h("div", { class: "bp2-studio__items" },
        h("p", { class: "tiny muted" }, "Every item is aligned to the outcomes you approved. Reorder with ↑ ↓."),
        B.moduleItemList(mod.id, { selectedItemId: openItemId, onOpen: it => { openItemId = it.id; render(); }, onReorder: () => {} })),
      h("div", { class: "bp2-studio__editor" }, openItemId
        ? B.itemEditor(mod.items.find(x => x.id === openItemId), { scopeMod: mod, onChange: () => render() })
        : h("div", { class: "bp2-empty muted" }, "Select an item to edit it. Its aligned outcome is shown in the editor.")));
    main.append(layout);
  }
  function studioHead(title, sub) { return h("header", { class: "bp2-head" }, h("p", { class: "bp2-head__eyebrow" }, "Course content"), h("h1", {}, title), sub && h("p", { class: "bp2-lead" }, sub)); }

  render();

  function goToTask(n) {
    if (n <= 8 && n >= 1) {
      const secByTask = { 1: "brief", 2: "sources", 3: "setup", 4: "__review", 5: "setup" };
      if (secByTask[n]) { phase = "blueprint"; sel = secByTask[n]; render(); return { }; }
    }
    // tasks 6-12 require the studio; auto-approve to demonstrate
    approved = true; phase = "studio";
    const fm = B.focusModuleId();
    if (n === 6) { sel = fm; openItemId = null; }
    if (n === 7) { sel = fm; openItemId = B.focusItemId(fm, "page"); }
    if (n === 8) { sel = fm; openItemId = B.focusItemId(fm, "assignment"); }
    if (n === 9) { sel = fm; openItemId = null; }
    if (n === 10) { sel = "readiness"; }
    if (n === 11) { sel = "preview"; }
    if (n === 12) { sel = "export"; }
    render();
  }
  return { goToTask };

  function findModuleOf(refId) { return B.session.modules.find(m => m.items.some(i => i.refId === refId)); }
  function itemIdOf(refId) { for (const m of B.session.modules) { const it = m.items.find(i => i.refId === refId); if (it) return it.id; } return null; }
}

function outcomesEditor() {
  const wrap = h("div", { class: "bp2-outcomes" });
  B.session.outcomes.forEach(o => wrap.append(h("div", { class: "bp2-outcome" + (o.alignedModuleIds.length === 0 ? " attn" : "") },
    h("div", { class: "row spread" }, h("strong", {}, o.code + " · " + o.bloom),
      o.alignedModuleIds.length ? h("span", { class: "pill ok tiny" }, o.alignedModuleIds.length + " modules") : h("span", { class: "pill warn tiny" }, "unaligned")),
    h("p", { style: { margin: "4px 0 0", fontSize: "14px" } }, o.text),
    o.alignedModuleIds.length === 0 && h("button", { class: "btn btn--sm", style: { marginTop: "8px" }, onClick: e => { const target = B.session.modules.find(m => m.kind !== "start") || B.session.modules[0]; o.alignedModuleIds = target ? [target.id] : []; B.session.commit?.(); B.resolveIssue("w3"); toast(o.code + " aligned to " + (target?.title || "a module"), "ok"); e.currentTarget.replaceWith(h("span", { class: "pill ok tiny" }, "now aligned")); } }, "Align to a module"))));
  return wrap;
}
function assessmentEditor() {
  const wrap = h("div", { class: "bp2-assess" });
  let total = B.session.assignmentGroups.reduce((s, g) => s + g.weight, 0);
  const totalEl = h("span", { class: "pill" + (total === 100 ? " ok" : " danger") }, total + "%");
  B.session.assignmentGroups.forEach(g => {
    const val = h("span", { class: "bp2-assess__val" }, g.weight + "%");
    wrap.append(h("div", { class: "bp2-assess__row" }, h("span", {}, g.name),
      h("input", { type: "range", min: 0, max: 50, value: g.weight, oninput: e => { g.weight = +e.target.value; val.textContent = g.weight + "%"; total = B.session.assignmentGroups.reduce((s, x) => s + x.weight, 0); totalEl.textContent = total + "%"; totalEl.className = "pill" + (total === 100 ? " ok" : " danger"); }, onchange: () => B.session.commit?.() }), val));
  });
  wrap.append(h("div", { class: "bp2-assess__total row spread" }, h("strong", {}, "Total must equal 100%"), totalEl));
  return wrap;
}
function policiesList() {
  return h("ul", { class: "bp2-pol" }, B.session.syllabus.sections.filter(s => ["s-integrity", "s-ai", "s-late", "s-access"].includes(s.id)).map(s =>
    h("li", { class: "bp2-pol__i" + (s.complete ? "" : " attn") },
      h("div", { class: "grow" }, h("strong", {}, s.title), s.body ? h("p", { class: "tiny muted", style: { margin: "2px 0 0" } }, s.body) : h("p", { class: "tiny", style: { margin: "2px 0 0", color: "var(--warn)" } }, s.note || "Empty")),
      s.complete ? h("span", { class: "pill ok tiny" }, "set") : h("button", { class: "btn btn--sm", onClick: e => { s.complete = true; s.body = s.body || "Confirmed — standard institutional language applies."; B.session.commit?.(); toast(s.title + " confirmed", "ok"); e.currentTarget.replaceWith(h("span", { class: "pill ok tiny" }, "set")); } }, "Confirm"))));
}

export function rationale() {
  return h("div", { class: "prose" },
    h("h2", {}, "Hypothesis"),
    h("p", {}, "Instructors distrust “AI course generators” because they produce plausible prose that hides bad structure. Flip the order: have the human approve the instructional architecture — outcomes, sequence, assessment mix, workload — before a single paragraph is written. Trust is earned at the level of decisions, not sentences."),
    h("h3", {}, "Information architecture"),
    h("p", {}, "Two numbered zones in one rail: Blueprint (8 decision sections) and Course content (locked until the blueprint is approved). The approval gate is a real, deliberate checkpoint. Only after approval does prose exist — so the later review is targeted rather than overwhelming."),
    h("h3", {}, "Key moves"),
    h("ul", {}, h("li", {}, "Alignment is a first-class, visible decision (unaligned outcomes are flagged at the blueprint stage, not discovered at export)."),
      h("li", {}, "Assessment weights are sliders that must total 100% before you proceed."),
      h("li", {}, "Content generation is explicitly downstream of an approved structure, so exports stay valid.")),
    h("h3", {}, "Trade-offs"),
    h("p", {}, "Front-loads abstract thinking; a user who just wants to “see a course” waits longer for something visible. Best for instructors and instructional designers who think in outcomes."));
}
function ensureCss(id, hrefs) { (Array.isArray(hrefs) ? hrefs : [hrefs]).forEach((href, i) => { const key = "css-" + id + "-" + i; if (document.getElementById(key)) return; const l = document.createElement("link"); l.id = key; l.rel = "stylesheet"; l.href = href; document.head.append(l); }); }
