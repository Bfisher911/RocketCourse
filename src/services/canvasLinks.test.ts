import { describe, expect, it } from "vitest";
import { sampleProject } from "./courseGenerator";
import {
  assignmentRef,
  canvasRefResolves,
  canvasRefTargets,
  discussionRef,
  fileRef,
  isCanvasRef,
  moduleRef,
  modulesIndexRef,
  parseCanvasRef,
  quizRef,
  webResourceHref,
  wikiPageRef
} from "./canvasLinks";

describe("canvasLinks", () => {
  it("builds the exact Canvas substitution tokens (not relative .html paths)", () => {
    expect(wikiPageRef("page_syllabus")).toBe("$WIKI_REFERENCE$/pages/page_syllabus");
    expect(assignmentRef("assignment_1")).toBe("$CANVAS_OBJECT_REFERENCE$/assignments/assignment_1");
    expect(quizRef("quiz_1")).toBe("$CANVAS_OBJECT_REFERENCE$/quizzes/quiz_1");
    expect(discussionRef("discussion_1")).toBe("$CANVAS_OBJECT_REFERENCE$/discussion_topics/discussion_1");
    expect(moduleRef("module_start")).toBe("$CANVAS_OBJECT_REFERENCE$/modules/module_start");
    expect(fileRef("course-banner.svg")).toBe("$IMS-CC-FILEBASE$/course-banner.svg");
    expect(webResourceHref("syllabus-printable.pdf")).toBe("../web_resources/syllabus-printable.pdf");
    expect(modulesIndexRef()).toBe("$CANVAS_COURSE_REFERENCE$/modules");
  });

  it("recognizes token hrefs and leaves real URLs alone", () => {
    expect(isCanvasRef("$WIKI_REFERENCE$/pages/page_syllabus")).toBe(true);
    expect(isCanvasRef("$IMS-CC-FILEBASE$/x.pdf")).toBe(true);
    expect(isCanvasRef("https://example.com")).toBe(false);
    expect(isCanvasRef("syllabus.html")).toBe(false);
  });

  it("parses tokens into kind + id, ignoring fragments and queries", () => {
    expect(parseCanvasRef("$WIKI_REFERENCE$/pages/page_syllabus")).toEqual({ token: "$WIKI_REFERENCE$", kind: "pages", id: "page_syllabus" });
    expect(parseCanvasRef("$CANVAS_OBJECT_REFERENCE$/assignments/a1?x=1")).toEqual({ token: "$CANVAS_OBJECT_REFERENCE$", kind: "assignments", id: "a1" });
    expect(parseCanvasRef("$IMS-CC-FILEBASE$/a.pdf#frag")).toEqual({ token: "$IMS-CC-FILEBASE$", kind: "file", id: "a.pdf" });
    expect(parseCanvasRef("syllabus.html")).toBeNull();
  });

  it("resolves token links against real course objects and flags missing ones", () => {
    const page = sampleProject.pages[0];
    const assignment = sampleProject.assignments[0];
    expect(canvasRefResolves(wikiPageRef(page.id), sampleProject)).toBe(true);
    expect(canvasRefResolves(assignmentRef(assignment.id), sampleProject)).toBe(true);
    expect(canvasRefResolves(wikiPageRef("page_does_not_exist"), sampleProject)).toBe(false);
    expect(canvasRefResolves(assignmentRef("assignment_nope"), sampleProject)).toBe(false);
    expect(canvasRefResolves(modulesIndexRef(), sampleProject)).toBe(true);
  });

  it("exposes every resolvable token target for the generated course", () => {
    const targets = canvasRefTargets(sampleProject);
    expect(targets.has(wikiPageRef("page_syllabus"))).toBe(true);
    expect(targets.has(modulesIndexRef())).toBe(true);
    sampleProject.assignments.forEach((assignment) => expect(targets.has(assignmentRef(assignment.id))).toBe(true));
  });

  it("guarantees the well-known nav pages exist so the homepage/syllabus links resolve", () => {
    const ids = new Set(sampleProject.pages.map((page) => page.id));
    ["page_syllabus", "page_course_success_guide", "page_course_calendar_workload_plan"].forEach((id) => expect(ids.has(id)).toBe(true));
  });
});
