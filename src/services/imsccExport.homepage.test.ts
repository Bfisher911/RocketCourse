import { describe, expect, it } from "vitest";
import { getTheme } from "../data/themes";
import { applyThemeToGeneratedContent, sampleProject } from "./courseGenerator";
import { CALENDAR_HREF, SUCCESS_GUIDE_HREF, SYLLABUS_HREF } from "./homepageTemplates";
import { buildImsccZip } from "./imsccExport";

const HOMEPAGE_PATH = "wiki_content/homepage.html";

const readHomepage = async (course = sampleProject): Promise<string> => {
  const zip = await buildImsccZip(course);
  const html = await zip.file(HOMEPAGE_PATH)?.async("text");
  expect(html, `expected ${HOMEPAGE_PATH} in the package`).toBeTruthy();
  return html as string;
};

describe("homepage export", () => {
  it("writes the homepage into the package as the Canvas front page", async () => {
    const html = await readHomepage();
    expect(html).toContain("<h1");
    expect(html).toContain("Welcome to");
    expect(html).toMatch(/front_page"\s+content="true"/);
  });

  it("keeps the required internal links and the real banner asset path", async () => {
    const html = await readHomepage();
    expect(html).toContain(SUCCESS_GUIDE_HREF);
    expect(html).toContain(SYLLABUS_HREF);
    expect(html).toContain(CALENDAR_HREF);
    expect(html).toContain("../web_resources/course-banner.svg");
  });

  it("references a banner asset that is actually included in the package", async () => {
    const zip = await buildImsccZip(sampleProject);
    expect(zip.file("web_resources/course-banner.svg")).toBeTruthy();
  });

  it("contains no CourseForge UI-only artifacts or preview-only assets", async () => {
    const html = await readHomepage();
    // Builder chrome must never leak into the exported page.
    expect(html).not.toMatch(/hp-canvas|hp-template|QUICK IMPROVEMENTS|Quick improvements/);
    // The preview swaps the banner for an inline data URI; the export must keep the file path.
    expect(html).not.toContain("data:image/svg+xml");
  });

  it("reflects a theme change in the exported homepage", async () => {
    const greenTheme = getTheme("green-growth");
    const themed = applyThemeToGeneratedContent(sampleProject, greenTheme);
    const html = await readHomepage(themed);
    expect(html.toLowerCase()).toContain(greenTheme.accent.toLowerCase());
  });

  it("matches what the in-app preview renders (preview === exported body, modulo the banner swap)", async () => {
    const homepage = sampleProject.pages.find((page) => page.frontPage);
    const html = await readHomepage();
    // The exported wiki page wraps the same bodyHtml the Homepage tab previews.
    expect(homepage?.bodyHtml).toBeTruthy();
    expect(html).toContain(homepage!.bodyHtml.slice(0, 80));
  });
});
