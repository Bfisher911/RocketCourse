import { describe, expect, it } from "vitest";
import { getTheme, themes } from "../data/themes";
import {
  BANNER_SRC,
  CALENDAR_HREF,
  HOMEPAGE_TEMPLATES,
  SUCCESS_GUIDE_HREF,
  SYLLABUS_HREF,
  defaultHomepageContent,
  ensureCoreLinks,
  rethemeHomepageHtml,
  reviseHomepageContent,
  renderHomepage,
  createHomepageState,
  safeHref,
  type HomepageContext
} from "./homepageTemplates";
import { validateHomepage } from "./homepageValidation";

const context: HomepageContext = {
  title: "AI and Modern Society",
  description: "An undergraduate course exploring the social and ethical dimensions of AI.",
  modality: "Online asynchronous",
  level: "Undergraduate",
  moduleCount: 12,
  finalProject: true,
  finalProjectType: "portfolio",
  organizationLabel: "weeks"
};

const content = defaultHomepageContent(context);
const theme = getTheme("purple-innovation");

describe("homepage templates", () => {
  it("ships exactly five templates", () => {
    expect(HOMEPAGE_TEMPLATES.length).toBe(5);
    expect(HOMEPAGE_TEMPLATES.map((t) => t.id)).toEqual(["clean-canvas", "bold-university", "warm-instructor", "high-contrast", "project-based"]);
  });

  HOMEPAGE_TEMPLATES.forEach((template) => {
    describe(`${template.id}`, () => {
      const html = renderHomepage(template.id, content, theme);

      it("produces Canvas-safe HTML with exactly one H1 and no unsafe markup", () => {
        expect((html.match(/<h1\b/gi) ?? []).length).toBe(1);
        expect(html).not.toMatch(/<script|<iframe|<style|<form|<object|<embed|<link|<meta/i);
        expect(html).not.toMatch(/\son[a-z]+\s*=/i);
        expect(html).not.toMatch(/javascript:/i);
      });

      it("keeps the three required internal links resolvable", () => {
        expect(html).toContain(SYLLABUS_HREF);
        expect(html).toContain(SUCCESS_GUIDE_HREF);
        expect(html).toContain(CALENDAR_HREF);
      });

      it("gives every image informative alt text and the correct banner path", () => {
        const imgs = html.match(/<img\b[^>]*>/gi) ?? [];
        imgs.forEach((img) => expect(img).toMatch(/\salt="[^"]+"/i));
        if (/course-banner\.svg/i.test(html)) {
          expect(html).toContain(BANNER_SRC);
        }
      });

      it("uses a theme accent color (accent or accentDark)", () => {
        const lower = html.toLowerCase();
        expect(lower.includes(theme.accent.toLowerCase()) || lower.includes(theme.accentDark.toLowerCase())).toBe(true);
      });

      it("passes its own homepage validation with no warnings", () => {
        const result = validateHomepage(html, { knownTargets: new Set([SYLLABUS_HREF, SUCCESS_GUIDE_HREF, CALENDAR_HREF]) });
        expect(result.failures).toBe(0);
        expect(result.warnings).toBe(0);
      });

      it("never skips heading levels", () => {
        const levels = Array.from(html.matchAll(/<h([1-6])\b/gi)).map((match) => Number(match[1]));
        for (let i = 1; i < levels.length; i += 1) {
          expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
        }
      });
    });
  });

  it("renders cleanly for every shipped theme", () => {
    themes.forEach((candidate) => {
      HOMEPAGE_TEMPLATES.forEach((template) => {
        const html = renderHomepage(template.id, content, candidate);
        expect(validateHomepage(html).failures).toBe(0);
      });
    });
  });

  it("falls back to the default template for an unknown id", () => {
    expect(renderHomepage("does-not-exist", content, theme)).toContain("<h1");
  });
});

describe("safeHref", () => {
  it("neutralizes dangerous schemes to a flagged placeholder", () => {
    expect(safeHref("javascript:alert(1)")).toBe("#");
    expect(safeHref("vbscript:msgbox")).toBe("#");
    expect(safeHref("data:text/html;base64,abc")).toBe("#");
  });

  it("preserves safe targets", () => {
    expect(safeHref("syllabus.html")).toBe("syllabus.html");
    expect(safeHref("mailto:prof@example.edu")).toBe("mailto:prof@example.edu");
    expect(safeHref("https://example.edu")).toBe("https://example.edu");
  });
});

describe("default content", () => {
  it("derives a course-aware welcome and start path", () => {
    expect(content.heroHeading).toContain(context.title);
    expect(content.primaryButton.target).toBe(SUCCESS_GUIDE_HREF);
    expect(content.secondaryButton.target).toBe(SYLLABUS_HREF);
    expect(content.pathItems.length).toBeGreaterThanOrEqual(4);
  });
});

describe("revise actions", () => {
  it("concise shortens the welcome", () => {
    const longContent = { ...content, welcome: "First sentence. Second sentence. Third sentence." };
    const revised = reviseHomepageContent("concise", longContent, context);
    expect(revised.welcome).toBe("First sentence.");
  });

  it("start-path forces the Start Here button and a strong path", () => {
    const revised = reviseHomepageContent("start-path", { ...content, primaryButton: { label: "Go", target: "#" } }, context);
    expect(revised.primaryButton.target).toBe(SUCCESS_GUIDE_HREF);
    expect(revised.pathItems.length).toBeGreaterThanOrEqual(4);
  });

  it("support-resources guarantees the core links", () => {
    const revised = reviseHomepageContent("support-resources", { ...content, resourceLinks: [] }, context);
    expect(revised.resourceLinks.map((l) => l.target)).toEqual(expect.arrayContaining([SYLLABUS_HREF, SUCCESS_GUIDE_HREF, CALENDAR_HREF]));
  });

  it("every revise action still renders valid HTML", () => {
    (["concise", "examples", "accessibility", "start-path", "instructor-welcome", "weekly-rhythm", "support-resources"] as const).forEach((action) => {
      const revised = reviseHomepageContent(action, content, context);
      expect(validateHomepage(renderHomepage("clean-canvas", revised, theme)).failures).toBe(0);
    });
  });
});

describe("ensureCoreLinks", () => {
  it("does not duplicate links that already exist", () => {
    const links = ensureCoreLinks([{ label: "Course syllabus", target: SYLLABUS_HREF }]);
    expect(links.filter((l) => l.target === SYLLABUS_HREF).length).toBe(1);
    expect(links.length).toBe(3);
  });
});

describe("re-theme", () => {
  it("re-renders builder HTML with the new theme and preserves text", () => {
    const state = createHomepageState(content, "bold-university", "purple-innovation", "2026-01-01T00:00:00.000Z");
    const greenTheme = getTheme("green-growth");
    const html = rethemeHomepageHtml(state, greenTheme);
    expect(html).not.toBeNull();
    expect(html!.toLowerCase()).toContain(greenTheme.accent.toLowerCase());
    expect(html).toContain(content.heroHeading);
  });

  it("refuses to re-theme a custom (hand-edited) homepage", () => {
    const state = { ...createHomepageState(content, "clean-canvas", "purple-innovation", "2026-01-01T00:00:00.000Z"), mode: "custom" as const };
    expect(rethemeHomepageHtml(state, getTheme("green-growth"))).toBeNull();
  });
});
