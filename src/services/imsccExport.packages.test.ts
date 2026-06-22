import { describe, expect, it } from "vitest";
import { defaultSettings } from "../data/defaultSettings";
import type { CourseProject, CourseSettings } from "../types";
import { generateCourseProject, sampleProject } from "./courseGenerator";
import { buildImsccZip, validateImsccZip } from "./imsccExport";

// Settings matrix covering the export paths most likely to break Canvas import:
// organization patterns, quiz/discussion frequencies, assignment cadences,
// final-project scaffolding, quiz difficulty (drives the essay-question path),
// and scheduled due dates.
const matrix: Array<{ name: string; prompt: string; settings: CourseSettings }> = [
  {
    name: "weeks-every-module-scheduled",
    prompt: "Build me a 4-week professional course on Community Health Program Design.",
    settings: {
      ...defaultSettings,
      courseLengthPreset: "4-weeks",
      lengthWeeks: 4,
      moduleCount: 4,
      organizationPattern: "weeks",
      assignmentCadence: "every-module",
      quizFrequency: "module",
      discussionFrequency: "module",
      schedule: {
        ...defaultSettings.schedule,
        enableDueDates: true,
        termStartDate: "2026-08-24",
        termEndDate: "2026-12-12",
        holidays: ["2026-09-07"],
        blackoutDates: ["2026-10-12"]
      }
    }
  },
  {
    name: "topics-challenging-quizzes",
    prompt: "Build me a quiz-heavy 6-week course on Data Literacy.",
    settings: {
      ...defaultSettings,
      courseLengthPreset: "6-weeks",
      lengthWeeks: 6,
      moduleCount: 6,
      organizationPattern: "topics",
      quizFrequency: "module",
      quizDifficulty: "challenging",
      discussionFrequency: "none",
      assignmentCadence: "custom"
    }
  },
  {
    name: "units-no-quizzes",
    prompt: "Build me an 8-module course on Museum Exhibit Planning with discussions.",
    settings: {
      ...defaultSettings,
      courseLengthPreset: "8-weeks",
      lengthWeeks: 8,
      moduleCount: 8,
      organizationPattern: "units",
      quizFrequency: "none",
      discussionFrequency: "module",
      assignmentCadence: "every-other-module"
    }
  },
  {
    name: "chapters-major-milestones",
    prompt: "Build me a 12-week course on Introduction to Cybersecurity Governance.",
    settings: {
      ...defaultSettings,
      courseLengthPreset: "12-weeks",
      lengthWeeks: 12,
      moduleCount: 12,
      organizationPattern: "chapters",
      quizFrequency: "biweekly",
      discussionFrequency: "biweekly",
      assignmentCadence: "major-milestones"
    }
  }
];

const courses: Array<{ name: string; course: CourseProject }> = [
  { name: "sample-project", course: sampleProject },
  ...matrix.map(({ name, prompt, settings }) => ({ name, course: generateCourseProject({ prompt, settings }) }))
];

// Optional disk emission for manual Canvas sandbox import. Default `npm test` stays pure;
// enable with `CF_PACKAGE_DIR=/path/to/out npm test`. Node globals are reached dynamically so
// the suite typechecks under the app tsconfig (which does not load @types/node).
const nodeProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
const packageDir = nodeProcess?.env?.CF_PACKAGE_DIR;

const writePackage = async (fileName: string, zip: Awaited<ReturnType<typeof buildImsccZip>>): Promise<void> => {
  if (!packageDir) return;
  const fsSpecifier = "node:fs";
  const fs = (await import(fsSpecifier)) as {
    mkdirSync: (path: string, options: { recursive: boolean }) => void;
    writeFileSync: (path: string, data: Uint8Array) => void;
  };
  fs.mkdirSync(packageDir, { recursive: true });
  const buffer = (await zip.generateAsync({ type: "uint8array", mimeType: "application/zip" })) as Uint8Array;
  fs.writeFileSync(`${packageDir}/${fileName}`, buffer);
};

describe("RocketCourse package matrix", () => {
  it.each(courses)("builds a valid Canvas-importable package for $name", async ({ name, course }) => {
    const zip = await buildImsccZip(course);
    const report = await validateImsccZip(course, zip);

    const errors = report.issues.filter((issue) => issue.severity === "error");
    expect(errors, `${name}: ${errors.map((issue) => issue.message).join("; ")}`).toHaveLength(0);
    expect(report.valid).toBe(true);

    // Required Canvas-flavored skeleton must always be present.
    expect(report.files).toContain("imsmanifest.xml");
    expect(report.files).toContain("course_settings/canvas_export.txt");
    expect(report.files).toContain("course_settings/module_meta.xml");
    expect(report.files).toContain("course_settings/assignment_groups.xml");

    await writePackage(`${name}.imscc`, zip);
  });

  it.each(courses)("emits answer-bearing QTI for every quiz in $name", async ({ name, course }) => {
    const zip = await buildImsccZip(course);

    for (const quiz of course.quizzes) {
      const canvasQti = await zip.file(`non_cc_assessments/${quiz.id}.xml.qti`)?.async("text");
      const ccQti = await zip.file(`${quiz.id}/assessment_qti.xml`)?.async("text");
      expect(canvasQti, `${name} ${quiz.id} canvas qti`).toBeTruthy();
      expect(ccQti, `${name} ${quiz.id} cc qti`).toBeTruthy();

      for (const question of quiz.questions) {
        const autoGraded =
          (question.type === "multiple_choice" || question.type === "true_false") &&
          Array.isArray(question.choices) &&
          question.choices.length > 0;

        if (autoGraded) {
          // Choices must be rendered and the answer key must point at the correct label.
          const correctIndex = (question.choices ?? []).findIndex((choice) => choice === question.correctAnswer);
          const expectedLabel = `${question.id}_a${correctIndex + 1}`;
          for (const qti of [canvasQti, ccQti]) {
            expect(qti).toContain(`response_${question.id}`);
            expect(qti).toContain("<render_choice>");
            (question.choices ?? []).forEach((choice) => expect(qti).toContain(choice));
            expect(qti).toContain(`<varequal respident="response_${question.id}">${expectedLabel}</varequal>`);
            expect(qti).toContain('<setvar action="Set" varname="SCORE">100</setvar>');
          }
        } else {
          // Open prompts become manually graded essay questions with a text response.
          for (const qti of [canvasQti, ccQti]) {
            expect(qti).toContain(`response_${question.id}`);
            expect(qti).toContain("<render_fib>");
          }
          expect(canvasQti).toContain(
            `<fieldlabel>question_type</fieldlabel><fieldentry>essay_question</fieldentry>`
          );
        }
      }

      // The internal type names must never leak as the Canvas question_type value.
      expect(canvasQti).not.toContain("<fieldentry>multiple_choice</fieldentry>");
      expect(canvasQti).not.toContain("<fieldentry>true_false</fieldentry>");
      expect(canvasQti).not.toContain("<fieldentry>short_answer</fieldentry>");
    }
  });
});
