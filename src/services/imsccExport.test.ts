import { describe, expect, it } from "vitest";
import { defaultSettings } from "../data/defaultSettings";
import { getTheme } from "../data/themes";
import { applyThemeToGeneratedContent, generateCourseProject, sampleProject } from "./courseGenerator";
import { CALENDAR_HREF } from "./homepageTemplates";
import { PRINTABLE_HTML_HREF, PRINTABLE_PDF_HREF } from "./syllabusTemplates";
import { buildCourseQualityReport } from "./courseQuality";
import { buildImsccZip, generateImsccBlob, validateImsccZip } from "./imsccExport";
import { importCanvasCourseFromImscc } from "./imsccImport";
import { buildReadinessReport } from "./readiness";

describe("RocketCourse export engine", () => {
  it("scores a generated course as ready with Canvas-specific checks", () => {
    const report = buildReadinessReport(sampleProject);

    expect(report.score).toBeGreaterThanOrEqual(90);
    expect(report.blockers).toBe(0);
    expect(report.checks.find((check) => check.id === "assignment-groups")?.passed).toBe(true);
    expect(report.checks.find((check) => check.id === "start-here-link")?.passed).toBe(true);
    expect(report.checks.find((check) => check.id === "instructor-unpublished")?.passed).toBe(true);
  });

  it("generates the required Start Here, content, final, and unpublished instructor modules", () => {
    const start = sampleProject.modules.find((module) => module.kind === "start");
    const content = sampleProject.modules.filter((module) => module.kind === "content");
    const final = sampleProject.modules.find((module) => module.kind === "final");
    const instructor = sampleProject.modules.find((module) => module.kind === "instructor");

    expect(start?.title).toBe("Start Here");
    expect(content).toHaveLength(sampleProject.settings.moduleCount);
    expect(final?.title).toBe("Final Project");
    expect(final?.items.some((item) => item.type === "assignment")).toBe(true);
    expect(instructor?.publishState).toBe("unpublished");
    expect(instructor?.items.every((item) => item.publishState === "unpublished")).toBe(true);
  });

  it("gives every content module an About boundary, Content/Activities subheaders, and an End boundary", () => {
    const contentModules = sampleProject.modules.filter((module) => module.kind === "content");

    expect(contentModules.length).toBeGreaterThan(0);
    contentModules.forEach((module) => {
      // First item is the About page; last is the End page; the two text-header dividers are present.
      expect(module.items[0].type === "page" && /^About /i.test(module.items[0].title)).toBe(true);
      const last = module.items[module.items.length - 1];
      expect(last.type === "page" && /^End of /i.test(last.title)).toBe(true);
      expect(module.items.some((item) => item.type === "subheader" && item.title === "Module Content")).toBe(true);
      expect(module.items.some((item) => item.type === "subheader" && item.title === "Module Activities")).toBe(true);
    });
  });

  it("generates teachable module learning paths with resources, lessons, and practice", () => {
    const contentModules = sampleProject.modules.filter((module) => module.kind === "content");

    contentModules.forEach((module) => {
      expect(module.items.some((item) => /^About /i.test(item.title))).toBe(true);
      expect(module.items.some((item) => /Readings and Resources/i.test(item.title))).toBe(true);
      expect(module.items.some((item) => /Lecture and Notes/i.test(item.title))).toBe(true);
      expect(module.items.some((item) => /Practice Activity/i.test(item.title))).toBe(true);
      expect(module.items.some((item) => /^End of /i.test(item.title))).toBe(true);
      expect(sampleProject.resources.filter((resource) => resource.moduleId === module.id)).toHaveLength(3);
    });

    const lessonPages = sampleProject.pages.filter((page) => /Lecture and Notes/i.test(page.title));
    expect(lessonPages.length).toBe(contentModules.length);
    lessonPages.forEach((page) => {
      expect(page.bodyHtml).toContain("Mini-Lecture");
      expect(page.bodyHtml).toContain("Key Terms");
      expect(page.bodyHtml).toContain("Common Misconception");
      expect(page.bodyHtml).toContain("Check Your Understanding");
      // Enriched teaching content: defined key terms, a structured worked example, and why-it-matters.
      expect(page.bodyHtml).toContain("Worked Example");
      expect(page.bodyHtml).toContain("Why This Matters");
      expect(page.bodyHtml).toMatch(/<strong>[^<]+:<\/strong>/);
      expect(page.bodyHtml).toContain("Artifact:");
      expect(page.bodyHtml).toContain("<ol");
    });
  });

  it("creates a student-facing course calendar and workload page", () => {
    const calendarPage = sampleProject.pages.find((page) => page.slug === "course-calendar-and-workload-plan");
    const start = sampleProject.modules.find((module) => module.kind === "start");
    const homepage = sampleProject.pages.find((page) => page.frontPage);
    const syllabus = sampleProject.pages.find((page) => page.slug === "syllabus");
    const studentGuide = sampleProject.pages.find((page) => page.slug === "course-success-guide");

    expect(calendarPage).toBeDefined();
    expect(calendarPage?.publishState).toBe("published");
    expect(calendarPage?.bodyHtml).toContain("Schedule Table");
    expect(calendarPage?.bodyHtml).toContain("Generated module calendar");
    expect(calendarPage?.bodyHtml).toContain("<table");
    expect(calendarPage?.bodyHtml).toContain("Set by instructor");
    expect(start?.items.some((item) => item.refId === calendarPage?.id && item.title === "Course Calendar and Workload Plan")).toBe(true);
    expect(homepage?.bodyHtml).toContain(CALENDAR_HREF);
    expect(syllabus?.bodyHtml).toContain(CALENDAR_HREF);
    expect(studentGuide?.bodyHtml).toContain(CALENDAR_HREF);
    expect(buildReadinessReport(sampleProject).checks.find((check) => check.id === "calendar-page")?.passed).toBe(true);
  });

  it("wires Previous/Next module navigation with resolvable Canvas wiki tokens", () => {
    const overviews = sampleProject.pages.filter((page) => /^About /i.test(page.title) && /^module_\d+$/.test(page.moduleId ?? ""));
    expect(overviews.length).toBeGreaterThan(1);
    overviews.forEach((page) => {
      expect(page.bodyHtml).toContain("Module Navigation");
      expect(page.bodyHtml).toContain("$WIKI_REFERENCE$/pages/");
    });
    // First content module steps back to the Course Success Guide; the last steps forward to Modules.
    expect(overviews[0].bodyHtml).toContain("Back to Course Success Guide");
    expect(overviews[overviews.length - 1].bodyHtml).toContain("Continue to Modules and Final Project");
    if (overviews.length >= 3) {
      expect(overviews[1].bodyHtml).toContain("Previous:");
      expect(overviews[1].bodyHtml).toContain("Next:");
    }
  });

  it("creates generated resource briefs without fabricating citations or URLs by default", () => {
    expect(sampleProject.resources.length).toBe(sampleProject.settings.moduleCount * 3);
    sampleProject.resources.forEach((resource) => {
      expect(resource.placeholder).toMatch(/Generated source brief|Generated evidence dossier|Generated media or example prompt/i);
      expect(resource.instructorEditNote).toMatch(/Optional|replace|verified|captioned|institution-approved/i);
      expect(resource.studentInstructions.length).toBeGreaterThan(40);
    });
  });

  it("scaffolds final project checkpoints in key milestone modules", () => {
    const milestoneItems = sampleProject.modules
      .filter((module) => module.kind === "content")
      .flatMap((module) => module.items.filter((item) => /Final Project .*Checkpoint|Final Project Milestone/i.test(item.title)));

    expect(sampleProject.settings.scaffoldPattern).toBe("key-milestones");
    expect(milestoneItems.length).toBeGreaterThanOrEqual(3);
    expect(milestoneItems.every((item) => item.indent === 1)).toBe(true);
  });

  it("wires meaningful assignment groups to all graded items", () => {
    const groups = new Map(sampleProject.assignmentGroups.map((group) => [group.id, group]));
    const total = sampleProject.assignmentGroups.reduce((sum, group) => sum + group.weight, 0);

    expect(total).toBe(100);
    sampleProject.assignments.forEach((assignment) => {
      expect(groups.get(assignment.assignmentGroupId)?.weight).toBeGreaterThan(0);
    });
    sampleProject.discussions
      .filter((discussion) => discussion.points > 0)
      .forEach((discussion) => {
        expect(groups.get(discussion.assignmentGroupId)?.name).toMatch(/Discussion|Engagement/);
      });
    sampleProject.quizzes.forEach((quiz) => {
      expect(groups.get(quiz.assignmentGroupId)?.name).toMatch(/Knowledge/);
    });
  });

  it("attaches rubrics and outcomes to graded assignments and discussions", () => {
    const rubricIds = new Set(sampleProject.rubrics.map((rubric) => rubric.id));
    const outcomeIds = new Set(sampleProject.outcomes.map((outcome) => outcome.id));

    sampleProject.assignments.forEach((assignment) => {
      expect(assignment.rubricId && rubricIds.has(assignment.rubricId)).toBe(true);
      expect(assignment.alignedOutcomeIds.length).toBeGreaterThan(0);
      expect(assignment.alignedOutcomeIds.every((outcomeId) => outcomeIds.has(outcomeId))).toBe(true);
    });

    sampleProject.discussions
      .filter((discussion) => discussion.points > 0)
      .forEach((discussion) => {
        expect(discussion.rubricId && rubricIds.has(discussion.rubricId)).toBe(true);
        expect(discussion.alignedOutcomeIds.length).toBeGreaterThan(0);
      });

    sampleProject.rubrics.forEach((rubric) => {
      expect(rubric.alignedOutcomeIds.length).toBeGreaterThan(0);
      expect(rubric.alignedOutcomeIds.every((outcomeId) => outcomeIds.has(outcomeId))).toBe(true);
      expect(rubric.criteria.some((criterion) => /^Outcome criterion:/i.test(criterion.title) && criterion.outcomeId)).toBe(true);
    });
  });

  it("always generates attached rubrics for graded assignments and discussions", () => {
    const course = generateCourseProject({
      prompt: "Build me a 6-week course on Mesoamerican Warfare.",
      settings: { ...defaultSettings, includeRubrics: false, moduleCount: 6, lengthWeeks: 6, assignmentCadence: "every-module", discussionFrequency: "weekly" }
    });
    const rubricIds = new Set(course.rubrics.map((rubric) => rubric.id));

    expect(course.assignments.length).toBeGreaterThan(0);
    expect(course.discussions.filter((discussion) => discussion.points > 0).length).toBeGreaterThan(0);
    course.assignments.forEach((assignment) => expect(assignment.rubricId && rubricIds.has(assignment.rubricId)).toBe(true));
    course.discussions.filter((discussion) => discussion.points > 0).forEach((discussion) => expect(discussion.rubricId && rubricIds.has(discussion.rubricId)).toBe(true));
  });

  it("generates quiz questions with answer keys, feedback, difficulty, and alignment", () => {
    sampleProject.quizzes.forEach((quiz) => {
      expect(quiz.questions.length).toBeGreaterThanOrEqual(sampleProject.settings.quizQuestionsPerQuiz);
      quiz.questions.forEach((question) => {
        expect(question.difficulty).toBeTruthy();
        expect(question.moduleId).toBe(quiz.moduleId);
        expect(question.alignedOutcomeIds.length).toBeGreaterThan(0);
        expect(question.correctFeedback || question.feedback).toBeTruthy();
        expect(question.incorrectFeedback || question.feedback).toBeTruthy();
        if (question.type === "multiple_choice" || question.type === "true_false") {
          expect(question.correctAnswer).toBeTruthy();
        }
      });
    });
  });

  it("generates an instructor-only human review checklist before publishing", () => {
    const priorities = new Set(sampleProject.reviewChecklist.map((item) => item.priority));
    const instructor = sampleProject.modules.find((module) => module.kind === "instructor");
    const checklistPage = sampleProject.pages.find((page) => page.slug === "before-publishing-human-review-checklist");

    expect(sampleProject.reviewChecklist.length).toBeGreaterThanOrEqual(10);
    expect(priorities.has("must")).toBe(true);
    expect(priorities.has("recommended")).toBe(true);
    expect(priorities.has("optional")).toBe(true);
    expect(instructor?.items.some((item) => item.title === "Before Publishing Human Review Checklist" && item.publishState === "unpublished")).toBe(true);
    expect(checklistPage?.publishState).toBe("unpublished");
    expect(checklistPage?.bodyHtml).toContain("Must Review Before Publishing");
    expect(checklistPage?.bodyHtml).toContain("Recommended Review");
    expect(checklistPage?.bodyHtml).toContain("Optional Polish");
    expect(checklistPage?.bodyHtml).toContain("Review outcome and assessment alignment map");
  });

  it("generates an unpublished outcome and assessment alignment map for instructors", () => {
    const instructor = sampleProject.modules.find((module) => module.kind === "instructor");
    const alignmentMap = sampleProject.pages.find((page) => page.slug === "outcome-and-assessment-alignment-map");

    expect(alignmentMap).toBeDefined();
    expect(alignmentMap?.publishState).toBe("unpublished");
    expect(alignmentMap?.bodyHtml).toContain("Outcome Alignment Table");
    expect(alignmentMap?.bodyHtml).toContain("Gradebook Group Summary");
    expect(alignmentMap?.bodyHtml).toContain("CLO 1");
    expect(alignmentMap?.bodyHtml).toContain("Engagement and Discussions");
    expect(instructor?.items.some((item) => item.refId === alignmentMap?.id && item.publishState === "unpublished")).toBe(true);
    expect(buildReadinessReport(sampleProject).checks.find((check) => check.id === "alignment-map")?.passed).toBe(true);
  });

  it("keeps syllabus outcomes in sync with exported course outcomes", () => {
    const syllabus = sampleProject.pages.find((page) => page.slug === "syllabus");

    expect(syllabus).toBeDefined();
    sampleProject.outcomes.forEach((outcome) => {
      expect(syllabus?.bodyHtml).toContain(outcome.code);
      expect(syllabus?.bodyHtml).toContain(outcome.text);
    });
    expect(syllabus?.bodyHtml).toContain("Weekly Schedule");
    expect(syllabus?.bodyHtml).toContain("Late Work Policy");
    expect(syllabus?.bodyHtml).toContain("Academic Integrity Policy");
    expect(syllabus?.bodyHtml).toContain("AI Use Policy");
    expect(syllabus?.bodyHtml).toContain("Technology Requirements");
  });

  it("scores representative generated courses above the production quality thresholds implemented so far", () => {
    const thresholdByCategory = {
      completeness: 90,
      accessibility: 95,
      outcomeAlignment: 90,
      workloadBalance: 85,
      assessmentVariety: 85,
      instructorReadiness: 90,
      studentClarity: 90,
      canvasCompatibility: 95,
      exportReadiness: 95
    };
    const courses = [
      sampleProject,
      generateCourseProject({
        prompt: "Build me a 4-week professional course on Community Health Program Design.",
        settings: { ...defaultSettings, courseLengthPreset: "4-weeks", lengthWeeks: 4, moduleCount: 4, organizationPattern: "weeks", assignmentCadence: "every-module" }
      }),
      generateCourseProject({
        prompt: "Build me an 8-module course on Museum Exhibit Planning with quizzes and discussions.",
        settings: { ...defaultSettings, courseLengthPreset: "8-weeks", lengthWeeks: 8, moduleCount: 8, quizFrequency: "module", discussionFrequency: "module", assignmentCadence: "every-other-module" }
      }),
      generateCourseProject({
        prompt: "Build me a quiz-heavy 6-week course on Data Literacy.",
        settings: { ...defaultSettings, courseLengthPreset: "6-weeks", lengthWeeks: 6, moduleCount: 6, quizFrequency: "module", discussionFrequency: "none", assignmentCadence: "custom" }
      })
    ];

    courses.forEach((course) => {
      const report = buildCourseQualityReport(course);
      Object.entries(thresholdByCategory).forEach(([category, threshold]) => {
        const score = report.categories.find((item) => item.category === category)?.score;
        expect(score, `${course.title} ${category}`).toBeGreaterThanOrEqual(threshold);
      });
    });
  });

  it("builds and validates an imscc package with Canvas-oriented files", async () => {
    const zip = await buildImsccZip(sampleProject);
    const report = await validateImsccZip(sampleProject, zip);
    const moduleMeta = await zip.file("course_settings/module_meta.xml")?.async("text");
    const courseSettingsXml = await zip.file("course_settings/course_settings.xml")?.async("text");
    const navigationXml = await zip.file("course_settings/course_navigation.xml")?.async("text");
    const syllabusHtml = await zip.file("course_settings/syllabus.html")?.async("text");
    const printableHtml = await zip.file("web_resources/syllabus-printable.html")?.async("text");

    expect(report.valid).toBe(true);
    // Every internal link/banner/file link resolves to a real object or packaged file, so the
    // package must carry zero broken-internal-link findings.
    expect(report.issues.filter((issue) => issue.id.startsWith("broken-internal-link"))).toHaveLength(0);
    expect(report.packageName.endsWith(".imscc")).toBe(true);
    expect(report.files).toContain("imsmanifest.xml");
    expect(report.files).toContain("course_settings/canvas_export.txt");
    expect(report.files).toContain("course_settings/course_settings.xml");
    expect(report.files).toContain("course_settings/module_meta.xml");
    expect(report.files).toContain("course_settings/assignment_groups.xml");
    expect(report.files).toContain("course_settings/rubrics.xml");
    expect(report.files).toContain("course_settings/learning_outcomes.xml");
    expect(report.files).toContain("course_settings/course_navigation.xml");
    expect(report.files).toContain("course_settings/syllabus.html");
    expect(report.files).toContain("web_resources/syllabus-printable.html");
    expect(report.files).toContain("web_resources/syllabus-printable.pdf");
    expect(report.files).toContain("web_resources/instructor-guide.pdf");
    expect(report.files).toContain("web_resources/course-tile.svg");
    expect(report.files).not.toContain("rubrics.xml");
    expect(report.files).not.toContain("assessment_qti.xml");
    expect(courseSettingsXml).toContain(
      '<tab_configuration>[{"id":0},{"id":14},{"id":1},{"id":10},{"id":5},{"id":6},{"id":3,"hidden":true},{"id":8,"hidden":true},{"id":4,"hidden":true},{"id":2,"hidden":true},{"id":11,"hidden":true},{"id":15,"hidden":true},{"id":17,"hidden":true},{"id":16,"hidden":true},{"id":12,"hidden":true},{"id":13,"hidden":true}]</tab_configuration>'
    );
    ["Home", "Announcements", "Syllabus", "Modules", "Grades", "People"].forEach((label) => {
      expect(navigationXml).toContain(`<label>${label}</label>`);
      expect(navigationXml).toContain("<hidden>false</hidden>");
    });
    ["Assignments", "Discussions", "Quizzes", "Pages", "Files", "Outcomes", "Rubrics", "Collaborations", "Conferences"].forEach((label) => {
      expect(navigationXml).toContain(`<label>${label}</label>`);
    });
    const firstAssignment = sampleProject.assignments[0];
    const assignmentSettings = await zip.file(firstAssignment ? `assignment_${firstAssignment.id.replace(/^assignment_/, "")}/assignment_settings.xml` : "")?.async("text");
    const firstGradedDiscussion = sampleProject.discussions.find((discussion) => discussion.points > 0);
    const discussionMeta = await zip.file(firstGradedDiscussion ? `${firstGradedDiscussion.id}_meta.xml` : "")?.async("text");
    const rubricsXml = await zip.file("course_settings/rubrics.xml")?.async("text");
    expect(assignmentSettings).toContain("<rubric_identifierref>");
    expect(assignmentSettings).toContain("<rubric_use_for_grading>true</rubric_use_for_grading>");
    expect(assignmentSettings).toContain("<rubric_hide_points>false</rubric_hide_points>");
    expect(discussionMeta).toContain("<rubric_identifierref>");
    expect(discussionMeta).toContain("<rubric_use_for_grading>true</rubric_use_for_grading>");
    expect(rubricsXml).toContain("<hide_score_total>false</hide_score_total>");
    expect(rubricsXml).toContain("<rating_order>descending</rating_order>");
    expect(rubricsXml).toContain("<learning_outcome_identifierref>");
    expect(rubricsXml).toContain("Outcome criterion:");
    expect(report.files).toContain("quiz_1/assessment_qti.xml");
    expect(report.files).toContain("quiz_1/assessment_meta.xml");
    expect(report.files).toContain("non_cc_assessments/quiz_1.xml.qti");
    expect(report.files.some((file) => file.startsWith("wiki_content/"))).toBe(true);
    expect(moduleMeta).toContain("<title>Instructor Guide</title>");
    expect(moduleMeta).toContain("<workflow_state>unpublished</workflow_state>");
    expect(syllabusHtml).toContain(PRINTABLE_HTML_HREF);
    expect(syllabusHtml).toContain(PRINTABLE_PDF_HREF);
    expect(syllabusHtml).not.toContain("$IMS-CC-FILEBASE$/syllabus-printable");
    expect(syllabusHtml).toContain(sampleProject.pages.find((page) => page.slug === "syllabus")?.bodyHtml);
    expect(printableHtml).toContain("<title>Printable Syllabus</title>");
    expect(printableHtml).toContain(sampleProject.title);
    expect(report.sandboxImportStatus).toBe("not_tested");
  });

  it("uses Canvas course links in the welcome announcement", async () => {
    const zip = await buildImsccZip(sampleProject);
    const announcement = sampleProject.announcements[0];
    const xml = (await zip.file(`${announcement.id}.xml`)?.async("text")) ?? "";

    expect(xml).toContain("$CANVAS_OBJECT_REFERENCE$/modules/module_start");
    expect(xml).toContain("$CANVAS_OBJECT_REFERENCE$/discussion_topics/discussion_introduce_yourself");
    expect(xml).toContain("$WIKI_REFERENCE$/pages/page_course_success_guide");
    expect(xml).toContain("$WIKI_REFERENCE$/pages/page_syllabus");
    expect(xml).toContain("$WIKI_REFERENCE$/pages/page_course_calendar_workload_plan");
    expect(xml).not.toContain("Open the Start Here module, read the Course Success Guide");
    expect(xml).not.toContain("Post in the Introduce Yourself discussion");
  });

  it("carries refreshed theme styling into exported Canvas assets and syllabus content", async () => {
    const theme = getTheme("stem-lab");
    const themedProject = applyThemeToGeneratedContent(sampleProject, theme);
    const zip = await buildImsccZip(themedProject);
    const bannerSvg = (await zip.file("web_resources/course-banner.svg")?.async("text")) ?? "";
    const courseSettingsXml = (await zip.file("course_settings/course_settings.xml")?.async("text")) ?? "";
    const syllabusHtml = (await zip.file("course_settings/syllabus.html")?.async("text")) ?? "";

    // The banner is now a themed gradient (accent -> accentDark) rather than a flat soft fill.
    expect(bannerSvg).toContain(theme.accent);
    expect(bannerSvg).toContain(theme.accentDark);
    expect(bannerSvg).toContain("linearGradient");
    expect(bannerSvg).toContain(theme.bannerLabel);
    expect(courseSettingsXml).toContain(`<course_color>${theme.accent}</course_color>`);
    expect(syllabusHtml).toContain(theme.accentDark);
    expect(syllabusHtml).not.toMatch(/RocketCourse|theme-choice|theme-preview-tabs/);
  });

  it("exports auto-graded QTI with choices, answer keys, and feedback Canvas can import", async () => {
    const zip = await buildImsccZip(sampleProject);
    const quiz = sampleProject.quizzes[0];
    const canvasQti = (await zip.file(`non_cc_assessments/${quiz.id}.xml.qti`)?.async("text")) ?? "";
    const ccQti = (await zip.file(`${quiz.id}/assessment_qti.xml`)?.async("text")) ?? "";

    const choiceQuestion = quiz.questions.find(
      (question) => (question.type === "multiple_choice" || question.type === "true_false") && question.choices?.length
    );
    expect(choiceQuestion).toBeDefined();
    const correctIndex = (choiceQuestion!.choices ?? []).findIndex((choice) => choice === choiceQuestion!.correctAnswer);
    const correctLabel = `${choiceQuestion!.id}_a${correctIndex + 1}`;

    [canvasQti, ccQti].forEach((qti) => {
      // Choices are rendered and the answer key points at the correct label.
      expect(qti).toContain(`<response_lid ident="response_${choiceQuestion!.id}"`);
      (choiceQuestion!.choices ?? []).forEach((choice) => expect(qti).toContain(choice));
      expect(qti).toContain(`<varequal respident="response_${choiceQuestion!.id}">${correctLabel}</varequal>`);
      expect(qti).toContain('<setvar action="Set" varname="SCORE">100</setvar>');
      expect(qti).toContain(`<itemfeedback ident="${choiceQuestion!.id}_correct_fb">`);
    });

    // Canvas reads native question_type values, never the internal type names.
    expect(canvasQti).toContain("<fieldentry>multiple_choice_question</fieldentry>");
    expect(canvasQti).not.toContain("<fieldentry>multiple_choice</fieldentry>");
    expect(canvasQti).not.toContain("<fieldentry>short_answer</fieldentry>");
    // The cc-flavored package carries Common Cartridge profiles.
    expect(ccQti).toContain("<fieldentry>cc.multiple_choice.v0p1</fieldentry>");
  });

  it("emits open-response quiz questions as manually graded essay items", async () => {
    const zip = await buildImsccZip(sampleProject);
    const quiz = sampleProject.quizzes[0];
    const canvasQti = (await zip.file(`non_cc_assessments/${quiz.id}.xml.qti`)?.async("text")) ?? "";
    const openQuestion = quiz.questions.find((question) => question.type === "short_answer" || question.type === "essay");

    expect(openQuestion).toBeDefined();
    expect(canvasQti).toContain(`<response_str ident="response_${openQuestion!.id}"`);
    expect(canvasQti).toContain(`<render_fib><response_label ident="${openQuestion!.id}_answer"`);
    expect(canvasQti).toContain("<fieldentry>essay_question</fieldentry>");
  });

  it("does not double-escape HTML entities in plain-text assignment descriptions", async () => {
    const checkProject = generateCourseProject({
      prompt: "Build me a 4-week course on Grant Writing.",
      settings: { ...defaultSettings, moduleCount: 4, lengthWeeks: 4, courseLengthPreset: "4-weeks", assignmentCadence: "every-module" }
    });
    const zip = await buildImsccZip(checkProject);
    const assignment = checkProject.assignments[0];
    const settingsXml = (await zip.file(`${assignment.id}/assignment_settings.xml`)?.async("text")) ?? "";

    // stripHtml decodes entities before escapeXml runs again, so the checkmark entity
    // must never reach the package as the double-escaped literal "&amp;#10003;".
    expect(settingsXml).not.toContain("&amp;#");
  });

  it("exports Canvas due date metadata when scheduling is enabled", async () => {
    const scheduledProject = generateCourseProject({
      prompt: "Build me a 4-week professional course on Community Health Program Design.",
      settings: {
        ...defaultSettings,
        courseLengthPreset: "4-weeks",
        lengthWeeks: 4,
        moduleCount: 4,
        organizationPattern: "weeks",
        assignmentCadence: "every-module",
        schedule: {
          ...defaultSettings.schedule,
          enableDueDates: true,
          termStartDate: "2026-08-24",
          termEndDate: "2026-12-12",
          holidays: ["2026-09-07"],
          blackoutDates: ["2026-10-12"],
          moduleReleaseDay: 1,
          preferredDueDay: 0,
          preferredDueTime: "23:59"
        }
      }
    });
    const gradedDueDates = [
      ...scheduledProject.assignments.map((assignment) => assignment.dueAt),
      ...scheduledProject.discussions.filter((discussion) => discussion.points > 0).map((discussion) => discussion.dueAt),
      ...scheduledProject.quizzes.map((quiz) => quiz.dueAt)
    ];
    const blockedDates = new Set([...scheduledProject.settings.schedule.holidays, ...scheduledProject.settings.schedule.blackoutDates]);
    const zip = await buildImsccZip(scheduledProject);
    const report = await validateImsccZip(scheduledProject, zip);
    const assignmentSettingsXml = await zip.file(`${scheduledProject.assignments[0].id}/assignment_settings.xml`)?.async("text");
    const discussion = scheduledProject.discussions.find((item) => item.points > 0);
    const discussionMetaXml = discussion ? await zip.file(`${discussion.id}_meta.xml`)?.async("text") : "";
    const quizMetaXml = await zip.file(`${scheduledProject.quizzes[0].id}/assessment_meta.xml`)?.async("text");

    expect(gradedDueDates.every(Boolean)).toBe(true);
    expect(gradedDueDates.every((dueAt) => dueAt && !blockedDates.has(dueAt.slice(0, 10)))).toBe(true);
    expect(buildReadinessReport(scheduledProject).checks.find((check) => check.id === "graded-due-dates")?.passed).toBe(true);
    expect(report.valid).toBe(true);
    expect(assignmentSettingsXml).toContain("<due_at>");
    expect(discussionMetaXml).toContain("<due_at>");
    expect(quizMetaXml).toContain("<due_at>");
    expect(scheduledProject.pages.find((page) => page.slug === "course-calendar-and-workload-plan")?.bodyHtml).toContain("2026-08-24");
  });

  it("fails validation when due dates are enabled but graded due dates are missing", async () => {
    const scheduledProject = generateCourseProject({
      prompt: "Build me a 4-week course on Grant Writing.",
      settings: {
        ...defaultSettings,
        courseLengthPreset: "4-weeks",
        lengthWeeks: 4,
        moduleCount: 4,
        schedule: {
          ...defaultSettings.schedule,
          enableDueDates: true,
          termStartDate: "2026-08-24",
          termEndDate: "2026-12-12"
        }
      }
    });
    const brokenProject = {
      ...scheduledProject,
      assignments: scheduledProject.assignments.map((assignment, index) => (index === 0 ? { ...assignment, dueAt: undefined } : assignment))
    };
    const zip = await buildImsccZip(brokenProject);
    const report = await validateImsccZip(brokenProject, zip);

    expect(report.valid).toBe(false);
    expect(report.issues.some((issue) => issue.id.startsWith("due-date-missing-"))).toBe(true);
  });

  it("validates changed-content export mode with required dependencies included", async () => {
    const { report } = await generateImsccBlob({ ...sampleProject, exportMode: "changed" }, "changed");

    expect(report.valid).toBe(true);
    expect(report.files).toContain("course_settings/assignment_groups.xml");
    expect(report.files).toContain("course_settings/rubrics.xml");
    expect(report.files).toContain("course_settings/learning_outcomes.xml");
    expect(report.files).toContain("web_resources/syllabus-printable.pdf");
    expect(report.files).toContain("web_resources/instructor-guide.pdf");
  });

  it("warns when exported Canvas HTML points to missing internal content", async () => {
    const brokenProject = {
      ...sampleProject,
      pages: sampleProject.pages.map((page) =>
        page.frontPage ? { ...page, bodyHtml: `${page.bodyHtml}<p><a href="missing-page.html">Broken internal link</a></p>` } : page
      )
    };
    const zip = await buildImsccZip(brokenProject);
    const report = await validateImsccZip(brokenProject, zip);

    expect(report.valid).toBe(true);
    expect(report.issues.some((issue) => issue.id.startsWith("broken-internal-link") && issue.severity === "warning")).toBe(true);
  });

  it("caps the warning penalty so a valid, importable package never scores near zero", async () => {
    // Many advisory warnings (unresolved internal links) but zero blocking errors.
    const brokenLinks = Array.from({ length: 20 }, (_, index) => `<a href="missing-${index}.html">Broken link ${index}</a>`).join(" ");
    const warnedProject = {
      ...sampleProject,
      pages: sampleProject.pages.map((page) => (page.frontPage ? { ...page, bodyHtml: `${page.bodyHtml}<p>${brokenLinks}</p>` } : page))
    };
    const zip = await buildImsccZip(warnedProject);
    const report = await validateImsccZip(warnedProject, zip);

    const errorCount = report.issues.filter((issue) => issue.severity === "error").length;
    const warningCount = report.issues.filter((issue) => issue.severity === "warning").length;

    // No errors → the package imports. A pile of advisory warnings must not collapse the score:
    // the warning penalty is capped, so a valid package floors at 70 rather than "passed (score 0)".
    expect(errorCount).toBe(0);
    expect(warningCount).toBeGreaterThanOrEqual(10);
    expect(report.valid).toBe(true);
    expect(report.score).toBeGreaterThanOrEqual(70);
  });

  it("auto-repairs module item / object drift so export still produces a valid package", async () => {
    const sourceModule = sampleProject.modules.find((module) => module.items.some((item) => item.type === "assignment"));
    const assignmentItem = sourceModule?.items.find((item) => item.type === "assignment");
    const targetModule = sampleProject.modules.find((module) => module.id !== sourceModule?.id && module.kind === "content");
    expect(sourceModule).toBeDefined();
    expect(assignmentItem).toBeDefined();
    expect(targetModule).toBeDefined();
    // Drift the assignment's moduleId away from the module its item actually lives in.
    const driftedProject = {
      ...sampleProject,
      assignments: sampleProject.assignments.map((assignment) => (assignment.id === assignmentItem?.refId ? { ...assignment, moduleId: targetModule!.id } : assignment))
    };
    const zip = await buildImsccZip(driftedProject);
    const report = await validateImsccZip(driftedProject, zip);

    // The export path repairs the drift (re-syncs the assignment to the module it appears in), so the
    // package no longer carries an alignment error. Readiness still flags drift for the user separately.
    expect(report.issues.some((issue) => issue.id.startsWith("module-object-alignment-"))).toBe(false);
  });

  it("recovers Canvas module metadata when importing an imscc package", async () => {
    const sourceProject = generateCourseProject({
      prompt: "Build me a 4-week course on Digital Storytelling.",
      settings: { ...defaultSettings, moduleCount: 4, lengthWeeks: 4, courseLengthPreset: "4-weeks" }
    });
    const zip = await buildImsccZip(sourceProject);
    const blob = await zip.generateAsync({ type: "blob", mimeType: "application/zip" });
    const result = await importCanvasCourseFromImscc(new File([blob], "digital-storytelling.imscc"), defaultSettings);

    expect(result.notes.some((note) => /Recovered Canvas module structure/.test(note))).toBe(true);
    expect(result.course.modules.some((module) => module.title.includes("Week 1") && module.items.some((item) => item.title.includes("About")))).toBe(true);
    expect(result.course.pages.some((page) => page.slug === "syllabus")).toBe(true);
  });

  it("fails validation when the manifest declares duplicate resource identifiers", async () => {
    const course = structuredClone(sampleProject);
    const duplicateId = course.pages[0].id;
    course.pages = course.pages.map((page, index) => (index === 1 ? { ...page, id: duplicateId } : page));
    const zip = await buildImsccZip(course);
    const report = await validateImsccZip(course, zip);

    expect(report.issues.some((issue) => issue.id === `duplicate-resource-${duplicateId}`)).toBe(true);
    expect(report.valid).toBe(false);
  });

  it("fails validation when a required file is present but empty", async () => {
    const zip = await buildImsccZip(sampleProject);
    zip.file("course_settings/syllabus.html", "   ");
    const report = await validateImsccZip(sampleProject, zip);

    expect(report.issues.some((issue) => issue.id === "empty-required-course_settings/syllabus.html" && issue.severity === "error")).toBe(true);
    expect(report.valid).toBe(false);
  });

  it("keeps the generated sample package free of duplicate-identifier and empty-file errors", async () => {
    const zip = await buildImsccZip(sampleProject);
    const report = await validateImsccZip(sampleProject, zip);

    expect(report.issues.some((issue) => issue.id.startsWith("duplicate-resource-"))).toBe(false);
    expect(report.issues.some((issue) => issue.id.startsWith("empty-required-"))).toBe(false);
  });
});
