// CONCEPT 1 — GUIDED COURSE JOURNEY
// Linear milestones, one decision at a time, a persistent (collapsed) memory of
// settled decisions. Highest guidance, lowest cognitive load.
import { h, clear, toast } from "../shared/ui.js";
import * as B from "../shared/blocks.js";

ensureCss("guided", ["../shared/blocks.css", "./concepts/guided.css"]);

const STAGES = [
  { key: "define", label: "Define", verb: "What is this course?" },
  { key: "configure", label: "Configure", verb: "Set the shape of the course" },
  { key: "blueprint", label: "Blueprint", verb: "Approve the plan before we write it" },
  { key: "generate", label: "Generate", verb: "Build the first draft" },
  { key: "review", label: "Review", verb: "Walk the course and edit" },
  { key: "resolve", label: "Fix issues", verb: "Clear what blocks export" },
  { key: "preview", label: "Student preview", verb: "See what students see" },
  { key: "export", label: "Export", verb: "Package for Canvas" },
];

export function mount(stage, ctx) {
  let idx = 0;
  const done = new Set();
  const decisions = []; // {label,value}
  const review = makeReviewState();

  const rail = h("aside", { class: "gd-rail" });
  const main = h("div", { class: "gd-main" });
  const root = h("div", { class: "gd" }, rail, main);
  stage.append(root);

  function addDecision(label, value) {
    const ex = decisions.find(d => d.label === label);
    if (ex) ex.value = value; else decisions.push({ label, value });
  }

  function renderRail() {
    clear(rail);
    rail.append(
      h("div", { class: "gd-rail__head" }, h("span", { class: "gd-rail__eyebrow" }, "Guided journey"),
        h("div", { class: "gd-rail__prog" }, "Step " + (idx + 1) + " of " + STAGES.length)),
      h("ol", { class: "gd-steps" }, STAGES.map((s, i) => h("li", {
        class: "gd-step" + (i === idx ? " is-cur" : "") + (done.has(i) ? " is-done" : "") + (i > idx && !done.has(i) ? " is-locked" : ""),
        onClick: () => { if (i <= Math.max(idx, ...[...done, -1]) + 1) goStage(i); } },
        h("span", { class: "gd-step__dot" }, done.has(i) ? "✓" : i + 1),
        h("span", { class: "gd-step__label" }, s.label)))),
      decisionMemory());
  }

  function decisionMemory() {
    const box = h("details", { class: "gd-mem" }, h("summary", {}, "Decisions so far (" + decisions.length + ")"),
      decisions.length
        ? h("ul", { class: "gd-mem__list" }, decisions.map(d => h("li", {}, h("span", { class: "gd-mem__k" }, d.label), h("span", {}, d.value))))
        : h("p", { class: "tiny muted", style: { padding: "0 12px 10px" } }, "Nothing settled yet. Each choice you confirm is remembered here."));
    return box;
  }

  function goStage(i, sub) {
    idx = Math.max(0, Math.min(STAGES.length - 1, i));
    renderRail();
    renderMain(sub);
    root.scrollIntoView?.({ block: "start" });
  }
  function advance() { done.add(idx); if (idx < STAGES.length - 1) goStage(idx + 1); else renderRail(); }

  function renderMain(sub) {
    clear(main);
    const s = STAGES[idx];
    const head = h("header", { class: "gd-head" },
      h("p", { class: "gd-head__crumb" }, "RocketCourse · " + (B.D.course?.title || "Your course")),
      h("h1", { class: "gd-head__title" }, s.label),
      h("p", { class: "gd-head__verb" }, s.verb));
    const body = h("div", { class: "gd-body" });
    const foot = h("footer", { class: "gd-foot" },
      h("button", { class: "btn", disabled: idx === 0, onClick: () => goStage(idx - 1) }, "‹ Back"),
      h("div", { class: "gd-foot__hint tiny muted" }, primaryHint(s.key)),
      primaryButton(s.key));
    main.append(head, body, foot);
    STAGE_RENDER[s.key](body, sub);
  }

  const STAGE_RENDER = {
    define(body, sub) {
      const brief = h("textarea", { class: "blk-textarea", rows: 5,
        html: "A first-year seminar that examines, across twelve guided conversations, the questions people have always asked about how to live." });
      const sources = h("div", { class: "gd-sources", id: "gd-sources" },
        h("div", { class: "row spread" }, h("h3", { class: "gd-h3" }, "Source materials"), h("span", { class: "pill ok tiny" }, "4 files parsed")),
        B.sourceList());
      body.append(
        h("label", { class: "gd-label" }, "Describe your course in a sentence or two"),
        brief,
        h("p", { class: "gd-help tiny muted" }, "Plain language is fine. You can attach a syllabus, reading list, or last year's Canvas export — we read them for structure, never invent facts."),
        sources);
      if (sub === "sources") sources.scrollIntoView?.({ block: "center" });
    },
    configure(body) {
      body.append(gdField("Level", segment(["Intro", "Intermediate", "Advanced"], 0, v => addDecision("Level", v))),
        gdField("Length", segment(["12 weeks", "14 weeks", "15 weeks", "16 weeks"], 2, v => addDecision("Length", v))),
        gdField("Meets", segment(["Online", "Hybrid", "In person"], 2, v => addDecision("Modality", v))),
        gdField("Assessment mix", h("p", { class: "tiny muted", style: { margin: 0 } }, "Reflections + short essays + discussion + low-stakes checks + capstone — you'll fine-tune weights later.")),
        h("div", { class: "gd-callout" }, h("span", {}, "💡"), h("p", { class: "tiny", style: { margin: 0 } }, "Only the decisions that change the plan appear now. Advanced settings (frameworks, quiz difficulty, contact-hour model) wait until they matter.")));
    },
    blueprint(body, sub) {
      body.append(h("p", { class: "gd-lead" }, "Here is the plan we'll build. Nothing is written yet — approve the architecture first."),
        B.blueprintView({}),
        h("div", { class: "gd-change", id: "gd-change" },
          h("h3", { class: "gd-h3" }, "Change a course-level decision"),
          B.courseChange({ onChanged: () => addDecision("Length", B.session.settings.weeks + " weeks") })));
      if (sub === "change") body.querySelector("#gd-change")?.scrollIntoView?.({ block: "center" });
    },
    generate(body) {
      const steps = ["Reading your prompt and sources", "Drafting learning outcomes", "Designing 13 modules", "Writing pages, discussions & assignments", "Building quizzes & rubrics", "Assembling homepage & syllabus", "Preparing the Canvas package"];
      const bar = h("div", { class: "gd-gen__bar" }, h("span", { class: "gd-gen__fill" }));
      const label = h("p", { class: "gd-gen__step" }, steps[0]);
      body.append(h("div", { class: "gd-gen" },
        h("div", { class: "gd-gen__rocket" }, "▲"),
        h("h3", {}, "Building your first draft"),
        label, bar,
        h("p", { class: "tiny muted" }, "This is a first draft, not a finished course — you'll review every part next.")));
      let i = 0;
      const fill = body.querySelector(".gd-gen__fill");
      const tick = () => {
        i++; const pct = Math.min(100, (i / steps.length) * 100);
        fill.style.width = pct + "%"; label.textContent = steps[Math.min(i, steps.length - 1)];
        if (i < steps.length) setTimeout(tick, 520);
        else { label.textContent = "Draft ready · 13 modules, 22 pages, 9 assignments, 6 quizzes"; done.add(idx); renderRail(); }
      };
      setTimeout(tick, 400);
    },
    review(body, sub) { review.render(body, sub); },
    resolve(body) {
      body.append(h("p", { class: "gd-lead" }, "Two things must be fixed before a confident export, plus a few recommendations. Resolve them here — each shows exactly what to do."),
        B.readinessPanel({ onResolveGoto: it => { goStage(4, { open: it.refId }); } }));
    },
    preview(body) {
      body.append(h("p", { class: "gd-lead" }, "This is the student's view. Move between weeks; open any item to read it as a student would."),
        B.studentPreview({}));
    },
    export(body) {
      body.append(B.exportPanel({ onGoResolve: () => goStage(5) }));
    },
  };

  function primaryButton(key) {
    const cfg = {
      define: ["Save & continue", () => { addDecision("Course", B.D.course?.title || "Your course"); addDecision("Sources", "4 files"); advance(); }],
      configure: ["Continue to blueprint", () => advance()],
      blueprint: ["Approve blueprint & build", () => { addDecision("Blueprint", "Approved"); goStage(3); }],
      generate: ["Go to review", () => { if (!done.has(3)) { toast("Let the draft finish building", "info"); return; } advance(); }],
      review: ["Everything looks right →", () => advance()],
      resolve: ["Continue", () => advance()],
      preview: ["Looks good — to export", () => advance()],
      export: ["Back to lab home", () => ctx.go("#/")],
    };
    const [label, fn] = cfg[key];
    return h("button", { class: "btn btn--primary gd-foot__go", onClick: fn }, label);
  }
  function primaryHint(key) {
    return {
      define: "One primary action per step.", configure: "3 quick choices — that's all we need now.",
      blueprint: "You approve the structure before any prose is written.", generate: "",
      review: "Open Module 4 from the list to try the shared tasks.", resolve: B.openIssuesCount() + " open items",
      preview: "", export: "Import into Canvas is not verified until you test it.",
    }[key];
  }

  // ---- review sub-view -----------------------------------------------------
  function makeReviewState() {
    let curMod = B.focusModuleId(), openItemId = null, mode = "items";
    let bodyRef = null;
    function render(body, sub) {
      bodyRef = body; clear(body);
      if (sub && sub.open) { openFromRef(sub.open); }
      const modBar = h("div", { class: "gd-modbar" }, B.session.modules.map(m => h("button", {
        class: "gd-modchip" + (m.id === curMod ? " is-on" : "") + (m.status !== "approved" ? " has-attn" : ""),
        onClick: () => { curMod = m.id; openItemId = null; render(body); } },
        m.kind === "start" ? "Start" : m.order, m.status !== "approved" && h("span", { class: "gd-dot" }))));
      const mod = B.moduleById(curMod);
      const left = h("div", { class: "gd-rev__left" },
        h("div", { class: "gd-rev__modhead" }, h("h3", {}, mod.title), h("span", { class: "tiny muted" }, mod.summary)),
        h("p", { class: "tiny muted" }, "Reorder with ↑ ↓ · open an item to edit it. Scope of any edit is shown in the editor."),
        B.moduleItemList(curMod, { selectedItemId: openItemId, onOpen: it => { openItem(it); }, onReorder: () => {} }));
      const right = h("div", { class: "gd-rev__right" }, openItemId ? renderItem() : h("div", { class: "gd-rev__empty muted" }, "Select an item to edit it here."));
      body.append(modBar, h("div", { class: "gd-rev" }, left, right));
    }
    function openItem(it) { openItemId = it.id; render(bodyRef); }
    function openFromRef(refId) {
      // find item across modules by refId
      for (const m of B.session.modules) { const it = m.items.find(x => x.refId === refId); if (it) { curMod = m.id; openItemId = it.id; return; } }
    }
    function renderItem() {
      const mod = B.moduleById(curMod);
      const it = mod.items.find(x => x.id === openItemId);
      if (!it) return h("div", {});
      if (it.type === "page") return h("div", {}, itemScopeHead(it), B.pageEditor(it.refId, { scopeNote: "one page in " + shortMod(mod), onSaved: () => render(bodyRef) }));
      if (it.type === "assignment") return h("div", {}, itemScopeHead(it), B.assignmentRubricView(it.refId, { onResolve: () => render(bodyRef) }));
      if (it.type === "discussion") return h("div", {}, itemScopeHead(it), discussionEditor(it.refId, () => render(bodyRef)));
      if (it.type === "quiz") return h("div", {}, itemScopeHead(it), quizView(it.refId, () => render(bodyRef)));
      return h("div", {});
    }
    return {
      render,
      goto(task) {
        const fm = B.focusModuleId();
        if (task === 6) { curMod = fm; openItemId = null; mode = "items"; }
        if (task === 7) { curMod = fm; openItemId = B.focusItemId(fm, "page"); }
        if (task === 8) { curMod = fm; openItemId = B.focusItemId(fm, "assignment"); }
        if (task === 9) { curMod = fm; openItemId = null; }
        if (bodyRef) render(bodyRef);
        if (task === 9) setTimeout(() => bodyRef?.querySelector(".blk-item__reorder .blk-mv")?.focus(), 60);
      },
      setMod(m) { curMod = m; openItemId = null; },
    };
  }
  function itemScopeHead(it) {
    const glyphName = { page: "Page", assignment: "Assignment", discussion: "Discussion", quiz: "Quiz" }[it.type];
    return h("div", { class: "gd-itemhead" }, h("span", { class: "pill" }, glyphName), it.needsAttention && h("span", { class: "pill warn" }, "Needs your attention"));
  }

  // ---- boot ----------------------------------------------------------------
  renderRail(); renderMain();

  function goToTask(n) {
    const map = { 1: [0], 2: [0, "sources"], 3: [1], 4: [2], 5: [2, "change"], 6: [4], 7: [4], 8: [4], 9: [4], 10: [5], 11: [6], 12: [7] };
    const [st, sub] = map[n] || [0];
    // ensure prior stages count as visited so rail unlocks
    for (let i = 0; i < st; i++) done.add(i);
    goStage(st, sub === "sources" ? "sources" : sub === "change" ? "change" : undefined);
    if (st === 4) review.goto(n);
  }
  return { goToTask };
}

// small inline editors used by review ------------------------------------------
function discussionEditor(id, onSaved) {
  const d = B.session.discussions[id];
  const ta = h("textarea", { class: "blk-textarea", rows: 5 }, d.prompt.replace(/<[^>]+>/g, "").trim());
  return h("div", {},
    d.needsAttention === "ai-review" && h("div", { class: "gd-ainote attn" }, "✦ " + (d.aiNote || "AI draft — review before students see it.")),
    h("label", { class: "gd-label" }, "Discussion prompt"), ta,
    d.replyGuidance && h("p", { class: "tiny muted" }, "Reply guidance: " + d.replyGuidance),
    h("div", { class: "row gap-8", style: { marginTop: "10px" } },
      h("button", { class: "btn btn--primary", onClick: () => { d.prompt = "<p>" + ta.value + "</p>"; d.edited = true; d.needsAttention = null; B.session.reviewQueue = B.session.reviewQueue.filter(r => r.refId !== id); B.session.commit?.(); B.resolveIssue("w4"); B.resolveIssue("rev1"); toast("Prompt approved", "ok"); onSaved(); } }, "Approve prompt"),
      h("span", { class: "tiny muted" }, "Scope · one discussion")));
}
function quizView(id, onSaved) {
  const q = B.session.quizzes[id];
  return h("div", {}, h("h3", { class: "gd-h3" }, q.title),
    h("ul", { class: "gd-quiz" }, q.questions.map((qq, i) => h("li", { class: qq.needsAttention ? "attn" : "" },
      h("div", {}, h("strong", {}, "Q" + (i + 1) + " · " + qq.type.replace("_", " ")), " " + qq.stem),
      qq.needsAttention === "verify-key"
        ? h("div", { class: "row gap-8", style: { marginTop: "6px" } }, h("span", { class: "pill danger" }, "Answer key unverified"),
            h("button", { class: "btn btn--sm btn--primary", onClick: () => { qq.needsAttention = null; qq.verified = true; B.session.reviewQueue = B.session.reviewQueue.filter(r => r.refId !== id); B.session.commit?.(); B.resolveIssue("b1"); B.resolveIssue("rev2"); toast("Answer key verified — blocker cleared", "ok"); onSaved(); } }, "Verify key"))
        : h("span", { class: "pill ok tiny" }, "verified")))));
}
function shortMod(m) { return m.kind === "start" ? "Start Here" : "Module " + m.order; }
function gdField(label, control) { return h("div", { class: "gd-field" }, h("div", { class: "gd-field__label" }, label), control); }
function segment(opts, def, onPick) {
  const seg = h("div", { class: "blk-seg" });
  opts.forEach((o, i) => seg.append(h("button", { class: "blk-seg__b" + (i === def ? " is-on" : ""), onClick: e => { seg.querySelectorAll(".blk-seg__b").forEach(b => b.classList.remove("is-on")); e.currentTarget.classList.add("is-on"); onPick?.(o); } }, o)));
  return seg;
}

export function rationale() {
  return h("div", { class: "prose" },
    h("h2", {}, "Hypothesis"),
    h("p", {}, "A first-time instructor is not short on intelligence — they're short on a map. Show exactly one decision at a time, remember everything already settled, and never present a wall of tabs. Confidence comes from always knowing the next step and being able to walk back safely."),
    h("h3", {}, "Information architecture"),
    h("p", {}, "Eight linear milestones (Define · Configure · Blueprint · Generate · Review · Fix issues · Student preview · Export). The rail is the only global navigation; there is no competing tab strip. A collapsed “Decisions so far” panel is the persistent memory — the antidote to a settings dashboard."),
    h("h3", {}, "Key moves"),
    h("ul", {},
      h("li", {}, "One primary action per screen; Back is always available and non-destructive."),
      h("li", {}, "Blueprint approval precedes any prose, so review isn't a firehose."),
      h("li", {}, "Readiness is a dedicated stage, not an ambient anxiety meter — each issue says exactly what to do and links to the fix."),
      h("li", {}, "Scope of every edit is labelled (this page / this module / course-wide).")),
    h("h3", {}, "Trade-offs"),
    h("p", {}, "Deliberately slower for experts and it can hide the whole-course picture behind the current step. Concept 7 (Guided ↔ Expert) and Concept 3 (Course Map) exist partly to answer those costs."),
    h("h3", {}, "Visual system"),
    h("p", {}, "Calm, light, single-column focus. Type scale leans on one strong title per screen. Accent used only for the single primary action and progress. No nested cards, no badge walls."));
}

// ---- utility ---------------------------------------------------------------
function ensureCss(id, hrefs) {
  (Array.isArray(hrefs) ? hrefs : [hrefs]).forEach((href, i) => {
    const key = "css-" + id + "-" + i;
    if (document.getElementById(key)) return;
    const link = document.createElement("link");
    link.id = key; link.rel = "stylesheet"; link.href = href;
    document.head.append(link);
  });
}
