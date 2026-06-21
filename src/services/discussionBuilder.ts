import type { CourseModule, CourseOutcome, CourseProject, Discussion, ModuleItem, ObjectMetadata, Rubric } from "../types";
import { nowIso, slugify, stripHtml } from "../utils/text";

export type DiscussionTemplateId =
  | "evidence-based"
  | "case-response"
  | "debate"
  | "reflection"
  | "peer-feedback"
  | "current-event"
  | "scenario-decision"
  | "role-play"
  | "muddiest-point"
  | "student-led-seminar";

export type DiscussionIssueSeverity = "error" | "warning";
export type DiscussionPlanStatus = "Ready" | "Needs review";
export type DiscussionReviseAction = "specificity" | "evidence" | "replies" | "rubric" | "accessibility" | "concise" | "scenario";

export interface DiscussionTemplate {
  id: DiscussionTemplateId;
  name: string;
  description: string;
  recommendedPoints: number;
}

export interface DiscussionIssue {
  id: string;
  discussionId: string;
  severity: DiscussionIssueSeverity;
  title: string;
  detail: string;
}

export interface DiscussionSummary {
  discussionId: string;
  status: DiscussionPlanStatus;
  issues: DiscussionIssue[];
}

export interface DiscussionPlanValidation {
  score: number;
  status: DiscussionPlanStatus;
  issues: DiscussionIssue[];
  summaries: DiscussionSummary[];
}

export const DISCUSSION_TEMPLATES: DiscussionTemplate[] = [
  { id: "evidence-based", name: "Evidence-Based Discussion", description: "A focused prompt that asks students to use course evidence and respond substantively.", recommendedPoints: 20 },
  { id: "case-response", name: "Case Response", description: "A realistic case prompt with stakeholder analysis, evidence, and action choices.", recommendedPoints: 25 },
  { id: "debate", name: "Debate", description: "A structured position-and-counterargument discussion with respectful challenge norms.", recommendedPoints: 25 },
  { id: "reflection", name: "Reflection", description: "A concept-connected reflection that asks students to name learning, change, and next steps.", recommendedPoints: 15 },
  { id: "peer-feedback", name: "Peer Feedback", description: "A constructive critique workflow for drafts, ideas, artifacts, and project checkpoints.", recommendedPoints: 20 },
  { id: "current-event", name: "Current Event Analysis", description: "A timely evidence check that connects course concepts to a current event or public example.", recommendedPoints: 20 },
  { id: "scenario-decision", name: "Scenario Decision", description: "A decision-making prompt with audience, tradeoffs, recommendation, and risk.", recommendedPoints: 25 },
  { id: "role-play", name: "Role-Play Discussion", description: "A perspective-taking prompt with roles, constraints, and debrief expectations.", recommendedPoints: 20 },
  { id: "muddiest-point", name: "Muddiest Point", description: "A low-stakes clarity check that surfaces confusion and peer support.", recommendedPoints: 10 },
  { id: "student-led-seminar", name: "Student-Led Seminar", description: "A facilitation prompt that asks students to lead questions, synthesize replies, and connect evidence.", recommendedPoints: 30 }
];

export const DISCUSSION_REVISE_ACTIONS: Array<{ id: DiscussionReviseAction; label: string; description: string }> = [
  { id: "specificity", label: "More specific", description: "Add concrete task, audience, and response expectations." },
  { id: "evidence", label: "Evidence", description: "Require course sources, examples, or case details." },
  { id: "replies", label: "Reply guidance", description: "Make peer response rules substantive and respectful." },
  { id: "rubric", label: "Rubric clarity", description: "Connect discussion quality to grading criteria." },
  { id: "accessibility", label: "Accessibility", description: "Add readable structure, links, media, and tone guidance." },
  { id: "concise", label: "Concise", description: "Add a brief instructor note for tightening the prompt." },
  { id: "scenario", label: "Scenario", description: "Add context, role, decision point, and constraints." }
];

const escapeHtml = (value: string | number | undefined | null): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const paragraph = (value: string): string => `<p>${escapeHtml(value)}</p>`;
const list = (items: string[]): string => `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
const section = (title: string, body: string): string => `<h2>${escapeHtml(title)}</h2>${body}`;

const touchedMetadata = (metadata: ObjectMetadata | undefined, timestamp: string): ObjectMetadata => ({
  createdAt: metadata?.createdAt ?? timestamp,
  updatedAt: timestamp,
  lastExportedAt: metadata?.lastExportedAt,
  exportVersion: metadata?.exportVersion ?? 0,
  source: "edited"
});

const renumberItems = (items: ModuleItem[]): ModuleItem[] => items.map((item, index) => ({ ...item, order: index + 1, status: "edited" }));

const templateById = (templateId: DiscussionTemplateId): DiscussionTemplate => DISCUSSION_TEMPLATES.find((template) => template.id === templateId) ?? DISCUSSION_TEMPLATES[0];

const moduleTitleFor = (course: CourseProject, moduleId?: string): string =>
  course.modules.find((module) => module.id === moduleId)?.title ?? "the current module";

const discussionThemeStyle = (course: CourseProject): string =>
  `border-left: 6px solid ${escapeHtml(course.theme.accent)}; background: ${escapeHtml(course.theme.soft)}; padding: 14px 16px; margin: 16px 0;`;

const outcomeLabels = (outcomes: CourseOutcome[], alignedOutcomeIds: string[]): string[] => {
  const labels = alignedOutcomeIds
    .map((outcomeId) => outcomes.find((outcome) => outcome.id === outcomeId))
    .filter((outcome): outcome is CourseOutcome => Boolean(outcome))
    .map((outcome) => `${outcome.code}: ${outcome.text}`);
  return labels.length ? labels : ["Instructor will align this discussion to appropriate course outcomes before publishing."];
};

const templateDetails: Record<
  DiscussionTemplateId,
  { purpose: string; prompt: string; evidence: string[]; initialPost: string[]; replies: string[]; criteria: string[]; rubric: string; accessibility: string }
> = {
  "evidence-based": {
    purpose: "Practice using course evidence to make a specific claim and move a conversation forward.",
    prompt: "Choose one module concept and explain how it changes your interpretation of a concrete example.",
    evidence: ["Use at least one assigned reading, media example, dataset, case, or class concept.", "Name the evidence and explain why it supports your claim."],
    initialPost: ["Write a focused post of 250-350 words unless your instructor changes the range.", "State a claim, support it with evidence, and end with a discussion question."],
    replies: ["Reply to at least two classmates.", "Extend, question, compare, or respectfully challenge a specific idea."],
    criteria: ["Specific claim.", "Evidence accurately used.", "Substantive peer engagement.", "Clear connection to outcomes."],
    rubric: "Use the discussion rubric to check evidence, specificity, interaction quality, and respectful tone.",
    accessibility: "Use short paragraphs, descriptive links, readable formatting, and plain language where possible."
  },
  "case-response": {
    purpose: "Apply module ideas to a realistic case where context, stakeholders, and consequences matter.",
    prompt: "Analyze the case, identify the central tension, and recommend a next step for the people involved.",
    evidence: ["Use case details plus at least one module concept.", "Distinguish facts, assumptions, and interpretation."],
    initialPost: ["Summarize the case in two sentences.", "Name the decision point, affected stakeholders, evidence, and recommendation."],
    replies: ["Compare your recommendation with a classmate's.", "Add a risk, missing stakeholder, alternative, or clarifying question."],
    criteria: ["Case accuracy.", "Stakeholder awareness.", "Evidence-based recommendation.", "Reply depth."],
    rubric: "Rubric alignment should reward case reasoning, evidence, decision quality, and peer response.",
    accessibility: "Avoid sharing private information. Use names like Person A or Organization B when adapting local cases."
  },
  debate: {
    purpose: "Practice evidence-based disagreement with respectful counterargument and revision.",
    prompt: "Take a position on the debate question and explain what evidence would support or change your view.",
    evidence: ["Use at least one source or module example.", "Acknowledge one counterargument fairly before responding."],
    initialPost: ["State your position clearly.", "Support it with evidence, name a counterargument, and explain your reasoning."],
    replies: ["Respond to two classmates with a respectful challenge or extension.", "Ask what evidence would clarify the disagreement."],
    criteria: ["Clear position.", "Fair counterargument.", "Evidence quality.", "Respectful challenge."],
    rubric: "Rubric alignment should value reasoning, evidence, counterargument, and constructive tone.",
    accessibility: "Separate critique of ideas from critique of people. Use calm wording and avoid sarcasm."
  },
  reflection: {
    purpose: "Connect course ideas to learning, experience, feedback, or future action.",
    prompt: "Identify one idea that changed or complicated your thinking and explain why.",
    evidence: ["Use one course concept, quote, example, activity, or feedback moment.", "Connect the evidence to a specific change in understanding."],
    initialPost: ["Write about a specific moment, not the whole module generally.", "Name what changed, what remains uncertain, and one next step."],
    replies: ["Reply to two classmates with a connection, question, or resource.", "Avoid agreement-only responses."],
    criteria: ["Specific learning moment.", "Concept connection.", "Reflective depth.", "Useful replies."],
    rubric: "Rubric alignment should reward specificity, concept use, reflection, and peer support.",
    accessibility: "Students may keep personal details general and should not disclose private information."
  },
  "peer-feedback": {
    purpose: "Help students improve drafts, ideas, or artifacts through actionable peer feedback.",
    prompt: "Share your current draft or idea and ask for feedback on the part where help would be most useful.",
    evidence: ["Reference the rubric, outcome, or criteria when giving feedback.", "Point to a specific sentence, section, choice, or design feature."],
    initialPost: ["Share the draft, link, summary, or artifact as directed.", "Name two strengths, one question, and one area where you want feedback."],
    replies: ["Give feedback to at least two classmates.", "Use warm, specific, actionable comments."],
    criteria: ["Clear request for feedback.", "Specific peer feedback.", "Rubric-connected advice.", "Respectful tone."],
    rubric: "Rubric alignment should reward usefulness, specificity, and connection to success criteria.",
    accessibility: "Use accessible file formats, descriptive links, and permissions that classmates can open."
  },
  "current-event": {
    purpose: "Connect course concepts to current public examples while practicing source evaluation.",
    prompt: "Select a current event or public example and explain how a module concept helps interpret it.",
    evidence: ["Use one credible current source and one course concept.", "Briefly explain why the current source is credible enough for this discussion."],
    initialPost: ["Summarize the example.", "Apply the concept, cite or name the source, and identify one limitation or uncertainty."],
    replies: ["Compare source quality, concept use, or implications with classmates.", "Ask a question that would improve interpretation."],
    criteria: ["Relevant current example.", "Source evaluation.", "Concept application.", "Thoughtful replies."],
    rubric: "Rubric alignment should reward credible evidence, current relevance, and careful interpretation.",
    accessibility: "Use descriptive link text and avoid linking to inaccessible or paywalled content when alternatives exist."
  },
  "scenario-decision": {
    purpose: "Practice making a reasoned decision in a realistic scenario with tradeoffs.",
    prompt: "You are advising a stakeholder who must choose between imperfect options. Recommend one option and justify it.",
    evidence: ["Use course evidence, scenario constraints, and stakeholder needs.", "Name at least one tradeoff or risk."],
    initialPost: ["Describe the decision point.", "Recommend an action and explain the evidence and tradeoffs behind it."],
    replies: ["Identify a risk, alternative, missing stakeholder, or evidence gap in classmates' decisions.", "Keep replies practical and constructive."],
    criteria: ["Decision clarity.", "Evidence and constraints.", "Tradeoff reasoning.", "Practical peer response."],
    rubric: "Rubric alignment should reward decision quality, evidence, tradeoff analysis, and reply usefulness.",
    accessibility: "Use clear role labels and avoid overly complex scenario wording."
  },
  "role-play": {
    purpose: "Explore how different roles, constraints, and values shape interpretation and decisions.",
    prompt: "Respond from an assigned role and explain how that role would interpret the issue, evidence, and next step.",
    evidence: ["Use role details and at least one course concept.", "Name where the role's priorities create tension or blind spots."],
    initialPost: ["State your role.", "Explain that role's priorities, evidence, recommendation, and one concern."],
    replies: ["Reply from your role to two other roles.", "Look for shared interests, conflicts, or negotiation points."],
    criteria: ["Role consistency.", "Evidence use.", "Perspective-taking.", "Debrief quality."],
    rubric: "Rubric alignment should reward role fidelity, evidence, interaction, and debrief insight.",
    accessibility: "Avoid stereotypes. Roles should represent perspectives, not caricatures."
  },
  "muddiest-point": {
    purpose: "Surface confusion early so students and the instructor can target support.",
    prompt: "Identify the muddiest point from this module and explain what would help clarify it.",
    evidence: ["Reference the exact term, step, reading, example, or activity that created confusion.", "Describe what you tried before posting."],
    initialPost: ["Name the unclear point.", "Explain what you understand so far and what support would help."],
    replies: ["Reply to one or two classmates with a helpful explanation, resource, example, or question.", "Do not guess beyond what you understand."],
    criteria: ["Specific confusion.", "Attempt to explain current understanding.", "Helpful peer support.", "Respectful tone."],
    rubric: "Rubric alignment should reward specificity, help-seeking, and peer support rather than correctness alone.",
    accessibility: "Normalize uncertainty and make help-seeking low stakes."
  },
  "student-led-seminar": {
    purpose: "Invite students to lead discussion, synthesize evidence, and facilitate peer thinking.",
    prompt: "Lead a seminar thread by posing a question, framing evidence, facilitating replies, and closing with synthesis.",
    evidence: ["Use at least two course sources, examples, or concepts.", "Explain why each source matters for the discussion question."],
    initialPost: ["Pose a seminar question.", "Frame the context and evidence.", "Invite classmates into a specific task or comparison."],
    replies: ["Facilitators should respond to classmates by connecting themes and asking follow-up questions.", "Participants should build on evidence and identify patterns."],
    criteria: ["Question quality.", "Evidence framing.", "Facilitation.", "Synthesis."],
    rubric: "Rubric alignment should reward leadership, synthesis, evidence, and peer engagement.",
    accessibility: "Use concise facilitation prompts and summarize threads for students who join asynchronously."
  }
};

export const buildDiscussionTemplateHtml = (templateId: DiscussionTemplateId, course: CourseProject, discussion?: Discussion): string => {
  const template = templateById(templateId);
  const details = templateDetails[template.id];
  const alignedOutcomeIds = discussion?.alignedOutcomeIds.length ? discussion.alignedOutcomeIds : course.outcomes.slice(0, 2).map((outcome) => outcome.id);
  const rubric = discussion?.rubricId ? course.rubrics.find((candidate) => candidate.id === discussion.rubricId) : undefined;
  const title = discussion?.title?.trim() || template.name;
  return [
    `<div style="${discussionThemeStyle(course)}"><h2 style="margin-top: 0;">${escapeHtml(title)}</h2>${paragraph(`This ${template.name.toLowerCase()} belongs in ${moduleTitleFor(course, discussion?.moduleId)}. Confirm local due dates, reply deadlines, and grading policy before publishing.`)}</div>`,
    section("Purpose", paragraph(details.purpose)),
    section("Prompt", paragraph(details.prompt)),
    section("Required Evidence", list(details.evidence)),
    section("Initial Post Instructions", list(details.initialPost)),
    section("Reply Instructions", list(details.replies)),
    section("Quality Criteria", list(details.criteria)),
    section("Rubric Alignment", paragraph(rubric ? `Use the ${rubric.title} rubric. ${details.rubric}` : details.rubric)),
    section("Accessibility-Friendly Structure", paragraph(details.accessibility)),
    section("Outcome Alignment", list(outcomeLabels(course.outcomes, alignedOutcomeIds)))
  ].join("\n");
};

export const reviseDiscussionPrompt = (discussion: Discussion, course: CourseProject, action: DiscussionReviseAction): string => {
  const existing = discussion.promptHtml.trim();
  const snippets: Record<DiscussionReviseAction, string> = {
    specificity: section("Specificity Check", list(["Name the exact concept, case, source, or scenario students should use.", "Ask students to make a claim, support it, and end with a question that invites replies."])),
    evidence: section("Evidence Requirement", list(["Use at least one assigned source, module example, dataset, or case detail.", "Explain why the evidence supports the claim instead of only naming the source."])),
    replies: section("Reply Guidance", list(["Reply to at least two classmates.", "Each reply should extend, question, compare, respectfully challenge, or add evidence to a specific idea.", "Avoid agreement-only replies."])),
    rubric: section("Rubric Clarity", list([`This discussion is worth ${discussion.points} points.`, "Strong posts are specific, evidence-based, respectful, and connected to course outcomes.", "Use the attached rubric when drafting and replying."])),
    accessibility: section("Accessibility and Tone", paragraph("Use short paragraphs, descriptive links, readable formatting, captions or transcripts for media, respectful language, and privacy-aware examples.")),
    concise: section("Instructor Tightening Note", paragraph("Before publishing, remove duplicate instructions, replace local placeholders, and keep the prompt focused on one clear discussion task.")),
    scenario: section("Scenario Context", paragraph(`Imagine you are participating in a real decision connected to ${moduleTitleFor(course, discussion.moduleId)}. Name the stakeholder, decision point, evidence, tradeoff, and recommended next step.`))
  };
  return `${existing}\n${snippets[action]}`;
};

const hrefsFrom = (html: string): string[] => Array.from(html.matchAll(/href\s*=\s*["']([^"']*)["']/gi)).map((match) => match[1].trim());
const anchorTextsFrom = (html: string): string[] =>
  Array.from(html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)).map((match) => stripHtml(match[1]).trim().toLowerCase());
const hasUnsafeHtml = (html: string): boolean =>
  /<script[\s>]/i.test(html) ||
  /\son[a-z]+\s*=/i.test(html) ||
  /javascript\s*:/i.test(html) ||
  /<(iframe|object|embed|form|input|button)[\s>]/i.test(html);

const knownTargetsFor = (course: CourseProject): Set<string> => {
  const targets = new Set<string>();
  course.pages.forEach((page) => {
    const slug = slugify(page.slug || page.title);
    targets.add(`${slug}.html`);
    targets.add(`wiki_content/${slug}.html`);
    if (page.slug) targets.add(`${page.slug}.html`);
  });
  course.fileAssets.forEach((asset) => {
    targets.add(asset.path);
    targets.add(`../${asset.path}`);
    targets.add(asset.fileName);
  });
  return targets;
};

export const validateDiscussionPlan = (course: CourseProject): DiscussionPlanValidation => {
  const issues: DiscussionIssue[] = [];
  const groupIds = new Set(course.assignmentGroups.map((group) => group.id));
  const moduleIds = new Set(course.modules.map((module) => module.id));
  const rubricIds = new Set(course.rubrics.map((rubric) => rubric.id));
  const outcomeIds = new Set(course.outcomes.map((outcome) => outcome.id));
  const discussionItems = course.modules.flatMap((module) => module.items.filter((item) => item.type === "discussion").map((item) => ({ moduleId: module.id, item })));
  const knownTargets = knownTargetsFor(course);

  const add = (discussion: Discussion, id: string, severity: DiscussionIssueSeverity, title: string, detail: string): void => {
    issues.push({ id: `${discussion.id}-${id}`, discussionId: discussion.id, severity, title, detail });
  };

  course.discussions.forEach((discussion) => {
    const text = stripHtml(discussion.promptHtml);
    const matchingItems = discussionItems.filter(({ item }) => item.refId === discussion.id);
    if (!discussion.title.trim()) add(discussion, "title", "error", "Title missing", "Canvas discussions need a clear student-facing title.");
    if (text.length < 220) add(discussion, "prompt-detail", "warning", "Prompt is thin", "Add purpose, prompt, evidence, initial post, replies, quality criteria, and accessibility guidance.");
    if (!/(choose|analyze|explain|compare|respond|reply|identify|recommend|reflect|debate|share|post)/i.test(text)) add(discussion, "specific-work", "warning", "Specific task unclear", "Ask students to do specific work, not just react broadly.");
    if (!/(initial post|first post|post .*words|write .*words|share your|state your)/i.test(text)) add(discussion, "initial-post", "warning", "Initial post expectations unclear", "Clarify what students should post first.");
    if (!/(reply|replies|respond to|classmate|peer)/i.test(text)) add(discussion, "replies", "warning", "Reply expectations unclear", "Clarify how many peer replies are expected and what makes them substantive.");
    if (!/(evidence|source|reading|case|example|data|module concept|course concept)/i.test(text)) add(discussion, "evidence", "warning", "Evidence requirement unclear", "Ask students to use evidence, a course concept, a case, or a concrete example.");
    if (!Number.isFinite(discussion.points) || discussion.points < 0) add(discussion, "points", "error", "Points invalid", "Use zero for ungraded discussions or a positive point value for graded discussions.");
    if (discussion.points > 0 && !groupIds.has(discussion.assignmentGroupId)) add(discussion, "group", "error", "Assignment group missing", "Graded discussions need a valid gradebook group.");
    if (!moduleIds.has(discussion.moduleId)) add(discussion, "module", "error", "Module missing", "Choose a module that exists in the course sequence.");
    if (discussion.points > 0 && course.rubrics.length > 0 && (!discussion.rubricId || !rubricIds.has(discussion.rubricId))) add(discussion, "rubric", "warning", "Rubric not attached", "Attach a rubric or confirm this graded discussion should be reviewed without one.");
    if (discussion.alignedOutcomeIds.length === 0 || discussion.alignedOutcomeIds.some((outcomeId) => !outcomeIds.has(outcomeId))) add(discussion, "outcomes", "warning", "Outcomes not aligned", "Select at least one valid outcome so discussion alignment is visible.");
    if (hasUnsafeHtml(discussion.promptHtml)) add(discussion, "unsafe-html", "error", "Unsafe HTML", "Remove scripts, event handlers, JavaScript links, forms, embeds, or other Canvas-hostile HTML.");
    const weakLinks = anchorTextsFrom(discussion.promptHtml).filter((textValue) => /^(click here|here|link|read more|more)$/i.test(textValue));
    if (weakLinks.length > 0) add(discussion, "link-text", "warning", "Link text is vague", "Use descriptive link text so students and screen readers know where links go.");
    const brokenLinks = hrefsFrom(discussion.promptHtml)
      .filter((href) => href !== "" && href !== "#" && !/^javascript:/i.test(href))
      .filter((href) => !/^https?:\/\//i.test(href) && !/^mailto:/i.test(href) && !href.startsWith("#"))
      .filter((href) => !knownTargets.has(href.replace(/^\.\//, "")));
    if (brokenLinks.length > 0) add(discussion, "broken-links", "warning", "Internal link may not resolve", `Check ${brokenLinks.slice(0, 2).join(", ")} before export.`);
    if (matchingItems.length === 0) add(discussion, "module-item", "error", "Missing from Modules", "Every discussion should appear as a module item so students find it in sequence.");
    else if (matchingItems.some(({ moduleId }) => moduleId !== discussion.moduleId)) add(discussion, "module-mismatch", "error", "Module placement mismatch", "The discussion object and module item location disagree.");
  });

  const summaries = course.discussions.map((discussion) => {
    const discussionIssues = issues.filter((issue) => issue.discussionId === discussion.id);
    return {
      discussionId: discussion.id,
      status: discussionIssues.some((issue) => issue.severity === "error") ? "Needs review" : "Ready",
      issues: discussionIssues
    } satisfies DiscussionSummary;
  });
  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.filter((issue) => issue.severity === "warning").length;
  return {
    score: Math.max(0, Math.round(100 - errors * 9 - warnings * 3)),
    status: errors > 0 ? "Needs review" : "Ready",
    issues,
    summaries
  };
};

const defaultModule = (course: CourseProject): CourseModule | undefined =>
  course.modules.find((module) => module.kind === "content") ?? course.modules.find((module) => module.kind !== "instructor") ?? course.modules[0];
const defaultDiscussionGroupId = (course: CourseProject): string =>
  course.assignmentGroups.find((group) => /discussion|engagement|participation/i.test(group.name))?.id ?? course.assignmentGroups[0]?.id ?? "group_discussions";
const defaultRubricId = (course: CourseProject, outcomes: string[]): string | undefined => {
  const discussionRubric = course.rubrics.find((rubric) => /discussion|engagement|community|seminar/i.test(rubric.title));
  const outcomeRubric = course.rubrics.find((rubric) => rubric.alignedOutcomeIds.some((outcomeId) => outcomes.includes(outcomeId)));
  return discussionRubric?.id ?? outcomeRubric?.id ?? course.rubrics[0]?.id;
};

export const createDiscussion = (
  course: CourseProject,
  options: { templateId?: DiscussionTemplateId; discussionId?: string; timestamp?: string } = {}
): CourseProject => {
  const timestamp = options.timestamp ?? nowIso();
  const template = templateById(options.templateId ?? "evidence-based");
  const module = defaultModule(course);
  if (!module) return course;
  const alignedOutcomeIds = course.outcomes.slice(0, 2).map((outcome) => outcome.id);
  const discussionId = options.discussionId ?? `discussion_${slugify(template.id)}_${Date.now().toString(36)}`;
  const discussion: Discussion = {
    id: discussionId,
    title: `New ${template.name}`,
    promptHtml: "",
    points: template.recommendedPoints,
    moduleId: module.id,
    assignmentGroupId: defaultDiscussionGroupId(course),
    rubricId: defaultRubricId(course, alignedOutcomeIds),
    alignedOutcomeIds,
    publishState: "unpublished",
    status: "edited",
    metadata: touchedMetadata(undefined, timestamp)
  };
  const completeDiscussion = { ...discussion, promptHtml: buildDiscussionTemplateHtml(template.id, course, discussion) };
  const moduleItem: ModuleItem = {
    id: `item_${discussionId}`,
    type: "discussion",
    title: completeDiscussion.title,
    refId: discussionId,
    order: module.items.length + 1,
    indent: 0,
    publishState: "unpublished",
    status: "edited",
    metadata: touchedMetadata(undefined, timestamp)
  };
  return {
    ...course,
    discussions: [...course.discussions, completeDiscussion],
    modules: course.modules.map((entry) =>
      entry.id === module.id ? { ...entry, expanded: true, items: renumberItems([...entry.items, moduleItem]), status: "edited", metadata: touchedMetadata(entry.metadata, timestamp) } : entry
    )
  };
};

export const changeDiscussionModule = (course: CourseProject, discussionId: string, moduleId: string, timestamp = nowIso()): CourseProject => {
  const discussion = course.discussions.find((entry) => entry.id === discussionId);
  const targetModule = course.modules.find((module) => module.id === moduleId);
  if (!discussion || !targetModule) return course;
  const existingItem = course.modules.flatMap((module) => module.items).find((item) => item.type === "discussion" && item.refId === discussionId);
  const moduleItem: ModuleItem = existingItem
    ? { ...existingItem, title: discussion.title, publishState: discussion.publishState, status: "edited", metadata: touchedMetadata(existingItem.metadata, timestamp) }
    : {
        id: `item_${discussionId}`,
        type: "discussion",
        title: discussion.title,
        refId: discussionId,
        order: targetModule.items.length + 1,
        indent: 0,
        publishState: discussion.publishState,
        status: "edited",
        metadata: touchedMetadata(undefined, timestamp)
      };
  return {
    ...course,
    discussions: course.discussions.map((entry) =>
      entry.id === discussionId ? { ...entry, moduleId, status: "edited", metadata: touchedMetadata(entry.metadata, timestamp) } : entry
    ),
    modules: course.modules.map((module) => {
      const withoutDiscussion = module.items.filter((item) => !(item.type === "discussion" && item.refId === discussionId));
      if (module.id !== moduleId) return { ...module, items: renumberItems(withoutDiscussion) };
      return { ...module, expanded: true, items: renumberItems([...withoutDiscussion, moduleItem]), status: "edited", metadata: touchedMetadata(module.metadata, timestamp) };
    }),
    schedule: course.schedule.map((entry) => (entry.itemId === discussionId ? { ...entry, moduleId } : entry))
  };
};

export const renameDiscussionEverywhere = (course: CourseProject, discussionId: string, title: string, timestamp = nowIso()): CourseProject => ({
  ...course,
  discussions: course.discussions.map((discussion) =>
    discussion.id === discussionId ? { ...discussion, title, status: "edited", metadata: touchedMetadata(discussion.metadata, timestamp) } : discussion
  ),
  modules: course.modules.map((module) => ({
    ...module,
    items: module.items.map((item) => (item.type === "discussion" && item.refId === discussionId ? { ...item, title, status: "edited", metadata: touchedMetadata(item.metadata, timestamp) } : item))
  })),
  schedule: course.schedule.map((entry) => (entry.itemId === discussionId ? { ...entry, title } : entry))
});

export const duplicateDiscussion = (course: CourseProject, discussionId: string, options: { stamp?: string | number; timestamp?: string } = {}): CourseProject => {
  const discussion = course.discussions.find((entry) => entry.id === discussionId);
  if (!discussion) return course;
  const stamp = options.stamp ?? Date.now();
  const timestamp = options.timestamp ?? nowIso();
  const copiedDiscussionId = `${discussion.id}_copy_${stamp}`;
  const copy: Discussion = {
    ...discussion,
    id: copiedDiscussionId,
    title: `${discussion.title} Copy`,
    status: "edited",
    metadata: touchedMetadata(discussion.metadata, timestamp)
  };
  const module = course.modules.find((entry) => entry.id === copy.moduleId);
  const moduleItem: ModuleItem | undefined = module
    ? {
        id: `item_${copiedDiscussionId}`,
        type: "discussion",
        title: copy.title,
        refId: copy.id,
        order: module.items.length + 1,
        indent: 0,
        publishState: copy.publishState,
        status: "edited",
        metadata: touchedMetadata(undefined, timestamp)
      }
    : undefined;
  return {
    ...course,
    discussions: [...course.discussions, copy],
    modules: moduleItem
      ? course.modules.map((entry) =>
          entry.id === module?.id ? { ...entry, expanded: true, items: renumberItems([...entry.items, moduleItem]), status: "edited", metadata: touchedMetadata(entry.metadata, timestamp) } : entry
        )
      : course.modules
  };
};

export const deleteDiscussion = (course: CourseProject, discussionId: string): CourseProject => ({
  ...course,
  discussions: course.discussions.filter((discussion) => discussion.id !== discussionId),
  modules: course.modules.map((module) => ({
    ...module,
    items: renumberItems(module.items.filter((item) => !(item.type === "discussion" && item.refId === discussionId)))
  })),
  schedule: course.schedule.filter((entry) => entry.itemId !== discussionId)
});

export const restoreDiscussion = (course: CourseProject, discussion: Discussion, timestamp = nowIso()): CourseProject => {
  const restored = { ...discussion, status: "edited" as const, metadata: touchedMetadata(discussion.metadata, timestamp) };
  const withDiscussion = course.discussions.some((entry) => entry.id === discussion.id)
    ? { ...course, discussions: course.discussions.map((entry) => (entry.id === discussion.id ? restored : entry)) }
    : { ...course, discussions: [...course.discussions, restored] };
  return changeDiscussionModule(withDiscussion, discussion.id, discussion.moduleId, timestamp);
};

export const sanitizeDiscussionHtmlForPreview = (html: string): string =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
    .replace(/href\s*=\s*["']\s*javascript:[^"']*["']/gi, 'href="#"')
    .replace(/<(iframe|object|embed|form|input|button)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<(iframe|object|embed|form|input|button)\b[^>]*>/gi, "");

export const rubricForDiscussion = (course: CourseProject, discussion: Discussion): Rubric | undefined =>
  discussion.rubricId ? course.rubrics.find((rubric) => rubric.id === discussion.rubricId) : undefined;
