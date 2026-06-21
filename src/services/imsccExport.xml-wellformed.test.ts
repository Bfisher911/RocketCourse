import { describe, expect, it } from "vitest";
import type { CourseProject } from "../types";
import { sampleProject } from "./courseGenerator";
import { buildImsccZip, validateImsccZip } from "./imsccExport";
import { collectXmlParseErrors, isXmlPath, validateXmlString } from "./xmlWellFormed";

// Control characters constructed by code point so the source file stays plain ASCII.
const NUL = String.fromCharCode(0x00);
const BELL = String.fromCharCode(0x07);
const VTAB = String.fromCharCode(0x0b);
const UNIT_SEP = String.fromCharCode(0x1f);
const LONE_SURROGATE = String.fromCharCode(0xd800);

const xmlPathsOf = (zip: Awaited<ReturnType<typeof buildImsccZip>>): string[] =>
  Object.keys(zip.files)
    .filter((path) => !zip.files[path].dir && isXmlPath(path))
    .sort();

describe("imscc XML well-formedness", () => {
  it("classifies XML-bearing paths and excludes html/txt/pdf/binary entries", () => {
    expect(isXmlPath("imsmanifest.xml")).toBe(true);
    expect(isXmlPath("course_settings/course_settings.xml")).toBe(true);
    expect(isXmlPath("web_resources/course-banner.svg")).toBe(true);
    expect(isXmlPath("non_cc_assessments/quiz_1.xml.qti")).toBe(true);
    expect(isXmlPath("course_settings/syllabus.html")).toBe(false);
    expect(isXmlPath("course_settings/canvas_export.txt")).toBe(false);
    expect(isXmlPath("web_resources/syllabus-printable.pdf")).toBe(false);
    expect(isXmlPath("courseforge-readme.txt")).toBe(false);
  });

  it("parses every generated XML file in the package as well-formed", async () => {
    const zip = await buildImsccZip(sampleProject);
    const xmlPaths = xmlPathsOf(zip);

    // Guard against a vacuous pass: the descriptors we care about must actually be present.
    expect(xmlPaths).toContain("imsmanifest.xml");
    expect(xmlPaths).toContain("course_settings/course_settings.xml");
    expect(xmlPaths).toContain("course_settings/module_meta.xml");
    expect(xmlPaths.some((path) => path.endsWith(".svg"))).toBe(true);
    expect(xmlPaths.some((path) => path.endsWith("/assessment_qti.xml"))).toBe(true);
    expect(xmlPaths.some((path) => path.endsWith("/assessment_meta.xml"))).toBe(true);
    expect(xmlPaths.some((path) => path.endsWith(".xml.qti"))).toBe(true);
    expect(xmlPaths.length).toBeGreaterThanOrEqual(12);

    expect(await collectXmlParseErrors(zip)).toEqual([]);
  });

  // Each sample is XML that a parser must reject. The first four are structural failures caught
  // by fast-xml-parser; the last three are XML 1.0 forbidden code points caught by the char scan.
  const malformed: Array<{ name: string; xml: string; expectedCode: string }> = [
    { name: "mismatched closing tag", xml: "<a><b>x</a></b>", expectedCode: "InvalidTag" },
    { name: "unclosed child tag", xml: "<a><b>x</a>", expectedCode: "InvalidTag" },
    { name: "unescaped ampersand in text", xml: "<a>Tom & Jerry</a>", expectedCode: "InvalidChar" },
    { name: "stray less-than in text", xml: "<a>1 < 2</a>", expectedCode: "InvalidTag" },
    { name: "NUL control character", xml: `<a>x${NUL}y</a>`, expectedCode: "InvalidChar" },
    { name: "vertical-tab control character", xml: `<a>x${VTAB}y</a>`, expectedCode: "InvalidChar" },
    { name: "unpaired UTF-16 surrogate", xml: `<a>x${LONE_SURROGATE}y</a>`, expectedCode: "InvalidChar" }
  ];

  it.each(malformed)("rejects $name and never lets it pass validation", ({ xml, expectedCode }) => {
    const error = validateXmlString("course_settings/context.xml", xml);
    expect(error).not.toBeNull();
    expect(error?.path).toBe("course_settings/context.xml");
    expect(error?.code).toBe(expectedCode);
    expect(error?.line).toBeGreaterThanOrEqual(1);
  });

  it("accepts a well-formed document, including astral characters and namespaced prefixes", () => {
    expect(validateXmlString("ok.xml", `<?xml version="1.0"?><root xmlns:x="urn:x"><x:a>Hi \u{1F680}</x:a></root>`)).toBeNull();
  });

  it("fails validateImsccZip and names the exact file and parse error when a descriptor is malformed", async () => {
    const zip = await buildImsccZip(sampleProject);
    zip.file("course_settings/course_settings.xml", "<course><title>Broken</course>");

    const report = await validateImsccZip(sampleProject, zip);

    expect(report.valid).toBe(false);
    const issue = report.issues.find((item) => item.id === "malformed-xml-course_settings/course_settings.xml");
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("error");
    expect(issue?.message).toContain("Malformed XML in course_settings/course_settings.xml");
    expect(issue?.message).toMatch(/line \d+/);
  });

  it("independently validates every XML file — corrupting any single one is caught at its own path", async () => {
    const zip = await buildImsccZip(sampleProject);
    const xmlPaths = xmlPathsOf(zip);
    expect(xmlPaths.length).toBeGreaterThanOrEqual(12);

    const originals = new Map<string, string>();
    for (const path of xmlPaths) originals.set(path, await zip.file(path)!.async("text"));

    for (const target of xmlPaths) {
      zip.file(target, "<broken><unclosed></broken>");
      const errors = await collectXmlParseErrors(zip);
      // Exactly the corrupted file is reported, by its exact path, and nothing else.
      expect(errors.map((error) => error.path)).toEqual([target]);
      zip.file(target, originals.get(target)!);
    }

    // Restoration is complete: the package is clean again.
    expect(await collectXmlParseErrors(zip)).toEqual([]);
  });

  it("sanitizes XML-forbidden control and surrogate characters in course content", async () => {
    const hostile = `Forbidden${NUL}${VTAB}${BELL}${UNIT_SEP}${LONE_SURROGATE} Content`;
    const project: CourseProject = {
      ...sampleProject,
      title: hostile,
      description: hostile,
      pages: sampleProject.pages.map((page, index) => (index === 0 ? { ...page, title: hostile } : page)),
      quizzes: sampleProject.quizzes.map((quiz, quizIndex) =>
        quizIndex === 0
          ? {
              ...quiz,
              title: hostile,
              questions: quiz.questions.map((question, questionIndex) =>
                questionIndex === 0 ? { ...question, stem: `Stem ${UNIT_SEP} body ${NUL} tail` } : question
              )
            }
          : quiz
      )
    };

    const zip = await buildImsccZip(project);

    expect(await collectXmlParseErrors(zip)).toEqual([]);
    const report = await validateImsccZip(project, zip);
    expect(report.issues.some((item) => item.id.startsWith("malformed-xml-"))).toBe(false);
  });

  it("escapes XML metacharacters in course content instead of breaking the document", async () => {
    const project: CourseProject = { ...sampleProject, title: `A <b> tag & an "attr" with 'quotes' > end` };

    const zip = await buildImsccZip(project);

    expect(await collectXmlParseErrors(zip)).toEqual([]);
    const settings = (await zip.file("course_settings/course_settings.xml")?.async("text")) ?? "";
    expect(settings).toContain("&lt;b&gt;");
    expect(settings).toContain("&amp;");
    expect(settings).not.toContain("<b>");
  });

  it("keeps valid astral characters (emoji) intact while staying well-formed", async () => {
    const project: CourseProject = { ...sampleProject, title: "Astronomy 101 \u{1F680} Rockets and Orbits" };

    const zip = await buildImsccZip(project);

    expect(await collectXmlParseErrors(zip)).toEqual([]);
    const settings = (await zip.file("course_settings/course_settings.xml")?.async("text")) ?? "";
    expect(settings).toContain("\u{1F680}");
  });

  it("emits well-formed XML when every text-bearing field is loaded with hostile content", async () => {
    // Metacharacters, every flavour of forbidden control char, comment/CDATA/PI/DOCTYPE markers,
    // a lone surrogate, and a valid emoji — prepended so existing structure (and the
    // choice/correct-answer match that drives auto-graded QTI) is preserved.
    const HOSTILE = `<x a="b">&'"]]><!--c--><![CDATA[<?xml?><!DOCTYPE d>${NUL}${BELL}${VTAB}${UNIT_SEP}${LONE_SURROGATE}\u{1F4A5}`;
    const fuzz = (value: string): string => `${HOSTILE}${value}`;

    const project: CourseProject = {
      ...sampleProject,
      title: fuzz(sampleProject.title),
      description: fuzz(sampleProject.description),
      prompt: fuzz(sampleProject.prompt),
      outcomes: sampleProject.outcomes.map((outcome) => ({ ...outcome, code: fuzz(outcome.code), text: fuzz(outcome.text) })),
      modules: sampleProject.modules.map((module) => ({
        ...module,
        title: fuzz(module.title),
        items: module.items.map((item) => ({ ...item, title: fuzz(item.title) }))
      })),
      pages: sampleProject.pages.map((page) => ({ ...page, title: fuzz(page.title) })),
      assignments: sampleProject.assignments.map((assignment) => ({
        ...assignment,
        title: fuzz(assignment.title),
        descriptionHtml: `${HOSTILE}<p>${assignment.descriptionHtml}</p>`
      })),
      discussions: sampleProject.discussions.map((discussion) => ({
        ...discussion,
        title: fuzz(discussion.title),
        promptHtml: `${HOSTILE}<p>${discussion.promptHtml}</p>`
      })),
      quizzes: sampleProject.quizzes.map((quiz) => ({
        ...quiz,
        title: fuzz(quiz.title),
        purpose: fuzz(quiz.purpose),
        questions: quiz.questions.map((question) => ({
          ...question,
          stem: fuzz(question.stem),
          choices: question.choices?.map((choice) => fuzz(choice)),
          correctAnswer: question.correctAnswer != null ? fuzz(question.correctAnswer) : question.correctAnswer,
          feedback: question.feedback != null ? fuzz(question.feedback) : question.feedback,
          correctFeedback: question.correctFeedback != null ? fuzz(question.correctFeedback) : question.correctFeedback,
          incorrectFeedback: question.incorrectFeedback != null ? fuzz(question.incorrectFeedback) : question.incorrectFeedback
        }))
      })),
      rubrics: sampleProject.rubrics.map((rubric) => ({
        ...rubric,
        title: fuzz(rubric.title),
        criteria: rubric.criteria.map((criterion) => ({
          ...criterion,
          title: fuzz(criterion.title),
          description: fuzz(criterion.description),
          levels: criterion.levels.map((level) => ({ ...level, label: fuzz(level.label), description: fuzz(level.description) }))
        }))
      })),
      navigation: sampleProject.navigation.map((tab) => ({ ...tab, label: fuzz(tab.label), reason: fuzz(tab.reason) })),
      assignmentGroups: sampleProject.assignmentGroups.map((group) => ({ ...group, name: fuzz(group.name) }))
    };

    const zip = await buildImsccZip(project);

    // The closed loop: hostile input flows through every generated descriptor and not a single
    // XML file comes out malformed.
    expect(await collectXmlParseErrors(zip)).toEqual([]);
  });
});
