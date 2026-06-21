import { describe, expect, it } from "vitest";
import { getTheme } from "../data/themes";
import { sampleProject } from "./courseGenerator";
import { PRINTABLE_HTML_HREF, PRINTABLE_PDF_HREF, renderSyllabus } from "./syllabusTemplates";
import { validateSyllabus } from "./syllabusValidation";

const syllabusHtml = sampleProject.pages.find((page) => page.slug === "syllabus")?.bodyHtml ?? "";
const knownTargets = new Set([
  PRINTABLE_HTML_HREF,
  PRINTABLE_PDF_HREF,
  "course-calendar-and-workload-plan.html",
  "../web_resources/syllabus-printable.html",
  "../web_resources/syllabus-printable.pdf"
]);

const statusOf = (html: string, id: string) => validateSyllabus(html, { knownTargets }).checks.find((check) => check.id === id)?.status;

describe("syllabus validation", () => {
  it("accepts generated syllabus HTML as production-ready", () => {
    const result = validateSyllabus(syllabusHtml, { knownTargets, includeContactHours: true });

    expect(result.failures).toBe(0);
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(statusOf(syllabusHtml, "printable-link")).toBe("pass");
  });

  it("catches unsafe HTML used through advanced editing", () => {
    const unsafe = `${syllabusHtml}<script>alert(1)</script><p onclick="alert(1)">Bad</p><a href="javascript:alert(1)">Launch</a>`;
    const result = validateSyllabus(unsafe, { knownTargets });

    expect(result.checks.find((check) => check.id === "no-scripts")?.status).toBe("fail");
    expect(result.checks.find((check) => check.id === "no-event-handlers")?.status).toBe("fail");
    expect(result.checks.find((check) => check.id === "no-js-links")?.status).toBe("fail");
  });

  it("catches missing core syllabus sections", () => {
    const result = validateSyllabus("<h1>Course Syllabus</h1><p>Welcome to class.</p>", { knownTargets });

    expect(result.checks.find((check) => check.id === "description")?.status).toBe("fail");
    expect(result.checks.find((check) => check.id === "outcomes")?.status).toBe("fail");
    expect(result.checks.find((check) => check.id === "grading")?.status).toBe("fail");
    expect(result.checks.find((check) => check.id === "ai-use")?.status).toBe("fail");
    expect(result.failures).toBeGreaterThanOrEqual(8);
  });

  it("catches image alt text and weak link text", () => {
    const html = `${syllabusHtml}<p><a href="course-calendar-and-workload-plan.html">click here</a></p><img src="../web_resources/course-banner.svg">`;
    const result = validateSyllabus(html, { knownTargets });

    expect(result.checks.find((check) => check.id === "image-alt")?.status).toBe("fail");
    expect(result.checks.find((check) => check.id === "link-text")?.status).toBe("warn");
  });

  it("warns when the printable copy link is missing or broken", () => {
    const noPrintable = syllabusHtml.replace(/<a href="\.\.\/web_resources\/syllabus-printable\.(html|pdf)"[\s\S]*?<\/a>/g, "");
    const brokenPrintable = syllabusHtml
      .replace(/\.\.\/web_resources\/syllabus-printable\.html/g, "missing-syllabus-printable.html")
      .replace(/\.\.\/web_resources\/syllabus-printable\.pdf/g, "missing-syllabus-printable.pdf");

    expect(validateSyllabus(noPrintable, { knownTargets }).checks.find((check) => check.id === "printable-link")?.status).toBe("warn");
    expect(validateSyllabus(brokenPrintable, { knownTargets: new Set() }).checks.find((check) => check.id === "printable-link")?.status).toBe("warn");
  });

  it("does not allow generated templates to smuggle event handlers through content", () => {
    const html = renderSyllabus(
      "standard-university",
      {
        ...sampleProject.syllabus!.content,
        courseDescription: '<img src=x onerror="alert(1)">',
        learningOutcomes: ['<a href="javascript:alert(1)">bad</a>']
      },
      getTheme("purple-innovation")
    );

    expect(html).not.toContain("<img");
    expect(html).not.toMatch(/<a\b[^>]*href="javascript:/i);
    expect(validateSyllabus(html, { knownTargets }).failures).toBe(0);
  });
});
