# Nine Workflow Experiences — Production Integration

Branch `feature/nine-workflows-units-design`. The nine experiences now run **inside the app over
the real course**: the editor screen renders either the untouched original Editor (W01) or a
workflow experience (W02–W09) bound to the live `CourseProject` through the CourseAdapter. Course
generation and IMSCC export code remain untouched; the original 801 tests still pass alongside the
new workflow suites.

## Architecture (as shipped)
- **CourseAdapter** (`src/workflows/courseAdapter.ts`) — bidirectional facade:
  `refresh()` maps the real course into the session shape the experience widgets consume
  (in place, identity-preserving; readiness/attention/review/export surfaces are *derived*
  from `buildReadinessReport`/`buildCourseQualityReport`, never stored); `commit()` maps facade
  edits back as **one pure, change-detected updater** through App's `updateCourse` — so workflow
  edits get undo, autosave, and project-list sync identically to the original editor.
- **WorkflowHost** (`src/components/WorkflowHost.tsx`) — React lifecycle around the experience
  renderers; binds the adapter before mount, refreshes on every course change, injects App-owned
  export/validation hooks.
- **ExperienceChrome** (`src/components/ExperienceChrome.tsx`) — the shared utility strip on the
  editor screen (course · W-code + accessible switcher · readiness · autosave) across all ten
  editor states.
- **Selection** — `?exp=` deep link → per-course preference → user preference → Guided default.
- **View state** (`src/workflows/adapterViewState.ts`) — presentation-only per-course flags
  (acknowledged advisories, export-step state); never stored on the course.

## What ships in this slice
- **Units-inspired design-system token layer** — `src/design-system/tokens/rc-tokens.css`
  (scoped to `[data-rc-ds]`, so it never restyles the existing app). See `docs/design-system/`.
- **Typed experience registry** — `src/workflows/experienceRegistry.ts` (all nine experiences).
- **Experience Selector** — `src/workflows/selector.ts` (a curated gallery; W-codes, Recommended
  default, "switching won't change content" promise; Use / Try demo / Set-as-default).
- **Workflow Host + shared context** — `src/workflows/host.ts` + `workflowContext.ts`. Renders any
  experience over ONE shared course and **preserves the user's place** when switching.
- **The eight verified experiences** — brought in under `src/workflows/prototypes/` from the
  discovery lab; they already share one mutable course, which is exactly the "one course, many
  experiences" seam.
- **A standalone dev entry** — `workflows.html` + `src/workflows/main.ts`.

## Run it (local; no deploy)
```bash
npm run dev
```
Open the app (default dev port; `.claude/launch.json` pins **http://localhost:5199**), enter the
demo or an existing course — the editor screen opens in **Guided Course Journey (W02)** by
default with the Experience switcher in the utility strip. `?exp=<id>` deep-links any
experience. The mock-data lab remains available in dev at `/workflows.html` (excluded from
production builds).

## Command palette (Phase 5, shipped)
`⌘K` / `Ctrl+K` (or the "⌘K Commands" chip in the chrome) opens one shared command
surface across every editor state:
- **Content** — Open any module or item; routes through the current experience's focus
  handle (`WorkflowHost.focusRef`/`focusModule`) so "Open Week 4" navigates *inside* the
  live experience, or, in W01, jumps to the matching editor tab.
- **Experience** — switch to any of the other eight.
- **Navigate / Actions** — Dashboard, editor tabs (W01), run validation, download,
  Review Mode, undo/redo (capability-gated).
Registry: `src/workflows/commandRegistry.ts`; component: `src/components/CommandPalette.tsx`
(accessible dialog, token filter, arrow-key nav). Each concept exposes
`focusRef`/`focusModule`, verified side-effect-free by `experienceSmoke.test.ts`.

## Not yet built (future phases)
- Dashboard-level experience switcher entry.
- The **Canvas pattern library audit + recommendation engine** (Phases 7–12).
- The **Netlify preview** (Phase 14 — deploy deferred at the owner's request).

## Documents in this folder
- `CAPABILITY_PARITY_MATRIX.md` — every capability × nine experiences (no required capability dropped).
- `EXPERIENCE_REGISTRY.md` — the registry, preference hierarchy, how to add an experience.
- `SWITCHING_BEHAVIOR.md` — the switching contract and context mapping.

## Safety / status
- Branch: `feature/nine-workflows-units-design` (never merged to `main`).
- Baseline before changes: typecheck clean, 801/801 tests. After this slice: typecheck clean,
  801/801 tests. No generation/export/IMSCC code touched. Nothing deployed.
