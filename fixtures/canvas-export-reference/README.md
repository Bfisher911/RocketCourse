# Canvas Export Reference Fixture

`course_settings/` holds structural XML taken from a REAL Canvas Common Cartridge export
(Tulane, August 2026), kept so the exporter can be checked against Canvas's own output instead of
against assumptions. Course content is deliberately not vendored — only the small settings files
that define package structure.

## What is here, and what it settled

- **`files_meta.xml`** — the file that answers "how do we stop instructor-only artifacts being
  student-downloadable?". Canvas's own export uses a `<folders>` section; the published XSD
  (`https://canvas.instructure.com/xsd/cccv1p0.xsd`, element `fileMeta`) also allows a `<files>`
  section where each `<file>` takes a required `path` attribute plus optional `display_name`,
  `hidden`, `locked`, `lock_at`, `unlock_at`, and `usage_rights`. `locked` is Canvas's unpublished
  state for a file: `hidden` alone still permits a direct fetch by URL. The exporter now emits this
  for the instructor guide, and the manifest declares it alongside the other `course_settings`
  files, which is exactly how Canvas declares it.
- **`late_policy.xml`** and **`media_tracks.xml`** — emitted by Canvas, not yet by RocketCourse.
  `late_policy.xml` is the obvious next gap: the generated syllabus describes a late-work policy in
  prose while the gradebook ships with no policy attached.

## Still worth vendoring

A full manually built Canvas course (homepage, syllabus, Start Here, one module with page /
assignment / discussion / quiz, one rubric, assignment groups) for a complete structural diff.

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
