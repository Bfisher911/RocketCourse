// ============================================================================
// Interaction selection engine
// ----------------------------------------------------------------------------
// Chooses which Canvas interaction patterns belong on which course surfaces,
// builds course-specific content for each selection, and applies the result as
// structured InteractionBlocks. Deterministic by design: the same course always
// produces the same plan (rotation uses module position, never randomness), so
// the behavior is testable and never degenerates into random overuse.
//
// Density guardrails (per the pattern library, treated as caps not quotas):
//   module overview 2 · content page 1-2 · practice 1-2 · recap 1-2 ·
//   milestone 1 · orientation 0-1 · assignment 2 · discussion 1 · syllabus 0 ·
//   homepage 0 (the homepage has its own block system).
//
// Only native-tier patterns with a content builder are auto-selected. Iframe
// patterns are never auto-selected (no external host exists yet), and patterns
// requiring media assets are editor-only until the asset exists.
// ============================================================================

import type {
  Assignment,
  CourseModule,
  CoursePage,
  CourseProject,
  Discussion,
  InteractionBlock,
  InteractionContent,
  Quiz,
  Rubric
} from "../types";
import {
  INTERACTION_PATTERNS,
  interactionPatternById,
  type InteractionDiscipline,
  type InteractionPageType
} from "../data/interactionPatterns";
import { assignmentRef, discussionRef, modulesIndexRef, quizRef, wikiPageRef, WELL_KNOWN_PAGE_IDS } from "./canvasLinks";

// ── Plan model ──────────────────────────────────────────────────────────────

export interface InteractionSelection {
  patternId: string;
  rationale: string;
  content: InteractionContent;
}

export interface SurfacePlan {
  surfaceType: "page" | "assignment" | "discussion";
  surfaceId: string;
  surfaceTitle: string;
  pageType: InteractionPageType;
  selections: InteractionSelection[];
}

export interface CourseInteractionPlan {
  disciplines: InteractionDiscipline[];
  surfaces: SurfacePlan[];
  /** patternId -> times used across the course, for the editor's plan view. */
  usage: Record<string, number>;
}

// ── Discipline inference ────────────────────────────────────────────────────

const DISCIPLINE_RULES: Array<{ test: RegExp; tags: InteractionDiscipline[] }> = [
  { test: /(histor|philosoph|literat|art|music|religio|classics|ethics|humanit|language|linguist|writing|composition|rhetoric|film|theat)/i, tags: ["humanities", "writing"] },
  { test: /(biolog|chemis|physic|engineer|math|calculus|statis|anatomy|geolog|astronom|lab\b|science|computer|programm|software|data)/i, tags: ["stem", "data"] },
  { test: /(geograph|environment|climate|ecolog|earth|gis\b|urban|sustainab)/i, tags: ["geography", "stem"] },
  { test: /(business|management|marketing|finance|account|econom|entrepreneur|leadership|organizational|project management)/i, tags: ["business"] },
  { test: /(health|nurs|medic|clinical|pharmac|emergency|paramedic|public health|epidemiol|patient|ems\b|disaster)/i, tags: ["health"] },
  { test: /(psycholog|sociolog|anthropolog|political|criminal|justice|education|social work|communication)/i, tags: ["social-science"] },
  { test: /(data|analytic|statistics|visualization|machine learning)/i, tags: ["data"] }
];

export const inferCourseDisciplines = (course: CourseProject): InteractionDiscipline[] => {
  const haystack = `${course.title} ${course.description} ${course.settings.description}`;
  const tags = new Set<InteractionDiscipline>(["all"]);
  for (const rule of DISCIPLINE_RULES) if (rule.test.test(haystack)) rule.tags.forEach((tag) => tags.add(tag));
  return [...tags];
};

// ── Page classification ─────────────────────────────────────────────────────

export const classifyPage = (page: CoursePage, module: CourseModule | undefined): InteractionPageType | null => {
  if (page.frontPage) return null; // homepage has its own block system
  if (page.slug === "syllabus" || /^Syllabus$/i.test(page.title)) return null;
  if (module?.kind === "instructor") return null;
  if (/checkpoint|milestone/i.test(page.title)) return "milestone";
  if (/^about /i.test(page.title) || /overview/i.test(page.title)) return "module-overview";
  if (/practice activity/i.test(page.title)) return "practice";
  if (/^end of /i.test(page.title) || /wrap-up/i.test(page.title)) return "recap";
  if (module?.kind === "start") return "orientation";
  if (/readings and resources|lecture and notes/i.test(page.title)) return "content";
  if (module?.kind === "final") return "milestone";
  return "content";
};

const DENSITY_CAPS: Record<InteractionPageType, number> = {
  homepage: 0,
  orientation: 1,
  "module-overview": 2,
  content: 2,
  practice: 2,
  assignment: 2,
  discussion: 1,
  "quiz-prep": 2,
  recap: 2,
  syllabus: 0,
  milestone: 1
};

/** Course-wide usage caps by declared frequency. */
const FREQUENCY_CAPS = { frequent: Number.POSITIVE_INFINITY, selective: 3, rare: 1 } as const;

// ── Content-builder context ─────────────────────────────────────────────────

interface BuilderCtx {
  course: CourseProject;
  module?: CourseModule;
  page?: CoursePage;
  assignment?: Assignment;
  discussion?: Discussion;
  quiz?: Quiz;
  rubric?: Rubric;
  topic: string;
  moduleLabel: string;
  modulePages: CoursePage[];
  moduleNumber: number;
}

const topicOf = (module: CourseModule | undefined, course: CourseProject): string =>
  (module?.title ?? course.title).replace(/^[^:]{1,24}:\s*/, "").trim() || course.title;

const labelOf = (module: CourseModule | undefined): string => (module?.title.split(":")[0] ?? "This module").trim();

const findModulePage = (ctx: BuilderCtx, pattern: RegExp): CoursePage | undefined => ctx.modulePages.find((page) => pattern.test(page.title));

const objectiveItems = (ctx: BuilderCtx, limit = 4) =>
  (ctx.module?.objectives ?? ctx.course.outcomes.slice(0, limit).map((outcome) => outcome.text)).slice(0, limit);

// ── Content builders (course-specific, never placeholder) ───────────────────

type ContentBuilder = (ctx: BuilderCtx) => InteractionContent | null;

const CONTENT_BUILDERS: Record<string, ContentBuilder> = {
  "learning-objectives-card": (ctx) => {
    const objectives = objectiveItems(ctx);
    if (!objectives.length) return null;
    return {
      title: `${ctx.moduleLabel} Objectives`,
      intro: `By the end of ${ctx.topic.toLowerCase().startsWith("the ") ? ctx.topic : `the work on ${ctx.topic}`}, you should be able to:`,
      items: objectives.map((objective, index) => ({ heading: `Objective ${index + 1}`, body: objective }))
    };
  },

  "visual-module-launchpad": (ctx) => {
    const items: InteractionContent["items"] = [];
    const readings = findModulePage(ctx, /Readings and Resources/i);
    const lecture = findModulePage(ctx, /Lecture and Notes/i);
    const practice = findModulePage(ctx, /Practice Activity/i);
    if (readings) items.push({ heading: "Read", body: `Start with the ${ctx.moduleLabel.toLowerCase()} readings and resources.`, href: wikiPageRef(readings.id) });
    if (lecture) items.push({ heading: "Learn", body: `Study ${ctx.topic} in the lecture and notes.`, href: wikiPageRef(lecture.id) });
    if (practice) items.push({ heading: "Practice", body: "Try the low-stakes practice activity before graded work.", href: wikiPageRef(practice.id) });
    if (ctx.discussion) items.push({ heading: "Discuss", body: ctx.discussion.title, href: discussionRef(ctx.discussion.id), meta: `${ctx.discussion.points} points` });
    if (ctx.quiz) items.push({ heading: "Check", body: ctx.quiz.title, href: quizRef(ctx.quiz.id) });
    if (ctx.assignment) items.push({ heading: "Submit", body: ctx.assignment.title, href: assignmentRef(ctx.assignment.id), meta: `${ctx.assignment.points} points` });
    if (items.length < 3) return null;
    return { title: `${ctx.moduleLabel} Launchpad`, intro: "Work through this module in order. Each card opens the Canvas item.", items };
  },

  "action-item-checklist": (ctx) => {
    const steps: InteractionContent["items"] = [
      { heading: "Read the module overview", body: `orient yourself to ${ctx.topic} before opening individual items.` },
      { heading: "Complete the readings and lecture notes", body: "capture one question and one example as you go." }
    ];
    if (ctx.discussion) steps.push({ heading: `Post to “${ctx.discussion.title}”`, body: "make a claim and support it with evidence from this module." });
    if (ctx.quiz) steps.push({ heading: `Take “${ctx.quiz.title}”`, body: "use it to confirm what to review before graded work." });
    if (ctx.assignment) steps.push({ heading: `Submit “${ctx.assignment.title}”`, body: "check the rubric before you submit." });
    return { title: `${ctx.moduleLabel} Checklist`, intro: "Complete these items in order.", items: steps };
  },

  "interactive-reading-guide": (ctx) => ({
    title: `Reading Guide: ${ctx.topic}`,
    intro: "Use these prompts before, during, and after the readings.",
    items: [
      { heading: "Before reading", body: `Preview the headings and write one question you expect the reading to answer about ${ctx.topic}.` },
      { heading: "During reading", body: "Mark the central claim, one piece of supporting evidence, and any term you cannot yet define." },
      { heading: "After reading", body: `Summarize the reading in two sentences and connect it to one objective of ${ctx.moduleLabel.toLowerCase()}.` }
    ]
  }),

  "stop-and-think-prompt": (ctx) => ({
    title: "Stop and Think",
    intro: `Pause before continuing. Write a brief answer to the question below.`,
    items: [{ heading: "Question", body: `What is the most important idea about ${ctx.topic} so far, and what evidence from this page supports it?` }],
    reveal: { label: "Compare with a model response", body: `A strong answer names one specific concept from ${ctx.topic}, states why it matters, and points to a concrete example or piece of evidence rather than restating the definition.` }
  }),

  "socratic-question-chain": (ctx) => ({
    title: `Thinking Through ${ctx.topic}`,
    intro: "Answer each question before moving to the next — each one builds on the previous answer.",
    items: [
      { heading: "1. Notice", body: `What stands out most in this material on ${ctx.topic}?` },
      { heading: "2. Evidence", body: "What evidence from the readings or notes supports that observation?" },
      { heading: "3. Assumption", body: "What are you assuming for that evidence to matter?" },
      { heading: "4. Alternative", body: "What alternative explanation or perspective is possible?" },
      { heading: "5. Conclusion", body: "What conclusion is justified right now, and what would change it?" }
    ]
  }),

  "click-to-reveal-answer": (ctx) => {
    const objective = objectiveItems(ctx, 1)[0];
    if (!objective) return null;
    return {
      title: "Check Yourself",
      items: [{ heading: "Question", body: `Before moving on: in your own words, how would you ${objective.replace(/\.$/, "").replace(/^[A-Z]/, (c) => c.toLowerCase())}?` }],
      reveal: { label: "Reveal what a strong answer includes", body: `A complete answer uses the vocabulary of ${ctx.topic}, gives one concrete example, and explains the reasoning rather than repeating the objective.` }
    };
  },

  "worked-example-reveal": (ctx) => ({
    title: `Worked Example: ${ctx.topic}`,
    intro: "Try the practice task first. Then open each step to compare your reasoning.",
    items: [
      { heading: "Step 1 — Identify", body: `Name the known information and what the task is asking with respect to ${ctx.topic}.` },
      { heading: "Step 2 — Apply", body: "Choose the relevant concept or method from this module and apply it to the given situation." },
      { heading: "Step 3 — Check", body: "Confirm the result answers the original question and note one limitation or edge case." }
    ]
  }),

  "hint-ladder": (ctx) => {
    const lecture = findModulePage(ctx, /Lecture and Notes/i);
    return {
      title: "Need a Hint?",
      intro: "Open hints one at a time — try again between each.",
      items: [
        { heading: "Hint 1 — Nudge", body: `Revisit how this module frames ${ctx.topic}. Which concept fits this task best?` },
        { heading: "Hint 2 — Strategy", body: "Work the task in stages: identify what is given, choose the concept, apply it, then check the result." },
        { heading: "Hint 3 — Near-solution", body: lecture ? `Follow the worked reasoning in “${lecture.title}” and adapt each step to this task.` : "Adapt the worked reasoning from this module's notes step by step to this task." }
      ]
    };
  },

  "common-mistake-explorer": (ctx) => ({
    title: "Common Mistake to Avoid",
    quote: `A response summarizes ${ctx.topic} accurately but never makes a specific claim or connects the summary to evidence.`,
    items: [],
    reveal: { label: "Reveal the diagnosis and repair", body: "The work reads as a summary, not an analysis. Repair it by stating one arguable claim, then attaching the strongest piece of evidence from this module and explaining why it supports the claim." }
  }),

  "confidence-check": (ctx) => {
    const lecture = findModulePage(ctx, /Lecture and Notes/i);
    const practice = findModulePage(ctx, /Practice Activity/i);
    const items: InteractionContent["items"] = [
      { heading: "I am still confused", body: lecture ? `Reread “${lecture.title}” and write down the exact sentence where you lose the thread.` : "Reread the module notes and write down exactly where you lose the thread." },
      { heading: "I understand some of it", body: practice ? `Redo one task from “${practice.title}” and compare your reasoning with the worked steps.` : "Redo one practice task and compare your reasoning with the worked steps." },
      { heading: "I can explain and apply it", body: ctx.quiz ? `Take “${ctx.quiz.title}” now, then try explaining ${ctx.topic} to someone unfamiliar with it.` : `Try explaining ${ctx.topic} to someone unfamiliar with it, then extend it to a new example.` }
    ];
    return { title: "How Confident Are You?", intro: `Pick the level that matches you right now and follow its next step.`, items };
  },

  "interactive-study-checklist": (ctx) => {
    const items: InteractionContent["items"] = [
      { heading: "Restate each objective as a question", body: `and answer it from memory before checking the ${ctx.moduleLabel.toLowerCase()} notes.` },
      { heading: "Rework one practice task from scratch", body: "without looking at the worked example first." },
      { heading: "Explain the hardest idea aloud", body: `${ctx.topic} counts as studied only when you can explain it without notes.` }
    ];
    if (ctx.quiz) items.push({ heading: `Preview “${ctx.quiz.title}”`, body: "check the question count and format so nothing surprises you." });
    return { title: "Study Checklist", intro: "Do these in order — retrieval first, rereading last.", items };
  },

  "reflection-ladder": (ctx) => ({
    title: `${ctx.moduleLabel} Reflection`,
    intro: "Climb the ladder — each prompt asks a little more than the one before.",
    items: [
      { heading: "Recall", body: `What did you actually do and learn in ${ctx.moduleLabel.toLowerCase()}?` },
      { heading: "Interpret", body: `Why does ${ctx.topic} matter beyond this course?` },
      { heading: "Apply", body: "Where could you use this idea in the next module, another course, or your own work?" },
      { heading: "Evaluate", body: "What evidence or limitation deserves more scrutiny than it got?" },
      { heading: "Commit", body: "What will you do differently in the next module because of this one?" }
    ]
  }),

  "adaptive-remediation-menu": (ctx) => {
    const readings = findModulePage(ctx, /Readings and Resources/i);
    const practice = findModulePage(ctx, /Practice Activity/i);
    const items: InteractionContent["items"] = [
      { heading: "Foundational path", body: readings ? `Revisit “${readings.title}” and rebuild your notes on the core vocabulary of ${ctx.topic}.` : `Rebuild your notes on the core vocabulary of ${ctx.topic}.`, href: readings ? wikiPageRef(readings.id) : undefined },
      { heading: "Applied path", body: practice ? `Rework “${practice.title}” and focus on the step where your reasoning diverged.` : "Rework the practice activity and focus on the step where your reasoning diverged.", href: practice ? wikiPageRef(practice.id) : undefined }
    ];
    if (ctx.discussion) items.push({ heading: "Challenge path", body: `Return to “${ctx.discussion.title}” and respond to the strongest post that disagrees with yours.`, href: discussionRef(ctx.discussion.id) });
    return { title: "Choose Your Review Path", intro: "Pick the path that matches the difficulty you experienced this module.", items };
  },

  "study-strategy-selector": (ctx) => ({
    title: "Pick a Study Strategy",
    intro: "Match your study method to what the next assessment actually asks of you.",
    items: [
      { heading: "I need to remember information", body: "Use retrieval practice: flashcards, self-quizzing, and spaced review — not rereading." },
      { heading: "I need to apply a method", body: `Use worked examples from ${ctx.topic}, then progressively solve without looking.` },
      { heading: "I need to compare or evaluate", body: "Build a comparison table or argument map and practice explaining the tradeoffs aloud." }
    ]
  }),

  "transfer-challenge": (ctx) => ({
    title: "Transfer Challenge",
    intro: `You practiced ${ctx.topic} in this module's context. Now push it somewhere new.`,
    items: [
      { heading: "Original context", body: `The examples in ${ctx.moduleLabel.toLowerCase()} applied ${ctx.topic} to the situations discussed in the readings and practice work.` },
      { heading: "New context", body: "Choose a different audience, setting, or data set — one meaningfully unlike the examples — and apply the same concept." },
      { heading: "Compare", body: "What stayed the same? What changed? What new limitation or opportunity appeared?" }
    ],
    reveal: { label: "What a strong transfer looks like", body: "A strong transfer names the concept's core mechanism explicitly, shows it operating in the new context, and honestly reports where the fit breaks down." }
  }),

  "interactive-rubric-explorer": (ctx) => {
    if (!ctx.rubric || !ctx.rubric.criteria.length) return null;
    return {
      title: `How “${ctx.assignment?.title ?? "This Assignment"}” Is Graded`,
      intro: "Open each criterion to see what strong work looks like before you submit.",
      items: ctx.rubric.criteria.slice(0, 5).map((criterion) => {
        const top = [...criterion.levels].sort((a, b) => b.points - a.points)[0];
        return {
          heading: criterion.title,
          body: top ? `${criterion.description} Top level (“${top.label}”, ${top.points} pts): ${top.description}` : criterion.description,
          meta: `${Math.max(...criterion.levels.map((level) => level.points), 0)} pts`
        };
      })
    };
  },

  "frequently-missed-instructions": (ctx) => {
    if (!ctx.assignment) return null;
    const due = ctx.assignment.dueAt ? new Date(ctx.assignment.dueAt).toLocaleDateString() : null;
    return {
      title: "Instructions Students Often Miss",
      items: [
        { heading: "Submission type", body: `This assignment accepts: ${ctx.assignment.submissionType}. Anything else cannot be graded.` },
        { heading: "Points and rubric", body: `Worth ${ctx.assignment.points} points${ctx.rubric ? ` and graded with the “${ctx.rubric.title}” rubric — read it before drafting` : ""}.` },
        { heading: "Timing", body: due ? `Due ${due}. Leave time to upload and verify the submission opened correctly.` : "Check Canvas for the due date and leave time to verify your submission uploaded correctly." },
        { heading: "Evidence expectations", body: `Work must engage ${ctx.topic} specifically — generic responses that could fit any topic lose credit.` }
      ]
    };
  },

  "assignment-planning-wizard": (ctx) => ({
    title: `Planning “${ctx.assignment?.title ?? `${ctx.moduleLabel} work`}”`,
    intro: "Work through the stages in order. The first panel is open to get you started.",
    items: [
      { heading: "1. Define", body: `State the question, goal, or problem in one clear sentence connected to ${ctx.topic}.`, open: true },
      { heading: "2. Develop", body: "Gather the evidence, criteria, and examples from this module that the work must use." },
      { heading: "3. Draft", body: "Produce a complete draft, then check it against the rubric before polishing." },
      { heading: "4. Verify and submit", body: "Confirm the file type, naming, and submission requirements, then submit with time to spare." }
    ]
  }),

  "process-stepper": (ctx) => ({
    title: "Milestone Steps",
    intro: "Each stage has a concrete deliverable — do not move on without it.",
    items: [
      { heading: "Stage 1 — Scope", body: `Define what this checkpoint contributes to the final project, grounded in ${ctx.topic}.`, meta: "deliverable: one-paragraph scope" },
      { heading: "Stage 2 — Build", body: "Complete the checkpoint work itself: evidence gathered, sections drafted, or prototype updated.", meta: "deliverable: the artifact" },
      { heading: "Stage 3 — Check", body: "Compare the artifact against the final-project rubric and record one improvement to make next.", meta: "deliverable: revision note" }
    ]
  }),

  "scenario-card": (ctx) => {
    if (!ctx.discussion) return null;
    return {
      title: `A Situation from ${ctx.topic}`,
      intro: `A practitioner faces a decision where ${ctx.topic.toLowerCase()} is directly at stake: competing priorities, incomplete information, and a deadline.`,
      items: [
        { heading: "Stakeholders", body: "Identify who is affected by the decision and what each party stands to gain or lose." },
        { heading: "Tension", body: "The evidence points in more than one direction — name the strongest consideration on each side." }
      ],
      reveal: { label: "Questions to consider before posting", body: `Who is affected? What evidence from this module is missing? What would you do next, and how does ${ctx.topic} justify it? Bring your answers into “${ctx.discussion.title}”.` }
    };
  },

  "compare-the-perspectives-panels": (ctx) => ({
    title: `Two Perspectives on ${ctx.topic}`,
    intro: "Open each panel, then decide where you stand — without flattening the disagreement.",
    items: [
      { heading: "Perspective A", body: `Prioritizes the established framework of ${ctx.topic}: its assumptions, its strongest evidence, and the risks it worries about most.` },
      { heading: "Perspective B", body: "Challenges that framing: different priorities, different evidence, and a different view of what failure looks like." }
    ],
    reveal: { label: "Compare and decide", body: "State each perspective's strongest evidence in one sentence, then explain which consideration should carry the most weight in this module's context — and what would change your mind." }
  }),

  "peer-review-protocol": (ctx) => ({
    title: "Peer Feedback Protocol",
    intro: "Use every step — feedback that skips steps is rarely actionable.",
    items: [
      { heading: "Describe", body: "State what the draft is trying to accomplish, in your own words." },
      { heading: "Identify", body: "Point to one specific strength and the evidence that makes it work." },
      { heading: "Question", body: "Ask one clarifying or analytical question about the reasoning." },
      { heading: "Recommend", body: "Suggest one concrete revision tied to the rubric." },
      { heading: "Prioritize", body: "Name the single most important next step for this draft." }
    ]
  }),

  "source-credibility-analyzer": (ctx) => ({
    title: "Evaluate Your Sources",
    intro: `Before citing a source on ${ctx.topic}, run it through these checks.`,
    items: [
      { heading: "Evidence", body: "What actually supports the claims — data, documents, expertise, or assertion?" },
      { heading: "Context", body: "Who created it, for what audience, and under what incentives?" },
      { heading: "Currency", body: "Is it current enough for this topic, or has the field moved?" },
      { heading: "Limitations", body: "What is missing, uncertain, or potentially biased?" }
    ],
    reveal: { label: "Make the judgment", body: "State plainly: would you stake your own argument on this source? If not fully, say what you would verify first and where." }
  }),

  "primary-source-annotation-guide": (ctx) => ({
    title: "Reading a Primary Source Closely",
    intro: `Use these lenses on the source material for ${ctx.topic}.`,
    items: [
      { heading: "Context", body: "When and why was this created, and what was happening around it?" },
      { heading: "Evidence", body: "What details in the source itself support your interpretation?" },
      { heading: "Perspective", body: "Whose voice is present — and whose is absent?" },
      { heading: "Open questions", body: "What does this source not answer that you would need to investigate?" }
    ]
  }),

  "hypothesis-builder": (ctx) => ({
    title: "Build a Testable Hypothesis",
    intro: `Turn an observation about ${ctx.topic} into something you can actually test.`,
    items: [
      { heading: "1. Observe", body: "State the pattern or phenomenon you noticed, without explaining it yet.", open: true },
      { heading: "2. Predict", body: "Write an if/then statement connecting a specific change to a measurable outcome." },
      { heading: "3. Variables", body: "Name the independent, dependent, and controlled variables in your prediction." },
      { heading: "4. Rationale", body: "Explain why the concepts from this module make your prediction plausible." }
    ]
  }),

  "variable-identification-activity": (ctx) => ({
    title: "Identify the Variables",
    intro: `Consider a study investigating ${ctx.topic}. Classify each variable before revealing the reasoning.`,
    items: [
      { heading: "Independent variable", body: "The condition deliberately changed by the investigator — identify what is being manipulated in this module's examples." },
      { heading: "Dependent variable", body: "The outcome that is measured or observed — identify what responds to the change." },
      { heading: "Controlled variables", body: "Everything held constant so the comparison stays fair — name at least two from the example." }
    ],
    reveal: { label: "Why this classification matters", body: "If the independent and dependent variables are swapped or a control is missed, the study's conclusion no longer follows from its data. Check your classification against the module's worked examples." }
  }),

  "data-quality-checklist": (ctx) => ({
    title: "Check the Data First",
    intro: `Before analyzing or visualizing data related to ${ctx.topic}, verify:`,
    items: [
      { heading: "Completeness", body: "Are there missing values, gaps in time, or excluded groups?" },
      { heading: "Accuracy", body: "How was it measured, and what errors does that method invite?" },
      { heading: "Consistency", body: "Are units, definitions, and categories stable across the whole set?" },
      { heading: "Provenance", body: "Who collected it, why, and what incentives shaped the collection?" },
      { heading: "Bias", body: "What systematic distortions could the collection process have introduced?" }
    ]
  }),

  "chart-type-chooser": (ctx) => ({
    title: "Choosing the Right Chart",
    intro: "Start from your question, not from the chart you like.",
    items: [
      { heading: "Comparing categories", body: "Use a bar chart — sorted, with a labeled baseline at zero." },
      { heading: "Showing change over time", body: "Use a line chart with clear time intervals on the axis." },
      { heading: "Showing a distribution", body: "Use a histogram or box plot to expose spread and outliers." },
      { heading: "Showing a relationship", body: "Use a scatterplot and resist implying causation from the pattern." }
    ]
  }),

  "goal-setting-contract": (ctx) => ({
    title: "Set Your Course Goal",
    intro: `Turn “do well in ${ctx.course.title}” into a plan you can actually follow.`,
    items: [
      { heading: "1. Goal", body: "State one specific, observable goal for this course — something you could prove you reached.", open: true },
      { heading: "2. Evidence", body: "Name what will count as evidence of progress at midterm." },
      { heading: "3. Schedule", body: "Block the weekly time this course needs and write down where it lives in your week." },
      { heading: "4. Obstacles", body: "Name the most likely obstacle and your specific plan for the week it appears." }
    ]
  }),

  "ethical-dilemma-explorer": (ctx) => ({
    title: `An Ethical Lens on ${ctx.topic}`,
    intro: "Work through each lens before settling on a position.",
    items: [
      { heading: "Consequences", body: "Who benefits, who may be harmed, and how certain are those outcomes?" },
      { heading: "Duties and rights", body: "What obligations and rights apply, regardless of the outcome?" },
      { heading: "Fairness and standards", body: "What rules, professional standards, or equity concerns matter here?" },
      { heading: "Your position", body: "State your position and which lens carried the most weight — and why." }
    ]
  }),

  "exam-wrapper-reflection": (ctx) => ({
    title: "After the Assessment",
    intro: `Before moving past ${ctx.moduleLabel.toLowerCase()}, analyze how your preparation actually performed.`,
    items: [
      { heading: "Preparation", body: "How did you prepare, and for how long — honestly?" },
      { heading: "Error sources", body: "Which misses came from knowledge gaps, reasoning slips, misread questions, or time pressure?" },
      { heading: "Resources", body: "Which course resources did you actually use, and which did you skip?" },
      { heading: "One change", body: "Name the single specific change you will make before the next assessment." }
    ]
  })
};

// ── Selection logic ─────────────────────────────────────────────────────────

/**
 * Ordered candidate patterns per page type. Rotation index (module position)
 * walks these lists so adjacent modules vary instead of repeating one pattern.
 */
const PAGE_TYPE_CANDIDATES: Record<InteractionPageType, string[][]> = {
  homepage: [],
  syllabus: [],
  orientation: [["goal-setting-contract"]],
  "module-overview": [["visual-module-launchpad"], ["learning-objectives-card", "action-item-checklist"]],
  content: [
    ["interactive-reading-guide", "socratic-question-chain", "primary-source-annotation-guide", "source-credibility-analyzer", "data-quality-checklist", "chart-type-chooser", "ethical-dilemma-explorer"],
    ["stop-and-think-prompt", "click-to-reveal-answer"]
  ],
  practice: [
    ["worked-example-reveal", "hint-ladder", "hypothesis-builder", "variable-identification-activity"],
    ["common-mistake-explorer", "click-to-reveal-answer"]
  ],
  assignment: [["interactive-rubric-explorer"], ["frequently-missed-instructions", "assignment-planning-wizard"]],
  discussion: [["scenario-card", "compare-the-perspectives-panels", "peer-review-protocol"]],
  "quiz-prep": [["interactive-study-checklist", "study-strategy-selector"], ["confidence-check"]],
  recap: [["reflection-ladder", "confidence-check", "adaptive-remediation-menu", "study-strategy-selector"], ["transfer-challenge", "exam-wrapper-reflection"]],
  milestone: [["assignment-planning-wizard", "process-stepper"]]
};

const disciplineFits = (patternId: string, disciplines: InteractionDiscipline[]): boolean => {
  const pattern = interactionPatternById(patternId);
  if (!pattern) return false;
  return pattern.disciplines.includes("all") || pattern.disciplines.some((tag) => disciplines.includes(tag));
};

const pageTypeFits = (patternId: string, pageType: InteractionPageType): boolean => {
  const pattern = interactionPatternById(patternId);
  return !!pattern && pattern.pageTypes.includes(pageType);
};

const pickFromSlot = (
  slot: string[],
  pageType: InteractionPageType,
  disciplines: InteractionDiscipline[],
  usage: Map<string, number>,
  moduleUsage: Set<string>,
  rotation: number
): string | null => {
  const eligible = slot.filter((patternId) => {
    const pattern = interactionPatternById(patternId);
    if (!pattern || pattern.tier !== "native" || pattern.requiredAssets.length) return false;
    if (!pageTypeFits(patternId, pageType)) return false;
    if (!disciplineFits(patternId, disciplines)) return false;
    if (moduleUsage.has(patternId)) return false; // never repeat within a module
    const cap = FREQUENCY_CAPS[pattern.frequency];
    if ((usage.get(patternId) ?? 0) >= cap) return false;
    return CONTENT_BUILDERS[patternId] !== undefined;
  });
  if (!eligible.length) return null;
  return eligible[rotation % eligible.length];
};

const buildSelection = (patternId: string, ctx: BuilderCtx): InteractionSelection | null => {
  const pattern = interactionPatternById(patternId);
  const builder = CONTENT_BUILDERS[patternId];
  if (!pattern || !builder) return null;
  const content = builder(ctx);
  if (!content || (!content.items.length && !content.quote)) return null;
  return {
    patternId,
    content,
    rationale: `${pattern.name}: ${pattern.bestUse}`
  };
};

/** Deterministically plan interactions for every eligible surface in the course. */
export const planCourseInteractions = (course: CourseProject): CourseInteractionPlan => {
  const disciplines = inferCourseDisciplines(course);
  const usage = new Map<string, number>();
  const surfaces: SurfacePlan[] = [];

  const contentModules = course.modules.filter((module) => module.kind === "content" || module.kind === "final");

  const recordSelections = (
    surfaceType: SurfacePlan["surfaceType"],
    surfaceId: string,
    surfaceTitle: string,
    pageType: InteractionPageType,
    ctx: BuilderCtx,
    moduleUsage: Set<string>,
    rotation: number
  ): void => {
    const cap = DENSITY_CAPS[pageType];
    if (cap === 0) return;
    const selections: InteractionSelection[] = [];
    for (const slot of PAGE_TYPE_CANDIDATES[pageType]) {
      if (selections.length >= cap) break;
      const patternId = pickFromSlot(slot, pageType, disciplines, usage, moduleUsage, rotation);
      if (!patternId) continue;
      const selection = buildSelection(patternId, ctx);
      if (!selection) continue;
      selections.push(selection);
      usage.set(patternId, (usage.get(patternId) ?? 0) + 1);
      moduleUsage.add(patternId);
    }
    if (selections.length) surfaces.push({ surfaceType, surfaceId, surfaceTitle, pageType, selections });
  };

  // Orientation: exactly one pattern on the success-guide page, when present.
  const orientationModule = course.modules.find((module) => module.kind === "start");
  const successGuide = course.pages.find((page) => page.id.endsWith(WELL_KNOWN_PAGE_IDS.successGuide) || page.id === WELL_KNOWN_PAGE_IDS.successGuide || /Course Success Guide/i.test(page.title));
  if (successGuide && orientationModule) {
    const ctx: BuilderCtx = {
      course,
      module: orientationModule,
      page: successGuide,
      topic: topicOf(undefined, course),
      moduleLabel: "Getting Started",
      modulePages: [],
      moduleNumber: 0
    };
    recordSelections("page", successGuide.id, successGuide.title, "orientation", ctx, new Set(), 0);
  }

  contentModules.forEach((module, moduleIndex) => {
    const moduleUsage = new Set<string>();
    const modulePages = course.pages.filter((page) => page.moduleId === module.id);
    const moduleAssignment = course.assignments.find((assignment) => assignment.moduleId === module.id);
    const moduleDiscussion = course.discussions.find((discussion) => discussion.moduleId === module.id);
    const moduleQuiz = course.quizzes.find((quiz) => quiz.moduleId === module.id);
    const rubric = moduleAssignment?.rubricId ? course.rubrics.find((item) => item.id === moduleAssignment.rubricId) : undefined;
    const baseCtx: Omit<BuilderCtx, "page"> = {
      course,
      module,
      assignment: moduleAssignment,
      discussion: moduleDiscussion,
      quiz: moduleQuiz,
      rubric,
      topic: topicOf(module, course),
      moduleLabel: labelOf(module),
      modulePages,
      moduleNumber: moduleIndex + 1
    };

    for (const page of modulePages) {
      const pageType = classifyPage(page, module);
      if (!pageType) continue;
      recordSelections("page", page.id, page.title, pageType, { ...baseCtx, page }, moduleUsage, moduleIndex);
    }

    if (moduleAssignment) {
      recordSelections("assignment", moduleAssignment.id, moduleAssignment.title, "assignment", { ...baseCtx }, moduleUsage, moduleIndex);
    }
    if (moduleDiscussion) {
      recordSelections("discussion", moduleDiscussion.id, moduleDiscussion.title, "discussion", { ...baseCtx }, moduleUsage, moduleIndex);
    }
  });

  return { disciplines, surfaces, usage: Object.fromEntries(usage) };
};

// ── Applying a plan ─────────────────────────────────────────────────────────

const toBlocks = (surface: SurfacePlan, generatedAt: string): InteractionBlock[] =>
  surface.selections.map((selection, index) => ({
    id: `${surface.surfaceId}-ix-${index + 1}-${selection.patternId}`,
    patternId: selection.patternId,
    content: selection.content,
    rationale: selection.rationale,
    source: "generated",
    createdAt: generatedAt
  }));

/**
 * Apply a plan to the course, replacing previously GENERATED, UNLOCKED blocks
 * while preserving locked blocks and instructor-inserted blocks.
 */
export const applyCourseInteractions = (course: CourseProject, existingPlan?: CourseInteractionPlan): CourseProject => {
  const plan = existingPlan ?? planCourseInteractions(course);
  const generatedAt = course.metadata?.updatedAt ?? course.updatedAt ?? new Date(0).toISOString();
  const bySurface = new Map(plan.surfaces.map((surface) => [`${surface.surfaceType}:${surface.surfaceId}`, surface]));

  const merge = (existing: InteractionBlock[] | undefined, surfaceKey: string): InteractionBlock[] | undefined => {
    const kept = (existing ?? []).filter((block) => block.locked || block.source === "inserted");
    const surface = bySurface.get(surfaceKey);
    const fresh = surface ? toBlocks(surface, generatedAt).filter((block) => !kept.some((keptBlock) => keptBlock.patternId === block.patternId)) : [];
    const merged = [...fresh, ...kept];
    return merged.length ? merged : undefined;
  };

  return {
    ...course,
    pages: course.pages.map((page) => ({ ...page, interactionBlocks: merge(page.interactionBlocks, `page:${page.id}`) })),
    assignments: course.assignments.map((assignment) => ({ ...assignment, interactionBlocks: merge(assignment.interactionBlocks, `assignment:${assignment.id}`) })),
    discussions: course.discussions.map((discussion) => ({ ...discussion, interactionBlocks: merge(discussion.interactionBlocks, `discussion:${discussion.id}`) }))
  };
};

/** Patterns that are auto-selectable today (native tier + content builder). */
export const AUTO_SELECTABLE_PATTERN_IDS: string[] = INTERACTION_PATTERNS.filter(
  (pattern) => pattern.tier === "native" && !pattern.requiredAssets.length && CONTENT_BUILDERS[pattern.id]
).map((pattern) => pattern.id);

/** Build editor-preview content for ANY pattern using course context (never "Concept A"). */
export const buildEditorSampleContent = (patternId: string, course: CourseProject): InteractionContent | null => {
  const module = course.modules.find((item) => item.kind === "content");
  const ctx: BuilderCtx = {
    course,
    module,
    topic: topicOf(module, course),
    moduleLabel: labelOf(module),
    modulePages: module ? course.pages.filter((page) => page.moduleId === module.id) : [],
    moduleNumber: 1,
    assignment: course.assignments[0],
    discussion: course.discussions[0],
    quiz: course.quizzes[0],
    rubric: course.rubrics[0]
  };
  const builder = CONTENT_BUILDERS[patternId];
  if (builder) return builder(ctx);
  const pattern = interactionPatternById(patternId);
  if (!pattern) return null;
  // Generic-but-contextual starter for editor insertion of patterns without a
  // dedicated builder. Content references the actual course topic so nothing
  // reads as an unfinished template; instructors edit it before relying on it.
  if (pattern.template === "matrix-table") {
    return {
      title: pattern.name,
      intro: `${pattern.bestUse} Edit the rows so they reflect your course's treatment of ${ctx.topic}.`,
      columns: ["Perspective", "Priorities", "Risks or limitations", "Evidence to gather"],
      rows: [
        [`${ctx.topic}: primary viewpoint`, "What this viewpoint values most in this module.", "What it risks overlooking.", "The evidence students should collect first."],
        [`${ctx.topic}: competing viewpoint`, "What the competing viewpoint values.", "Where it is most vulnerable.", "The evidence that would test it."]
      ],
      items: [{ heading: "Synthesis", body: `After completing the matrix, state which consideration should carry the most weight for ${ctx.topic} and why.` }]
    };
  }
  return {
    title: pattern.name,
    intro: `${pattern.bestUse} Edit this starter so it reflects your course's treatment of ${ctx.topic}.`,
    items: [
      { heading: `${ctx.topic}: key point`, body: `Summarize the aspect of ${ctx.topic} this ${pattern.name.toLowerCase()} should teach.` },
      { heading: "Evidence or example", body: "Add the concrete example, evidence, or case your students should work with." },
      { heading: "What students do", body: "Tell students exactly what to do with this panel and how long it should take." }
    ]
  };
};
