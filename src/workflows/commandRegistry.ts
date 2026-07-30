// Shared command layer (Phase 5). Every workflow experience — and the original
// editor — is driven from ONE command list, surfaced by the ⌘K palette. Content
// navigation routes through the current experience's focus handle (or, for W01,
// the editor's tab switch), so "Open Module 4" works wherever you are.

import type { CourseProject } from "../types";
import { experiencesByCode, getExperience } from "./experienceRegistry";

export type CommandGroup = "Experience" | "Navigate" | "Content" | "Actions";

export interface Command {
  id: string;
  group: CommandGroup;
  label: string;
  hint?: string;
  keywords: string;
  run: () => void;
}

export interface CommandContext {
  course: CourseProject;
  experienceId: string;
  isOriginal: boolean;
  chooseExperience: (id: string) => void;
  /** Focus a module in the current experience (host handle, or W01 tab). */
  focusModule: (moduleId: string) => void;
  /** Focus a content object by id in the current experience. */
  focusRef: (refId: string, type: string) => void;
  goDashboard: () => void;
  runValidation: () => void;
  download: () => void;
  canExport: boolean;
  openReview: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Original editor only: jump to a named tab. */
  setTab: (tab: string) => void;
}

const ORIGINAL_TABS = [
  "Overview", "Imagery", "Homepage", "Syllabus", "Modules", "Pages", "Interactions",
  "Assignments", "Discussions", "Quizzes", "Rubrics", "Gradebook Setup",
  "Contact Hours", "Theme", "Transform", "Export",
];

const TYPE_LABEL: Record<string, string> = {
  page: "Page", assignment: "Assignment", discussion: "Discussion", quiz: "Quiz",
};

export function buildCommands(ctx: CommandContext): Command[] {
  const cmds: Command[] = [];
  const c = ctx.course;

  // --- Experience switching (universal) ------------------------------------
  for (const exp of experiencesByCode()) {
    if (exp.id === ctx.experienceId || !exp.enabled) continue;
    cmds.push({
      id: `exp:${exp.id}`, group: "Experience",
      label: `Switch to ${exp.name}`, hint: exp.code,
      keywords: `${exp.code} ${exp.name} ${exp.bestFor} experience workflow switch`,
      run: () => ctx.chooseExperience(exp.id),
    });
  }

  // --- Navigate ------------------------------------------------------------
  cmds.push({
    id: "nav:dashboard", group: "Navigate", label: "Go to Dashboard",
    keywords: "dashboard home projects courses list", run: ctx.goDashboard,
  });
  if (ctx.isOriginal) {
    for (const tab of ORIGINAL_TABS) {
      cmds.push({
        id: `tab:${tab}`, group: "Navigate", label: `Go to ${tab}`, hint: "tab",
        keywords: `${tab} tab section editor`, run: () => ctx.setTab(tab),
      });
    }
  }

  // --- Content (modules + items) -------------------------------------------
  for (const m of c.modules) {
    const label = m.kind === "start" ? "Open Start Here" : `Open ${m.title}`;
    cmds.push({
      id: `mod:${m.id}`, group: "Content", label,
      hint: m.kind === "start" ? "module" : `module ${m.order}`,
      keywords: `${m.title} module ${m.order} ${m.kind} open`,
      run: () => ctx.focusModule(m.id),
    });
  }
  const contentSets: Array<[string, Array<{ id: string; title: string }>]> = [
    ["page", c.pages], ["assignment", c.assignments],
    ["discussion", c.discussions], ["quiz", c.quizzes],
  ];
  for (const [type, list] of contentSets) {
    for (const obj of list) {
      cmds.push({
        id: `ref:${obj.id}`, group: "Content",
        label: `Open ${obj.title}`, hint: TYPE_LABEL[type],
        keywords: `${obj.title} ${type} open item`,
        run: () => ctx.focusRef(obj.id, type),
      });
    }
  }

  // --- Actions -------------------------------------------------------------
  cmds.push({
    id: "act:validate", group: "Actions", label: "Run local validation",
    keywords: "validate check package export readiness", run: ctx.runValidation,
  });
  if (ctx.canExport) {
    cmds.push({
      id: "act:download", group: "Actions", label: "Download Canvas package (.imscc)",
      keywords: "download export imscc canvas package", run: ctx.download,
    });
  }
  cmds.push({
    id: "act:review", group: "Actions", label: "Open Review Mode",
    keywords: "review approve flag walk items", run: ctx.openReview,
  });
  if (ctx.canUndo) cmds.push({ id: "act:undo", group: "Actions", label: "Undo last change", hint: "⌘Z", keywords: "undo revert back", run: ctx.undo });
  if (ctx.canRedo) cmds.push({ id: "act:redo", group: "Actions", label: "Redo", hint: "⇧⌘Z", keywords: "redo forward", run: ctx.redo });

  return cmds;
}

/** Token filter: every whitespace-separated token must appear in the haystack.
 * Ranks by full-query prefix > word-start > contains, so exact intent wins. */
export function filterCommands(cmds: Command[], query: string): Command[] {
  const q = query.trim().toLowerCase();
  if (!q) return cmds;
  const tokens = q.split(/\s+/).filter(Boolean);
  const scored: Array<{ cmd: Command; score: number }> = [];
  for (const cmd of cmds) {
    const label = cmd.label.toLowerCase();
    const hay = (cmd.label + " " + cmd.keywords).toLowerCase();
    if (!tokens.every(t => hay.includes(t))) continue;
    let score = 1;
    if (label.startsWith(q)) score = 4;
    else if (new RegExp(`\\b${escapeRe(q)}`).test(label)) score = 3;
    else if (label.includes(q)) score = 2;
    scored.push({ cmd, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.cmd);
}

function escapeRe(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

/** Group id → tab for the original editor content jumps. */
export function typeToTab(type: string): string {
  return ({ page: "Pages", assignment: "Assignments", discussion: "Discussions", quiz: "Quizzes" } as Record<string, string>)[type] ?? "Modules";
}

export function getExperienceName(id: string): string {
  return getExperience(id)?.name ?? id;
}
