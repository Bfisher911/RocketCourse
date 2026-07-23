# Nine Workflow Experiences — Foundation Slice

This is the **foundation slice** of the nine-workflow platform, built on the feature branch
`feature/nine-workflows-units-design`. It is additive and self-contained: it does **not** modify
`src/App.tsx`, routing, course generation, or IMSCC export, and all 801 existing tests still pass.

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
Start the existing dev server, then open the preview page:

```bash
npm run dev
```
Open **http://localhost:5173/workflows.html**

Guided Course Journey (W02) is the default. Use the numbered "Shared context" strip to move,
then "Change experience" — the course content and your place are preserved across the switch.

## What is intentionally NOT in this slice (next slices)
- Replacing the prototype `session` seam with an **adapter over the real `CourseProject`**.
- Wiring **W01 Original** to the live editor, and integrating the selector into the main app
  flow (onboarding / workspace / preferences) — Phases 3–6 continue there.
- The **command palette** (Phase 5), the **Canvas pattern library audit + recommendation engine**
  (Phases 7–12), full **React experience components** and the **test suite** for switching
  (Phase 15), and the **Netlify preview** (Phase 14 — deferred; deploy skipped by request).

## Documents in this folder
- `CAPABILITY_PARITY_MATRIX.md` — every capability × nine experiences (no required capability dropped).
- `EXPERIENCE_REGISTRY.md` — the registry, preference hierarchy, how to add an experience.
- `SWITCHING_BEHAVIOR.md` — the switching contract and context mapping.

## Safety / status
- Branch: `feature/nine-workflows-units-design` (never merged to `main`).
- Baseline before changes: typecheck clean, 801/801 tests. After this slice: typecheck clean,
  801/801 tests. No generation/export/IMSCC code touched. Nothing deployed.
