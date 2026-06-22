import type { CourseProject, CourseQualityCategory, CourseQualityItem, CourseQualityReport } from "../types";
import { hasUnsafeHtml } from "./htmlSafety";
import { buildReadinessReport } from "./readiness";

const categoryLabels: Record<CourseQualityCategory, string> = {
  completeness: "Completeness",
  accessibility: "Accessibility",
  outcomeAlignment: "Outcome alignment",
  workloadBalance: "Workload balance",
  assessmentVariety: "Assessment variety",
  instructorReadiness: "Instructor readiness",
  studentClarity: "Student clarity",
  canvasCompatibility: "Canvas compatibility",
  syllabusQuality: "Syllabus quality",
  rubricQuality: "Rubric quality",
  moduleLearningPath: "Module learning path",
  exportReadiness: "Export readiness"
};

const scoreFromIssues = (base: number, issues: string[], penalty = 8): number => Math.max(0, Math.min(100, base - issues.length * penalty));

const item = (category: CourseQualityCategory, score: number, reason: string, issues: string[], recommendedFixes: string[], autoFixAvailable = true): CourseQualityItem => ({
  category,
  label: categoryLabels[category],
  score,
  reason,
  issues,
  recommendedFixes,
  autoFixAvailable
});

const contentModules = (course: CourseProject) => course.modules.filter((module) => module.kind === "content");

const dateOnly = (iso?: string): string | undefined => iso?.slice(0, 10);

const dueDateInsideConfiguredTerm = (iso: string | undefined, start?: string, end?: string): boolean => {
  const value = dateOnly(iso);
  if (!value) return false;
  if (start && value < start) return false;
  if (end && value > end) return false;
  return true;
};

const moduleHasPage = (course: CourseProject, moduleId: string, pattern: RegExp): boolean =>
  course.pages.some((page) => page.moduleId === moduleId && pattern.test(`${page.title} ${page.bodyHtml}`));

export const buildCourseQualityReport = (course: CourseProject): CourseQualityReport => {
  const modules = contentModules(course);
  const readiness = buildReadinessReport(course);
  const htmlBlocks = [
    ...course.pages.map((page) => ({ title: page.title, html: page.bodyHtml })),
    ...course.assignments.map((assignment) => ({ title: assignment.title, html: assignment.descriptionHtml })),
    ...course.discussions.map((discussion) => ({ title: discussion.title, html: discussion.promptHtml }))
  ];
  const gradedItems = [
    ...course.assignments.map((assignment) => ({ title: assignment.title, outcomes: assignment.alignedOutcomeIds, rubricId: assignment.rubricId, dueAt: assignment.dueAt, type: "assignment" })),
    ...course.discussions.filter((discussion) => discussion.points > 0).map((discussion) => ({ title: discussion.title, outcomes: discussion.alignedOutcomeIds, rubricId: discussion.rubricId, dueAt: discussion.dueAt, type: "discussion" })),
    ...course.quizzes.filter((quiz) => quiz.points > 0).map((quiz) => ({ title: quiz.title, outcomes: quiz.alignedOutcomeIds, rubricId: undefined, dueAt: quiz.dueAt, type: "quiz" }))
  ];
  const syllabus = course.pages.find((page) => page.slug === "syllabus");
  const calendarPage = course.pages.find((page) => page.slug === "course-calendar-and-workload-plan");
  const alignmentMapPage = course.pages.find((page) => page.slug === "outcome-and-assessment-alignment-map");
  const instructorModule = course.modules.find((module) => module.kind === "instructor");
  const finalModule = course.modules.find((module) => module.kind === "final");
  const scheduleSettings = course.settings.schedule;
  const blockedDates = new Set([...(scheduleSettings.holidays ?? []), ...(scheduleSettings.blackoutDates ?? [])]);
  const reviewPriorities = new Set(course.reviewChecklist.map((checklistItem) => checklistItem.priority));
  const humanReviewPage = course.pages.find((page) => page.slug === "before-publishing-human-review-checklist");

  const completenessIssues = [
    ...modules.filter((module) => !moduleHasPage(course, module.id, /Mini-Lecture/i)).map((module) => `${module.title} is missing a substantive lesson page.`),
    ...modules.filter((module) => course.resources.filter((resource) => resource.moduleId === module.id).length < 3).map((module) => `${module.title} has fewer than three structured resources.`),
    ...modules.filter((module) => !moduleHasPage(course, module.id, /Practice Activity/i)).map((module) => `${module.title} is missing practice activity content.`),
    ...(finalModule ? [] : ["Final module is missing."])
  ];

  const accessibilityIssues = [
    ...htmlBlocks.filter((block) => hasUnsafeHtml(block.html)).map((block) => `${block.title} contains Canvas-hostile HTML.`),
    ...course.resources.filter((resource) => /video|podcast/.test(resource.type) && !/caption|transcript/i.test(`${resource.instructorEditNote} ${resource.placeholder}`)).map((resource) => `${resource.title} needs caption or transcript guidance.`)
  ];

  const alignmentIssues = gradedItems.filter((entry) => entry.outcomes.length === 0).map((entry) => `${entry.title} is missing outcome alignment.`);
  const missingDueDates = scheduleSettings.enableDueDates ? gradedItems.filter((entry) => !entry.dueAt) : [];
  const blockedDueDates = scheduleSettings.enableDueDates
    ? gradedItems.filter((entry) => entry.dueAt && blockedDates.has(dateOnly(entry.dueAt) ?? ""))
    : [];
  const outOfTermDueDates =
    scheduleSettings.enableDueDates && !scheduleSettings.allowDueDatesOutsideTerm
      ? gradedItems.filter((entry) => entry.dueAt && !dueDateInsideConfiguredTerm(entry.dueAt, scheduleSettings.termStartDate, scheduleSettings.termEndDate))
      : [];
  const workloadIssues = [
    ...(course.contactHours.totalHours <= 0 ? ["Contact hour plan is missing."] : []),
    ...(course.schedule.length < modules.length ? ["Schedule entries do not cover all content modules."] : []),
    ...(calendarPage ? [] : ["Student-facing calendar and workload page is missing."]),
    ...(calendarPage && /Schedule Table|Generated module calendar/i.test(calendarPage.bodyHtml) ? [] : ["Calendar page is missing the generated schedule table."]),
    ...modules.filter((module) => module.workloadHours <= 0).map((module) => `${module.title} has no workload estimate.`),
    ...(scheduleSettings.enableDueDates && !scheduleSettings.termStartDate ? ["Due dates are enabled, but no term start date is configured."] : []),
    ...missingDueDates.map((entry) => `${entry.title} is missing a generated due date.`),
    ...blockedDueDates.map((entry) => `${entry.title} lands on a holiday or blackout date.`),
    ...outOfTermDueDates.map((entry) => `${entry.title} is outside the configured term.`)
  ];
  const varietyTypes = new Set(gradedItems.map((entry) => entry.type));
  const assessmentIssues = [
    ...(varietyTypes.size < 3 ? ["Generated course should include at least three graded activity types when settings allow."] : []),
    ...course.quizzes.filter((quiz) => quiz.questions.length < Math.min(5, course.settings.quizQuestionsPerQuiz)).map((quiz) => `${quiz.title} has too few questions.`),
    ...course.quizzes.filter((quiz) => quiz.questions.some((question) => !question.correctFeedback || !question.incorrectFeedback)).map((quiz) => `${quiz.title} has questions missing feedback.`)
  ];
  const instructorIssues = [
    ...(instructorModule?.publishState === "unpublished" ? [] : ["Instructor module must be unpublished."]),
    ...(course.pages.some((page) => page.slug === "instructor-module-teaching-notes") ? [] : ["Instructor module teaching notes page is missing."]),
    ...(alignmentMapPage ? [] : ["Outcome and assessment alignment map is missing."]),
    ...(alignmentMapPage?.publishState === "unpublished" ? [] : ["Outcome and assessment alignment map must remain unpublished."]),
    ...(alignmentMapPage && /Outcome Alignment Table|Gradebook Group Summary/i.test(alignmentMapPage.bodyHtml) ? [] : ["Outcome and assessment alignment map is missing alignment or gradebook evidence."]),
    ...(course.reviewChecklist.length >= 10 ? [] : ["Human publishing checklist needs more concrete review items."]),
    ...(["must", "recommended", "optional"] as const)
      .filter((priority) => !reviewPriorities.has(priority))
      .map((priority) => `Human publishing checklist is missing ${priority} priority items.`),
    ...(humanReviewPage?.publishState === "unpublished" ? [] : ["Human review checklist page must remain unpublished."])
  ];
  const studentClarityIssues = [
    ...(course.pages.some((page) => page.slug === "course-success-guide") ? [] : ["Course Success Guide is missing."]),
    ...(calendarPage ? [] : ["Course Calendar and Workload Plan is missing."]),
    ...course.assignments.filter((assignment) => !/Scenario|Deliverable Requirements|Submission Instructions/i.test(assignment.descriptionHtml)).map((assignment) => `${assignment.title} is missing student-facing assignment detail.`),
    ...course.discussions.filter((discussion) => !/Initial Post|Replies|Grading Criteria/i.test(discussion.promptHtml)).map((discussion) => `${discussion.title} is missing clear discussion expectations.`)
  ];
  const canvasIssues = [
    ...(readiness.checks.find((check) => check.id === "module-refs")?.passed ? [] : ["Module item references do not all resolve."]),
    ...(readiness.checks.find((check) => check.id === "navigation")?.passed ? [] : ["Canvas navigation defaults need review."]),
    ...(readiness.checks.find((check) => check.id === "accessibility")?.passed ? [] : ["Canvas-hostile HTML detected."])
  ];
  const syllabusIssues = [
    ...(syllabus ? [] : ["Syllabus page is missing."]),
    ...(syllabus && /Late Work Policy|Academic Integrity and AI Use|Weekly Schedule|Technology Requirements|Help and Support/i.test(syllabus.bodyHtml) ? [] : ["Syllabus is missing required policy or schedule sections."])
  ];
  const rubricIssues = [
    ...course.rubrics.filter((rubric) => rubric.criteria.length < 3).map((rubric) => `${rubric.title} has fewer than three criteria.`),
    ...course.rubrics.filter((rubric) => rubric.alignedOutcomeIds.length === 0).map((rubric) => `${rubric.title} is missing outcome alignment.`),
    ...gradedItems.filter((entry) => (entry.type === "assignment" || entry.type === "discussion") && !entry.rubricId).map((entry) => `${entry.title} is missing a rubric.`)
  ];
  const pathIssues = [
    ...modules.filter((module) => !module.items.some((moduleItem) => /(Overview|About )/i.test(moduleItem.title))).map((module) => `${module.title} is missing an overview item.`),
    ...modules.filter((module) => !module.items.some((moduleItem) => /Readings and Resources/i.test(moduleItem.title))).map((module) => `${module.title} is missing a resource item.`),
    ...modules.filter((module) => !module.items.some((moduleItem) => /Practice Activity/i.test(moduleItem.title))).map((module) => `${module.title} is missing a practice item.`),
    ...modules.filter((module) => !module.items.some((moduleItem) => /(Wrap|Recap|End of )/i.test(moduleItem.title))).map((module) => `${module.title} is missing a recap item.`)
  ];
  const exportIssues = readiness.checks.filter((check) => !check.passed && check.severity === "required").map((check) => check.label);

  const categories = [
    item("completeness", scoreFromIssues(100, completenessIssues, 5), "Checks lesson, resource, practice, and final-module completeness.", completenessIssues, ["Regenerate generated module content or add missing pages/resources."]),
    item("accessibility", scoreFromIssues(100, accessibilityIssues, 8), "Checks unsafe HTML and media accessibility guidance.", accessibilityIssues, ["Remove unsafe embeds/scripts and add captions/transcript prompts."]),
    item("outcomeAlignment", scoreFromIssues(100, alignmentIssues, 7), "Checks graded item outcome alignment.", alignmentIssues, ["Attach outcomes to each graded item."]),
    item("workloadBalance", scoreFromIssues(95, workloadIssues, 5), "Checks contact hours, module workload, and schedule coverage.", workloadIssues, ["Adjust workload estimates and schedule entries."]),
    item("assessmentVariety", scoreFromIssues(95, assessmentIssues, 5), "Checks graded activity variety, quiz volume, and feedback.", assessmentIssues, ["Generate or edit quiz questions and graded activity mix."]),
    item("instructorReadiness", scoreFromIssues(100, instructorIssues, 8), "Checks unpublished instructor-only support materials.", instructorIssues, ["Add instructor teaching notes and keep instructor module unpublished."]),
    item("studentClarity", scoreFromIssues(100, studentClarityIssues, 5), "Checks student guides and clear activity instructions.", studentClarityIssues, ["Regenerate assignment/discussion instructions or add student support pages."]),
    item("canvasCompatibility", scoreFromIssues(100, canvasIssues, 10), "Checks Canvas-safe structure and navigation defaults.", canvasIssues, ["Fix module references, navigation, and Canvas-safe HTML."]),
    item("syllabusQuality", scoreFromIssues(100, syllabusIssues, 10), "Checks syllabus policy, schedule, and support sections.", syllabusIssues, ["Regenerate syllabus or add missing policy sections."]),
    item("rubricQuality", scoreFromIssues(100, rubricIssues, 5), "Checks rubric criteria, clarity, and alignment.", rubricIssues, ["Regenerate rubrics or attach missing rubric references."]),
    item("moduleLearningPath", scoreFromIssues(100, pathIssues, 5), "Checks default module learning path sequence.", pathIssues, ["Regenerate module structure or add missing learning-path pages."]),
    item("exportReadiness", Math.max(0, readiness.score - exportIssues.length * 3), "Uses readiness blockers as export readiness evidence.", exportIssues, ["Resolve required readiness checks before export."])
  ];

  return {
    score: Math.round(categories.reduce((sum, category) => sum + category.score, 0) / categories.length),
    checkedAt: new Date().toISOString(),
    categories
  };
};
