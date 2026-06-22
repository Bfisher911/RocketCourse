# RocketCourse AI Prompt Template System

## Purpose

RocketCourse now has a versioned prompt-template layer for future server-side AI generation. The existing deterministic generator in `src/services/courseGenerator.ts` remains the browser-safe baseline, demo generator, fixture provider, and regression comparison source.

The prompt system is designed to generate a fully fledged Canvas course, not a thin outline. Templates require rich modules, student-facing lesson pages, assignments, discussions, quizzes, rubrics, syllabus, homepage, gradebook structure, contact-hour logic, resource placeholders, accessibility review, instructor-only materials, and revision actions.

## Files

- `src/ai/promptTemplates/types.ts`: shared prompt-template and registry types.
- `src/ai/promptTemplates/templateFactory.ts`: shared RocketCourse instructions and the six improvement passes.
- `src/ai/promptTemplates/qualityStandard.ts`: fully fledged course standard, anti-generic rules, and validation rules.
- `src/ai/promptTemplates/*.ts`: stage templates for blueprint, modules, pages, assignments, discussions, quizzes, rubrics, syllabus, homepage, resources, contact hours, and revisions.
- `src/ai/promptTemplates/registry.ts`: active version selection, lookup, comparison, and rollback helpers.
- `src/ai/evals/fixtures.ts`: eight discipline fixtures.
- `src/ai/evals/rubric.ts`: internal 1 to 5 scoring rubric.
- `src/ai/evals/runPromptEval.ts`: deterministic eval runner and prompt-version comparison helper.
- `src/ai/evals/reports/prompt-quality-loop-report.md`: loop report and provider boundary notes.

## Prompt Versions

Each stage has explicit versions:

- `*.v1`: baseline structured prompt system.
- `*.v2`: completeness improvement.
- `*.v3`: specificity improvement.
- `*.v4`: alignment improvement.
- `*.v5`: Canvas-readiness and editability improvement.
- `*.v6`: regression and rollback readiness.

`v6` is active by default for every stage. Change active versions in one place:

```ts
// src/ai/promptTemplates/registry.ts
export const activePromptTemplateVersions = {
  blueprint: "v6",
  moduleDraft: "v6",
  lessonPageDraft: "v6",
  assignmentDraft: "v6",
  discussionDraft: "v6",
  quizDraft: "v6",
  rubricDraft: "v6",
  syllabusDraft: "v6",
  homepageDraft: "v6",
  resourceDraft: "v6",
  contactHourDraft: "v6",
  revision: "v6"
};
```

## Registry Usage

```ts
import {
  comparePromptTemplateVersions,
  createPromptTemplateRegistry,
  getActivePromptTemplate,
  getRollbackTemplate
} from "../src/ai/promptTemplates";

const blueprint = getActivePromptTemplate("blueprint");
const registry = createPromptTemplateRegistry({ assignmentDraft: "v5" });
const comparison = comparePromptTemplateVersions("assignmentDraft", "v5", "v6");
const rollback = getRollbackTemplate("assignmentDraft");
```

## Evaluation Usage

```ts
import { comparePromptVersionOutputs, runPromptEval } from "../src/ai/evals";

const report = runPromptEval();
const assignmentComparison = comparePromptVersionOutputs("assignmentDraft", "v5", "v6", [
  "humanities-scifi-ethics",
  "stem-environmental-data"
]);
```

The default provider is `deterministic-baseline`, which uses `generateCourseProject` and performs no AI call. The `future-server-side-ai` provider intentionally throws in this codebase until a server endpoint is implemented.

## Scoring Targets

The eval rubric scores generated courses from 1 to 5 on:

- Specificity
- Completeness
- Instructional usefulness
- Canvas readiness
- Alignment
- Assignment quality
- Quiz quality
- Rubric quality
- Student clarity
- Accessibility and readability
- Instructor editability
- Avoidance of fake specificity

Targets:

- No category below 4.
- Average score at least 4.3.
- Assignment quality at least 4.
- Rubric quality at least 4.
- Canvas readiness at least 4.
- Avoidance of fake specificity must be 5.

## Server-Side AI Boundary

Do not call OpenAI or another AI provider from browser code. A production integration should:

1. Send prompt, settings, source notes, and chosen prompt template ids to a server endpoint.
2. Render the selected prompt template server-side.
3. Request structured output from the provider.
4. Validate the structured result against the CourseProject-compatible contract.
5. Store output snapshots by prompt template id and version.
6. Return normalized CourseProject objects or object drafts to the editor.
7. Feed saved outputs into `runPromptEval` or a provider-specific extension for regression comparison.

## Human Review Still Required

The prompt and eval system does not certify Canvas import compatibility, accessibility compliance, medical/legal/policy accuracy, accreditation alignment, or institutional policy correctness. Instructors still need to verify resources, dates, local policies, examples, assessment fit, and Canvas sandbox import results before publishing.
