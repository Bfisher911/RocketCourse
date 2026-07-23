// ============================================================================
// LAB SHELL — homepage, global concept switcher, shared 12-task tracker,
// viewport frame, rationale drawer. Loads concept modules on demand.
// ============================================================================
import { h, clear, drawer, toast } from "./ui.js";
import { CONCEPT_META, SHARED_TASKS } from "../data/tasks.js";

const root = document.getElementById("lab-root");
let currentConcept = null; // { id, api }
let viewport = "desktop";

// ---- routing ----------------------------------------------------------------
function parseHash() {
  const m = location.hash.match(/^#\/c\/([\w-]+)(?:\/t\/(\d+))?/);
  if (m) return { view: "concept", id: m[1], task: m[2] ? Number(m[2]) : null };
  return { view: "home" };
}
window.addEventListener("hashchange", render);

function go(hash) { location.hash = hash; }

// ---- top chrome -------------------------------------------------------------
function topBar(route) {
  const meta = route.id ? CONCEPT_META.find(c => c.id === route.id) : null;
  const idx = meta ? CONCEPT_META.indexOf(meta) : -1;

  const switcher = h("div", { class: "sw" },
    h("button", { class: "sw__btn", "aria-haspopup": "true", onClick: openSwitcher },
      meta ? `${meta.favicon}  ${meta.num}. ${meta.name}` : "All eight concepts",
      h("span", { class: "sw__chev" }, "▾")));

  const nav = meta ? h("div", { class: "row gap-4" },
    h("button", { class: "btn btn--ghost btn--sm", "aria-label": "Previous concept", disabled: idx <= 0,
      onClick: () => go(`#/c/${CONCEPT_META[idx - 1].id}`) }, "‹"),
    h("button", { class: "btn btn--ghost btn--sm", "aria-label": "Next concept", disabled: idx >= CONCEPT_META.length - 1,
      onClick: () => go(`#/c/${CONCEPT_META[idx + 1].id}`) }, "›")) : null;

  const right = h("div", { class: "row gap-8" },
    meta && viewportToggle(),
    meta && h("button", { class: "btn btn--ghost btn--sm", onClick: () => openRationale(meta) }, "Design rationale"),
    h("a", { class: "btn btn--ghost btn--sm", href: "../evaluation/CONCEPT_SCORECARD.md", target: "_blank" }, "Evaluation"),
    h("a", { class: "btn btn--ghost btn--sm", href: "../FINAL_RECOMMENDATION.md", target: "_blank" }, "Recommendation"));

  return h("header", { class: "topbar" },
    h("div", { class: "row gap-16" },
      h("button", { class: "wordmark", onClick: () => go("#/"), title: "Lab home" },
        h("span", { class: "wordmark__rk" }, "▲"), "RocketCourse ", h("span", { class: "muted" }, "UX Lab")),
      switcher, nav),
    right);
}

function viewportToggle() {
  const opt = (id, label) => h("button", { class: "vp__b" + (viewport === id ? " is-on" : ""), onClick: () => { viewport = id; applyViewport(); }, "aria-pressed": String(viewport === id) }, label);
  return h("div", { class: "vp", role: "group", "aria-label": "Preview width" }, opt("desktop", "Desktop"), opt("tablet", "Tablet"), opt("mobile", "Mobile"));
}
function applyViewport() {
  const frame = document.querySelector(".stage-frame");
  if (frame) { frame.dataset.vp = viewport; }
  document.querySelectorAll(".vp__b").forEach(b => {
    const on = b.textContent.toLowerCase() === viewport;
    b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", String(on));
  });
}

function taskBar(route) {
  if (!route.id) return null;
  const bar = h("div", { class: "taskbar", role: "navigation", "aria-label": "Shared comparison tasks" },
    h("span", { class: "taskbar__lead" }, "Shared tasks"),
    h("div", { class: "taskbar__chips" },
      SHARED_TASKS.map(t => h("button", {
        class: "taskchip" + (route.task === t.n ? " is-on" : ""), dataset: { n: t.n },
        title: t.label, onClick: () => runTask(route.id, t.n)
      }, h("b", {}, t.n), t.short))));
  return bar;
}

function runTask(id, n) {
  go(`#/c/${id}/t/${n}`);
  // if concept already mounted, drive it without full remount
  if (currentConcept && currentConcept.id === id && currentConcept.api?.goToTask) {
    currentConcept.api.goToTask(n);
    highlightTask(n);
    const t = SHARED_TASKS.find(x => x.n === n);
    toast(`Task ${n}: ${t.label}`, "info");
  }
}
function highlightTask(n) {
  document.querySelectorAll(".taskchip").forEach(c => c.classList.toggle("is-on", Number(c.dataset.n) === n));
}

// ---- switcher overlay -------------------------------------------------------
function openSwitcher() {
  const grid = h("div", { class: "sw-grid" },
    CONCEPT_META.map(c => h("button", { class: "sw-grid__item", onClick: () => { d.close(); go(`#/c/${c.id}`); } },
      h("div", { class: "sw-grid__ico" }, c.favicon),
      h("div", {}, h("div", { class: "sw-grid__name" }, `${c.num}. ${c.name}`),
        h("div", { class: "sw-grid__hyp muted tiny" }, c.hypothesis)))));
  const d = drawer({ title: "Jump to a concept", bodyNode: grid, side: "right" });
}

function openRationale(meta) {
  import(`../concepts/${meta.id}.js`).then(mod => {
    const body = mod.rationale ? mod.rationale() : h("p", {}, "No rationale provided.");
    drawer({ title: `Design rationale · ${meta.name}`, bodyNode: body });
  });
}

// ---- homepage ---------------------------------------------------------------
function homepage() {
  const wrap = h("div", { class: "home" },
    h("section", { class: "home__hero" },
      h("p", { class: "home__eyebrow" }, "Design discovery · not the production app"),
      h("h1", { class: "home__title" }, "Eight ways to build the same course"),
      h("p", { class: "home__lede" },
        "A blank-sheet reconception of the RocketCourse workflow — from a course idea to an exported Canvas package. ",
        "Every concept below carries the ", h("strong", {}, "same capabilities and the same final output"), "; they differ in ",
        "information architecture, sequencing, and how much they guide you. All eight run on identical mock data for ",
        h("strong", {}, "“The Meaning of Life in 12 Conversations.”")),
      h("div", { class: "home__meta" },
        chip("Shared scenario", "12-module seminar"), chip("Shared tasks", "12 comparison tasks"),
        chip("Data", "deterministic · no live AI"), chip("Production", "untouched"))),
    h("section", { class: "home__tasks card" },
      h("h2", { class: "home__h2" }, "The 12 shared tasks each concept must support"),
      h("ol", { class: "home__tasklist" }, SHARED_TASKS.map(t => h("li", {}, t.label)))),
    h("section", { class: "home__grid" }, CONCEPT_META.map(conceptCard)),
    h("footer", { class: "home__foot muted tiny" },
      "Reading materials: ",
      docLink("../CURRENT_STATE_WORKFLOW.md", "Current-state workflow"), " · ",
      docLink("../CAPABILITY_LEDGER.md", "Capability ledger"), " · ",
      docLink("../CONCEPT_GALLERY.md", "Concept gallery"), " · ",
      docLink("../evaluation/CONCEPT_SCORECARD.md", "Scorecard"), " · ",
      docLink("../evaluation/TASK_WALKTHROUGHS.md", "Task walkthroughs"), " · ",
      docLink("../evaluation/INDEPENDENT_CRITIQUE.md", "Independent critique"), " · ",
      docLink("../FINAL_RECOMMENDATION.md", "Final recommendation")));
  return wrap;
}
const chip = (k, v) => h("div", { class: "home__chip" }, h("span", { class: "muted tiny" }, k), h("strong", {}, v));
const docLink = (href, label) => h("a", { href, target: "_blank" }, label);

function conceptCard(c) {
  return h("article", { class: "ccard" },
    h("div", { class: "ccard__top" },
      h("span", { class: "ccard__num" }, String(c.num).padStart(2, "0")),
      h("span", { class: "ccard__ico" }, c.favicon)),
    h("h3", { class: "ccard__name" }, c.name),
    h("p", { class: "ccard__hyp" }, c.hypothesis),
    h("dl", { class: "ccard__facts" },
      fact("For", c.user), fact("Guidance", c.guidance), fact("Navigation", c.nav)),
    h("div", { class: "ccard__sr" },
      h("div", { class: "ccard__s" }, h("span", { class: "tiny muted" }, "Strength"), h("p", {}, c.strength)),
      h("div", { class: "ccard__r" }, h("span", { class: "tiny muted" }, "Main risk"), h("p", {}, c.risk))),
    h("div", { class: "ccard__cta" },
      h("button", { class: "btn btn--primary", onClick: () => go(`#/c/${c.id}`) }, "Open prototype  →"),
      h("button", { class: "btn btn--ghost btn--sm", onClick: () => openRationale(c) }, "Rationale")));
}
const fact = (k, v) => h("div", { class: "fact" }, h("dt", {}, k), h("dd", {}, v));

// ---- concept host -----------------------------------------------------------
async function mountConcept(route) {
  const meta = CONCEPT_META.find(c => c.id === route.id);
  if (!meta) { go("#/"); return; }
  const stage = h("div", { class: "stage" });
  const frame = h("div", { class: "stage-frame", dataset: { vp: viewport } }, stage);
  root.append(frame);
  applyViewport();
  try {
    const mod = await import(`../concepts/${route.id}.js`);
    const api = mod.mount(stage, {
      go, toast, drawer,
      onReady: () => { if (route.task) { api.goToTask?.(route.task); highlightTask(route.task); } },
    });
    currentConcept = { id: route.id, api };
    if (route.task && api.goToTask) { api.goToTask(route.task); highlightTask(route.task); }
  } catch (err) {
    stage.append(h("div", { class: "stage-error" },
      h("h2", {}, "This concept failed to load"),
      h("pre", {}, String(err && err.stack || err))));
    console.error(err);
  }
}

// ---- render -----------------------------------------------------------------
function render() {
  const route = parseHash();
  clear(root);
  currentConcept = null;
  root.append(topBar(route));
  const tb = taskBar(route);
  if (tb) root.append(tb);
  if (route.view === "home") {
    root.append(homepage());
  } else {
    mountConcept(route);
  }
  window.scrollTo(0, 0);
}

render();
