# CourseForge Canvas Builder

CourseForge Canvas Builder is a focused MVP for generating, editing, validating, and exporting a Canvas-oriented `.imscc` course package.

## What Is Built

- React + Vite + TypeScript SaaS prototype.
- Landing page, dashboard, intake wizard, generation progress, editor workspace, readiness panel, and export flow.
- Deterministic structured course generator for local demos.
- Editable course model: homepage, syllabus, modules, pages, assignments, discussions, quizzes, rubrics, gradebook groups, contact hours, and theme.
- Drag-and-drop module and module-item reordering.
- Browser-side `.imscc` package builder using JSZip.
- Local package validation and Vitest coverage for readiness/export structure.

## Commands

```bash
npm install
npm run dev
npm run build
npm test
```

The dev server runs at `http://localhost:5173/`.

## Supabase + Netlify

CourseForge is wired for Supabase through Vite environment variables:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here
```

For local development, copy `.env.example` to `.env.local` and fill in the values from Supabase. For Netlify, add the same variables under Site configuration -> Environment variables. The included `netlify.toml` uses `npm run build` and publishes `dist`.

The app header shows `Supabase connected` when both public variables are present.

## Canvas Compatibility Note

The MVP package builder follows public Canvas LMS exporter structure and Common Cartridge concepts, but production compatibility should not be claimed until generated packages are imported into a Canvas sandbox and compared against a known-good Canvas export fixture. Add that fixture under `fixtures/canvas-export-reference/` when sandbox access is available.

See `docs/COURSEFORGE_MVP_PLAN.md` for the PRD, architecture, data model, AI pipeline, export strategy, implementation plan, risks, and acceptance criteria.
