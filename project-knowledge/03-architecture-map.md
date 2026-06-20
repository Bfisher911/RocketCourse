# Architecture Map

## Stack

| Layer | Current implementation | Evidence |
| --- | --- | --- |
| Frontend framework | React 18 with Vite and TypeScript | `package.json`, `src/main.tsx`, `src/App.tsx` |
| Backend | None | No API routes, server files, fetch calls, or backend framework |
| Database | None | No migrations, schema files, Supabase client, or persistence layer |
| Auth provider | None | No auth imports, routes, or env variables |
| Hosting | Static Vite build assumed | `npm run build` outputs `dist`; README lists local Vite commands |
| Styling | Single CSS file with CSS variables and responsive media queries | `src/styles.css` |
| Package export | Browser-side JSZip | `src/services/imsccExport.ts`, `package.json` |
| Testing | Vitest for export/readiness | `src/services/imsccExport.test.ts`, `vite.config.ts` |

## Application Shape

The app is a single-page application with internal screen state. There is no React Router.

Key files:

- `src/main.tsx`: React root.
- `src/App.tsx`: screens, navigation, editor UI, local state, user actions.
- `src/types.ts`: internal course domain model.
- `src/services/courseGenerator.ts`: deterministic course generation.
- `src/services/readiness.ts`: readiness scoring.
- `src/services/imsccExport.ts`: Canvas/Common Cartridge package generation and local validation.
- `src/data/defaultSettings.ts`: default intake settings.
- `src/data/themes.ts`: theme options.
- `src/utils/text.ts`: slug, XML escaping, HTML stripping, timestamp helpers.

## State Management

State is local React state only:

- `screen`
- `projects`
- `course`
- `settings`
- `prompt`
- `progressIndex`
- `activeTab`
- `subscriptionActive`
- `validationReport`
- `isExporting`
- drag state for modules and module items

There is no Redux, Zustand, React Query, server state, localStorage, IndexedDB, or autosave.

## Data Flow

Plain-English current flow:

1. User loads app -> `src/main.tsx` renders `App`.
2. `App` initializes `sampleProject` from `src/services/courseGenerator.ts`.
3. User opens Intake -> edits `prompt` and `settings` in React state.
4. User clicks Generate Course -> `screen` changes to `progress`.
5. Timed progress completes -> `generateCourseProject({ prompt, settings })` returns a full `CourseProject`.
6. `App` stores the generated project in local state and opens the editor.
7. User edits objects in tabs -> `updateCourse` mutates local `CourseProject` copies.
8. Readiness panel recomputes with `buildReadinessReport(course)`.
9. User exports -> `generateImsccBlob(course)` builds a JSZip package, validates it locally, and returns a Blob/report/filename.
10. Browser downloads the Blob with an `.imscc` filename if local validation passes.

## Environment Variables

No environment variables are currently used.

Evidence:

- Search found no `import.meta.env`, `VITE_`, `process.env`, Supabase, OpenAI, Stripe, Sentry, email, or analytics env usage in source.

## API Routes Or Server Actions

None.

The MVP plan describes a future API/background job architecture, but this repo currently has no backend files and no API calls.

## Client-Side Services

### `src/services/courseGenerator.ts`

Turns prompt/settings into a deterministic `CourseProject`. It generates:

- Homepage.
- Syllabus.
- Start Here module.
- Module overview, lecture, and wrap-up pages.
- Discussions.
- Quizzes.
- Assignments.
- Rubrics.
- Outcomes.
- Assignment groups.
- Contact-hour plan.

### `src/services/readiness.ts`

Builds a score and check list from a `CourseProject`.

### `src/services/imsccExport.ts`

Builds and validates a JSZip package. It writes:

- `imsmanifest.xml`
- `course_settings/course_settings.xml`
- `course_settings/module_meta.xml`
- `course_settings/assignment_groups.xml`
- `course_settings/rubrics.xml`
- `course_settings/learning_outcomes.xml`
- `course_settings/context.xml`
- `course_settings/canvas_export.txt`
- `course_settings/syllabus.html`
- `wiki_content/*.html`
- assignment folders
- discussion XML and metadata
- quiz QTI and metadata files
- `non_cc_assessments/*.xml.qti`
- `web_resources/course-banner.svg`
- `courseforge-readme.txt`

## File Upload System

The file upload system is metadata-only.

`src/App.tsx` reads a `FileList` and stores:

- generated `id`
- `name`
- approximate size label
- status `attached`

The app does not parse file contents, upload to storage, or pass file content into generation.

## AI Provider Usage

No AI provider is used in the current code.

AI-related labels exist in the UI and docs, but the implementation is deterministic:

- `generateCourseProject` is local code.
- `reviseActiveContent` appends static HTML snippets.
- There is no OpenAI client, fetch call, streaming, retry, usage tracking, or cost accounting.

## Payment Provider Usage

No payment provider is used.

The only billing behavior is `subscriptionActive` in `src/App.tsx`, toggled from the top bar. `docs/COURSEFORGE_MVP_PLAN.md` names Stripe as a future path.

## Email Provider Usage

None.

## Logging And Error Reporting

None implemented.

There is no Sentry, console logging strategy, server log, audit log, telemetry, or analytics provider. Export errors would surface only through React behavior unless explicitly caught by future work.

## Hosting Assumptions

The project can be built as a static Vite app. It has:

- `npm run dev`
- `npm run build`
- `npm run preview`

No deployment configuration exists for Netlify, Vercel, Firebase, Cloudflare, or another host.

