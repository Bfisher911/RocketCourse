// Standalone dev entry for the nine-workflow foundation preview.
// Runs at /workflows.html WITHOUT touching the existing app (App.tsx, routing,
// generation, export are all untouched). It proves the foundation architecture:
// a typed registry, a Units-styled Experience Selector, and a Workflow Host that
// renders any experience over ONE shared course while preserving context.

import "../design-system/tokens/rc-tokens.css";
import "./workflow-shell.css";
import { createHost } from "./host";
import { openSelector } from "./selector";
import {
  DEFAULT_EXPERIENCE_ID, getExperience, resolveExperienceId,
} from "./experienceRegistry";
import {
  createContext, loadUserPreferred, loadCoursePreferred, saveCoursePreferred,
} from "./workflowContext";

const DEMO_COURSE = { id: "mol-12", title: "The Meaning of Life in 12 Conversations", code: "PHIL 1200" };
const SHARED_TASKS = [
  "Start", "Sources", "Configure", "Blueprint", "Course change", "Module 4",
  "Edit page", "Assignment", "Reorder", "Readiness", "Preview", "Export",
];

const root = document.getElementById("rc-workflows-root")!;
const initialId = resolveExperienceId(loadCoursePreferred(DEMO_COURSE.id), loadUserPreferred());
const ctx = createContext(initialId || DEFAULT_EXPERIENCE_ID);

const shell = el("div", "rc-app", { "data-rc-ds": "" });
const utility = el("div", "rc-utility");
const nav = el("nav", "rc-tasknav");
const stage = el("div", "rc-stage");
shell.append(utility, nav, stage);
root.append(shell);

const host = createHost(stage, ctx, () => renderUtility());

function renderUtility() {
  utility.innerHTML = "";
  const exp = getExperience(ctx.experienceId);
  utility.append(
    seg("Course", DEMO_COURSE.title),
    seg("Workflow", `${exp?.code} · ${exp?.name}`),
    seg("Autosave", "Saved", "ok"),
    seg("Readiness", "Review · 78", "warn"),
    spacer(),
    action("Change experience", "primary", openExperienceSelector),
  );
}

function renderTaskNav() {
  nav.innerHTML = "";
  const lead = el("span", "rc-tasknav__lead");
  lead.textContent = "Shared context";
  nav.append(lead);
  SHARED_TASKS.forEach((label, i) => {
    const n = i + 1;
    const b = el("button", "rc-tasktile" + (ctx.taskPointer === n ? " is-on" : ""));
    b.innerHTML = `<span class="rc-tasktile__n">${String(n).padStart(2, "0")}</span>${label}`;
    b.setAttribute("aria-current", ctx.taskPointer === n ? "true" : "false");
    b.addEventListener("click", () => { host.gotoTask(n); markTask(n); });
    nav.append(b);
  });
}
function markTask(n: number) {
  nav.querySelectorAll(".rc-tasktile").forEach((t, i) =>
    t.classList.toggle("is-on", i + 1 === n));
}

function openExperienceSelector() {
  const overlay = openSelector({
    currentId: () => ctx.experienceId,
    onUse: id => { saveCoursePreferred(DEMO_COURSE.id, id); overlay.remove(); switchTo(id); },
    onDemo: id => { overlay.remove(); switchTo(id); },
    onClose: () => overlay.remove(),
  });
  document.body.append(overlay);
}

async function switchTo(id: string) {
  await host.show(id);          // preserves ctx.taskPointer across the switch
  renderUtility();
  markTask(ctx.taskPointer);
}

// boot
renderUtility();
renderTaskNav();
void host.show(ctx.experienceId);

// --- tiny DOM helpers (no framework in this foundation entry) ---------------
function el(tag: string, className?: string, attrs?: Record<string, string>): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (attrs) for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}
function seg(label: string, value: string, tone?: "ok" | "warn"): HTMLElement {
  const s = el("div", "rc-useg" + (tone ? ` rc-useg--${tone}` : ""));
  s.innerHTML = `<span class="rc-useg__k">${label}</span><span class="rc-useg__v">${value}</span>`;
  return s;
}
function spacer(): HTMLElement { return el("div", "rc-spacer"); }
function action(label: string, kind: string, onClick: () => void): HTMLElement {
  const b = el("button", `rc-btn rc-btn--${kind} rc-btn--sm`);
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}
