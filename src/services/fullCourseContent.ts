// Whole-course "flesh it out" pass.
//
// The per-builder AI actions in aiBuilders.ts each fill ONE object (a page, a quiz,
// an assignment...) and are wired to per-item "Generate with AI" buttons. To produce a
// genuinely full .imscc the instructor would otherwise have to click every one of those
// buttons by hand. This module runs them all in a single bounded-concurrency pass and
// returns a new CourseProject with the rich content applied, so the export packages a
// complete course instead of the templated scaffold.
//
// Every builder already drops to its deterministic template on any failure (withFallback),
// so this pass never hard-fails: worst case it returns the same structured course it
// started with and reports how many objects fell back.

import type { Assignment, CoursePage, CourseProject, Discussion, ObjectMetadata, Quiz, QuizQuestion } from "../types";
import type { AiSource } from "./aiAssist";
import {
  aiGenerateAssignmentDescription,
  aiGenerateDiscussionPrompt,
  aiGeneratePageBody,
  aiGenerateQuizQuestions
} from "./aiBuilders";

export interface FullFillProgress {
  completed: number;
  total: number;
  /** Human label for the object that just finished, e.g. "Lesson: Siege Warfare". */
  label: string;
}

export interface FullFillCounts {
  pages: number;
  assignments: number;
  discussions: number;
  quizzes: number;
}

export interface FullFillPlan extends FullFillCounts {
  /** Total number of AI requests this pass will attempt. */
  total: number;
}

export interface FullFillResult {
  course: CourseProject;
  /** How many requests were attempted. */
  total: number;
  /** How many returned real AI content. */
  aiCount: number;
  /** How many fell back to the deterministic template (proxy unreachable, bad output, aborted). */
  fallbackCount: number;
  /** AI-filled objects applied, per content type. */
  applied: FullFillCounts;
}

export interface FullFillOptions {
  onProgress?: (progress: FullFillProgress) => void;
  /** Coarse cooperative cancel — checked between objects, not mid-request. */
  signal?: AbortSignal;
  /** Max in-flight AI requests. Keeps a 10-week course from firing ~40 calls at once. */
  concurrency?: number;
}

const touchMetadata = (metadata: ObjectMetadata | undefined, timestamp: string): ObjectMetadata => ({
  createdAt: metadata?.createdAt ?? timestamp,
  updatedAt: timestamp,
  lastExportedAt: metadata?.lastExportedAt,
  exportVersion: metadata?.exportVersion ?? 0,
  source: "edited"
});

// Which pages are lesson content worth (re)writing with AI. The module overview, readings,
// practice, and milestone pages are deliberately structural (glance tables, navigation bars,
// header images) — replacing them with a generic lesson body would lose that scaffolding and
// break in-course navigation. The "Lecture and Notes" reading is the teaching page, so that's
// what we flesh out. The homepage (frontPage) and syllabus are left to their own structured flows.
export const isFillablePage = (page: CoursePage): boolean =>
  Boolean(page.moduleId) && !page.frontPage && /lecture|notes/i.test(`${page.slug} ${page.title}`);

/** Count the objects a full-fill pass would touch, without running it (for cost preview / UI copy). */
export const planFullCourseFill = (course: CourseProject): FullFillPlan => {
  const pages = course.pages.filter(isFillablePage).length;
  const assignments = course.assignments.length;
  const discussions = course.discussions.length;
  const quizzes = course.quizzes.length;
  return { pages, assignments, discussions, quizzes, total: pages + assignments + discussions + quizzes };
};

interface FillTask {
  label: string;
  run: () => Promise<void>;
}

class AbortError extends Error {
  constructor() {
    super("Full course content fill was cancelled.");
    this.name = "AbortError";
  }
}

/**
 * Run every per-object AI builder across the course and return a new CourseProject with the
 * rich content merged in. Pure with respect to the input course (a new object is returned);
 * the caller is responsible for applying it to state.
 */
export const fillEntireCourseContent = async (
  course: CourseProject,
  options: FullFillOptions = {}
): Promise<FullFillResult> => {
  const { onProgress, signal, concurrency = 4 } = options;
  const timestamp = new Date().toISOString();

  const pageBodies = new Map<string, string>();
  const assignmentDescriptions = new Map<string, string>();
  const discussionPrompts = new Map<string, string>();
  const quizQuestionSets = new Map<string, QuizQuestion[]>();

  let aiCount = 0;
  let fallbackCount = 0;
  const tally = (source: AiSource): void => {
    if (source === "ai") aiCount += 1;
    else fallbackCount += 1;
  };

  const tasks: FillTask[] = [
    ...course.pages.filter(isFillablePage).map((page) => ({
      label: `Lesson: ${page.title}`,
      run: async () => {
        const result = await aiGeneratePageBody(course, page);
        // Only keep AI output; a fallback would just re-emit a template the page already has.
        if (result.source === "ai") pageBodies.set(page.id, result.value);
        tally(result.source);
      }
    })),
    ...course.assignments.map((assignment) => ({
      label: `Assignment: ${assignment.title}`,
      run: async () => {
        const result = await aiGenerateAssignmentDescription(course, assignment);
        if (result.source === "ai") assignmentDescriptions.set(assignment.id, result.value);
        tally(result.source);
      }
    })),
    ...course.discussions.map((discussion) => ({
      label: `Discussion: ${discussion.title}`,
      run: async () => {
        const result = await aiGenerateDiscussionPrompt(course, discussion);
        if (result.source === "ai") discussionPrompts.set(discussion.id, result.value);
        tally(result.source);
      }
    })),
    ...course.quizzes.map((quiz) => ({
      label: `Quiz: ${quiz.title}`,
      run: async () => {
        const result = await aiGenerateQuizQuestions(course, quiz);
        // Replace (not append) on success so we don't stack AI questions on the templated ones.
        // On fallback, keep the quiz's existing generated questions untouched.
        if (result.source === "ai" && result.value.length) quizQuestionSets.set(quiz.id, result.value);
        tally(result.source);
      }
    }))
  ];

  const total = tasks.length;
  let completed = 0;
  onProgress?.({ completed, total, label: total ? "Starting" : "Nothing to fill" });

  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < tasks.length) {
      if (signal?.aborted) throw new AbortError();
      const task = tasks[cursor];
      cursor += 1;
      await task.run();
      completed += 1;
      onProgress?.({ completed, total, label: task.label });
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), Math.max(1, total)) }, () => worker()));

  const applyPage = (page: CoursePage): CoursePage =>
    pageBodies.has(page.id)
      ? { ...page, bodyHtml: pageBodies.get(page.id) as string, status: "edited", metadata: touchMetadata(page.metadata, timestamp) }
      : page;

  const applyAssignment = (assignment: Assignment): Assignment =>
    assignmentDescriptions.has(assignment.id)
      ? { ...assignment, descriptionHtml: assignmentDescriptions.get(assignment.id) as string, status: "edited", metadata: touchMetadata(assignment.metadata, timestamp) }
      : assignment;

  const applyDiscussion = (discussion: Discussion): Discussion =>
    discussionPrompts.has(discussion.id)
      ? { ...discussion, promptHtml: discussionPrompts.get(discussion.id) as string, status: "edited", metadata: touchMetadata(discussion.metadata, timestamp) }
      : discussion;

  const applyQuiz = (quiz: Quiz): Quiz => {
    const questions = quizQuestionSets.get(quiz.id);
    if (!questions) return quiz;
    return {
      ...quiz,
      questions,
      points: questions.reduce((sum, question) => sum + question.points, 0),
      status: "edited",
      metadata: touchMetadata(quiz.metadata, timestamp)
    };
  };

  const filled: CourseProject = {
    ...course,
    pages: course.pages.map(applyPage),
    assignments: course.assignments.map(applyAssignment),
    discussions: course.discussions.map(applyDiscussion),
    quizzes: course.quizzes.map(applyQuiz)
  };

  return {
    course: filled,
    total,
    aiCount,
    fallbackCount,
    applied: {
      pages: pageBodies.size,
      assignments: assignmentDescriptions.size,
      discussions: discussionPrompts.size,
      quizzes: quizQuestionSets.size
    }
  };
};
