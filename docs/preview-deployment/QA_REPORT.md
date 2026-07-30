# QA Report — Nine Workflow Experiences + Units Design System

**Branch:** `feature/nine-workflows-units-design` (never merged; nothing deployed)
**Baseline before work:** typecheck clean · 801/801 tests · `main` @ `fcbbfb7`
**Now:** typecheck clean · **840/840 tests (95 files)** · build + prerender clean

---

## 1. What was verified, and how

Verification was done against the **running app** (`npm run dev`, port 5199) on the
deterministic demo course ("AI and Modern Society"), plus automated suites. An in-page
WCAG auditor was injected to measure real composited contrast rather than eyeballing.

> One methodology note, recorded because it changed the result: the first auditor
> composited stacked translucent layers top-down and forced alpha to 1, which produced
> ~40 **false** failures in the original editor. The corrected version collects
> translucent layers up to the first opaque ancestor and composites bottom-up
> (painter's order). All figures below use the corrected auditor.

## 2. Contrast — WCAG 2.2 AA

Ratio ≥ 4.5:1 body text, ≥ 3:1 large text. Measured on composited colors.

| Surface | Text nodes checked | Failures |
|---|--:|--:|
| Landing | 109 | **0** |
| Pricing | 110 | **0** |
| Guides | 172 | **0** |
| About | 57 | **0** |
| Contact | 28 | **0** |
| Blog | — | **0** |
| W01 Original editor | 249 | **0** |
| W02 Guided Journey | 74 | **0** |
| W03 Blueprint Studio | 54 | **0** |
| W04 Course Map | 72 | **0** |
| W05 Course Partner | 70 | **0** |
| W06 Task Command Center | 36 | **0** |
| W07 Visual Storyboard | 35 | **0** |
| W08 Guided & Expert | 37 | **0** |
| W09 Wildcard Desk | 125 | **0** |

Same sweep re-run at **390 px**: 0 failures.

### Contrast fixes made
| Issue | Was | Now |
|---|---|---|
| Blue used as small text on paper | `#0072E3` → 4.04–4.08:1 | Role split: `--cyan #0072E3` = fills; **`--accent #0060c4` = text** (≥4.9:1 on every paper tint; also lifts white-on-blue fills to ~6:1) |
| `.guide-warning` | pale pink on pink, **1.14:1** | ink-red on tint, passes |
| `.outcome-chip` / `.outcome-tag` | dark-theme pales | ink / accent on paper |
| `.tier-canvas-native`, integration icons | `#97a7f0`, pale cyan | `var(--accent)` |
| Experience pills (`--ok`, `--danger`) | `#00b85b` at 12px = 2.28:1 | `#00753b` / `#c0281b` |

## 3. Token-collision bug (caught in QA, fixed)

`brand.css` loads **after** `styles.css` and defined its own `--rc-*` names — including
`--rc-orange` — silently overriding the Units design tokens. Brand-identity tokens are now
namespaced `--brand-*` (the logo keeps its colorful identity); the three cross-file
consumers were mapped onto Units semantics (`--rc-card-bg`→`--surface`,
`--rc-border-glow`→`--line-strong`, `--rc-cyan`→`--cyan`).

## 4. Cosmic-device removal

- Cosmic hexes (`#05060f #080a1c #0c0f2a #101b5f #1a1450 #11142e`) remaining: **0**
- `backdrop-filter` declarations not `none`: **0**
- Neon glows → hairline ring + soft ambient shadow; gradients → flat two-stop paints
  (kept valid so any `background-clip:text` headline stays visible, never invisible)
- `color-scheme` flipped to light; display face → **Archivo Black**, mono → **Space Mono**

## 5. Responsive

At **390 px**, horizontal scroll across all nine editor states: **none**.

> Root cause found and fixed here: the experiences' responsive rules are `@container`
> queries (so one stylesheet serves both the lab's viewport frame and the app). The SPA
> stage was not a query container, so **none of their collapses were firing** — 4 of 5
> experiences overflowed. Adding `container-type: inline-size` to `.rc-workflow-stage`
> fixed all of them.

Also fixed: the mobile topbar wordmark overflowed its grid cell and collided with the
Menu button (< 600 px); the logo mark alone now carries the brand there.

**Touch targets:** a `@media (pointer: coarse)` floor raises every interactive control
(nav toggle, profile trigger, step links, chips, icon buttons, selects, inputs) to
≥ 44 px on touch devices without inflating dense desktop layouts.

**Reduced motion:** 11 `prefers-reduced-motion` blocks active, including a blanket
animation/transition kill inside the design-system scope.

## 6. The core product guarantee (automated)

`src/workflows/exportInvariance.test.ts` proves what the whole feature rests on:

1. Mounting **all eight** experience renderers over a real course and driving each
   through all 12 shared context pointers calls `updateCourse` **zero** times, leaves the
   course JSON **byte-identical**, and yields an **identical .imscc manifest**.
2. An edit made *through an experience* produces the **same package** as the identical
   edit applied directly to the model.

Supporting suites: `courseAdapter.test.ts` (15 round-trip/derivation/purity tests —
including "construct + refresh never writes" and "each action is one pure, idempotent
updater"), `experienceSmoke.test.ts` (10), `experienceRegistry.test.ts` (7),
`workflowContext.test.ts` (5).

**No app design leaks into exports:** `grep -c -- "--rc-"` in `imsccExport.ts`,
`interactionRender.ts`, `themeDesign.ts` → **0, 0, 0**. Generated Canvas courses keep
their own course theme.

## 7. Functional walkthrough (live, demo course)

- Guided Course Journey is the **default** experience on entering the editor.
- All ten editor states mount with the global header intact and **zero console errors**.
- Switching W02 → W03 lands on the same module with identical content (same incomplete
  rubric and AI-draft flags) — presentation changed, content did not.
- A page edit made inside an experience commits through `updateCourse`, survives
  experience switches, and **Cmd+Z undoes it** (the existing undo stack, unmodified).
- W01 renders the original tabbed editor, behavior untouched.
- Every experience now shows the **real** course (title, description, level/modality,
  live counts, real source-file count with an honest "No files attached" empty state).
  All invented copy — "A first-year seminar…", "4 files parsed", "13 modules, 22 pages",
  "PHIL 1200 · Riverbend University" — is gone.

## 8. Known limitations (honest)

Resolved since first draft:
- ~~Side-rail stickiness inside the SPA~~ → **Fixed.** Persistent measured chrome + a
  cancellable `host.show()` (no double-mount); rails pin cleanly through the full scroll
  at wide widths and go static in single-column bands (commit `855492c`).
- ~~Command palette (Phase 5) not built~~ → **Shipped** (⌘K, shared across experiences).
- ~~Pattern-library work (Phases 7–12) not started~~ → **Audit + Phase 8 recommendation
  layer + Phase 9 distribution + Phase 11/12 manual insertion shipped.** Density profiles
  live in `interactionSelection.ts`.
- Experience discoverability → a per-course "Open in <experience>" entry point now exists
  on the dashboard (commit `6cf795e`), in addition to the editor chrome switcher.

Still open:
1. **Chrome is a single strip, not yet a full command surface.** Undo/redo, Review and
   Export still live in the original editor's own toolbar (W01); the palette (⌘K) now
   provides those actions across experiences, but the chrome strip itself shows course,
   experience switcher, readiness and autosave only.
2. **No preview deployment.** Netlify deploy needs owner credentials (ledger BLK-1); all
   verification here is local.
3. Storyboard and Wildcard are registered `desktop`/`tablet` only.

See `docs/production-readiness/ledger.md` for the full production-loop findings and the
external blockers (Netlify deploy, live AI, Supabase/RLS, Stripe test-mode, Canvas import,
Lighthouse).

## 9. Commands

```bash
npm run dev        # app at http://localhost:5199 (see .claude/launch.json)
npm run typecheck  # clean
npm test           # 840/840
npm run build      # clean + prerender
```

`/workflows.html` still serves the original mock-data lab in dev; it is excluded from
production builds.
