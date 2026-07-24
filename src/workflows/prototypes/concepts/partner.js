// CONCEPT 4 — CONVERSATIONAL COURSE PARTNER
// A guide proposes SCOPED, checkpointed changes beside a live course + preview.
// The conversation is secondary: you can navigate and edit directly at any time.
import { h, clear, toast, itemGlyph } from "../shared/ui.js";
import * as B from "../shared/blocks.js";
ensureCss("partner", ["../shared/blocks.css", "./concepts/partner.css"]);

export function mount(stage, ctx) {
  let center = { kind: "course" };   // course|sources|setup|blueprint|module|item|readiness|preview|export
  let modId = B.focusModuleId(), itemId = null, previewOn = false;

  const rail = h("aside", { class: "pt-rail" });
  const stageEl = h("section", { class: "pt-stage" });
  const chat = h("aside", { class: "pt-chat" });
  stage.append(h("div", { class: "pt" }, rail, stageEl, chat));

  // ---- left: live course structure ----------------------------------------
  function renderRail() {
    clear(rail);
    rail.append(h("div", { class: "pt-rail__head" }, h("strong", {}, "Course"), h("span", { class: "tiny muted" }, "direct navigation")),
      navBtn("Overview", () => set({ kind: "course" }), center.kind === "course"),
      navBtn("Sources", () => set({ kind: "sources" }), center.kind === "sources"),
      navBtn("Blueprint", () => set({ kind: "blueprint" }), center.kind === "blueprint"),
      h("div", { class: "pt-rail__sec" }, "Modules"),
      h("div", { class: "pt-rail__mods" }, B.session.modules.map(m => h("button", {
        class: "pt-modrow" + (center.kind === "module" && modId === m.id ? " is-on" : ""),
        onClick: () => set({ kind: "module" }, m.id) },
        h("span", { class: "pt-modrow__n" }, m.kind === "start" ? "S" : m.order),
        h("span", { class: "grow" }, m.kind === "start" ? "Start Here" : m.title.replace(/^\d+ · /, "")),
        m.status !== "approved" && h("span", { class: "pt-dot" })))),
      h("div", { class: "pt-rail__sec" }, "Checks"),
      navBtn("Readiness  (" + B.openIssuesCount() + ")", () => set({ kind: "readiness" }), center.kind === "readiness"),
      navBtn("Student preview", () => set({ kind: "preview" }), center.kind === "preview"),
      navBtn("Export", () => set({ kind: "export" }), center.kind === "export"));
  }
  function navBtn(label, fn, on) { return h("button", { class: "pt-nav" + (on ? " is-on" : ""), onClick: fn }, label); }
  function set(c, mid) { center = c; if (mid) modId = mid; if (c.kind !== "item") itemId = null; render(); }

  // ---- center stage --------------------------------------------------------
  function renderCenter() {
    clear(stageEl);
    const bar = h("div", { class: "pt-stagebar" },
      h("div", { class: "pt-crumb tiny" }, centerCrumb()),
      (center.kind === "module" || center.kind === "item" || center.kind === "course") && h("button", { class: "pt-prevtoggle" + (previewOn ? " is-on" : ""), onClick: () => { previewOn = !previewOn; renderCenter(); } }, previewOn ? "◧ Builder view" : "👁 Student view"));
    stageEl.append(bar);
    const body = h("div", { class: "pt-stagebody" });
    stageEl.append(body);
    if (previewOn && (center.kind === "module" || center.kind === "course" || center.kind === "item")) { body.append(B.studentPreview({ moduleId: center.kind === "module" ? modId : undefined })); return; }
    ({
      course: () => body.append(h("h1", { class: "pt-h1" }, B.D.course.title), h("p", { class: "pt-sub" }, B.D.course.subtitle),
        h("p", { class: "pt-prose" }, B.D.course.description),
        h("p", { class: "tiny muted" }, "Ask the partner on the right for help, or just click into any module to work directly.")),
      sources: () => body.append(h("h1", { class: "pt-h1" }, "Source materials"), B.sourceList()),
      setup: () => body.append(h("h1", { class: "pt-h1" }, "Course setup"), B.courseChange({ onChanged: render })),
      blueprint: () => body.append(h("h1", { class: "pt-h1" }, "Blueprint"), B.blueprintView({})),
      readiness: () => body.append(h("h1", { class: "pt-h1" }, "Readiness"), B.readinessPanel({ onResolveGoto: it => gotoRef(it.refId) })),
      preview: () => body.append(B.studentPreview({})),
      export: () => body.append(h("h1", { class: "pt-h1" }, "Export"), B.exportPanel({ onGoResolve: () => set({ kind: "readiness" }) })),
      module: () => { const m = B.moduleById(modId); body.append(h("h1", { class: "pt-h1" }, m.title), h("p", { class: "pt-sub" }, m.summary),
        B.moduleItemList(m.id, { onOpen: it => { center = { kind: "item" }; itemId = it.id; render(); }, onReorder: () => {} })); },
      item: () => { const m = B.moduleById(modId); const it = m.items.find(x => x.id === itemId); body.append(B.itemEditor(it, { scopeMod: m, onChange: render })); },
    })[center.kind]?.();
  }
  function centerCrumb() {
    if (center.kind === "module") return "Course › " + B.moduleById(modId).title;
    if (center.kind === "item") return "Course › Module " + B.moduleById(modId).order + " › " + B.moduleById(modId).items.find(x => x.id === itemId)?.title;
    return "Course › " + center.kind;
  }

  // ---- right: conversation with scoped, checkpointed proposals -------------
  const messages = [];
  function renderChat() {
    clear(chat);
    chat.append(h("div", { class: "pt-chat__head" }, h("span", { class: "pt-chat__ai" }, "✦"), h("div", {}, h("strong", {}, "Course partner"), h("div", { class: "tiny muted" }, "Proposes changes — you approve each one"))));
    const log = h("div", { class: "pt-chat__log" });
    messages.forEach(m => log.append(renderMsg(m)));
    chat.append(log);
    chat.append(h("div", { class: "pt-chat__composer" },
      h("div", { class: "pt-chips" }, ["What needs my attention?", "Explain this rubric", "Fix the must-fix issues"].map(q =>
        h("button", { class: "pt-chip", onClick: () => userSay(q) }, q))),
      h("div", { class: "row gap-8" },
        h("input", { class: "pt-input", placeholder: "Ask the partner…", onkeydown: e => { if (e.key === "Enter" && e.target.value.trim()) { userSay(e.target.value.trim()); e.target.value = ""; } } }),
        h("button", { class: "btn btn--sm btn--primary", onClick: e => { const i = e.currentTarget.previousSibling; if (i.value.trim()) { userSay(i.value.trim()); i.value = ""; } } }, "Send"))));
    log.scrollTop = log.scrollHeight;
    setTimeout(() => { log.scrollTop = log.scrollHeight; }, 0);
  }
  function renderMsg(m) {
    if (m.role === "user") return h("div", { class: "pt-msg pt-msg--user" }, m.text);
    const node = h("div", { class: "pt-msg pt-msg--ai" }, h("p", { class: "pt-msg__text" }, m.text));
    if (m.proposal && !m.done) node.append(proposalCard(m));
    if (m.done) node.append(h("div", { class: "pt-applied" }, "✓ " + m.doneLabel));
    return node;
  }
  function proposalCard(m) {
    return h("div", { class: "pt-proposal" },
      h("div", { class: "pt-proposal__scope" }, "Scope · " + m.proposal.scope),
      h("div", { class: "pt-proposal__what" }, m.proposal.what),
      h("div", { class: "row gap-8", style: { marginTop: "10px" } },
        h("button", { class: "btn btn--sm btn--primary", onClick: () => { m.proposal.apply(); m.done = true; m.doneLabel = m.proposal.doneLabel; renderChat(); renderRail(); toast("Applied · " + m.proposal.doneLabel, "ok"); } }, "Approve change"),
        h("button", { class: "btn btn--sm", onClick: () => { m.done = true; m.doneLabel = "Dismissed"; renderChat(); } }, "Not now"),
        m.proposal.showLabel && h("button", { class: "btn btn--sm btn--ghost", onClick: () => m.proposal.show() }, m.proposal.showLabel)));
  }
  function ai(text, proposal) { messages.push({ role: "assistant", text, proposal }); renderChat(); }
  function userSay(text) {
    messages.push({ role: "user", text }); renderChat();
    setTimeout(() => respond(text), 250);
  }
  function respond(text) {
    const t = text.toLowerCase();
    if (t.includes("attention") || t.includes("need")) {
      ai("Two things must be fixed before a confident export: an unverified quiz answer key in Module 3, and an incomplete rubric on the Module 4 essay. I can take you to each.", {
        scope: "2 items · Module 3 & Module 4", what: "Open the readiness list and resolve both must-fix blockers.",
        showLabel: "Show readiness", show: () => set({ kind: "readiness" }),
        doneLabel: "Opened readiness", apply: () => set({ kind: "readiness" }) });
    } else if (t.includes("rubric")) {
      ai("The Short Essay 2 rubric is missing performance levels for its “Use of evidence” criterion, so it's worth 0 points. I can add three standard levels (Exceeds / Meets / Developing) totalling 8 points.", {
        scope: "1 rubric · Module 4 essay", what: "Add the missing performance levels and mark the rubric complete.",
        showLabel: "Open the essay", show: () => { center = { kind: "item" }; modId = B.focusModuleId(); itemId = B.focusItemId(modId, "assignment"); render(); },
        doneLabel: "Completed the rubric", apply: () => { const r = Object.values(B.session.rubrics).find(x => !x.complete); if (!r) { render(); return; } const c = r.criteria.find(x => x.levels.length === 0); if (c) { c.points = 8; c.levels = [{ label: "Exceeds", points: 8, desc: "Precise, integrated evidence." }, { label: "Meets", points: 6, desc: "Relevant evidence." }, { label: "Developing", points: 3, desc: "Thin evidence." }]; } r.complete = true; r.points = r.criteria.reduce((s, x) => s + x.points, 0); B.session.commit?.(); B.resolveIssue("b2"); B.resolveIssue("rev3"); render(); } });
    } else if (t.includes("fix") && t.includes("must")) {
      ai("I'll clear both must-fix blockers: verify the Module 3 answer key and complete the Module 4 rubric. You approve the change before I touch anything.", {
        scope: "Course-wide · 2 blockers", what: "Verify the answer key AND complete the essay rubric in one approved step.",
        doneLabel: "Both blockers cleared", apply: () => {
          for (const quiz of Object.values(B.session.quizzes)) { const q = quiz.questions.find(x => x.needsAttention); if (q) { q.needsAttention = null; q.verified = true; } }
          const r = Object.values(B.session.rubrics).find(x => !x.complete); if (r) { const c = r.criteria.find(x => x.levels.length === 0); if (c) { c.points = 8; c.levels = [{ label: "Meets", points: 6, desc: "Relevant evidence." }]; } r.complete = true; }
          B.session.commit?.();
          B.resolveIssue("b1"); B.resolveIssue("b2"); B.resolveIssue("rev2"); B.resolveIssue("rev3"); render();
        } });
    } else {
      ai("I can help with structure, alignment, rubrics, workload, accessibility, or export readiness. Everything I suggest comes as a change you approve — and you can always edit directly on the left. What would you like to do?");
    }
  }

  function render() { renderRail(); renderCenter(); if (!chat.firstChild) renderChat(); }
  function gotoRef(refId) { for (const m of B.session.modules) { const it = m.items.find(i => i.refId === refId); if (it) { center = { kind: "item" }; modId = m.id; itemId = it.id; render(); return; } } }

  // boot
  ai("Hi — I'm your course partner. Your draft has 13 modules and a few things that need your eye. Ask me “what needs my attention?” or dive into any module yourself.");
  render();

  function goToTask(n) {
    const acts = {
      1: () => center = { kind: "course" },
      2: () => center = { kind: "sources" },
      3: () => { center = { kind: "setup" }; },
      4: () => center = { kind: "blueprint" },
      5: () => { center = { kind: "setup" }; ai("Want to change the course length? I'll apply it course-wide once you approve.", { scope: "Course-wide", what: "Set the course to 14 weeks.", doneLabel: "Course set to 14 weeks", apply: () => { B.session.settings.weeks = 14; B.session.commit?.(); } }); },
      6: () => { center = { kind: "module" }; modId = B.focusModuleId(); },
      7: () => { center = { kind: "item" }; modId = B.focusModuleId(); itemId = B.focusItemId(modId, "page"); },
      8: () => { center = { kind: "item" }; modId = B.focusModuleId(); itemId = B.focusItemId(modId, "assignment"); },
      9: () => { center = { kind: "module" }; modId = B.focusModuleId(); },
      10: () => center = { kind: "readiness" },
      11: () => center = { kind: "preview" },
      12: () => center = { kind: "export" },
    };
    (acts[n] || acts[1])(); render();
  }
  return { goToTask };
}

export function rationale() {
  return h("div", { class: "prose" },
    h("h2", {}, "Hypothesis"),
    h("p", {}, "A pure chatbot forces every action through prose and hides the artifact. A pure dashboard gives no help. The win is a partner that proposes concrete, scoped changes you approve — while the real course and its student preview stay primary and directly editable."),
    h("h3", {}, "Information architecture"),
    h("p", {}, "Three zones with a deliberate hierarchy: the live course (left, direct navigation) and the working stage (centre, with a one-tap Student-view toggle) are primary; the conversation (right) is an assistant, not the only door. You never have to talk to the tool to get something done."),
    h("h3", {}, "Key moves"),
    h("ul", {}, h("li", {}, "Every AI suggestion is a proposal card with an explicit scope line (“1 rubric · Module 4”) and Approve / Not now — nothing changes without a human checkpoint."),
      h("li", {}, "“Show me” links jump the centre stage to the exact object under discussion."),
      h("li", {}, "Builder ⇄ Student view toggle keeps the outcome, not the chat, at the centre.")),
    h("h3", {}, "Trade-offs"),
    h("p", {}, "Risk of over-reliance on chat and of proposal fatigue; mitigated by making direct manipulation always available and by keeping proposals concrete and rare. Weakest on very small screens where three zones compress."));
}
function ensureCss(id, hrefs) { (Array.isArray(hrefs) ? hrefs : [hrefs]).forEach((href, i) => { const key = "css-" + id + "-" + i; if (document.getElementById(key)) return; const l = document.createElement("link"); l.id = key; l.rel = "stylesheet"; l.href = href; document.head.append(l); }); }
