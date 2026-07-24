import { describe, expect, it, vi } from "vitest";
import { sampleProject } from "../services/courseGenerator";
import { buildCommands, filterCommands, typeToTab, type CommandContext } from "./commandRegistry";

function makeCtx(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    course: sampleProject,
    experienceId: "course-map",
    isOriginal: false,
    chooseExperience: vi.fn(),
    focusModule: vi.fn(),
    focusRef: vi.fn(),
    goDashboard: vi.fn(),
    runValidation: vi.fn(),
    download: vi.fn(),
    canExport: true,
    openReview: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: true,
    canRedo: false,
    setTab: vi.fn(),
    ...overrides,
  };
}

describe("command registry", () => {
  it("offers switching to the other eight experiences, not the current one", () => {
    const cmds = buildCommands(makeCtx({ experienceId: "course-map" }));
    const exp = cmds.filter(c => c.group === "Experience");
    expect(exp).toHaveLength(8);
    expect(exp.some(c => c.id === "exp:course-map")).toBe(false);
    expect(exp.some(c => c.id === "exp:guided-journey")).toBe(true);
  });

  it("includes a Content command for every module and content item", () => {
    const ctx = makeCtx();
    const cmds = buildCommands(ctx);
    const content = cmds.filter(c => c.group === "Content");
    const expected = ctx.course.modules.length + ctx.course.pages.length +
      ctx.course.assignments.length + ctx.course.discussions.length + ctx.course.quizzes.length;
    expect(content).toHaveLength(expected);
  });

  it("routes a module command to focusModule and an item command to focusRef", () => {
    const ctx = makeCtx();
    const cmds = buildCommands(ctx);
    cmds.find(c => c.id === `mod:${ctx.course.modules[0].id}`)!.run();
    expect(ctx.focusModule).toHaveBeenCalledWith(ctx.course.modules[0].id);
    const page = ctx.course.pages[0];
    cmds.find(c => c.id === `ref:${page.id}`)!.run();
    expect(ctx.focusRef).toHaveBeenCalledWith(page.id, "page");
  });

  it("adds editor tab commands only for the original workflow", () => {
    expect(buildCommands(makeCtx({ isOriginal: false })).some(c => c.id === "tab:Pages")).toBe(false);
    const orig = buildCommands(makeCtx({ isOriginal: true }));
    expect(orig.some(c => c.id === "tab:Pages")).toBe(true);
    expect(orig.some(c => c.id === "tab:Export")).toBe(true);
  });

  it("gates actions on capability flags", () => {
    expect(buildCommands(makeCtx({ canExport: false })).some(c => c.id === "act:download")).toBe(false);
    expect(buildCommands(makeCtx({ canUndo: false })).some(c => c.id === "act:undo")).toBe(false);
    expect(buildCommands(makeCtx({ canRedo: true })).some(c => c.id === "act:redo")).toBe(true);
  });

  it("filters by all tokens and ranks label-prefix matches first", () => {
    const cmds = buildCommands(makeCtx());
    const switchStory = filterCommands(cmds, "switch storyboard");
    expect(switchStory[0]?.label).toBe("Switch to Visual Storyboard");
    // multi-token requires every token present
    expect(filterCommands(cmds, "zzzz nope")).toHaveLength(0);
    // empty query returns everything
    expect(filterCommands(cmds, "").length).toBe(cmds.length);
  });

  it("maps content types to the correct original-editor tab", () => {
    expect(typeToTab("page")).toBe("Pages");
    expect(typeToTab("assignment")).toBe("Assignments");
    expect(typeToTab("quiz")).toBe("Quizzes");
    expect(typeToTab("unknown")).toBe("Modules");
  });
});
