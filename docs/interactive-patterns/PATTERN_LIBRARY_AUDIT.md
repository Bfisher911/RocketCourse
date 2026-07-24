# Canvas Interactive Pattern Library — Audit (Phase 7)

> **Read-only audit.** No code was changed to produce this document. It records the actual,
> in-code state of the 113-pattern Canvas interaction system on branch
> `feature/nine-workflows-units-design`, as evidence for the Phases 8–12 decisions
> (recommendation engine, density controls, generation-distribution targets). Every claim is
> grounded in a file the auditor read; paths are relative to the repo root.

## Source files
| File | Role |
|---|---|
| `src/data/interactionPatterns.ts` | The typed 113-pattern registry (`INTERACTION_PATTERNS`, `:164–287`) + the `def()` factory. |
| `src/services/interactionRender.ts` | Turns a pattern block into Canvas-safe HTML; 19 template renderers; iframe/embed policy. |
| `src/services/interactionSelection.ts` | The **deterministic** selection/placement engine + 39 content builders. |
| `src/services/interactionValidation.ts` | Per-fragment validation (safety, ids, links, tables, alt, headings, iframe policy). |
| `src/services/htmlSafety.ts` | Single source of truth for Canvas-unsafe HTML (`UNSAFE_HTML_RULES`). |
| `src/types.ts` | `InteractionBlock`, `InteractionContent`, `ExternalInteractiveConfig`. |
| tests: `interactionPatterns.test.ts`, `interactionRender.test.ts`, `interactionSelection.test.ts` | 31 tests total (6 + 12 + 13). |
| `docs/INTERACTIVE_PATTERNS.md` | The existing narrative overview. |

---

## 1. System at a glance

- **Exactly 113 patterns**, numbered contiguously 1–113 with unique ids (asserted by
  `interactionPatterns.test.ts:9–20`).
- Rendering is **shared across 19 template shapes** so 113 patterns stay maintainable — a
  pattern is (number, name, category, tier, template, guidance, page-types, disciplines, caps).
- **All output is native, Canvas-safe HTML with inline styles** (no `<script>`, no external
  stylesheet, no JS) — except the `iframe-embed` template, which is **gated off by default**
  and renders a native fallback instead (§4).
- Selection is **fully deterministic** (module-index rotation, not randomness;
  `interactionSelection.ts:6–8`) — no AI call is involved in choosing or placing patterns.

### Tiers (`InteractionTier`, 3 values)
| Tier | Count | Meaning | In practice |
|---|--:|---|---|
| `native` | **98** | Canvas-safe HTML (details/summary, cards, tables, media, links). | Renders directly. |
| `iframe` | **15** | Needs an external HTTPS host. | **Renders its native `fallbackPatternId`** until an external interactive is configured; embeds are disabled by default. |
| `canvas-native` | **0** | *(defined in the union + label map + `describePatternTier` but assigned to no pattern — effectively dead; see Findings.)* | — |

The "graded" concept lives on a flag, not this tier: **6 patterns** set `supportsGrading: true`
(#29, 48, 51, 75, 82, 97 — all `iframe`), meaning a persistent score must come from a Canvas
quiz/LTI; their page-side companion is the native `fallbackPatternId`. No native pattern is
allowed to claim grading (`interactionPatterns.test.ts:45–49`).

### Categories (`InteractionCategory`, 5 values) — ranges verified against the data
| Category | Count | Numbers | Label in UI |
|---|--:|---|---|
| structure | 22 | 1–22 | Disclosure, Structure & Navigation |
| practice | 16 | 23–38 | Practice, Reveal & Knowledge Checking |
| planning | 22 | 39–60 | Planning, Analysis & Decision Support |
| media | 13 | 61–73 | Visual, Media & Module Experiences |
| expansion | 40 | 74–113 | Expanded Library |

### Registry entry shape (`InteractionPatternDef`, `interactionPatterns.ts:76–108`)
`id` · `number` (1–113) · `name` · `category` · `tier` · `template` · `bestUse` · `guidance`
(drives generated content) · `purposes[]` (scoring) · `pageTypes[]` (**empty = editor-only, never
auto-placed**) · `disciplines[]` · `complexity 1|2|3` · `frequency frequent|selective|rare` ·
`requiredAssets[]` (image/audio/video/external-url/instructor-info) · `supportsGrading` ·
`requiresExternalHosting` · `fallbackPatternId?` · `accessibilityNotes`.

---

## 2. Template reference (the per-pattern uniform attributes)

Because rendering is template-driven, a pattern's **JS requirement, Canvas-safety, mobile
behavior, print/screen-reader fallback, and safe-fallback** are determined by its template. Read
this table together with the per-pattern list in §7 (which gives each pattern's template).

Renderers: `TEMPLATE_RENDERERS` dispatch at `interactionRender.ts:361–380`; every block is a
`<section aria-labelledby>`/`<article>` with an `<h3 id>` (`sectionShell` `:157–167`), all text
`esc()`-escaped, all ids block-suffixed, all hrefs restricted to `https:`/`mailto:`/`#`/Canvas
`$TOKEN$` (`SAFE_HREF` `:46–52`).

| Template (# patterns) | HTML emitted | JS | Screen reader / keyboard | Mobile | Print | Safe fallback |
|---|---|:--:|---|---|---|---|
| `reveal-panels` (37) | `<details><summary>/<div>` panels | none | native disclosure, keyboard-operable | reflows | expands inline | n/a (native) |
| `steps-reveal` (12) | `<ol><li>` + optional reveal | none | ordered-list semantics | reflows | full text | n/a |
| `prompt-list` (11) | `<ul><li>` + optional reveal | none | list semantics | reflows | full text | n/a |
| `card-link-grid` (9) | CSS-grid of `<a>` cards; `<div>` when no safe href | none | **no dead `#` links** — degrades to non-link | grid → 1 col | links printed | n/a |
| `callout` (5) | soft-bg `<section>` + `<ul>` | none | heading + list | reflows | full text | n/a |
| `checklist` (3) | `<ul>` with `aria-hidden` check glyphs + "Canvas won't save checks" note | none | check glyph hidden from SR; honest note | reflows | printable | n/a |
| `scenario` (1) | `<article>` + facets + reveal | none | article landmark, own kicker | reflows | full text | n/a |
| `options-reveal` (2) | `<ol>` options + reveal | none | ordered list | reflows | full text | n/a |
| `flaw-repair` (3) | `<blockquote>` + `<details>` | none | blockquote semantics | reflows | full text | n/a |
| `matrix-table` (3) | `<div overflow-x:auto><table>` `<th scope>` ; **degrades to `prompt-list` if empty** | none | scoped headers | horizontal-scroll wrapper (no clip) | table printed | prompt-list |
| `timeline` (1) | `<details>` per event | none | disclosure per milestone | reflows | expands | n/a |
| `flip-card` (1) | centered `<details><summary>` | none | summary=front, keyboard | reflows | expands | n/a |
| `media-audio` (2) | `<audio controls>` + transcript reveal | none¹ | transcript, no autoplay | native player | transcript text | **omits if no asset** |
| `media-video` (2) | `<video controls><source>`+`<track captions>`+transcript | none¹ | captions + transcript | native player | transcript text | **omits if no asset** |
| `figure-panel` (3) | `<figure><img alt><figcaption>` + panels | none | alt + caption | image scales | image + caption | **omits if no image** |
| `gallery` (1) | grid of `<figure><img><figcaption>` | none | alt + captions | grid → fewer cols | images + captions | **omits if no images** |
| `image-map` (1) | **delegates to `figure-panel`** (text-equivalent, *not* a coordinate `<map>`) | none | text-equivalent companion | image scales | image + text | figure-panel |
| `instructor-panel` (1) | soft callout `<p><strong>` fact rows | none | labelled facts | reflows | printable | **omits if no instructor-info** |
| `iframe-embed` (15) | `<iframe loading=lazy title>` + text-alt + open-in-new-window — **only when embeds enabled** | host-dependent | descriptive title, text alt, escape link | responsive container | text alternative | **native `fallbackPatternId`** (default) |

¹ native `<audio>/<video>` controls are browser-provided, not custom JS.

**Takeaway:** 18/19 templates are pure native HTML that needs no JavaScript and survives Canvas
sanitization. Only `iframe-embed` can emit a stripped element, and it is disabled by default.

---

## 3. Content fields per template (required vs optional)

Content is the `InteractionContent` shape (`types.ts`): `title`, optional `intro`, `items[]`
(`{heading, body, href?, meta?, open?}`), optional `reveal {label, body}`, `quote`, `note`,
`columns[]`, `rows[][]`. What each template *requires*:

- **Disclosure/list templates** (`reveal-panels`, `steps-reveal`, `prompt-list`, `callout`,
  `options-reveal`, `timeline`, `flip-card`): require `title` + ≥1 `items[].heading/body`;
  `reveal`, `intro`, `note` optional.
- **`checklist`**: `title` + `items[]` (each a checklist line); persistence note auto-added.
- **`card-link-grid`**: `items[]` where a card links only if `href` is a resolvable Canvas token
  / https / mailto — otherwise it renders as a static card (no dead links).
- **`matrix-table`**: requires `columns[]` **and** `rows[][]`; falls back to `prompt-list` if
  either is empty.
- **`scenario`/`flaw-repair`**: `title` + scenario/flaw `items`; `quote` (flaw example) optional.
- **Media/figure** (`media-audio`, `media-video`, `figure-panel`, `gallery`, `image-map`):
  **require a real asset** (`requiredAssets`: audio/video/image); render nothing without it
  (deliberate — "never export an unfinished shell", `interactionRender.ts:309–310`).
- **`instructor-panel`**: requires `instructor-info` asset.
- **`iframe-embed`**: requires an `ExternalInteractiveConfig` (`url`, `title`, `allowedDomain`,
  `textAlternative`, privacy flags) to emit an iframe; otherwise renders its native fallback.

---

## 4. Canvas HTML compatibility & safety

**Single source of truth: `htmlSafety.ts`.** `UNSAFE_HTML_RULES` (`:24–37`) blocks `<script>`,
inline `on*=` handlers, `javascript:`/`vbscript:`/`data:text/html` URLs, `<style>/<link>/<meta>/
<base>`, **frames (`iframe`/`frame`/`frameset`)**, `object/embed/applet`, form controls, and
`marquee`. Inline `style=` attributes are **intentionally allowed** — which is why the renderer's
all-inline styling survives IMSCC import into Canvas.

- **No pattern emits stripped HTML in practice.** Only `iframe-embed` can emit an `<iframe>`, and
  only when `ExternalEmbedPolicy.enabled === true`. The default is `{ enabled: false }`
  (`interactionRender.ts:33`) and nothing in the codebase enables it, so every iframe pattern
  currently renders its native fallback or an honest link-out panel.
- **The export validator is not weakened.** `interactionValidation.ts:100–132` only skips the
  "frames" unsafe-reason when `options.allowIframes` is explicitly true; when iframes are allowed
  it additionally enforces HTTPS `src`, a descriptive `title`, and a `target="_blank"`
  open-in-new-window escape link (`:60–80`). With iframes disallowed, any `<iframe>` is a blocking
  error.
- Other validator checks: duplicate ids, dead/placeholder `#` links, library placeholder text
  ("Replace this", "lorem ipsum", "Option A: Add", …), malformed links, missing `<th scope>` on
  tables, missing image `alt`, and heading order (a **warning**, since a fragment legitimately
  starts at `h3`).

**Verdict:** the library is Canvas-safe by construction. Enabling external embeds later is a
policy switch that the validator already guards; it does not require weakening `htmlSafety`.

---

## 5. Accessibility

Guaranteed by the render layer: native `<details>/<summary>` disclosure (keyboard-operable, no
JS); `<section aria-labelledby>` landmarks with `<h3 id>`; alt text on all figures/galleries
(missing-alt blocks export); scoped `<th>` + horizontal-scroll wrapper on tables (no mobile clip);
media with captions/transcript and no autoplay; checklist glyphs `aria-hidden` with an explicit
"Canvas won't persist checks" note; card grids that never emit dead `#` links.

**Gaps flagged for later work:**
1. **`image-map` never emits an interactive image map** — it delegates to the text-equivalent
   figure panel. Accessible, but the name promises hotspots the markup doesn't provide.
2. **Heading order is only a warning** for fragments, so a badly-composed page could ship an
   h2→h4 jump non-blocking.
3. **Media/figure alt is author-supplied** (`item.body`); the guard checks presence, not that the
   alt is meaningfully descriptive.

---

## 6. Selection engine, generation usage, theming (state today)

- **Deterministic selection** (`interactionSelection.ts`): inputs are page type
  (`classifyPage`), inferred course disciplines (`inferCourseDisciplines`), content-buildability
  (a pattern is eligible only if one of **39 content builders** can produce real content from the
  course — never a shell), existing usage (per-surface: never repeat; per-module: deprioritize
  repeats; course-wide: frequency caps), and **module-index rotation** for variety.
- **Density is fixed caps, not a profile.** `DENSITY_CAPS` (content 3; all other surfaces 2) with
  a hard floor `MIN_INTERACTIONS_PER_SURFACE = 2`. `FREQUENCY_CAPS = { frequent: ∞, selective:
  12, rare: 2 }`. There is **no** minimal/balanced/rich/immersive setting anywhere in code.
- **Generation usage**: `courseGenerator.ts:2683` runs `applyCourseInteractions` on every
  **non-generic** course (generic-template courses get zero blocks). Blocks land on homepage,
  syllabus, orientation, module-overview, content, practice, recap, milestone pages, and every
  assignment/discussion/quiz; instructor-kind modules are skipped. At export, blocks interleave
  into the authored body at `</section>` boundaries. **No explicit course-wide total target
  exists** — the total is emergent (per-surface floor × surfaces, bounded by caps); tests assert
  each fixture yields **>10** blocks. Only the 39 native, no-asset, buildable patterns are ever
  auto-inserted; the other 74 are editor-only or asset/host-gated.
- **Theme**: rendered blocks use the course theme palette (not the PDF's hard-coded teal) —
  `interactionRender.test.ts:12` asserts this. A theme change re-colors interactions.

---

## 7. Full pattern list (all 113)

Tier: **N** native · **IF** iframe. Pages = auto-placement surfaces (`editor-only` = never
auto-placed). Flags: `freq`/`rare` frequency (default selective) · `A:x` required asset · `grade`
supportsGrading · `fb→` iframe native fallback. Per-pattern a11y/JS/Canvas-safety/mobile/print
follow the pattern's **template row in §2**.

### Structure (1–22)
| # | Name | Tier | Template | Pages | Flags / disciplines |
|--:|---|:--:|---|---|---|
|1|Standard Accordion|N|reveal-panels|content, orientation, module-overview|freq|
|2|Nested Accordion|N|reveal-panels|content||
|3|FAQ Accordion|N|reveal-panels|orientation, assignment, homepage, syllabus|freq|
|4|Vocabulary Accordion|N|reveal-panels|content|freq|
|5|Optional Reading Accordion|N|reveal-panels|content||
|6|Step-by-Step Accordion|N|reveal-panels|content, practice, assignment|freq|
|7|Tab-Like Content Panels|N|reveal-panels|module-overview, content||
|8|Read-Time Indicator|N|callout|content, practice|freq|
|9|Learning Objectives Card|N|callout|module-overview, content|freq|
|10|Policy Box|N|callout|assignment, orientation, syllabus|freq|
|11|Instructor Information Panel|N|instructor-panel|editor-only|A:instructor-info|
|12|Action-Item Checklist|N|checklist|module-overview, practice, assignment|freq|
|13|Before-You-Begin Panel|N|callout|content, practice, assignment|freq|
|14|Scenario Card|N|scenario|discussion, content||
|15|Expandable Timeline|N|timeline|content|humanities, social-science, business, health|
|16|Responsive Card Grid|N|card-link-grid|module-overview, homepage|freq|
|17|Clickable Image Map|N|image-map|editor-only|A:image, rare, cx3|
|18|Basic Audio Player|N|media-audio|editor-only|A:audio|
|19|Basic Video Player|N|media-video|editor-only|A:video|
|20|Responsive External Interactive|IF|iframe-embed|editor-only|fb→responsive-card-grid|
|21|H5P Activity Embed|IF|iframe-embed|editor-only|fb→click-to-reveal-answer|
|22|Optional Extension Menu|N|card-link-grid|content, recap||

### Practice (23–38)
| # | Name | Tier | Template | Pages | Flags / disciplines |
|--:|---|:--:|---|---|---|
|23|Click-to-Reveal Answer|N|reveal-panels|practice, content, quiz-prep|freq|
|24|Nested Learning Paths|N|reveal-panels|practice, content||
|25|Interactive Study Checklist|N|checklist|quiz-prep, recap|freq|
|26|Flashcard Stack|N|reveal-panels|quiz-prep, practice||
|27|Choose-Your-Own-Path Scenario|IF|iframe-embed|editor-only|fb→what-would-you-do-next|
|28|Image Hotspot Explorer|IF|iframe-embed|editor-only|fb→map-legend-decoder|
|29|Self-Check Knowledge Questions|IF|iframe-embed|editor-only|grade, fb→click-to-reveal-answer|
|30|Expandable Process Map|N|steps-reveal|content, practice|freq|
|31|Before-and-After Comparison|N|figure-panel|editor-only|A:image|
|32|Expandable Case File|N|reveal-panels|content, discussion|business, health, social-science, humanities|
|33|Prediction Before Reveal|N|reveal-panels|content, practice||
|34|Common Mistake Explorer|N|flaw-repair|practice, quiz-prep, assignment|freq|
|35|Myth-versus-Fact Reveal|N|reveal-panels|content, practice||
|36|Compare-the-Perspectives Panels|N|reveal-panels|discussion, content|humanities, social-science, business|
|37|Progressive Disclosure Lesson|N|reveal-panels|content||
|38|Decision Consequence Cards|N|reveal-panels|content, discussion||

### Planning (39–60)
| # | Name | Tier | Template | Pages | Flags / disciplines |
|--:|---|:--:|---|---|---|
|39|Interactive Rubric Explorer|N|reveal-panels|assignment|freq|
|40|Assignment Planning Wizard|N|steps-reveal|assignment, milestone|freq|
|41|Source Credibility Analyzer|N|prompt-list|content, practice|humanities, social-science, writing, business|
|42|Argument Builder|N|steps-reveal|assignment, discussion|humanities, social-science, writing|
|43|Interactive Troubleshooting Guide|N|reveal-panels|assignment, orientation|freq|
|44|Concept Relationship Map|N|reveal-panels|content, recap||
|45|Data Interpretation Walkthrough|N|figure-panel|editor-only|A:image; stem, data, business, geography|
|46|Confidence Check|N|reveal-panels|quiz-prep, recap|freq|
|47|Role-Based Scenario Views|N|reveal-panels|discussion, content|business, health, social-science, humanities|
|48|Timeline Reconstruction Activity|IF|iframe-embed|editor-only|grade, fb→expandable-timeline|
|49|Interactive Reading Guide|N|reveal-panels|content|freq|
|50|Mistake-and-Repair Example|N|flaw-repair|practice, assignment||
|51|Evidence Sorting Activity|IF|iframe-embed|editor-only|grade, fb→source-credibility-analyzer|
|52|Ethical Dilemma Explorer|N|reveal-panels|discussion, content|humanities, health, business, social-science; rare, cx3|
|53|Build-a-Definition Activity|N|reveal-panels|content, practice||
|54|Frequently Missed Instructions|N|reveal-panels|assignment|freq|
|55|Choose-the-Best-Example|N|options-reveal|practice, quiz-prep||
|56|Reflection Ladder|N|prompt-list|recap, discussion|freq|
|57|Lab or Fieldwork Checklist|N|checklist|practice, content|stem, health, geography|
|58|What Would You Do Next?|N|options-reveal|content, discussion, practice||
|59|Course Navigation Map|N|card-link-grid|homepage, orientation|freq|
|60|Resource Recommendation Menu|N|card-link-grid|orientation, recap, syllabus|freq|

### Media (61–73)
| # | Name | Tier | Template | Pages | Flags / disciplines |
|--:|---|:--:|---|---|---|
|61|Flip-Card Style Reveal|N|flip-card|practice, quiz-prep||
|62|Process Diagram with Details|N|steps-reveal|content||
|63|Responsive Image Gallery|N|gallery|editor-only|A:image|
|64|Stop-and-Think Prompt|N|callout|content, practice|freq|
|65|Embedded External Website|IF|iframe-embed|editor-only|fb→optional-extension-menu|
|66|Audio Player with Transcript|N|media-audio|editor-only|A:audio|
|67|Video Player with Transcript and Resources|N|media-video|editor-only|A:video|
|68|External Media Gallery|N|card-link-grid|content||
|69|Interactive Homepage Navigation Tiles|N|card-link-grid|homepage||
|70|Process Stepper|N|steps-reveal|assignment, milestone||
|71|Enrichment Choice Board|N|card-link-grid|recap, content||
|72|Custom RocketCourse Interactive Embed|IF|iframe-embed|editor-only|fb→responsive-card-grid|
|73|Visual Module Launchpad|N|card-link-grid|module-overview|freq|

### Expansion (74–113)
| # | Name | Tier | Template | Pages | Flags / disciplines |
|--:|---|:--:|---|---|---|
|74|Adaptive Remediation Menu|N|reveal-panels|quiz-prep, recap||
|75|Pre-Assessment Routing Panel|IF|iframe-embed|editor-only|grade, fb→adaptive-remediation-menu|
|76|Worked Example Reveal|N|reveal-panels|practice, quiz-prep, content|freq; stem, data, business|
|77|Hint Ladder|N|reveal-panels|practice, quiz-prep||
|78|Socratic Question Chain|N|prompt-list|content, discussion||
|79|Error Diagnosis Tree|N|flaw-repair|practice, assignment|stem, data, business|
|80|Assumption Checker|N|prompt-list|content, discussion||
|81|Counterexample Explorer|N|reveal-panels|content, practice|stem, humanities, social-science|
|82|Analogy Matcher|IF|iframe-embed|editor-only|grade, fb→build-a-definition-activity|
|83|Concept Boundary Tester|N|reveal-panels|content, practice||
|84|Micro-Debate Chooser|N|reveal-panels|discussion|humanities, social-science, business, health|
|85|Stakeholder Priority Matrix|N|matrix-table|content, discussion|business, health, social-science; rare|
|86|Risk-Benefit Matrix|N|matrix-table|content, discussion|business, health, stem; rare|
|87|Cause-and-Effect Chain|N|steps-reveal|content||
|88|Systems Thinking Loop Explorer|IF|iframe-embed|editor-only|fb→cause-and-effect-chain|
|89|Hypothesis Builder|N|steps-reveal|practice, content|stem, data, geography, health|
|90|Experiment Design Planner|N|steps-reveal|practice, assignment|stem, health, geography; rare|
|91|Variable Identification Activity|N|reveal-panels|practice|stem, data, health|
|92|Data Quality Checklist|N|prompt-list|practice, content|data, stem, business, geography|
|93|Chart-Type Chooser|N|reveal-panels|content, practice|data, stem, business, geography|
|94|Geographic Layer Explorer|IF|iframe-embed|editor-only|fb→map-legend-decoder|
|95|Map Legend Decoder|N|figure-panel|editor-only|A:image; geography, stem|
|96|Primary Source Annotation Guide|N|prompt-list|content, practice|humanities, social-science|
|97|Citation Scavenger Hunt|IF|iframe-embed|editor-only|grade, fb→source-credibility-analyzer|
|98|Research Question Refiner|N|steps-reveal|assignment, milestone|humanities, social-science, writing, stem|
|99|Literature Theme Matrix|N|matrix-table|assignment, content|humanities, social-science, writing; rare|
|100|Peer Review Protocol|N|prompt-list|discussion, assignment||
|101|Feedback Interpretation Guide|N|reveal-panels|assignment, recap||
|102|Revision Choice Board|N|card-link-grid|assignment|writing, humanities, social-science|
|103|Study Strategy Selector|N|reveal-panels|quiz-prep, recap||
|104|Exam Wrapper Reflection|N|prompt-list|recap||
|105|Goal-Setting Contract|N|steps-reveal|orientation, milestone, homepage|freq|
|106|Time-Budget Calculator|IF|iframe-embed|editor-only|fb→goal-setting-contract|
|107|Project Milestone Tracker|N|steps-reveal|milestone, assignment||
|108|Team Role Chooser|N|reveal-panels|discussion, assignment||
|109|Group Agreement Builder|N|steps-reveal|discussion, assignment||
|110|Accessibility Self-Audit|N|prompt-list|assignment||
|111|Inclusive Language Review|N|prompt-list|assignment|writing, humanities, social-science, business|
|112|Media Bias Lens Selector|N|prompt-list|content, discussion|humanities, social-science, business|
|113|Transfer Challenge|N|reveal-panels|recap, practice||

**Roll-ups:** editor-only asset-gated (10): #11,17,18,19,31,45,63,66,67,95. iframe (15):
#20,21,27,28,29,48,51,65,72,75,82,88,94,97,106. graded (6): #29,48,51,75,82,97. rare/cap-2 (6):
#17,52,85,86,90,99. frequent (27). Auto-insertable today (native + no asset + has content
builder): **39**.

---

## 8. Test status

`npx vitest run src/data/interactionPatterns.test.ts src/services/interactionRender.test.ts
src/services/interactionSelection.test.ts` → **31 tests**:
- **Registry (6):** 113 count + contiguous numbers; unique ids/numbers; required fields present;
  iframe tier honesty (external hosting + native fallback exists); no native pattern claims
  grading; media patterns are asset-gated + editor-only.
- **Render (12):** every native no-asset pattern renders safe, error-free HTML; unique ids on
  repeat; text escaping; asset-less media omits; **no `<iframe>` while embeds disabled**; native
  fallback for every iframe pattern; compliant iframe only when enabled; external-config
  rejection; interleave order; affordance chips; theme palette (not PDF teal).
- **Selection (13):** discipline inference varies; determinism (identical plan for identical
  course); >10 blocks/course all `generated` with rationale; discipline-appropriate sets;
  ≥2 distinct per surface; density caps; frequency caps; only native no-asset auto-selected;
  composed HTML Canvas-safe + no placeholder text; homepage/syllabus specifics; locked+inserted
  survive regeneration; composition only grows the body; generic-template → 0 blocks.

---

## 9. Audit findings (for the Phase 8–12 decision)

1. **`canvas-native` tier is dead.** 0/113 patterns use it; the type value, its label-map entry,
   and the `describePatternTier` branch (`interactionRender.ts:524`) are unreachable. The
   graded/companion concept is carried by `supportsGrading` on 6 iframe patterns instead. *Action
   later:* either remove the dead tier or repurpose it for genuinely quiz-backed patterns.
2. **Stale density comments.** `interactionSelection.ts:10–13` claims "syllabus 0 · homepage 0",
   but `DENSITY_CAPS` sets both to 2 and the tests confirm homepage/syllabus each get ≥2. The
   **code is correct; the comment is wrong.** *Action later:* fix the comment.
3. **`image-map` name vs. behavior.** The template delegates to `figure-panel` and never emits an
   interactive `<map>/<area>`. Accessible, but misleading. *Action later:* rename, or implement a
   real (accessible) hotspot form behind the iframe tier.
4. **No density profile.** The master prompt's Phase 11 asks for Minimal/Balanced/Rich/Immersive;
   today density is fixed caps + a floor of 2. This would be a **new setting** threaded into
   `interactionSelection.ts` (caps become a function of the profile) — a self-contained,
   low-risk addition that does not touch export.
5. **No explicit course-wide distribution target.** Phase 9 asks for ~40 standard + ~20
   course-specific (~60 total) on a full course. Today the total is emergent (>10 in tests) and
   capped only per-surface / per-frequency. A target would be a check in the planner, not a
   generator rewrite.

### What Phases 8–12 would (and would not) touch
- **Recommendation engine (Phase 8):** the deterministic selector already exists and is the right
  home; an AI-assisted layer would sit *beside* it (propose, then validate through the same safety
  path), not replace it. **Would not** touch `htmlSafety`/export.
- **Density controls + targets (Phases 9, 11):** localized changes to `interactionSelection.ts`
  caps/floors + a settings field. **Would not** touch export.
- **Pattern composer / manual control (Phase 11):** a new editor surface over the existing
  registry + `buildEditorSampleContent`; additive.
- **The one place to be careful (Phase 12 / export):** interaction blocks already interleave into
  exported HTML via `composeBodyWithInteractions`. Any change there needs the existing
  `interactionRender`/`imsccExport` test suites as a regression guard, and must keep external
  embeds gated so the export stays Canvas-safe by default.

> **Bottom line:** the library is in strong shape — 113 typed patterns, Canvas-safe by
> construction, accessible, deterministically selected and inserted, and covered by 31 tests. The
> Phase 8–12 work is mostly *additive* (recommendation layer, density profiles, distribution
> targets, composer UI) and can be done without weakening export safety; only the export-composition
> path warrants regression care. This audit is the map; no code was changed to produce it.
