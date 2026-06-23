import { describe, expect, it } from "vitest";
import { getVisualTemplate, visualTemplates, visualTemplateThemes } from "./visualTemplates";
import { getTheme } from "./themes";
import { validateTheme } from "../services/themeDesign";
import { HOMEPAGE_TEMPLATES } from "../services/homepageTemplates";
import { SYLLABUS_TEMPLATES } from "../services/syllabusTemplates";
import { applyVisualTemplate, sampleProject } from "../services/courseGenerator";

const homepageIds = new Set(HOMEPAGE_TEMPLATES.map((template) => template.id));
const syllabusIds = new Set(SYLLABUS_TEMPLATES.map((template) => template.id));

describe("visual templates", () => {
  it("ships at least 12 distinct templates", () => {
    expect(visualTemplates.length).toBeGreaterThanOrEqual(12);
    const ids = new Set(visualTemplates.map((template) => template.id));
    expect(ids.size).toBe(visualTemplates.length);
    const themeIds = new Set(visualTemplates.map((template) => template.theme.id));
    expect(themeIds.size).toBe(visualTemplates.length);
  });

  it("every template theme passes WCAG contrast validation", () => {
    visualTemplates.forEach((template) => {
      const result = validateTheme(template.theme);
      expect(result.status, `${template.name} (${result.warnings} warnings)`).toBe("pass");
      expect(result.warnings, template.name).toBe(0);
    });
  });

  it("every template carries the rich visual fields (not color-only)", () => {
    visualTemplates.forEach((template) => {
      expect(template.theme.id.startsWith("vt-"), template.name).toBe(true);
      expect(template.theme.gradientFrom, template.name).toBeTruthy();
      expect(template.theme.fontFamily, template.name).toBeTruthy();
      expect(template.theme.heroStyle, template.name).toBeTruthy();
      expect(template.theme.cardStyle, template.name).toBeTruthy();
      expect(template.description.length, template.name).toBeGreaterThan(20);
      expect(template.bestFor.length, template.name).toBeGreaterThan(5);
    });
  });

  it("points at real homepage and syllabus layout templates", () => {
    visualTemplates.forEach((template) => {
      expect(homepageIds.has(template.homepageTemplateId), `${template.name} homepage`).toBe(true);
      expect(syllabusIds.has(template.syllabusTemplateId), `${template.name} syllabus`).toBe(true);
    });
  });

  it("registers its themes with getTheme so generated content resolves the palette", () => {
    expect(visualTemplateThemes.length).toBe(visualTemplates.length);
    visualTemplates.forEach((template) => {
      expect(getTheme(template.theme.id).id).toBe(template.theme.id);
    });
  });

  it("applyVisualTemplate restyles the course, homepage, and syllabus", () => {
    const template = getVisualTemplate("ocean-field-station");
    expect(template).toBeTruthy();
    const themed = applyVisualTemplate(sampleProject, template!);
    expect(themed.theme.id).toBe("vt-ocean-field-station");
    expect(themed.settings.themeId).toBe("vt-ocean-field-station");
    expect(themed.settings.visualTemplateId).toBe("ocean-field-station");
    expect(themed.homepage?.templateId).toBe(template!.homepageTemplateId);
    expect(themed.syllabus?.templateId).toBe(template!.syllabusTemplateId);
    // The homepage picks up the template accent, and a module page's gradient hero carries the
    // template's gradient stop — proving the look reaches generated content, not just the picker.
    const homepage = themed.pages.find((page) => page.frontPage);
    expect(homepage?.bodyHtml).toContain("0891b2");
    // A generated module page's gradient hero carries the template's gradient stop.
    expect(themed.pages.some((page) => page.bodyHtml.includes("0e7490"))).toBe(true);
  });
});
