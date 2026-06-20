# Known Issues And Technical Debt

## Check Results

Commands run on June 19, 2026 from `/Users/blainefisher/Documents/CourseForge`:

| Command | Result | Meaning |
| --- | --- | --- |
| `npm run lint` | Failed: `Missing script: "lint"` | No lint script exists |
| `npm run typecheck` | Failed: `Missing script: "typecheck"` | No standalone typecheck script exists |
| `npm run build` | Passed | Runs `tsc -b && vite build`; TypeScript and production bundle passed |
| `npm test` | Passed | Vitest ran 1 file and 2 tests successfully |

## Issues

### 1. No Authentication Or Real Permissions

Severity: blocker.

Where it appears:

- `src/App.tsx`
- `src/types.ts`
- `docs/COURSEFORGE_MVP_PLAN.md`

Why it matters:

The app cannot be launched as a SaaS without real user identity, project ownership, role checks, and server-side access control.

Recommended fix:

Implement auth, user/project ownership, route guards, and server-side policies before public beta.

Can coding agent fix directly?

Partly. Human owner must choose auth provider and account model first.

### 2. No Database Or Persistence

Severity: blocker.

Where it appears:

- All app state in `src/App.tsx`
- No database files in repo

Why it matters:

Projects, edits, exports, and upload metadata are lost on refresh.

Recommended fix:

Add persistence. For production, use a real database schema mapped intentionally from `src/types.ts`.

Can coding agent fix directly?

Partly. Human owner should confirm Supabase/Postgres or another backend.

### 3. Canvas Import Compatibility Is Unverified

Severity: blocker for production claims.

Where it appears:

- `README.md`
- `fixtures/canvas-export-reference/README.md`
- `docs/COURSEFORGE_MVP_PLAN.md`
- `src/services/imsccExport.ts`

Why it matters:

The app can produce a local package, but the package has not been proven to import correctly into Canvas.

Recommended fix:

Import generated packages into a Canvas sandbox, collect failures, compare against a known-good Canvas export fixture, then update export code and validation.

Can coding agent fix directly?

Only if Canvas sandbox access or fixture export is provided. Human owner must provide access or exported reference package.

### 4. Quiz QTI Export Is Likely Incomplete

Severity: high.

Where it appears:

- `src/services/imsccExport.ts`, `createAssessmentQtiXml`
- `src/types.ts`, `QuizQuestion`

Why it matters:

Generated quiz objects have choices, correct answers, feedback, and points, but export currently writes only simple QTI item presentation/metadata. Canvas may import empty or unusable quiz questions.

Recommended fix:

Implement full QTI serialization for supported question types and verify with Canvas sandbox import.

Can coding agent fix directly?

Partly, but Canvas validation requires fixture/sandbox access.

### 5. Uploads Are Metadata-Only

Severity: high.

Where it appears:

- `src/App.tsx`, `handleFiles`
- `src/types.ts`, `SourceFile`

Why it matters:

The UI suggests users can attach syllabus/notes/reading lists, but no file content is parsed or used for generation.

Recommended fix:

Either hide the upload affordance for demo or implement parsing/storage and pass extracted content into generation.

Can coding agent fix directly?

Yes for hiding or local parsing prototype; production storage needs owner decision.

### 6. Subscription Gate Is Client-Side And User-Toggleable

Severity: high.

Where it appears:

- `src/App.tsx`, `subscriptionActive`, `TopBar`, `ExportTab`, `exportCourse`

Why it matters:

It is only a demo control, not billing enforcement.

Recommended fix:

Move entitlement checks to a backend and derive them from trusted billing/subscription state.

Can coding agent fix directly?

Partly. Human owner must confirm pricing and billing provider.

### 7. AI Claims Are Simulated

Severity: high for messaging, medium for code.

Where it appears:

- `src/App.tsx`, AI toolbar/progress copy
- `src/services/courseGenerator.ts`
- `docs/COURSEFORGE_MVP_PLAN.md`

Why it matters:

The product is positioned as an AI course builder, but the current implementation has no live AI.

Recommended fix:

Clarify demo language or implement server-side AI generation with usage controls.

Can coding agent fix directly?

Messaging yes. Production AI requires owner decisions about provider/model/cost limits.

### 8. HTML Preview And Export Validation Are Too Shallow

Severity: high.

Where it appears:

- `src/App.tsx`, `dangerouslySetInnerHTML`
- `src/services/readiness.ts`
- `src/services/imsccExport.ts`

Why it matters:

The app previews and exports user-editable HTML. Current validation checks script tags but not event handlers, unsafe links, iframes, malformed HTML, or Canvas-incompatible markup.

Recommended fix:

Add sanitization, allowed HTML policy, and deeper validation.

Can coding agent fix directly?

Yes, with policy confirmation from owner.

### 9. Local Validation Does Not Parse XML

Severity: medium/high.

Where it appears:

- `src/services/imsccExport.ts`, `validateImsccZip`
- `docs/COURSEFORGE_MVP_PLAN.md` validation claims

Why it matters:

The plan says XML parsing is part of validation, but code mainly checks file presence and manifest regex references. Invalid XML could pass.

Recommended fix:

Add XML parser validation for every XML file in the package.

Can coding agent fix directly?

Yes.

### 10. Module Item Moves Can Desynchronize Data

Severity: medium.

Where it appears:

- `src/App.tsx`, `reorderModuleItem`
- `src/types.ts`

Why it matters:

Moving an item between modules updates the module item list but not the underlying page/assignment/discussion/quiz `moduleId`.

Recommended fix:

When moving module items across modules, update referenced object's `moduleId`, or prohibit cross-module moves until a full content relocation model exists.

Can coding agent fix directly?

Yes.

### 11. Duplicate Module Does Not Duplicate Content Objects

Severity: medium.

Where it appears:

- `src/App.tsx`, `duplicateModule`

Why it matters:

Duplicated module items get new item IDs but keep original `refId`s, so both modules point at the same content objects.

Recommended fix:

Either label it "duplicate module structure" or deep-copy referenced content objects.

Can coding agent fix directly?

Yes.

### 12. No Add/Delete Controls For Most Objects

Severity: medium.

Where it appears:

- `src/App.tsx`, editor tabs

Why it matters:

Users can edit many objects but cannot create/delete pages, assignments, discussions, quizzes, rubrics, outcomes, or gradebook groups from most tabs.

Recommended fix:

Add object-level create/delete/duplicate controls with validation.

Can coding agent fix directly?

Yes.

### 13. Theme Changes Do Not Fully Update Generated HTML

Severity: medium.

Where it appears:

- `src/App.tsx`, `ThemeTab`
- `src/services/courseGenerator.ts`

Why it matters:

Theme state changes affect export banner and future state, but previously generated inline HTML keeps older theme colors.

Recommended fix:

Move theme styling out of generated inline HTML where possible, or regenerate/update themed HTML on theme change.

Can coding agent fix directly?

Yes.

### 14. No Lint Script

Severity: low/medium.

Where it appears:

- `package.json`

Why it matters:

Basic static checks are missing from the developer workflow.

Recommended fix:

Add ESLint or preferred lint tooling and `npm run lint`.

Can coding agent fix directly?

Yes.

### 15. No Standalone Typecheck Script

Severity: low.

Where it appears:

- `package.json`

Why it matters:

Build runs TypeScript, but agents/users asked to run `npm run typecheck` will fail.

Recommended fix:

Add `"typecheck": "tsc -b --noEmit"` or project-appropriate equivalent.

Can coding agent fix directly?

Yes.

### 16. No Production Deployment Config

Severity: medium.

Where it appears:

- Repo root

Why it matters:

There is no hosting target, environment setup, CI, deploy script, or monitoring path.

Recommended fix:

Choose hosting and add deployment config/README instructions.

Can coding agent fix directly?

After owner chooses host.

### 17. App Folder Was Renamed During Work

Severity: low operational note.

Where it appears:

- Original task context used `/Users/blainefisher/Documents/Prompt to Canvas SaaS`.
- Current repo path resolved as `/Users/blainefisher/Documents/CourseForge`.

Why it matters:

Future agents should verify the working directory before running commands or linking files.

Recommended fix:

Use `pwd` and `git rev-parse --show-toplevel` at task start.

Can coding agent fix directly?

No code fix needed.

