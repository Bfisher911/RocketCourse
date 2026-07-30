// ============================================================================
// SHARED DETERMINISTIC MOCK DATA  —  used by ALL eight concept prototypes.
// Course: "The Meaning of Life in 12 Conversations"
// No external services. No AI calls. Pure data. Editing this changes every
// concept at once so comparisons stay honest.
// ============================================================================

export const course = {
  id: "mol-12",
  title: "The Meaning of Life in 12 Conversations",
  subtitle: "A first-year seminar in applied philosophy",
  code: "PHIL 1200",
  institution: "Riverbend University",
  term: "Fall 2026",
  level: "Undergraduate — Introductory",
  modality: "In person, 3 credit hours",
  creditHours: 3,
  weeks: 15,
  status: "generated", // draft | generated | edited | ready | exported
  updatedAt: "2026-07-23T14:12:00",
  description:
    "Across twelve guided conversations, students examine the questions people have always asked about how to live: what makes a life worth living, how to face loss, what we owe one another, and how meaning gets made. Each conversation pairs a short reading with a structured discussion, a reflective writing task, and a low-stakes check for understanding. The course assumes no prior philosophy and rewards careful, generous argument over jargon.",
  // What the AI proposed vs. what the instructor has confirmed.
  aiGenerated: true,
  instructorConfirmed: false,
};

export const sourceFiles = [
  { id: "sf1", name: "PHIL1200_syllabus_draft.docx", kind: "Syllabus", size: "48 KB", note: "Instructor's rough syllabus — parsed for outcomes, policies, schedule." },
  { id: "sf2", name: "reading_list.md", kind: "Reading list", size: "6 KB", note: "12 primary readings + alternates." },
  { id: "sf3", name: "accessibility_statement.pdf", kind: "Policy", size: "22 KB", note: "University standard accommodations language." },
  { id: "sf4", name: "prior_course_export.imscc", kind: "Canvas package", size: "1.2 MB", note: "Last year's Canvas course — imported for structure, not content." },
];

// ---- Assignment groups (gradebook categories) --------------------------------
export const assignmentGroups = [
  { id: "ag-part", name: "Discussion & Participation", weight: 20 },
  { id: "ag-reflect", name: "Weekly Reflections", weight: 25 },
  { id: "ag-essays", name: "Short Essays", weight: 30 },
  { id: "ag-checks", name: "Checks for Understanding", weight: 10 },
  { id: "ag-capstone", name: "Capstone Project", weight: 15 },
];
// NOTE: weights total 100. One readiness note flags that "Checks" at 10% may be
// low relative to the number of quizzes — a *recommended*, non-blocking issue.

// ---- Learning outcomes -------------------------------------------------------
export const outcomes = [
  { id: "o1", code: "CLO 1", text: "Reconstruct a philosophical argument in your own words, identifying its premises and conclusion.", bloom: "Understand", alignedModuleIds: ["m-start", "m1", "m4", "m8"] },
  { id: "o2", code: "CLO 2", text: "Compare competing accounts of a good or meaningful life and weigh their trade-offs.", bloom: "Analyze", alignedModuleIds: ["m2", "m5", "m10", "m12"] },
  { id: "o3", code: "CLO 3", text: "Evaluate an ethical position using at least one systematic framework and one concrete case.", bloom: "Evaluate", alignedModuleIds: ["m4", "m8", "m9"] },
  { id: "o4", code: "CLO 4", text: "Compose a clear, well-supported short essay that advances and defends a thesis.", bloom: "Create", alignedModuleIds: ["m3", "m4", "m7", "m11"] },
  { id: "o5", code: "CLO 5", text: "Reflect on how course ideas reshape your own account of a meaningful life.", bloom: "Evaluate", alignedModuleIds: ["m1", "m6", "m11", "m12"] },
  // o6 has NO aligned modules yet — a real alignment gap surfaced in readiness.
  { id: "o6", code: "CLO 6", text: "Participate in dialogue that treats opposing views charitably and precisely.", bloom: "Apply", alignedModuleIds: [] },
];

// ---- Rubrics -----------------------------------------------------------------
// r-essay-freedom is INTENTIONALLY incomplete: its third criterion has no
// performance levels and 0 points. Task 8 surfaces this; task 10 can resolve it.
export const rubrics = {
  "r-reflection": {
    id: "r-reflection", title: "Weekly Reflection Rubric", points: 10, complete: true,
    criteria: [
      { id: "c1", title: "Engagement with the reading", points: 4, levels: [
        { label: "Exceeds", points: 4, desc: "Cites specific passages and extends them." },
        { label: "Meets", points: 3, desc: "Refers to the reading accurately." },
        { label: "Developing", points: 2, desc: "Vague or partial reference." },
        { label: "Beginning", points: 1, desc: "Little connection to the reading." } ] },
      { id: "c2", title: "Personal reflection", points: 3, levels: [
        { label: "Meets", points: 3, desc: "Connects ideas to lived experience thoughtfully." },
        { label: "Developing", points: 2, desc: "Some connection, lightly developed." },
        { label: "Beginning", points: 1, desc: "Assertion without reflection." } ] },
      { id: "c3", title: "Clarity", points: 3, levels: [
        { label: "Meets", points: 3, desc: "Clear and organized." },
        { label: "Developing", points: 2, desc: "Understandable with effort." },
        { label: "Beginning", points: 1, desc: "Hard to follow." } ] },
    ],
  },
  "r-essay-freedom": {
    id: "r-essay-freedom", title: "Short Essay 2 Rubric — Freedom & Responsibility",
    points: 30, complete: false,
    incompleteReason: "Criterion “Use of evidence” has no performance levels and is worth 0 points.",
    criteria: [
      { id: "c1", title: "Thesis & argument", points: 12, levels: [
        { label: "Exceeds", points: 12, desc: "Original, defensible thesis carried through." },
        { label: "Meets", points: 9, desc: "Clear thesis, mostly supported." },
        { label: "Developing", points: 6, desc: "Thesis present but under-argued." },
        { label: "Beginning", points: 3, desc: "No clear thesis." } ] },
      { id: "c2", title: "Engagement with counterargument", points: 10, levels: [
        { label: "Exceeds", points: 10, desc: "Anticipates and answers the strongest objection." },
        { label: "Meets", points: 7, desc: "Names an objection and responds." },
        { label: "Developing", points: 4, desc: "Mentions objection without response." },
        { label: "Beginning", points: 2, desc: "No counterargument." } ] },
      // INCOMPLETE criterion:
      { id: "c3", title: "Use of evidence", points: 0, levels: [] },
    ],
  },
  "r-capstone": {
    id: "r-capstone", title: "Capstone Rubric", points: 40, complete: true,
    criteria: [
      { id: "c1", title: "Depth of reflection", points: 15, levels: [
        { label: "Exceeds", points: 15, desc: "Synthesizes across many conversations." },
        { label: "Meets", points: 11, desc: "Draws on several conversations." },
        { label: "Developing", points: 7, desc: "Draws on one or two." } ] },
      { id: "c2", title: "Argument & support", points: 15, levels: [
        { label: "Exceeds", points: 15, desc: "Well-defended throughout." },
        { label: "Meets", points: 11, desc: "Generally supported." },
        { label: "Developing", points: 7, desc: "Assertions under-supported." } ] },
      { id: "c3", title: "Craft & clarity", points: 10, levels: [
        { label: "Meets", points: 10, desc: "Polished and clear." },
        { label: "Developing", points: 6, desc: "Rough but readable." } ] },
    ],
  },
};

// ---- Pages, assignments, discussions, quizzes (keyed by id) ------------------
// Module 4 ("Freedom & Responsibility") is fully fleshed because the shared
// comparison tasks focus there. Other modules carry representative items.
export const pages = {
  "p-start-welcome": { id: "p-start-welcome", title: "Welcome to the Conversation", moduleId: "m-start", updatedAt: "2026-07-20",
    body: "<h2>Welcome</h2><p>This course is a set of conversations, not a set of lectures. Each week we sit with one enduring question, read one short piece, and try to say something true and careful about it. You do not need any background in philosophy — only a willingness to think slowly and to take other people's views seriously.</p><p>Start by reading the syllabus, then watch the 3-minute orientation video, then post a one-line introduction in the Start Here discussion.</p>" },
  "p-start-how": { id: "p-start-how", title: "How This Course Works", moduleId: "m-start", updatedAt: "2026-07-20",
    body: "<h2>The weekly rhythm</h2><ul><li><strong>Read</strong> the short primary text (20–30 min).</li><li><strong>Reflect</strong> in a short weekly post (150 words).</li><li><strong>Discuss</strong> with two classmates.</li><li><strong>Check</strong> your understanding with a low-stakes quiz.</li></ul>" },
  "p4-overview": { id: "p4-overview", title: "Conversation 4 — Are We Free?", moduleId: "m4", updatedAt: "2026-07-22",
    body: "<h2>The Big Question</h2><p>When you chose to open this page, was that choice <em>up to you</em> — or was it the inevitable result of everything that came before? This week we sit with the oldest tension in ethics: if our actions are caused, in what sense are we responsible for them?</p><h3>Before you begin</h3><ul><li>Read the excerpt from the reading packet (pp. 3–9).</li><li>Note one moment this week where you felt genuinely free, and one where you did not.</li></ul><p>We are not trying to solve free will in a week. We are trying to get clearer about what we mean, and what follows for how we treat one another.</p>" },
  "p4-reading": { id: "p4-reading", title: "Reading Guide: Compatibilism in Plain Language", moduleId: "m4", updatedAt: "2026-07-22",
    body: "<h2>Reading guide</h2><p>The compatibilist says freedom and determinism can both be true. The trick is what “free” means: not “uncaused,” but “acting from your own reasons without coercion.”</p><p>As you read, track three things: (1) how the author defines freedom, (2) the example they use, (3) the objection they take most seriously.</p>",
    hasImage: true, imageAlt: "Diagram comparing hard determinism, libertarian free will, and compatibilism" },
  "p4-summary": { id: "p4-summary", title: "Where We Landed", moduleId: "m4", updatedAt: "2026-07-22",
    body: "<h2>Recap</h2><p>We did not agree — and that is fine. We did get clearer that “freedom” does more than one job in ordinary speech. Carry that distinction into next week's conversation on love and connection.</p>" },
  "syllabus": { id: "syllabus", title: "Syllabus", moduleId: "m-start", updatedAt: "2026-07-20",
    body: "<h2>Syllabus</h2><p>PHIL 1200 · Fall 2026 · Riverbend University. See the full policy sections in the Syllabus builder. Grading: Participation 20% · Reflections 25% · Essays 30% · Checks 10% · Capstone 15%.</p>" },
  "p9-nature": { id: "p9-nature", title: "Standing in the Anthropocene", moduleId: "m9", updatedAt: "2026-07-21",
    body: "<h2>Our place in nature</h2><p>What do we owe a world we did not make and will not outlast? This conversation reads a short piece on humility toward nature.</p>",
    hasImage: true, imageAlt: "", imageAltMissing: true }, // ACCESSIBILITY WARNING: image missing alt text
};

export const assignments = {
  "a4-essay": {
    id: "a4-essay", title: "Short Essay 2 — Are We Responsible?", moduleId: "m4",
    groupId: "ag-essays", points: 100, estimatedHours: 4, rubricId: "r-essay-freedom",
    alignedOutcomeIds: ["o1", "o3", "o4"], dueAt: "Week 5, Sunday 11:59pm",
    submissionType: "Text entry or file upload",
    instructions: "<p>In 900–1100 words, take a position: are we morally responsible for actions that were, in some sense, caused? Advance one clear thesis, engage the strongest objection to it, and use at least one concrete case (from the reading or your own life). You are graded on the quality of the argument, not on which side you take.</p>",
    needsAttention: "rubric-incomplete",
  },
  "a7-reflection": { id: "a7-reflection", title: "Reflection 7 — When Suffering Doesn't Resolve", moduleId: "m7", groupId: "ag-reflect", points: 10, estimatedHours: 1, rubricId: "r-reflection", alignedOutcomeIds: ["o4", "o5"], dueAt: "Week 8", submissionType: "Text entry", instructions: "<p>Write 150–200 words on a time an idea from this week reframed a difficulty for you.</p>" },
  "a-capstone": { id: "a-capstone", title: "Capstone — My Account of a Meaningful Life", moduleId: "m12", groupId: "ag-capstone", points: 200, estimatedHours: 8, rubricId: "r-capstone", alignedOutcomeIds: ["o2", "o5"], dueAt: "Finals week", submissionType: "File upload", instructions: "<p>Synthesize at least four conversations into your own written account (1500–2000 words) of what makes a life meaningful.</p>" },
};

export const discussions = {
  "d-start-intro": { id: "d-start-intro", title: "Introduce Yourself", moduleId: "m-start", groupId: "ag-part", points: 5, alignedOutcomeIds: ["o6"], prompt: "<p>In one or two sentences: what's a question about how to live that you actually think about?</p>" },
  "d4-free": {
    id: "d4-free", title: "Discussion 4 — A Choice You Couldn't Have Made Otherwise",
    moduleId: "m4", groupId: "ag-part", points: 10, alignedOutcomeIds: ["o1", "o6"],
    prompt: "<p>Describe a recent choice. Then argue both sides: in what sense was it free, and in what sense was it determined? Reply to two classmates, taking their strongest point seriously.</p>",
    replyGuidance: "Reply to at least two peers by Friday; extend or gently challenge, don't just agree.",
    needsAttention: "ai-review", // AI-written prompt an instructor should approve
    aiNote: "Drafted by AI from your syllabus. Review the wording before students see it.",
  },
  "d3-death": { id: "d3-death", title: "Discussion 3 — What Finitude Changes", moduleId: "m3", groupId: "ag-part", points: 10, alignedOutcomeIds: ["o5", "o6"], prompt: "<p>Does knowing life ends make it more meaningful, less, or neither? Stake a claim.</p>" },
};

export const quizzes = {
  "q3-check": {
    id: "q3-check", title: "Check for Understanding 3 — Death & Finitude",
    moduleId: "m3", groupId: "ag-checks", points: 10, alignedOutcomeIds: ["o1"],
    questions: [
      { id: "qq1", type: "multiple_choice", stem: "The reading uses “the deprivation account” to explain why death can be bad. What does it say death deprives us of?", choices: ["Future goods we would otherwise have had", "The memory of past goods", "Our reputation after we die", "Nothing — death is not bad"], correct: 0, verified: true },
      { id: "qq2", type: "true_false", stem: "Epicurus argued we should fear death because we will experience being dead.", choices: ["True", "False"], correct: 1, verified: true },
      { id: "qq3", type: "essay", stem: "In 3–4 sentences, restate the strongest objection to the deprivation account in your own words.", choices: null, correct: null, verified: false, needsAttention: "verify-key",
        aiNote: "AI generated this open-response item and a suggested answer key. Verify the key before publishing." },
    ],
  },
  "q4-check": { id: "q4-check", title: "Check for Understanding 4 — Freedom", moduleId: "m4", groupId: "ag-checks", points: 10, alignedOutcomeIds: ["o1"],
    questions: [
      { id: "qq1", type: "multiple_choice", stem: "Compatibilism claims that freedom is compatible with…", choices: ["Determinism", "Coercion", "Randomness only", "Nothing"], correct: 0, verified: true },
      { id: "qq2", type: "multiple_choice", stem: "For the compatibilist, an action is free when it flows from…", choices: ["An uncaused choice", "Your own reasons, without coercion", "Pure chance", "Someone else's command"], correct: 1, verified: true },
    ],
  },
};

// ---- Modules -----------------------------------------------------------------
// One "Start Here" + twelve conversations. Module 7 has an unusually high
// workload. Module 4 is fully populated for the deep-dive tasks.
export const modules = [
  { id: "m-start", order: 0, kind: "start", title: "Start Here", summary: "Orientation, syllabus, and your first introduction.", workloadHours: 1.5, status: "approved",
    items: [
      { id: "i0a", type: "page", refId: "p-start-welcome", title: "Welcome to the Conversation" },
      { id: "i0b", type: "page", refId: "p-start-how", title: "How This Course Works" },
      { id: "i0c", type: "page", refId: "syllabus", title: "Syllabus" },
      { id: "i0d", type: "discussion", refId: "d-start-intro", title: "Introduce Yourself" },
    ] },
  { id: "m1", order: 1, kind: "content", title: "1 · What Makes a Life Worth Living?", summary: "The course's animating question and how we'll argue about it.", workloadHours: 3.5, status: "approved",
    items: [ { id: "i1a", type: "page", refId: "p1", title: "The Big Question" }, { id: "i1b", type: "discussion", refId: "d1", title: "Your working answer" }, { id: "i1c", type: "assignment", refId: "a1", title: "Reflection 1" } ] },
  { id: "m2", order: 2, kind: "content", title: "2 · Happiness and the Good Life", summary: "Hedonism, desire-satisfaction, and objective-list theories.", workloadHours: 4, status: "approved",
    items: [ { id: "i2a", type: "page", refId: "p2", title: "Three theories of happiness" }, { id: "i2b", type: "quiz", refId: "q2", title: "Check 2" }, { id: "i2c", type: "assignment", refId: "a2", title: "Reflection 2" } ] },
  { id: "m3", order: 3, kind: "content", title: "3 · Death and Finitude", summary: "Does mortality make life meaningful, or empty it out?", workloadHours: 4, status: "needs-review",
    items: [ { id: "i3a", type: "page", refId: "p3", title: "The deprivation account" }, { id: "i3b", type: "discussion", refId: "d3-death", title: "What finitude changes" }, { id: "i3c", type: "quiz", refId: "q3-check", title: "Check 3", needsAttention: "verify-key" } ] },
  { id: "m4", order: 4, kind: "content", title: "4 · Freedom and Responsibility", summary: "If our choices are caused, in what sense are we responsible?", workloadHours: 4.5, status: "needs-review",
    items: [
      { id: "i4a", type: "page", refId: "p4-overview", title: "Are We Free?" },
      { id: "i4b", type: "page", refId: "p4-reading", title: "Reading Guide: Compatibilism" },
      { id: "i4c", type: "discussion", refId: "d4-free", title: "A Choice You Couldn't Have Made Otherwise", needsAttention: "ai-review" },
      { id: "i4d", type: "assignment", refId: "a4-essay", title: "Short Essay 2 — Are We Responsible?", needsAttention: "rubric-incomplete" },
      { id: "i4e", type: "quiz", refId: "q4-check", title: "Check 4" },
      { id: "i4f", type: "page", refId: "p4-summary", title: "Where We Landed" },
    ] },
  { id: "m5", order: 5, kind: "content", title: "5 · Love and Connection", summary: "What kind of good is love, and what does it ask of us?", workloadHours: 3.5, status: "approved",
    items: [ { id: "i5a", type: "page", refId: "p5", title: "Kinds of love" }, { id: "i5b", type: "discussion", refId: "d5", title: "Love as attention" } ] },
  { id: "m6", order: 6, kind: "content", title: "6 · Work, Craft, and Vocation", summary: "When is work a burden, and when is it a calling?", workloadHours: 3.5, status: "approved",
    items: [ { id: "i6a", type: "page", refId: "p6", title: "Job, career, calling" }, { id: "i6b", type: "assignment", refId: "a6", title: "Reflection 6" } ] },
  { id: "m7", order: 7, kind: "content", title: "7 · Suffering and Resilience", summary: "Making sense of pain that doesn't resolve neatly.", workloadHours: 9.5, status: "workload-high",
    items: [ { id: "i7a", type: "page", refId: "p7a", title: "Two responses to suffering" }, { id: "i7b", type: "page", refId: "p7b", title: "Case studies (long)" }, { id: "i7c", type: "discussion", refId: "d7", title: "Reframing" }, { id: "i7d", type: "assignment", refId: "a7-reflection", title: "Reflection 7" }, { id: "i7e", type: "quiz", refId: "q7", title: "Check 7" }, { id: "i7f", type: "assignment", refId: "a7b", title: "Extended essay (draft)" } ] },
  { id: "m8", order: 8, kind: "content", title: "8 · Justice and the Common Good", summary: "What we owe each other, and how to decide fairly.", workloadHours: 4, status: "approved",
    items: [ { id: "i8a", type: "page", refId: "p8", title: "Two theories of justice" }, { id: "i8b", type: "discussion", refId: "d8", title: "A fair rule" } ] },
  { id: "m9", order: 9, kind: "content", title: "9 · Nature and Our Place in It", summary: "Our obligations to a world we didn't make.", workloadHours: 3.5, status: "needs-review",
    items: [ { id: "i9a", type: "page", refId: "p9-nature", title: "Standing in the Anthropocene", needsAttention: "alt-text" }, { id: "i9b", type: "discussion", refId: "d9", title: "What we owe nature" } ] },
  { id: "m10", order: 10, kind: "content", title: "10 · Art, Beauty, and Meaning", summary: "How aesthetic experience makes and marks meaning.", workloadHours: 3.5, status: "approved",
    items: [ { id: "i10a", type: "page", refId: "p10", title: "Why beauty moves us" }, { id: "i10b", type: "assignment", refId: "a10", title: "Reflection 10" } ] },
  { id: "m11", order: 11, kind: "content", title: "11 · Faith, Doubt, and Transcendence", summary: "Meaning at the edges of what we can know.", workloadHours: 4, status: "approved",
    items: [ { id: "i11a", type: "page", refId: "p11", title: "Belief and doubt" }, { id: "i11b", type: "assignment", refId: "a11", title: "Short Essay 3" } ] },
  { id: "m12", order: 12, kind: "final", title: "12 · Creating Your Own Meaning", summary: "Synthesis, and the capstone project.", workloadHours: 6, status: "approved",
    items: [ { id: "i12a", type: "page", refId: "p12", title: "Bringing it together" }, { id: "i12b", type: "assignment", refId: "a-capstone", title: "Capstone Project" } ] },
];

// ---- Homepage ----------------------------------------------------------------
export const homepage = {
  mode: "builder", template: "Guided Path",
  hero: { eyebrow: "PHIL 1200 · Fall 2026", title: "The Meaning of Life in 12 Conversations", tagline: "Twelve enduring questions. One careful conversation at a time." },
  welcome: "Welcome. This course is a set of guided conversations about how to live. Start with the orientation, then move through one conversation each week.",
  buttons: [ { label: "Start Here", target: "m-start" }, { label: "Syllabus", target: "syllabus" }, { label: "This Week", target: "m4" } ],
  pathItems: modules.filter(m => m.kind !== "start").slice(0, 4).map(m => ({ title: m.title, summary: m.summary })),
};

// ---- Syllabus ----------------------------------------------------------------
export const syllabus = {
  mode: "builder",
  sections: [
    { id: "s-desc", title: "Course Description", body: course.description, complete: true },
    { id: "s-outcomes", title: "Learning Outcomes", body: "Six course learning outcomes (see Outcomes).", complete: true },
    { id: "s-grading", title: "Grading Breakdown", body: "Participation 20% · Reflections 25% · Essays 30% · Checks 10% · Capstone 15%.", complete: true },
    { id: "s-late", title: "Late Work Policy", body: "Reflections may be submitted up to 48 hours late for partial credit.", complete: true },
    { id: "s-integrity", title: "Academic Integrity", body: "", complete: false, note: "Empty — pulled from your source doc but not confirmed." },
    { id: "s-ai", title: "AI Use Policy", body: "", complete: false, note: "Not set. Recommended for a writing-heavy course." },
    { id: "s-access", title: "Accessibility & Accommodations", body: "Standard university accommodations statement.", complete: true },
  ],
};

// ---- Contact hours (Carnegie model) -----------------------------------------
export const contactHours = {
  creditHours: 3, requiredTotal: 135, // 45 hrs per credit over the term
  categories: [
    { label: "Direct instruction (class meetings)", hours: 45 },
    { label: "Reading", hours: 34 },
    { label: "Reflective writing", hours: 18 },
    { label: "Discussion (async)", hours: 12 },
    { label: "Essays & capstone", hours: 20 },
    { label: "Checks for understanding", hours: 4 },
  ],
  get plannedTotal() { return this.categories.reduce((s, c) => s + c.hours, 0); }, // 133
  note: "Planned time is 133 of 135 expected hours — within tolerance. Module 7 alone carries 9.5 student hours, well above the 3.5–4.5 hr norm; consider splitting it.",
};

// ---- Theme -------------------------------------------------------------------
export const theme = {
  id: "seminar-slate", name: "Seminar Slate",
  palette: { bg: "#1b2430", ink: "#f4f6fb", accent: "#e0a458", accent2: "#7fb0b2" },
  contrastNote: "The amber accent on the slate header passes AA for large text but not for small body text. One recommended fix.",
  contrastPass: "partial",
};

// ---- Accessibility review ----------------------------------------------------
export const accessibility = {
  tier: "WCAG 2.1 AA",
  issues: [
    { id: "acc1", severity: "warning", where: "Module 9 · Standing in the Anthropocene", what: "Image is missing alternative text.", fix: "Add a short description of the image.", resolvable: true, refKind: "alt-text" },
    { id: "acc2", severity: "warning", where: "Theme · Seminar Slate", what: "Amber-on-slate body text is below the AA contrast ratio (3.9:1; needs 4.5:1).", fix: "Darken the header or use the accent only for large text.", resolvable: true, refKind: "contrast" },
    { id: "acc3", severity: "pass", where: "All pages", what: "Heading order is well-formed; no skipped levels.", fix: null, resolvable: false },
  ],
};

// ---- Human review queue (items the AI flagged for a human) -------------------
export const reviewQueue = [
  { id: "rev1", kind: "discussion", refId: "d4-free", moduleId: "m4", priority: "must",
    title: "Approve AI-drafted discussion prompt (Module 4)",
    detail: "The AI wrote the Module 4 discussion prompt from your syllabus. Read it and approve or edit before students see it.", action: "Review prompt" },
  { id: "rev2", kind: "quiz", refId: "q3-check", moduleId: "m3", priority: "must",
    title: "Verify answer key for an AI-written question (Module 3)",
    detail: "An open-response quiz item has an AI-suggested answer key. Answer keys must be verified by a human.", action: "Verify key" },
  { id: "rev3", kind: "rubric", refId: "r-essay-freedom", moduleId: "m4", priority: "must",
    title: "Finish the Short Essay 2 rubric (Module 4)",
    detail: "The “Use of evidence” criterion has no performance levels and is worth 0 points.", action: "Complete rubric" },
  { id: "rev4", kind: "workload", refId: "m7", moduleId: "m7", priority: "recommended",
    title: "Rebalance Module 7 workload",
    detail: "Module 7 asks ~9.5 student hours — more than double the course norm. Consider splitting it across two weeks.", action: "Open Module 7" },
  { id: "rev5", kind: "accessibility", refId: "p9-nature", moduleId: "m9", priority: "recommended",
    title: "Add alt text to a Module 9 image", detail: "One image has no alternative text.", action: "Add alt text" },
];

// ---- Readiness -----------------------------------------------------------------
// Blockers must be cleared before a confident export; warnings are advisory.
export const readiness = {
  score: 78,
  status: "Review", // Ready | Review | Blocked
  blockers: [
    { id: "b1", label: "1 quiz answer key is unverified", where: "Module 3 · Check 3", refId: "q3-check", resolvable: true, help: "Open the quiz, read the AI-suggested key, and mark it verified." },
    { id: "b2", label: "1 rubric is incomplete", where: "Module 4 · Short Essay 2", refId: "r-essay-freedom", resolvable: true, help: "Add performance levels and points to the “Use of evidence” criterion." },
  ],
  warnings: [
    { id: "w1", label: "1 image is missing alt text", where: "Module 9 · Standing in the Anthropocene", refId: "p9-nature", resolvable: true, help: "Add a short description so screen readers can convey the image." },
    { id: "w2", label: "Module 7 workload is unusually high", where: "Module 7 · 9.5 student hours", refId: "m7", resolvable: false, help: "Consider splitting Module 7 across two weeks." },
    { id: "w3", label: "Outcome CLO 6 is not aligned to any module", where: "Outcomes", refId: "o6", resolvable: true, help: "Align CLO 6 to at least one module, or remove it." },
    { id: "w4", label: "1 AI-drafted discussion prompt is unreviewed", where: "Module 4 · Discussion 4", refId: "d4-free", resolvable: true, help: "Read and approve the prompt wording." },
    { id: "w5", label: "2 syllabus sections are empty", where: "Syllabus · Academic Integrity, AI Use", refId: "syllabus", resolvable: true, help: "Add or confirm the two empty policy sections." },
  ],
  // 12 named quality categories (mirrors production courseQuality)
  quality: [
    { label: "Completeness", score: 88 }, { label: "Accessibility", score: 72 },
    { label: "Outcome alignment", score: 74 }, { label: "Workload balance", score: 66 },
    { label: "Assessment variety", score: 90 }, { label: "Instructor readiness", score: 70 },
    { label: "Student clarity", score: 86 }, { label: "Canvas compatibility", score: 95 },
    { label: "Syllabus quality", score: 68 }, { label: "Rubric quality", score: 64 },
    { label: "Module learning path", score: 82 }, { label: "Export readiness", score: 76 },
  ],
};

// ---- Export ------------------------------------------------------------------
export const exportStatus = {
  packageName: "meaning-of-life-12.imscc",
  format: "Canvas-oriented Common Cartridge (.imscc)",
  fullContentGenerated: false, // "Generate full content" step not yet run
  lastValidated: null,
  sandboxImportStatus: "not_tested", // honest: import is NOT verified
  contents: [
    { label: "Modules", count: 13 }, { label: "Pages", count: 22 }, { label: "Assignments", count: 9 },
    { label: "Discussions", count: 8 }, { label: "Quizzes", count: 6 }, { label: "Rubrics", count: 3 },
    { label: "Outcomes", count: 6 }, { label: "Files", count: 4 },
  ],
  note: "Local validation checks structure and links. It does not prove the package imports cleanly into Canvas — that is marked “not verified” until you test it in a sandbox.",
};

// Convenience lookups -----------------------------------------------------------
export function moduleById(id) { return modules.find(m => m.id === id); }
export function itemContent(item) {
  if (!item) return null;
  if (item.type === "page") return pages[item.refId];
  if (item.type === "assignment") return assignments[item.refId];
  if (item.type === "discussion") return discussions[item.refId];
  if (item.type === "quiz") return quizzes[item.refId];
  return null;
}
export function rubricById(id) { return rubrics[id]; }

export const CAPABILITY_COUNT = 16; // editor surfaces preserved across all concepts
