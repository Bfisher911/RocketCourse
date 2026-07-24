// ============================================================================
// SHARED CONTENT WIDGETS — the reusable "what you edit" pieces. Concepts differ
// in navigation, sequencing and framing; they reuse these content surfaces so
// every concept preserves the same capabilities and output. Live session state
// makes edits + issue-resolution persist while you compare concepts.
// ============================================================================
import { h, clear, toast, ATTN, itemGlyph, ring } from "./ui.js";
import * as MOCK from "../data/course.js";

// ---- live, mutable containers ------------------------------------------------
// `session` is what widgets/concepts read & mutate. `D` is course-level info
// several concepts read (course identity, groups, contact hours, sources…).
// Both are MUTABLE OBJECTS (not module namespaces) so that:
//   • lab mode seeds them from the deterministic mock below, and
//   • app mode lets the CourseAdapter write the REAL course into the SAME
//     objects (bindSession) — every widget closure keeps working untouched.
const clone = x => JSON.parse(JSON.stringify(x));
export const D = clone({
  course: MOCK.course, sourceFiles: MOCK.sourceFiles, assignmentGroups: MOCK.assignmentGroups,
  outcomes: MOCK.outcomes, rubrics: MOCK.rubrics, pages: MOCK.pages, assignments: MOCK.assignments,
  discussions: MOCK.discussions, quizzes: MOCK.quizzes, modules: MOCK.modules,
  homepage: MOCK.homepage, syllabus: MOCK.syllabus, contactHours: MOCK.contactHours,
  theme: MOCK.theme, accessibility: MOCK.accessibility, reviewQueue: MOCK.reviewQueue,
  readiness: MOCK.readiness, exportStatus: MOCK.exportStatus,
});
export const session = {
  modules: clone(MOCK.modules),
  pages: clone(MOCK.pages),
  assignments: clone(MOCK.assignments),
  discussions: clone(MOCK.discussions),
  quizzes: clone(MOCK.quizzes),
  rubrics: clone(MOCK.rubrics),
  readiness: clone(MOCK.readiness),
  reviewQueue: clone(MOCK.reviewQueue),
  accessibility: clone(MOCK.accessibility),
  exportStatus: clone(MOCK.exportStatus),
  outcomes: clone(MOCK.outcomes),
  assignmentGroups: clone(MOCK.assignmentGroups),
  theme: clone(MOCK.theme),
  homepage: clone(MOCK.homepage),
  syllabus: clone(MOCK.syllabus),
  contactHours: clone(MOCK.contactHours),
  sourceFiles: clone(MOCK.sourceFiles),
  settings: { weeks: MOCK.course.weeks, modality: MOCK.course.modality, level: MOCK.course.level,
              creditHours: MOCK.course.creditHours, includeRubrics: true, aiPolicy: "Not set",
              interactionDensity: "balanced" },
  interactivity: { total: 46, standard: 31, courseSpecific: 15, distinctPatterns: 19,
                   bySurfaceType: { pages: 28, assignments: 9, discussions: 6, quizzes: 3 },
                   target: 60, meetsTarget: false, density: "balanced",
                   summary: "46 of a recommended 60 interactions. Raise the density or add course-specific patterns for a richer course." },
  resolved: new Set(),        // ids of resolved readiness items
  fullContentGenerated: false,
  validated: false,
  // In lab mode, committing just notifies listeners. When the CourseAdapter is
  // bound (app mode) it replaces this with a facade→CourseProject write-back.
  commit: () => emit(),
  actions: null,
};
const listeners = new Set();
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); }

// Bind hook for the app host: hands the adapter the mutable containers + the
// emit function. The adapter installs session.commit/session.actions and does
// its first refresh. Widgets and concepts never know which mode they're in.
export function getBindTarget() { return { session, D, emit }; }

export function resolveIssue(id) {
  if (session.actions?.resolveIssue) { session.actions.resolveIssue(id); return; }
  if (session.resolved.has(id)) return;
  session.resolved.add(id);
  session.readiness.blockers = session.readiness.blockers.filter(b => b.id !== id);
  session.readiness.warnings = session.readiness.warnings.filter(w => w.id !== id);
  // recompute a friendly score as issues clear
  const cleared = session.resolved.size;
  session.readiness.score = Math.min(100, 78 + cleared * 4);
  if (session.readiness.blockers.length === 0) session.readiness.status = session.readiness.warnings.length ? "Review" : "Ready";
  emit();
}
export function openIssuesCount() { return session.readiness.blockers.length + session.readiness.warnings.length; }
export function moduleById(id) { return session.modules.find(m => m.id === id); }

// ---- session-derived focus targets ------------------------------------------
// Concepts must never hardcode object ids (they only exist in the mock course).
// These resolve "the module/item worth focusing" for ANY course, preferring
// things that need the instructor's attention.
export function focusModuleId() {
  const mods = session.modules;
  const content = mods.filter(m => m.kind !== "start");
  const flagged = content.find(m => m.items?.some(i => i.needsAttention));
  return (flagged || content[Math.min(3, Math.max(0, content.length - 1))] || mods[0])?.id ?? null;
}
export function firstModuleId() { return session.modules[0]?.id ?? null; }
export function focusItemId(modId, type) {
  const m = moduleById(modId);
  if (!m || !m.items.length) return null;
  const flagged = m.items.find(i => i.needsAttention && (!type || i.type === type));
  return (flagged || m.items.find(i => !type || i.type === type) || m.items[0])?.id ?? null;
}
export function contentFor(item) {
  if (!item) return null;
  const map = { page: session.pages, assignment: session.assignments, discussion: session.discussions, quiz: session.quizzes };
  return map[item.type]?.[item.refId] || null;
}

// ---------------------------------------------------------------------------
// Provenance line — the honest "who made this" marker (AI vs your edit).
export function provenance(edited) {
  return edited
    ? h("span", { class: "pill ok", title: "You edited this" }, "✓ Your edit")
    : h("span", { class: "pill ai", title: "Drafted by AI from your materials — review before publishing" }, "✦ AI draft · review");
}

// ---------------------------------------------------------------------------
// PAGE EDITOR — reused everywhere pages are edited. Distinct save affordance.
export function pageEditor(pageId, { scopeNote = "This change affects one page.", onSaved } = {}) {
  const page = session.pages[pageId];
  const wrap = h("div", { class: "blk-editor" });
  function render() {
    clear(wrap);
    // Autosave: edits write to the model on input so navigating away never loses work.
    // The host is notified only on blur, to avoid re-rendering (and losing focus) mid-keystroke.
    const status = statusLine(page);
    const markSaved = () => { page.edited = true; status.textContent = "✓ Saved · edits apply as you type"; };
    const titleI = h("input", { class: "blk-input blk-input--title", value: page.title, "aria-label": "Page title",
      onInput: e => { page.title = e.target.value; markSaved(); }, onChange: () => { session.commit(); onSaved?.(page); } });
    const bodyA = h("textarea", { class: "blk-textarea", "aria-label": "Page content", rows: 12,
      onInput: e => { page.body = textToHtml(e.target.value); markSaved(); }, onChange: () => { session.commit(); onSaved?.(page); } });
    bodyA.value = htmlToText(page.body);
    wrap.append(
      h("div", { class: "blk-editor__bar" },
        h("div", { class: "row gap-8" }, h("span", { class: "blk-kind" }, "▤ Page"), provenance(page.edited)),
        h("span", { class: "blk-scope tiny muted" }, "Scope · " + scopeNote)),
      titleI,
      h("div", { class: "blk-toolbar tiny muted" }, "Content · autosaves as you type (prototype)"),
      bodyA,
      h("div", { class: "row spread", style: { marginTop: "10px" } }, status, h("span", { class: "pill ok tiny" }, "Autosave on")),
    );
  }
  render();
  return wrap;
}
function statusLine(page) { return h("span", { class: "tiny muted" }, page.edited ? "Saved · last edited just now" : "AI draft · not yet edited"); }
function htmlToText(html) {
  return html.replace(/<\/(p|h2|h3|li|ul)>/g, "\n").replace(/<li>/g, "• ").replace(/<[^>]+>/g, "").replace(/\n{3,}/g, "\n\n").trim();
}
function textToHtml(t) { return t.split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`).join(""); }

// ---------------------------------------------------------------------------
// ASSIGNMENT + RUBRIC — reused for task 8. Highlights the incomplete rubric.
export function assignmentRubricView(assignmentId, { onResolve } = {}) {
  const a = session.assignments[assignmentId];
  const rubric = session.rubrics[a.rubricId];
  const wrap = h("div", { class: "blk-ar" });
  function render() {
    clear(wrap);
    wrap.append(
      h("div", { class: "blk-ar__head" },
        h("div", {}, h("span", { class: "blk-kind" }, "✎ Assignment"),
          h("h3", { class: "blk-ar__title" }, a.title)),
        h("div", { class: "row gap-8" }, provenance(a.edited),
          h("span", { class: "pill" }, a.points + " pts"))),
      metaGrid([
        ["Due", a.dueAt], ["Group", groupName(a.groupId)], ["Submission", a.submissionType],
        ["Est. student time", a.estimatedHours + " hrs"], ["Aligned outcomes", a.alignedOutcomeIds.map(oc).join(", ")],
      ]),
      h("div", { class: "blk-prose prose", html: a.instructions }),
      h("div", { class: "hr", style: { margin: "14px 0" } }),
      rubricBlock(rubric, onResolve),
    );
  }
  render();
  return wrap;
}
function rubricBlock(rubric, onResolve) {
  const incomplete = !rubric.complete;
  const box = h("div", { class: "blk-rubric" + (incomplete ? " attn attn--danger" : "") },
    h("div", { class: "row spread" },
      h("div", { class: "row gap-8" }, h("span", { class: "blk-kind" }, "▦ Rubric"), h("strong", {}, rubric.title)),
      incomplete ? h("span", { class: "pill danger" }, "Incomplete") : h("span", { class: "pill ok" }, "Complete · " + rubric.points + " pts")),
    incomplete && h("p", { class: "blk-rubric__why tiny" }, "⚠ " + rubric.incompleteReason),
    h("table", { class: "blk-rubric__t" },
      h("thead", {}, h("tr", {}, h("th", {}, "Criterion"), h("th", {}, "Points"), h("th", {}, "Levels"))),
      h("tbody", {}, rubric.criteria.map(c => h("tr", { class: c.levels.length ? "" : "is-empty" },
        h("td", {}, c.title),
        h("td", {}, c.points + " pts"),
        h("td", {}, c.levels.length ? c.levels.map(l => l.label).join(" · ") : h("em", { class: "muted" }, "No levels set")))))),
    incomplete && h("button", { class: "btn btn--primary btn--sm", style: { marginTop: "10px" }, onClick: () => {
      // complete the incomplete criterion
      const crit = rubric.criteria.find(c => c.levels.length === 0);
      if (crit) { crit.points = 8; crit.levels = [
        { label: "Exceeds", points: 8, desc: "Evidence is precise, well-chosen, and integrated." },
        { label: "Meets", points: 6, desc: "Relevant evidence, adequately used." },
        { label: "Developing", points: 3, desc: "Evidence thin or loosely connected." }]; }
      rubric.complete = true; rubric.points = rubric.criteria.reduce((s, c) => s + c.points, 0);
      session.commit();
      resolveIssue("b2"); resolveIssue("rev3");
      toast("Rubric completed — readiness blocker cleared", "ok");
      onResolve?.();
    } }, "Add the missing levels & complete rubric"));
  return box;
}

// ---------------------------------------------------------------------------
// MODULE ITEM LIST with reorder — reused for tasks 6 & 9.
export function moduleItemList(moduleId, { onOpen, selectedItemId, onReorder } = {}) {
  const mod = moduleById(moduleId);
  const list = h("ul", { class: "blk-items", role: "list" });
  function render() {
    clear(list);
    mod.items.forEach((it, i) => {
      const content = contentFor(it);
      const attn = it.needsAttention && ATTN[it.needsAttention];
      const li = h("li", { class: "blk-item" + (selectedItemId === it.id ? " is-sel" : "") + (attn ? " attn" : ""), dataset: { id: it.id } },
        h("button", { class: "blk-item__main", onClick: () => onOpen?.(it) },
          h("span", { class: "blk-item__glyph" }, itemGlyph(it.type)),
          h("span", { class: "blk-item__title" }, it.title),
          content?.edited && h("span", { class: "pill ok tiny" }, "edited"),
          attn && h("span", { class: `pill ${attn.tone} tiny` }, attn.label)),
        h("div", { class: "blk-item__reorder" },
          h("button", { class: "blk-mv", "aria-label": "Move up", disabled: i === 0, onClick: () => move(i, -1) }, "↑"),
          h("button", { class: "blk-mv", "aria-label": "Move down", disabled: i === mod.items.length - 1, onClick: () => move(i, 1) }, "↓")));
      list.append(li);
    });
  }
  function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= mod.items.length) return;
    [mod.items[i], mod.items[j]] = [mod.items[j], mod.items[i]];
    session.commit();
    render();
    toast(`Reordered “${mod.items[j].title}” — scope: Module ${mod.order}`, "ok");
    onReorder?.(mod);
  }
  render();
  return list;
}

// ---------------------------------------------------------------------------
// READINESS PANEL — blockers + warnings with resolve buttons (task 10).
export function readinessPanel({ onResolveGoto, compact } = {}) {
  const wrap = h("div", { class: "blk-readi" });
  function render() {
    clear(wrap);
    const r = session.readiness;
    wrap.append(
      h("div", { class: "blk-readi__head" },
        ring(r.score, statusWord(r), r.blockers.length + " must-fix · " + r.warnings.length + " advisory"),
        h("p", { class: "tiny muted", style: { maxWidth: "34ch" } },
          "Must-fix items block a confident export. Advisory items are recommendations.")),
      issueGroup("Must fix before export", r.blockers, "danger"),
      issueGroup("Advisory", r.warnings, "warn"),
      r.blockers.length === 0 && r.warnings.length === 0 && h("p", { class: "blk-readi__clear" }, "✓ All checks pass. Ready to export."),
    );
  }
  function issueGroup(title, items, tone) {
    if (!items.length) return null;
    return h("div", { class: "blk-readi__grp" },
      h("h4", { class: "blk-readi__gt" }, title, h("span", { class: `pill ${tone}` }, items.length)),
      h("ul", { class: "blk-readi__list" }, items.map(it => h("li", { class: "blk-readi__item attn" + (tone === "danger" ? " attn--danger" : "") },
        h("div", { class: "grow" }, h("div", { class: "blk-readi__label" }, it.label),
          h("div", { class: "tiny muted" }, it.where), it.help && h("div", { class: "tiny", style: { marginTop: "3px" } }, "→ " + it.help)),
        it.resolvable
          ? h("button", { class: "btn btn--sm btn--primary", onClick: () => doResolve(it) }, "Resolve")
          : onResolveGoto ? h("button", { class: "btn btn--sm", onClick: () => onResolveGoto(it) }, "Open") : null))));
  }
  function doResolve(it) {
    // some issues resolve directly, some route to the relevant surface
    if (it.refId && session.rubrics[it.refId] && !session.rubrics[it.refId].complete && onResolveGoto) { onResolveGoto(it); return; }
    resolveIssue(it.id);
    // clear the paired review-queue item if any
    const rev = session.reviewQueue.find(rv => rv.refId === it.refId);
    if (rev) { session.reviewQueue = session.reviewQueue.filter(rv => rv !== rev); session.commit(); }
    toast("Resolved: " + it.label, "ok");
    render();
  }
  const off = onChange(render);
  render();
  wrap._cleanup = off;
  return wrap;
}
function statusWord(r) { return r.status; }

// ---------------------------------------------------------------------------
// STUDENT PREVIEW — read-only student-facing render (task 11).
export function studentPreview({ moduleId = null } = {}) {
  const wrap = h("div", { class: "blk-spv" });
  function render(mid) {
    clear(wrap);
    const mod = moduleById(mid) || session.modules[0];
    if (!mod) { wrap.append(h("p", { class: "muted" }, "No modules yet.")); return; }
    mid = mod.id;
    wrap.append(
      h("div", { class: "blk-spv__bar" }, h("span", {}, "👩‍🎓 Student view"),
        h("span", { class: "tiny muted" }, "Read-only · this is what a student sees in Canvas")),
      h("div", { class: "blk-spv__canvas" },
        h("div", { class: "blk-spv__hero" },
          h("p", { class: "tiny" }, session.homepage.hero.eyebrow),
          h("h2", {}, session.homepage.hero.title),
          h("p", {}, session.homepage.hero.tagline)),
        h("nav", { class: "blk-spv__modnav" }, session.modules.map(m => h("button", {
          class: "blk-spv__modbtn" + (m.id === mid ? " is-on" : ""), onClick: () => render(m.id) },
          m.kind === "start" ? "Start Here" : "Wk " + m.order))),
        h("div", { class: "blk-spv__mod" },
          h("h3", {}, mod.title), h("p", { class: "muted" }, mod.summary),
          h("ul", { class: "blk-spv__items" }, mod.items.map(it => {
            const c = contentFor(it);
            return h("li", {}, h("span", { class: "blk-spv__ig" }, itemGlyph(it.type)),
              h("a", { href: "#", onClick: e => { e.preventDefault(); openStudentItem(it); } }, it.title),
              it.type === "assignment" && c && h("span", { class: "tiny muted" }, " · " + c.points + " pts"));
          })),
          firstPageBody(mod))),
    );
  }
  function firstPageBody(mod) {
    const first = mod.items.find(i => i.type === "page");
    const p = first && session.pages[first.refId];
    return p ? h("article", { class: "blk-spv__page prose", html: `<h4>${p.title}</h4>` + p.body } ) : null;
  }
  function openStudentItem(it) {
    const c = contentFor(it);
    const body = !c ? "<p class='muted'>No content yet.</p>"
      : it.type === "page" ? c.body : it.type === "assignment" ? c.instructions
      : it.type === "discussion" ? c.prompt : "<p>Quiz — " + (c.questions?.length || 0) + " questions</p>";
    const close = () => { modal.remove(); document.removeEventListener("keydown", onKey); };
    const onKey = e => { if (e.key === "Escape") close(); };
    const closeBtn = h("button", { class: "blk-spv__mx", "aria-label": "Close", onClick: close }, "✕");
    const modal = h("div", { class: "blk-spv__modal", onClick: e => { if (e.target === modal) close(); } },
      h("div", { class: "blk-spv__modalbox", role: "dialog", "aria-modal": "true", "aria-label": it.title },
        closeBtn, h("h4", {}, it.title), h("div", { class: "prose", html: body })));
    wrap.append(modal);
    document.addEventListener("keydown", onKey);
    closeBtn.focus();
  }
  render(moduleId);
  wrap._goModule = m => render(m);
  return wrap;
}

// ---------------------------------------------------------------------------
// EXPORT PANEL — the honest export decision (task 12).
export function exportPanel({ onGoResolve } = {}) {
  const wrap = h("div", { class: "blk-exp" });
  function render() {
    clear(wrap);
    const r = session.readiness, es = session.exportStatus;
    const blockers = r.blockers.length;
    wrap.append(
      h("div", { class: "blk-exp__head" },
        h("div", {}, h("h3", {}, "Export to Canvas"),
          h("p", { class: "muted" }, es.format)),
        ring(r.score, r.status, blockers + " must-fix left")),
      h("ol", { class: "blk-exp__steps" },
        expStep(1, "Generate full content", session.fullContentGenerated,
          "Flesh every module into complete pages, assignments, and quizzes.", () => {
            if (session.actions?.generateFullContent) { session.actions.generateFullContent(); }
            else { session.fullContentGenerated = true; }
            toast("Full content marked generated", "ok"); render();
          }, session.fullContentGenerated ? "Done" : "Generate", "recommended"),
        expStep(2, "Clear must-fix issues", blockers === 0,
          blockers === 0 ? "No blocking issues remain." : blockers + " issue(s) still block a confident export.",
          () => onGoResolve?.(), blockers === 0 ? "Cleared" : "Review " + blockers, blockers ? "blocking" : "ok"),
        expStep(3, "Validate the package locally", session.validated,
          "Checks structure, links, and Canvas HTML. Does not prove a clean Canvas import.", () => {
            if (session.actions?.runValidation) { session.actions.runValidation(); }
            if (session.actions?.markValidated) { session.actions.markValidated(); }
            else { session.validated = true; }
            toast("Local validation run", "ok"); render();
          }, session.validated ? "Validated" : "Validate", "")),
      h("div", { class: "blk-exp__download" },
        h("div", {}, h("strong", {}, es.packageName),
          h("div", { class: "tiny muted" }, "Contents · " + es.contents.map(c => c.count + " " + c.label.toLowerCase()).join(" · "))),
        h("button", { class: "btn btn--primary", disabled: blockers > 0 || !session.validated,
          onClick: () => { if (session.actions?.download) session.actions.download(); else toast("Download started (mock .imscc)", "ok"); } }, "Download .imscc")),
      h("p", { class: "blk-exp__honest tiny" },
        "🛈 Canvas import is ", h("strong", {}, "not verified"),
        ". Local validation checks the package; it can't guarantee a clean import until you test it in a Canvas sandbox."),
    );
  }
  function expStep(n, title, done, desc, action, actionLabel, tone) {
    return h("li", { class: "blk-exp__step" + (done ? " is-done" : "") },
      h("span", { class: "blk-exp__num" }, done ? "✓" : n),
      h("div", { class: "grow" }, h("div", { class: "row spread" },
        h("strong", {}, title), tone && tone !== "ok" && h("span", { class: `pill ${tone === "blocking" ? "danger" : ""}` }, tone)),
        h("div", { class: "tiny muted" }, desc)),
      h("button", { class: "btn btn--sm" + (done ? "" : " btn--primary"), disabled: done && actionLabel !== "Review " + session.readiness.blockers.length, onClick: action }, actionLabel));
  }
  const off = onChange(render);
  render();
  wrap._cleanup = off;
  return wrap;
}

// ---------------------------------------------------------------------------
// BLUEPRINT VIEW — outcomes / sequence / assessment / workload (tasks 4,5).
export function blueprintView({ onApprove, onChangeDecision } = {}) {
  const wrap = h("div", { class: "blk-bp" });
  function render() {
    clear(wrap);
    wrap.append(
      h("div", { class: "blk-bp__grid" },
        bpCard("Outcomes", session.outcomes.length + " course outcomes",
          h("ul", { class: "blk-bp__ul" }, session.outcomes.map(o => h("li", {},
            h("strong", {}, o.code), " " + o.text.slice(0, 64) + "…",
            o.alignedModuleIds.length === 0 && h("span", { class: "pill warn tiny" }, "unaligned"))))),
        bpCard("Module sequence", session.modules.length + " modules over " + session.settings.weeks + " weeks",
          h("ol", { class: "blk-bp__seq" }, session.modules.map(m => h("li", { class: m.status === "workload-high" ? "attn" : "" },
            m.kind === "start" ? "Start Here" : m.title.replace(/^\d+ · /, ""),
            h("span", { class: "tiny muted" }, " · " + m.workloadHours + "h"))))),
        bpCard("Assessment strategy", session.assignmentGroups.length + " graded categories → " + session.assignmentGroups.reduce((t, g) => t + g.weight, 0) + "%",
          h("ul", { class: "blk-bp__ul" }, session.assignmentGroups.map(g => h("li", {}, g.name, h("span", { class: "tiny muted" }, " · " + g.weight + "%"))))),
        bpCard("Workload", Math.round(session.contactHours.plannedTotal) + " of " + session.contactHours.requiredTotal + " planned student-hours",
          h("div", {}, session.contactHours.categories.map(c => workBar(c)),
            heavyModuleNote())),
        interactivityCard()),
    );
  }
  function interactivityCard() {
    const iv = session.interactivity;
    if (!iv) return null;
    const pct = Math.min(100, Math.round((iv.total / Math.max(1, iv.target)) * 100));
    return bpCard("Interactivity", iv.total + " Canvas interactions · " + iv.density + " density",
      h("div", {},
        h("div", { class: "blk-bp__ivbar" }, h("span", { class: "blk-bp__ivfill" + (iv.meetsTarget ? " is-met" : ""), style: { width: pct + "%" } })),
        h("p", { class: "tiny" + (iv.meetsTarget ? " muted" : " attn"), style: { paddingLeft: "8px", marginTop: "6px" } }, iv.summary),
        h("p", { class: "tiny muted", style: { paddingLeft: "8px" } },
          iv.standard + " reusable · " + iv.courseSpecific + " course-specific · " + iv.distinctPatterns + " distinct patterns")));
  }
  function bpCard(title, sub, body) {
    return h("section", { class: "blk-bp__card" }, h("div", { class: "blk-bp__ct" },
      h("h4", {}, title), h("span", { class: "tiny muted" }, sub)), body);
  }
  function workBar(c) {
    const max = 45, w = Math.min(100, (c.hours / max) * 100);
    return h("div", { class: "blk-work" }, h("span", { class: "tiny" }, c.label),
      h("span", { class: "blk-work__track" }, h("span", { class: "blk-work__fill", style: { width: w + "%" } })),
      h("span", { class: "tiny muted" }, c.hours + "h"));
  }
  function heavyModuleNote() {
    const heavy = session.modules.filter(m => m.kind !== "start" && m.workloadHours > 6);
    if (!heavy.length) return h("p", { class: "tiny muted", style: { paddingLeft: "8px" } }, "Weekly workload is evenly balanced.");
    const m = heavy[0];
    return h("p", { class: "tiny attn", style: { paddingLeft: "8px" } },
      "▲ " + m.title.replace(/^\d+ · /, "") + " carries " + m.workloadHours + "h — above the typical weekly norm.");
  }
  render();
  return wrap;
}

// ---------------------------------------------------------------------------
// COURSE-LEVEL CHANGE — change one course-wide decision (task 5).
export function courseChange({ onChanged } = {}) {
  const wrap = h("div", { class: "blk-cc" });
  const weeks = [12, 14, 15, 16];
  function render() {
    clear(wrap);
    wrap.append(
      h("p", { class: "blk-cc__scope" }, "🌐 Course-level decision · affects the whole course, not one item."),
      h("label", { class: "blk-cc__row" }, h("span", {}, "Course length"),
        h("div", { class: "blk-seg" }, weeks.map(w => h("button", {
          class: "blk-seg__b" + (session.settings.weeks === w ? " is-on" : ""),
          onClick: () => { session.settings.weeks = w; session.commit(); toast("Course length → " + w + " weeks (course-wide)", "ok"); render(); onChanged?.(); } }, w + " wks")))),
      h("label", { class: "blk-cc__row" }, h("span", {}, "AI use policy"),
        h("select", { class: "blk-input", onChange: e => { session.settings.aiPolicy = e.target.value; session.commit(); toast("AI policy updated (course-wide)", "ok"); } },
          ["Not set", "AI allowed with citation", "AI not permitted", "AI for brainstorming only"].map(v =>
            h("option", { selected: session.settings.aiPolicy === v }, v)))),
      h("label", { class: "blk-cc__row" }, h("span", {}, "Include rubrics on essays"),
        h("button", { class: "blk-toggle" + (session.settings.includeRubrics ? " is-on" : ""), role: "switch",
          "aria-checked": String(session.settings.includeRubrics),
          onClick: e => { session.settings.includeRubrics = !session.settings.includeRubrics; session.commit(); e.currentTarget.classList.toggle("is-on"); toast("Rubrics " + (session.settings.includeRubrics ? "on" : "off") + " (course-wide)", "ok"); } },
          h("span", { class: "blk-toggle__dot" }))),
      h("label", { class: "blk-cc__row" },
        h("span", {}, "Interaction density", h("span", { class: "tiny muted", style: { display: "block" } }, densityHint())),
        h("div", { class: "blk-seg" }, DENSITY_OPTS.map(([id, label]) => h("button", {
          class: "blk-seg__b" + ((session.settings.interactionDensity || "balanced") === id ? " is-on" : ""),
          onClick: () => setDensity(id) }, label)))),
    );
  }
  function densityHint() {
    return ({ minimal: "One key interaction per surface.", balanced: "Two per surface, richer content pages.",
      rich: "More variety across every surface.", immersive: "Maximum interactivity." })[session.settings.interactionDensity || "balanced"];
  }
  function setDensity(id) {
    session.settings.interactionDensity = id;
    if (session.actions?.setInteractionDensity) session.actions.setInteractionDensity(id);
    else session.commit();
    toast("Interaction density → " + id + " (re-applied course-wide)", "ok");
    render(); onChanged?.();
  }
  render();
  return wrap;
}
const DENSITY_OPTS = [["minimal", "Minimal"], ["balanced", "Balanced"], ["rich", "Rich"], ["immersive", "Immersive"]];

// ---------------------------------------------------------------------------
// SOURCE LIST — review source materials (task 2).
export function sourceList() {
  return h("ul", { class: "blk-src" }, session.sourceFiles.map(f => h("li", { class: "blk-src__i" },
    h("span", { class: "blk-src__ico" }, "📄"),
    h("div", { class: "grow" }, h("strong", {}, f.name),
      h("div", { class: "tiny muted" }, f.kind + " · " + f.size), h("div", { class: "tiny" }, f.note)),
    h("span", { class: "pill ok tiny" }, "parsed"))));
}

// ---------------------------------------------------------------------------
// ITEM EDITOR DISPATCHER — pick the right editor for any module item. Reused by
// every concept that lets you open and edit an item. onChange re-renders host.
export function itemEditor(item, { onChange, scopeMod } = {}) {
  if (!item) return h("div", { class: "muted" }, "Nothing selected.");
  const head = h("div", { class: "blk-itemhead" },
    h("span", { class: "pill" }, ({ page: "Page", assignment: "Assignment", discussion: "Discussion", quiz: "Quiz" })[item.type]),
    item.needsAttention && h("span", { class: `pill ${ATTN[item.needsAttention]?.tone || "warn"}` }, ATTN[item.needsAttention]?.label || "Needs review"));
  const scope = scopeMod ? "one item in " + (scopeMod.kind === "start" ? "Start Here" : "Module " + scopeMod.order) : "one item";
  let inner;
  if (item.type === "page") inner = pageEditor(item.refId, { scopeNote: scope, onSaved: onChange });
  else if (item.type === "assignment") inner = assignmentRubricView(item.refId, { onResolve: onChange });
  else if (item.type === "discussion") inner = discussionEditorBlock(item.refId, onChange);
  else if (item.type === "quiz") inner = quizViewBlock(item.refId, onChange);
  else inner = h("div", {});
  return h("div", {}, head, inner, interactionsSection(item, onChange));
}

// Canvas interaction patterns on this item — see, insert, and remove (Phase 11/12).
const FALLBACK_INSERTABLE = [
  { id: "standard-accordion", name: "Standard Accordion" }, { id: "callout", name: "Callout" },
  { id: "click-to-reveal-answer", name: "Click-to-Reveal Answer" }, { id: "stop-and-think-prompt", name: "Stop-and-Think Prompt" },
  { id: "action-item-checklist", name: "Action-Item Checklist" }, { id: "worked-example-reveal", name: "Worked Example Reveal" },
];
function interactionsSection(item, onChange) {
  if (!["page", "assignment", "discussion", "quiz"].includes(item.type)) return null;
  const insertable = session.insertablePatterns || FALLBACK_INSERTABLE;
  const wrap = h("div", { class: "blk-iv" });
  function nameFor(id) { return (insertable.find(p => p.id === id) || {}).name || id; }
  function render() {
    clear(wrap);
    const cur = (contentFor(item) || {}).interactions || [];
    wrap.append(
      h("div", { class: "row spread", style: { marginTop: "16px" } },
        h("span", { class: "blk-kind" }, "✦ Canvas interactions"),
        h("span", { class: "pill tiny" + (cur.length ? " ok" : "") }, cur.length + " on this item")),
      cur.length
        ? h("ul", { class: "blk-iv__list" }, cur.map(b => h("li", { class: "blk-iv__item" },
            h("span", { class: "grow" }, b.name),
            b.source === "inserted" && h("span", { class: "pill tiny" }, "added by you"),
            h("button", { class: "btn btn--sm btn--ghost", "aria-label": "Remove " + b.name, onClick: () => removeIv(b.id) }, "Remove"))))
        : h("p", { class: "tiny muted", style: { margin: "6px 0" } }, "No interactions on this item yet."),
      h("div", { class: "row gap-8", style: { marginTop: "8px" } },
        h("select", { class: "blk-input", "aria-label": "Choose an interaction to insert" },
          [h("option", { value: "" }, "Add an interaction…"), ...insertable.map(p => h("option", { value: p.id }, p.name))]),
        h("button", { class: "btn btn--sm btn--primary", onClick: e => { const sel = e.currentTarget.previousSibling; if (sel.value) addIv(sel.value); } }, "Insert")),
      h("p", { class: "tiny muted", style: { marginTop: "4px" } }, "Inserted interactions are Canvas-safe and stay when the course is regenerated."));
  }
  function addIv(patternId) {
    const c = contentFor(item);
    // optimistic — the real block replaces this on the next refresh
    c.interactions = [...(c.interactions || []), { id: "pending-" + patternId, patternId, name: nameFor(patternId), source: "inserted" }];
    if (session.actions?.insertInteraction) session.actions.insertInteraction(item.type, item.refId, patternId);
    else session.commit();
    toast(nameFor(patternId) + " added", "ok"); render(); onChange?.();
  }
  function removeIv(id) {
    const c = contentFor(item);
    c.interactions = (c.interactions || []).filter(b => b.id !== id);
    if (session.actions?.removeInteraction) session.actions.removeInteraction(item.type, item.refId, id);
    else session.commit();
    toast("Interaction removed", "ok"); render(); onChange?.();
  }
  render();
  return wrap;
}
function discussionEditorBlock(id, onSaved) {
  const d = session.discussions[id];
  const ta = h("textarea", { class: "blk-textarea", rows: 5 }, d.prompt.replace(/<[^>]+>/g, "").trim());
  return h("div", {},
    d.needsAttention === "ai-review" && h("div", { class: "attn", style: { background: "var(--warn-bg)", padding: "10px 12px", borderRadius: "8px", marginBottom: "12px", fontSize: "13px" } }, "✦ " + (d.aiNote || "AI draft — review before students see it.")),
    h("label", { class: "blk-kind", style: { display: "block", marginBottom: "6px" } }, "Discussion prompt"), ta,
    d.replyGuidance && h("p", { class: "tiny muted", style: { marginTop: "6px" } }, "Reply guidance: " + d.replyGuidance),
    h("div", { class: "row gap-8", style: { marginTop: "10px" } },
      h("button", { class: "btn btn--primary", onClick: () => { d.prompt = "<p>" + ta.value + "</p>"; d.edited = true; d.needsAttention = null; session.reviewQueue = session.reviewQueue.filter(r => r.refId !== id); session.commit(); resolveIssue("w4"); resolveIssue("rev1"); toast("Prompt approved", "ok"); onSaved?.(); } }, "Approve prompt"),
      h("span", { class: "tiny muted" }, "Scope · one discussion")));
}
function quizViewBlock(id, onSaved) {
  const q = session.quizzes[id];
  return h("div", {}, h("h3", { style: { fontSize: "15px", margin: "0 0 8px" } }, q.title),
    h("ul", { style: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "10px" } },
      q.questions.map((qq, i) => h("li", { class: qq.needsAttention ? "attn" : "", style: { border: "1px solid var(--line)", borderRadius: "8px", padding: "12px", fontSize: "14px" } },
        h("div", {}, h("strong", {}, "Q" + (i + 1) + " · " + qq.type.replace("_", " ")), " " + qq.stem),
        qq.needsAttention === "verify-key"
          ? h("div", { class: "row gap-8", style: { marginTop: "6px" } }, h("span", { class: "pill danger" }, "Answer key unverified"),
              h("button", { class: "btn btn--sm btn--primary", onClick: () => { qq.needsAttention = null; qq.verified = true; session.reviewQueue = session.reviewQueue.filter(r => r.refId !== id); session.commit(); resolveIssue("b1"); resolveIssue("rev2"); toast("Answer key verified — blocker cleared", "ok"); onSaved?.(); } }, "Verify key"))
          : h("span", { class: "pill ok tiny" }, "verified")))));
}

// ---------------------------------------------------------------------------
// HOMEPAGE EDITOR — the first page students see (course-level).
export function homepageEditor({ onChange } = {}) {
  const hp = session.homepage;
  const wrap = h("div", { class: "blk-cfg" });
  wrap.append(
    h("div", { class: "row spread" }, h("span", { class: "blk-kind" }, "⌂ Homepage"), provenance(hp.edited)),
    cfgField("Headline", h("input", { class: "blk-input", value: hp.hero.title, onInput: e => { hp.hero.title = e.target.value; hp.edited = true; }, onChange: () => { session.commit(); onChange?.(); } })),
    cfgField("Tagline", h("input", { class: "blk-input", value: hp.hero.tagline, onInput: e => { hp.hero.tagline = e.target.value; hp.edited = true; }, onChange: () => { session.commit(); onChange?.(); } })),
    cfgField("Welcome text", h("textarea", { class: "blk-textarea", rows: 3, onInput: e => { hp.welcome = e.target.value; hp.edited = true; }, onChange: () => { session.commit(); onChange?.(); } }, hp.welcome)),
    h("p", { class: "tiny muted" }, "Buttons students see: " + hp.buttons.map(b => b.label).join(" · ") + ". Scope · whole course."));
  return wrap;
}

// SYLLABUS EDITOR — all seven policy sections (course-level). Filling the two
// empty ones clears readiness warning w5.
export function syllabusEditor({ onChange } = {}) {
  const wrap = h("div", { class: "blk-syl" });
  function render() {
    clear(wrap);
    const empty = session.syllabus.sections.filter(s => !s.complete).length;
    wrap.append(h("div", { class: "row spread" }, h("span", { class: "blk-kind" }, "☰ Syllabus · 7 sections"),
      empty ? h("span", { class: "pill warn" }, empty + " empty") : h("span", { class: "pill ok" }, "complete")));
    session.syllabus.sections.forEach(s => {
      const row = h("div", { class: "blk-syl__row" + (s.complete ? "" : " attn") });
      row.append(h("div", { class: "row spread" }, h("strong", {}, s.title), s.complete ? h("span", { class: "pill ok tiny" }, "set") : h("span", { class: "pill warn tiny" }, "empty")));
      const ta = h("textarea", { class: "blk-textarea", rows: 2, placeholder: s.note || "Add this section…", onInput: e => { s.body = e.target.value; }, onChange: () => { s.complete = !!s.body.trim(); afterEdit(); } }, s.body || "");
      row.append(ta);
      wrap.append(row);
    });
    function afterEdit() { session.commit(); if (session.syllabus.sections.every(s => s.complete)) resolveIssue("w5"); render(); onChange?.(); }
  }
  render();
  return wrap;
}

// GRADEBOOK EDITOR — assignment-group weights; must total 100% (course-level).
export function gradebookEditor({ onChange } = {}) {
  const wrap = h("div", { class: "blk-gb" });
  function render() {
    clear(wrap);
    const total = session.assignmentGroups.reduce((s, g) => s + g.weight, 0);
    wrap.append(h("div", { class: "row spread" }, h("span", { class: "blk-kind" }, "▤ Gradebook · categories"),
      h("span", { class: "pill" + (total === 100 ? " ok" : " danger") }, "Total " + total + "%")));
    session.assignmentGroups.forEach(g => {
      const val = h("span", { class: "blk-gb__val" }, g.weight + "%");
      wrap.append(h("div", { class: "blk-gb__row" }, h("span", {}, g.name),
        h("input", { type: "range", min: 0, max: 50, value: g.weight, "aria-label": g.name + " weight",
          oninput: e => { g.weight = +e.target.value; val.textContent = g.weight + "%"; const t = session.assignmentGroups.reduce((s, x) => s + x.weight, 0); wrap.querySelector(".pill").textContent = "Total " + t + "%"; wrap.querySelector(".pill").className = "pill" + (t === 100 ? " ok" : " danger"); },
          onchange: () => { session.commit(); onChange?.(); } }), val));
    });
    wrap.append(h("p", { class: "tiny muted" }, "Scope · whole course. Weights must total 100% before export."));
  }
  render();
  return wrap;
}

// THEME EDITOR — export theme + a working contrast fix (clears a11y acc2).
export function themeEditor({ onChange } = {}) {
  const wrap = h("div", { class: "blk-theme" });
  function render() {
    clear(wrap);
    const t = session.theme;
    wrap.append(
      h("div", { class: "row spread" }, h("span", { class: "blk-kind" }, "◑ Theme · " + t.name),
        t.contrastPass === "pass" ? h("span", { class: "pill ok" }, "Contrast AA ✓") : h("span", { class: "pill warn" }, "Contrast: partial")),
      h("div", { class: "blk-theme__swatches" }, Object.entries(t.palette).map(([k, v]) => h("div", { class: "blk-theme__sw" }, h("span", { class: "blk-theme__chip", style: { background: v } }), h("span", { class: "tiny muted" }, k)))),
      h("p", { class: "tiny", style: { marginTop: "8px" } }, t.contrastPass === "pass" ? "The header now passes AA for body text." : "⚠ " + t.contrastNote),
      t.contrastPass !== "pass" && h("button", { class: "btn btn--sm btn--primary", onClick: () => { t.palette.bg = "#141b24"; t.contrastPass = "pass"; session.commit(); resolveIssue("w1") /* no-op if already */; resolveAccessibility("acc2"); toast("Header darkened — contrast now passes AA", "ok"); render(); onChange?.(); } }, "Darken header to pass AA"));
  }
  render();
  return wrap;
}
function resolveAccessibility(id) { const iss = session.accessibility.issues.find(i => i.id === id); if (iss) { iss.severity = "pass"; iss.fixedNote = "Fixed"; } }
function cfgField(label, control) { return h("label", { class: "blk-cfg__f" }, h("span", { class: "blk-cfg__l" }, label), control); }

// ---- small helpers ----------------------------------------------------------
function metaGrid(rows) { return h("dl", { class: "blk-metagrid" }, rows.map(([k, v]) => [h("dt", {}, k), h("dd", {}, v)]).flat()); }
function groupName(id) { return session.assignmentGroups.find(g => g.id === id)?.name || id; }
function oc(id) { return session.outcomes.find(o => o.id === id)?.code || id; }
