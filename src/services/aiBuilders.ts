// Per-stage "Generate with AI" functions, one per builder. Each returns an AiResult:
// it asks the proxy for strict JSON, coerces the reply into the typed CourseProject
// model, and — via withFallback — drops to the builder's existing deterministic
// generator if the proxy is unreachable or the reply is unusable. Tabs call these and
// apply the value; all the AI plumbing lives here so each tab stays a few lines.

import type {
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
  toStringList,
  withFallback,
  type AiResult
} from "./aiAssist";
import { buildAssignmentTemplateHtml } from "./assignmentBuilder";
import { buildDiscussionTemplateHtml } from "./discussionBuilder";
import { buildPageTemplateHtml } from "./pageBuilder";
import { buildQuizQuestionTemplate } from "./quizBuilder";
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
      return bodyHtml;
    },
    () => buildPageTemplateHtml("lecture-notes", course, page)
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
      return descriptionHtml;
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
      return promptHtml;
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
  if (!stem) return null;
  const type = QUESTION_TYPES.includes(record.type as QuizQuestionType) ? (record.type as QuizQuestionType) : "multiple_choice";
  const choices = type === "multiple_choice" ? toStringList(record.choices, 6) : [];
  const difficulty: QuizDifficulty = course.settings.quizDifficulty ?? "balanced";
  return {
    id: `${quiz.id}_ai_${Date.now().toString(36)}_${index + 1}`,
    type,
    stem,
    choices: choices.length ? choices : undefined,
    correctAnswer: toCleanString(record.correctAnswer),
    feedback: toCleanString(record.feedback),
    correctFeedback: toCleanString(record.correctFeedback),
    incorrectFeedback: toCleanString(record.incorrectFeedback),
    difficulty,
    alignedOutcomeIds: quiz.alignedOutcomeIds,
    moduleId: quiz.moduleId,
    points: typeof record.points === "number" ? record.points : type === "essay" ? 6 : type === "short_answer" ? 4 : 2,
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
          'Return {"heroEyebrow": string, "heroHeading": string, "welcome": string, "purpose": string, "instructorNote": string, "pathItems": string[], "weeklyItems": string[]}.'
      });
      return {
        ...current,
        heroEyebrow: toCleanString(json.heroEyebrow) ?? current.heroEyebrow,
        heroHeading: toCleanString(json.heroHeading) ?? current.heroHeading,
        welcome: toCleanString(json.welcome) ?? current.welcome,
        purpose: toCleanString(json.purpose) ?? current.purpose,
        instructorNote: toCleanString(json.instructorNote) ?? current.instructorNote,
        pathItems: toStringList(json.pathItems).length ? toStringList(json.pathItems) : current.pathItems,
        weeklyItems: toStringList(json.weeklyItems).length ? toStringList(json.weeklyItems) : current.weeklyItems
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
          'Return {"courseDescription": string, "communicationExpectations": string, "lateWorkPolicy": string, "academicIntegrityPolicy": string, "aiUsePolicy": string, "learningOutcomes": string[], "requiredMaterials": string[]}.'
      });
      return {
        ...current,
        courseDescription: toCleanString(json.courseDescription) ?? current.courseDescription,
        communicationExpectations: toCleanString(json.communicationExpectations) ?? current.communicationExpectations,
        lateWorkPolicy: toCleanString(json.lateWorkPolicy) ?? current.lateWorkPolicy,
        academicIntegrityPolicy: toCleanString(json.academicIntegrityPolicy) ?? current.academicIntegrityPolicy,
        aiUsePolicy: toCleanString(json.aiUsePolicy) ?? current.aiUsePolicy,
        learningOutcomes: toStringList(json.learningOutcomes).length ? toStringList(json.learningOutcomes) : current.learningOutcomes,
        requiredMaterials: toStringList(json.requiredMaterials).length ? toStringList(json.requiredMaterials) : current.requiredMaterials
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
        outputContract: 'Return {"description": "<2-4 sentence course description>", "outcomes": ["<measurable outcome>", ...]}.'
      });
      const description = toCleanString(json.description);
      if (!description) throw new Error("AI did not return a course description.");
      return { description, outcomes: toStringList(json.outcomes) };
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
        outputContract: 'Return {"justification": "<paragraph explaining how the workload meets the credit-hour expectation>"}.'
      });
      const justification = toCleanString(json.justification);
      if (!justification) throw new Error("AI did not return a justification.");
      return justification;
    },
    () => course.contactHours.justification
  );
