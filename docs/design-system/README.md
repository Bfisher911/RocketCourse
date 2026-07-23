# RocketCourse Design System — Units-Inspired (foundation)

An original RocketCourse visual language that translates the *interaction and visual character* of
the reference site (units.gr) — a visible grid, saturated energy colors, editorial display type,
numbered navigation, rounded modular panels, soft ambient depth — into a dense, accessible
education/course-authoring application. **No reference brand assets, names, logos, photography, or
page compositions are copied.** See `UNITS_REFERENCE_TRANSLATION.md`.

## Scope of this foundation slice
- Token layer: `src/design-system/tokens/rc-tokens.css`, **scoped to `[data-rc-ds]`** so it does
  not restyle the existing cosmic-dark app. Applied only to the new nine-workflow shell (Experience
  Selector, utility strip, numbered nav, Workflow Host chrome).
- The design language is proven on the Experience Selector and shell; a full application-wide
  rollout is a later, separately-reviewed slice (the implementation sequence says: stabilize the
  shared system before restyling every screen).

## Semantic tokens (complete list)
Foundation: `--rc-ink`, `--rc-paper`, `--rc-paper-bright`, `--rc-grid-line`, `--rc-muted-ink`,
`--rc-border`.
Energy: `--rc-blue #0072E3`, `--rc-yellow #FFB200`, `--rc-orange #F85D31`, `--rc-green #00B85B`,
`--rc-lilac #C79DFA`, `--rc-raspberry #E83D73`.
Semantic (always paired with a label/icon/shape — never color alone): `--rc-action`,
`--rc-attention`, `--rc-generate`, `--rc-success`, `--rc-ai`, `--rc-danger` (accessible red
`#C0281B`, since raspberry fails AA for text on white), `--rc-info`, each with an `-ink` companion.
Radii `--rc-radius-xs…xl` + `-pill`. Spacing `--rc-space-1…24` (4px base). Type
`--rc-font-display` (Archivo Black), `--rc-font-ui` (Inter), `--rc-font-mono` (Space Mono).
Borders/shadow (soft ambient, no glass/neon). Motion `--rc-motion-fast/standard/emphasis` + eases.
Z-index, focus (`--rc-focus` = 3px blue).

## Typography & licensing
Display **Archivo Black**, UI **Inter**, mono **Space Mono** — all open-source (SIL OFL / Google
Fonts), loaded on the preview page. No proprietary reference font is used.

## Accessibility posture (design-system feature, WCAG 2.2 AA target)
- Color never carries meaning alone (text label + shape/border + accent).
- Contrast chosen deliberately: black on yellow/orange/paper; white on blue/green only where
  verified; dark ink on light lilac for AI surfaces; accessible red for danger text.
- Visible focus rings on every interactive element; ≥44px primary touch targets; the grid device
  is kept out from behind dense text and reduces on mobile.
- `prefers-reduced-motion` collapses transitions; dark-mode token overrides are prepared (warm
  near-black, not a mechanical invert).

## Application vs. generated Canvas course
The application uses this Units-inspired language. **Generated Canvas courses do not** — they keep
the chosen course theme, Canvas-safe HTML/CSS, and institution branding. The app shell is never
injected into exports. (This slice changes no export behavior.)

## Docs in this folder
- `README.md` (this file) · `UNITS_REFERENCE_TRANSLATION.md`. Further docs (COLOR, TYPOGRAPHY,
  MOTION, COMPONENTS, RESPONSIVE, ACCESSIBILITY, VISUAL_QA) follow with the app-wide rollout slice.
