// Workflow Host (Phase 4/6, foundation).
// Given an experience id, mounts the corresponding experience renderer over the
// SHARED course state and restores the shared context pointer, so switching
// experiences never changes content and keeps the user's place.
//
// Foundation note: experience renderers are the eight verified prototypes,
// brought in under ./prototypes. They share one mutable course (`session` in
// prototypes/shared/blocks.js) — which is exactly the "one course, many
// experiences" seam. A later slice replaces that seam with an adapter over the
// real CourseProject; the Host API below does not change when it does.

import { getExperience } from "./experienceRegistry";
import type { WorkflowContext } from "./workflowContext";

// Vite: eagerly inject all prototype CSS (the prototypes' own ensureCss uses
// lab-relative <link> paths that don't resolve here; importing via Vite applies
// the styles properly and makes those stray links a harmless no-op).
import.meta.glob("./prototypes/shared/*.css", { eager: true });
import.meta.glob("./prototypes/concepts/*.css", { eager: true });

type ConceptModule = {
  mount: (stage: HTMLElement, ctx: any) => { goToTask?: (n: number) => void };
  rationale?: () => HTMLElement;
};
const conceptLoaders = import.meta.glob("./prototypes/concepts/*.js") as Record<
  string,
  () => Promise<ConceptModule>
>;

function loaderFor(prototypeKey: string): (() => Promise<ConceptModule>) | null {
  const path = `./prototypes/concepts/${prototypeKey}.js`;
  return conceptLoaders[path] ?? null;
}

export interface WorkflowHost {
  /** Switch to an experience, preserving the shared context pointer. */
  show(experienceId: string): Promise<void>;
  /** Move the shared context pointer within the current experience (no remount). */
  gotoTask(n: number): void;
  rationale(experienceId: string): Promise<HTMLElement | null>;
}

export function createHost(stage: HTMLElement, ctx: WorkflowContext, onChange?: (c: WorkflowContext) => void): WorkflowHost {
  let current: { id: string; api: { goToTask?: (n: number) => void } } | null = null;

  async function show(experienceId: string) {
    const exp = getExperience(experienceId);
    ctx.experienceId = experienceId;
    onChange?.(ctx);
    stage.innerHTML = "";

    if (!exp || exp.prototypeKey === null) {
      // W01 Original — the real app. Not re-mounted here; link out to it.
      stage.append(originalPlaceholder());
      current = null;
      return;
    }
    const load = loaderFor(exp.prototypeKey);
    if (!load) { stage.append(errorPanel(`No renderer for ${experienceId}`)); return; }
    const mod = await load();
    const api = mod.mount(stage, {
      go: (_hash: string) => { /* internal experience nav; context stays shared */ },
      onReady: () => api.goToTask?.(ctx.taskPointer),
    });
    current = { id: experienceId, api };
    // Restore the shared context pointer in the new experience — this is the
    // "switching preserves where you are" guarantee.
    api.goToTask?.(ctx.taskPointer);
  }

  async function rationale(experienceId: string) {
    const exp = getExperience(experienceId);
    if (!exp || exp.prototypeKey === null) return null;
    const load = loaderFor(exp.prototypeKey);
    if (!load) return null;
    const mod = await load();
    return mod.rationale?.() ?? null;
  }

  function gotoTask(n: number) {
    ctx.taskPointer = n;
    onChange?.(ctx);
    if (current?.api.goToTask) current.api.goToTask(n);
    else void show(ctx.experienceId);
  }

  return { show, gotoTask, rationale };
}

function originalPlaceholder(): HTMLElement {
  const el = document.createElement("div");
  el.className = "rc-host-original rc-grid-bg";
  el.innerHTML = `
    <div class="rc-host-original__panel">
      <div class="rc-code">W01</div>
      <h2>Original RocketCourse workflow</h2>
      <p>The current tabbed editor is preserved unchanged and remains the live app. In the
      integrated build this pane loads the existing editor over the same shared course; in this
      foundation preview it is represented as a registered experience so switching parity is visible.</p>
      <a class="rc-btn rc-btn--ghost" href="/" >Open the current app →</a>
    </div>`;
  return el;
}
function errorPanel(msg: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "rc-host-error";
  el.textContent = msg;
  return el;
}
