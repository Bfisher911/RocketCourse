// Per-stage "Generate with AI" functions, one per builder. Each returns an AiResult:
// it asks the proxy for strict JSON, coerces the reply into the typed CourseProject
// model, and — via withFallback — drops to the builder's existing deterministic
// generator if the proxy is unreachable or the reply is unusable. Tabs call these and
// apply the value; all the AI plumbing lives here so each tab stays a few lines.

import type {
  Announcement,
  CoursePage,
  CourseProject,
  Discussion,
  HomepageContent,
  Quiz,
  QuizDifficulty,
  QuizQuestion,
  QuizQuestionType,
  Rubric,
  RubricCriterion,
  SyllabusContent
} from "../types";
import {
  buildBlueprintContext,
  generateJson,
  toCleanString,
  toPlainText,
  toPlainTextList,
  toStringList,
  withFallback,
  type AiResult
} from "./aiAssist";
import { flattenHeadingsToParagraphs, sanitizeAiHtml } from "./htmlSafety";
import { buildAssignmentTemplateHtml } from "./assignmentBuilder";
import { buildDiscussionTemplateHtml } from "./discussionBuilder";
import { buildPageTemplateHtml } from "./pageBuilder";
import { buildQuizQuestionTemplate, normalizeTrueFalseAnswer, reconcileChoiceAnswer } from "./quizBuilder";
import { buildRubricFromTemplate } from "./rubricBuilder";
import { defaultHomepageContent, homepageContextFromCourse } from "./homepageTemplates";
import { defaultSyllabusContent, syllabusContextFromCourse } from "./syllabusTemplates";
import type { Assignment } from "../types";

const moduleTitle = (course: CourseProject, moduleId?: string): string =>
  course.modules.find((module) => module.id === moduleId)?.title ?? "the course";

const outcomeTexts = (course: CourseProject, ids: string[]): string[] =>
  ids.map((id) => course.outcomes.find((outcome) => outcome.id === id)?.text ?? id).filter(Boolean);

// ---------------------------------------------------------------------------
// Pages -> bodyHtml
// ---------------------------------------------------------------------------
export const aiGeneratePageBody = (course: CourseProject, page: CoursePage): Promise<AiResult<string>> =>
  withFallback(
    async () => {
      const json = await generateJson<{ bodyHtml?: unknown }>({
        stage: "lessonPageDraft",
        courseId: course.id,
        context: {
          blueprintJson: buildBlueprintContext(course),
          pageRequestJson: { title: page.title, module: moduleTitle(course, page.moduleId) }
        },
        outputContract:
          'Return {"bodyHtml": "<Canvas-safe HTML lesson tailored to this exact subject. Include: a mini-lecture (2-3 short paragraphs), a Key Terms list where each term has a one-sentence definition, a numbered Worked Example that models the reasoning step by step, a short comparison or summary <table> when it genuinely aids understanding, a Why This Matters note connecting to the discipline, and a Check Your Understanding list. Use only inline styles; no scripts, iframes, or external CSS.>"}.'
      });
      const bodyHtml = toCleanString(json.bodyHtml);
      if (!bodyHtml) throw new Error("AI did not return page HTML.");
      return sanitizeAiHtml(bodyHtml);
    },
    () => buildPageTemplateHtml("lecture-notes", course, page)
  );

// ---------------------------------------------------------------------------
// Announcements -> bodyHtml
// ---------------------------------------------------------------------------
export const aiGenerateAnnouncementBody = (course: CourseProject, announcement: Announcement): Promise<AiResult<string>> =>
  withFallback(
    async () => {
      const json = await generateJson<{ bodyHtml?: unknown }>({
        stage: "homepageDraft",
        courseId: course.id,
        context: {
          blueprintJson: buildBlueprintContext(course),
          announcementRequestJson: { title: announcement.title }
        },
        outputContract:
          'Return {"bodyHtml": "<Canvas-safe HTML for a warm, specific instructor announcement: 2-3 short paragraphs in second person that connect to THIS course\'s subject and where students are in the term, plus a short bulleted list of concrete next steps. Use only inline styles; no scripts, iframes, headings larger than h2, or external CSS.>"}.'
      });
      const bodyHtml = toCleanString(json.bodyHtml);
      if (!bodyHtml) throw new Error("AI did not return announcement HTML.");
      return sanitizeAiHtml(bodyHtml);
    },
    () => announcement.bodyHtml
  );

// ---------------------------------------------------------------------------
// Page enrichment -> a subject-specific prose fragment to ADD to a structured
// page (overview, readings, practice, milestone, helper pages) without replacing
// its glance tables / navigation. Returns 2-3 <p> paragraphs only.
// ---------------------------------------------------------------------------
export const aiGeneratePageProse = (course: CourseProject, page: CoursePage): Promise<AiResult<string>> =>
  withFallback(
    async () => {
      const json = await generateJson<{ html?: unknown }>({
        stage: "lessonPageDraft",
        courseId: course.id,
        context: {
          blueprintJson: buildBlueprintContext(course),
          pageRequestJson: { title: page.title, module: moduleTitle(course, page.moduleId) }
        },
        outputContract:
          'Return {"html": "<2-3 short <p> paragraphs of real, subject-specific written content appropriate to this page\'s role in the course. Plain prose only: no headings, lists, tables, links, images, scripts, or wrapper divs — just <p> tags with inline styles. Do not restate the page title.>"}.'
      });
      const html = toCleanString(json.html);
      if (!html) throw new Error("AI did not return page prose.");
      // The contract is <p>-only prose; flatten any heading the model sneaks in so the
      // fragment can't add a second h1 (a blocking export error) to its host page.
      return flattenHeadingsToParagraphs(sanitizeAiHtml(html));
    },
    () => ""
  );

// ---------------------------------------------------------------------------
// Assignments -> descriptionHtml
// ---------------------------------------------------------------------------
export const aiGenerateAssignmentDescription = (course: CourseProject, assignment: Assignment): Promise<AiResult<string>> =>
  withFallback(
    async () => {
      const json = await generateJson<{ descriptionHtml?: unknown }>({
        stage: "assignmentDraft",
        courseId: course.id,
        context: {
          blueprintJson: buildBlueprintContext(course),
          moduleDraftJson: { title: moduleTitle(course, assignment.moduleId) },
          assignmentRequestJson: {
            title: assignment.title,
            points: assignment.points,
            submissionType: assignment.submissionType,
            estimatedHours: assignment.estimatedHours,
            outcomes: outcomeTexts(course, assignment.alignedOutcomeIds)
          }
        },
        outputContract:
          'Return {"descriptionHtml": "<Canvas-safe HTML with purpose, a concrete subject-specific scenario, numbered task steps, deliverable requirements, and an evaluation-criteria <table> (each row: criterion -> what strong work shows). Use only inline styles.>"}.'
      });
      const descriptionHtml = toCleanString(json.descriptionHtml);
      if (!descriptionHtml) throw new Error("AI did not return assignment HTML.");
      return sanitizeAiHtml(descriptionHtml);
    },
    () => buildAssignmentTemplateHtml("essay-paper", course, assignment)
  );

// ---------------------------------------------------------------------------
// Discussions -> promptHtml
// ---------------------------------------------------------------------------
export const aiGenerateDiscussionPrompt = (course: CourseProject, discussion: Discussion): Promise<AiResult<string>> =>
  withFallback(
    async () => {
      const json = await generateJson<{ promptHtml?: unknown }>({
        stage: "discussionDraft",
        courseId: course.id,
        context: {
          blueprintJson: buildBlueprintContext(course),
          discussionRequestJson: {
            title: discussion.title,
            module: moduleTitle(course, discussion.moduleId),
            points: discussion.points,
            outcomes: outcomeTexts(course, discussion.alignedOutcomeIds)
          }
        },
        outputContract: 'Return {"promptHtml": "<Canvas-safe HTML with a scenario, the discussion task, and reply expectations>"}.'
      });
      const promptHtml = toCleanString(json.promptHtml);
      if (!promptHtml) throw new Error("AI did not return discussion HTML.");
      return sanitizeAiHtml(promptHtml);
    },
    () => buildDiscussionTemplateHtml("evidence-based", course, discussion)
  );

// ---------------------------------------------------------------------------
// Quizzes -> QuizQuestion[]
// ---------------------------------------------------------------------------
const QUESTION_TYPES: QuizQuestionType[] = ["multiple_choice", "true_false", "short_answer", "essay"];

const coerceQuestion = (raw: unknown, quiz: Quiz, course: CourseProject, index: number): QuizQuestion | null => {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;
  const stem = toCleanString(record.stem);
  // Stems under 12 chars fail the quiz-quality export validator as unusable questions.
  if (!stem || stem.length < 12) return null;
  const type = QUESTION_TYPES.includes(record.type as QuizQuestionType) ? (record.type as QuizQuestionType) : "multiple_choice";
  const choices = type === "multiple_choice" ? toStringList(record.choices, 6) : [];
  const difficulty: QuizDifficulty = course.settings.quizDifficulty ?? "balanced";

  // Auto-graded types must carry a key the exporter accepts, or Canvas import fails. Reconcile the
  // AI answer to a real choice / True|False; drop the question if it can't be matched confidently.
  let correctAnswer = toCleanString(record.correctAnswer);
  if (type === "multiple_choice") {
    const matched = reconcileChoiceAnswer(correctAnswer, choices);
    if (!matched) return null;
    correctAnswer = matched;
  } else if (type === "true_false") {
    const matched = normalizeTrueFalseAnswer(correctAnswer);
    if (!matched) return null;
    correctAnswer = matched;
  }

  return {
    id: `${quiz.id}_ai_${Date.now().toString(36)}_${index + 1}`,
    type,
    stem,
    choices: choices.length ? choices : undefined,
    correctAnswer,
    feedback: toCleanString(record.feedback),
    correctFeedback: toCleanString(record.correctFeedback),
    incorrectFeedback: toCleanString(record.incorrectFeedback),
    difficulty,
    alignedOutcomeIds: quiz.alignedOutcomeIds,
    moduleId: quiz.moduleId,
    // Zero/negative points are a blocking export error, so only accept positive values.
    points: typeof record.points === "number" && Number.isFinite(record.points) && record.points > 0 ? record.points : type === "essay" ? 6 : type === "short_answer" ? 4 : 2,
    instructorReviewRequired: type === "essay" || type === "short_answer" ? true : undefined
  };
};

const fallbackQuestions = (course: CourseProject, quiz: Quiz): QuizQuestion[] =>
  [
    buildQuizQuestionTemplate("concept-check", course, quiz, { questionId: `${quiz.id}_fb_1` }),
    buildQuizQuestionTemplate("application-scenario", course, quiz, { questionId: `${quiz.id}_fb_2` }),
    buildQuizQuestionTemplate("concept-check", course, quiz, { questionId: `${quiz.id}_fb_3` })
  ];

export const aiGenerateQuizQuestions = (course: CourseProject, quiz: Quiz): Promise<AiResult<QuizQuestion[]>> =>
  withFallback(
    async () => {
      const json = await generateJson<{ questions?: unknown }>({
        stage: "quizDraft",
        courseId: course.id,
        context: {
          blueprintJson: buildBlueprintContext(course),
          quizRequestJson: {
            title: quiz.title,
            purpose: quiz.purpose,
            module: moduleTitle(course, quiz.moduleId),
            difficulty: course.settings.quizDifficulty,
            count: Math.max(3, course.settings.quizQuestionsPerQuiz || 5)
          }
        },
        outputContract:
          'Return {"questions": [{"type": "multiple_choice|true_false|short_answer|essay", "stem": string, "choices": string[], "correctAnswer": string, "correctFeedback": "why the correct answer is right, using module vocabulary", "incorrectFeedback": "name the most likely wrong choice and explain the misconception behind it", "points": number}]}. Write subject-specific stems with plausible distractors, not generic placeholders.'
      });
      const list = Array.isArray(json.questions) ? json.questions : [];
      const questions = list.map((raw, index) => coerceQuestion(raw, quiz, course, index)).filter((q): q is QuizQuestion => q !== null);
      if (!questions.length) throw new Error("AI did not return usable quiz questions.");
      return questions;
    },
    () => fallbackQuestions(course, quiz)
  );

// ---------------------------------------------------------------------------
// Rubrics -> RubricCriterion[]
// ---------------------------------------------------------------------------
const defaultLevels = (): RubricCriterion["levels"] => [
  { label: "Exemplary", points: 4, description: "Exceeds expectations with clear, well-supported work." },
  { label: "Proficient", points: 3, description: "Meets expectations with minor gaps." },
  { label: "Developing", points: 2, description: "Partially meets expectations; key elements are thin." },
  { label: "Beginning", points: 1, description: "Does not yet meet expectations." }
];

const coerceCriterion = (raw: unknown, rubricId: string, index: number): RubricCriterion | null => {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;
  const title = toCleanString(record.title);
  if (!title) return null;
  const levelsRaw = Array.isArray(record.levels) ? record.levels : [];
  const levels = levelsRaw
    .map((level) => {
      const item = level as Record<string, unknown>;
      const label = toCleanString(item?.label);
      return label
        ? { label, points: typeof item?.points === "number" ? item.points : 0, description: toCleanString(item?.description) ?? "" }
        : null;
    })
    .filter((level): level is RubricCriterion["levels"][number] => level !== null);
  return {
    id: `${rubricId}_ai_${index + 1}`,
    title,
    description: toCleanString(record.description) ?? `Student work demonstrates ${title.toLowerCase()}.`,
    levels: levels.length >= 2 ? levels : defaultLevels()
  };
};

export const aiGenerateRubricCriteria = (course: CourseProject, rubric: Rubric): Promise<AiResult<RubricCriterion[]>> =>
  withFallback(
    async () => {
      const json = await generateJson<{ criteria?: unknown }>({
        stage: "rubricDraft",
        courseId: course.id,
        context: {
          blueprintJson: buildBlueprintContext(course),
          rubricRequestJson: { title: rubric.title, outcomes: outcomeTexts(course, rubric.alignedOutcomeIds) }
        },
        outputContract:
          'Return {"criteria": [{"title": string, "description": string, "levels": [{"label": string, "points": number, "description": string}]}]}.'
      });
      const list = Array.isArray(json.criteria) ? json.criteria : [];
      const criteria = list.map((raw, index) => coerceCriterion(raw, rubric.id, index)).filter((c): c is RubricCriterion => c !== null);
      if (!criteria.length) throw new Error("AI did not return usable rubric criteria.");
      return criteria;
    },
    () => buildRubricFromTemplate("writing", course, { rubricId: rubric.id, title: rubric.title }).criteria
  );

// ---------------------------------------------------------------------------
// Homepage -> HomepageContent (text fields merged onto current; links preserved)
// ---------------------------------------------------------------------------
export const aiGenerateHomepageContent = (course: CourseProject, current: HomepageContent): Promise<AiResult<HomepageContent>> =>
  withFallback(
    async () => {
      const json = await generateJson<Record<string, unknown>>({
        stage: "homepageDraft",
        courseId: course.id,
        context: {
          blueprintJson: buildBlueprintContext(course),
          navigationJson: course.navigation.map((item) => ({ label: item.label, visible: item.visible })),
          themeJson: { name: course.theme.name, accent: course.theme.accent }
        },
        outputContract:
          'Return {"heroEyebrow": string, "heroHeading": string, "welcome": string, "purpose": string, "instructorNote": string, "pathItems": string[], "weeklyItems": string[]}. Every value must be PLAIN TEXT — no HTML tags, no markdown, no link syntax; these fields are rendered inside a styled template that escapes markup.'
      });
      // Plain-text coercion is load-bearing: these fields are HTML-escaped by the homepage
      // template, so any tag the model returns would render literally in Canvas.
      return {
        ...current,
        heroEyebrow: toPlainText(json.heroEyebrow) ?? current.heroEyebrow,
        heroHeading: toPlainText(json.heroHeading) ?? current.heroHeading,
        welcome: toPlainText(json.welcome) ?? current.welcome,
        purpose: toPlainText(json.purpose) ?? current.purpose,
        instructorNote: toPlainText(json.instructorNote) ?? current.instructorNote,
        pathItems: toPlainTextList(json.pathItems).length ? toPlainTextList(json.pathItems) : current.pathItems,
        weeklyItems: toPlainTextList(json.weeklyItems).length ? toPlainTextList(json.weeklyItems) : current.weeklyItems
      };
    },
    () => defaultHomepageContent(homepageContextFromCourse(course))
  );

// ---------------------------------------------------------------------------
// Syllabus -> SyllabusContent (text fields merged onto current)
// ---------------------------------------------------------------------------
export const aiGenerateSyllabusContent = (course: CourseProject, current: SyllabusContent): Promise<AiResult<SyllabusContent>> =>
  withFallback(
    async () => {
      const json = await generateJson<Record<string, unknown>>({
        stage: "syllabusDraft",
        courseId: course.id,
        context: { blueprintJson: buildBlueprintContext(course) },
        outputContract:
          'Return {"courseDescription": string, "communicationExpectations": string, "lateWorkPolicy": string, "academicIntegrityPolicy": string, "aiUsePolicy": string, "learningOutcomes": string[], "requiredMaterials": string[]}. Every value must be PLAIN TEXT prose — no HTML tags, no markdown, no headings; these fields are rendered inside a styled syllabus template that escapes markup. courseDescription is 2-4 sentences, not a full syllabus.'
      });
      // Plain-text coercion is load-bearing: the syllabus template escapes these fields, so any
      // markup the model returns would render literally in Canvas.
      return {
        ...current,
        courseDescription: toPlainText(json.courseDescription) ?? current.courseDescription,
        communicationExpectations: toPlainText(json.communicationExpectations) ?? current.communicationExpectations,
        lateWorkPolicy: toPlainText(json.lateWorkPolicy) ?? current.lateWorkPolicy,
        academicIntegrityPolicy: toPlainText(json.academicIntegrityPolicy) ?? current.academicIntegrityPolicy,
        aiUsePolicy: toPlainText(json.aiUsePolicy) ?? current.aiUsePolicy,
        learningOutcomes: toPlainTextList(json.learningOutcomes).length ? toPlainTextList(json.learningOutcomes) : current.learningOutcomes,
        requiredMaterials: toPlainTextList(json.requiredMaterials).length ? toPlainTextList(json.requiredMaterials) : current.requiredMaterials
      };
    },
    () => defaultSyllabusContent(syllabusContextFromCourse(course))
  );

// ---------------------------------------------------------------------------
// Overview -> course description + suggested outcome statements
// ---------------------------------------------------------------------------
export interface OverviewDraft {
  description: string;
  outcomes: string[];
}

export const aiGenerateCourseOverview = (course: CourseProject): Promise<AiResult<OverviewDraft>> =>
  withFallback(
    async () => {
      const json = await generateJson<{ description?: unknown; outcomes?: unknown }>({
        stage: "blueprint",
        courseId: course.id,
        context: { blueprintJson: buildBlueprintContext(course) },
        outputContract: 'Return {"description": "<2-4 sentence course description, plain text, no HTML>", "outcomes": ["<measurable outcome, plain text>", ...]}.'
      });
      const description = toPlainText(json.description);
      if (!description) throw new Error("AI did not return a course description.");
      return { description, outcomes: toPlainTextList(json.outcomes) };
    },
    () => ({ description: course.description, outcomes: course.outcomes.map((outcome) => outcome.text) })
  );

// ---------------------------------------------------------------------------
// Contact Hours -> workload justification narrative
// ---------------------------------------------------------------------------
export const aiGenerateContactHoursJustification = (course: CourseProject): Promise<AiResult<string>> =>
  withFallback(
    async () => {
      const json = await generateJson<{ justification?: unknown }>({
        stage: "contactHourDraft",
        courseId: course.id,
        context: {
          blueprintJson: buildBlueprintContext(course),
          contactHoursJson: course.contactHours
        },
        outputContract: 'Return {"justification": "<paragraph explaining how the workload meets the credit-hour expectation — plain text, no HTML>"}.'
      });
      const justification = toPlainText(json.justification);
      if (!justification) throw new Error("AI did not return a justification.");
      return justification;
    },
    () => course.contactHours.justification
  );
