# Canvas interactive pattern system

Implements the RocketCourse Canvas Interactive Pattern Library (113 patterns,
July 2026 PDF) as a production system: a typed registry, a theme-aware renderer,
a deterministic selection engine, structured blocks on course objects, an editor
library, validation, and IMSCC export integration.

## Architecture

| Piece | File | Role |
| --- | --- | --- |
| Registry | `src/data/interactionPatterns.ts` | All 113 patterns with number, name, category, tier, template shape, purposes, page types, disciplines, complexity, frequency, asset requirements, grading boundary, fallback, a11y notes |
| Renderer | `src/services/interactionRender.ts` | `renderInteractionBlock` / `composeBodyWithInteractions`; ~18 shared template shapes, all inline-styled from `getThemeStyles(theme)`; unique ids per block; escaping everywhere |
| Validation | `src/services/interactionValidation.ts` | Structural checks layered on `htmlSafety.ts`: duplicate ids, dead/placeholder links, unfinished template text, iframe policy, table headers, alt text, heading order |
| Selection | `src/services/interactionSelection.ts` | `planCourseInteractions` / `applyCourseInteractions`; page classification, discipline inference, density caps, per-module no-repeat, frequency caps, deterministic rotation; ~30 course-specific content builders |
| Blocks | `src/types.ts` | `InteractionBlock` (+ `InteractionContent`, `ExternalInteractiveConfig`) stored on `CoursePage`, `Assignment`, `Discussion` as `interactionBlocks` |
| Editor | `src/components/InteractionsTab.tsx` | Browse/search all 113, themed preview with real course content, generated-HTML view, insert, reorder, lock, remove; registered as the "Interactions" step in the Content phase |
| Export | `src/services/imsccExport.ts` | Blocks compose AFTER the authored body for pages/assignments/discussions; export link-validation sees the composed HTML |

## Content model

`bodyHtml` stays the instructor's prose. Interaction blocks are structured data
(`patternId` + `InteractionContent`) rendered at preview/export time, so:

- existing courses without blocks are untouched (backward compatible);
- blocks are individually editable, reorderable, removable, and lockable;
- `locked` and instructor-`inserted` blocks survive `applyCourseInteractions`
  regeneration; only unlocked generated blocks are replaced.

## Tier boundaries (honest by construction)

- **Native HTML** — details/summary, cards, checklists, tables, callouts.
  The only tier the selector auto-places.
- **External iframe (15 patterns)** — RocketCourse has no hosted interactive
  service, so these ALWAYS render their declared native fallback (or an
  open-in-new-window link panel when a validated `ExternalInteractiveConfig`
  exists). Actual `<iframe>` emission requires `ExternalEmbedPolicy.enabled`,
  which nothing turns on today; `htmlSafety.ts` continues to treat raw iframes
  as Canvas-hostile, so the export validator is not weakened.
- **Canvas quiz / LTI** — patterns whose graded form needs score passback carry
  `supportsGrading: true` and a note in the editor; a plain iframe never claims
  to return a grade. No LTI credentials are invented.

## Selection rules

- Density caps: module overview 2 · content 1–2 · practice 1–2 · recap 1–2 ·
  assignment 2 · discussion 1 · milestone 1 · orientation ≤1 · homepage 0 ·
  syllabus 0 (both have their own block systems).
- A pattern never repeats within a module; `rare` patterns ≤1 per course,
  `selective` ≤3; rotation by module position keeps adjacent modules varied.
- Discipline gating: e.g. `variable-identification-activity` never appears in a
  literature course; `primary-source-annotation-guide` never in a management
  course (covered by tests across humanities/STEM/geography/business/health
  fixtures).
- Only patterns with a content builder are auto-selected; builders write
  course-specific content (module topic, objectives, real rubric criteria,
  Canvas links via `canvasLinks.ts` tokens). If content can't be built, the
  pattern is skipped — never an unfinished shell.
- Generic-template courses (`contentDepth: "generic-template"`) get no blocks.

## Theming

All markup uses inline styles resolved from the course theme (`accent`,
`accentDark`, `soft`, `border`, `canvasText`, `mutedText`, `onAccentDark`,
`font`). No stylesheet dependency; nothing hard-codes the PDF's teal palette.

## Adding a pattern

1. Add a `def({...})` entry in `interactionPatterns.ts` (next number, unique id).
2. If it needs a new shape, add a renderer in `interactionRender.ts`.
3. Add a content builder in `interactionSelection.ts` and list it in the right
   `PAGE_TYPE_CANDIDATES` slot if it should be auto-selected.
4. Tests in `interactionPatterns.test.ts` enforce completeness automatically
   (update the count when the library grows past 113).

To deprecate: remove it from `PAGE_TYPE_CANDIDATES` first (stops new
selections) — existing courses keep their stored blocks rendering until edited.

## Testing

- `src/data/interactionPatterns.test.ts` — registry completeness/uniqueness,
  tier honesty, fallback validity, asset gating.
- `src/services/interactionRender.test.ts` — every native pattern renders
  Canvas-safe validated HTML; id uniqueness; escaping; iframe gating and
  external-config validation; theme-token usage; asset-missing ⇒ omit.
- `src/services/interactionSelection.test.ts` — five discipline fixtures get
  different, appropriate pattern sets; determinism; density/frequency caps;
  lock/insert preservation; homepage/syllabus exclusion; generic-template
  opt-out; composed HTML validity.

Run: `npx vitest run src/data/interactionPatterns.test.ts src/services/interactionRender.test.ts src/services/interactionSelection.test.ts`

## Known limitations

- Canvas sandbox import of an interaction-bearing package is still the final
  verification step (details/summary behavior, mobile rendering in Canvas).
- Media patterns (audio/video/gallery/image-map/figure) are editor-only until a
  real asset URL exists; they intentionally render nothing without one.
- External embeds and LTI remain architectural stubs by design: config model,
  validation, and rendering exist; no host or credentials do.
