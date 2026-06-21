import { describe, expect, it } from "vitest";
import type { CourseProject } from "../types";
import { buildImsccZip, validateImsccZip } from "./imsccExport";
import {
  QUIZ_TEMPLATES,
  buildQuizQuestionTemplate,
  changeQuizModule,
  createQuiz,
  deleteQuiz,
  duplicateQuiz,
  restoreQuiz,
  validateQuizPlan
} from "./quizBuilder";
import { sampleProject } from "./courseGenerator";

const clone = (course: CourseProject): CourseProject => structuredClone(course);

const targetModuleFor = (course: CourseProject, sourceModuleId: string) => {
  const target = course.modules.find((module) => module.id !== sourceModuleId && module.kind === "content") ?? course.modules.find((module) => module.id !== sourceModuleId);
  expect(target).toBeDefined();
  return target!;
};

describe("quiz builder", () => {
  it("generates safe question templates for Canvas-supported question types", () => {
    const course = clone(sampleProject);
    const quiz = course.quizzes[0];

    expect(QUIZ_TEMPLATES).toHaveLength(10);
    QUIZ_TEMPLATES.forEach((template) => {
      const question = buildQuizQuestionTemplate(template.id, course, quiz, { questionId: `unit_${template.id}` });

      expect(question.type).toBe(template.type);
      expect(question.stem).not.toMatch(/<script|javascript:|\son[a-z]+\s*=/i);
      expect(question.points).toBeGreaterThan(0);
      if (question.type === "multiple_choice") {
        expect(question.choices?.length).toBeGreaterThanOrEqual(2);
        expect(question.choices).toContain(question.correctAnswer);
      }
      if (question.type === "true_false") {
        expect(question.choices).toEqual(["True", "False"]);
        expect(["True", "False"]).toContain(question.correctAnswer);
      }
    });
  });

  it("creates, duplicates, deletes, and restores quizzes with distinct module items", () => {
    const created = createQuiz(clone(sampleProject), {
      templateId: "application-scenario",
      quizId: "quiz_unit_created",
      timestamp: "2026-01-01T00:00:00.000Z"
    });
    const quiz = created.quizzes.find((item) => item.id === "quiz_unit_created");

    expect(quiz).toBeDefined();
    expect(created.modules.some((module) => module.items.some((item) => item.type === "quiz" && item.refId === "quiz_unit_created"))).toBe(true);
    expect(validateQuizPlan(created).issues.filter((issue) => issue.quizId === "quiz_unit_created" && issue.severity === "error")).toHaveLength(0);

    const duplicated = duplicateQuiz(created, "quiz_unit_created", { stamp: "unit", timestamp: "2026-01-01T00:00:00.000Z" });
    const copy = duplicated.quizzes.find((item) => item.id === "quiz_unit_created_copy_unit");
    expect(copy).toBeDefined();
    expect(copy?.questions[0].id).not.toBe(quiz?.questions[0].id);
    expect(duplicated.modules.some((module) => module.items.some((item) => item.type === "quiz" && item.refId === copy?.id))).toBe(true);

    const deleted = deleteQuiz(duplicated, copy!.id);
    expect(deleted.quizzes.some((item) => item.id === copy!.id)).toBe(false);
    expect(deleted.modules.some((module) => module.items.some((item) => item.refId === copy!.id))).toBe(false);

    const restored = restoreQuiz(deleted, copy!, "2026-01-01T00:00:00.000Z");
    expect(restored.quizzes.some((item) => item.id === copy!.id)).toBe(true);
    expect(restored.modules.some((module) => module.id === copy!.moduleId && module.items.some((item) => item.refId === copy!.id))).toBe(true);
  });

  it("keeps quiz module changes aligned with module items, schedule entries, and questions", () => {
    const course = clone(sampleProject);
    const quiz = course.quizzes[0];
    const target = targetModuleFor(course, quiz.moduleId);

    const moved = changeQuizModule(course, quiz.id, target.id, "2026-01-01T00:00:00.000Z");
    const moduleItems = moved.modules.flatMap((module) => module.items.filter((item) => item.type === "quiz" && item.refId === quiz.id).map((item) => ({ moduleId: module.id, item })));

    expect(moved.quizzes.find((item) => item.id === quiz.id)?.moduleId).toBe(target.id);
    expect(moved.quizzes.find((item) => item.id === quiz.id)?.questions.every((question) => question.moduleId === target.id)).toBe(true);
    expect(moduleItems).toHaveLength(1);
    expect(moduleItems[0].moduleId).toBe(target.id);
    moved.schedule.filter((entry) => entry.itemId === quiz.id).forEach((entry) => expect(entry.moduleId).toBe(target.id));
    expect(validateQuizPlan(moved).issues.filter((issue) => /module-mismatch/.test(issue.id))).toHaveLength(0);
  });

  it("flags invalid quiz metadata, questions, answer keys, and unsafe HTML", () => {
    const course = clone(sampleProject);
    const quiz = course.quizzes[0];
    course.quizzes = course.quizzes.map((item) =>
      item.id === quiz.id
        ? {
            ...item,
            title: "",
            purpose: '<p onclick="alert(1)">x</p>',
            points: 0,
            moduleId: "missing_module",
            assignmentGroupId: "missing_group",
            alignedOutcomeIds: [],
            questions: [
              {
                ...item.questions[0],
                stem: "<script>alert(1)</script>",
                choices: ["Only one"],
                correctAnswer: "Missing",
                points: 0,
                alignedOutcomeIds: [],
                moduleId: "wrong_module"
              }
            ]
          }
        : item
    );

    const ids = validateQuizPlan(course).issues.filter((issue) => issue.quizId === quiz.id).map((issue) => issue.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        `${quiz.id}-title`,
        `${quiz.id}-points`,
        `${quiz.id}-module`,
        `${quiz.id}-group`,
        `${quiz.id}-unsafe-purpose`,
        `${quiz.id}-${quiz.questions[0].id}-choices`,
        `${quiz.id}-${quiz.questions[0].id}-answer`,
        `${quiz.id}-${quiz.questions[0].id}-unsafe-html`,
        `${quiz.id}-${quiz.questions[0].id}-question-module`
      ])
    );
  });

  it("exports quiz QTI with escaped choices, answers, feedback, and validation failures for unsafe stems", async () => {
    const course = createQuiz(clone(sampleProject), {
      templateId: "concept-check",
      quizId: "quiz_export_created",
      timestamp: "2026-01-01T00:00:00.000Z"
    });
    const quiz = course.quizzes.find((item) => item.id === "quiz_export_created")!;
    quiz.questions[0] = {
      ...quiz.questions[0],
      stem: "Which option handles <tags> & evidence safely?",
      choices: ["Unsafe <script>", "Evidence & context", "Opinion only"],
      correctAnswer: "Evidence & context",
      correctFeedback: "Right & supported.",
      incorrectFeedback: "Review <module> examples."
    };

    const zip = await buildImsccZip(course);
    const qti = (await zip.file("non_cc_assessments/quiz_export_created.xml.qti")?.async("text")) ?? "";
    expect(qti).toContain("Which option handles &lt;tags&gt; &amp; evidence safely?");
    expect(qti).toContain("Evidence &amp; context");
    expect(qti).toContain(`<varequal respident="response_${quiz.questions[0].id}">${quiz.questions[0].id}_a2</varequal>`);
    expect(qti).toContain("Right &amp; supported.");

    const broken = clone(course);
    broken.quizzes = broken.quizzes.map((item) =>
      item.id === quiz.id ? { ...item, questions: item.questions.map((question) => ({ ...question, stem: `${question.stem}<script>alert(1)</script>` })) } : item
    );
    const report = await validateImsccZip(broken, await buildImsccZip(broken));
    expect(report.valid).toBe(false);
    expect(report.issues.some((issue) => issue.id.includes("quiz-quality") && issue.severity === "error")).toBe(true);
  });
});
