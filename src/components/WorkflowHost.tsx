// WorkflowHost — mounts a non-legacy workflow experience (W02–W09) over the
// REAL course. The experience renderers are framework-light DOM modules; this
// component owns their lifecycle and binds them to the CourseProject through
// the CourseAdapter, so every edit flows through App's updateCourse (undo,
// autosave, and project-list sync included) and switching experiences never
// touches course content.

import { useEffect, useRef } from "react";
import type { CourseProject } from "../types";
import { createCourseAdapter, type CourseAdapter } from "../workflows/courseAdapter";
import { createHost, type WorkflowHost as HostApi } from "../workflows/host";
import { createContext as createWorkflowContext, type WorkflowContext } from "../workflows/workflowContext";
import { getBindTarget } from "../workflows/prototypes/shared/blocks.js";
import "../design-system/tokens/rc-tokens.css";
import "../workflows/workflow-shell.css";

export interface WorkflowFocusHandle {
  focusRef: (refId: string) => boolean;
  focusModule: (moduleId: string) => boolean;
}

interface WorkflowHostProps {
  course: CourseProject;
  experienceId: string;
  onUpdateCourse: (updater: (current: CourseProject) => CourseProject) => void;
  onRunValidation: () => void;
  onDownload: () => void;
  onFillFullContent: () => void;
  /** Receives the current experience's focus handle (for the command palette). */
  onFocusHandle?: (handle: WorkflowFocusHandle | null) => void;
}

export function WorkflowHost(props: WorkflowHostProps) {
  const hostElRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const courseRef = useRef(props.course);
  courseRef.current = props.course;
  // Callbacks can change identity between renders; keep refs so the adapter
  // hooks installed at mount always call the latest.
  const actionsRef = useRef({
    runValidation: props.onRunValidation,
    download: props.onDownload,
    fill: props.onFillFullContent,
    updateCourse: props.onUpdateCourse,
  });
  actionsRef.current = {
    runValidation: props.onRunValidation,
    download: props.onDownload,
    fill: props.onFillFullContent,
    updateCourse: props.onUpdateCourse,
  };

  const adapterRef = useRef<CourseAdapter | null>(null);
  const hostRef = useRef<HostApi | null>(null);
  const ctxRef = useRef<WorkflowContext | null>(null);

  // Mount once per course identity: bind adapter → session, create the host.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const adapter = createCourseAdapter({
      getCourse: () => courseRef.current,
      updateCourse: updater => actionsRef.current.updateCourse(updater),
      target: getBindTarget(),
      hooks: {
        runValidation: () => actionsRef.current.runValidation(),
        download: () => actionsRef.current.download(),
        generateFullContent: () => actionsRef.current.fill(),
      },
    });
    adapter.refresh(courseRef.current);
    const ctx = createWorkflowContext(props.experienceId);
    const host = createHost(stage, ctx);
    adapterRef.current = adapter;
    hostRef.current = host;
    ctxRef.current = ctx;
    props.onFocusHandle?.({ focusRef: host.focusRef, focusModule: host.focusModule });
    void host.show(ctx.experienceId);
    return () => {
      props.onFocusHandle?.(null);
      host.dispose();
      adapter.dispose();
      adapterRef.current = null;
      hostRef.current = null;
      ctxRef.current = null;
      stage.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.course.id]);

  // Switch experience in place — the shared context pointer is preserved.
  useEffect(() => {
    const host = hostRef.current;
    const ctx = ctxRef.current;
    if (host && ctx && ctx.experienceId !== props.experienceId) {
      void host.show(props.experienceId);
    }
  }, [props.experienceId]);

  // React → renderers: refresh the facade whenever the course object changes
  // (undo, autosave round-trips, edits made elsewhere).
  useEffect(() => {
    adapterRef.current?.refresh(props.course);
  }, [props.course]);

  // Keep each experience's sticky rails pinned exactly beneath the persistent
  // header stack (app topbar + workspace chrome). Measured live so the pin stays
  // correct as the chrome wraps at narrow widths — no magic constant to drift.
  // Below 760px the chrome is static (CSS), so we leave --rc-chrome-offset to the
  // media-query's 0 and skip measurement.
  useEffect(() => {
    const hostEl = hostElRef.current;
    if (!hostEl || typeof ResizeObserver === "undefined") return;
    const topbar = document.querySelector<HTMLElement>(".topbar");
    const chrome = document.querySelector<HTMLElement>(".rc-xchrome");
    const apply = () => {
      if (window.innerWidth <= 760) { hostEl.style.removeProperty("--rc-chrome-offset"); return; }
      const stack = (topbar?.offsetHeight ?? 70) + (chrome?.offsetHeight ?? 64);
      hostEl.style.setProperty("--rc-chrome-offset", `${stack}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    if (topbar) ro.observe(topbar);
    if (chrome) ro.observe(chrome);
    window.addEventListener("resize", apply);
    return () => { ro.disconnect(); window.removeEventListener("resize", apply); };
  }, [props.experienceId]);

  return (
    <div data-rc-ds className="rc-workflow-host" ref={hostElRef}>
      <div ref={stageRef} className="rc-workflow-stage" />
    </div>
  );
}
