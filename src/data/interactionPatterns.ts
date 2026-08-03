// ============================================================================
// Canvas interaction pattern registry
// ----------------------------------------------------------------------------
// The typed registry for the 113 patterns in the RocketCourse Canvas Interactive
// Pattern Library (docs/RocketCourse_Canvas_Interactive_Pattern_Library.pdf,
// July 2026 edition). Every pattern keeps its library number, name, tier, and
// intent, but rendering is shared across a small set of template shapes so the
// system stays maintainable — see services/interactionRender.ts.
//
// Tiers:
//   native  — Canvas-safe HTML (details/summary, cards, tables, media, links).
//   iframe  — needs an external HTTPS host. RocketCourse has no hosted
//             interactive service yet, so these patterns always render their
//             native fallback until an external interactive is configured;
//             the export validator continues to treat raw iframes as unsafe.
//
// The graded/companion concept (a persistent score needs a Canvas quiz/LTI) is
// carried by the `supportsGrading` flag on the relevant iframe patterns — their
// page-side companion is the native `fallbackPatternId` — not by a separate tier.
// ============================================================================

export type InteractionTier = "native" | "iframe";

export type InteractionCategory =
  | "structure"      // Disclosure, Structure, and Navigation (1-22)
  | "practice"       // Practice, Reveal, and Knowledge Checking (23-38)
  | "planning"       // Planning, Analysis, and Decision Support (39-60)
  | "media"          // Visual, Media, and Module Experiences (61-73)
  | "expansion";     // Forty New Additions (74-113)

/** Where a pattern is instructionally appropriate. Mirrors the density guardrails. */
export type InteractionPageType =
  | "homepage"
  | "orientation"
  | "module-overview"
  | "content"
  | "practice"
  | "assignment"
  | "discussion"
  | "quiz-prep"
  | "recap"
  | "syllabus"
  | "milestone";

/** Broad discipline tags used by the selection engine. "all" fits every course. */
export type InteractionDiscipline =
  | "all"
  | "humanities"
  | "stem"
  | "geography"
  | "business"
  | "health"
  | "social-science"
  | "writing"
  | "data";

export type InteractionTemplate =
  | "reveal-panels"    // h3 + optional intro + expandable details panels
  | "steps-reveal"     // numbered stages + optional "show details" reveal
  | "prompt-list"      // labelled prompt list + optional model-review reveal
  | "checklist"        // visible checklist with persistence note
  | "card-link-grid"   // grid of linked cards (real Canvas destinations only)
  | "callout"          // bordered emphasis panel (policy, before-you-begin, read time)
  | "scenario"         // situation + stakeholders + question reveal
  | "options-reveal"   // enumerated options + recommended-action reveal
  | "flaw-repair"      // flawed example blockquote + diagnosis reveal
  | "matrix-table"     // accessible table + synthesis prompt
  | "timeline"         // dated expandable milestones
  | "flip-card"        // single centered reveal
  | "media-audio"      // audio + transcript reveal (requires audio asset)
  | "media-video"      // video + captions + transcript reveal (requires video asset)
  | "figure-panel"     // figure/image + guided reading of the visual (requires image)
  | "gallery"          // captioned image grid (requires images)
  | "image-map"        // clickable image map + text equivalent (requires image)
  | "instructor-panel" // instructor info card (requires instructor details/photo)
  | "iframe-embed";    // external HTTPS interactive (gated; falls back to native)

export interface InteractionPatternDef {
  /** Stable kebab-case id, unique across the registry. */
  id: string;
  /** The pattern's number in the PDF library (1-113). */
  number: number;
  name: string;
  category: InteractionCategory;
  tier: InteractionTier;
  template: InteractionTemplate;
  /** "Best use" line from the library. */
  bestUse: string;
  /** "Generation guidance" line from the library — drives content generation. */
  guidance: string;
  /** Instructional purposes served (used for scoring). */
  purposes: string[];
  /** Page types where auto-selection may place this pattern. Empty = editor-only. */
  pageTypes: InteractionPageType[];
  /** Disciplines where the pattern is meaningful. */
  disciplines: InteractionDiscipline[];
  /** 1 = simple structure, 2 = multi-part, 3 = specialized/complex. */
  complexity: 1 | 2 | 3;
  /** How often the selector may reach for it. */
  frequency: "frequent" | "selective" | "rare";
  /** Assets that must exist before the pattern can render honestly. */
  requiredAssets: Array<"image" | "audio" | "video" | "external-url" | "instructor-info">;
  /** True when a graded result needs Canvas quizzes or LTI — never a plain iframe. */
  supportsGrading: boolean;
  requiresExternalHosting: boolean;
  /** Native pattern rendered when an iframe pattern has no configured host. */
  fallbackPatternId?: string;
  /** Accessibility notes surfaced in the editor. */
  accessibilityNotes: string;
}

const A11Y_DISCLOSURE =
  "Details/summary panels are keyboard-operable natively. Keep summary labels descriptive and heading order logical.";
const A11Y_TABLE = "Table uses th scope headers; keep the wrapping div scrollable so mobile never clips columns.";
const A11Y_LINKS = "Every card must link to a real Canvas destination with meaningful link text — no dead '#' links.";
const A11Y_IFRAME =
  "Descriptive iframe title, responsive container, text alternative, and an open-in-new-window link are required. Scores cannot pass back through a plain iframe.";

interface DefInput {
  n: number;
  id: string;
  name: string;
  cat: InteractionCategory;
  tpl: InteractionTemplate;
  best: string;
  guide: string;
  purposes: string[];
  pages?: InteractionPageType[];
  disc?: InteractionDiscipline[];
  cx?: 1 | 2 | 3;
  freq?: "frequent" | "selective" | "rare";
  assets?: Array<"image" | "audio" | "video" | "external-url" | "instructor-info">;
  tier?: InteractionTier;
  grading?: boolean;
  fallback?: string;
  a11y?: string;
}

const def = (input: DefInput): InteractionPatternDef => {
  const tier = input.tier ?? (input.tpl === "iframe-embed" ? "iframe" : "native");
  return {
    id: input.id,
    number: input.n,
    name: input.name,
    category: input.cat,
    tier,
    template: input.tpl,
    bestUse: input.best,
    guidance: input.guide,
    purposes: input.purposes,
    pageTypes: input.pages ?? [],
    disciplines: input.disc ?? ["all"],
    complexity: input.cx ?? (input.tpl === "iframe-embed" ? 3 : 2),
    frequency: input.freq ?? "selective",
    requiredAssets: input.assets ?? (tier === "iframe" ? ["external-url"] : []),
    supportsGrading: input.grading ?? false,
    requiresExternalHosting: tier === "iframe",
    fallbackPatternId: input.fallback,
    accessibilityNotes:
      input.a11y ??
      (input.tpl === "iframe-embed" ? A11Y_IFRAME : input.tpl === "matrix-table" ? A11Y_TABLE : input.tpl === "card-link-grid" ? A11Y_LINKS : A11Y_DISCLOSURE)
  };
};

export const INTERACTION_PATTERNS: InteractionPatternDef[] = [
  // ── Disclosure, Structure, and Navigation (1-22) ──────────────────────────
  def({ n: 1, id: "standard-accordion", name: "Standard Accordion", cat: "structure", tpl: "reveal-panels", best: "Reveal optional or secondary content without overwhelming the page.", guide: "Place a short overview, expectations, or supporting explanation inside the expandable panel.", purposes: ["orientation", "clarity"], pages: ["content", "orientation", "module-overview"], freq: "frequent", cx: 1 }),
  def({ n: 2, id: "nested-accordion", name: "Nested Accordion", cat: "structure", tpl: "reveal-panels", best: "Organize a large topic into expandable sections and sub-sections.", guide: "Use nested panels for objectives, examples, evidence, and resources.", purposes: ["orientation", "clarity"], pages: ["content"], cx: 2 }),
  def({ n: 3, id: "faq-accordion", name: "FAQ Accordion", cat: "structure", tpl: "reveal-panels", best: "Answer common student questions in a compact format.", guide: "Replace the sample questions with course-specific questions.", purposes: ["support", "clarity"], pages: ["orientation", "assignment", "homepage", "syllabus"], freq: "frequent", cx: 1 }),
  def({ n: 4, id: "vocabulary-accordion", name: "Vocabulary Accordion", cat: "structure", tpl: "reveal-panels", best: "Let students reveal definitions, examples, and nonexamples.", guide: "Add a definition, example, and common misconception.", purposes: ["comprehension", "practice"], pages: ["content"], freq: "frequent", cx: 1 }),
  def({ n: 5, id: "optional-reading-accordion", name: "Optional Reading Accordion", cat: "structure", tpl: "reveal-panels", best: "Keep enrichment readings available without crowding required content.", guide: "Explain why the resource is useful and how long it may take.", purposes: ["enrichment"], pages: ["content"], cx: 1 }),
  def({ n: 6, id: "step-by-step-accordion", name: "Step-by-Step Accordion", cat: "structure", tpl: "reveal-panels", best: "Break a procedure into manageable stages.", guide: "Use one expandable panel per step and number them in order.", purposes: ["procedure", "clarity"], pages: ["content", "practice", "assignment"], freq: "frequent", cx: 1 }),
  def({ n: 7, id: "tab-like-content-panels", name: "Tab-Like Content Panels", cat: "structure", tpl: "reveal-panels", best: "Create a reliable, script-free alternative to true tabs.", guide: "Each summary behaves like a tab label, while the content remains keyboard accessible.", purposes: ["orientation"], pages: ["module-overview", "content"], cx: 2 }),
  def({ n: 8, id: "read-time-indicator", name: "Read-Time Indicator", cat: "structure", tpl: "callout", best: "Set expectations for how long a page or activity may take.", guide: "State the estimated minutes to read and respond.", purposes: ["pacing"], pages: ["content", "practice"], freq: "frequent", cx: 1 }),
  def({ n: 9, id: "learning-objectives-card", name: "Learning Objectives Card", cat: "structure", tpl: "callout", best: "Make objectives visible and easier to scan.", guide: "Use observable verbs and connect objectives to the assessment.", purposes: ["orientation", "alignment"], pages: ["module-overview", "content"], freq: "frequent", cx: 1 }),
  def({ n: 10, id: "policy-box", name: "Policy Box", cat: "structure", tpl: "callout", best: "Call attention to a policy, deadline rule, or participation expectation.", guide: "State the policy in plain language and link to the full policy when needed.", purposes: ["policy", "clarity"], pages: ["assignment", "orientation", "syllabus"], freq: "frequent", cx: 1 }),
  def({ n: 11, id: "instructor-information-panel", name: "Instructor Information Panel", cat: "structure", tpl: "instructor-panel", best: "Present instructor contact details, response times, and office hours.", guide: "Add a professional photo, contact method, office hours, and response expectations.", purposes: ["support"], pages: [], assets: ["instructor-info"], cx: 1 }),
  def({ n: 12, id: "action-item-checklist", name: "Action-Item Checklist", cat: "structure", tpl: "checklist", best: "Give students a visible sequence of tasks to complete.", guide: "Checkbox symbols provide a visual checklist, but completion may not persist after refresh.", purposes: ["procedure", "pacing"], pages: ["module-overview", "practice", "assignment"], freq: "frequent", cx: 1 }),
  def({ n: 13, id: "before-you-begin-panel", name: "Before-You-Begin Panel", cat: "structure", tpl: "callout", best: "Surface prerequisites, materials, and setup requirements before an activity.", guide: "List required files, technology, readings, and prior knowledge.", purposes: ["preparation"], pages: ["content", "practice", "assignment"], freq: "frequent", cx: 1 }),
  def({ n: 14, id: "scenario-card", name: "Scenario Card", cat: "structure", tpl: "scenario", best: "Present a short situation that frames a discussion or decision.", guide: "Introduce the setting, stakeholders, tension, and decision point.", purposes: ["application", "discussion"], pages: ["discussion", "content"], cx: 2 }),
  def({ n: 15, id: "expandable-timeline", name: "Expandable Timeline", cat: "structure", tpl: "timeline", best: "Present events in sequence while keeping explanations compact.", guide: "Use one expandable event per date or milestone.", purposes: ["sequence", "comprehension"], pages: ["content"], disc: ["humanities", "social-science", "business", "health"], cx: 2 }),
  def({ n: 16, id: "responsive-card-grid", name: "Responsive Card Grid", cat: "structure", tpl: "card-link-grid", best: "Create a visual menu of modules, topics, resources, or tasks.", guide: "Replace links and labels with actual Canvas destinations.", purposes: ["navigation"], pages: ["module-overview", "homepage"], freq: "frequent", cx: 1 }),
  def({ n: 17, id: "clickable-image-map", name: "Clickable Image Map", cat: "structure", tpl: "image-map", best: "Explore regions of an image, rendered as an accessible labelled figure with a text-equivalent region list (coordinate hotspots aren't Canvas-reliable, so the export uses the accessible companion form).", guide: "Provide the image, descriptive alt text, and a labelled description of each region and where it leads.", purposes: ["navigation", "visual"], pages: [], assets: ["image"], cx: 3, freq: "rare" }),
  def({ n: 18, id: "basic-audio-player", name: "Basic Audio Player", cat: "structure", tpl: "media-audio", best: "Embed an audio clip directly on the page.", guide: "Provide a transcript and a short listening purpose.", purposes: ["media"], pages: [], assets: ["audio"], cx: 1 }),
  def({ n: 19, id: "basic-video-player", name: "Basic Video Player", cat: "structure", tpl: "media-video", best: "Embed a video file directly on the page.", guide: "Provide captions, a transcript, and a clear viewing purpose.", purposes: ["media"], pages: [], assets: ["video"], cx: 1 }),
  def({ n: 20, id: "responsive-external-interactive", name: "Responsive External Interactive", cat: "structure", tpl: "iframe-embed", best: "Embed a custom interactive hosted on an HTTPS website.", guide: "Replace the source URL and confirm the external site permits iframe display.", purposes: ["interactive"], fallback: "responsive-card-grid" }),
  def({ n: 21, id: "h5p-activity-embed", name: "H5P Activity Embed", cat: "structure", tpl: "iframe-embed", best: "Embed an H5P activity such as branching, hotspots, or drag-and-drop.", guide: "Use the institution-approved H5P embed URL and test it in Canvas Student View.", purposes: ["interactive", "practice"], fallback: "click-to-reveal-answer" }),
  def({ n: 22, id: "optional-extension-menu", name: "Optional Extension Menu", cat: "structure", tpl: "card-link-grid", best: "Offer enrichment choices for students who want to go deeper.", guide: "Provide two or three optional pathways with estimated time and purpose.", purposes: ["enrichment", "differentiation"], pages: ["content", "recap"], cx: 1 }),

  // ── Practice, Reveal, and Knowledge Checking (23-38) ──────────────────────
  def({ n: 23, id: "click-to-reveal-answer", name: "Click-to-Reveal Answer", cat: "practice", tpl: "reveal-panels", best: "Ask students to think before revealing an answer or explanation.", guide: "Place the model response inside the expandable section.", purposes: ["practice", "retrieval"], pages: ["practice", "content", "quiz-prep"], freq: "frequent", cx: 1 }),
  def({ n: 24, id: "nested-learning-paths", name: "Nested Learning Paths", cat: "practice", tpl: "reveal-panels", best: "Offer beginner, intermediate, and advanced pathways.", guide: "Each pathway should have a purpose, estimated time, and clear next step.", purposes: ["differentiation"], pages: ["practice", "content"], cx: 2 }),
  def({ n: 25, id: "interactive-study-checklist", name: "Interactive Study Checklist", cat: "practice", tpl: "checklist", best: "Help students prepare for an assessment or class session.", guide: "Organize tasks by priority or sequence.", purposes: ["preparation", "pacing"], pages: ["quiz-prep", "recap"], freq: "frequent", cx: 1 }),
  def({ n: 26, id: "flashcard-stack", name: "Flashcard Stack", cat: "practice", tpl: "reveal-panels", best: "Let students reveal definitions, examples, or answers one card at a time.", guide: "Use one details element per term or question.", purposes: ["retrieval", "practice"], pages: ["quiz-prep", "practice"], cx: 1 }),
  def({ n: 27, id: "choose-your-own-path-scenario", name: "Choose-Your-Own-Path Scenario", cat: "practice", tpl: "iframe-embed", best: "Create branching choices with different outcomes.", guide: "Use an external app or LTI when choices must be tracked or scored.", purposes: ["application", "interactive"], grading: false, fallback: "what-would-you-do-next" }),
  def({ n: 28, id: "image-hotspot-explorer", name: "Image Hotspot Explorer", cat: "practice", tpl: "iframe-embed", best: "Let students select areas of an image to reveal information.", guide: "Use an accessible hotspot tool with a text-based alternative.", purposes: ["visual", "interactive"], fallback: "map-legend-decoder" }),
  def({ n: 29, id: "self-check-knowledge-questions", name: "Self-Check Knowledge Questions", cat: "practice", tpl: "iframe-embed", best: "Provide immediate feedback on practice questions.", guide: "Use a Canvas quiz or LTI for persistent scores; use an iframe for ungraded practice.", purposes: ["practice", "retrieval"], tier: "iframe", grading: true, fallback: "click-to-reveal-answer" }),
  def({ n: 30, id: "expandable-process-map", name: "Expandable Process Map", cat: "practice", tpl: "steps-reveal", best: "Explain a workflow or process one stage at a time.", guide: "Include the purpose, action, and output for each stage.", purposes: ["procedure", "comprehension"], pages: ["content", "practice"], freq: "frequent", cx: 1 }),
  def({ n: 31, id: "before-and-after-comparison", name: "Before-and-After Comparison", cat: "practice", tpl: "figure-panel", best: "Compare two versions of an image, document, design, or response.", guide: "Explain what changed and why the revision is stronger.", purposes: ["analysis", "revision"], pages: [], assets: ["image"], cx: 2 }),
  def({ n: 32, id: "expandable-case-file", name: "Expandable Case File", cat: "practice", tpl: "reveal-panels", best: "Organize a case into evidence, interviews, records, and findings.", guide: "Reveal evidence in a deliberate sequence to support inquiry.", purposes: ["analysis", "application"], pages: ["content", "discussion"], disc: ["business", "health", "social-science", "humanities"], cx: 2 }),
  def({ n: 33, id: "prediction-before-reveal", name: "Prediction Before Reveal", cat: "practice", tpl: "reveal-panels", best: "Ask students to predict an outcome before viewing what happened.", guide: "Add the observed result and explanation inside the reveal.", purposes: ["engagement", "retrieval"], pages: ["content", "practice"], cx: 1 }),
  def({ n: 34, id: "common-mistake-explorer", name: "Common Mistake Explorer", cat: "practice", tpl: "flaw-repair", best: "Show frequent errors, why they occur, and how to repair them.", guide: "Use realistic examples from the discipline.", purposes: ["error-analysis", "practice"], pages: ["practice", "quiz-prep", "assignment"], freq: "frequent", cx: 1 }),
  def({ n: 35, id: "myth-versus-fact-reveal", name: "Myth-versus-Fact Reveal", cat: "practice", tpl: "reveal-panels", best: "Challenge misconceptions through reveal-based explanations.", guide: "Explain the evidence behind each classification.", purposes: ["misconceptions", "engagement"], pages: ["content", "practice"], cx: 1 }),
  def({ n: 36, id: "compare-the-perspectives-panels", name: "Compare-the-Perspectives Panels", cat: "practice", tpl: "reveal-panels", best: "Present multiple viewpoints without flattening their differences.", guide: "Identify each perspective, its assumptions, and its strongest evidence.", purposes: ["analysis", "discussion"], pages: ["discussion", "content"], disc: ["humanities", "social-science", "business"], cx: 2 }),
  def({ n: 37, id: "progressive-disclosure-lesson", name: "Progressive Disclosure Lesson", cat: "practice", tpl: "reveal-panels", best: "Release a lesson in stages so the page feels manageable.", guide: "Keep each stage short and make the sequence clear.", purposes: ["pacing", "comprehension"], pages: ["content"], cx: 2 }),
  def({ n: 38, id: "decision-consequence-cards", name: "Decision Consequence Cards", cat: "practice", tpl: "reveal-panels", best: "Let students examine the likely effects of several choices.", guide: "Include benefits, risks, affected stakeholders, and uncertainty.", purposes: ["decision-making", "analysis"], pages: ["content", "discussion"], cx: 2 }),

  // ── Planning, Analysis, and Decision Support (39-60) ──────────────────────
  def({ n: 39, id: "interactive-rubric-explorer", name: "Interactive Rubric Explorer", cat: "planning", tpl: "reveal-panels", best: "Help students understand rubric criteria before submitting work.", guide: "Show what developing, proficient, and advanced work looks like.", purposes: ["assessment-prep", "clarity"], pages: ["assignment"], freq: "frequent", cx: 1 }),
  def({ n: 40, id: "assignment-planning-wizard", name: "Assignment Planning Wizard", cat: "planning", tpl: "steps-reveal", best: "Guide students from topic selection to final submission.", guide: "Use a sequence of expandable planning steps.", purposes: ["planning", "procedure"], pages: ["assignment", "milestone"], freq: "frequent", cx: 1 }),
  def({ n: 41, id: "source-credibility-analyzer", name: "Source Credibility Analyzer", cat: "planning", tpl: "prompt-list", best: "Prompt students to evaluate authorship, evidence, currency, bias, and purpose.", guide: "Use guiding questions and a final credibility judgment.", purposes: ["information-literacy", "analysis"], pages: ["content", "practice"], disc: ["humanities", "social-science", "writing", "business"], cx: 2 }),
  def({ n: 42, id: "argument-builder", name: "Argument Builder", cat: "planning", tpl: "steps-reveal", best: "Structure a claim, evidence, reasoning, counterargument, and response.", guide: "Students can copy the prompts into their notes or submission draft.", purposes: ["writing", "analysis"], pages: ["assignment", "discussion"], disc: ["humanities", "social-science", "writing"], cx: 2 }),
  def({ n: 43, id: "interactive-troubleshooting-guide", name: "Interactive Troubleshooting Guide", cat: "planning", tpl: "reveal-panels", best: "Route students from a problem to a likely solution.", guide: "Create one expandable issue per common problem.", purposes: ["support", "procedure"], pages: ["assignment", "orientation"], freq: "frequent", cx: 1 }),
  def({ n: 44, id: "concept-relationship-map", name: "Concept Relationship Map", cat: "planning", tpl: "reveal-panels", best: "Show how major concepts connect, contrast, or depend on one another.", guide: "Use links and expandable explanations as a script-free map alternative.", purposes: ["comprehension", "synthesis"], pages: ["content", "recap"], cx: 2 }),
  def({ n: 45, id: "data-interpretation-walkthrough", name: "Data Interpretation Walkthrough", cat: "planning", tpl: "figure-panel", best: "Guide students through patterns, outliers, limitations, and conclusions.", guide: "Pair the walkthrough with an accessible chart or data table.", purposes: ["data-literacy", "analysis"], pages: [], assets: ["image"], disc: ["stem", "data", "business", "geography"], cx: 2 }),
  def({ n: 46, id: "confidence-check", name: "Confidence Check", cat: "planning", tpl: "reveal-panels", best: "Route students to review, practice, or extension based on confidence.", guide: "Provide a useful next step for each confidence level.", purposes: ["metacognition", "differentiation"], pages: ["quiz-prep", "recap"], freq: "frequent", cx: 1 }),
  def({ n: 47, id: "role-based-scenario-views", name: "Role-Based Scenario Views", cat: "planning", tpl: "reveal-panels", best: "Show the same situation from different stakeholder perspectives.", guide: "Use one expandable panel for each role and clarify competing priorities.", purposes: ["perspective-taking", "analysis"], pages: ["discussion", "content"], disc: ["business", "health", "social-science", "humanities"], cx: 2 }),
  def({ n: 48, id: "timeline-reconstruction-activity", name: "Timeline Reconstruction Activity", cat: "planning", tpl: "iframe-embed", best: "Ask students to arrange events in the correct order.", guide: "Use a drag-and-drop embed or a Canvas quiz question type.", purposes: ["sequence", "practice"], grading: true, fallback: "expandable-timeline" }),
  def({ n: 49, id: "interactive-reading-guide", name: "Interactive Reading Guide", cat: "planning", tpl: "reveal-panels", best: "Pair sections of a reading with questions, vocabulary, and summaries.", guide: "Organize prompts by section or page range.", purposes: ["reading-support", "comprehension"], pages: ["content"], freq: "frequent", cx: 1 }),
  def({ n: 50, id: "mistake-and-repair-example", name: "Mistake-and-Repair Example", cat: "planning", tpl: "flaw-repair", best: "Present flawed work, then reveal a corrected version and rationale.", guide: "Ask students to identify the problem before opening the correction.", purposes: ["error-analysis", "revision"], pages: ["practice", "assignment"], cx: 1 }),
  def({ n: 51, id: "evidence-sorting-activity", name: "Evidence Sorting Activity", cat: "planning", tpl: "iframe-embed", best: "Classify evidence by strength, relevance, type, or credibility.", guide: "Use a drag-and-drop tool or a Canvas matching question.", purposes: ["analysis", "practice"], grading: true, fallback: "source-credibility-analyzer" }),
  def({ n: 52, id: "ethical-dilemma-explorer", name: "Ethical Dilemma Explorer", cat: "planning", tpl: "reveal-panels", best: "Examine an ethical problem through several reasoning lenses.", guide: "Include stakeholders, duties, consequences, rights, fairness, and professional standards.", purposes: ["ethics", "analysis"], pages: ["discussion", "content"], disc: ["humanities", "health", "business", "social-science"], cx: 3, freq: "rare" }),
  def({ n: 53, id: "build-a-definition-activity", name: "Build-a-Definition Activity", cat: "planning", tpl: "reveal-panels", best: "Use examples, nonexamples, and characteristics before revealing a formal definition.", guide: "Invite students to draft their own definition first.", purposes: ["comprehension", "practice"], pages: ["content", "practice"], cx: 1 }),
  def({ n: 54, id: "frequently-missed-instructions", name: "Frequently Missed Instructions", cat: "planning", tpl: "reveal-panels", best: "Highlight assignment requirements that students often overlook.", guide: "Cover format, length, sources, file type, naming, and due-date rules.", purposes: ["clarity", "assessment-prep"], pages: ["assignment"], freq: "frequent", cx: 1 }),
  def({ n: 55, id: "choose-the-best-example", name: "Choose-the-Best-Example", cat: "planning", tpl: "options-reveal", best: "Compare several examples and reveal which best meets the standard.", guide: "Explain why the strongest example succeeds and where others fall short.", purposes: ["evaluation", "practice"], pages: ["practice", "quiz-prep"], cx: 1 }),
  def({ n: 56, id: "reflection-ladder", name: "Reflection Ladder", cat: "planning", tpl: "prompt-list", best: "Move from recall to interpretation, application, evaluation, and reflection.", guide: "Use increasingly demanding prompts.", purposes: ["reflection", "metacognition"], pages: ["recap", "discussion"], freq: "frequent", cx: 1 }),
  def({ n: 57, id: "lab-or-fieldwork-checklist", name: "Lab or Fieldwork Checklist", cat: "planning", tpl: "checklist", best: "Organize equipment, safety, procedure, data collection, and cleanup.", guide: "Use institution-approved safety language.", purposes: ["procedure", "safety"], pages: ["practice", "content"], disc: ["stem", "health", "geography"], cx: 1 }),
  def({ n: 58, id: "what-would-you-do-next", name: "What Would You Do Next?", cat: "planning", tpl: "options-reveal", best: "Pause a scenario and ask students to choose the next action.", guide: "Reveal the recommended action and reasoning afterward.", purposes: ["decision-making", "application"], pages: ["content", "discussion", "practice"], cx: 1 }),
  def({ n: 59, id: "course-navigation-map", name: "Course Navigation Map", cat: "planning", tpl: "card-link-grid", best: "Provide a visual map to Start Here, modules, assignments, support, and grades.", guide: "Use Canvas page, module, and assignment links.", purposes: ["navigation"], pages: ["homepage", "orientation"], freq: "frequent", cx: 1 }),
  def({ n: 60, id: "resource-recommendation-menu", name: "Resource Recommendation Menu", cat: "planning", tpl: "card-link-grid", best: "Route students to the right support based on what they need.", guide: "Offer focused links for concepts, research, writing, technology, and personal support.", purposes: ["support", "navigation"], pages: ["orientation", "recap", "syllabus"], freq: "frequent", cx: 1 }),

  // ── Visual, Media, and Module Experiences (61-73) ─────────────────────────
  def({ n: 61, id: "flip-card-style-reveal", name: "Flip-Card Style Reveal", cat: "media", tpl: "flip-card", best: "Create an accessible reveal that functions like a flip card without JavaScript.", guide: "Use the summary as the front and the expanded panel as the back.", purposes: ["retrieval", "engagement"], pages: ["practice", "quiz-prep"], cx: 1 }),
  def({ n: 62, id: "process-diagram-with-details", name: "Process Diagram with Details", cat: "media", tpl: "steps-reveal", best: "Combine a visual sequence with expandable explanations.", guide: "Use numbered stages and concise descriptions.", purposes: ["procedure", "comprehension"], pages: ["content"], cx: 1 }),
  def({ n: 63, id: "responsive-image-gallery", name: "Responsive Image Gallery", cat: "media", tpl: "gallery", best: "Display several course images with captions and links.", guide: "Use meaningful alt text and captions for every image.", purposes: ["visual", "media"], pages: [], assets: ["image"], cx: 1 }),
  def({ n: 64, id: "stop-and-think-prompt", name: "Stop-and-Think Prompt", cat: "media", tpl: "callout", best: "Insert a purposeful pause before students continue.", guide: "Ask one focused question and optionally reveal a model response.", purposes: ["reflection", "engagement"], pages: ["content", "practice"], freq: "frequent", cx: 1 }),
  def({ n: 65, id: "embedded-external-website", name: "Embedded External Website", cat: "media", tpl: "iframe-embed", best: "Display an approved external resource within Canvas.", guide: "Confirm HTTPS, iframe permissions, privacy, accessibility, and mobile behavior.", purposes: ["media", "enrichment"], fallback: "optional-extension-menu" }),
  def({ n: 66, id: "audio-player-with-transcript", name: "Audio Player with Transcript", cat: "media", tpl: "media-audio", best: "Pair audio with a transcript and listening prompts.", guide: "Replace the audio and transcript placeholders.", purposes: ["media"], pages: [], assets: ["audio"], cx: 1 }),
  def({ n: 67, id: "video-player-with-transcript-and-resources", name: "Video Player with Transcript and Resources", cat: "media", tpl: "media-video", best: "Pair video with captions, transcript, and related links.", guide: "Provide captions and a transcript for accessibility.", purposes: ["media"], pages: [], assets: ["video"], cx: 1 }),
  def({ n: 68, id: "external-media-gallery", name: "External Media Gallery", cat: "media", tpl: "card-link-grid", best: "Present several external media choices in a linked card grid.", guide: "Use direct links or approved embeds and explain why each item matters.", purposes: ["media", "enrichment"], pages: ["content"], cx: 1 }),
  def({ n: 69, id: "interactive-homepage-navigation-tiles", name: "Interactive Homepage Navigation Tiles", cat: "media", tpl: "card-link-grid", best: "Turn the course homepage into a clear set of visual destinations.", guide: "Use consistent icons, labels, and Canvas links.", purposes: ["navigation"], pages: ["homepage"], cx: 1 }),
  def({ n: 70, id: "process-stepper", name: "Process Stepper", cat: "media", tpl: "steps-reveal", best: "Show status, sequence, and expected outputs for a multi-step task.", guide: "Use one stage per step and identify the deliverable.", purposes: ["procedure", "planning"], pages: ["assignment", "milestone"], cx: 1 }),
  def({ n: 71, id: "enrichment-choice-board", name: "Enrichment Choice Board", cat: "media", tpl: "card-link-grid", best: "Offer optional media, practice, and extension choices.", guide: "Label each choice by purpose and estimated time.", purposes: ["enrichment", "differentiation"], pages: ["recap", "content"], cx: 1 }),
  def({ n: 72, id: "custom-rocketcourse-interactive-embed", name: "Custom RocketCourse Interactive Embed", cat: "media", tpl: "iframe-embed", best: "Embed a RocketCourse-hosted activity with consistent styling and analytics.", guide: "Use a signed or public activity URL, depending on privacy requirements.", purposes: ["interactive"], fallback: "responsive-card-grid" }),
  def({ n: 73, id: "visual-module-launchpad", name: "Visual Module Launchpad", cat: "media", tpl: "card-link-grid", best: "Create a module-opening menu for overview, content, practice, and assessment.", guide: "Link each card to the appropriate Canvas item.", purposes: ["navigation", "orientation"], pages: ["module-overview"], freq: "frequent", cx: 1 }),

  // ── Forty New Additions (74-113) ──────────────────────────────────────────
  def({ n: 74, id: "adaptive-remediation-menu", name: "Adaptive Remediation Menu", cat: "expansion", tpl: "reveal-panels", best: "Route students to targeted review based on the difficulty they experienced.", guide: "Offer foundational, focused, and challenge pathways.", purposes: ["differentiation", "support"], pages: ["quiz-prep", "recap"], cx: 1 }),
  def({ n: 75, id: "pre-assessment-routing-panel", name: "Pre-Assessment Routing Panel", cat: "expansion", tpl: "iframe-embed", best: "Use a short diagnostic to recommend what students should review next.", guide: "Use a Canvas quiz, LTI, or external tool when responses must determine routing.", purposes: ["assessment-prep", "differentiation"], grading: true, fallback: "adaptive-remediation-menu" }),
  def({ n: 76, id: "worked-example-reveal", name: "Worked Example Reveal", cat: "expansion", tpl: "reveal-panels", best: "Show a fully worked solution only after students attempt the problem.", guide: "Include each reasoning step and the final check.", purposes: ["practice", "procedure"], pages: ["practice", "quiz-prep", "content"], freq: "frequent", disc: ["stem", "data", "business"], cx: 1 }),
  def({ n: 77, id: "hint-ladder", name: "Hint Ladder", cat: "expansion", tpl: "reveal-panels", best: "Provide increasingly specific hints without immediately giving away the answer.", guide: "Use three levels: nudge, strategy, and near-solution.", purposes: ["practice", "support"], pages: ["practice", "quiz-prep"], cx: 1 }),
  def({ n: 78, id: "socratic-question-chain", name: "Socratic Question Chain", cat: "expansion", tpl: "prompt-list", best: "Lead students through a concept using a sequence of probing questions.", guide: "Each question should build on the previous one.", purposes: ["analysis", "comprehension"], pages: ["content", "discussion"], cx: 1 }),
  def({ n: 79, id: "error-diagnosis-tree", name: "Error Diagnosis Tree", cat: "expansion", tpl: "flaw-repair", best: "Help students identify why a solution, process, or submission failed.", guide: "Branch by observable symptoms and likely causes.", purposes: ["error-analysis", "support"], pages: ["practice", "assignment"], disc: ["stem", "data", "business"], cx: 2 }),
  def({ n: 80, id: "assumption-checker", name: "Assumption Checker", cat: "expansion", tpl: "prompt-list", best: "Surface hidden assumptions in arguments, models, or decisions.", guide: "Ask what must be true, what evidence supports it, and what could change the conclusion.", purposes: ["analysis", "critical-thinking"], pages: ["content", "discussion"], cx: 2 }),
  def({ n: 81, id: "counterexample-explorer", name: "Counterexample Explorer", cat: "expansion", tpl: "reveal-panels", best: "Test a rule or claim against cases where it may not hold.", guide: "Use a reveal to explain what the counterexample teaches.", purposes: ["analysis", "misconceptions"], pages: ["content", "practice"], disc: ["stem", "humanities", "social-science"], cx: 2 }),
  def({ n: 82, id: "analogy-matcher", name: "Analogy Matcher", cat: "expansion", tpl: "iframe-embed", best: "Match concepts to useful analogies and explain the relationship.", guide: "Use matching, drag-and-drop, or a Canvas quiz question.", purposes: ["comprehension", "practice"], grading: true, fallback: "build-a-definition-activity" }),
  def({ n: 83, id: "concept-boundary-tester", name: "Concept Boundary Tester", cat: "expansion", tpl: "reveal-panels", best: "Distinguish examples, near examples, and nonexamples.", guide: "Ask students to classify each case before revealing the explanation.", purposes: ["comprehension", "practice"], pages: ["content", "practice"], cx: 1 }),
  def({ n: 84, id: "micro-debate-chooser", name: "Micro-Debate Chooser", cat: "expansion", tpl: "reveal-panels", best: "Let students select a position and review the strongest argument on each side.", guide: "Include evidence, a counterpoint, and a question for discussion.", purposes: ["discussion", "analysis"], pages: ["discussion"], disc: ["humanities", "social-science", "business", "health"], cx: 2 }),
  def({ n: 85, id: "stakeholder-priority-matrix", name: "Stakeholder Priority Matrix", cat: "expansion", tpl: "matrix-table", best: "Compare what different stakeholders value and fear.", guide: "Use a table with priorities, risks, and desired outcomes.", purposes: ["analysis", "perspective-taking"], pages: ["content", "discussion"], disc: ["business", "health", "social-science"], cx: 2, freq: "rare" }),
  def({ n: 86, id: "risk-benefit-matrix", name: "Risk-Benefit Matrix", cat: "expansion", tpl: "matrix-table", best: "Compare options across likely benefits, risks, probability, and impact.", guide: "Use neutral wording and identify uncertainty.", purposes: ["decision-making", "analysis"], pages: ["content", "discussion"], disc: ["business", "health", "stem"], cx: 2, freq: "rare" }),
  def({ n: 87, id: "cause-and-effect-chain", name: "Cause-and-Effect Chain", cat: "expansion", tpl: "steps-reveal", best: "Trace how one condition leads to another through several stages.", guide: "Use numbered links and reveal the explanation for each connection.", purposes: ["analysis", "comprehension"], pages: ["content"], cx: 1 }),
  def({ n: 88, id: "systems-thinking-loop-explorer", name: "Systems Thinking Loop Explorer", cat: "expansion", tpl: "iframe-embed", best: "Explore reinforcing and balancing feedback loops.", guide: "Use an accessible diagramming or simulation tool with a text alternative.", purposes: ["analysis", "interactive"], fallback: "cause-and-effect-chain" }),
  def({ n: 89, id: "hypothesis-builder", name: "Hypothesis Builder", cat: "expansion", tpl: "steps-reveal", best: "Help students formulate a testable hypothesis from observations and variables.", guide: "Guide them through observation, prediction, variables, and rationale.", purposes: ["inquiry", "planning"], pages: ["practice", "content"], disc: ["stem", "data", "geography", "health"], cx: 2 }),
  def({ n: 90, id: "experiment-design-planner", name: "Experiment Design Planner", cat: "expansion", tpl: "steps-reveal", best: "Structure a study around question, variables, controls, procedure, and evidence.", guide: "Add discipline-specific safety and ethics requirements.", purposes: ["inquiry", "planning"], pages: ["practice", "assignment"], disc: ["stem", "health", "geography"], cx: 2, freq: "rare" }),
  def({ n: 91, id: "variable-identification-activity", name: "Variable Identification Activity", cat: "expansion", tpl: "reveal-panels", best: "Practice identifying independent, dependent, and controlled variables.", guide: "Reveal the classification and reasoning for each variable.", purposes: ["practice", "inquiry"], pages: ["practice"], disc: ["stem", "data", "health"], cx: 1 }),
  def({ n: 92, id: "data-quality-checklist", name: "Data Quality Checklist", cat: "expansion", tpl: "prompt-list", best: "Evaluate completeness, accuracy, consistency, bias, and provenance.", guide: "Use before analysis or visualization.", purposes: ["data-literacy", "analysis"], pages: ["practice", "content"], disc: ["data", "stem", "business", "geography"], cx: 1 }),
  def({ n: 93, id: "chart-type-chooser", name: "Chart-Type Chooser", cat: "expansion", tpl: "reveal-panels", best: "Help students select an appropriate visualization for their question and data.", guide: "Route by comparison, trend, distribution, relationship, or composition.", purposes: ["data-literacy", "decision-making"], pages: ["content", "practice"], disc: ["data", "stem", "business", "geography"], cx: 1 }),
  def({ n: 94, id: "geographic-layer-explorer", name: "Geographic Layer Explorer", cat: "expansion", tpl: "iframe-embed", best: "Toggle or compare map layers such as elevation, land use, hazards, or demographics.", guide: "Use an accessible web map and provide a text description of key patterns.", purposes: ["visual", "interactive"], fallback: "map-legend-decoder" }),
  def({ n: 95, id: "map-legend-decoder", name: "Map Legend Decoder", cat: "expansion", tpl: "figure-panel", best: "Teach students how symbols, colors, scale, and classification affect interpretation.", guide: "Explain each symbol and include a question about interpretation.", purposes: ["visual", "comprehension"], pages: [], assets: ["image"], disc: ["geography", "stem"], cx: 2 }),
  def({ n: 96, id: "primary-source-annotation-guide", name: "Primary Source Annotation Guide", cat: "expansion", tpl: "prompt-list", best: "Guide close reading of a document, image, speech, artifact, or map.", guide: "Prompt for context, evidence, perspective, and unanswered questions.", purposes: ["reading-support", "analysis"], pages: ["content", "practice"], disc: ["humanities", "social-science"], cx: 1 }),
  def({ n: 97, id: "citation-scavenger-hunt", name: "Citation Scavenger Hunt", cat: "expansion", tpl: "iframe-embed", best: "Ask students to locate citation elements, source types, or errors.", guide: "Use a quiz or embedded activity for immediate feedback.", purposes: ["information-literacy", "practice"], grading: true, fallback: "source-credibility-analyzer" }),
  def({ n: 98, id: "research-question-refiner", name: "Research Question Refiner", cat: "expansion", tpl: "steps-reveal", best: "Move from a broad topic to a focused, answerable research question.", guide: "Check scope, clarity, significance, evidence, and feasibility.", purposes: ["inquiry", "writing"], pages: ["assignment", "milestone"], disc: ["humanities", "social-science", "writing", "stem"], cx: 2 }),
  def({ n: 99, id: "literature-theme-matrix", name: "Literature Theme Matrix", cat: "expansion", tpl: "matrix-table", best: "Compare sources across themes, methods, findings, and gaps.", guide: "Use a responsive table and a short synthesis prompt.", purposes: ["synthesis", "analysis"], pages: ["assignment", "content"], disc: ["humanities", "social-science", "writing"], cx: 2, freq: "rare" }),
  def({ n: 100, id: "peer-review-protocol", name: "Peer Review Protocol", cat: "expansion", tpl: "prompt-list", best: "Structure peer feedback around criteria, evidence, and revision priorities.", guide: "Use respectful language and require actionable feedback.", purposes: ["feedback", "collaboration"], pages: ["discussion", "assignment"], cx: 1 }),
  def({ n: 101, id: "feedback-interpretation-guide", name: "Feedback Interpretation Guide", cat: "expansion", tpl: "reveal-panels", best: "Help students translate feedback into specific revision actions.", guide: "Sort comments into clarify, expand, correct, reorganize, and polish.", purposes: ["revision", "metacognition"], pages: ["assignment", "recap"], cx: 1 }),
  def({ n: 102, id: "revision-choice-board", name: "Revision Choice Board", cat: "expansion", tpl: "card-link-grid", best: "Offer targeted revision activities based on the draft's needs.", guide: "Include options for ideas, organization, evidence, clarity, and mechanics.", purposes: ["revision", "differentiation"], pages: ["assignment"], disc: ["writing", "humanities", "social-science"], cx: 1 }),
  def({ n: 103, id: "study-strategy-selector", name: "Study Strategy Selector", cat: "expansion", tpl: "reveal-panels", best: "Recommend study methods based on the learning goal and difficulty.", guide: "Differentiate recall, application, problem solving, and synthesis.", purposes: ["metacognition", "preparation"], pages: ["quiz-prep", "recap"], cx: 1 }),
  def({ n: 104, id: "exam-wrapper-reflection", name: "Exam Wrapper Reflection", cat: "expansion", tpl: "prompt-list", best: "Help students analyze preparation, performance, errors, and next steps after an assessment.", guide: "Focus on controllable strategies and specific changes.", purposes: ["metacognition", "reflection"], pages: ["recap"], cx: 1 }),
  def({ n: 105, id: "goal-setting-contract", name: "Goal-Setting Contract", cat: "expansion", tpl: "steps-reveal", best: "Turn a broad intention into a specific goal, evidence, schedule, and accountability plan.", guide: "Include a realistic deadline and a plan for obstacles.", purposes: ["planning", "metacognition"], pages: ["orientation", "milestone", "homepage"], freq: "frequent", cx: 1 }),
  def({ n: 106, id: "time-budget-calculator", name: "Time-Budget Calculator", cat: "expansion", tpl: "iframe-embed", best: "Estimate workload across reading, media, practice, and assignments.", guide: "Use an accessible calculator and explain that estimates should remain editable.", purposes: ["pacing", "planning"], fallback: "goal-setting-contract" }),
  def({ n: 107, id: "project-milestone-tracker", name: "Project Milestone Tracker", cat: "expansion", tpl: "steps-reveal", best: "Show major project stages, due dates, dependencies, and deliverables.", guide: "Link each milestone to the corresponding Canvas item.", purposes: ["planning", "pacing"], pages: ["milestone", "assignment"], cx: 1 }),
  def({ n: 108, id: "team-role-chooser", name: "Team Role Chooser", cat: "expansion", tpl: "reveal-panels", best: "Help groups assign roles based on tasks, strengths, and accountability.", guide: "Include role responsibilities and a rotation option.", purposes: ["collaboration"], pages: ["discussion", "assignment"], cx: 1 }),
  def({ n: 109, id: "group-agreement-builder", name: "Group Agreement Builder", cat: "expansion", tpl: "steps-reveal", best: "Guide teams through communication, deadlines, conflict, and decision rules.", guide: "Have students copy the completed agreement into a shared document.", purposes: ["collaboration", "planning"], pages: ["discussion", "assignment"], cx: 1 }),
  def({ n: 110, id: "accessibility-self-audit", name: "Accessibility Self-Audit", cat: "expansion", tpl: "prompt-list", best: "Prompt creators or students to check headings, alt text, links, color, captions, and document structure.", guide: "Use this before publishing or submitting digital work.", purposes: ["accessibility", "revision"], pages: ["assignment"], cx: 1 }),
  def({ n: 111, id: "inclusive-language-review", name: "Inclusive Language Review", cat: "expansion", tpl: "prompt-list", best: "Review wording for clarity, respect, specificity, and unnecessary assumptions.", guide: "Frame this as a revision guide, not an automated judgment.", purposes: ["revision", "accessibility"], pages: ["assignment"], disc: ["writing", "humanities", "social-science", "business"], cx: 1 }),
  def({ n: 112, id: "media-bias-lens-selector", name: "Media Bias Lens Selector", cat: "expansion", tpl: "prompt-list", best: "Analyze a media item through framing, sourcing, omission, language, and incentives.", guide: "Ask students to support judgments with evidence from the item.", purposes: ["information-literacy", "analysis"], pages: ["content", "discussion"], disc: ["humanities", "social-science", "business"], cx: 2 }),
  def({ n: 113, id: "transfer-challenge", name: "Transfer Challenge", cat: "expansion", tpl: "reveal-panels", best: "Apply a concept to a new setting, audience, data set, or problem.", guide: "Make the new context meaningfully different from the worked example.", purposes: ["application", "synthesis"], pages: ["recap", "practice"], cx: 1 })
];

export const interactionPatternById = (id: string): InteractionPatternDef | undefined =>
  INTERACTION_PATTERNS.find((pattern) => pattern.id === id);

export const INTERACTION_CATEGORY_LABELS: Record<InteractionCategory, string> = {
  structure: "Disclosure, Structure & Navigation",
  practice: "Practice, Reveal & Knowledge Checking",
  planning: "Planning, Analysis & Decision Support",
  media: "Visual, Media & Module Experiences",
  expansion: "Expanded Library"
};

export const INTERACTION_TIER_LABELS: Record<InteractionTier, string> = {
  native: "Native Canvas HTML",
  iframe: "External embed (native fallback until a host is configured)"
};
