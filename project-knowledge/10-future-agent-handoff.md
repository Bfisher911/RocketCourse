# Future Agent Handoff

## What The App Is

CourseForge Canvas Builder is a React/Vite/TypeScript prototype for generating, editing, locally validating, and exporting Canvas-oriented `.imscc` course packages. It currently runs entirely in the browser with deterministic local generation.

It is not yet a production SaaS. There is no backend, database, auth, billing, OpenAI integration, Canvas API integration, or deployment config.

## Current Repo Location

Use:

```bash
cd /Users/blainefisher/Documents/CourseForge
```

Note: The original task context path was `/Users/blainefisher/Documents/Prompt to Canvas SaaS`, but the repo was found at `/Users/blainefisher/Documents/CourseForge` during this sweep.

## How To Run Locally

```bash
npm install
npm run dev
```

README says the dev server runs at:

```text
http://localhost:5173/
```

## Useful Commands

```bash
npm run build
npm test
```

Current known command status:

- `npm run build` passes.
- `npm test` passes.
- `npm run lint` is missing.
- `npm run typecheck` is missing as a standalone script.

## Required Environment Variables

None currently.

Future production work will likely need variables for:

- Supabase URL/key or chosen backend.
- OpenAI API key.
- Stripe keys/webhook secret.
- Hosting/deployment settings.
- Error reporting/analytics.

## Main Folders To Understand First

- `src/`: application source.
- `src/services/`: generation, readiness, export engine.
- `src/data/`: default settings and themes.
- `docs/`: product/MVP plan.
- `fixtures/canvas-export-reference/`: placeholder for a known-good Canvas export fixture.
- `project-knowledge/`: current repo knowledge base.

## Central Files

- `src/App.tsx`: single largest file; contains all screens, navigation, editor UI, state mutation, file metadata handling, simulated subscription, export action.
- `src/types.ts`: domain model.
- `src/services/courseGenerator.ts`: deterministic generation and sample project.
- `src/services/imsccExport.ts`: package generation and validation.
- `src/services/readiness.ts`: readiness scoring.
- `src/services/imsccExport.test.ts`: current test coverage.
- `docs/COURSEFORGE_MVP_PLAN.md`: product plan and future architecture.
- `README.md`: local setup and Canvas compatibility caveat.

## Files To Edit Carefully

- `src/services/imsccExport.ts`: Small changes can break package structure. Add tests before changing export paths, identifiers, or manifest logic.
- `src/types.ts`: Core data model. Changes ripple through generator, editor, readiness, and export.
- `src/App.tsx`: Large component with many state transitions. Avoid broad refactors unless requested.
- `src/services/courseGenerator.ts`: Generated content shape affects readiness, editor assumptions, and export package.

## Common Patterns

- State is immutable React state updates.
- Course objects are plain TypeScript objects.
- IDs are deterministic strings from `slugify` plus prefixes.
- Generated HTML is stored as strings.
- Readiness report is recomputed with `useMemo`.
- Export validation returns report objects rather than throwing for expected validation issues.
- UI screens are internal state, not URL routes.

## Common Mistakes To Avoid

- Do not assume auth exists.
- Do not assume uploads are parsed.
- Do not claim Canvas import compatibility without sandbox evidence.
- Do not treat `subscriptionActive` as real billing.
- Do not add OpenAI calls directly in the browser.
- Do not edit package paths in export code without tests.
- Do not add database assumptions without an actual schema/migration.
- Do not present future MVP-plan entities as implemented tables.
- Do not forget that generated HTML is user-editable.

## Known Unfinished Areas

- Auth/account system.
- Database/persistence.
- Real AI generation.
- Source file parsing.
- Stripe billing.
- Server-side export entitlement.
- Canvas sandbox import verification.
- Full QTI quiz export.
- Rich rubric editing.
- Add/delete controls for course objects.
- Autosave/version history.
- Deployment config.
- Lint/typecheck scripts.

## Current Priorities Inferred From The App

1. Verify Canvas import compatibility.
2. Add persistence and a real project ownership model.
3. Clarify demo/AI/Canvas-ready messaging.
4. Implement source parsing or remove upload affordance.
5. Deepen quiz/rubric export and editing.
6. Add real billing/auth only after business model decisions.

## Suggested Order Of Future Development

1. Add lint and typecheck scripts.
2. Add XML parsing validation and stronger export tests.
3. Create a Canvas sandbox fixture and import checklist.
4. Fix QTI quiz serialization.
5. Add local persistence or backend persistence.
6. Add object create/delete controls.
7. Fix module move/duplicate data consistency.
8. Add safe HTML sanitization/validation.
9. Decide product claims/pricing/demo language.
10. Implement auth, billing, and AI server-side.

