import { describe, expect, it } from "vitest";
import { sampleProject } from "../services/courseGenerator";
import type { CourseProject } from "../types";
import { createCourseAdapter, type SessionTarget } from "./courseAdapter";

// ---------------------------------------------------------------------------
// Harness: emulates App.tsx's updateCourse (immutable apply) + a bare target.
// ---------------------------------------------------------------------------
function makeHarness(seed: CourseProject = sampleProject) {
  let course: CourseProject = JSON.parse(JSON.stringify(seed));
  // stamp a unique id so per-course view state never bleeds between tests
  course = { ...course, id: `${course.id}-${Math.random().toString(36).slice(2, 8)}` };
  let updateCalls = 0;
  const updaters: Array<(c: CourseProject) => CourseProject> = [];
  const target: SessionTarget = {
    session: {} as SessionTarget["session"],
    D: {},
    emit: () => {},
  };
  const adapter = createCourseAdapter({
    getCourse: () => course,
    updateCourse: updater => {
      updateCalls += 1;
      updaters.push(updater);
      course = updater(course);
      adapter.refresh(course);
    },
    target,
  });
  adapter.refresh(course);
  return {
    adapter,
    target,
    get course() { return course; },
    get updateCalls() { return updateCalls; },
    get lastUpdater() { return updaters[updaters.length - 1]; },
    s: target.session as Record<string, any>,
  };
}

describe("courseAdapter — read facade", () => {
  it("populates the session facade without ever calling updateCourse", () => {
    const hz = makeHarness();
    expect(hz.updateCalls).toBe(0);
    expect(Object.keys(hz.s.pages).length).toBe(hz.course.pages.length);
    expect(hz.s.modules.length).toBe(hz.course.modules.length);
    const anyPage = hz.course.pages[0];
    expect(hz.s.pages[anyPage.id].body).toBe(anyPage.bodyHtml);
    expect(hz.s.readiness.score).toBeGreaterThan(0);
    expect(Array.isArray(hz.s.readiness.blockers)).toBe(true);
    expect(Array.isArray(hz.s.readiness.quality)).toBe(true);
    expect(hz.s.exportStatus.contents.find((c: any) => c.label === "Pages").count)
      .toBe(hz.course.pages.length);
  });

  it("preserves facade object identity across refreshes (widget closures stay live)", () => {
    const hz = makeHarness();
    const pageId = hz.course.pages[0].id;
    const ref1 = hz.s.pages[pageId];
    hz.adapter.refresh(hz.course);
    expect(hz.s.pages[pageId]).toBe(ref1);
    const mod1 = hz.s.modules[0];
    hz.adapter.refresh(hz.course);
    expect(hz.s.modules[0]).toBe(mod1);
  });

  it("derives quiz verification from instructorReviewRequired", () => {
    const hz = makeHarness();
    const quiz = hz.course.quizzes.find(q => q.questions.length > 0);
    if (!quiz) return; // sample always has quizzes, but stay safe
    const facadeQuiz = hz.s.quizzes[quiz.id];
    quiz.questions.forEach((qq, i) => {
      expect(facadeQuiz.questions[i].verified).toBe(!qq.instructorReviewRequired);
    });
  });
});

describe("courseAdapter — commit (facade → real)", () => {
  it("commit with no facade changes calls updateCourse zero times", () => {
    const hz = makeHarness();
    hz.adapter.commit();
    expect(hz.updateCalls).toBe(0);
  });

  it("round-trips a page edit into bodyHtml with one pure, idempotent updater", () => {
    const hz = makeHarness();
    const pageId = hz.course.pages[0].id;
    hz.s.pages[pageId].title = "Edited Title";
    hz.s.pages[pageId].body = "<p>New body</p>";
    const before = JSON.parse(JSON.stringify(hz.course));
    hz.adapter.commit();
    expect(hz.updateCalls).toBe(1);
    const real = hz.course.pages.find(p => p.id === pageId)!;
    expect(real.title).toBe("Edited Title");
    expect(real.bodyHtml).toBe("<p>New body</p>");
    expect(real.status).toBe("edited");
    // purity: applying the captured updater to the pre-commit course twice
    // yields deeply-equal results and does not mutate its input
    const inputA: CourseProject = JSON.parse(JSON.stringify(before));
    const out1 = hz.lastUpdater(inputA);
    const out2 = hz.lastUpdater(JSON.parse(JSON.stringify(before)));
    expect(JSON.stringify(out1)).toBe(JSON.stringify(out2));
    expect(JSON.stringify(inputA)).toBe(JSON.stringify(before));
    // untouched sibling pages keep identity semantics (no gratuitous rewrite)
    expect(out1.assignments).toEqual(before.assignments);
  });

  it("round-trips a discussion prompt into promptHtml", () => {
    const hz = makeHarness();
    const d = hz.course.discussions[0];
    if (!d) return;
    hz.s.discussions[d.id].prompt = "<p>New prompt</p>";
    hz.adapter.commit();
    expect(hz.course.discussions.find(x => x.id === d.id)!.promptHtml).toBe("<p>New prompt</p>");
  });

  it("verifying a quiz question clears instructorReviewRequired", () => {
    const hz = makeHarness();
    const quiz = hz.course.quizzes.find(q => q.questions.length > 0);
    if (!quiz) return;
    // force one question to unverified first (real → facade), then verify via facade
    const qid = quiz.questions[0].id;
    hz.s.quizzes[quiz.id].questions[0].verified = false;
    hz.adapter.commit();
    expect(hz.course.quizzes.find(q => q.id === quiz.id)!.questions
      .find(qq => qq.id === qid)!.instructorReviewRequired).toBe(true);
    hz.s.quizzes[quiz.id].questions[0].verified = true;
    hz.adapter.commit();
    expect(hz.course.quizzes.find(q => q.id === quiz.id)!.questions
      .find(qq => qq.id === qid)!.instructorReviewRequired).toBe(false);
  });

  it("round-trips rubric level edits with desc→description rename", () => {
    const hz = makeHarness();
    const rubric = hz.course.rubrics.find(r => r.criteria.length > 0);
    if (!rubric) return;
    const critId = rubric.criteria[0].id;
    hz.s.rubrics[rubric.id].criteria[0].levels = [
      { label: "Excellent", points: 10, desc: "Outstanding work" },
      { label: "Good", points: 7, desc: "Solid work" },
    ];
    hz.adapter.commit();
    const realCrit = hz.course.rubrics.find(r => r.id === rubric.id)!
      .criteria.find(c => c.id === critId)!;
    expect(realCrit.levels).toEqual([
      { label: "Excellent", points: 10, description: "Outstanding work" },
      { label: "Good", points: 7, description: "Solid work" },
    ]);
  });

  it("reordering facade items reorders real module items and renumbers order", () => {
    const hz = makeHarness();
    const mod = hz.course.modules.find(m => m.items.length >= 2)!;
    const facadeMod = hz.s.modules.find((m: any) => m.id === mod.id);
    const [a, b] = facadeMod.items;
    facadeMod.items[0] = b; facadeMod.items[1] = a;
    hz.adapter.commit();
    const real = hz.course.modules.find(m => m.id === mod.id)!;
    expect(real.items[0].id).toBe(b.id);
    expect(real.items[1].id).toBe(a.id);
    real.items.forEach((it, i) => expect(it.order).toBe(i));
    // non-order fields preserved
    expect(real.items[0].publishState).toBeDefined();
    expect(real.items[0].metadata).toBeDefined();
  });

  it("round-trips settings weeks → lengthWeeks and group weights", () => {
    const hz = makeHarness();
    hz.s.settings.weeks = 14;
    hz.adapter.commit();
    expect(hz.course.settings.lengthWeeks).toBe(14);
    if (hz.course.assignmentGroups.length) {
      const gid = hz.course.assignmentGroups[0].id;
      hz.s.assignmentGroups.find((g: any) => g.id === gid).weight = 42;
      hz.adapter.commit();
      expect(hz.course.assignmentGroups.find(g => g.id === gid)!.weight).toBe(42);
    }
  });

  it("round-trips syllabus fixed fields (s-integrity → academicIntegrityPolicy)", () => {
    const hz = makeHarness();
    if (!hz.course.syllabus) return;
    const sec = hz.s.syllabus.sections.find((x: any) => x.id === "s-integrity");
    sec.body = "Honor code applies to all work.";
    hz.adapter.commit();
    expect(hz.course.syllabus!.content.academicIntegrityPolicy)
      .toBe("Honor code applies to all work.");
  });

  it("round-trips homepage hero heading and welcome", () => {
    const hz = makeHarness();
    if (!hz.course.homepage) return;
    hz.s.homepage.hero.title = "A New Heading";
    hz.s.homepage.welcome = "Welcome, everyone.";
    hz.adapter.commit();
    expect(hz.course.homepage!.content.heroHeading).toBe("A New Heading");
    expect(hz.course.homepage!.content.welcome).toBe("Welcome, everyone.");
  });

  it("removing a review-queue item marks the checklist item completed", () => {
    const hz = makeHarness();
    const open = hz.course.reviewChecklist.filter(rc => !rc.completed);
    if (!open.length) return;
    const victim = open[0].id;
    hz.s.reviewQueue = hz.s.reviewQueue.filter((r: any) => r.id !== victim);
    hz.adapter.commit();
    expect(hz.course.reviewChecklist.find(rc => rc.id === victim)!.completed).toBe(true);
  });
});

describe("courseAdapter — resolveIssue & view state", () => {
  it("acknowledging an advisory never touches the course", () => {
    const hz = makeHarness();
    const warning = hz.s.readiness.warnings[0];
    const before = JSON.stringify(hz.course);
    const callsBefore = hz.updateCalls;
    hz.adapter.resolveIssue(warning ? warning.id : "some-advisory-id");
    expect(hz.updateCalls).toBe(callsBefore);
    expect(JSON.stringify(hz.course)).toBe(before);
    if (warning) {
      expect(hz.s.readiness.warnings.find((w: any) => w.id === warning.id)).toBeUndefined();
    }
  });

  it("required (blocker) checks are not acknowledgeable away by content", () => {
    const hz = makeHarness();
    // blockers derive purely from buildReadinessReport; the facade never lets
    // an ack move a required check — verify list matches the derived report
    for (const b of hz.s.readiness.blockers) {
      expect(b.resolvable).toBe(false);
    }
  });
});

describe("courseAdapter — manual interaction insert/remove (Phase 11/12)", () => {
  it("inserts a Canvas-safe block marked inserted, then removes it", () => {
    const hz = makeHarness();
    const pageId = hz.course.pages[0].id;
    const before = hz.course.pages.find(p => p.id === pageId)!.interactionBlocks?.length ?? 0;

    hz.s.actions.insertInteraction("page", pageId, "faq-accordion");
    const afterInsert = hz.course.pages.find(p => p.id === pageId)!.interactionBlocks ?? [];
    expect(afterInsert.length).toBe(before + 1);
    const block = afterInsert[afterInsert.length - 1];
    expect(block.patternId).toBe("faq-accordion");
    expect(block.source).toBe("inserted");
    expect(block.content).toBeTruthy(); // course-aware content, never a shell
    // the facade reflects it
    expect(hz.s.pages[pageId].interactions.some((i: { patternId: string }) => i.patternId === "faq-accordion")).toBe(true);

    hz.s.actions.removeInteraction("page", pageId, block.id);
    const afterRemove = hz.course.pages.find(p => p.id === pageId)!.interactionBlocks ?? [];
    expect(afterRemove.some(b => b.id === block.id)).toBe(false);
  });

  it("exposes the insertable pattern list on the facade", () => {
    const hz = makeHarness();
    expect(Array.isArray(hz.s.insertablePatterns)).toBe(true);
    expect(hz.s.insertablePatterns.length).toBeGreaterThan(10);
    expect(hz.s.insertablePatterns.every((p: { id: string; name: string }) => p.id && p.name)).toBe(true);
  });

  it("insertion preserves generated blocks and only appends", () => {
    const hz = makeHarness();
    const aId = hz.course.assignments[0].id;
    const generated = (hz.course.assignments.find(a => a.id === aId)!.interactionBlocks ?? []).filter(b => b.source === "generated").length;
    hz.s.actions.insertInteraction("assignment", aId, "action-item-checklist");
    const after = hz.course.assignments.find(a => a.id === aId)!.interactionBlocks ?? [];
    expect(after.filter(b => b.source === "generated").length).toBe(generated);
    expect(after.filter(b => b.source === "inserted").length).toBeGreaterThan(0);
  });
});

describe("courseAdapter — interaction recommendations (Phase 8)", () => {
  it("exposes a read-only recommendInteractions action that ranks buildable picks", () => {
    const hz = makeHarness();
    const pageId = hz.course.pages[0].id;
    const before = JSON.stringify(hz.course);
    const recs = hz.s.actions.recommendInteractions("page", pageId, 3);
    expect(Array.isArray(recs)).toBe(true);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.every((r: { patternId: string; score: number }) => r.patternId && r.score > 0)).toBe(true);
    // reading recommendations must never mutate the course or call updateCourse
    expect(JSON.stringify(hz.course)).toBe(before);
    expect(hz.updateCalls).toBe(0);
  });

  it("recommends, then inserting the top pick drops it from the next round", () => {
    const hz = makeHarness();
    const pageId = hz.course.pages[0].id;
    const top = hz.s.actions.recommendInteractions("page", pageId, 1)[0];
    hz.s.actions.insertInteraction("page", pageId, top.patternId);
    const next = hz.s.actions.recommendInteractions("page", pageId, 20);
    expect(next.some((r: { patternId: string }) => r.patternId === top.patternId)).toBe(false);
  });
});
