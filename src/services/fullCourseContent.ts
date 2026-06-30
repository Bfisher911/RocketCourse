// Whole-course "flesh it out" pass.
//
// The per-builder AI actions in aiBuilders.ts each fill ONE object and are wired to per-item
// "Generate with AI" buttons. To produce a genuinely full .imscc the instructor would otherwise
// have to click every one of those by hand. This module runs them all in a single
// bounded-concurrency pass and returns a new CourseProject with the rich content applied, so the
// export packages a complete course instead of the templated scaffold.
//
// Surfaces covered:
//   - Lecture/notes pages   -> full AI rewrite (aiGeneratePageBody)
//   - Every other page      -> subject-specific prose APPENDED, keeping glance tables / nav intact
//                              (overview, readings, practice, milestone, success guide, calendar, ...)
//   - Homepage              -> structured fields filled + re-rendered + a few real paragraphs added
//   - Syllabus              -> structured fields filled + re-rendered
//   - Announcements         -> warm, subject-specific instructor posts
//   - Assignments / Discussions / Quizzes -> full AI content
//
// Every builder falls back to its template/existing content on any failure (withFallback), so this
// pass never hard-fails: worst case it returns the same course it started with and reports the count.

import type {
  Announcement,
  Assignment,
  CoursePage,
  CourseProject,
  Discussion,
  HomepageContent,
  ObjectMetadata,
  Quiz,
  QuizQuestion,
  SyllabusContent
} from "../types";
import type { AiSource } from "./aiAssist";
import {
  aiGenerateAnnouncementBody,
  aiGenerateAssignmentDescription,
  aiGenerateDiscussionPrompt,
  aiGenerateHomepageContent,
  aiGeneratePageBody,
  aiGeneratePageProse,
  aiGenerateQuizQuestions,
  aiGenerateSyllabusContent
} from "./aiBuilders";
import { renderHomepage } from "./homepageTemplates";
import { renderSyllabus } from "./syllabusTemplates";
import { buildThemedCard } from "./themeDesign";

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
  announcements: number;
}

export interface FullFillPlan extends FullFillCounts {
  /** Total number of objects this pass will touch. */
  total: number;
}

export interface FullFillResult {
  course: CourseProject;
  total: number;
  /** How many objects got real AI content. */
  aiCount: number;
  /** How many fell back to the template/existing content (proxy unreachable, bad output, aborted). */
  fallbackCount: number;
  applied: FullFillCounts;
}

export interface FullFillOptions {
  onProgress?: (progress: FullFillProgress) => void;
  /** Coarse cooperative cancel — checked between objects, not mid-request. */
  signal?: AbortSignal;
  /** Max in-flight AI requests. Keeps a large course from firing dozens of calls at once. */
  concurrency?: number;
}

const touchMetadata = (metadata: ObjectMetadata | undefined, timestamp: string): ObjectMetadata => ({
  createdAt: metadata?.createdAt ?? timestamp,
  updatedAt: timestamp,
  lastExportedAt: metadata?.lastExportedAt,
  exportVersion: metadata?.exportVersion ?? 0,
  source: "edited"
});

// The "Lecture and Notes" reading is the teaching page — fully rewritten. The frontPage (homepage)
// and the syllabus page have their own structured flows, so they are NOT lecture pages.
export const isFillablePage = (page: CoursePage): boolean =>
  Boolean(page.moduleId) && !page.frontPage && /lecture|notes/i.test(`${page.slug} ${page.title}`);

const isHomepage = (page: CoursePage): boolean => Boolean(page.frontPage);
const isSyllabusPage = (page: CoursePage): boolean => page.slug === "syllabus";

// Every page that isn't the homepage, the syllabus, or a full-rewrite lecture page gets a
// subject-specific prose section appended while keeping its existing structure (glance tables, nav).
const isEnrichablePage = (page: CoursePage): boolean => !isHomepage(page) && !isSyllabusPage(page) && !isFillablePage(page);

/** Count the objects a full-fill pass would touch, without running it (for cost preview / UI copy). */
export const planFullCourseFill = (course: CourseProject): FullFillPlan => {
  const frontPage = course.pages.find(isHomepage);
  const syllabusPage = course.pages.find(isSyllabusPage);
  const homepageTasks = frontPage && course.homepage ? 1 : 0;
  const syllabusTasks = syllabusPage && course.syllabus ? 1 : 0;
  const pages =
    course.pages.filter(isFillablePage).length + course.pages.filter(isEnrichablePage).length + homepageTasks + syllabusTasks;
  const assignments = course.assignments.length;
  const discussions = course.discussions.length;
  const quizzes = course.quizzes.length;
  const announcements = (course.announcements ?? []).length;
  return { pages, assignments, discussions, quizzes, announcements, total: pages + assignments + discussions + quizzes + announcements };
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
 * Run every per-object AI builder across the course and return a new CourseProject with the rich
 * content merged in. Pure with respect to the input course (a new object is returned); the caller
 * applies it to state.
 */
export const fillEntireCourseContent = async (
  course: CourseProject,
  options: FullFillOptions = {}
): Promise<FullFillResult> => {
  const { onProgress, signal, concurrency = 4 } = options;
  const timestamp = new Date().toISOString();
  const theme = course.theme;

  const pageBodies = new Map<string, string>(); // lecture full rewrites
  const pageProse = new Map<string, string>(); // enrichment fragments to append (already card-wrapped)
  const assignmentDescriptions = new Map<string, string>();
  const discussionPrompts = new Map<string, string>();
  const quizQuestionSets = new Map<string, QuizQuestion[]>();
  const announcementBodies = new Map<string, string>();
  let homepageContent: HomepageContent | null = null;
  let homepageBodyHtml: string | null = null;
  let syllabusContent: SyllabusContent | null = null;
  let syllabusBodyHtml: string | null = null;

  let aiCount = 0;
  let fallbackCount = 0;
  const tally = (source: AiSource): void => {
    if (source === "ai") aiCount += 1;
    else fallbackCount += 1;
  };

  const frontPage = course.pages.find(isHomepage);
  const syllabusPage = course.pages.find(isSyllabusPage);

  const tasks: FillTask[] = [
    ...course.pages.filter(isFillablePage).map((page) => ({
      label: `Lesson: ${page.title}`,
      run: async () => {
        const result = await aiGeneratePageBody(course, page);
        if (result.source === "ai") pageBodies.set(page.id, result.value);
        tally(result.source);
      }
    })),
    ...course.pages.filter(isEnrichablePage).map((page) => ({
      label: `Page: ${page.title}`,
      run: async () => {
        const result = await aiGeneratePageProse(course, page);
        // Only append when the AI returned real prose; an empty fallback leaves the page untouched.
        if (result.source === "ai" && result.value.trim()) {
          pageProse.set(page.id, buildThemedCard(theme, "In Focus", result.value));
        }
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
        // Replace (not append) on success; keep existing generated questions on fallback.
        if (result.source === "ai" && result.value.length) quizQuestionSets.set(quiz.id, result.value);
        tally(result.source);
      }
    })),
    ...(course.announcements ?? []).map((announcement) => ({
      label: `Announcement: ${announcement.title}`,
      run: async () => {
        const result = await aiGenerateAnnouncementBody(course, announcement);
        if (result.source === "ai") announcementBodies.set(announcement.id, result.value);
        tally(result.source);
      }
    }))
  ];

  if (frontPage && course.homepage) {
    const homepageState = course.homepage;
    tasks.push({
      label: "Homepage",
      run: async () => {
        const result = await aiGenerateHomepageContent(course, homepageState.content);
        tally(result.source);
        // Re-render the structured homepage from the (possibly enriched) content, then add a few real
        // paragraphs of subject prose below the cards so the front page reads as written content.
        const content = result.source === "ai" ? result.value : homepageState.content;
        let html = renderHomepage(homepageState.templateId, content, theme, course);
        const prose = await aiGeneratePageProse(course, frontPage);
        if (prose.source === "ai" && prose.value.trim()) html += buildThemedCard(theme, "About This Course", prose.value);
        homepageContent = content;
        homepageBodyHtml = html;
      }
    });
  }

  if (syllabusPage && course.syllabus) {
    const syllabusState = course.syllabus;
    tasks.push({
      label: "Syllabus",
      run: async () => {
        const result = await aiGenerateSyllabusContent(course, syllabusState.content);
        tally(result.source);
        const content = result.source === "ai" ? result.value : syllabusState.content;
        syllabusContent = content;
        syllabusBodyHtml = renderSyllabus(syllabusState.templateId, content, theme);
      }
    });
  }

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

  const applyPage = (page: CoursePage): CoursePage => {
    if (homepageBodyHtml !== null && isHomepage(page)) {
      return { ...page, bodyHtml: homepageBodyHtml, status: "edited", metadata: touchMetadata(page.metadata, timestamp) };
    }
    if (syllabusBodyHtml !== null && isSyllabusPage(page)) {
      return { ...page, bodyHtml: syllabusBodyHtml, status: "edited", metadata: touchMetadata(page.metadata, timestamp) };
    }
    if (pageBodies.has(page.id)) {
      return { ...page, bodyHtml: pageBodies.get(page.id) as string, status: "edited", metadata: touchMetadata(page.metadata, timestamp) };
    }
    if (pageProse.has(page.id)) {
      return { ...page, bodyHtml: `${page.bodyHtml}${pageProse.get(page.id) as string}`, status: "edited", metadata: touchMetadata(page.metadata, timestamp) };
    }
    return page;
  };

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

  const applyAnnouncement = (announcement: Announcement): Announcement =>
    announcementBodies.has(announcement.id)
      ? { ...announcement, bodyHtml: announcementBodies.get(announcement.id) as string, status: "edited", metadata: touchMetadata(announcement.metadata, timestamp) }
      : announcement;

  const filled: CourseProject = {
    ...course,
    homepage: course.homepage && homepageContent ? { ...course.homepage, content: homepageContent } : course.homepage,
    syllabus: course.syllabus && syllabusContent ? { ...course.syllabus, content: syllabusContent } : course.syllabus,
    pages: course.pages.map(applyPage),
    assignments: course.assignments.map(applyAssignment),
    discussions: course.discussions.map(applyDiscussion),
    quizzes: course.quizzes.map(applyQuiz),
    announcements: (course.announcements ?? []).map(applyAnnouncement)
  };

  const enrichedPages =
    pageBodies.size + pageProse.size + (homepageBodyHtml !== null ? 1 : 0) + (syllabusBodyHtml !== null ? 1 : 0);

  return {
    course: filled,
    total,
    aiCount,
    fallbackCount,
    applied: {
      pages: enrichedPages,
      assignments: assignmentDescriptions.size,
      discussions: discussionPrompts.size,
      quizzes: quizQuestionSets.size,
      announcements: announcementBodies.size
    }
  };
};
