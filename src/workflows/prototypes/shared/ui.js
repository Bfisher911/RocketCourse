// Tiny hyperscript + helpers shared by all concepts. No framework, no deps.
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k === "text") el.textContent = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "dataset") Object.entries(v).forEach(([dk, dv]) => (el.dataset[dk] = dv));
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const frag = (...children) => {
  const f = document.createDocumentFragment();
  children.flat().forEach(c => { if (c != null && c !== false) f.append(c.nodeType ? c : document.createTextNode(String(c))); });
  return f;
};

export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }

// A small, dependency-free toast used for "saved" / "done" feedback.
let toastHost;
export function toast(msg, kind = "ok") {
  if (!toastHost) { toastHost = h("div", { class: "lab-toast-host" }); document.body.append(toastHost); }
  const t = h("div", { class: `lab-toast lab-toast--${kind}`, role: "status" }, msg);
  toastHost.append(t);
  requestAnimationFrame(() => t.classList.add("is-in"));
  setTimeout(() => { t.classList.remove("is-in"); setTimeout(() => t.remove(), 300); }, 2600);
}

// Accessible modal/drawer used by several concepts (rationale, help, etc.)
export function drawer({ title, bodyNode, side = "right" }) {
  const close = () => { overlay.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = e => { if (e.key === "Escape") close(); };
  const panel = h("div", { class: `lab-drawer lab-drawer--${side}`, role: "dialog", "aria-modal": "true", "aria-label": title },
    h("div", { class: "lab-drawer__head" },
      h("h2", { class: "lab-drawer__title" }, title),
      h("button", { class: "lab-drawer__x", "aria-label": "Close", onClick: close }, "✕")),
    h("div", { class: "lab-drawer__body" }, bodyNode));
  const overlay = h("div", { class: "lab-drawer-overlay", onClick: e => { if (e.target === overlay) close(); } }, panel);
  document.body.append(overlay);
  document.addEventListener("keydown", onKey);
  requestAnimationFrame(() => overlay.classList.add("is-in"));
  setTimeout(() => panel.querySelector(".lab-drawer__x")?.focus(), 40);
  return { close };
}

// Simple inline confirm-style popover replacement (non-destructive prototypes).
export function pill(text, cls = "") { return h("span", { class: `pill ${cls}` }, text); }

// Progress ring (SVG) reused by concepts that show a readiness score.
export function ring(pct, label, sub) {
  const r = 34, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
  const tone = pct >= 85 ? "var(--ok)" : pct >= 70 ? "var(--warn)" : "var(--danger)";
  return h("div", { class: "ring" },
    h("svg", { viewBox: "0 0 80 80", width: "80", height: "80", "aria-hidden": "true" },
      svg("circle", { cx: 40, cy: 40, r, fill: "none", stroke: "var(--line)", "stroke-width": 8 }),
      svg("circle", { cx: 40, cy: 40, r, fill: "none", stroke: tone, "stroke-width": 8, "stroke-linecap": "round",
        "stroke-dasharray": c, "stroke-dashoffset": off, transform: "rotate(-90 40 40)" }),
      svg("text", { x: 40, y: 45, "text-anchor": "middle", "font-size": 20, "font-weight": 700, fill: "var(--ink)" }, String(pct))),
    label && h("div", { class: "ring__label" }, h("strong", {}, label), sub && h("span", {}, sub)));
}
function svg(tag, attrs, ...kids) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  kids.flat().forEach(k => el.append(k.nodeType ? k : document.createTextNode(String(k))));
  return el;
}
export { svg };

// A reusable "needs attention" reason → human label + tone.
export const ATTN = {
  "rubric-incomplete": { label: "Rubric incomplete", tone: "danger" },
  "ai-review": { label: "AI draft — needs your OK", tone: "warn" },
  "verify-key": { label: "Answer key unverified", tone: "danger" },
  "alt-text": { label: "Missing alt text", tone: "warn" },
  "workload-high": { label: "Workload high", tone: "warn" },
};

export const ICON = { // sparse, meaningful icons only (unicode, no icon font)
  page: "▤", assignment: "✎", discussion: "❝", quiz: "◉", syllabus: "☰",
  ai: "✦", human: "✓", warn: "▲", start: "➜", final: "★",
};

export function itemGlyph(type) { return ICON[type] || "•"; }
