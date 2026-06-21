import { describe, expect, it } from "vitest";
import { getTheme } from "../data/themes";
import { defaultHomepageContent, renderHomepage, type HomepageContext } from "./homepageTemplates";
import { validateHomepage } from "./homepageValidation";

const context: HomepageContext = {
  title: "Intro to Statistics",
  description: "A first course in statistical reasoning.",
  modality: "Online asynchronous",
  level: "Undergraduate",
  moduleCount: 8,
  finalProject: false,
  finalProjectType: "exam",
  organizationLabel: "weeks"
};

const goodHtml = renderHomepage("clean-canvas", defaultHomepageContent(context), getTheme("calm-blue"));
const statusOf = (html: string, id: string, options?: Parameters<typeof validateHomepage>[1]) =>
  validateHomepage(html, options).checks.find((check) => check.id === id)?.status;

describe("validateHomepage", () => {
  it("passes a clean generated homepage with no required failures", () => {
    const result = validateHomepage(goodHtml);
    expect(result.failures).toBe(0);
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  it("flags script tags", () => {
    expect(statusOf(`${goodHtml}<script>alert(1)</script>`, "no-scripts")).toBe("fail");
  });

  it("flags inline event handlers", () => {
    expect(statusOf('<h1>Hi</h1><p onclick="x()">tap</p>', "no-event-handlers")).toBe("fail");
  });

  it("flags javascript: links", () => {
    expect(statusOf('<h1>Hi</h1><a href="javascript:void(0)">go</a>', "no-js-links")).toBe("fail");
  });

  it("flags empty and placeholder links", () => {
    expect(statusOf('<h1>Hi</h1><a href="#">Start</a>', "no-empty-links")).toBe("fail");
    expect(statusOf('<h1>Hi</h1><a href="">Start</a>', "no-empty-links")).toBe("fail");
  });

  it("flags images without alt text", () => {
    expect(statusOf('<h1>Hi</h1><img src="x.png">', "image-alt")).toBe("fail");
    expect(statusOf('<h1>Hi</h1><img src="x.png" alt="A useful chart">', "image-alt")).toBe("pass");
  });

  it("requires exactly one H1", () => {
    expect(statusOf("<h2>No h1</h2>", "single-h1")).toBe("fail");
    expect(statusOf("<h1>One</h1><h1>Two</h1>", "single-h1")).toBe("fail");
    expect(statusOf("<h1>One</h1>", "single-h1")).toBe("pass");
  });

  it("warns on skipped heading levels", () => {
    expect(statusOf("<h1>Title</h1><h3>Skipped</h3>", "heading-order")).toBe("warn");
    expect(statusOf("<h1>Title</h1><h2>Fine</h2>", "heading-order")).toBe("pass");
  });

  it("requires a clear start path", () => {
    expect(statusOf("<h1>Welcome</h1><p>Nothing here.</p>", "start-path")).toBe("fail");
    expect(statusOf('<h1>Welcome</h1><a href="course-success-guide.html">Start Here</a>', "start-path")).toBe("pass");
  });

  it("requires a syllabus link", () => {
    expect(statusOf("<h1>Welcome</h1><p>No syllabus.</p>", "syllabus-link")).toBe("fail");
    expect(statusOf('<h1>Welcome</h1><a href="syllabus.html">Syllabus</a>', "syllabus-link")).toBe("pass");
  });

  it("warns on vague link text", () => {
    expect(statusOf('<h1>Hi</h1><a href="syllabus.html">click here</a>', "link-text")).toBe("warn");
  });

  it("warns on low-contrast buttons", () => {
    const lowContrast = '<h1>Hi</h1><a href="syllabus.html" style="background: #fffbe6; color: #fff200;">Go</a>';
    expect(statusOf(lowContrast, "contrast")).toBe("warn");
  });

  it("verifies internal links against known export targets when provided", () => {
    const known = new Set(["syllabus.html", "course-success-guide.html", "course-calendar-and-workload-plan.html"]);
    expect(statusOf(goodHtml, "internal-links", { knownTargets: known })).toBe("pass");
    const broken = '<h1>Hi</h1><a href="course-success-guide.html">Start</a><a href="syllabus.html">S</a><a href="missing.html">Gone</a>';
    expect(statusOf(broken, "internal-links", { knownTargets: known })).toBe("warn");
  });

  it("warns when the banner path is wrong but passes when correct", () => {
    expect(statusOf('<h1>Hi</h1><img src="web_resources/course-banner.svg" alt="banner">', "banner-path")).toBe("warn");
    expect(statusOf('<h1>Hi</h1><img src="../web_resources/course-banner.svg" alt="banner">', "banner-path")).toBe("pass");
  });
});
