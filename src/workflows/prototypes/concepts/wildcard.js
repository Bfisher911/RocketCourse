// CONCEPT 8 — WILDCARD · READING-ROOM DESK
// Not a dashboard. Building the course feels like preparing a seminar at a desk:
// the syllabus-in-progress is the manuscript (the spine); things needing your
// eye are margin notes; tools live in a desk drawer. Calm, content-first.
import { h, clear, toast, itemGlyph, ATTN } from "../shared/ui.js";
import * as B from "../shared/blocks.js";
ensureCss("wildcard", ["../shared/blocks.css", "./concepts/wildcard.css"]);

export function mount(stage, ctx) {
  let expanded = B.focusModuleId();   // which conversation is open in the manuscript
  let reading = null;        // {modId,itemId} open in the reading panel, or a tool id
  let studentMode = false;

  const root = h("div", { class: "wc", "data-force-light": "" });
  stage.append(root);

  function render() {
    clear(root);
    root.append(desk(), h("div", { class: "wc-room" }, margins(), manuscript()));
    if (reading) root.append(readingPanel());
  }

  // ---- the desk (tools drawer) --------------------------------------------
  function desk() {
    return h("header", { class: "wc-desk" },
      h("div", { class: "wc-desk__plate" }, h("span", { class: "wc-desk__mark" }, "✦"),
        h("div", {}, h("div", { class: "wc-desk__title" }, B.D.course?.title || "Your course"), h("div", { class: "wc-desk__sub" }, "A seminar, taking shape on your desk"))),
      h("div", { class: "wc-drawer" },
        tool("sources", "📁", "Sources"), tool("blueprint", "🗂", "Outline"), tool("setup", "🗃", "Course card"),
        h("button", { class: "wc-tool wc-tool--toggle" + (studentMode ? " is-on" : ""), onClick: () => { studentMode = !studentMode; reading = null; render(); } }, h("span", { class: "wc-tool__ico" }, "👓"), studentMode ? "Reading as student" : "Read as student"),
        tool("export", "✉", "Send to Canvas")));
  }
  function tool(id, ico, label) { return h("button", { class: "wc-tool", onClick: () => { reading = { tool: id }; render(); } }, h("span", { class: "wc-tool__ico" }, ico), label); }

  // ---- margin notes (the things needing your eye) --------------------------
  function margins() {
    const notes = [
      ...B.session.readiness.blockers.map(b => ({ ...b, tone: "danger", tag: "must fix" })),
      ...B.session.readiness.warnings.map(w => ({ ...w, tone: "warn", tag: "worth a look" })),
    ];
    return h("aside", { class: "wc-margins" },
      h("h2", { class: "wc-margins__h" }, "Margin notes"),
      notes.length ? h("div", { class: "wc-notes" }, notes.map(n => h("button", { class: "wc-note wc-note--" + n.tone, onClick: () => openRef(n.refId) },
        h("span", { class: "wc-note__tag" }, n.tag), h("span", { class: "wc-note__label" }, n.label), h("span", { class: "wc-note__where tiny" }, n.where))))
        : h("p", { class: "wc-margins__clear" }, "Nothing left in the margins. The manuscript is ready."),
      h("p", { class: "wc-margins__foot tiny" }, "Notes clear themselves as you resolve them, like crossing out a to-do in pencil."));
  }

  // ---- the manuscript (the syllabus-in-progress) --------------------------
  function manuscript() {
    if (studentMode) return h("div", { class: "wc-manuscript wc-manuscript--student" }, B.studentPreview({ moduleId: expanded }));
    const m = h("article", { class: "wc-manuscript" });
    m.append(h("div", { class: "wc-title-block" },
      h("p", { class: "wc-eyebrow" }, [B.D.course?.level, B.D.course?.modality].filter(Boolean).join(" · ")),
      h("h1", { class: "wc-book-title" }, B.D.course?.title || "Your course"),
      h("p", { class: "wc-lede" }, B.D.course.description)));
    m.append(h("h2", { class: "wc-contents-h" }, "The conversations"));
    B.session.modules.forEach(mod => m.append(conversationEntry(mod)));
    return m;
  }
  function conversationEntry(mod) {
    const open = expanded === mod.id;
    const heavy = mod.workloadHours > 6;
    const entry = h("section", { class: "wc-conv" + (open ? " is-open" : "") });
    entry.append(h("button", { class: "wc-conv__head", onClick: () => { expanded = open ? null : mod.id; render(); } },
      h("span", { class: "wc-conv__no" }, mod.kind === "start" ? "—" : mod.order),
      h("span", { class: "wc-conv__title" }, mod.kind === "start" ? "Start Here" : mod.title.replace(/^\d+ · /, "")),
      mod.status !== "approved" && h("span", { class: "wc-conv__pencil", title: "has a margin note" }, "✎"),
      h("span", { class: "wc-conv__load tiny" + (heavy ? " is-heavy" : "") }, mod.workloadHours + "h")));
    if (open) {
      entry.append(h("p", { class: "wc-conv__summary" }, mod.summary));
      const list = h("ol", { class: "wc-prep" });
      mod.items.forEach((it, i) => {
        const c = B.contentFor(it), attn = it.needsAttention && ATTN[it.needsAttention];
        list.append(h("li", { class: "wc-prepitem" + (attn ? " attn" : "") },
          h("button", { class: "wc-prepitem__open", onClick: () => { reading = { modId: mod.id, itemId: it.id }; render(); } },
            h("span", { class: "wc-prepitem__glyph" }, itemGlyph(it.type)),
            h("span", { class: "wc-prepitem__title" }, it.title),
            c?.edited && h("span", { class: "wc-inkchip" }, "your note"),
            attn && h("span", { class: "wc-inkchip wc-inkchip--warn" }, attn.label)),
          h("span", { class: "wc-prepitem__mv" },
            h("button", { class: "wc-mv", "aria-label": "Earlier", disabled: i === 0, onClick: () => moveItem(mod, i, -1) }, "↑"),
            h("button", { class: "wc-mv", "aria-label": "Later", disabled: i === mod.items.length - 1, onClick: () => moveItem(mod, i, 1) }, "↓"))));
      });
      entry.append(list);
    }
    return entry;
  }
  function moveItem(mod, i, dir) { const j = i + dir; if (j < 0 || j >= mod.items.length) return; [mod.items[i], mod.items[j]] = [mod.items[j], mod.items[i]]; B.session.commit?.(); toast("Moved within “" + mod.title.replace(/^\d+ · /, "") + "”", "ok"); render(); }

  // ---- reading panel (turn to a page) -------------------------------------
  function readingPanel() {
    const close = () => { document.removeEventListener("keydown", onKey); reading = null; render(); };
    const onKey = e => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    let title, body;
    if (reading.tool) {
      const t = reading.tool;
      title = { sources: "Sources folder", blueprint: "Course outline", setup: "Course card", export: "Send to Canvas" }[t];
      body = t === "sources" ? B.sourceList()
        : t === "blueprint" ? B.blueprintView({})
        : t === "setup" ? h("div", {}, h("p", { class: "wc-panel__note" }, "The course card holds decisions that touch the whole course."), B.courseChange({ onChanged: render }))
        : B.exportPanel({ onGoResolve: close });
    } else {
      const mod = B.moduleById(reading.modId);
      const it = mod.items.find(x => x.id === reading.itemId);
      title = it.title;
      body = B.itemEditor(it, { scopeMod: mod, onChange: render });
    }
    const closeBtn = h("button", { class: "wc-reading__close", onClick: close, "aria-label": "Close" }, "Close book ✕");
    const panel = h("div", { class: "wc-reading", "data-force-light": "", role: "dialog", "aria-modal": "true", "aria-label": title },
      h("div", { class: "wc-reading__head" }, h("h2", {}, title), closeBtn),
      h("div", { class: "wc-reading__body" }, body));
    const overlay = h("div", { class: "wc-reading-overlay", onClick: e => { if (e.target.classList.contains("wc-reading-overlay")) close(); } }, panel);
    setTimeout(() => closeBtn.focus(), 30);
    return overlay;
  }

  function openRef(refId) {
    if (refId === "syllabus") { reading = { tool: "setup" }; render(); return; }
    if (refId === "o6") { reading = { tool: "blueprint" }; render(); return; }
    for (const m of B.session.modules) { const it = m.items.find(i => i.refId === refId); if (it) { expanded = m.id; reading = { modId: m.id, itemId: it.id }; render(); return; } }
    // module-level ref (workload)
    const mod = B.moduleById(refId); if (mod) { expanded = mod.id; render(); }
  }

  render();

  function goToTask(n) {
    studentMode = false; reading = null;
    const acts = {
      1: () => { expanded = B.firstModuleId(); },
      2: () => reading = { tool: "sources" },
      3: () => reading = { tool: "setup" },
      4: () => reading = { tool: "blueprint" },
      5: () => reading = { tool: "setup" },
      6: () => { expanded = B.focusModuleId(); },
      7: () => { const fm = B.focusModuleId(); expanded = fm; reading = { modId: fm, itemId: B.focusItemId(fm, "page") }; },
      8: () => { const fm = B.focusModuleId(); expanded = fm; reading = { modId: fm, itemId: B.focusItemId(fm, "assignment") }; },
      9: () => { expanded = B.focusModuleId(); },
      10: () => { /* margins are always visible; open the first must-fix */ const b = B.session.readiness.blockers[0]; if (b) { openRef(b.refId); return; } },
      11: () => { studentMode = true; expanded = B.focusModuleId(); },
      12: () => reading = { tool: "export" },
    };
    if (n === 10) { acts[10](); return; }
    (acts[n] || acts[1])(); render();
  }
  function focusModule(id) { if (!B.moduleById(id)) return; studentMode = false; reading = null; expanded = id; render(); }
  return { goToTask, focusRef: openRef, focusModule };
}

export function rationale() {
  return h("div", { class: "prose" },
    h("h2", {}, "Hypothesis & the user it's for"),
    h("p", {}, "Many humanities instructors are actively put off by “AI course dashboards” — the neon, the tiles, the metrics feel alien to how they actually prepare a seminar. The hypothesis: for that person, the interface should feel like a desk. The syllabus-in-progress is a manuscript they read top to bottom; the things needing attention are margin notes in pencil; the machinery (sources, outline, export) lives in a drawer, out of the way until reached for. Almost no dashboard affordances."),
    h("h3", {}, "Information architecture"),
    h("p", {}, "One spine — the course document — organizes everything. Conversations are entries you turn to; opening an item is “turning to a page” in a reading panel. Course-wide machinery is a small set of desk tools. Readiness is reframed as marginalia that erases itself as you resolve it, so quality feels like editing a text, not clearing a ticket queue."),
    h("h3", {}, "Why it can work (and stay practical)"),
    h("ul", {}, h("li", {}, "It preserves every capability — the same editors, rubric, readiness, preview and export live inside the metaphor, not instead of it."),
      h("li", {}, "It is calmer and more legible than a dashboard for content-first thinkers, and the “Read as student” toggle makes the payoff — the student's experience — one gesture away."),
      h("li", {}, "It stays keyboard- and screen-reader-navigable: it's semantic HTML with a warm theme, not a skeuomorphic gimmick.")),
    h("h3", {}, "Trade-offs / risks"),
    h("p", {}, "The metaphor could obscure power features for a heavy instructional designer, and very item-dense work may want a denser surface (Concept 7's Expert mode). It's a deliberately narrow bet on delight and calm for a specific, underserved user — proposed as a distinctive north star, not the default for everyone."));
}
function ensureCss(id, hrefs) { (Array.isArray(hrefs) ? hrefs : [hrefs]).forEach((href, i) => { const key = "css-" + id + "-" + i; if (document.getElementById(key)) return; const l = document.createElement("link"); l.id = key; l.rel = "stylesheet"; l.href = href; document.head.append(l); }); }
