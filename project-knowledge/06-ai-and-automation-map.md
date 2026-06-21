# AI And Automation Map

## Summary

The current app uses no live AI provider. All course generation is deterministic local TypeScript. AI labels in the UI and docs are product-positioning and future-roadmap language, not current model calls.

Evidence:

- `src/services/courseGenerator.ts` creates the course from local arrays, templates, settings, and simple prompt title extraction.
- `src/App.tsx` has an `ai-toolbar`, but `reviseActiveContent` only appends static HTML snippets.
- Search found no OpenAI client, fetch call, streaming endpoint, model constant, token tracking, retry logic, or API key usage.
- `docs/COURSEFORGE_MVP_PLAN.md` explicitly says live OpenAI generation is out of scope and that deterministic generation is the MVP simulation.

## AI Providers Used

None.

Future provider named in planning docs:

- OpenAI structured output, planned in `docs/COURSEFORGE_MVP_PLAN.md`.

## Models Referenced

None in source.

No `gpt-*`, `responses`, `chat.completions`, or model string exists.

## Prompt Templates

No LLM prompt templates exist.

Current prompt handling:

- User prompt is captured in `src/App.tsx`.
- `titleFromPrompt` in `src/services/courseGenerator.ts` tries to infer a course title using regex patterns.
- The rest of generation is deterministic templates.

## Generation Flow

### Input

`generateCourseProject` receives:

- `prompt`
- `settings`

Source-file metadata can be present in `settings.sourceFiles`, but it is not read or used for content generation.

### Processing

`src/services/courseGenerator.ts`:

- Merges settings with defaults.
- Extracts a title from prompt.
- Selects a theme.
- Creates 10 outcomes.
- Creates assignment groups.
- Creates homepage and syllabus HTML.
- Creates Start Here items.
- Creates modules based on `moduleCount`.
- Creates module pages, discussions, quizzes, assignments, and rubrics based on frequency/settings.
- Creates contact-hour plan.

### Output

Returns a `CourseProject` object saved in local React state.

### Failure Behavior

There is no explicit generator error handling. The generation flow in `src/App.tsx` assumes success after the timer finishes.

## Course Generation Logic

Implemented in `src/services/courseGenerator.ts`.

Current generated default sample is approximately:

- Start Here module plus configured modules.
- Homepage and syllabus.
- Orientation pages.
- Module overview, lecture/notes, and wrap-up pages.
- Weekly discussions if configured.
- Weekly or alternating quizzes based on setting.
- Assignments every third module and final module.
- Rubrics for discussions and assignments.
- Gradebook groups totaling 100%.
- Workload/contact-hour plan.

## Assignment Generation Logic

Assignments are generated when `moduleNumber % 3 === 0` or when the module is the final module.

Generated assignment fields include:

- `id`
- `title`
- `moduleId`
- `assignmentGroupId`
- `points`
- `estimatedHours`
- `submissionType`
- `rubricId`
- `alignedOutcomeIds`
- `descriptionHtml`

Concern:

- `assignmentTypes` setting is captured but not directly used to vary assignment structures.

## Rubric Generation Logic

`makeRubric` creates three criteria:

- Purpose and alignment.
- Evidence and analysis.
- Communication and accessibility.

Rubrics are attached to generated discussions and assignments. The rubric editor only allows changing the title.

## Quiz Generation Logic

Quizzes include three question objects:

- Multiple choice.
- True/false.
- Short answer.

Concern:

- The export QTI currently does not fully write answer choices, correct-answer logic, or feedback. It writes a minimal item with stem and metadata.

## Chatbot Logic

None.

There is no chat UI, chat service, assistant state, thread model, or message table.

## Streaming Behavior

None.

Generation progress is a timer in `src/App.tsx`, not a stream.

## Background Job Behavior

None.

The MVP plan describes future background jobs, but the current implementation runs everything in the browser.

## Retry Logic

None.

There are no external calls to retry.

## Token Or Usage Tracking

None.

No model usage, credit usage, export limits, or per-project cost data is tracked.

## Where AI Calls Are Made

No AI calls are made.

## Demo Mode And Real API Calls

The app is effectively a local demo by default because it starts with `sampleProject` and deterministic generation.

No real API calls are made, so current demo mode has no AI-cost risk. Future real AI work must add server-side controls before public demo use.

## Cost Risks

Current cost risk: low, because no external AI calls occur.

Future cost risk: high if live AI is added directly to the client or without:

- Authenticated users.
- Plan limits.
- Per-user/project usage tracking.
- Abuse protection.
- Server-side API key isolation.
- Retry/backoff and timeout controls.
- Demo mode that avoids real spend.

## Automation

Current automation is limited to:

- Timed progress step advancement in `src/App.tsx`.
- Local package validation in `src/services/imsccExport.ts`.
- Build/test commands in `package.json`.

No scheduled jobs, queues, webhook handlers, or cron tasks exist.

