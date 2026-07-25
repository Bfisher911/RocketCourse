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

// Prototype CSS is loaded through Vite (the prototypes' own ensureCss uses
// lab-relative <link> paths that don't resolve here, so those stray links are a
// harmless no-op). These globs are deliberately NOT eager: ~67 kB of experience
// styling is meaningless until someone actually opens an experience, and eager
// globs put all of it in the single render-blocking stylesheet that every
// marketing visitor downloads. show() awaits the sheets before mounting, so the
// stage never paints unstyled.
const sharedCssLoaders = import.meta.glob("./prototypes/shared/*.css");
const conceptCssLoaders = import.meta.glob("./prototypes/concepts/*.css");

/** Shared prototype sheets (base/shell/blocks) — needed by every experience, loaded once. */
let sharedCssPromise: Promise<unknown> | null = null;
function loadSharedCss(): Promise<unknown> {
  sharedCssPromise ??= Promise.all(Object.values(sharedCssLoaders).map((load) => load()));
  return sharedCssPromise;
}

/** The one concept's sheet. Missing entry resolves rather than throwing — a
 * concept without its own CSS is valid, and styling must never break a mount. */
function loadConceptCss(prototypeKey: string): Promise<unknown> {
  return conceptCssLoaders[`./prototypes/concepts/${prototypeKey}.css`]?.() ?? Promise.resolve();
}

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
  /** Focus a content object by refId in the current experience (command palette). */
  focusRef(refId: string): boolean;
  /** Focus a module by id in the current experience (command palette). */
  focusModule(moduleId: string): boolean;
  rationale(experienceId: string): Promise<HTMLElement | null>;
  /** Stop the host: cancels any in-flight show and clears the stage. */
  dispose(): void;
}

interface ConceptApi {
  goToTask?: (n: number) => void;
  focusRef?: (refId: string) => void;
  focusModule?: (moduleId: string) => void;
}

export function createHost(stage: HTMLElement, ctx: WorkflowContext, onChange?: (c: WorkflowContext) => void): WorkflowHost {
  let current: { id: string; api: ConceptApi } | null = null;
  let disposed = false;
  // Monotonic token: every show() captures its value and, after the async
  // module load, bails if a newer show() started or the host was disposed.
  // Without this a StrictMode double-mount (or a rapid experience switch) races
  // the async load against the cleanup and appends a SECOND stage, which — being
  // as tall as the real one — steals the sticky rails' scroll travel.
  let showSeq = 0;

  async function show(experienceId: string) {
    const seq = ++showSeq;
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
    // Fetch the renderer and its styling together, and await BOTH before
    // mounting — otherwise the stage paints for a frame with no experience CSS.
    const [mod] = await Promise.all([
      load(),
      loadSharedCss(),
      loadConceptCss(exp.prototypeKey)
    ]);
    if (disposed || seq !== showSeq) return; // superseded during load — do not mount
    stage.innerHTML = ""; // clear anything a superseded show may have left
    const api: ConceptApi = mod.mount(stage, {
      go: (_hash: string) => { /* internal experience nav; context stays shared */ },
      onReady: () => api.goToTask?.(ctx.taskPointer),
    });
    current = { id: experienceId, api };
    // Restore the shared context pointer in the new experience — this is the
    // "switching preserves where you are" guarantee.
    api.goToTask?.(ctx.taskPointer);
  }

  function dispose() {
    disposed = true;
    showSeq += 1; // invalidate any in-flight show
    current = null;
    stage.innerHTML = "";
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

  /** Focus a content object (page/assignment/…) by refId in the current experience. */
  function focusRef(refId: string): boolean {
    if (current?.api.focusRef) { current.api.focusRef(refId); return true; }
    return false;
  }
  /** Focus a module in the current experience. */
  function focusModule(moduleId: string): boolean {
    if (current?.api.focusModule) { current.api.focusModule(moduleId); return true; }
    return false;
  }

  return { show, gotoTask, focusRef, focusModule, rationale, dispose };
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
