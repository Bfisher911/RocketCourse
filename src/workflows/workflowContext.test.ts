// @vitest-environment jsdom
//
// Persistence contracts are tested at the API level: the modules fall back to
// in-memory storage transparently when browser storage is unavailable (as in
// this environment), which is exactly the production-safety behavior we want.
import { describe, expect, it } from "vitest";
import {
  createContext,
  loadCoursePreferred,
  saveCoursePreferred,
  saveUserPreferred,
  loadUserPreferred,
} from "./workflowContext";
import { loadViewState, saveViewState } from "./adapterViewState";

const uid = () => `c-${Math.random().toString(36).slice(2, 10)}`;

describe("workflow preference persistence", () => {
  it("user preference is last-write-wins and readable back", () => {
    saveUserPreferred("course-map");
    expect(loadUserPreferred()).toBe("course-map");
    saveUserPreferred("wildcard");
    expect(loadUserPreferred()).toBe("wildcard");
  });

  it("per-course preferences are independent", () => {
    const a = uid();
    const b = uid();
    saveCoursePreferred(a, "wildcard");
    saveCoursePreferred(b, "task-command-center");
    expect(loadCoursePreferred(a)).toBe("wildcard");
    expect(loadCoursePreferred(b)).toBe("task-command-center");
    expect(loadCoursePreferred(uid())).toBeNull();
  });

  it("createContext starts at the shared task pointer 1", () => {
    const ctx = createContext("guided-journey");
    expect(ctx.experienceId).toBe("guided-journey");
    expect(ctx.taskPointer).toBe(1);
  });
});

describe("adapter view state", () => {
  it("persists per-course acknowledged sets and export flags", () => {
    const courseId = uid();
    const vs = loadViewState(courseId);
    expect(vs.acknowledged.size).toBe(0);
    vs.acknowledged.add("check-1");
    vs.validated = true;
    saveViewState(courseId, vs);
    const again = loadViewState(courseId);
    expect(again.acknowledged.has("check-1")).toBe(true);
    expect(again.validated).toBe(true);
    expect(again.fullContentGenerated).toBe(false);
    // a different course is untouched
    expect(loadViewState(uid()).acknowledged.size).toBe(0);
  });

  it("view state never appears on a CourseProject shape", () => {
    const courseId = uid();
    const vs = loadViewState(courseId);
    vs.fullContentGenerated = true;
    saveViewState(courseId, vs);
    // nothing here writes to a course; the adapter tests assert the same from
    // the other side (resolveIssue leaves course JSON identical)
    expect(Object.keys(vs).sort()).toEqual(["acknowledged", "fullContentGenerated", "validated"]);
  });
});
