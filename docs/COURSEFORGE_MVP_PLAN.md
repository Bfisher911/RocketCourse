# CourseForge Canvas Builder MVP Plan

## 1. Product Requirements Document

### Product Summary
CourseForge Canvas Builder is a SaaS app for instructors and instructional designers who need to turn a course idea, syllabus, notes, or reading list into a polished Canvas LMS course shell. The MVP focuses on one promise: generate a structured, editable course and export a Canvas-ready `.imscc` package that can be imported into a blank Canvas course.

### Primary Users
- Individual instructors who build Canvas courses themselves.
- Instructional designers who need a fast first draft for course shells.
- Department or school staff who repeatedly prepare templated Canvas courses.

### Core Jobs
- Describe a course in plain language.
- Refine the course through a short guided setup.
- Review and approve a structured blueprint before detailed generation.
- Edit native course objects in an organized workspace.
- Validate readiness and export an `.imscc` package.

### MVP Scope
- Landing page and simulated account/subscription status.
- Local-first dashboard with generated and draft projects.
- Vibe-build prompt plus guided setup controls.
- Deterministic course generator that produces a professional sample course without a live LLM key.
- Structured editor for overview, homepage, syllabus, modules, pages, assignments, discussions, quizzes, rubrics, gradebook, contact hours, theme, and export.
- Drag-and-drop reordering for modules and module items.
- Course readiness scoring.
- Browser-side `.imscc` generation and package validation.
- Export gating based on subscription state.

### Out Of Scope For First Build
- Production Supabase authentication.
- Stripe checkout and webhooks.
- Live OpenAI generation.
- Canvas API direct publishing.
- Real institution template library.
- Confirmed Canvas sandbox import unless a known-good Canvas export or sandbox credentials are supplied.

### Product Principles
- Native Canvas objects first: pages, assignments, discussions, quizzes, rubrics, modules, and grade groups should be represented as structured objects rather than opaque attachments.
- Progressive disclosure: keep the first workflow calm, with advanced settings available but not dominant.
- Editable before export: generated content should never feel locked away inside an AI blob.
- Honest validation: the app must distinguish local package integrity checks from a successful Canvas sandbox import.

## 2. Technical Architecture

### MVP Stack
- React + Vite + TypeScript for the frontend.
- Local browser state for prototype persistence.
- JSZip for `.imscc` packaging.
- Vitest for package and readiness validation tests.
- Future production path: Next.js, Supabase Auth/Postgres/Storage, Stripe Billing, background generation/export jobs, OpenAI structured output, Sentry.

### App Modules
- `src/data`: seed projects, themes, generation defaults.
- `src/types`: internal course model.
- `src/services/courseGenerator.ts`: prompt/settings to structured course.
- `src/services/readiness.ts`: quality score and checklist.
- `src/services/imsccExport.ts`: package builder and validator.
- `src/components`: app shell, intake, editor tabs, readiness panel, dashboard, export controls.

### Production Architecture Target
1. Web app sends prompt, uploads, and settings to API.
2. API normalizes intake and creates a `CourseProject`.
3. Background generation job creates blueprint, waits for approval, then creates course objects.
4. Editor writes object-level changes to Postgres.
5. Export job converts structured course JSON into a Canvas-oriented cartridge and stores the file.
6. Validation report is stored with the export job.
7. Paid users download; unpaid users can preview but not export.

## 3. Data Model

### Core Entities
- `User`: identity, role, institution, subscription relationship.
- `Subscription`: plan, status, renewal date, limits, Stripe customer/subscription ids.
- `CourseProject`: owner, title, status, created/updated, generation mode, export history.
- `CourseSettings`: level, modality, credits, length, module count, organization pattern, tone, theme, quiz/discussion/rubric preferences.
- `Theme`: palette, Canvas HTML accent style, banner treatment.
- `CourseOutcome`: measurable outcome, Bloom level, alignment ids.
- `Module`: order, title, overview, objectives, workload, module items.
- `Page`: title, Canvas-friendly HTML body, front-page flag, module association.
- `Assignment`: title, body, points, submission type, rubric, group, alignment ids.
- `Discussion`: prompt, expectations, points, rubric, alignment ids.
- `Quiz`: title, purpose, questions, points, alignment ids.
- `QuizQuestion`: type, stem, choices, correct answer, feedback.
- `Rubric` and `RubricCriterion`: criteria, levels, points, student-facing descriptions.
- `AssignmentGroup`: name, weight, drop rules, grading inclusion.
- `FileAsset`: path, mime type, alt text, usage references.
- `ExportJob`: status, package path, validation report, created/exported dates.
- `ExportValidationReport`: errors, warnings, passed checks, Canvas sandbox status.

### Status Values
Objects use `draft`, `generated`, `edited`, `ready`, and `exported` status values where applicable.

## 4. AI Generation Pipeline

1. Intake normalization: convert prompt, uploads, and guided settings into a structured course brief.
2. Blueprint generation: title, description, outcomes, module map, assessment plan, grading plan, workload plan.
3. Review checkpoint: user approves or revises before detailed content generation.
4. Content generation: pages, homepage, syllabus, module overviews, assignments, discussions, quizzes, rubrics.
5. Consistency pass: align outcomes, modules, assessments, workload, grading weights, and sequence.
6. Accessibility pass: check headings, alt text, link clarity, contrast notes, table use, and student-facing clarity.
7. Packaging pass: convert the internal JSON model into Canvas/Common Cartridge files.
8. Export validation pass: verify package integrity and surface issues before download.

### MVP Simulation
The first implementation uses deterministic generation for predictable demos and tests. The service boundary is designed so a future OpenAI structured-output job can replace the deterministic generator without changing the editor or export model.

## 5. Canvas `.imscc` Export Strategy

### Reference Sources
- Canvas imports Common Cartridge packages through Settings > Import Course Content using “Common Cartridge 1.x Package” and also imports Canvas Course Export Package `.imscc` files.
- 1EdTech Common Cartridge defines the interoperable package, manifest, resources, metadata, and conformance expectations.
- Public Canvas LMS source includes exporter modules for manifest, module metadata, wiki pages, assignments, discussions, rubrics, and QTI.

### MVP Package Shape
- `imsmanifest.xml` at package root.
- `course_settings/canvas_export.txt` as the Canvas-flavored course export marker.
- `course_settings/course_settings.xml` for Canvas course-level metadata.
- `course_settings/module_meta.xml` for Canvas module ordering and module item references.
- `course_settings/assignment_groups.xml` for gradebook groups.
- `course_settings/rubrics.xml` for rubric definitions.
- `course_settings/learning_outcomes.xml` for course outcomes.
- `course_settings/syllabus.html` for Canvas course syllabus body.
- `wiki_content/*.html` for Canvas pages, including homepage and syllabus page.
- Per-assignment folders containing fallback HTML and Canvas assignment settings XML.
- Per-discussion folders containing fallback HTML and Canvas topic settings XML.
- Per-quiz folders containing `assessment_qti.xml`, `assessment_meta.xml`, and matching files under `non_cc_assessments/*.xml.qti`.
- `web_resources/` for generated assets such as an SVG banner.

### Compatibility Stance
This MVP generates a Canvas-oriented cartridge based on public Canvas exporter structure and Common Cartridge concepts. It is not claimed as fully Canvas-verified until imported into a Canvas sandbox and compared against a known-good exported course. The code includes validation hooks and a fixture folder for adding a real Canvas export reference.

### Validation Checks
- Required manifest exists.
- XML files parse.
- All manifest file references resolve.
- Module items point to exported objects.
- Manifest `identifierref` values point to real resource identifiers.
- Page HTML exists and avoids scripts.
- Canvas page HTML includes metadata needed by the Canvas wiki importer.
- Empty required fields are reported.
- Grade weights total 100%.
- Rubric and assignment references resolve.
- Package can be generated with `.imscc` extension.
- Canvas sandbox import status is tracked separately from local validation.

## 6. Phased Implementation Plan

### Phase 1: Plan and Research
- Capture PRD, architecture, data model, AI pipeline, export strategy, risks, and acceptance criteria.
- Identify Canvas exporter source references and package assumptions.

### Phase 2: Static Product Prototype
- Build landing, dashboard, intake, generation progress, and editor workspace.
- Include tabbed editor and drag-and-drop module ordering.

### Phase 3: Structured Generation
- Implement deterministic prompt/settings generator.
- Produce course blueprint, content, outcomes, workload, assessments, and rubrics.

### Phase 4: Export Engine
- Generate `.imscc` package from internal model.
- Validate local package integrity.
- Add fixture hook for known-good Canvas export comparisons.

### Phase 5: SaaS Controls
- Simulate auth and subscription state.
- Gate export for inactive subscriptions.
- Document Supabase and Stripe production upgrade path.

### Phase 6: QA and Polish
- Add tests for readiness scoring and package validation.
- Browser QA for desktop and mobile.
- Prepare sandbox import checklist.

## 7. Risks And Mitigations

- Canvas import compatibility risk: require a real Canvas sandbox import before promising production compatibility.
- Quizzes/QTI variance: start with conservative classic quiz/QTI patterns and clearly flag supported question types.
- Rubric import variance: include references and fallback content, then verify against sandbox.
- AI hallucination: use structured output schemas, validation passes, and object-level editing.
- Accessibility regressions: enforce semantic Canvas HTML and readiness checks.
- Overwhelming UX: keep advanced controls collapsed and use editor tabs.
- Export billing friction: allow preview/edit before payment and gate only package download.
- Data loss: production version must add autosave, revision history, and object-level regeneration records.

## 8. MVP Acceptance Criteria

1. User can view a landing page and enter the application.
2. User can simulate sign-in/account state and see subscription status.
3. User can create a course project from prompt plus guided settings.
4. User can upload or attach source document metadata in the intake UI.
5. App generates a structured course blueprint and complete sample course.
6. User can approve or regenerate the blueprint/course.
7. User can preview and edit homepage, syllabus, modules, pages, assignments, discussions, quizzes, rubrics, gradebook, contact hours, theme, and export state.
8. User can drag-and-drop reorder modules and module items.
9. App calculates readiness and highlights missing export blockers.
10. Paid subscription state enables `.imscc` export.
11. App generates a package with manifest, module metadata, pages, assignments, discussions, quizzes, rubrics, gradebook groups, and assets.
12. App validates the package locally and reports errors/warnings.
13. App provides a download with `.imscc` extension.
14. Documentation states that Canvas sandbox import verification is required before production claims.

## Source Links
- Canvas Common Cartridge import guide: https://community.instructure.com/en/kb/articles/660732-how-do-i-import-content-from-common-cartridge-into-canvas
- Canvas course export import guide: https://community.instructure.com/en/kb/articles/660728-how-do-i-import-a-canvas-course-export-package
- 1EdTech Common Cartridge overview: https://www.1edtech.org/standards/cc
- 1EdTech Common Cartridge specification index: https://www.imsglobal.org/cc/index.html
- Canvas LMS exporter source directory: https://github.com/instructure/canvas-lms/tree/master/lib/cc
- Canvas LMS manifest exporter: https://github.com/instructure/canvas-lms/blob/master/lib/cc/manifest.rb
- Canvas LMS module metadata exporter: https://github.com/instructure/canvas-lms/blob/master/lib/cc/module_meta.rb
