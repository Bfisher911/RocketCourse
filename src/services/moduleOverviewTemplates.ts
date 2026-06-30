import type { CourseSettings, ModuleOverviewStyleId, Theme } from "../types";
import { fileRef } from "./canvasLinks";
import {
  buildModuleRoadmap,
  buildThemedCard,
  buildThemedChips,
  buildThemedColumns,
  buildThemedDivider,
  buildThemedShell,
  buildThemedSteps,
  buildThemedTable,
  buildThemedTimeline,
  getThemeStyles
} from "./themeDesign";

export interface ModuleOverviewStyleMeta {
  id: ModuleOverviewStyleId;
  name: string;
  description: string;
}

export const MODULE_OVERVIEW_STYLES: ModuleOverviewStyleMeta[] = [
  { id: "weekly-rhythm", name: "Weekly Rhythm", description: "A calm overview built around predictable student routines." },
  { id: "inquiry-cycle", name: "Inquiry Cycle", description: "Frames the module as a question, investigation, evidence check, and synthesis." },
  { id: "project-sprint", name: "Project Sprint", description: "Turns the module into a short sprint with milestones and deliverables." },
  { id: "case-based", name: "Case-Based", description: "Centers a realistic case, stakeholders, evidence, and a decision point." },
  { id: "debate-based", name: "Debate-Based", description: "Invites position-taking, counterargument, and respectful disagreement." },
  { id: "lab-based", name: "Lab-Based", description: "Emphasizes procedure, observation, evidence, safety, and interpretation." },
  { id: "reading-seminar", name: "Reading Seminar", description: "Foregrounds close reading, annotation, discussion, and synthesis." },
  { id: "field-investigation", name: "Field Investigation", description: "Uses observation, context, field notes, and evidence collection." },
  { id: "design-studio", name: "Design Studio", description: "Guides students through critique, iteration, prototype, and reflection." },
  { id: "operations-briefing", name: "Operations Briefing", description: "Gives students a command-center brief with priorities, risks, and actions." }
];

interface StyleCopy {
  missionLabel: string;
  mission: string;
  bigQuestion: string;
  read: string;
  watch: string;
  do: string;
  map: Array<{ label: string; sub?: string }>;
  keyTerms: Array<{ title: string; body: string; accent?: string }>;
  beforeBegin: string[];
  commonMistake: string;
  wrapPreview: string;
}

export interface ModuleOverviewRenderContext {
  courseTitle: string;
  theme: Theme;
  styleId: ModuleOverviewStyleId;
  moduleLabel: string;
  moduleTopic: string;
  moduleNumber: number;
  workloadHours: number;
  objectives: string[];
  outcomeHtml: string;
  glanceRows: string[][];
  learningPathSteps: string[];
  navigationHtml: string;
  structureApproach: string;
  nextTopic: string;
  weekBadgeFile?: string;
}

const escHtml = (value: string | number | undefined | null): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const escAttr = (value: string | number | undefined | null): string => escHtml(value).replace(/`/g, "&#96;");

const knownStyle = (id: string | undefined): id is ModuleOverviewStyleId => MODULE_OVERVIEW_STYLES.some((style) => style.id === id);

const styleByThemeId: Record<string, ModuleOverviewStyleId> = {
  "psychology-lab": "lab-based",
  "creative-writing-studio": "reading-seminar",
  "marine-biology-field-journal": "field-investigation",
  "environmental-science-field-station": "field-investigation",
  "art-history-gallery": "case-based",
  "financial-accounting-ledger-lab": "operations-briefing",
  "public-health-command-center": "operations-briefing",
  "ethics-debate-chamber": "debate-based",
  "emergency-management-operations-center": "operations-briefing",
  "business-strategy-boardroom": "project-sprint",
  "data-science-workbench": "lab-based",
  "literature-seminar": "reading-seminar",
  "history-archive": "case-based",
  "design-studio": "design-studio",
  "leadership-lab": "project-sprint"
};

export const chooseModuleOverviewStyle = (settings: Pick<CourseSettings, "moduleOverviewStyleId">, theme: Theme): ModuleOverviewStyleId => {
  if (knownStyle(settings.moduleOverviewStyleId)) return settings.moduleOverviewStyleId;
  return styleByThemeId[theme.id] ?? "weekly-rhythm";
};

export const moduleOverviewStyleMeta = (styleId: ModuleOverviewStyleId): ModuleOverviewStyleMeta =>
  MODULE_OVERVIEW_STYLES.find((style) => style.id === styleId) ?? MODULE_OVERVIEW_STYLES[0];

const copyFor = (styleId: ModuleOverviewStyleId, topic: string, courseTitle: string, nextTopic: string): StyleCopy => {
  const baseTerms = [
    { title: "Evidence", body: "Information students can point to, explain, and use to support a claim.", accent: "Use" },
    { title: "Context", body: "The conditions, people, constraints, and history that shape interpretation.", accent: "Frame" },
    { title: "Tradeoff", body: "What becomes harder, riskier, or less available when one option is chosen.", accent: "Weigh" }
  ];
  switch (styleId) {
    case "inquiry-cycle":
      return {
        missionLabel: "Inquiry brief",
        mission: `Investigate ${topic.toLowerCase()} by moving from a question to evidence, interpretation, and a defensible next step.`,
        bigQuestion: `What evidence would change how we understand ${topic.toLowerCase()} in ${courseTitle}?`,
        read: "Read for claims, assumptions, and evidence.",
        watch: "Watch or review examples for patterns and tensions.",
        do: "Build a short answer that explains what the evidence makes visible.",
        map: [
          { label: "Question", sub: "Name the puzzle" },
          { label: "Investigate", sub: "Gather evidence" },
          { label: "Interpret", sub: "Explain meaning" },
          { label: "Synthesize", sub: "Carry forward" }
        ],
        keyTerms: baseTerms,
        beforeBegin: ["Open the module overview first.", "Write one question you expect the module to answer.", "Keep notes on evidence, uncertainty, and next steps."],
        commonMistake: "Do not stop at a broad opinion. Use the module evidence to revise or complicate the first answer.",
        wrapPreview: `By the end, you should be ready to connect this inquiry to ${nextTopic.toLowerCase()}.`
      };
    case "project-sprint":
      return {
        missionLabel: "Sprint brief",
        mission: `Use ${topic.toLowerCase()} to create a small, visible piece of work that can feed a larger project or decision.`,
        bigQuestion: `What can you make or improve this week that proves your understanding of ${topic.toLowerCase()}?`,
        read: "Read to collect requirements and constraints.",
        watch: "Watch examples for structure, quality, and audience fit.",
        do: "Draft, test, or revise one concrete artifact.",
        map: [
          { label: "Plan", sub: "Define the target" },
          { label: "Build", sub: "Create a draft" },
          { label: "Review", sub: "Use criteria" },
          { label: "Ship", sub: "Submit or carry forward" }
        ],
        keyTerms: [
          { title: "Artifact", body: "The thing you create, revise, or submit.", accent: "Build" },
          { title: "Criteria", body: "The success markers used to judge quality.", accent: "Check" },
          { title: "Iteration", body: "A purposeful revision based on evidence or feedback.", accent: "Improve" }
        ],
        beforeBegin: ["Review the rubric or success checklist.", "Create a small work plan before drafting.", "Save evidence and feedback for revision."],
        commonMistake: "Do not wait for the perfect final idea. A useful draft gives you something to improve.",
        wrapPreview: `Your work here should make the next project move in ${nextTopic.toLowerCase()} easier.`
      };
    case "case-based":
      return {
        missionLabel: "Case file",
        mission: `Treat ${topic.toLowerCase()} as a case with context, stakeholders, evidence, options, and consequences.`,
        bigQuestion: `What is the most defensible decision once the evidence and stakeholders are visible?`,
        read: "Read for facts, constraints, and missing information.",
        watch: "Watch examples for stakeholder impact.",
        do: "Recommend an action and explain the tradeoffs.",
        map: [
          { label: "Case", sub: "What happened" },
          { label: "Stakeholders", sub: "Who is affected" },
          { label: "Evidence", sub: "What supports it" },
          { label: "Decision", sub: "What follows" }
        ],
        keyTerms: [
          { title: "Stakeholder", body: "A person, group, or system affected by the case.", accent: "Who" },
          { title: "Decision Point", body: "The moment where a choice must be made.", accent: "When" },
          { title: "Consequence", body: "A likely result or risk of an option.", accent: "Then" }
        ],
        beforeBegin: ["Separate facts from interpretation.", "Name the affected stakeholders.", "Look for evidence before recommending action."],
        commonMistake: "Do not recommend before diagnosing. Strong case work explains why the action fits the evidence.",
        wrapPreview: `The case logic here prepares you for the next decision in ${nextTopic.toLowerCase()}.`
      };
    case "debate-based":
      return {
        missionLabel: "Debate brief",
        mission: `Use ${topic.toLowerCase()} to practice making a position stronger through evidence, counterargument, and respectful reply.`,
        bigQuestion: `Which position is most defensible, and what evidence would make you revise it?`,
        read: "Read to identify claims and counterclaims.",
        watch: "Watch for examples of evidence-based disagreement.",
        do: "State a position, name a counterargument, and respond with evidence.",
        map: [
          { label: "Claim", sub: "Take a position" },
          { label: "Evidence", sub: "Support it" },
          { label: "Counter", sub: "Represent fairly" },
          { label: "Revise", sub: "Strengthen reasoning" }
        ],
        keyTerms: [
          { title: "Claim", body: "A position that can be supported, tested, or challenged.", accent: "Say" },
          { title: "Counterargument", body: "A fair version of a different view.", accent: "Weigh" },
          { title: "Respectful Disagreement", body: "A challenge aimed at the idea, not the person.", accent: "Practice" }
        ],
        beforeBegin: ["Write your first position in one sentence.", "Find evidence for and against it.", "Prepare to revise your view if better evidence appears."],
        commonMistake: "Do not caricature the opposing view. A fair counterargument makes your own reasoning stronger.",
        wrapPreview: `The debate moves here will help you evaluate claims in ${nextTopic.toLowerCase()}.`
      };
    case "lab-based":
      return {
        missionLabel: "Lab brief",
        mission: `Approach ${topic.toLowerCase()} as a lab cycle: prepare, observe, record, analyze, and explain what the evidence can support.`,
        bigQuestion: `What can we responsibly conclude from the evidence in this module?`,
        read: "Read for procedure, vocabulary, and constraints.",
        watch: "Watch demonstrations or examples for method and error.",
        do: "Record observations and connect them to a claim.",
        map: [
          { label: "Prepare", sub: "Know the method" },
          { label: "Observe", sub: "Collect evidence" },
          { label: "Analyze", sub: "Find meaning" },
          { label: "Report", sub: "Explain limits" }
        ],
        keyTerms: [
          { title: "Observation", body: "What you can record before interpretation.", accent: "Record" },
          { title: "Method", body: "The repeatable process used to gather evidence.", accent: "Follow" },
          { title: "Limitation", body: "What the evidence cannot prove by itself.", accent: "Qualify" }
        ],
        beforeBegin: ["Read safety, access, or ethics notes.", "Know what evidence you are collecting.", "Separate observation from interpretation."],
        commonMistake: "Do not overclaim. Strong lab reasoning states what the evidence can and cannot show.",
        wrapPreview: `Your observations here become stronger analysis in ${nextTopic.toLowerCase()}.`
      };
    case "reading-seminar":
      return {
        missionLabel: "Seminar brief",
        mission: `Use ${topic.toLowerCase()} to read closely, annotate purposefully, and enter discussion with evidence-backed ideas.`,
        bigQuestion: `What does close reading reveal that a quick summary would miss?`,
        read: "Read for argument, structure, and language choices.",
        watch: "Watch for interpretive moves or contextual examples.",
        do: "Bring one quotation, question, and interpretation to discussion.",
        map: [
          { label: "Preview", sub: "Skim structure" },
          { label: "Annotate", sub: "Mark evidence" },
          { label: "Discuss", sub: "Test meaning" },
          { label: "Synthesize", sub: "Write the takeaway" }
        ],
        keyTerms: [
          { title: "Claim", body: "The idea a source wants readers to consider.", accent: "Find" },
          { title: "Passage", body: "A specific part of the text used as evidence.", accent: "Use" },
          { title: "Interpretation", body: "A reasoned explanation of meaning.", accent: "Explain" }
        ],
        beforeBegin: ["Preview headings or structure.", "Annotate one strong passage.", "Write one question that can open discussion."],
        commonMistake: "Do not summarize the whole source when the task asks for interpretation. Choose a passage and explain it.",
        wrapPreview: `The reading habits here prepare you to enter ${nextTopic.toLowerCase()} with sharper questions.`
      };
    case "field-investigation":
      return {
        missionLabel: "Field brief",
        mission: `Treat ${topic.toLowerCase()} as a field investigation where place, context, observation, and evidence all matter.`,
        bigQuestion: `What becomes visible when we observe the system in context?`,
        read: "Read for background and field lenses.",
        watch: "Watch examples for patterns, variation, and local context.",
        do: "Write a field note that separates observation, interpretation, and question.",
        map: [
          { label: "Orient", sub: "Know the setting" },
          { label: "Observe", sub: "Notice patterns" },
          { label: "Record", sub: "Write evidence" },
          { label: "Connect", sub: "Explain context" }
        ],
        keyTerms: [
          { title: "Field Note", body: "A brief record of what was observed and why it may matter.", accent: "Record" },
          { title: "Pattern", body: "A repeated feature, behavior, or condition.", accent: "Notice" },
          { title: "Context", body: "The surrounding conditions that shape meaning.", accent: "Locate" }
        ],
        beforeBegin: ["Know what you are observing.", "Protect privacy and local context.", "Record evidence before explaining it."],
        commonMistake: "Do not treat a single observation as a universal pattern. Name uncertainty and needed evidence.",
        wrapPreview: `These field notes will help you compare systems in ${nextTopic.toLowerCase()}.`
      };
    case "design-studio":
      return {
        missionLabel: "Studio brief",
        mission: `Use ${topic.toLowerCase()} to make, critique, revise, and explain design choices with evidence.`,
        bigQuestion: `What design choice would most improve the learner, user, or audience experience?`,
        read: "Read for constraints and criteria.",
        watch: "Watch examples for composition, usability, and tradeoffs.",
        do: "Sketch, prototype, critique, or revise one design decision.",
        map: [
          { label: "Brief", sub: "Define the problem" },
          { label: "Prototype", sub: "Make a draft" },
          { label: "Critique", sub: "Use criteria" },
          { label: "Iterate", sub: "Revise with intent" }
        ],
        keyTerms: [
          { title: "Constraint", body: "A limit that shapes what a design can do.", accent: "Frame" },
          { title: "Prototype", body: "A draft built to test an idea.", accent: "Make" },
          { title: "Critique", body: "Specific feedback tied to purpose and criteria.", accent: "Improve" }
        ],
        beforeBegin: ["Define the audience or user.", "Name the constraint you are working within.", "Prepare to revise based on critique."],
        commonMistake: "Do not defend every first choice. Studio learning depends on visible, purposeful revision.",
        wrapPreview: `Your revision habits here will carry into ${nextTopic.toLowerCase()}.`
      };
    case "operations-briefing":
      return {
        missionLabel: "Operations brief",
        mission: `Use ${topic.toLowerCase()} to identify priorities, risks, decisions, and next actions in a clear operational sequence.`,
        bigQuestion: `What should happen next, and what evidence supports that priority?`,
        read: "Read for rules, thresholds, stakeholders, and risk.",
        watch: "Watch examples for signals, escalation, and decision timing.",
        do: "Create a concise action plan or decision memo.",
        map: [
          { label: "Assess", sub: "Read the situation" },
          { label: "Prioritize", sub: "Rank risks" },
          { label: "Act", sub: "Choose next steps" },
          { label: "Review", sub: "Check results" }
        ],
        keyTerms: [
          { title: "Priority", body: "The issue that should receive attention first.", accent: "Rank" },
          { title: "Risk", body: "A possible harm, failure, or consequence.", accent: "Watch" },
          { title: "Action Step", body: "A specific move that can be assigned or completed.", accent: "Do" }
        ],
        beforeBegin: ["Read the situation before acting.", "Name risks and affected stakeholders.", "Keep action steps specific and accountable."],
        commonMistake: "Do not confuse urgency with importance. Use evidence to decide what comes first.",
        wrapPreview: `The operations logic here prepares you to manage complexity in ${nextTopic.toLowerCase()}.`
      };
    default:
      return {
        missionLabel: "Module mission briefing",
        mission: `Start ${topic.toLowerCase()} by understanding the purpose, sequence, actions, and support built into this module.`,
        bigQuestion: `How does ${topic.toLowerCase()} change what you can explain, decide, or create in ${courseTitle}?`,
        read: "Read for vocabulary, evidence, and the central idea.",
        watch: "Watch or review examples that make the idea concrete.",
        do: "Practice, discuss, check understanding, and submit any graded work.",
        map: [
          { label: "Start", sub: "Read overview" },
          { label: "Learn", sub: "Resources and notes" },
          { label: "Practice", sub: "Try the idea" },
          { label: "Submit", sub: "Finish graded work" }
        ],
        keyTerms: baseTerms,
        beforeBegin: ["Read this overview before opening the rest of the module.", "Plan time for reading, practice, discussion, and graded work.", "Write one question to revisit during the wrap-up."],
        commonMistake: "Do not skip the overview. It explains how the module pieces fit together.",
        wrapPreview: `The wrap-up will help you connect this module to ${nextTopic.toLowerCase()}.`
      };
  }
};

const paragraph = (value: string): string => `<p style="margin: 0 0 12px; color: #374151;">${escHtml(value)}</p>`;

const overviewCallout = (theme: Theme, title: string, body: string): string => {
  const styles = getThemeStyles(theme);
  return `<section style="margin: 20px 0; padding: 18px 20px; border-left: 6px solid ${styles.accent}; background: ${styles.soft}; border-radius: 12px; box-shadow: 0 1px 2px rgba(15,23,42,0.04), 0 4px 14px rgba(15,23,42,0.06);">
  <h2 style="margin: 0 0 8px; color: ${styles.accentDark}; font-size: 18px; font-weight: 800; font-family: ${styles.font};">${escHtml(title)}</h2>
  ${body}
</section>`.trim();
};

const overviewNote = (theme: Theme, variant: "tip" | "misconception" | "check", title: string, body: string): string => {
  const styles = getThemeStyles(theme);
  const palette =
    variant === "misconception"
      ? { bg: "#fef2f2", border: "#f3b4b4", fg: "#b91c1c" }
      : variant === "check"
        ? { bg: "#ecfdf5", border: "#9be7c4", fg: "#15803d" }
        : { bg: styles.soft, border: styles.border, fg: styles.accentDark };
  return `<section style="margin: 18px 0; padding: 16px 18px 16px 20px; border: 1px solid ${palette.border}; border-left: 5px solid ${palette.fg}; background: ${palette.bg}; border-radius: 12px; box-shadow: 0 1px 2px rgba(15,23,42,0.04), 0 4px 14px rgba(15,23,42,0.06);">
  <h2 style="margin: 0 0 8px; color: ${palette.fg}; font-weight: 800; font-size: 18px; font-family: ${styles.font};">${escHtml(title)}</h2>
  <div style="color: #374151;">${body}</div>
</section>`.trim();
};

const checklist = (items: string[]): string =>
  `<ul style="list-style: none; margin: 10px 0 0; padding: 0;">${items
    .map(
      (item) =>
        `<li style="position: relative; margin: 8px 0; padding-left: 30px; color: #374151;"><span aria-hidden="true" style="position: absolute; left: 0; top: 0; color: #0f766e; font-weight: 900;">&#10003;</span>${escHtml(item)}</li>`
    )
    .join("")}</ul>`;

export const renderModuleOverviewHtml = (context: ModuleOverviewRenderContext): string => {
  const { theme } = context;
  const styles = getThemeStyles(theme);
  const copy = copyFor(context.styleId, context.moduleTopic, context.courseTitle, context.nextTopic);
  const styleMeta = moduleOverviewStyleMeta(context.styleId);
  const badge = context.weekBadgeFile
    ? `<p style="margin: 0 0 14px;"><img src="${fileRef(context.weekBadgeFile)}" alt="${escAttr(`${context.moduleLabel} visual week badge`)}" style="display: inline-block; width: 86px; height: auto; vertical-align: middle;" /></p>`
    : "";
  const objectiveChips = buildThemedChips(theme, context.objectives.slice(0, 5));
  const pathCards = buildThemedColumns(theme, [
    { title: "Read", body: paragraph(copy.read) },
    { title: "Watch", body: paragraph(copy.watch) },
    { title: "Do", body: paragraph(copy.do) }
  ]);
  const moduleMap = buildModuleRoadmap(theme, copy.map);
  const keyTerms = buildThemedColumns(theme, copy.keyTerms.map((term) => ({ title: term.title, body: paragraph(term.body) })));
  const glanceRows = context.glanceRows.map((row) => row.map((cell) => escHtml(cell.replace(/&amp;/g, "&"))));
  const learningSteps = context.learningPathSteps.slice(0, 5).map((step, index) => ({ title: `Step ${index + 1}`, body: paragraph(step) }));
  const timeTiles = [
    { value: `${context.workloadHours}`, label: "Estimated hours", sub: "Plan focused work blocks" },
    { value: String(context.objectives.length), label: "Objectives", sub: "What this module targets" },
    { value: String(Math.max(1, context.glanceRows.length - 1)), label: "Learning stops", sub: "Pages and graded work" }
  ];
  const timeHtml = `<div style="margin: 16px 0; font-size: 0;">${timeTiles
    .map(
      (tile) =>
        `<div style="display: inline-block; width: 31%; min-width: 150px; vertical-align: top; margin: 0 1% 12px 0; box-sizing: border-box; padding: 16px 18px; background: ${styles.soft}; border: 1px solid ${styles.border}; border-radius: 14px;">
    <div style="font-size: 28px; line-height: 1; color: ${styles.accentDark}; font-weight: 900;">${escHtml(tile.value)}</div>
    <div style="margin: 5px 0 0; color: #111827; font-weight: 800;">${escHtml(tile.label)}</div>
    <div style="margin: 3px 0 0; color: #4b5563; font-size: 13px;">${escHtml(tile.sub)}</div>
  </div>`
    )
    .join("")}</div>`;

  return buildThemedShell(
    theme,
    `${context.moduleLabel}: ${context.moduleTopic}`,
    `${styleMeta.name} module overview for ${context.courseTitle}.`,
    `${badge}
${overviewCallout(theme, "Module Mission Briefing", `${paragraph(copy.mission)}${paragraph(context.structureApproach)}`)}
${overviewNote(theme, "tip", "Big Question", paragraph(copy.bigQuestion))}
${buildThemedCard(theme, "Objectives Chips", objectiveChips)}
${buildThemedCard(theme, "Estimated Time", timeHtml)}
${buildThemedCard(theme, "Read-Watch-Do Path", pathCards)}
${buildThemedCard(theme, "Module Map", moduleMap)}
${buildThemedCard(theme, "Key Terms", keyTerms)}
${buildThemedCard(theme, "This Module at a Glance", buildThemedTable(theme, "Everything in this module and when it is due", ["Activity", "Type", "Due", "Counts toward grade"], glanceRows))}
${buildThemedCard(theme, "Before You Begin Checklist", checklist(copy.beforeBegin))}
${overviewNote(theme, "misconception", "Common Mistake to Avoid", paragraph(copy.commonMistake))}
${buildThemedCard(theme, "Student Action Steps", buildThemedSteps(theme, learningSteps))}
${buildThemedTimeline(theme, [
      { label: "Begin", body: "Read this overview and gather materials." },
      { label: "Build", body: "Work through resources, lesson notes, practice, and interaction." },
      { label: "Close", body: "Use the wrap-up to check understanding and prepare for what follows." }
    ])}
${overviewNote(theme, "check", "Wrap-Up Preview", paragraph(copy.wrapPreview))}
${buildThemedDivider(theme)}
${buildThemedCard(theme, "Aligned Course Outcomes", context.outcomeHtml)}
${buildThemedCard(theme, "Module Navigation", context.navigationHtml)}`
  );
};
