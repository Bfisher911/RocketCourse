// CONCEPT 5 — TASK-BASED COMMAND CENTER
// Work is organized around meaningful JOBS ("strengthen assessments"), not
// content-type tabs. The board answers "what needs my attention?" then hands
// off to a focused surface for each job. Deliberately not another tile wall.
import { h, clear, toast, itemGlyph } from "../shared/ui.js";
import * as B from "../shared/blocks.js";
ensureCss("tasks", ["../shared/blocks.css", "./concepts/tasks.css"]);

export function mount(stage, ctx) {
  let view = "board"; // board | <jobId>
  let modId = "m4", itemId = null;

  const root = h("div", { class: "tk" });
  stage.append(root);

  // Each job knows how "done" it is, derived from live session state.
  const JOBS = () => [
    { id: "direction", title: "Set the course direction", desc: "Confirm what this course is, its sources, and its scope.", status: () => "done", meta: "Confirmed" },
    { id: "blueprint", title: "Approve the plan", desc: "Sign off on outcomes, sequence, and assessment before content is finalized.", status: () => "done", meta: "Approved" },
    { id: "content", title: "Complete the modules", desc: "Read through each module's pages and activities; edit and reorder as needed.", status: () => "review", meta: "13 modules · 3 need a look" },
    { id: "assessments", title: "Strengthen assessments", desc: "Every graded item needs a complete rubric and clear instructions.", status: () => B.session.rubrics["r-essay-freedom"].complete ? "done" : "attention", meta: () => B.session.rubrics["r-essay-freedom"].complete ? "Rubrics complete" : "1 rubric incomplete" },
    { id: "verify", title: "Verify AI-written content", desc: "Approve AI-drafted prompts and answer keys before students see them.", status: () => aiPending() ? "attention" : "done", meta: () => aiPending() + " awaiting your OK" },
    { id: "alignment", title: "Check alignment", desc: "Make sure every outcome maps to real modules and assessments.", status: () => B.session.outcomes.some(o => o.alignedModuleIds.length === 0) ? "review" : "done", meta: () => B.session.outcomes.some(o => o.alignedModuleIds.length === 0) ? "1 outcome unaligned" : "All outcomes aligned" },
    { id: "workload", title: "Balance the workload", desc: "Spot modules that ask too much of students in one week.", status: () => "review", meta: "Module 7 runs heavy" },
    { id: "accessibility", title: "Improve accessibility", desc: "Alt text, contrast, and heading order for every student.", status: () => B.session.accessibility.issues.some(i => i.severity === "warning" && !B.session.resolved.has(i.id === "acc1" ? "w1" : "")) ? "review" : "done", meta: "2 warnings" },
    { id: "readiness", title: "Clear what blocks export", desc: "Resolve the must-fix issues that stand between you and a clean package.", status: () => B.session.readiness.blockers.length ? "attention" : "done", meta: () => B.session.readiness.blockers.length + " must-fix left" },
    { id: "preview", title: "Preview as a student", desc: "See the course exactly as a student will in Canvas.", status: () => "todo", meta: "Optional check" },
    { id: "canvas", title: "Prepare & export for Canvas", desc: "Generate full content, validate, and download the package.", status: () => B.session.validated ? "done" : "todo", meta: () => B.session.validated ? "Validated" : "Not started" },
  ];
  function aiPending() { let n = 0; if (B.session.discussions["d4-free"].needsAttention) n++; B.session.quizzes["q3-check"].questions.forEach(q => { if (q.needsAttention) n++; }); return n; }

  function recommended(jobs) { return jobs.find(j => resolve(j.status) === "attention") || jobs.find(j => resolve(j.status) === "review") || jobs[0]; }
  function resolve(v) { return typeof v === "function" ? v() : v; }

  function render() { clear(root); view === "board" ? renderBoard() : renderJob(view); }

  function renderBoard() {
    const jobs = JOBS();
    const rec = recommended(jobs);
    const needs = jobs.filter(j => ["attention", "review"].includes(resolve(j.status)) && j !== rec);
    const rest = jobs.filter(j => !["attention", "review"].includes(resolve(j.status)) && j !== rec);
    root.append(
      h("header", { class: "tk-head" },
        h("div", {}, h("p", { class: "tk-eyebrow" }, "Command center · The Meaning of Life in 12 Conversations"),
          h("h1", { class: "tk-h1" }, "What needs your attention")),
        h("div", { class: "tk-progress" }, h("strong", {}, jobsDone(jobs) + " / " + jobs.length), h("span", { class: "tiny muted" }, "jobs done"))),
      h("section", { class: "tk-recommend" },
        h("span", { class: "tk-recommend__tag" }, "Do this next"),
        h("h2", {}, rec.title), h("p", {}, rec.desc),
        h("button", { class: "btn btn--primary", onClick: () => open(rec.id) }, "Start →")),
      needs.length ? h("h3", { class: "tk-sech" }, "Needs you") : null,
      h("div", { class: "tk-jobs" }, needs.map(jobCard)),
      h("h3", { class: "tk-sech" }, "Looking good & optional"),
      h("div", { class: "tk-jobs" }, rest.map(jobCard)));
  }
  function jobsDone(jobs) { return jobs.filter(j => resolve(j.status) === "done").length; }
  function jobCard(j) {
    const st = resolve(j.status), meta = resolve(j.meta);
    const tone = { attention: "danger", review: "warn", done: "ok", todo: "" }[st];
    return h("button", { class: "tk-job tk-job--" + st, onClick: () => open(j.id) },
      h("div", { class: "tk-job__top" }, h("span", { class: "tk-job__title" }, j.title),
        h("span", { class: "tk-job__mark tk-job__mark--" + tone }, st === "done" ? "✓" : st === "attention" ? "!" : st === "review" ? "•" : "○")),
      h("p", { class: "tk-job__desc" }, j.desc),
      h("span", { class: "pill " + (tone || "") + " tiny" }, meta));
  }

  function open(id) { view = id; modId = "m4"; itemId = null; render(); root.scrollIntoView({ block: "start" }); }
  function backBar(title) {
    return h("div", { class: "tk-jobbar" },
      h("button", { class: "btn btn--sm btn--ghost", onClick: () => { view = "board"; render(); } }, "‹ All jobs"),
      h("h1", { class: "tk-jobh1" }, title));
  }

  function renderJob(id) {
    const surfaces = {
      direction: () => root.append(backBar("Set the course direction"),
        panel("Course brief", h("textarea", { class: "blk-textarea", rows: 3, html: B.D.course.description.slice(0, 180) + "…" })),
        panel("Source materials", B.sourceList()),
        panel("Scope", B.courseChange({ onChanged: render }))),
      blueprint: () => root.append(backBar("Approve the plan"), panel("Blueprint", B.blueprintView({}))),
      content: () => root.append(backBar("Complete the modules"), moduleWork()),
      assessments: () => root.append(backBar("Strengthen assessments"),
        panel("Module 4 · Short Essay 2 and its rubric", B.assignmentRubricView("a4-essay", { onResolve: render }))),
      verify: () => root.append(backBar("Verify AI-written content"), verifySurface()),
      alignment: () => root.append(backBar("Check alignment"), alignmentSurface()),
      workload: () => root.append(backBar("Balance the workload"), workloadSurface()),
      accessibility: () => root.append(backBar("Improve accessibility"), accessibilitySurface()),
      readiness: () => root.append(backBar("Clear what blocks export"), panel("Must-fix & advisory", B.readinessPanel({ onResolveGoto: it => { open("content"); gotoRef(it.refId); } }))),
      preview: () => root.append(backBar("Preview as a student"), panel(null, B.studentPreview({ moduleId: "m4" }))),
      canvas: () => root.append(backBar("Prepare & export for Canvas"), panel(null, B.exportPanel({ onGoResolve: () => open("readiness") }))),
    };
    (surfaces[id] || surfaces.content)();
  }

  function moduleWork() {
    const wrap = h("div", { class: "tk-modwork" });
    const chips = h("div", { class: "tk-modchips" }, B.session.modules.map(m => h("button", {
      class: "tk-modchip" + (modId === m.id ? " is-on" : ""), onClick: () => { modId = m.id; itemId = null; render2(); } },
      m.kind === "start" ? "Start" : m.order, m.status !== "approved" && h("span", { class: "tk-mdot" }))));
    const area = h("div", { class: "tk-modarea" });
    wrap.append(chips, area);
    function render2() {
      // re-render only this job's area
      view = "content"; clear(root);
      root.append(backBar("Complete the modules"));
      const w2 = h("div", { class: "tk-modwork" });
      const c2 = h("div", { class: "tk-modchips" }, B.session.modules.map(m => h("button", { class: "tk-modchip" + (modId === m.id ? " is-on" : ""), onClick: () => { modId = m.id; itemId = null; render2(); } }, m.kind === "start" ? "Start" : m.order, m.status !== "approved" && h("span", { class: "tk-mdot" }))));
      const mod = B.moduleById(modId);
      const grid = h("div", { class: "tk-modgrid" },
        h("div", {}, h("h3", { class: "tk-modtitle" }, mod.title), h("p", { class: "tiny muted" }, mod.summary),
          B.moduleItemList(mod.id, { selectedItemId: itemId, onOpen: it => { itemId = it.id; render2(); }, onReorder: () => {} })),
        h("div", { class: "tk-modeditor" }, itemId ? B.itemEditor(mod.items.find(x => x.id === itemId), { scopeMod: mod, onChange: render2 }) : h("div", { class: "muted", style: { padding: "40px", textAlign: "center" } }, "Open an item to edit it.")));
      w2.append(c2, grid); root.append(w2);
    }
    setTimeout(render2, 0);
    return wrap;
  }
  function verifySurface() {
    const wrap = h("div", {});
    wrap.append(panel("Module 3 · quiz answer key", B.itemEditor(B.moduleById("m3").items.find(i => i.type === "quiz"), { scopeMod: B.moduleById("m3"), onChange: render })));
    wrap.append(panel("Module 4 · discussion prompt", B.itemEditor(B.moduleById("m4").items.find(i => i.id === "i4c"), { scopeMod: B.moduleById("m4"), onChange: render })));
    return wrap;
  }
  function alignmentSurface() {
    return panel("Outcome → module alignment", h("div", {}, B.session.outcomes.map(o => h("div", { class: "tk-align" + (o.alignedModuleIds.length === 0 ? " attn" : "") },
      h("div", { class: "grow" }, h("strong", {}, o.code), " " + o.text),
      o.alignedModuleIds.length ? h("span", { class: "pill ok tiny" }, o.alignedModuleIds.length + " modules") :
        h("button", { class: "btn btn--sm btn--primary", onClick: e => { o.alignedModuleIds = ["m4", "m8"]; B.resolveIssue("w3"); toast("CLO 6 aligned", "ok"); e.currentTarget.replaceWith(h("span", { class: "pill ok tiny" }, "aligned")); } }, "Align now")))));
  }
  function workloadSurface() {
    return panel("Student hours per module", h("div", { class: "tk-workload" }, B.session.modules.filter(m => m.kind !== "start").map(m => {
      const heavy = m.workloadHours > 6;
      return h("div", { class: "tk-wrow" + (heavy ? " attn" : "") }, h("span", { class: "tk-wname" }, m.title.replace(/^\d+ · /, "")),
        h("span", { class: "tk-wtrack" }, h("span", { class: "tk-wfill" + (heavy ? " is-heavy" : ""), style: { width: Math.min(100, m.workloadHours / 10 * 100) + "%" } })),
        h("span", { class: "tiny" + (heavy ? "" : " muted") }, m.workloadHours + "h"),
        heavy && h("button", { class: "btn btn--sm", onClick: () => { m.workloadHours = 5; toast("Module 7 split across two weeks (mock)", "ok"); render(); } }, "Split"));
    })));
  }
  function accessibilitySurface() {
    return panel("Accessibility review · " + B.session.accessibility.tier, h("ul", { class: "tk-acc" }, B.session.accessibility.issues.map(iss => h("li", { class: "tk-acc__i" + (iss.severity === "warning" ? " attn" : "") },
      h("span", { class: "pill " + (iss.severity === "warning" ? "warn" : "ok") + " tiny" }, iss.severity),
      h("div", { class: "grow" }, h("strong", {}, iss.where), h("p", { class: "tiny", style: { margin: "2px 0 0" } }, iss.what), iss.fix && h("p", { class: "tiny muted", style: { margin: 0 } }, "Fix · " + iss.fix)),
      iss.resolvable && h("button", { class: "btn btn--sm btn--primary", onClick: e => { if (iss.refKind === "alt-text") B.resolveIssue("w1"); toast("Resolved · " + iss.what, "ok"); e.currentTarget.replaceWith(h("span", { class: "pill ok tiny" }, "fixed")); } }, "Fix")))));
  }

  render();

  function gotoRef(refId) { for (const m of B.session.modules) { const it = m.items.find(i => i.refId === refId); if (it) { modId = m.id; itemId = it.id; } } }

  function goToTask(n) {
    const map = { 1: "direction", 2: "direction", 3: "direction", 4: "blueprint", 5: "direction", 6: "content", 7: "content", 8: "assessments", 9: "content", 10: "readiness", 11: "preview", 12: "canvas" };
    open(map[n] || "board");
    if (n === 7) setTimeout(() => { modId = "m4"; itemId = "i4a"; open("content"); }, 10);
    if (n === 9) setTimeout(() => { modId = "m4"; itemId = null; open("content"); }, 10);
  }
  function panel(title, body) { return h("section", { class: "tk-panel" }, title && h("h3", { class: "tk-panel__t" }, title), body); }
  return { goToTask };
}

export function rationale() {
  return h("div", { class: "prose" },
    h("h2", {}, "Hypothesis"),
    h("p", {}, "Content-type tabs (Pages, Quizzes, Rubrics…) make you assemble the plan in your head. People don't think “I need the Rubrics tab”; they think “my assessments are weak.” Organize the tool around jobs-to-be-done and it can answer, on its own, what matters now."),
    h("h3", {}, "Information architecture"),
    h("p", {}, "A prioritized board of ~11 jobs, each in plain language, each with a live status derived from the course itself. One “Do this next” recommendation sits above a short “Needs you” list and a quieter “Looking good / optional” list. Selecting a job opens a single focused surface — never the whole toolbox at once."),
    h("h3", {}, "Key moves"),
    h("ul", {}, h("li", {}, "Jobs cut across content types (“Verify AI-written content” gathers a quiz key and a discussion prompt from different modules)."),
      h("li", {}, "Status is computed, not decorative — completing a rubric flips “Strengthen assessments” to done."),
      h("li", {}, "The board is intentionally sparse: three tiers, no equal-weight tile grid, no vanity metrics.")),
    h("h3", {}, "Trade-offs"),
    h("p", {}, "Great for a returning user with a half-finished course; less natural for someone who wants to freely browse structure (Concept 3 covers that). The risk is drifting back into dashboard density — held off by the strict do-next hierarchy."));
}
function ensureCss(id, hrefs) { (Array.isArray(hrefs) ? hrefs : [hrefs]).forEach((href, i) => { const key = "css-" + id + "-" + i; if (document.getElementById(key)) return; const l = document.createElement("link"); l.id = key; l.rel = "stylesheet"; l.href = href; document.head.append(l); }); }
