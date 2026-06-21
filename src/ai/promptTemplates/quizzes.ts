import { makePromptTemplateSeries } from "./templateFactory";

export const quizPromptTemplates = makePromptTemplateSeries({
  idBase: "quizDraft",
  stage: "quizDraft",
  name: "Quiz Drafting",
  purpose: "Generate useful quiz questions with answers, feedback, difficulty, and outcome alignment.",
  inputSchemaDescription:
    "Input includes blueprint, module draft, target outcomes, quiz purpose, number of questions, supported question types, difficulty, point plan, and source constraints.",
  outputSchemaDescription:
    "Return QuizDraft JSON with id, title, purpose, moduleId, assignmentGroupId, points, instructions, questions, alignedOutcomeIds, validationWarnings, and modelGaps. Questions include id, type, stem, choices when needed, correctAnswer when objectively scorable, feedback, correctFeedback, incorrectFeedback, difficulty, points, and alignedOutcomeIds.",
  systemInstructions:
    "Quizzes should check meaningful understanding, not trivia or obvious recall only.",
  developerInstructions:
    "Supported first-version question types are multiple_choice, true_false, short_answer, and scenario_based_short_answer. Include feedback for correct and incorrect responses. Mark subjective items for instructor review when needed.",
  userPromptTemplate: `Approved blueprint:
{{blueprintJson}}

Module draft:
{{moduleDraftJson}}

Quiz request:
{{quizRequestJson}}

Generate a QuizDraft JSON object. Include title, purpose, instructions, question list, question type, stem, answer choices when needed, correct answer when objectively scorable, feedback, difficulty, points, outcome alignment, instructorReviewRequired for subjective questions, validationWarnings, and modelGaps.`,
  qualityChecklist: [
    "Questions cover the module objectives.",
    "Questions include answer keys and feedback where appropriate.",
    "Difficulty mix matches the request.",
    "Scenario questions require application, not memorization.",
    "Point values total the quiz points."
  ],
  failureModes: [
    "Questions are shallow or obvious.",
    "Feedback is missing.",
    "Correct answers are ambiguous without an instructorReviewRequired flag."
  ],
  notes: "Quiz prompt versions focus on answerability, useful feedback, and QTI-friendly structure."
});
