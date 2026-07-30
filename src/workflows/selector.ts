// Experience Selector (Phase 3). A curated gallery — not pricing tiers.
// Nine numbered experiences, "best for", guidance, nav model, a Recommended
// badge on Guided Journey, and an explicit promise that switching won't change
// course content. Units-inspired styling via the rc- token layer.

import { experiencesByCode, type WorkflowExperience } from "./experienceRegistry";
import { saveUserPreferred } from "./workflowContext";

export interface SelectorCallbacks {
  currentId: () => string;
  onUse: (id: string) => void;
  onDemo: (id: string) => void;
  onClose: () => void;
}

export function openSelector(cb: SelectorCallbacks): HTMLElement {
  const overlay = document.createElement("div");
  overlay.className = "rc-sel-overlay";
  overlay.setAttribute("data-rc-ds", "");
  overlay.addEventListener("click", e => { if (e.target === overlay) cb.onClose(); });
  document.addEventListener("keydown", function onKey(e) {
    if (e.key === "Escape") { cb.onClose(); document.removeEventListener("keydown", onKey); }
  });

  const panel = document.createElement("div");
  panel.className = "rc-sel rc-grid-bg";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", "Choose a course-building experience");

  panel.appendChild(header(cb));
  const grid = document.createElement("div");
  grid.className = "rc-sel__grid";
  experiencesByCode().forEach(exp => grid.appendChild(card(exp, cb)));
  panel.appendChild(grid);

  overlay.appendChild(panel);
  return overlay;
}

function header(cb: SelectorCallbacks): HTMLElement {
  const h = document.createElement("div");
  h.className = "rc-sel__head";
  h.innerHTML = `
    <div>
      <div class="rc-code">Experiences</div>
      <h1 class="rc-sel__title">Nine ways to build the same course</h1>
      <p class="rc-sel__note">Switching an experience changes only navigation, presentation, and guidance.
      <strong>Your course content, modules, edits, readiness, and export never change.</strong></p>
    </div>`;
  const close = document.createElement("button");
  close.className = "rc-btn rc-btn--ghost";
  close.textContent = "Close ✕";
  close.setAttribute("aria-label", "Close experience selector");
  close.addEventListener("click", () => cb.onClose());
  h.appendChild(close);
  return h;
}

function card(exp: WorkflowExperience, cb: SelectorCallbacks): HTMLElement {
  const el = document.createElement("article");
  el.className = "rc-xcard";
  el.style.setProperty("--accent", `var(${exp.accent})`);
  const isCurrent = cb.currentId() === exp.id;

  el.innerHTML = `
    <div class="rc-xcard__top">
      <span class="rc-code rc-xcard__code">${exp.code}</span>
      ${exp.isDefault ? `<span class="rc-badge rc-badge--rec">Recommended</span>` : ""}
      ${isCurrent ? `<span class="rc-badge rc-badge--cur">Current</span>` : ""}
    </div>
    <h2 class="rc-xcard__name">${exp.name}</h2>
    <p class="rc-xcard__desc">${exp.shortDescription}</p>
    <dl class="rc-xcard__facts">
      <div><dt>Best for</dt><dd>${exp.bestFor}</dd></div>
      <div><dt>Guidance</dt><dd>${labelGuidance(exp.guidance)}</dd></div>
      <div><dt>Navigation</dt><dd>${labelNav(exp.navModel)}</dd></div>
    </dl>`;

  const actions = document.createElement("div");
  actions.className = "rc-xcard__actions";

  const use = btn(isCurrent ? "In use" : "Use this experience", "primary", () => cb.onUse(exp.id));
  use.disabled = isCurrent;
  const demo = btn("Try demo", "ghost", () => cb.onDemo(exp.id));
  demo.disabled = !exp.demoAvailable;
  const setDefault = btn("Set as my default", "ghost", () => {
    saveUserPreferred(exp.id);
    setDefault.textContent = "Saved as default ✓";
  });
  actions.append(use, demo, setDefault);
  el.appendChild(actions);
  return el;
}

function btn(label: string, kind: "primary" | "ghost", onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.className = `rc-btn rc-btn--${kind} rc-btn--sm`;
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

function labelGuidance(g: WorkflowExperience["guidance"]): string {
  return { high: "High — hand-held", medium: "Medium", adaptive: "Adaptive",
    switchable: "Switchable", low: "Low — direct" }[g];
}
function labelNav(n: WorkflowExperience["navModel"]): string {
  return {
    "linear-wizard": "Linear milestones", "decision-canvas": "Decisions first",
    "spatial-tree": "Course map + inspector", "chat-plus-canvas": "Course + AI proposals",
    "job-board": "Prioritized jobs", "zoom-filmstrip": "Zoomable storyboard",
    "density-toggle": "Guided/Expert toggle", "document-desk": "Document desk", "legacy-tabs": "Tabbed editor",
  }[n];
}
