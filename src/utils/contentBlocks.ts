import { CONTENT_BLOCKS, type ContentBlockId, type ContentBlockMeta, type ContentBlockSurface } from "../data/contentBlocks";
import type { Assignment, CourseModule, CoursePage, CourseProject, Discussion, Quiz, Theme } from "../types";
import { withAlpha } from "./color";
import { fileRef, modulesIndexRef, wikiPageRef, WELL_KNOWN_PAGE_IDS } from "../services/canvasLinks";
import { getThemeStyles, heroBackgroundCss } from "../services/themeDesign";

export type { ContentBlockId, ContentBlockMeta, ContentBlockSurface };

export interface ContentBlockContext {
  course: CourseProject;
  page?: CoursePage;
  module?: CourseModule;
}

const escapeHtml = (value: string | number | undefined | null): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const escapeAttr = (value: string | number | undefined | null): string => escapeHtml(value).replace(/`/g, "&#96;");

const sentence = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
};

const safeHref = (href: string): string => {
  const trimmed = href.trim();
  if (!trimmed) return "";
  if (/^(javascript|vbscript):/i.test(trimmed)) return "";
  if (/^data:/i.test(trimmed)) return "";
  return trimmed;
};

const paragraph = (value: string): string => `<p style="margin: 0 0 12px; color: #374151;">${escapeHtml(value)}</p>`;

const list = (items: string[], ordered = false): string => {
  const tag = ordered ? "ol" : "ul";
  return `<${tag} style="margin: 10px 0 0; padding-left: 22px;">${items
    .filter((item) => item.trim().length > 0)
    .map((item) => `<li style="margin: 7px 0; color: #374151;">${escapeHtml(item)}</li>`)
    .join("")}</${tag}>`;
};

const checklist = (items: string[]): string =>
  `<ul style="list-style: none; margin: 10px 0 0; padding: 0;">${items
    .map(
      (item) =>
        `<li style="position: relative; margin: 8px 0; padding-left: 30px; color: #374151;"><span aria-hidden="true" style="position: absolute; left: 0; top: 0; color: #0f766e; font-weight: 900;">&#10003;</span>${escapeHtml(item)}</li>`
    )
    .join("")}</ul>`;

const blockShell = (theme: Theme, title: string, body: string, options: { soft?: boolean; compact?: boolean } = {}): string => {
  const styles = getThemeStyles(theme);
  const background = options.soft ? styles.soft : "#ffffff";
  const padding = options.compact ? "18px 20px" : "22px 24px";
  return `<section style="margin: 22px 0; padding: ${padding}; background: ${background}; border: 1px solid ${withAlpha(styles.accent, 0.26)}; border-top: 6px solid ${styles.accent}; border-radius: 14px; color: ${styles.canvasText}; font-family: ${styles.font}; line-height: 1.58; box-shadow: 0 1px 2px rgba(15,23,42,0.04), 0 8px 20px rgba(15,23,42,0.06);">
  <h2 style="margin: 0 0 12px; color: ${styles.accentDark}; font-size: 24px; line-height: 1.2; font-weight: 900;">${escapeHtml(title)}</h2>
  ${body}
</section>`;
};

const miniCard = (theme: Theme, title: string, body: string, accentText?: string): string => {
  const styles = getThemeStyles(theme);
  return `<div style="display: inline-block; width: 100%; max-width: 285px; min-width: 210px; vertical-align: top; box-sizing: border-box; margin: 0 12px 12px 0; padding: 15px 16px; background: #ffffff; border: 1px solid ${styles.border}; border-left: 5px solid ${styles.accent}; border-radius: 11px; font-size: 14px;">
    ${accentText ? `<p style="margin: 0 0 6px; color: ${styles.accentDark}; font-size: 12px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase;">${escapeHtml(accentText)}</p>` : ""}
    <h3 style="margin: 0 0 7px; color: #111827; font-size: 17px; line-height: 1.25; font-weight: 800;">${escapeHtml(title)}</h3>
    <p style="margin: 0; color: #374151;">${escapeHtml(body)}</p>
  </div>`;
};

const cardGrid = (theme: Theme, cards: Array<{ title: string; body: string; accent?: string }>): string =>
  `<div style="margin: 12px 0 0; font-size: 0;">${cards.map((card) => miniCard(theme, card.title, card.body, card.accent)).join("")}</div>`;

const chip = (theme: Theme, label: string): string => {
  const styles = getThemeStyles(theme);
  return `<span style="display: inline-block; margin: 4px 7px 4px 0; padding: 7px 11px; border-radius: 999px; background: ${styles.soft}; border: 1px solid ${withAlpha(styles.accent, 0.5)}; color: ${styles.accentDark}; font-size: 13px; font-weight: 800;">${escapeHtml(label)}</span>`;
};

const chips = (theme: Theme, labels: string[]): string => `<p style="margin: 8px 0 0;">${labels.map((label) => chip(theme, label)).join("")}</p>`;

const actionLink = (theme: Theme, label: string, href: string, variant: "primary" | "secondary" = "primary"): string => {
  const styles = getThemeStyles(theme);
  const safe = safeHref(href);
  const base =
    variant === "primary"
      ? `background: ${styles.accentDark}; color: ${styles.onAccentDark}; border: 2px solid ${styles.accentDark};`
      : `background: #ffffff; color: ${styles.accentDark}; border: 2px solid ${styles.accent};`;
  const style = `display: inline-block; margin: 8px 10px 6px 0; padding: 11px 15px; border-radius: 9px; ${base} text-decoration: none; font-weight: 900; line-height: 1.2;`;
  return safe
    ? `<a href="${escapeAttr(safe)}" style="${style}">${escapeHtml(label)}</a>`
    : `<span style="${style}">${escapeHtml(label)}</span>`;
};

const mediaPlaceholder = (theme: Theme, title: string, altText: string): string => {
  const styles = getThemeStyles(theme);
  return `<div role="img" aria-label="${escapeAttr(altText)}" style="margin: 14px 0; padding: 22px; min-height: 130px; background: ${styles.soft}; border: 2px dashed ${withAlpha(styles.accentDark, 0.46)}; border-radius: 12px; color: ${styles.accentDark}; text-align: center;">
    <p style="margin: 0 0 8px; font-size: 18px; font-weight: 900;">${escapeHtml(title)}</p>
    <p style="margin: 0; color: #374151;">Alt text placeholder: ${escapeHtml(altText)}</p>
  </div>`;
};

const table = (theme: Theme, caption: string, headers: string[], rows: string[][]): string => {
  const styles = getThemeStyles(theme);
  const head = headers
    .map(
      (header) =>
        `<th scope="col" style="text-align: left; padding: 11px 12px; background: ${styles.accentDark}; color: ${styles.onAccentDark}; border: 1px solid ${styles.accentDark}; font-weight: 900;">${escapeHtml(header)}</th>`
    )
    .join("");
  const body = rows
    .map(
      (row, rowIndex) =>
        `<tr style="background: ${rowIndex % 2 ? styles.soft : "#ffffff"};">${row
          .map((cell, cellIndex) =>
            cellIndex === 0
              ? `<th scope="row" style="text-align: left; vertical-align: top; padding: 10px 12px; border: 1px solid ${styles.border}; color: ${styles.accentDark}; font-weight: 800;">${escapeHtml(cell)}</th>`
              : `<td style="vertical-align: top; padding: 10px 12px; border: 1px solid ${styles.border}; color: #374151;">${escapeHtml(cell)}</td>`
          )
          .join("")}</tr>`
    )
    .join("");
  return `<div style="max-width: 100%; overflow-x: auto; margin: 12px 0 0;">
    <table style="width: 100%; border-collapse: collapse; margin: 0; font-size: 14px;">
      <caption style="caption-side: top; text-align: left; margin: 0 0 8px; color: ${styles.accentDark}; font-weight: 900;">${escapeHtml(caption)}</caption>
      <thead><tr>${head}</tr></thead>
      <tbody>${body}</tbody>
    </table>
  </div>`;
};

const steps = (theme: Theme, items: Array<{ title: string; body: string }>): string => {
  const styles = getThemeStyles(theme);
  return `<ol style="list-style: none; margin: 12px 0 0; padding: 0;">${items
    .map(
      (item, index) =>
        `<li style="position: relative; margin: 0 0 12px; padding: 12px 14px 12px 54px; background: #ffffff; border: 1px solid ${styles.border}; border-radius: 11px;">
          <span aria-hidden="true" style="position: absolute; left: 14px; top: 12px; width: 26px; height: 26px; border-radius: 50%; background: ${styles.accent}; color: ${styles.onAccent}; text-align: center; line-height: 26px; font-weight: 900;">${index + 1}</span>
          <h3 style="margin: 0 0 5px; color: #111827; font-size: 16px; font-weight: 900;">${escapeHtml(item.title)}</h3>
          <p style="margin: 0; color: #374151;">${escapeHtml(item.body)}</p>
        </li>`
    )
    .join("")}</ol>`;
};

const quote = (theme: Theme, text: string, source: string): string => {
  const styles = getThemeStyles(theme);
  return `<blockquote style="margin: 12px 0 0; padding: 18px 20px; background: ${styles.soft}; border-left: 6px solid ${styles.accent}; border-radius: 12px;">
    <p style="margin: 0 0 10px; color: #111827; font-size: 18px; line-height: 1.5; font-weight: 700;">${escapeHtml(text)}</p>
    <footer style="margin: 0; color: #374151; font-size: 14px;">Source placeholder: ${escapeHtml(source)}</footer>
  </blockquote>`;
};

const themeStat = (theme: Theme, value: string, label: string, sub: string): string => {
  const styles = getThemeStyles(theme);
  return `<div style="display: inline-block; width: 100%; max-width: 190px; min-width: 145px; vertical-align: top; box-sizing: border-box; margin: 0 10px 10px 0; padding: 14px 15px; background: #ffffff; border: 1px solid ${styles.border}; border-radius: 11px;">
    <strong style="display: block; margin: 0 0 3px; color: ${styles.accentDark}; font-size: 26px; line-height: 1;">${escapeHtml(value)}</strong>
    <span style="display: block; color: #111827; font-weight: 900;">${escapeHtml(label)}</span>
    <span style="display: block; color: #4b5563; font-size: 13px;">${escapeHtml(sub)}</span>
  </div>`;
};

const statBand = (theme: Theme, stats: Array<{ value: string; label: string; sub: string }>): string =>
  `<div style="margin: 12px 0 0; font-size: 0;">${stats.map((stat) => themeStat(theme, stat.value, stat.label, stat.sub)).join("")}</div>`;

const moduleForContext = (context: ContentBlockContext): CourseModule | undefined => {
  if (context.module) return context.module;
  if (context.page?.moduleId) return context.course.modules.find((module) => module.id === context.page?.moduleId);
  return context.course.modules.find((module) => module.kind === "content") ?? context.course.modules[0];
};

const courseTitle = (course: CourseProject): string => course.title || course.settings.title || "Course";

const moduleLabel = (module?: CourseModule): string => module?.title || "Current module";

const moduleTopic = (module?: CourseModule): string =>
  (module?.title || "this module").replace(/^\s*(Week|Module|Unit|Topic|Chapter)\s+\d+\s*:\s*/i, "");

const moduleObjectives = (course: CourseProject, module?: CourseModule): string[] => {
  if (module?.objectives.length) return module.objectives.slice(0, 5);
  if (course.outcomes.length) return course.outcomes.slice(0, 5).map((outcome) => `${outcome.code}: ${outcome.text}`);
  return ["Explain the central idea.", "Apply the idea to an example.", "Prepare for the next graded activity."];
};

const firstAssignment = (course: CourseProject, module?: CourseModule): Assignment | undefined =>
  course.assignments.find((assignment) => assignment.moduleId === module?.id) ?? course.assignments[0];

const firstDiscussion = (course: CourseProject, module?: CourseModule): Discussion | undefined =>
  course.discussions.find((discussion) => discussion.moduleId === module?.id) ?? course.discussions[0];

const firstQuiz = (course: CourseProject, module?: CourseModule): Quiz | undefined =>
  course.quizzes.find((quiz) => quiz.moduleId === module?.id) ?? course.quizzes[0];

const workloadHours = (course: CourseProject, module?: CourseModule): number =>
  module?.workloadHours || Math.max(1, Math.round(course.contactHours.totalHours / Math.max(1, course.modules.filter((item) => item.kind === "content").length || 1)));

const scheduleRows = (course: CourseProject, limit = 4): string[][] => {
  const rows = course.schedule.slice(0, limit).map((entry, index) => [
    `Week ${index + 1}`,
    entry.title,
    entry.workloadHours ? `${entry.workloadHours} hours` : "Instructor sets workload",
    entry.dueAt ? "Due date included" : "Check Canvas for date"
  ]);
  return rows.length
    ? rows
    : [
        ["Week 1", "Orientation and setup", "2-4 hours", "Check Canvas for date"],
        ["Week 2", "Core learning activities", "4-6 hours", "Check Canvas for date"],
        ["Week 3", "Practice and feedback", "4-6 hours", "Check Canvas for date"]
      ];
};

const gradingRows = (course: CourseProject): string[][] => {
  const rows = course.assignmentGroups.map((group) => [group.name, `${group.weight}%`, group.dropLowest ? `Drops lowest ${group.dropLowest}` : "All posted work counts"]);
  return rows.length
    ? rows
    : [
        ["Assignments", "40%", "Projects, papers, or applied tasks"],
        ["Discussions", "25%", "Posts and peer replies"],
        ["Quizzes", "20%", "Knowledge checks and review"],
        ["Participation", "15%", "Preparation and engagement"]
      ];
};

const resourceCardData = (course: CourseProject, module?: CourseModule): Array<{ title: string; body: string; accent?: string }> => {
  const resources = course.resources.filter((resource) => !module || resource.moduleId === module.id).slice(0, 3);
  if (resources.length) {
    return resources.map((resource) => ({
      title: resource.title,
      body: `${resource.estimatedMinutes || 20} minutes. ${resource.studentInstructions || resource.whyItMatters}`,
      accent: resource.optional ? "Optional" : "Required"
    }));
  }
  return [
    { title: "Core reading", body: "Replace this with the verified reading students should use first.", accent: "Required" },
    { title: "Media example", body: "Add a captioned video, transcript, or accessible alternative.", accent: "Media" },
    { title: "Practice resource", body: "Add a worksheet, dataset, case, or reference students can use.", accent: "Practice" }
  ];
};

const modulesPath = (course: CourseProject): Array<{ title: string; body: string }> => {
  const modules = course.modules.filter((module) => module.kind === "content").slice(0, 5);
  if (modules.length) return modules.map((module) => ({ title: module.title, body: sentence(module.description || "Students build toward the course outcomes through this module.") }));
  return [
    { title: "Start", body: "Get oriented to the course and expectations." },
    { title: "Build", body: "Work through core concepts and examples." },
    { title: "Practice", body: "Apply ideas in low-stakes and graded tasks." },
    { title: "Synthesize", body: "Use feedback to prepare final work." }
  ];
};

export const buildContentBlockHtml = (id: ContentBlockId, context: ContentBlockContext): string => {
  const { course } = context;
  const theme = course.theme;
  const styles = getThemeStyles(theme);
  const module = moduleForContext(context);
  const topic = moduleTopic(module);
  const objectives = moduleObjectives(course, module);
  const assignment = firstAssignment(course, module);
  const discussion = firstDiscussion(course, module);
  const quiz = firstQuiz(course, module);
  const title = courseTitle(course);

  switch (id) {
    case "hero-banner":
      return `<section style="margin: 22px 0; padding: 30px 28px; ${heroBackgroundCss(styles)} border-radius: 16px; color: ${styles.onGradient}; font-family: ${styles.font}; line-height: 1.55;">
  <h2 style="margin: 0 0 10px; color: ${styles.onGradient}; font-size: 32px; line-height: 1.12; font-weight: 900;">${escapeHtml(title)}</h2>
  <p style="margin: 0 0 16px; max-width: 68ch; color: ${styles.onGradient}; font-size: 17px;">${escapeHtml(sentence(course.description || course.settings.description || "Students start here to understand the course path, expectations, and first steps."))}</p>
  <p style="margin: 16px 0 8px;"><img src="${fileRef("course-banner.svg")}" role="img" alt="${escapeAttr(`${title} course banner image. Replace this alt text if you replace the generated banner.`)}" style="display: block; width: 100%; height: auto; border-radius: 12px; border: 2px solid ${withAlpha(styles.onGradient, 0.28)};" /></p>
  <p style="margin: 0; color: ${styles.onGradient}; font-size: 13px;">Alt text placeholder: ${escapeHtml(`${title} course banner image. Replace with a meaningful visual and concise alt text if you replace the generated banner.`)}</p>
</section>`;
    case "start-here-button-panel":
      return blockShell(
        theme,
        "Start Here",
        `${paragraph("Use these links to take the first useful actions in Canvas.")}<p style="margin: 0;">${actionLink(theme, "Open Modules", modulesIndexRef())}${actionLink(theme, "Read the Syllabus", wikiPageRef(WELL_KNOWN_PAGE_IDS.syllabus), "secondary")}${actionLink(theme, "Course Success Guide", wikiPageRef(WELL_KNOWN_PAGE_IDS.successGuide), "secondary")}</p>`,
        { soft: true }
      );
    case "course-journey-map":
      return blockShell(theme, "Course Journey Map", steps(theme, modulesPath(course).slice(0, 5)));
    case "this-week-at-a-glance":
      return blockShell(
        theme,
        "This Week at a Glance",
        `${paragraph(`Focus on ${topic}. Plan time for preparation, practice, and any graded work.`)}${statBand(theme, [
          { value: `${workloadHours(course, module)}h`, label: "Estimated workload", sub: "Adjust for your pace" },
          { value: String(objectives.length), label: "Objectives", sub: "What to practice" },
          { value: assignment ? "1" : "0", label: "Assignment", sub: assignment?.title ?? "Add if needed" },
          { value: quiz ? "1" : "0", label: "Quiz or check", sub: quiz?.title ?? "Optional review" }
        ])}`
      );
    case "course-promise-statement":
      return blockShell(
        theme,
        "Course Promise",
        `${paragraph(`By the end of ${title}, students should be able to use course concepts, evidence, and feedback to make stronger decisions in realistic contexts.`)}${chips(theme, ["Practice with evidence", "Clear weekly path", "Feedback before final work", "Accessible support routes"])}`,
        { soft: true }
      );
    case "instructor-welcome-card":
      return blockShell(
        theme,
        "Welcome From Your Instructor",
        `${paragraph("Welcome to the course. This space is designed to help you know what to do, why it matters, and where to go for help.")}${cardGrid(theme, [
          { title: "How I Can Help", body: "Send a specific question that names the page, task, or concept where you got stuck.", accent: "Support" },
          { title: "Response Window", body: "Replace with the instructor's local response-time policy.", accent: "Communication" },
          { title: "Office Hours", body: "Replace with live meeting, appointment, or campus support details.", accent: "Access" }
        ])}`
      );
    case "navigation-tile-grid":
      return blockShell(
        theme,
        "Course Navigation",
        cardGrid(theme, [
          { title: "Modules", body: "Use Modules as the main path through course work.", accent: "Start" },
          { title: "Syllabus", body: "Review policies, grading, workload, and schedule expectations.", accent: "Policies" },
          { title: "Calendar", body: "Track dates, workload, and upcoming checkpoints.", accent: "Pacing" },
          { title: "Success Guide", body: "Use the support guide when you need help deciding what to do next.", accent: "Support" }
        ])
      );
    case "how-to-succeed-checklist":
      return blockShell(
        theme,
        "How to Succeed",
        checklist(["Start each week in Modules.", "Read directions before opening graded work.", "Use the rubric before submitting.", "Ask a specific question when blocked.", "Return to feedback before the next task."])
      );
    case "need-help-support-panel":
      return blockShell(
        theme,
        "Need Help?",
        `${paragraph("Use the fastest route for the kind of support you need.")}${cardGrid(theme, [
          { title: "Course Question", body: "Ask the instructor and include the page, task, and what you already tried.", accent: "Instructor" },
          { title: "Canvas or Tech Issue", body: "Contact campus or Canvas support and include device, browser, page name, and the error.", accent: "Technology" },
          { title: "Access or Accommodation", body: "Contact the appropriate campus office and notify the instructor as local policy allows.", accent: "Accessibility" }
        ])}`,
        { soft: true }
      );
    case "course-trailer-video-placeholder":
      return blockShell(
        theme,
        "Course Trailer",
        `${mediaPlaceholder(theme, "Video placeholder", `Short course trailer for ${title}. Add captions, transcript, and a concise description of what appears in the video.`)}${checklist(["Add captions before publishing.", "Add a transcript or text alternative.", "Make the link or embedded media available to enrolled students.", "Replace this placeholder with approved media."])}`,
        { compact: true }
      );
    case "module-mission-briefing":
      return blockShell(
        theme,
        "Module Mission Briefing",
        `${paragraph(`In ${moduleLabel(module)}, your mission is to connect the main concept to a concrete example and use evidence to explain your reasoning.`)}${chips(theme, ["Read the situation", "Name the evidence", "Choose a response", "Check the outcome"])}`
      );
    case "module-objectives-chips":
      return blockShell(theme, "Module Objectives", `${paragraph("By the end of this module, focus on these outcomes.")}${chips(theme, objectives)}`);
    case "before-you-begin-checklist":
      return blockShell(
        theme,
        "Before You Begin",
        checklist(["Open the module overview and scan the sequence.", "Check estimated workload and any due dates.", "Gather required readings, media, files, or notes.", "Write one question you want answered by the end of the module."])
      );
    case "module-map":
      return blockShell(
        theme,
        "Module Map",
        steps(theme, [
          { title: "Orient", body: "Review the module question, objectives, workload, and deliverables." },
          { title: "Learn", body: "Read, watch, annotate, and capture examples tied to the objective." },
          { title: "Practice", body: "Try the activity, discussion, or draft task before graded submission." },
          { title: "Show", body: "Submit work, complete the check, and use feedback for the next step." }
        ])
      );
    case "key-terms-cards":
      return blockShell(
        theme,
        "Key Terms",
        cardGrid(theme, [
          { title: "Core Concept", body: `The main idea students should be able to explain in ${topic}.`, accent: "Term" },
          { title: "Evidence", body: "A source, example, observation, or data point that supports a claim.", accent: "Term" },
          { title: "Application", body: "A concrete use of the concept in a case, problem, project, or professional setting.", accent: "Term" }
        ])
      );
    case "big-question-banner":
      return blockShell(theme, "Big Question", `${quote(theme, `How should we use evidence from ${topic} to make a careful decision?`, "Replace with the module's driving question.")}`, { soft: true });
    case "prior-module-connection-card":
      return blockShell(theme, "Connection to Prior Learning", `${paragraph("Before moving forward, connect this module to what you already practiced.")}${checklist(["Name one idea that carries over.", "Identify one feedback point you can apply again.", "Use one prior example to explain a new concept."])}`);
    case "next-module-preview-card":
      return blockShell(theme, "Next Module Preview", `${paragraph("The next module will build on this work. Save one question, one example, and one feedback note to carry forward.")}${chips(theme, ["Preview next outcome", "Keep useful notes", "Plan the first task"])}`);
    case "common-mistake-callout":
      return blockShell(theme, "Common Mistake to Avoid", `${paragraph("Avoid summarizing the topic without making a specific claim or showing how evidence supports it.")}${cardGrid(theme, [{ title: "Repair Move", body: "Add a because statement, then point to the source, case detail, or example that supports your reasoning.", accent: "Try this" }])}`, { soft: true });
    case "instructor-margin-note":
      return blockShell(theme, "Instructor Margin Note", `${paragraph("Instructor note placeholder: add a teaching move, timing reminder, example to emphasize, or student misconception to watch for.")}${chips(theme, ["Private if unpublished", "Review before export", "Remove if student-facing"])}`);
    case "read-watch-do-layout":
      return blockShell(
        theme,
        "Read, Watch, Do",
        cardGrid(theme, [
          { title: "Read", body: "Skim headings, mark one claim, and note one term that needs clarification.", accent: "Prepare" },
          { title: "Watch", body: "Use captions or transcript. Capture one example that illustrates the concept.", accent: "Media" },
          { title: "Do", body: "Apply the concept to a short practice task before moving to graded work.", accent: "Practice" }
        ])
      );
    case "concept-and-example-block":
      return blockShell(
        theme,
        "Concept and Example",
        cardGrid(theme, [
          { title: "Concept", body: `Explain the main idea from ${topic} in student-friendly language.`, accent: "Define" },
          { title: "Example", body: "Show how the idea works in a realistic situation, case, dataset, text, or problem.", accent: "Apply" },
          { title: "Why It Matters", body: "Name the decision, interpretation, skill, or transfer task this concept supports.", accent: "Connect" }
        ])
      );
    case "myth-vs-reality-cards":
      return blockShell(
        theme,
        "Myth vs Reality",
        cardGrid(theme, [
          { title: "Myth", body: "A common misunderstanding makes the concept seem simpler than it is.", accent: "Watch for" },
          { title: "Reality", body: "Strong work explains conditions, evidence, limitations, and context.", accent: "Use instead" }
        ])
      );
    case "pause-and-think-reflection-box":
      return blockShell(theme, "Pause and Think", `${paragraph("Take two minutes to answer this privately before continuing.")}${list(["What part of the idea is clear right now?", "What example makes the idea easier to understand?", "What question would help you move forward?"])}`, { soft: true });
    case "try-this-now-activity-block":
      return blockShell(theme, "Try This Now", `${paragraph("Use this quick practice before graded work.")}${steps(theme, [{ title: "Choose", body: "Pick one example, case detail, source, or problem." }, { title: "Apply", body: "Use one module concept to explain what is happening." }, { title: "Check", body: "Name one piece of evidence that supports your explanation." }])}`);
    case "case-file-layout":
      return blockShell(
        theme,
        "Case File",
        cardGrid(theme, [
          { title: "Situation", body: "Describe the case in two or three concrete sentences.", accent: "File 1" },
          { title: "Evidence", body: "List the facts, sources, or observations that should guide analysis.", accent: "File 2" },
          { title: "Stakeholders", body: "Name who is affected and what each group needs or values.", accent: "File 3" },
          { title: "Decision", body: "Choose a next step and explain the tradeoff.", accent: "File 4" }
        ])
      );
    case "field-note-box":
      return blockShell(theme, "Field Note", `${paragraph("Observation placeholder: describe what happened, where the evidence came from, and why it matters for the module concept.")}${chips(theme, ["Observation", "Source", "Interpretation", "Question"])}`, { soft: true });
    case "student-decision-point":
      return blockShell(
        theme,
        "Student Decision Point",
        `${paragraph("Choose the most defensible option and explain your evidence.")}${table(theme, "Decision options", ["Option", "Use when", "Risk to consider"], [
          ["Option A", "Evidence is strong and the next step is clear.", "May overlook a stakeholder or limitation."],
          ["Option B", "More context is needed before acting.", "May delay a needed response."],
          ["Option C", "The class needs to compare multiple viewpoints.", "May require a tighter decision rule."]
        ])}`
      );
    case "timeline":
      return blockShell(
        theme,
        "Timeline",
        steps(theme, [
          { title: "Context", body: "What happened before the main issue or task?" },
          { title: "Turning Point", body: "What changed, intensified, or became visible?" },
          { title: "Current Decision", body: "What needs to happen now?" },
          { title: "Reflection", body: "What should be remembered for future work?" }
        ])
      );
    case "process-diagram":
      return blockShell(theme, "Process Diagram", steps(theme, [{ title: "Input", body: "Gather the source, case, prompt, data, or question." }, { title: "Analyze", body: "Use the module concept to interpret the evidence." }, { title: "Decide", body: "Choose a response and explain why it fits." }, { title: "Revise", body: "Use feedback, rubric language, or peer response to improve." }]));
    case "card-grid":
      return blockShell(theme, "Card Grid", cardGrid(theme, [{ title: "Card One", body: "Add a concept, resource, tool, or example.", accent: "1" }, { title: "Card Two", body: "Add the second idea students should compare.", accent: "2" }, { title: "Card Three", body: "Add the action students should take next.", accent: "3" }]));
    case "quote-block":
      return blockShell(theme, "Quote for Discussion", quote(theme, "Replace this quotation with a short course source excerpt or instructor-authored statement.", "Add source, page, speaker, or context before publishing."));
    case "resource-list":
      return blockShell(theme, "Resource List", cardGrid(theme, resourceCardData(course, module)));
    case "comparison-table":
      return blockShell(theme, "Comparison Table", table(theme, "Compare the options", ["Feature", "Option A", "Option B"], [["Purpose", "What this option helps students do.", "What the alternative helps students do."], ["Evidence", "What supports this approach.", "What supports the alternative."], ["Best next step", "How to act on this option.", "What to review before choosing."]]));
    case "assignment-brief":
      return blockShell(theme, "Assignment Brief", `${paragraph(assignment ? `Assignment: ${assignment.title}.` : "Assignment placeholder: replace with the assignment title and purpose.")}${cardGrid(theme, [{ title: "Purpose", body: "Explain what students will practice and why it matters.", accent: "Why" }, { title: "Task", body: "Name the exact work students need to complete.", accent: "What" }, { title: "Submit", body: "Describe file, text entry, URL, media, or other submission expectations.", accent: "How" }])}`);
    case "deliverable-checklist":
      return blockShell(theme, "Deliverable Checklist", checklist(["The submission answers the prompt.", "The work uses required evidence or course concepts.", "File names, links, and permissions are readable.", "The rubric has been checked before submission.", "Any AI use, collaboration, or source help is disclosed as required."]));
    case "rubric-preview":
      return blockShell(theme, "Rubric Preview", table(theme, "Criteria preview", ["Criterion", "Strong evidence", "Before submitting"], [["Focus", "The work directly answers the prompt.", "Underline the claim or central decision."], ["Evidence", "Sources, data, examples, or course terms support the claim.", "Check that evidence is named and explained."], ["Clarity", "The organization helps a reader follow the reasoning.", "Add headings, labels, or transitions as needed."]]));
    case "starter-prompts":
      return blockShell(theme, "Starter Prompts", `${paragraph("Use these starts to move from blank page to draft.")}${list(["The central issue is...", "The best evidence for this claim is...", "A possible limitation is...", "This matters because...", "The next decision should be..."])}`);
    case "ai-use-guidance":
      return blockShell(theme, "AI Use Guidance", `${paragraph("Edit this block to match institutional and course policy before publishing.")}${table(theme, "AI use expectations", ["Use type", "Guidance", "Student responsibility"], [["Allowed", "Brainstorming, outlining, or study questions when permitted by the instructor.", "Verify accuracy and cite or disclose as required."], ["Limited", "Drafting, rewriting, coding, or analysis support only if the assignment permits it.", "Keep records and explain what changed."], ["Not allowed", "Submitting AI-generated work as your own when the task requires original work.", "Ask before using tools in unclear cases."]])}`);
    case "submission-survival-kit":
      return blockShell(theme, "Submission Survival Kit", checklist(["Open the rubric one last time.", "Confirm the file opens or the text entry saved.", "Check links and permissions in an incognito or logged-out window when possible.", "Add required citations, acknowledgments, or AI-use notes.", "Take a screenshot or save a copy if Canvas reports a submission issue."]));
    case "stretch-goal":
      return blockShell(theme, "Stretch Goal", `${paragraph("Optional challenge for students who are ready to go further.")}${cardGrid(theme, [{ title: "Extend", body: "Apply the concept to a new case, audience, dataset, or context.", accent: "Challenge" }, { title: "Teach", body: "Create a short explanation that would help a classmate avoid a common mistake.", accent: "Share" }])}`, { soft: true });
    case "discussion-role-card":
      return blockShell(theme, "Discussion Roles", cardGrid(theme, [{ title: "Connector", body: "Connect a classmate's idea to a course source, example, or outcome.", accent: "Role" }, { title: "Questioner", body: "Ask a question that clarifies assumptions, evidence, or implications.", accent: "Role" }, { title: "Synthesizer", body: "Identify a pattern across posts and name what the group is learning.", accent: "Role" }]));
    case "first-post-and-reply-guidance":
      return blockShell(theme, "First Post and Reply Guidance", `${paragraph(discussion ? `Use this guidance for ${discussion.title}.` : "Use this guidance for the current discussion.")}${table(theme, "Discussion expectations", ["Move", "Do this", "Avoid this"], [["First post", "Make a claim, use evidence, and end with a useful question.", "Do not summarize the whole module without a specific point."], ["Reply", "Extend, question, compare, or add evidence to one specific idea.", "Do not post agreement-only replies."], ["Return", "Read feedback and note one idea for the next task.", "Do not disappear after posting."]])}`);
    case "conversation-moves-cards":
      return blockShell(theme, "Conversation Moves", cardGrid(theme, [{ title: "Build", body: "Add evidence or an example that extends the original idea.", accent: "Move" }, { title: "Compare", body: "Name a similarity or difference between two posts.", accent: "Move" }, { title: "Question", body: "Ask what evidence, assumption, or context would change the claim.", accent: "Move" }, { title: "Synthesize", body: "Pull a pattern from several classmates into one clear takeaway.", accent: "Move" }]));
    case "sample-strong-reply":
      return blockShell(theme, "Sample Strong Reply", quote(theme, "I see your point about the main concept. I would add that the case evidence also shows a tradeoff: the short-term gain creates a longer-term access problem. What evidence would help us decide whether that tradeoff is acceptable?", "Model reply. Replace with a discipline-specific example."));
    case "peer-response-starters":
      return blockShell(theme, "Peer Response Starters", list(["Your evidence made me think about...", "One place I would ask for more detail is...", "This connects to the module concept because...", "A possible counterexample is...", "The next question I would test is..."]));
    case "quiz-study-cards":
      return blockShell(theme, "Quiz Study Cards", `${paragraph(quiz ? `Use these cards before ${quiz.title}.` : "Use these cards before the quiz or knowledge check.")}${cardGrid(theme, [{ title: "Concept", body: "Can you define the term in your own words?", accent: "Recall" }, { title: "Example", body: "Can you recognize the concept in a case, problem, or scenario?", accent: "Apply" }, { title: "Explain", body: "Can you explain why the correct answer fits better than a tempting alternative?", accent: "Reason" }])}`);
    case "confidence-check":
      return blockShell(theme, "Confidence Check", table(theme, "Before the quiz", ["Statement", "Ready", "Review"], [["I can explain the main terms without notes.", "Move on.", "Return to key terms."], ["I can apply the concept to a new example.", "Try the quiz.", "Review worked examples."], ["I know where to find feedback after submitting.", "Check results.", "Ask a support question."]]));
    case "quiz-review-and-remediation-block":
      return blockShell(theme, "Quiz Review and Remediation", steps(theme, [{ title: "Review", body: "Read feedback and identify the concept behind each missed item." }, { title: "Relearn", body: "Return to the specific page, reading, example, or note tied to the missed concept." }, { title: "Practice", body: "Write a new example or explanation before the next quiz or assignment." }]));
    case "syllabus-policy-cards":
      return blockShell(theme, "Syllabus Policy Cards", cardGrid(theme, [{ title: "Academic Integrity", body: "Use official local policy language and clarify collaboration expectations.", accent: "Policy" }, { title: "Accessibility", body: "Tell students how to request accommodations and access support.", accent: "Support" }, { title: "Grading", body: "Explain weights, rubrics, feedback timing, and grade questions.", accent: "Grades" }]));
    case "grading-breakdown-visual":
      return blockShell(theme, "Grading Breakdown", `${statBand(theme, gradingRows(course).slice(0, 4).map((row) => ({ value: row[1], label: row[0], sub: row[2] })))}${table(theme, "Grade groups", ["Group", "Weight", "Notes"], gradingRows(course))}`);
    case "weekly-schedule-visual-table":
      return blockShell(theme, "Weekly Schedule", table(theme, "Schedule preview", ["Week", "Focus", "Workload", "Due work"], scheduleRows(course, 8)));
    case "communication-expectations-block":
      return blockShell(theme, "Communication Expectations", cardGrid(theme, [{ title: "Instructor Response", body: "Replace with local response-time expectations for messages and feedback.", accent: "Timing" }, { title: "Student Messages", body: "Use descriptive subjects and include the task, page, or question.", accent: "Clarity" }, { title: "Public Questions", body: "Use the class questions space when the answer may help others.", accent: "Community" }]));
    case "technology-needed-block":
      return blockShell(theme, "Technology Needed", `${paragraph("Confirm these requirements before the course opens.")}${checklist(["Reliable internet access or a campus access plan.", "A device that can open Canvas, files, media, and submission tools.", "Software or accounts required by the instructor.", "A plan for captions, transcripts, readable PDFs, and accessible file formats."])}`);
    case "late-work-policy-at-a-glance":
      return blockShell(theme, "Late Work at a Glance", `${paragraph("Replace this summary with official course and institutional policy before publishing.")}${table(theme, "Late work summary", ["Situation", "What to do", "What happens next"], [["Before the deadline", "Contact the instructor early with the task and barrier.", "Instructor responds under the course communication policy."], ["After the deadline", "Submit as soon as possible and explain what happened if policy allows.", "Local late-work rules apply."], ["Access issue", "Contact technical support and document the issue.", "Share support details with the instructor if appropriate."]])}`);
    case "accessibility-and-inclusion-panel":
      return blockShell(theme, "Accessibility and Inclusion", `${paragraph("This course should be usable by students with different access needs, schedules, devices, and learning contexts.")}${checklist(["Use captions, transcripts, descriptive links, and readable files.", "Contact the appropriate campus office for formal accommodations.", "Tell the instructor early when access barriers appear.", "Use respectful language and avoid sharing private information without consent."])}`, { soft: true });
    case "student-success-path":
      return blockShell(theme, "Student Success Path", steps(theme, [{ title: "Start", body: "Open Modules and read the overview before doing individual tasks." }, { title: "Plan", body: "Block time for reading, practice, discussion, and submission." }, { title: "Ask", body: "Use a specific support question when blocked." }, { title: "Improve", body: "Use feedback before the next related assignment or quiz." }]));
    case "instructor-facilitation-notes":
      return blockShell(theme, "Instructor Facilitation Notes", `${paragraph("Instructor-only planning placeholder. Keep unpublished if it contains private teaching notes.")}${checklist(["Add the example students need most.", "Note where students may misunderstand the task.", "Plan one announcement or reminder.", "Identify where feedback should connect to outcomes."])}`);
    case "announcement-bank":
      return blockShell(theme, "Announcement Bank", cardGrid(theme, [{ title: "Launch Announcement", body: "Welcome students, point them to Start Here, and name the first action.", accent: "Draft" }, { title: "Midweek Reminder", body: "Name the current task, common question, and next deadline.", accent: "Draft" }, { title: "Wrap-Up Note", body: "Summarize the pattern you saw and preview the next module.", accent: "Draft" }]));
    case "course-launch-checklist":
      return blockShell(theme, "Course Launch Checklist", checklist(["Homepage, syllabus, and modules are published intentionally.", "Dates, grade weights, rubrics, and navigation are checked.", "All links, files, captions, and transcripts are verified.", "Instructor-only pages remain unpublished.", "Student support and technology expectations are visible."]));
    case "mid-course-pulse-check-survey-template":
      return blockShell(theme, "Mid-Course Pulse Check", `${paragraph("Use these questions in a Canvas survey, discussion, or anonymous feedback form if your local tools support it.")}${list(["What is helping you learn in this course?", "Where are instructions, workload, or pacing unclear?", "What should continue for the rest of the course?", "What is one small change that would improve access, clarity, or feedback?", "What support do you need before the next major deadline?"], true)}`);
    default: {
      const exhaustive: never = id;
      return exhaustive;
    }
  }
};

export const buildContentBlocksForSurface = (surface: ContentBlockSurface, context: ContentBlockContext): string =>
  CONTENT_BLOCKS.filter((block) => (block.surfaces as readonly ContentBlockSurface[]).includes(surface)).map((block) => buildContentBlockHtml(block.id, context)).join("\n");

export const contentBlockById = (id: ContentBlockId): ContentBlockMeta | undefined => CONTENT_BLOCKS.find((block) => block.id === id);
