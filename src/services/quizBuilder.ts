import type { CourseModule, CourseProject, ModuleItem, ObjectMetadata, Quiz, QuizDifficulty, QuizQuestion, QuizQuestionType } from "../types";
import { nowIso, slugify, stripHtml } from "../utils/text";

export type QuizTemplateId =
  | "concept-check"
  | "application-scenario"
  | "misconception-check"
  | "case-multiple-choice"
  | "true-false-explanation"
  | "short-answer-analysis"
  | "reflection-essay"
  | "vocabulary-term"
  | "data-interpretation"
  | "ethics-decision";

export type QuizIssueSeverity = "error" | "warning";
export type QuizPlanStatus = "Ready" | "Needs review";
export type QuizReviseAction = "variety" | "feedback" | "scenario" | "choices" | "outcomes" | "difficulty";

export interface QuizTemplate {
  id: QuizTemplateId;
  name: string;
  type: QuizQuestionType;
  description: string;
}

export interface QuizIssue {
  id: string;
  quizId: string;
  questionId?: string;
  severity: QuizIssueSeverity;
  title: string;
  detail: string;
}

export interface QuizSummary {
  quizId: string;
  status: QuizPlanStatus;
  issues: QuizIssue[];
}

export interface QuizPlanValidation {
  score: number;
  status: QuizPlanStatus;
  issues: QuizIssue[];
  summaries: QuizSummary[];
}

export const QUIZ_TEMPLATES: QuizTemplate[] = [
  { id: "concept-check", name: "Concept Check", type: "multiple_choice", description: "Checks a core idea with plausible answer choices." },
  { id: "application-scenario", name: "Application Scenario", type: "multiple_choice", description: "Asks students to apply a concept in context." },
  { id: "misconception-check", name: "Misconception Check", type: "multiple_choice", description: "Uses distractors based on common misunderstandings." },
  { id: "case-multiple-choice", name: "Case-Based Multiple Choice", type: "multiple_choice", description: "Frames a short case and asks for the best decision." },
  { id: "true-false-explanation", name: "True/False With Explanation", type: "true_false", description: "Checks a claim and includes feedback for explanation." },
  { id: "short-answer-analysis", name: "Short Answer Analysis", type: "short_answer", description: "Prompts a concise written analysis with grading guidance." },
  { id: "reflection-essay", name: "Reflection Or Essay", type: "essay", description: "Invites a longer response requiring instructor review." },
  { id: "vocabulary-term", name: "Vocabulary / Key Term", type: "short_answer", description: "Checks terminology with acceptable short answers." },
  { id: "data-interpretation", name: "Data Interpretation", type: "multiple_choice", description: "Asks students to interpret evidence or a simple result." },
  { id: "ethics-decision", name: "Ethics Decision Scenario", type: "essay", description: "Asks students to weigh stakeholders, evidence, and tradeoffs." }
];

export const QUIZ_REVISE_ACTIONS: Array<{ id: QuizReviseAction; label: string; description: string }> = [
  { id: "variety", label: "More variety", description: "Add a short-answer or essay item if the quiz is mostly selected response." },
  { id: "feedback", label: "Improve feedback", description: "Add helpful correct and incorrect feedback to every question." },
  { id: "scenario", label: "Add scenario", description: "Add a contextual application question." },
  { id: "choices", label: "Improve choices", description: "Make answer choices clearer and less giveaway-prone." },
  { id: "outcomes", label: "Align outcomes", description: "Apply quiz outcomes to questions that need alignment." },
  { id: "difficulty", label: "Adjust difficulty", description: "Balance difficulty across the quiz." }
];

const touchedMetadata = (metadata: ObjectMetadata | undefined, timestamp: string): ObjectMetadata => ({
  createdAt: metadata?.createdAt ?? timestamp,
  updatedAt: timestamp,
  lastExportedAt: metadata?.lastExportedAt,
  exportVersion: metadata?.exportVersion ?? 0,
  source: "edited"
});

const renumberItems = (items: ModuleItem[]): ModuleItem[] => items.map((item, index) => ({ ...item, order: index + 1, status: "edited" }));

const defaultModule = (course: CourseProject): CourseModule | undefined =>
  course.modules.find((module) => module.kind === "content") ?? course.modules.find((module) => module.kind !== "instructor") ?? course.modules[0];

const defaultQuizGroupId = (course: CourseProject): string =>
  course.assignmentGroups.find((group) => /quiz|knowledge|check/i.test(group.name))?.id ?? course.assignmentGroups[0]?.id ?? "group_quizzes";

const templateById = (templateId: QuizTemplateId): QuizTemplate => QUIZ_TEMPLATES.find((template) => template.id === templateId) ?? QUIZ_TEMPLATES[0];

const moduleTitleFor = (course: CourseProject, moduleId?: string): string => course.modules.find((module) => module.id === moduleId)?.title ?? "this module";

const outcomeIdsFor = (course: CourseProject, quiz?: Quiz): string[] => quiz?.alignedOutcomeIds.length ? quiz.alignedOutcomeIds : course.outcomes.slice(0, 2).map((outcome) => outcome.id);

export const buildQuizQuestionTemplate = (
  templateId: QuizTemplateId,
  course: CourseProject,
  quiz?: Quiz,
  options: { questionId?: string; timestamp?: string } = {}
): QuizQuestion => {
  const template = templateById(templateId);
  const quizId = quiz?.id ?? "quiz";
  const questionId = options.questionId ?? `${quizId}_${slugify(template.id)}_${Date.now().toString(36)}`;
  const moduleId = quiz?.moduleId ?? defaultModule(course)?.id ?? course.modules[0]?.id ?? "module_1";
  const alignedOutcomeIds = outcomeIdsFor(course, quiz);
  const base = {
    id: questionId,
    type: template.type,
    difficulty: "balanced" as QuizDifficulty,
    alignedOutcomeIds,
    moduleId,
    points: template.type === "essay" ? 6 : template.type === "short_answer" ? 4 : 2,
    feedback: "Review the module material and compare your answer to the success criteria.",
    correctFeedback: "Correct. This answer uses the module concept accurately.",
    incorrectFeedback: "Not yet. Revisit the module examples and look for the option that best uses evidence and context."
  };

  if (template.type === "true_false") {
    return {
      ...base,
      stem: `True or false: A strong answer in ${moduleTitleFor(course, moduleId)} should use evidence and context, not only opinion.`,
      choices: ["True", "False"],
      correctAnswer: "True"
    };
  }

  if (template.type === "short_answer") {
    return {
      ...base,
      stem: template.id === "vocabulary-term" ? "Name the key term that describes applying course concepts to a real situation." : `In 2-3 sentences, explain how one idea from ${moduleTitleFor(course, moduleId)} applies to a realistic example.`,
      correctAnswer: template.id === "vocabulary-term" ? "application|applied analysis" : undefined,
      instructorReviewRequired: template.id !== "vocabulary-term",
      correctFeedback: "Look for accurate terminology, a concrete example, and clear reasoning.",
      incorrectFeedback: "If the answer is vague, ask the student to add one specific course concept and example."
    };
  }

  if (template.type === "essay") {
    return {
      ...base,
      stem: template.id === "ethics-decision" ? "Analyze an ethical decision connected to this module. Name stakeholders, evidence, tradeoffs, and a recommended action." : "Reflect on one module concept that changed or complicated your thinking. Explain the concept, evidence, and implication.",
      instructorReviewRequired: true,
      correctFeedback: undefined,
      incorrectFeedback: undefined,
      feedback: "Use the rubric or grading guidance to evaluate specificity, evidence, reasoning, and clarity."
    };
  }

  const choices =
    template.id === "data-interpretation"
      ? ["Ignore the evidence and choose the fastest option", "Interpret the pattern, identify a limitation, and connect it to the concept", "Select the largest number only", "Treat all sources as equally strong"]
      : template.id === "misconception-check"
        ? ["A common shortcut that ignores context", "A careful answer grounded in evidence and consequences", "A personal preference without support", "A statement unrelated to the module"]
        : ["A narrow detail with no context", "An evidence-based application of the module concept", "A random course policy", "An unsupported personal opinion"];
  return {
    ...base,
    stem: template.id === "case-multiple-choice" || template.id === "application-scenario" ? `A student is applying ${moduleTitleFor(course, moduleId)} to a real case. Which response is strongest?` : `Which option best demonstrates understanding of ${moduleTitleFor(course, moduleId)}?`,
    choices,
    correctAnswer: choices[1]
  };
};

const hrefsFrom = (html: string): string[] => Array.from(html.matchAll(/href\s*=\s*["']([^"']*)["']/gi)).map((match) => match[1].trim());
const hasUnsafeHtml = (html: string): boolean => /<script[\s>]/i.test(html) || /\son[a-z]+\s*=/i.test(html) || /javascript\s*:/i.test(html) || /<(iframe|object|embed|form|input|button)[\s>]/i.test(html);

export const validateQuizPlan = (course: CourseProject): QuizPlanValidation => {
  const issues: QuizIssue[] = [];
  const moduleIds = new Set(course.modules.map((module) => module.id));
  const groupIds = new Set(course.assignmentGroups.map((group) => group.id));
  const outcomeIds = new Set(course.outcomes.map((outcome) => outcome.id));
  const quizItems = course.modules.flatMap((module) => module.items.filter((item) => item.type === "quiz").map((item) => ({ moduleId: module.id, item })));
  const knownTargets = new Set(course.pages.flatMap((page) => [`${slugify(page.slug || page.title)}.html`, `wiki_content/${slugify(page.slug || page.title)}.html`]));

  const add = (quiz: Quiz, id: string, severity: QuizIssueSeverity, title: string, detail: string, question?: QuizQuestion): void => {
    issues.push({ id: `${quiz.id}${question ? `-${question.id}` : ""}-${id}`, quizId: quiz.id, questionId: question?.id, severity, title, detail });
  };

  course.quizzes.forEach((quiz) => {
    const matchingItems = quizItems.filter(({ item }) => item.refId === quiz.id);
    const questionPoints = quiz.questions.reduce((sum, question) => sum + Number(question.points || 0), 0);
    if (!quiz.title.trim()) add(quiz, "title", "error", "Quiz title missing", "Canvas quizzes need a clear title.");
    if (stripHtml(quiz.purpose).length < 24) add(quiz, "purpose", "warning", "Purpose is thin", "Add a short student-facing purpose for the quiz.");
    if (quiz.questions.length === 0) add(quiz, "questions", "error", "No questions", "Add at least one question before export.");
    if (!Number.isFinite(quiz.points) || quiz.points <= 0) add(quiz, "points", "error", "Quiz points invalid", "Use a positive point value.");
    if (questionPoints > 0 && Math.abs(questionPoints - quiz.points) > Math.max(2, quiz.points * 0.25)) add(quiz, "point-total", "warning", "Question points differ", `Questions total ${questionPoints} points while the quiz is worth ${quiz.points}.`);
    if (!moduleIds.has(quiz.moduleId)) add(quiz, "module", "error", "Module missing", "Choose a module that exists in the course.");
    if (!groupIds.has(quiz.assignmentGroupId)) add(quiz, "group", "error", "Assignment group missing", "Choose a valid gradebook assignment group.");
    if (quiz.alignedOutcomeIds.length === 0 || quiz.alignedOutcomeIds.some((outcomeId) => !outcomeIds.has(outcomeId))) add(quiz, "outcomes", "warning", "Outcomes not aligned", "Align the quiz to at least one valid course outcome.");
    if (matchingItems.length === 0) add(quiz, "module-item", "error", "Missing from Modules", "Every quiz should appear as a module item.");
    else if (matchingItems.some(({ moduleId }) => moduleId !== quiz.moduleId)) add(quiz, "module-mismatch", "error", "Module placement mismatch", "The quiz object and module item location disagree.");
    hrefsFrom(quiz.purpose)
      .filter((href) => href && href !== "#" && !/^https?:\/\//i.test(href) && !/^mailto:/i.test(href) && !href.startsWith("#"))
      .filter((href) => !knownTargets.has(href.replace(/^\.\//, "")))
      .forEach((href) => add(quiz, "broken-links", "warning", "Internal link may not resolve", `Check ${href} before export.`));
    if (hasUnsafeHtml(quiz.purpose)) add(quiz, "unsafe-purpose", "error", "Unsafe quiz purpose", "Remove scripts, event handlers, JavaScript links, forms, or embeds.");

    quiz.questions.forEach((question) => {
      const text = stripHtml(question.stem);
      if (text.length < 12) add(quiz, "stem", "error", "Question stem missing", "Write a clear question stem.", question);
      if (!Number.isFinite(question.points) || question.points <= 0) add(quiz, "points", "error", "Question points invalid", "Use a positive point value for each question.", question);
      if (!["multiple_choice", "true_false", "short_answer", "essay"].includes(question.type)) add(quiz, "type", "error", "Question type unsupported", "Choose a supported Canvas-safe question type.", question);
      if (question.type === "multiple_choice" && (!question.choices || question.choices.filter((choice) => choice.trim()).length < 2)) add(quiz, "choices", "error", "Choices missing", "Multiple choice questions need at least two answer choices.", question);
      if (question.type === "multiple_choice" && (!question.correctAnswer || !(question.choices ?? []).includes(question.correctAnswer))) add(quiz, "answer", "error", "Correct answer invalid", "Select a correct answer that matches one of the choices.", question);
      if (question.type === "true_false" && !["True", "False"].includes(question.correctAnswer ?? "")) add(quiz, "true-false-answer", "error", "True/false answer invalid", "True/false questions need True or False as the correct answer.", question);
      if ((question.type === "short_answer" || question.type === "essay") && stripHtml(question.feedback ?? question.correctFeedback ?? "").length < 18) add(quiz, "feedback", "warning", "Grading guidance missing", "Add feedback or grading guidance for open-response questions.", question);
      if ((question.type === "multiple_choice" || question.type === "true_false") && !question.correctFeedback && !question.incorrectFeedback && !question.feedback) add(quiz, "feedback", "warning", "Feedback missing", "Add feedback so students know why an answer is right or wrong.", question);
      if (question.alignedOutcomeIds.length === 0 || question.alignedOutcomeIds.some((outcomeId) => !outcomeIds.has(outcomeId))) add(quiz, "outcomes", "warning", "Question outcomes missing", "Align the question to at least one valid outcome.", question);
      if (question.moduleId !== quiz.moduleId) add(quiz, "question-module", "error", "Question module mismatch", "Question module IDs should match the parent quiz.", question);
      if (hasUnsafeHtml(`${question.stem} ${question.feedback ?? ""} ${question.correctFeedback ?? ""} ${question.incorrectFeedback ?? ""}`)) add(quiz, "unsafe-html", "error", "Unsafe question HTML", "Remove scripts, event handlers, JavaScript links, forms, or embeds.", question);
    });
  });

  const summaries = course.quizzes.map((quiz) => {
    const quizIssues = issues.filter((issue) => issue.quizId === quiz.id);
    return { quizId: quiz.id, status: quizIssues.some((issue) => issue.severity === "error") ? "Needs review" : "Ready", issues: quizIssues } satisfies QuizSummary;
  });
  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.filter((issue) => issue.severity === "warning").length;
  return { score: Math.max(0, Math.round(100 - errors * 8 - warnings * 2)), status: errors > 0 ? "Needs review" : "Ready", issues, summaries };
};

export const createQuiz = (course: CourseProject, options: { templateId?: QuizTemplateId; quizId?: string; timestamp?: string } = {}): CourseProject => {
  const timestamp = options.timestamp ?? nowIso();
  const module = defaultModule(course);
  if (!module) return course;
  const quizId = options.quizId ?? `quiz_${Date.now().toString(36)}`;
  const alignedOutcomeIds = course.outcomes.slice(0, 2).map((outcome) => outcome.id);
  const question = buildQuizQuestionTemplate(options.templateId ?? "concept-check", course, { id: quizId, title: "New Quiz", purpose: "", moduleId: module.id, assignmentGroupId: defaultQuizGroupId(course), points: 2, questions: [], alignedOutcomeIds, publishState: "unpublished", status: "edited", metadata: touchedMetadata(undefined, timestamp) });
  const quiz: Quiz = {
    id: quizId,
    title: "New Quiz",
    purpose: `Check understanding of ${module.title} with Canvas-safe question types and feedback.`,
    moduleId: module.id,
    assignmentGroupId: defaultQuizGroupId(course),
    points: question.points,
    questions: [question],
    alignedOutcomeIds,
    publishState: "unpublished",
    status: "edited",
    metadata: touchedMetadata(undefined, timestamp)
  };
  const item: ModuleItem = { id: `item_${quizId}`, type: "quiz", title: quiz.title, refId: quizId, order: module.items.length + 1, indent: 0, publishState: "unpublished", status: "edited", metadata: touchedMetadata(undefined, timestamp) };
  return {
    ...course,
    quizzes: [...course.quizzes, quiz],
    modules: course.modules.map((entry) => (entry.id === module.id ? { ...entry, expanded: true, items: renumberItems([...entry.items, item]), status: "edited", metadata: touchedMetadata(entry.metadata, timestamp) } : entry))
  };
};

export const changeQuizModule = (course: CourseProject, quizId: string, moduleId: string, timestamp = nowIso()): CourseProject => {
  const quiz = course.quizzes.find((entry) => entry.id === quizId);
  const target = course.modules.find((module) => module.id === moduleId);
  if (!quiz || !target) return course;
  const existingItem = course.modules.flatMap((module) => module.items).find((item) => item.type === "quiz" && item.refId === quizId);
  const item: ModuleItem = existingItem
    ? { ...existingItem, title: quiz.title, publishState: quiz.publishState, status: "edited", metadata: touchedMetadata(existingItem.metadata, timestamp) }
    : { id: `item_${quizId}`, type: "quiz", title: quiz.title, refId: quizId, order: target.items.length + 1, indent: 0, publishState: quiz.publishState, status: "edited", metadata: touchedMetadata(undefined, timestamp) };
  return {
    ...course,
    quizzes: course.quizzes.map((entry) =>
      entry.id === quizId
        ? { ...entry, moduleId, questions: entry.questions.map((question) => ({ ...question, moduleId })), status: "edited", metadata: touchedMetadata(entry.metadata, timestamp) }
        : entry
    ),
    modules: course.modules.map((module) => {
      const without = module.items.filter((moduleItem) => !(moduleItem.type === "quiz" && moduleItem.refId === quizId));
      if (module.id !== moduleId) return { ...module, items: renumberItems(without) };
      return { ...module, expanded: true, items: renumberItems([...without, item]), status: "edited", metadata: touchedMetadata(module.metadata, timestamp) };
    }),
    schedule: course.schedule.map((entry) => (entry.itemId === quizId ? { ...entry, moduleId } : entry))
  };
};

export const renameQuizEverywhere = (course: CourseProject, quizId: string, title: string, timestamp = nowIso()): CourseProject => ({
  ...course,
  quizzes: course.quizzes.map((quiz) => (quiz.id === quizId ? { ...quiz, title, status: "edited", metadata: touchedMetadata(quiz.metadata, timestamp) } : quiz)),
  modules: course.modules.map((module) => ({
    ...module,
    items: module.items.map((item) => (item.type === "quiz" && item.refId === quizId ? { ...item, title, status: "edited", metadata: touchedMetadata(item.metadata, timestamp) } : item))
  })),
  schedule: course.schedule.map((entry) => (entry.itemId === quizId ? { ...entry, title } : entry))
});

export const duplicateQuiz = (course: CourseProject, quizId: string, options: { stamp?: string | number; timestamp?: string } = {}): CourseProject => {
  const quiz = course.quizzes.find((entry) => entry.id === quizId);
  if (!quiz) return course;
  const stamp = options.stamp ?? Date.now();
  const timestamp = options.timestamp ?? nowIso();
  const copyId = `${quiz.id}_copy_${stamp}`;
  const copy: Quiz = {
    ...quiz,
    id: copyId,
    title: `${quiz.title} Copy`,
    questions: quiz.questions.map((question, index) => ({ ...question, id: `${copyId}_q${index + 1}`, moduleId: quiz.moduleId })),
    status: "edited",
    metadata: touchedMetadata(quiz.metadata, timestamp)
  };
  const module = course.modules.find((entry) => entry.id === copy.moduleId);
  const item: ModuleItem | undefined = module
    ? { id: `item_${copyId}`, type: "quiz", title: copy.title, refId: copy.id, order: module.items.length + 1, indent: 0, publishState: copy.publishState, status: "edited", metadata: touchedMetadata(undefined, timestamp) }
    : undefined;
  return {
    ...course,
    quizzes: [...course.quizzes, copy],
    modules: item ? course.modules.map((entry) => (entry.id === module?.id ? { ...entry, expanded: true, items: renumberItems([...entry.items, item]), status: "edited", metadata: touchedMetadata(entry.metadata, timestamp) } : entry)) : course.modules
  };
};

export const deleteQuiz = (course: CourseProject, quizId: string): CourseProject => ({
  ...course,
  quizzes: course.quizzes.filter((quiz) => quiz.id !== quizId),
  modules: course.modules.map((module) => ({ ...module, items: renumberItems(module.items.filter((item) => !(item.type === "quiz" && item.refId === quizId))) })),
  schedule: course.schedule.filter((entry) => entry.itemId !== quizId)
});

export const restoreQuiz = (course: CourseProject, quiz: Quiz, timestamp = nowIso()): CourseProject => {
  const restored = { ...quiz, status: "edited" as const, metadata: touchedMetadata(quiz.metadata, timestamp) };
  const withQuiz = course.quizzes.some((entry) => entry.id === quiz.id) ? { ...course, quizzes: course.quizzes.map((entry) => (entry.id === quiz.id ? restored : entry)) } : { ...course, quizzes: [...course.quizzes, restored] };
  return changeQuizModule(withQuiz, quiz.id, quiz.moduleId, timestamp);
};

export const reviseQuiz = (course: CourseProject, quizId: string, action: QuizReviseAction, timestamp = nowIso()): CourseProject => {
  const quiz = course.quizzes.find((entry) => entry.id === quizId);
  if (!quiz) return course;
  const updated = { ...quiz, status: "edited" as const, metadata: touchedMetadata(quiz.metadata, timestamp) };
  if (action === "variety" && !quiz.questions.some((question) => question.type === "short_answer" || question.type === "essay")) {
    updated.questions = [...quiz.questions, buildQuizQuestionTemplate("short-answer-analysis", course, quiz, { questionId: `${quiz.id}_q${quiz.questions.length + 1}_${Date.now().toString(36)}` })];
  } else if (action === "scenario") {
    updated.questions = [...quiz.questions, buildQuizQuestionTemplate("application-scenario", course, quiz, { questionId: `${quiz.id}_scenario_${Date.now().toString(36)}` })];
  } else if (action === "outcomes") {
    const aligned = outcomeIdsFor(course, quiz);
    updated.questions = quiz.questions.map((question) => ({ ...question, alignedOutcomeIds: question.alignedOutcomeIds.length ? question.alignedOutcomeIds : aligned }));
  } else if (action === "difficulty") {
    updated.questions = quiz.questions.map((question, index) => ({ ...question, difficulty: index % 3 === 0 ? "introductory" : index % 3 === 1 ? "balanced" : "challenging" }));
  } else {
    updated.questions = quiz.questions.map((question) => ({
      ...question,
      choices: action === "choices" && question.type === "multiple_choice" && question.choices ? question.choices.map((choice, index) => (index === 0 ? `${choice} (too narrow)` : choice)) : question.choices,
      feedback: question.feedback || "Use the module concepts and feedback to revise your understanding.",
      correctFeedback: question.correctFeedback || "Correct. This response is accurate and supported.",
      incorrectFeedback: question.incorrectFeedback || "Review the module examples and compare each choice against the evidence."
    }));
  }
  updated.points = updated.questions.reduce((sum, question) => sum + Number(question.points || 0), 0);
  return { ...course, quizzes: course.quizzes.map((entry) => (entry.id === quizId ? updated : entry)) };
};
