// ============================================================================
// Printable quiz PDFs — student copy and instructor answer key
// ----------------------------------------------------------------------------
// Builds clean, paper-friendly quiz PDFs on the shared pdfDoc engine:
//   • Student copy  — title, instructions, questions, point values, and answer
//                     space. NO correct answers or feedback.
//   • Answer key    — instructor-only: correct answers, feedback/explanations,
//                     points, difficulty, and outcome alignment.
// Single-quiz and all-quizzes-combined variants are provided for both.
// Instructors must verify every answer key before use (disclaimer rendered).
// ============================================================================

import type { CourseProject, Quiz, QuizQuestion } from "../types";
import { slugify, stripHtml } from "../utils/text";
import { PdfDoc } from "./pdfDoc";

const TYPE_LABEL: Record<QuizQuestion["type"], string> = {
  multiple_choice: "Multiple choice",
  true_false: "True / False",
  short_answer: "Short answer",
  essay: "Essay / reflection"
};

const choiceLetter = (index: number): string => String.fromCharCode(65 + index);

const outcomeCodes = (course: CourseProject, ids: string[]): string =>
  ids
    .map((id) => course.outcomes.find((outcome) => outcome.id === id)?.code)
    .filter((code): code is string => Boolean(code))
    .join(", ");

const quizPoints = (quiz: Quiz): number => quiz.questions.reduce((sum, question) => sum + (question.points || 0), 0);

// ---- Student copy ----------------------------------------------------------

const renderStudentQuiz = (doc: PdfDoc, course: CourseProject, quiz: Quiz): void => {
  doc.heading(quiz.title, 17);
  doc.para(`Course: ${course.title}`);
  doc.raw(`Total points: ${quizPoints(quiz)}  |  Questions: ${quiz.questions.length}`);
  doc.spacer(4);
  doc.para("Name: ______________________________   Date: __________________");
  doc.spacer(6);
  if (quiz.purpose) doc.para(quiz.purpose);
  doc.para("Answer every question. Point values are shown for each item. Show your work where appropriate.");
  doc.spacer(6);

  quiz.questions.forEach((question, index) => {
    doc.heading(`${index + 1}. (${question.points} pt${question.points === 1 ? "" : "s"}) ${stripHtml(question.stem)}`, 12);
    if ((question.type === "multiple_choice" || question.type === "true_false") && question.choices?.length) {
      question.choices.forEach((choice, choiceIndex) => doc.raw(`   ${choiceLetter(choiceIndex)}.  ${stripHtml(choice)}`));
    } else if (question.type === "short_answer") {
      doc.answerSpace(2);
    } else {
      doc.answerSpace(5);
    }
  });
};

export const buildQuizStudentPdfBlob = (course: CourseProject, quiz: Quiz): Blob => {
  const doc = new PdfDoc();
  doc.title("Quiz");
  renderStudentQuiz(doc, course, quiz);
  return doc.blob();
};

export const buildAllQuizzesStudentPdfBlob = (course: CourseProject): Blob => {
  const doc = new PdfDoc();
  doc.title(`${course.title} — Quizzes (Student Copies)`);
  doc.para("This packet contains the student copy of every quiz in the course. No answers are included.");
  course.quizzes.forEach((quiz, index) => {
    if (index > 0) doc.spacer(14);
    renderStudentQuiz(doc, course, quiz);
  });
  if (!course.quizzes.length) doc.para("This course has no quizzes yet.");
  return doc.blob();
};

// ---- Answer key (instructor only) ------------------------------------------

const renderAnswerKey = (doc: PdfDoc, course: CourseProject, quiz: Quiz): void => {
  doc.heading(`${quiz.title} — Answer Key`, 17);
  doc.para(`Course: ${course.title}`);
  doc.raw(`Total points: ${quizPoints(quiz)}  |  Questions: ${quiz.questions.length}`);
  doc.spacer(6);

  quiz.questions.forEach((question, index) => {
    doc.heading(`${index + 1}. (${question.points} pt${question.points === 1 ? "" : "s"}) ${stripHtml(question.stem)}`, 12);
    doc.raw(`Type: ${TYPE_LABEL[question.type]}  |  Difficulty: ${question.difficulty}`);
    if (question.type === "multiple_choice" || question.type === "true_false") {
      if (question.choices?.length) {
        question.choices.forEach((choice, choiceIndex) => {
          const mark = choice === question.correctAnswer ? "  <== correct" : "";
          doc.raw(`   ${choiceLetter(choiceIndex)}.  ${stripHtml(choice)}${mark}`);
        });
      }
      doc.raw(`Correct answer: ${question.correctAnswer ? stripHtml(question.correctAnswer) : "(set by instructor)"}`);
    } else {
      doc.para(`Suggested response / grading guidance: ${question.feedback ? stripHtml(question.feedback) : "Instructor grades against the rubric and learning objective."}`);
    }
    if (question.correctFeedback) doc.para(`Feedback (correct): ${stripHtml(question.correctFeedback)}`);
    if (question.incorrectFeedback) doc.para(`Feedback (incorrect): ${stripHtml(question.incorrectFeedback)}`);
    if (question.feedback && (question.type === "multiple_choice" || question.type === "true_false")) {
      doc.para(`Explanation: ${stripHtml(question.feedback)}`);
    }
    const codes = outcomeCodes(course, question.alignedOutcomeIds);
    if (codes) doc.raw(`Aligned outcomes: ${codes}`);
    if (question.instructorReviewRequired) doc.raw("** Flagged for instructor review before use. **");
  });
};

const answerKeyDisclaimer = (doc: PdfDoc): void => {
  doc.raw("INSTRUCTOR ANSWER KEY — NOT FOR STUDENT DISTRIBUTION", 13);
  doc.para(
    "AI-generated and template-generated questions and answer keys may contain errors. Verify every answer, " +
      "distractor, and explanation against your materials, edition, and classroom context before grading or " +
      "publishing."
  );
  doc.spacer(6);
};

export const buildQuizAnswerKeyPdfBlob = (course: CourseProject, quiz: Quiz): Blob => {
  const doc = new PdfDoc();
  doc.title("Answer Key");
  answerKeyDisclaimer(doc);
  renderAnswerKey(doc, course, quiz);
  return doc.blob();
};

export const buildAllQuizzesAnswerKeyPdfBlob = (course: CourseProject): Blob => {
  const doc = new PdfDoc();
  doc.title(`${course.title} — Combined Answer Key`);
  answerKeyDisclaimer(doc);
  course.quizzes.forEach((quiz, index) => {
    if (index > 0) doc.spacer(14);
    renderAnswerKey(doc, course, quiz);
  });
  if (!course.quizzes.length) doc.para("This course has no quizzes yet.");
  return doc.blob();
};

// ---- File names ------------------------------------------------------------

export const quizStudentPdfFileName = (course: CourseProject, quiz: Quiz): string =>
  `${slugify(course.title || "course")}-${slugify(quiz.title || "quiz")}-student.pdf`;

export const quizAnswerKeyPdfFileName = (course: CourseProject, quiz: Quiz): string =>
  `${slugify(course.title || "course")}-${slugify(quiz.title || "quiz")}-answer-key.pdf`;

export const allQuizzesStudentPdfFileName = (course: CourseProject): string =>
  `${slugify(course.title || "course")}-all-quizzes-student.pdf`;

export const allQuizzesAnswerKeyPdfFileName = (course: CourseProject): string =>
  `${slugify(course.title || "course")}-all-quizzes-answer-key.pdf`;
