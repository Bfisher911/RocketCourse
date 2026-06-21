# One-Page Product Brief

## Product Name

CourseForge Canvas Builder.

## Working Status

Working local React/Vite prototype. It builds and tests successfully, but it is not production SaaS. There is no backend, auth, database, billing, real AI provider, or verified Canvas sandbox import yet.

## Product Purpose

CourseForge helps instructors and instructional designers turn a course idea, syllabus, notes, or settings into an editable Canvas course shell and export it as a Canvas-oriented `.imscc` package.

## Target Users

- Individual instructors.
- Instructional designers.
- Department or school staff building repeatable Canvas course shells.

## Core Workflows

1. User lands on the app.
2. User enters a prompt and course settings.
3. App shows simulated generation progress.
4. Deterministic generator creates a structured course project.
5. User edits homepage, syllabus, modules, pages, assignments, discussions, quizzes, rubrics, gradebook, contact hours, and theme.
6. Readiness panel reports quality checks.
7. User validates and downloads a browser-generated `.imscc` package if simulated subscription is active.

## Current Tech Stack

- React 18.
- Vite.
- TypeScript.
- JSZip for browser-side package generation.
- Lucide React icons.
- Vitest.
- Plain CSS in `src/styles.css`.

## Current Features

- Landing page.
- Local dashboard.
- Intake prompt/settings screen.
- Metadata-only file attachment UI.
- Deterministic course generation.
- Generated sample project.
- Broad editable course model.
- Drag-and-drop module and item ordering.
- Static AI-revise toolbar.
- Readiness scoring.
- Browser-side Canvas/Common Cartridge package generation.
- Local export validation.
- Simulated subscription/export gating.

## Known Incomplete Areas

- No auth or user roles.
- No database or persistence.
- No real OpenAI/AI calls.
- No source file parsing.
- No Stripe/billing.
- No server-side entitlement enforcement.
- No Canvas API publishing.
- Canvas import not verified.
- Quiz QTI export likely incomplete.
- Limited quiz/rubric editing.
- No deployment config.
- No lint/typecheck scripts.

## Strategic Direction

The strongest path is to treat the current app as a local proof of product and export architecture, then harden in this order: Canvas sandbox verification, export correctness, persistence/auth, clearer demo messaging, file parsing, real AI generation, billing, and team/workspace support.

## Key Open Questions

- Is CourseForge the final brand?
- Who is the first paying customer?
- Is `$20/mo` real pricing?
- What should be gated: export, AI generation, teams, or all of the above?
- Will launch claim Canvas-ready only after sandbox import passes?
- Does the product need student access, or only instructor/designer access?
- Which AI provider/model and usage limits should be used?
- How long should uploaded course materials be retained?

