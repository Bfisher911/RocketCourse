import type { CourseProject, ModuleItemType, ReadinessCheck, ReadinessReport } from "../types";
import { slugify, stripHtml } from "../utils/text";
import { hasUnsafeHtml, headingOrderIssues, imageTagsMissingAltCount, malformedLinksFromHtml } from "./htmlSafety";
import { validateAssignmentPlan } from "./assignmentBuilder";
import { validateDiscussionPlan } from "./discussionBuilder";
import { validateModulePlan } from "./modulePlanner";
import { validatePagePlan } from "./pageBuilder";
import { validateQuizPlan } from "./quizBuilder";
import { validateRubricPlan } from "./rubricBuilder";
import { validateSyllabus } from "./syllabusValidation";
import { canvasRefTargets } from "./canvasLinks";
import { CALENDAR_HREF, SUCCESS_GUIDE_HREF } from "./homepageTemplates";
import { validateTheme } from "./themeDesign";
import { navigationMatchesRequiredDefaults, visibleNavigationLabels } from "./navigationDefaults";

const check = (
  id: string,
  label: string,
  passed: boolean,
  detail: string,
  severity: "required" | "recommended" = "required"
): ReadinessCheck => ({ id, label, passed, detail, severity });

const htmlBlocks = (course: CourseProject): Array<{ id: string; title: string; html: string }> => [
  ...course.pages.map((page) => ({ id: page.id, title: page.title, html: page.bodyHtml })),
  ...course.assignments.map((assignment) => ({ id: assignment.id, title: assignment.title, html: assignment.descriptionHtml })),
  ...course.discussions.map((discussion) => ({ id: discussion.id, title: discussion.title, html: discussion.promptHtml })),
  ...course.quizzes.map((quiz) => ({ id: quiz.id, title: quiz.title, html: quiz.purpose }))
];

// Body blocks whose visible text length is a meaningful signal of substance. Quiz "purpose"
// is intentionally a short summary, so it is excluded from the empty/thin-content checks.
const bodyBlocks = (course: CourseProject): Array<{ id: string; title: string; html: string }> => [
  ...course.pages.map((page) => ({ id: page.id, title: page.title, html: page.bodyHtml })),
  ...course.assignments.map((assignment) => ({ id: assignment.id, title: assignment.title, html: assignment.descriptionHtml })),
  ...course.discussions.map((discussion) => ({ id: discussion.id, title: discussion.title, html: discussion.promptHtml }))
];

// Visible (rendered) text length, after stripping markup — markup length alone would rate an
// empty <div></div> shell as substantial.
const visibleLength = (html: string): number => stripHtml(html).length;

const hrefsFrom = (html: string): string[] => Array.from(html.matchAll(/href\s*=\s*["']([^"']*)["']/gi)).map((match) => match[1].trim());

const isPlaceholderHref = (href: string): boolean => href === "" || href === "#" || /^javascript:/i.test(href) || href.includes("TODO_LINK");

const pageTargets = (course: CourseProject): Set<string> =>
  new Set(course.pages.flatMap((page) => [page.slug, `${slugify(page.slug || page.title)}.html`, `wiki_content/${slugify(page.slug || page.title)}.html`]));

const resourceTargets = (course: CourseProject): Set<string> => new Set(course.fileAssets.flatMap((asset) => [asset.path, `../${asset.path}`, asset.fileName]));

const dateOnly = (iso?: string): string | undefined => iso?.slice(0, 10);

const dueDateInsideConfiguredTerm = (iso: string | undefined, start?: string, end?: string): boolean => {
  const value = dateOnly(iso);
  if (!value) return false;
  if (start && value < start) return false;
  if (end && value > end) return false;
  return true;
};

const allModuleItemRefsResolve = (course: CourseProject): boolean => {
  const ids = new Set([
    ...course.pages.map((page) => page.id),
    ...course.assignments.map((assignment) => assignment.id),
    ...course.discussions.map((discussion) => discussion.id),
    ...course.quizzes.map((quiz) => quiz.id)
  ]);
  // Text-header (subheader) items are visual dividers with no backing object — they have no refId.
  return course.modules.every((module) => module.items.filter((item) => item.type !== "subheader").every((item) => ids.has(item.refId)));
};

const hasModuleBoundaryPages = (course: CourseProject): boolean =>
  course.modules
    .filter((module) => module.kind === "content")
    .every(
      (module) =>
        module.items.some((item) => item.type === "page" && /(overview|about )/i.test(item.title)) &&
        module.items.some((item) => item.type === "page" && /(wrap|recap|end of )/i.test(item.title))
    );

const contentModuleOverviewPages = (course: CourseProject): Array<{ moduleTitle: string; pageTitle: string; html: string }> =>
  course.modules
    .filter((module) => module.kind === "content")
    .flatMap((module) =>
      module.items
        .filter((item) => item.type === "page" && /(overview|about )/i.test(item.title))
        .map((item) => {
          const page = course.pages.find((candidate) => candidate.id === item.refId);
          return page ? { moduleTitle: module.title, pageTitle: page.title, html: page.bodyHtml } : null;
        })
        .filter((value): value is { moduleTitle: string; pageTitle: string; html: string } => Boolean(value))
    );

const hasAny = (html: string, patterns: RegExp[]): boolean => patterns.some((pattern) => pattern.test(html));

const visualPatternCoverage = (course: CourseProject): number => {
  const blocks = bodyBlocks(course);
  if (!blocks.length) return 0;
  const themed = blocks.filter((block) => block.html.includes(course.theme.accent) || block.html.includes(course.theme.accentDark) || block.html.includes(course.theme.soft)).length;
  return Math.round((themed / blocks.length) * 100);
};

// Content modules need a full learning path, not just overview/recap bookends around an empty
// middle: a readings/resources stop and a lecture-or-practice stop are required too.
const contentModulePathGaps = (course: CourseProject): string[] =>
  course.modules
    .filter((module) => module.kind === "content")
    .flatMap((module) => {
      const titles = module.items.map((item) => item.title);
      const has = (pattern: RegExp): boolean => titles.some((title) => pattern.test(title));
      const missing: string[] = [];
      if (!has(/(overview|about )/i)) missing.push("overview");
      if (!has(/(reading|resource)/i)) missing.push("readings/resources");
      if (!has(/(lecture|notes|practice|activity)/i)) missing.push("lecture/practice");
      if (!has(/(wrap|recap|end of )/i)) missing.push("recap");
      return missing.length ? [`${module.title}: missing ${missing.join(", ")}`] : [];
    });

// A measurable objective leads with an observable action verb (Bloom verbs included). Used as a
// recommended signal — vague "students will understand things" objectives lack one.
const MEASURABLE_VERB =
  /\b(engage|reflect|conceptuali[sz]e|experiment|remember|understand|apply|analy[sz]e|evaluate|create|define|describe|explain|identify|list|compare|contrast|design|develop|demonstrate|implement|construct|interpret|assess|differentiate|calculate|illustrate|summari[sz]e|classify|examine|produce|formulate|critique|distinguish|outline|solve|predict|justify|organize|build|plan|measure|estimate)\b/i;

// Every cross-object id reference, resolved against the objects that actually exist. Catches
// dangling group/rubric/outcome/module references and module items whose type disagrees with
// the kind of object they point at.
const danglingReferences = (course: CourseProject): string[] => {
  const pageIds = new Set(course.pages.map((page) => page.id));
  const assignmentIds = new Set(course.assignments.map((assignment) => assignment.id));
  const discussionIds = new Set(course.discussions.map((discussion) => discussion.id));
  const quizIds = new Set(course.quizzes.map((quiz) => quiz.id));
  const moduleIds = new Set(course.modules.map((module) => module.id));
  const groupIds = new Set(course.assignmentGroups.map((group) => group.id));
  const rubricIds = new Set(course.rubrics.map((rubric) => rubric.id));
  const outcomeIds = new Set(course.outcomes.map((outcome) => outcome.id));
  const anyObject = (refId: string): boolean => pageIds.has(refId) || assignmentIds.has(refId) || discussionIds.has(refId) || quizIds.has(refId);
  const typeMatches = (type: ModuleItemType, refId: string): boolean => {
    if (type === "page" || type === "syllabus") return pageIds.has(refId);
    if (type === "assignment") return assignmentIds.has(refId);
    if (type === "discussion") return discussionIds.has(refId);
    if (type === "quiz") return quizIds.has(refId);
    return anyObject(refId);
  };
  const problems: string[] = [];
  course.modules.forEach((module) =>
    module.items.forEach((item) => {
      if (item.type === "subheader") return; // text headers have no backing object
      if (!anyObject(item.refId)) problems.push(`Module item "${item.title}" points to missing object ${item.refId}`);
      else if (!typeMatches(item.type, item.refId)) problems.push(`Module item "${item.title}" is typed ${item.type} but references a different object kind`);
    })
  );
  course.assignments.forEach((assignment) => {
    if (!groupIds.has(assignment.assignmentGroupId)) problems.push(`Assignment "${assignment.title}" references a missing assignment group`);
    if (assignment.rubricId && !rubricIds.has(assignment.rubricId)) problems.push(`Assignment "${assignment.title}" references a missing rubric`);
    assignment.alignedOutcomeIds.filter((outcomeId) => !outcomeIds.has(outcomeId)).forEach(() => problems.push(`Assignment "${assignment.title}" references a missing outcome`));
  });
  course.discussions.forEach((discussion) => {
    if (discussion.points > 0 && !groupIds.has(discussion.assignmentGroupId)) problems.push(`Discussion "${discussion.title}" references a missing assignment group`);
    if (discussion.rubricId && !rubricIds.has(discussion.rubricId)) problems.push(`Discussion "${discussion.title}" references a missing rubric`);
    discussion.alignedOutcomeIds.filter((outcomeId) => !outcomeIds.has(outcomeId)).forEach(() => problems.push(`Discussion "${discussion.title}" references a missing outcome`));
  });
  course.quizzes.forEach((quiz) => {
    if (quiz.points > 0 && !groupIds.has(quiz.assignmentGroupId)) problems.push(`Quiz "${quiz.title}" references a missing assignment group`);
    quiz.alignedOutcomeIds.filter((outcomeId) => !outcomeIds.has(outcomeId)).forEach(() => problems.push(`Quiz "${quiz.title}" references a missing outcome`));
    quiz.questions.forEach((question) => question.alignedOutcomeIds.filter((outcomeId) => !outcomeIds.has(outcomeId)).forEach(() => problems.push(`Quiz "${quiz.title}" question references a missing outcome`)));
  });
  course.rubrics.forEach((rubric) => {
    rubric.alignedOutcomeIds.filter((outcomeId) => !outcomeIds.has(outcomeId)).forEach(() => problems.push(`Rubric "${rubric.title}" references a missing outcome`));
    rubric.criteria.forEach((criterion) => {
      if (criterion.outcomeId && !outcomeIds.has(criterion.outcomeId)) problems.push(`Rubric "${rubric.title}" criterion references a missing outcome`);
    });
  });
  course.resources.forEach((resource) => {
    if (!moduleIds.has(resource.moduleId)) problems.push(`Resource "${resource.title}" references a missing module`);
  });
  course.outcomes.forEach((outcome) => {
    outcome.alignedModuleIds.filter((moduleId) => !moduleIds.has(moduleId)).forEach(() => problems.push(`Outcome ${outcome.code} references a missing module`));
  });
  course.schedule.forEach((entry) => {
    if (entry.moduleId && !moduleIds.has(entry.moduleId)) problems.push(`Schedule entry "${entry.title}" references a missing module`);
  });
  return problems;
};

export const buildReadinessReport = (course: CourseProject): ReadinessReport => {
  const gradeWeightTotal = course.assignmentGroups.reduce((sum, group) => sum + Number(group.weight || 0), 0);
  const homepage = course.pages.find((page) => page.frontPage);
  const syllabus = course.pages.find((page) => page.slug === "syllabus");
  const calendarPage = course.pages.find((page) => page.slug === "course-calendar-and-workload-plan");
  const alignmentMapPage = course.pages.find((page) => page.slug === "outcome-and-assessment-alignment-map");
  const startHere = course.modules.find((module) => module.kind === "start" || module.title.toLowerCase().includes("start here"));
  const finalModule = course.modules.find((module) => module.kind === "final");
  const instructorModule = course.modules.find((module) => module.kind === "instructor");
  const scheduleSettings = course.settings.schedule;
  const groupIds = new Set(course.assignmentGroups.map((group) => group.id));
  const gradedItems = [
    ...course.assignments.map((assignment) => ({ id: assignment.id, title: assignment.title, groupId: assignment.assignmentGroupId, points: assignment.points, alignedOutcomeIds: assignment.alignedOutcomeIds, rubricId: assignment.rubricId, dueAt: assignment.dueAt, type: "assignment" })),
    ...course.discussions.filter((discussion) => discussion.points > 0).map((discussion) => ({ id: discussion.id, title: discussion.title, groupId: discussion.assignmentGroupId, points: discussion.points, alignedOutcomeIds: discussion.alignedOutcomeIds, rubricId: discussion.rubricId, dueAt: discussion.dueAt, type: "discussion" })),
    ...course.quizzes.filter((quiz) => quiz.points > 0).map((quiz) => ({ id: quiz.id, title: quiz.title, groupId: quiz.assignmentGroupId, points: quiz.points, alignedOutcomeIds: quiz.alignedOutcomeIds, rubricId: undefined, dueAt: quiz.dueAt, type: "quiz" }))
  ];
  const groupHasItems = new Map<string, boolean>();
  gradedItems.forEach((item) => groupHasItems.set(item.groupId, true));
  const zeroWeightActiveGroups = course.assignmentGroups.filter((group) => groupHasItems.get(group.id) && Number(group.weight) === 0);
  const outOfRangeWeightGroups = course.assignmentGroups.filter((group) => Number(group.weight) < 0 || Number(group.weight) > 100);
  const gradedItemsInUnweightedGroup = gradedItems.filter((item) => {
    const group = course.assignmentGroups.find((candidate) => candidate.id === item.groupId);
    return !group || Number(group.weight) <= 0;
  });
  const rubricIds = new Set(course.rubrics.map((rubric) => rubric.id));
  const outcomeIds = new Set(course.outcomes.map((outcome) => outcome.id));
  const syllabusOutcomeMatch = syllabus ? course.outcomes.every((outcome) => syllabus.bodyHtml.includes(outcome.code) && syllabus.bodyHtml.includes(outcome.text)) : false;
  const unsafeBlocks = [
    ...htmlBlocks(course),
    ...course.quizzes.flatMap((quiz) =>
      quiz.questions.flatMap((question) => [
        { id: question.id, title: `${quiz.title} question`, html: question.stem },
        { id: `${question.id}_fb`, title: `${quiz.title} feedback`, html: `${question.feedback ?? ""} ${question.correctFeedback ?? ""} ${question.incorrectFeedback ?? ""}` }
      ])
    )
  ].filter((block) => hasUnsafeHtml(block.html));
  const placeholderLinks = htmlBlocks(course).flatMap((block) => hrefsFrom(block.html).filter(isPlaceholderHref).map((href) => `${block.title}: ${href || "(empty)"}`));
  const pageTargetSet = pageTargets(course);
  const resourceTargetSet = resourceTargets(course);
  // Canvas substitution tokens ($WIKI_REFERENCE$/..., $CANVAS_OBJECT_REFERENCE$/..., $IMS-CC-FILEBASE$/...)
  // are how internal links actually resolve in an imported course; treat them as valid targets.
  const tokenTargetSet = canvasRefTargets(course);
  const normalizeHref = (href: string): string => href.split("#")[0].split("?")[0].replace(/^\.\//, "");
  const missingInternalLinks = htmlBlocks(course).flatMap((block) =>
    hrefsFrom(block.html)
      .filter((href) => !isPlaceholderHref(href))
      .filter((href) => !/^https?:\/\//i.test(href) && !/^mailto:/i.test(href))
      .filter((href) => !href.startsWith("#"))
      .filter((href) => {
        const normalized = normalizeHref(href);
        return !pageTargetSet.has(normalized) && !resourceTargetSet.has(normalized) && !tokenTargetSet.has(normalized);
      })
      .map((href) => `${block.title}: ${href}`)
  );
  const homepageStartHereResolves = Boolean(homepage && hrefsFrom(homepage.bodyHtml).some((href) => href.includes(SUCCESS_GUIDE_HREF)) && course.pages.some((page) => page.slug === "course-success-guide"));
  const homepageCalendarResolves = Boolean(homepage && hrefsFrom(homepage.bodyHtml).some((href) => href.includes(CALENDAR_HREF)) && calendarPage);
  const syllabusPrintable = course.fileAssets.some((asset) => asset.path === "web_resources/syllabus-printable.pdf");
  const syllabusValidation = syllabus
    ? validateSyllabus(syllabus.bodyHtml, { knownTargets: new Set([...pageTargetSet, ...resourceTargetSet, ...tokenTargetSet]), includeContactHours: course.settings.includeContactHours })
    : null;
  const instructorPrintable = course.fileAssets.some((asset) => asset.path === "web_resources/instructor-guide.pdf");
  const blockedDates = new Set([...(scheduleSettings.holidays ?? []), ...(scheduleSettings.blackoutDates ?? [])]);
  const missingDueDates = scheduleSettings.enableDueDates ? gradedItems.filter((item) => !item.dueAt) : [];
  const blockedDueDates = scheduleSettings.enableDueDates
    ? gradedItems.filter((item) => item.dueAt && blockedDates.has(dateOnly(item.dueAt) ?? ""))
    : [];
  const outOfTermDueDates =
    scheduleSettings.enableDueDates && !scheduleSettings.allowDueDatesOutsideTerm
      ? gradedItems.filter((item) => item.dueAt && !dueDateInsideConfiguredTerm(item.dueAt, scheduleSettings.termStartDate, scheduleSettings.termEndDate))
      : [];
  const reviewPriorities = new Set(course.reviewChecklist.map((item) => item.priority));
  const reviewChecklistHasCoverage = (["must", "recommended", "optional"] as const).every((priority) => reviewPriorities.has(priority));
  const humanReviewPage = course.pages.find((page) => page.slug === "before-publishing-human-review-checklist");
  const visibleNavigation = visibleNavigationLabels(course.navigation);
  const navigationMatches = navigationMatchesRequiredDefaults(course.navigation);
  const allRubricsAligned = course.rubrics.length > 0 && course.rubrics.every((rubric) => rubric.alignedOutcomeIds.length > 0 && rubric.alignedOutcomeIds.every((outcomeId) => outcomeIds.has(outcomeId)));
  const shallowRubrics = course.rubrics.filter(
    (rubric) => rubric.criteria.length < 3 || rubric.points <= 0 || rubric.criteria.some((criterion) => criterion.levels.length < 2)
  );
  const gradedItemsHaveOutcomes = gradedItems.every((item) => item.alignedOutcomeIds.length > 0 && item.alignedOutcomeIds.every((outcomeId) => outcomeIds.has(outcomeId)));
  const gradedItemsHaveGroups = gradedItems.every((item) => groupIds.has(item.groupId));
  const assignmentAndDiscussionRubrics = gradedItems
    .filter((item) => item.type === "assignment" || item.type === "discussion")
    .every((item) => Boolean(item.rubricId && rubricIds.has(item.rubricId)));
  const orphanedOutcomes = course.outcomes.filter(
    (outcome) =>
      outcome.alignedModuleIds.length === 0 &&
      !gradedItems.some((item) => item.alignedOutcomeIds.includes(outcome.id)) &&
      !course.rubrics.some((rubric) => rubric.alignedOutcomeIds.includes(outcome.id))
  );
  const emptyBodyBlocks = bodyBlocks(course).filter((block) => visibleLength(block.html) < 24);
  const thinBodyBlocks = bodyBlocks(course).filter((block) => visibleLength(block.html) < 120);
  const emptyModules = course.modules.filter((module) => module.items.length === 0);
  const modulesMissingObjectives = course.modules.filter((module) => module.objectives.filter((objective) => objective.trim().length > 0).length === 0);
  const pathGaps = contentModulePathGaps(course);
  const danglingRefs = danglingReferences(course);
  const modulePlanValidation = validateModulePlan(course);
  const moduleLocationIssues = modulePlanValidation.issues.filter((issue) => /-missing-target$|-module-mismatch$/.test(issue.id));
  const pagePlanValidation = validatePagePlan(course);
  const pageBlockers = pagePlanValidation.issues.filter((issue) => issue.severity === "error");
  const assignmentPlanValidation = validateAssignmentPlan(course);
  const assignmentBlockers = assignmentPlanValidation.issues.filter((issue) => issue.severity === "error");
  const discussionPlanValidation = validateDiscussionPlan(course);
  const discussionBlockers = discussionPlanValidation.issues.filter((issue) => issue.severity === "error");
  const quizPlanValidation = validateQuizPlan(course);
  const quizBlockers = quizPlanValidation.issues.filter((issue) => issue.severity === "error");
  const rubricPlanValidation = validateRubricPlan(course);
  const rubricBlockers = rubricPlanValidation.issues.filter((issue) => issue.severity === "error");
  const distinctOutcomeCodes = new Set(course.outcomes.map((outcome) => outcome.code.trim().toLowerCase())).size === course.outcomes.length;
  const weakObjectives = course.outcomes.filter((outcome) => outcome.code.trim().length === 0 || visibleLength(outcome.text) < 24);
  const nonMeasurableObjectives = course.outcomes.filter((outcome) => !MEASURABLE_VERB.test(outcome.text));
  const startHereModulePages = startHere
    ? startHere.items
        .map((item) => course.pages.find((page) => page.id === item.refId))
        .filter((page): page is NonNullable<typeof page> => Boolean(page))
    : [];
  const startHereSlugs = new Set(startHereModulePages.map((page) => page.slug));
  const startHereMissing = startHere
    ? [
        startHereModulePages.some((page) => page.frontPage) ? null : "homepage",
        startHereSlugs.has("syllabus") ? null : "syllabus",
        startHereSlugs.has("course-success-guide") ? null : "course success guide",
        startHereSlugs.has("course-calendar-and-workload-plan") ? null : "course calendar"
      ].filter((value): value is string => Boolean(value))
    : ["Start Here module"];

  const overviewPages = contentModuleOverviewPages(course);
  const overviewPagesByModule = new Set(overviewPages.map((page) => page.moduleTitle));
  const contentModules = course.modules.filter((module) => module.kind === "content");
  const overviewPagesComplete = contentModules.every((module) => overviewPagesByModule.has(module.title));
  const overviewRichPages = overviewPages.filter(
    (page) =>
      hasAny(page.html, [/Module Mission Briefing/i]) &&
      hasAny(page.html, [/Big Question/i]) &&
      hasAny(page.html, [/Objectives Chips|Module Learning Objectives/i]) &&
      hasAny(page.html, [/Read-Watch-Do Path|Student Action Steps/i]) &&
      hasAny(page.html, [/Module Map/i]) &&
      hasAny(page.html, [/Before You Begin Checklist/i])
  );
  const homepageVisualReady = Boolean(
    homepage &&
      hasAny(homepage.bodyHtml, [/Start Here/i]) &&
      hasAny(homepage.bodyHtml, [/Course Navigation|Navigation/i]) &&
      hasAny(homepage.bodyHtml, [/Journey|Map/i]) &&
      hasAny(homepage.bodyHtml, [/Need Help|Support/i]) &&
      (homepage.bodyHtml.match(/<h2\b/gi)?.length ?? 0) >= 4
  );
  const assignmentLaunchpads = course.assignments.filter((assignment) =>
    hasAny(assignment.descriptionHtml, [/Deliverable Checklist|Deliverables/i]) &&
    hasAny(assignment.descriptionHtml, [/Rubric Preview|Rubric/i]) &&
    hasAny(assignment.descriptionHtml, [/Success Checklist|Before You Submit/i])
  );
  const discussionGuidance = course.discussions.filter((discussion) =>
    hasAny(discussion.promptHtml, [/Reply Guidance|Reply Instructions|Replies/i]) &&
    hasAny(discussion.promptHtml, [/Conversation Moves|Peer Response|Sample Strong Reply/i])
  );
  const syllabusVisualReady = Boolean(
    syllabus &&
      hasAny(syllabus.bodyHtml, [/Grading Breakdown Visual|Grading Breakdown/i]) &&
      hasAny(syllabus.bodyHtml, [/Communication Expectations|Participation and Communication/i]) &&
      hasAny(syllabus.bodyHtml, [/Technology Needed|Technology Requirements/i]) &&
      hasAny(syllabus.bodyHtml, [/Accessibility and Inclusion|Accessibility and Accommodations/i])
  );
  const allHeadingIssues = bodyBlocks(course).flatMap((block) => headingOrderIssues(block.html).map((issue) => `${block.title}: ${issue}`));
  const malformedLinks = htmlBlocks(course).flatMap((block) => malformedLinksFromHtml(block.html).map((href) => `${block.title}: ${href}`));
  const missingAltImages = htmlBlocks(course).flatMap((block) => {
    const count = imageTagsMissingAltCount(block.html);
    return count > 0 ? [`${block.title}: ${count} image(s)`] : [];
  });
  const themeValidation = validateTheme(course.theme);
  const supportInfoPresent = htmlBlocks(course).some((block) => hasAny(block.html, [/Need Help|Help and Support|Student Support|support resources/i]));
  const visualPatternPercent = visualPatternCoverage(course);
  const visualPolishSignals = [
    homepageVisualReady,
    startHereMissing.length === 0,
    overviewPagesComplete && overviewRichPages.length === contentModules.length,
    assignmentLaunchpads.length === course.assignments.length,
    discussionGuidance.length === course.discussions.length,
    syllabusVisualReady,
    allHeadingIssues.length === 0,
    unsafeBlocks.length === 0 && malformedLinks.length === 0,
    themeValidation.status === "pass",
    missingAltImages.length === 0,
    supportInfoPresent,
    visualPatternPercent >= 80
  ];
  const visualPolishScore = Math.round((visualPolishSignals.filter(Boolean).length / visualPolishSignals.length) * 100);

  const checks: ReadinessCheck[] = [
    check("objectives", "Learning objectives present", course.outcomes.length >= 3, `${course.outcomes.length} course outcomes.`),
    check("objective-quality", "Objectives are substantive and uniquely coded", weakObjectives.length === 0 && distinctOutcomeCodes, weakObjectives.length ? `${weakObjectives.length} outcome(s) have missing codes or thin text.` : distinctOutcomeCodes ? "Every outcome has a distinct code and substantive text." : "Outcome codes are duplicated."),
    check("objective-measurable", "Objectives use measurable action verbs", nonMeasurableObjectives.length === 0, nonMeasurableObjectives.length ? `${nonMeasurableObjectives.length} outcome(s) lack a measurable action verb.` : "Every outcome leads with a measurable action verb.", "recommended"),
    check("bloom", "Outcome levels assigned", course.outcomes.length > 0 && course.outcomes.every((outcome) => Boolean(outcome.bloomLevel)), "Each outcome is tagged with a framework level (Bloom, SOLO, Dimensions of Knowledge, or Kolb).", "recommended"),
    check("required-modules", "Start, content, final, and instructor modules present", Boolean(startHere && finalModule && instructorModule && course.modules.some((module) => module.kind === "content")), `${course.modules.length} modules generated.`),
    check("module-not-empty", "No empty modules", emptyModules.length === 0, emptyModules.length ? `${emptyModules.map((module) => module.title).slice(0, 3).join(", ")} have no items.` : "Every module contains at least one item."),
    check("content-module-depth", "Content modules follow a full learning path", pathGaps.length === 0, pathGaps.length ? pathGaps.slice(0, 3).join("; ") : "Every content module includes overview, readings, lecture/practice, and recap items."),
    check("module-objectives", "Modules list learning objectives", modulesMissingObjectives.length === 0, modulesMissingObjectives.length ? `${modulesMissingObjectives.map((module) => module.title).slice(0, 3).join(", ")} list no objectives.` : "Every module lists at least one objective.", "recommended"),
    check("instructor-unpublished", "Instructor guide is unpublished", instructorModule?.publishState === "unpublished", instructorModule ? `${instructorModule.title} is ${instructorModule.publishState}.` : "No instructor guide module found."),
    check("alignment-map", "Outcome and assessment map is instructor-only", Boolean(alignmentMapPage && alignmentMapPage.publishState === "unpublished" && /Outcome Alignment Table|Gradebook Group Summary/i.test(alignmentMapPage.bodyHtml)), alignmentMapPage ? `${alignmentMapPage.title} is ${alignmentMapPage.publishState}.` : "No outcome and assessment alignment map found."),
    check("human-review-checklist", "Human publishing checklist present", course.reviewChecklist.length >= 10 && reviewChecklistHasCoverage, `${course.reviewChecklist.length} checklist items generated across review priorities.`),
    check("human-review-page", "Human review page stays instructor-only", humanReviewPage?.publishState === "unpublished", humanReviewPage ? `${humanReviewPage.title} is ${humanReviewPage.publishState}.` : "No human review checklist page found."),
    check("module-boundaries", "Content modules have overview and recap pages", hasModuleBoundaryPages(course), "Each content module should begin and end with student-facing guide pages."),
    check("module-refs", "Module item references resolve", allModuleItemRefsResolve(course), "Every module item should point to an exported page, assignment, discussion, or quiz."),
    check("module-object-alignment", "Module item locations match content objects", moduleLocationIssues.length === 0, moduleLocationIssues.length ? `${moduleLocationIssues.length} module location issue(s): ${moduleLocationIssues.slice(0, 3).map((issue) => issue.detail).join("; ")}` : "Module item locations match the referenced objects."),
    check("page-quality", "Pages pass safety and structure checks", pageBlockers.length === 0 && pagePlanValidation.score >= 85, pageBlockers.length ? `${pageBlockers.length} page blocker(s): ${pageBlockers.slice(0, 3).map((issue) => issue.detail).join("; ")}` : `Page validation score is ${pagePlanValidation.score}.`, "recommended"),
    check("reference-integrity", "Cross-object references resolve", danglingRefs.length === 0, danglingRefs.length ? `${danglingRefs.length} broken reference(s): ${danglingRefs.slice(0, 3).join("; ")}.` : "Group, rubric, outcome, module, and item references all resolve."),
    check("start-here-content", "Start Here module carries orientation content", startHereMissing.length === 0, startHereMissing.length ? `Start Here is missing: ${startHereMissing.join(", ")}.` : "Start Here includes the homepage, syllabus, success guide, and calendar."),
    check("visual-polish-score", "Visual readiness score is strong", visualPolishScore >= 85, `Visual polish score is ${visualPolishScore}.`, "recommended"),
    check("visual-homepage-structure", "Homepage has strong visual structure", homepageVisualReady, homepage ? "Homepage includes Start Here, navigation, journey/support cues, and multiple sections." : "No homepage found.", "recommended"),
    check("visual-start-here-guidance", "Start Here guidance exists", startHereMissing.length === 0 && supportInfoPresent, startHereMissing.length ? `Start Here is missing: ${startHereMissing.join(", ")}.` : "Start Here and support/help guidance are present.", "recommended"),
    check("visual-module-overviews", "Each module has a polished overview page", overviewPagesComplete && overviewRichPages.length === contentModules.length, overviewPagesComplete ? `${overviewRichPages.length}/${contentModules.length} content module overview page(s) include mission, question, objectives, path, map, and checklist.` : `${contentModules.length - overviewPagesByModule.size} content module(s) are missing overview pages.`, "recommended"),
    check("visual-module-action-steps", "Module overview pages include objectives and student action steps", overviewRichPages.length === contentModules.length, overviewRichPages.length === contentModules.length ? "Overview pages include objectives and student action steps." : `${contentModules.length - overviewRichPages.length} overview page(s) need objectives, Read-Watch-Do, or action steps.`, "recommended"),
    check("visual-assignment-launchpads", "Assignments include deliverable checklists", assignmentLaunchpads.length === course.assignments.length, `${assignmentLaunchpads.length}/${course.assignments.length} assignment(s) include deliverable, success, and rubric guidance.`, "recommended"),
    check("visual-discussion-guidance", "Discussions include reply guidance", discussionGuidance.length === course.discussions.length, `${discussionGuidance.length}/${course.discussions.length} discussion(s) include reply guidance and conversation moves.`, "recommended"),
    check("visual-syllabus-sections", "Syllabus includes visual grading and communication sections", syllabusVisualReady, syllabusVisualReady ? "Syllabus includes grading, communication, technology, and accessibility sections." : "Syllabus needs grading, communication, technology, or accessibility sections.", "recommended"),
    check("visual-heading-order", "Pages use valid heading order", allHeadingIssues.length === 0, allHeadingIssues.length ? allHeadingIssues.slice(0, 3).join("; ") : "No heading-order jumps found in page, assignment, or discussion bodies.", "recommended"),
    check("visual-html-safety", "Blocks avoid unsafe or malformed HTML", unsafeBlocks.length === 0 && malformedLinks.length === 0, unsafeBlocks.length ? `${unsafeBlocks.length} content block(s) include unsafe HTML.` : malformedLinks.length ? malformedLinks.slice(0, 3).join("; ") : "No unsafe HTML or malformed links found.", "recommended"),
    check("visual-theme-contrast", "Theme contrast is acceptable", themeValidation.status === "pass", `Theme contrast score is ${themeValidation.score}; ${themeValidation.warnings} warning(s).`, "recommended"),
    check("visual-image-alt", "Image placeholders include alt-text guidance", missingAltImages.length === 0, missingAltImages.length ? missingAltImages.slice(0, 3).join("; ") : "Images include alt text or decorative marking.", "recommended"),
    check("visual-support-info", "Course has support/help information", supportInfoPresent, supportInfoPresent ? "Support and help information appears in student-facing content." : "Add Need Help, Student Support, or Help and Support guidance.", "recommended"),
    check("visual-pattern-consistency", "Course has a consistent visual pattern", visualPatternPercent >= 80, `${visualPatternPercent}% of major body blocks carry the active theme tokens.`, "recommended"),
    check("weights", "Grade weights total 100%", Math.round(gradeWeightTotal) === 100, `Current assignment group total is ${gradeWeightTotal}%.`),
    check("weight-bounds", "Assignment group weights are in range and balanced", outOfRangeWeightGroups.length === 0 && Math.abs(gradeWeightTotal - 100) < 0.5 && gradedItemsInUnweightedGroup.length === 0, outOfRangeWeightGroups.length ? `${outOfRangeWeightGroups.map((group) => group.name).slice(0, 3).join(", ")} have weights outside 0-100%.` : gradedItemsInUnweightedGroup.length ? `${gradedItemsInUnweightedGroup.map((item) => item.title).slice(0, 3).join(", ")} sit in a 0%-weight group and would not count.` : "Group weights are within range and sum to 100%."),
    check("assignment-groups", "Graded items use meaningful assignment groups", gradedItemsHaveGroups, `${gradedItems.length} graded items checked for assignment group references.`),
    check("assignment-quality", "Assignments pass safety and design checks", assignmentBlockers.length === 0 && assignmentPlanValidation.score >= 85, assignmentBlockers.length ? `${assignmentBlockers.length} assignment blocker(s): ${assignmentBlockers.slice(0, 3).map((issue) => issue.detail).join("; ")}` : `Assignment validation score is ${assignmentPlanValidation.score}.`, "recommended"),
    check("discussion-quality", "Discussions pass prompt and participation checks", discussionBlockers.length === 0 && discussionPlanValidation.score >= 85, discussionBlockers.length ? `${discussionBlockers.length} discussion blocker(s): ${discussionBlockers.slice(0, 3).map((issue) => issue.detail).join("; ")}` : `Discussion validation score is ${discussionPlanValidation.score}.`, "recommended"),
    check("quiz-quality", "Quizzes pass question and QTI checks", quizBlockers.length === 0 && quizPlanValidation.score >= 85, quizBlockers.length ? `${quizBlockers.length} quiz blocker(s): ${quizBlockers.slice(0, 3).map((issue) => issue.detail).join("; ")}` : `Quiz validation score is ${quizPlanValidation.score}.`, "recommended"),
    check("nonzero-weight-groups", "Active assignment groups are weighted", zeroWeightActiveGroups.length === 0, zeroWeightActiveGroups.length ? `${zeroWeightActiveGroups.map((group) => group.name).join(", ")} has graded items but 0% weight.` : "No active graded group is weighted at 0%."),
    check("rubrics", "Assignments and graded discussions have rubrics", assignmentAndDiscussionRubrics, "Assignments and graded discussions should include attached rubric references."),
    check("rubric-depth", "Rubrics have substantive criteria and points", shallowRubrics.length === 0, shallowRubrics.length ? `${shallowRubrics.map((rubric) => rubric.title).slice(0, 3).join(", ")} need 3+ criteria, leveled ratings, and nonzero points.` : "Every rubric has at least three leveled criteria and nonzero points."),
    check("rubric-outcomes", "Rubrics align to outcomes", allRubricsAligned, "Every generated rubric should reference at least one course outcome."),
    check("rubric-quality", "Rubrics pass criteria and level checks", rubricBlockers.length === 0 && rubricPlanValidation.score >= 85, rubricBlockers.length ? `${rubricBlockers.length} rubric blocker(s): ${rubricBlockers.slice(0, 3).map((issue) => issue.detail).join("; ")}` : `Rubric validation score is ${rubricPlanValidation.score}.`, "recommended"),
    check("graded-outcomes", "Graded items align to outcomes", gradedItemsHaveOutcomes, "Every graded item should reference at least one course outcome."),
    check("orphaned-outcomes", "No orphaned outcomes", orphanedOutcomes.length === 0, orphanedOutcomes.length ? `${orphanedOutcomes.length} outcome(s) are not aligned.` : "All outcomes are represented in modules, rubrics, or graded work.", "recommended"),
    check("syllabus-outcomes", "Syllabus outcomes match course outcomes", syllabusOutcomeMatch, syllabus ? "Syllabus lists the generated course outcomes." : "No syllabus page found."),
    check("homepage", "Homepage present", Boolean(homepage), homepage ? `Front page: ${homepage.title}` : "No front page found."),
    check("start-here-link", "Homepage Start Here button resolves", homepageStartHereResolves, homepageStartHereResolves ? "Homepage links to Course Success Guide." : "Homepage Start Here link does not resolve."),
    check("syllabus", "Syllabus present", Boolean(syllabus), syllabus ? "Syllabus page is generated." : "No syllabus page found."),
    check(
      "syllabus-quality",
      "Syllabus passes section, safety, and printable checks",
      Boolean(syllabusValidation && syllabusValidation.failures === 0 && syllabusValidation.score >= 90),
      syllabusValidation ? `Syllabus validation score is ${syllabusValidation.score}; ${syllabusValidation.failures} failures and ${syllabusValidation.warnings} warnings.` : "No syllabus page found."
    ),
    check("calendar-page", "Course calendar and workload page present", Boolean(calendarPage && /Schedule Table|Generated module calendar/i.test(calendarPage.bodyHtml)), calendarPage ? "Student-facing calendar and workload plan is generated." : "No course calendar and workload page found."),
    check("calendar-link", "Homepage calendar link resolves", homepageCalendarResolves, homepageCalendarResolves ? "Homepage links to the generated calendar page." : "Homepage calendar link does not resolve.", "recommended"),
    check("schedule-start-date", "Schedule start date configured when due dates are enabled", !scheduleSettings.enableDueDates || Boolean(scheduleSettings.termStartDate), scheduleSettings.enableDueDates ? scheduleSettings.termStartDate ? `Term starts ${scheduleSettings.termStartDate}.` : "Due dates are enabled, but no term start date is set." : "Due dates are disabled by default."),
    check("graded-due-dates", "Graded items have due dates when enabled", !scheduleSettings.enableDueDates || missingDueDates.length === 0, missingDueDates.length ? `${missingDueDates.slice(0, 3).map((item) => item.title).join("; ")} missing due dates.` : `${gradedItems.length} graded item due dates checked.`),
    check("due-date-blackouts", "Due dates avoid holidays and blackout dates", !scheduleSettings.enableDueDates || blockedDueDates.length === 0, blockedDueDates.length ? `${blockedDueDates.slice(0, 3).map((item) => item.title).join("; ")} lands on a blocked date.` : "Generated due dates avoid configured blocked dates."),
    check("due-date-term", "Due dates stay inside the configured term", !scheduleSettings.enableDueDates || scheduleSettings.allowDueDatesOutsideTerm || outOfTermDueDates.length === 0, outOfTermDueDates.length ? `${outOfTermDueDates.slice(0, 3).map((item) => item.title).join("; ")} is outside the configured term.` : "Generated due dates stay inside configured term bounds.", "recommended"),
    check("syllabus-pdf", "Printable syllabus resource present", syllabusPrintable, syllabusPrintable ? "Syllabus PDF asset is included." : "Missing syllabus printable PDF asset."),
    check("instructor-pdf", "Instructor guide resource present", instructorPrintable, instructorPrintable ? "Instructor guide PDF asset is included." : "Missing instructor guide PDF asset."),
    check("navigation", "Canvas navigation defaults are intentional", navigationMatches, `Visible navigation: ${visibleNavigation.join(", ")}.`, "recommended"),
    check("workload", "Workload estimate present", course.contactHours.totalHours > 0, `${course.contactHours.totalHours} total student workload hours estimated.`),
    check("accessibility", "No unsafe Canvas HTML", unsafeBlocks.length === 0, unsafeBlocks.length ? `${unsafeBlocks.length} content block(s) include unsafe HTML.` : "Content avoids scripts, embeds, forms, event handlers, and dangerous URIs."),
    check("placeholder-links", "No placeholder links", placeholderLinks.length === 0, placeholderLinks.length ? placeholderLinks.slice(0, 3).join("; ") : "No empty, hash, JavaScript, or TODO links found."),
    check("internal-links", "Internal links resolve locally", missingInternalLinks.length === 0, missingInternalLinks.length ? missingInternalLinks.slice(0, 3).join("; ") : "Internal page and asset links resolve.", "recommended"),
    check("empty-content", "No empty content blocks", emptyBodyBlocks.length === 0, emptyBodyBlocks.length ? `${emptyBodyBlocks.map((block) => block.title).slice(0, 3).join(", ")} have effectively no body content.` : "Pages, assignments, and discussions all carry body content."),
    check("thin-content", "No thin content blocks", thinBodyBlocks.length === 0, thinBodyBlocks.length ? `${thinBodyBlocks.map((block) => block.title).slice(0, 3).join(", ")} are too short for an import-ready course shell.` : "Pages, assignments, and discussions have substantial body content.", "recommended")
  ];

  const totalWeight = checks.reduce((sum, item) => sum + (item.severity === "required" ? 10 : 6), 0);
  const earnedWeight = checks.reduce((sum, item) => sum + (item.passed ? (item.severity === "required" ? 10 : 6) : 0), 0);
  const blockers = checks.filter((item) => !item.passed && item.severity === "required").length;
  const warnings = checks.filter((item) => !item.passed && item.severity === "recommended").length;

  return {
    score: Math.round((earnedWeight / totalWeight) * 100),
    checks,
    blockers,
    warnings
  };
};
