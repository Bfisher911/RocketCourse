import { describe, expect, it } from "vitest";
import { getTheme, themes } from "../data/themes";
import type { ObjectMetadata } from "../types";
import type { SyllabusContext } from "./syllabusTemplates";
import {
  CALENDAR_HREF,
  PRINTABLE_HTML_HREF,
  PRINTABLE_PDF_HREF,
  SYLLABUS_REVISE_ACTIONS,
  SYLLABUS_TEMPLATES,
  createSyllabusState,
  defaultSyllabusContent,
  renderSyllabus,
  rethemeSyllabusHtml,
  reviseSyllabusContent,
  safeSyllabusHref
} from "./syllabusTemplates";
import { validateSyllabus } from "./syllabusValidation";

const metadata: ObjectMetadata = {
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  exportVersion: 1,
  source: "generated"
};

const context: SyllabusContext = {
  title: "AI and Modern Society",
  description: "An undergraduate course exploring the social and ethical dimensions of AI.",
  modality: "Online asynchronous",
  level: "Undergraduate",
  creditHours: 3,
  lengthWeeks: 12,
  moduleCount: 12,
  organizationLabel: "weeks",
  finalProject: true,
  finalProjectType: "portfolio",
  outcomes: [
    { id: "outcome_1", code: "CLO 1", text: "Analyze social impacts of AI systems.", bloomLevel: "Analyze", alignedModuleIds: [] },
    { id: "outcome_2", code: "CLO 2", text: "Create an evidence-based AI policy brief.", bloomLevel: "Create", alignedModuleIds: [] }
  ],
  assignmentGroups: [
    { id: "group_discussions", name: "Engagement and Discussions", weight: 20 },
    { id: "group_projects", name: "Projects", weight: 50 },
    { id: "group_quizzes", name: "Knowledge Checks", weight: 30 }
  ],
  assignments: [
    {
      id: "assignment_1",
      title: "AI Impact Brief",
      moduleId: "module_1",
      assignmentGroupId: "group_projects",
      descriptionHtml: "<p>Brief.</p>",
      points: 100,
      submissionType: "online_upload",
      estimatedHours: 5,
      alignedOutcomeIds: ["outcome_1"],
      status: "generated",
      publishState: "published",
      metadata
    }
  ],
  discussions: [
    {
      id: "discussion_1",
      title: "AI Ethics Discussion",
      moduleId: "module_1",
      assignmentGroupId: "group_discussions",
      promptHtml: "<p>Discuss.</p>",
      points: 10,
      alignedOutcomeIds: ["outcome_1"],
      status: "generated",
      publishState: "published",
      metadata
    }
  ],
  quizzes: [
    {
      id: "quiz_1",
      title: "AI Concepts Quiz",
      purpose: "Check understanding of core AI concepts.",
      moduleId: "module_1",
      assignmentGroupId: "group_quizzes",
      points: 20,
      questions: [],
      alignedOutcomeIds: ["outcome_1"],
      status: "generated",
      publishState: "published",
      metadata
    }
  ],
  contactHours: {
    totalHours: 135,
    instructionalTime: 36,
    readingMediaTime: 24,
    assignmentTime: 42,
    discussionTime: 18,
    quizStudyTime: 9,
    finalProjectTime: 6,
    justification: "This plan follows a three-credit workload model."
  },
  scheduleRows: ["Week 1: Foundations of AI", "Week 2: Bias and accountability"]
};

const content = defaultSyllabusContent(context);
const theme = getTheme("purple-innovation");
const knownTargets = new Set([PRINTABLE_HTML_HREF, PRINTABLE_PDF_HREF, CALENDAR_HREF]);

describe("syllabus templates", () => {
  it("ships exactly six syllabus templates", () => {
    expect(SYLLABUS_TEMPLATES.map((template) => template.id)).toEqual([
      "standard-university",
      "online-course",
      "hybrid-course",
      "project-based",
      "compressed-term",
      "accreditation-friendly"
    ]);
  });

  SYLLABUS_TEMPLATES.forEach((template) => {
    describe(template.id, () => {
      const html = renderSyllabus(template.id, content, theme);

      it("produces Canvas-safe HTML with exactly one H1", () => {
        expect((html.match(/<h1\b/gi) ?? []).length).toBe(1);
        expect(html).not.toMatch(/<script|<iframe|<style|<form|<object|<embed|<link|<meta/i);
        expect(html).not.toMatch(/\son[a-z]+\s*=/i);
        expect(html).not.toMatch(/javascript:/i);
      });

      it("includes the core student-facing syllabus sections", () => {
        [
          "Course Description",
          "Course Learning Outcomes",
          "Required and Optional Materials",
          "Weekly Schedule and Pacing",
          "Grading Breakdown",
          "Assignment Overview",
          "Participation and Communication",
          "Late Work Policy",
          "Academic Integrity Policy",
          "AI Use Policy",
          "Accessibility and Accommodations",
          "Student Support Resources",
          "Instructor Contact and Availability",
          "Workload and Contact Hours"
        ].forEach((heading) => expect(html).toContain(heading));
      });

      it("keeps printable and schedule links resolvable", () => {
        expect(html).toContain(PRINTABLE_HTML_HREF);
        expect(html).toContain(PRINTABLE_PDF_HREF);
        expect(html).not.toContain("$IMS-CC-FILEBASE$/syllabus-printable");
        expect(html).toContain(CALENDAR_HREF);
      });

      it("passes syllabus validation", () => {
        const result = validateSyllabus(html, { knownTargets, includeContactHours: true });
        expect(result.failures).toBe(0);
        expect(result.score).toBeGreaterThanOrEqual(90);
      });
    });
  });

  it("renders safely for every active theme", () => {
    themes.forEach((candidate) => {
      SYLLABUS_TEMPLATES.forEach((template) => {
        const html = renderSyllabus(template.id, content, candidate);
        const result = validateSyllabus(html, { knownTargets, includeContactHours: true });
        expect(result.failures, `${candidate.id} ${template.id}`).toBe(0);
      });
    });
  });

  it("neutralizes dangerous syllabus links", () => {
    expect(safeSyllabusHref("javascript:alert(1)")).toBe("#");
    expect(safeSyllabusHref("vbscript:msgbox")).toBe("#");
    expect(safeSyllabusHref("data:text/html;base64,abc")).toBe("#");
    expect(safeSyllabusHref("course-calendar-and-workload-plan.html")).toBe("course-calendar-and-workload-plan.html");
  });

  it("builds a substantive student-facing default syllabus", () => {
    expect(content.courseDescription.length).toBeGreaterThan(context.description.length + 180);
    expect(content.courseDescription).toContain("guided path");
    expect(content.requiredMaterials.join(" ")).not.toMatch(/Instructor will add required textbook/i);
    expect(content.gradingBreakdown).toContain(
      "Engagement and Discussions: 20%. This category grades active course conversation: prepared first posts, evidence-based replies, respectful disagreement, and the habit of connecting classmates' ideas back to AI and Modern Society."
    );
    expect(content.assignmentOverview.join(" ")).toContain("A strong discussion post makes a claim");
    expect(content.aiUsePolicy).toContain("They may not replace required reading");
  });

  it("re-themes builder HTML while preserving custom HTML", () => {
    const state = createSyllabusState(content, "standard-university", "purple-innovation", "2026-01-01T00:00:00.000Z");
    const greenTheme = getTheme("green-growth");
    expect(rethemeSyllabusHtml(state, greenTheme)).toContain(greenTheme.accent);
    expect(rethemeSyllabusHtml({ ...state, mode: "custom" }, greenTheme)).toBeNull();
  });

  it("keeps deterministic revise actions renderable and valid", () => {
    SYLLABUS_REVISE_ACTIONS.forEach((action) => {
      const revised = reviseSyllabusContent(action.id, content, context);
      const result = validateSyllabus(renderSyllabus("standard-university", revised, theme), { knownTargets, includeContactHours: true });
      expect(result.failures, action.id).toBe(0);
    });
  });
});
