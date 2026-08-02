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
  PREVIEW_IMAGE_PLACEHOLDER_SRC,
  quizRef,
  resolvePreviewImageSources,
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

describe("resolvePreviewImageSources", () => {
  it("swaps packaged-file img srcs (token, encoded token, web_resources) for the inline placeholder", () => {
    const html = [
      '<p><img src="$IMS-CC-FILEBASE$/quiz-icon.svg" alt="Quiz support icon" style="width: 74px;" /></p>',
      '<img src="%24IMS-CC-FILEBASE%24/media/module-01.png" alt="Module image">',
      "<img src='../web_resources/course-banner.svg' alt='Banner'>",
      '<img class="x" src="web_resources/handout.png" alt="Handout">'
    ].join("");
    const out = resolvePreviewImageSources(html);
    expect(out).not.toContain("$IMS-CC-FILEBASE$");
    expect(out).not.toContain("%24IMS-CC-FILEBASE%24");
    expect(out).not.toContain("web_resources/");
    expect(out.match(new RegExp(PREVIEW_IMAGE_PLACEHOLDER_SRC.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))?.length).toBe(4);
    // Alt text and other attributes survive the swap.
    expect(out).toContain('alt="Quiz support icon"');
    expect(out).toContain('class="x"');
  });

  it("leaves resolvable and data-URI img srcs untouched, and never rewrites hrefs", () => {
    const html =
      '<img src="data:image/svg+xml,abc" alt=""><img src="https://example.com/x.png" alt=""><a href="$IMS-CC-FILEBASE$/handout.pdf">Handout</a>';
    expect(resolvePreviewImageSources(html)).toBe(html);
  });

  it("produces a browser-renderable data URI", () => {
    expect(PREVIEW_IMAGE_PLACEHOLDER_SRC.startsWith("data:image/svg+xml,")).toBe(true);
    expect(decodeURIComponent(PREVIEW_IMAGE_PLACEHOLDER_SRC.slice("data:image/svg+xml,".length))).toContain("Shown after Canvas import");
  });
});
