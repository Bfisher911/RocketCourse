# Canvas Export Reference Fixture

Place a known-good Canvas course export here when sandbox access is available.

The intended fixture should be a small manually built Canvas course exported from Canvas as `.imscc` and unzipped for comparison. It should include:

- Homepage and syllabus page.
- Start Here module.
- At least one regular module with page, assignment, discussion, and quiz.
- One rubric.
- Assignment groups.

The MVP export engine is based on public Canvas LMS exporter source and local validation, but production compatibility should not be claimed until generated packages are imported into a Canvas sandbox and compared with this fixture.

## What local validation already guarantees

`validateImsccZip` plus the regression suites (`imsccExport.test.ts`, `imsccExport.packages.test.ts`) now assert, across multiple course settings:

- `imsmanifest.xml` is present, every `<file href>` resolves to a packaged file, and every `identifierref` resolves to a `<resource>`.
- Required Canvas `course_settings/*` files exist (module_meta, assignment_groups, rubrics, learning_outcomes, navigation, context, canvas_export flag).
- Quiz QTI carries real answers: multiple-choice/true-false items render `<response_lid>`/`<render_choice>` choices, an answer key (`<resprocessing>` → `<varequal>` → `SCORE` 100), and `<itemfeedback>`; open prompts export as manually graded `essay_question` items with `<response_str>`/`<render_fib>`.
- `question_type` uses Canvas-native values (`multiple_choice_question`, `true_false_question`, `essay_question`), never the internal type names. The cc-flavored QTI additionally carries `cc_profile` identifiers.
- Plain-text fields (assignment `<description>`) do not double-escape HTML entities.

## Generating packages for sandbox import

Emit one `.imscc` per settings configuration to a directory of your choice:

```sh
CF_PACKAGE_DIR=/tmp/courseforge-packages npm test
```

The matrix in `imsccExport.packages.test.ts` covers weeks/topics/units/chapters organization, every quiz/discussion frequency, each assignment cadence, challenging quiz difficulty (essay path), and scheduled due dates. Import a generated package into a Canvas sandbox, then unzip a real Canvas export of the same shape into this folder to complete the structural diff.
