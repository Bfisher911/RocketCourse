import { describe, expect, it } from "vitest";
import { defaultSettings } from "../data/defaultSettings";
import { generateCourseProject } from "./courseGenerator";

const makeMesoamericanCourse = (contentDepth: "complete-course" | "generic-template" = "complete-course") =>
  generateCourseProject({
    prompt: "Build me a 10-week undergraduate course on Mesoamerican Warfare.",
    settings: {
      ...defaultSettings,
      title: "Mesoamerican Warfare",
      description: "A course on military organization, ritual, politics, material culture, and historical interpretation in Mesoamerica.",
      moduleCount: 10,
      lengthWeeks: 10,
      contentDepth,
      assignmentCadence: "every-module",
      discussionFrequency: "weekly",
      quizFrequency: "weekly"
    }
  });

describe("course content depth", () => {
  it("generates complete subject-specific activities by default", () => {
    const course = makeMesoamericanCourse();
    const discussionHtml = course.discussions.find((discussion) => /Design critique/i.test(discussion.title))?.promptHtml ?? course.discussions[0]?.promptHtml ?? "";
    const assignmentHtml = course.assignments[0]?.descriptionHtml ?? "";
    const resourcesHtml = course.pages.find((page) => /Readings and Resources/i.test(page.title))?.bodyHtml ?? "";

    expect(course.settings.contentDepth).toBe("complete-course");
    expect(discussionHtml).toMatch(/Mesoamerican Warfare|primary-source|material-culture|site map|conflict timeline/i);
    expect(assignmentHtml).toMatch(/Mesoamerican Warfare evidence dossier|historical interpretation team|archaeological evidence|material artifact/i);
    expect(resourcesHtml).toContain("Generated source brief");
    expect(resourcesHtml).not.toContain("Editable source placeholder");
    expect(resourcesHtml).not.toMatch(/Add verified article citation|Add textbook chapter/i);
  });

  it("keeps a manual generic template mode for editable shells", () => {
    const course = makeMesoamericanCourse("generic-template");
    const resourceText = course.resources.map((resource) => `${resource.placeholder} ${resource.instructorEditNote}`).join("\n");
    const assignmentHtml = course.assignments[0]?.descriptionHtml ?? "";

    expect(course.settings.contentDepth).toBe("generic-template");
    expect(resourceText).toMatch(/Add verified|Add textbook|uploaded PDF/i);
    expect(assignmentHtml).toContain("applied analysis brief");
  });
});
