import { describe, expect, it } from "vitest";
import { sampleProject } from "./courseGenerator";
import { buildImsccZip } from "./imsccExport";
import { buildVisualCourseAssetSvg, visualCourseAssetDefinitions } from "./visualCourseAssets";

describe("visual course assets", () => {
  it("defines reusable lightweight SVG assets beyond the course banner", () => {
    const assets = visualCourseAssetDefinitions(sampleProject.title, sampleProject.settings.moduleCount);
    const paths = assets.map((asset) => asset.path);

    expect(paths).toContain("web_resources/course-identity-badge.svg");
    expect(paths).toContain("web_resources/week-1-badge.svg");
    expect(paths).toContain("web_resources/assignment-type-icon.svg");
    expect(paths).toContain("web_resources/discussion-icon.svg");
    expect(paths).toContain("web_resources/quiz-icon.svg");
    expect(paths).toContain("web_resources/project-milestone-badge.svg");
    expect(paths).toContain("web_resources/completion-badge.svg");
    expect(paths).toContain("web_resources/canvas-safe-divider.svg");
  });

  it("renders assets as safe SVG strings", () => {
    ["web_resources/week-1-badge.svg", "web_resources/assignment-type-icon.svg", "web_resources/canvas-safe-divider.svg"].forEach((path) => {
      const svg = buildVisualCourseAssetSvg(sampleProject, path);
      expect(svg, path).toContain("<svg");
      expect(svg, path).toContain("<title");
      expect(svg, path).not.toMatch(/<script|\son[a-z]+\s*=|javascript:/i);
    });
  });

  it("writes visual assets to the IMSCC package and references them from generated HTML", async () => {
    const zip = await buildImsccZip(sampleProject);

    for (const path of ["web_resources/week-1-badge.svg", "web_resources/assignment-type-icon.svg", "web_resources/discussion-icon.svg", "web_resources/quiz-icon.svg"]) {
      const svg = await zip.file(path)?.async("text");
      expect(svg, path).toContain("<svg");
    }

    expect(sampleProject.pages.some((page) => page.bodyHtml.includes("week-1-badge.svg"))).toBe(true);
    expect(sampleProject.assignments.some((assignment) => assignment.descriptionHtml.includes("assignment-type-icon.svg"))).toBe(true);
    expect(sampleProject.discussions.some((discussion) => discussion.promptHtml.includes("discussion-icon.svg"))).toBe(true);
    expect(sampleProject.quizzes.some((quiz) => quiz.purpose.includes("quiz-icon.svg"))).toBe(true);
  });
});
