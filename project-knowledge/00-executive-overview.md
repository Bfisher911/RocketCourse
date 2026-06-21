# Executive Overview

## What CourseForge Appears To Be

CourseForge Canvas Builder is a focused React/Vite MVP for turning a course idea, guided settings, and optional source-file metadata into an editable Canvas LMS course shell, then exporting that shell as a browser-generated `.imscc` package. The clearest source of truth is the implemented app in `src/App.tsx`, the deterministic generator in `src/services/courseGenerator.ts`, the export engine in `src/services/imsccExport.ts`, the readiness service in `src/services/readiness.ts`, and the product plan in `docs/COURSEFORGE_MVP_PLAN.md`.

The current product category is best described as:

- AI course builder prototype.
- LMS companion for Canvas.
- Instructional design/content creation tool.
- Assessment and rubric starter.
- Micro-SaaS style MVP, but without production SaaS infrastructure yet.

It is not currently a full LMS, real multi-user SaaS, student portal, production auth system, production billing system, or Canvas API publisher.

## Core Purpose

The core purpose is to help instructors and instructional designers create a structured first draft of a Canvas course shell faster than building one manually. The product creates native course-like objects: homepage, syllabus, modules, pages, discussions, quizzes, assignments, rubrics, gradebook groups, contact-hour estimates, and theme settings.

Evidence:

- `README.md` describes the app as a focused MVP for generating, editing, validating, and exporting a Canvas-oriented `.imscc` course package.
- `docs/COURSEFORGE_MVP_PLAN.md` says the MVP promise is generating a structured, editable course and exporting a Canvas-ready package.
- `src/types.ts` defines the internal course model used by the app.
- `src/services/courseGenerator.ts` builds the generated sample course objects.
- `src/services/imsccExport.ts` packages those objects into Common Cartridge/Canvas-oriented files.

## Target Users

The intended users appear to be:

- Individual instructors who build Canvas courses themselves.
- Instructional designers who need a fast first draft.
- Department or school staff preparing repeated Canvas course shells.

This is stated directly in `docs/COURSEFORGE_MVP_PLAN.md`. In the current implemented app, there is only one browser user with local state. The app does not currently distinguish instructor, designer, admin, student, or institution-level users in code.

## Main Problem It Solves

CourseForge solves the "blank Canvas shell" problem: a user can start from a plain-English course idea and produce a structured course package with editable instructional objects and a local validation report. It especially targets the tedious parts of course setup:

- Creating modules and module item sequences.
- Drafting homepage and syllabus content.
- Drafting discussions, quizzes, assignments, and rubrics.
- Aligning outcomes and workload.
- Producing a downloadable Canvas-oriented `.imscc` package.

## What The App Currently Does For A User

From a user's point of view, the current app supports:

- Landing page with the CourseForge value proposition (`src/App.tsx`, `Landing`).
- Dashboard showing local course projects, export count, and simulated subscription status (`src/App.tsx`, `Dashboard`).
- Intake screen with a prompt, guided course settings, toggles, theme choice, and file attachment metadata (`src/App.tsx`, `Intake`).
- Simulated generation progress using timed steps (`src/App.tsx`, `Progress` and the `useEffect` generation flow).
- Deterministic course generation, not a live AI call (`src/services/courseGenerator.ts`).
- Editor with tabs for overview, homepage, syllabus, modules, pages, assignments, discussions, quizzes, rubrics, gradebook, contact hours, theme, and export (`src/App.tsx`, `editorTabs` and `Editor`).
- Drag-and-drop module and module-item reordering (`src/App.tsx`, `reorderModule` and `reorderModuleItem`).
- Static "AI revise" buttons that append canned HTML snippets (`src/App.tsx`, `reviseActiveContent`).
- Readiness scoring (`src/services/readiness.ts`).
- Browser-side `.imscc` generation and download when simulated subscription is active (`src/services/imsccExport.ts`, `src/App.tsx`).

## What The App Currently Does For An Admin Or Owner

There is no implemented admin or owner console. The product owner can currently:

- Run the prototype locally.
- Demonstrate course generation and export.
- Toggle simulated subscription state in the top bar.
- Review generated package validation results.
- Use the existing README and MVP plan as implementation context.

No production admin functions exist for users, tenants, billing, usage, Canvas imports, AI costs, or system health.

## Current Working Status

The prototype builds and tests successfully:

- `npm run build` passed on June 19, 2026. It runs `tsc -b && vite build`.
- `npm test` passed on June 19, 2026. Vitest reported 1 test file and 2 tests passing.

Unavailable checks:

- `npm run lint` failed because no `lint` script exists.
- `npm run typecheck` failed because no standalone `typecheck` script exists, though build does run TypeScript.

## Important Assumptions And Unknowns

- "Canvas-ready" means locally package-shaped, not Canvas sandbox verified. The README, fixture README, and MVP plan all warn that Canvas sandbox import verification is still required.
- The AI behavior is currently deterministic simulation. No OpenAI SDK, API route, fetch call, environment variable, token tracking, or retry logic exists in source.
- The current "subscription" is a boolean in React state and is not secure.
- Uploaded files are not parsed, persisted, or used by generation. Only name and size are stored in local state.
- There is no database, Supabase project, migration, RLS policy, storage bucket, or server-side auth in this repo.
- There are no URL routes. The app uses an internal `Screen` state in `src/types.ts` and conditional rendering in `src/App.tsx`.

