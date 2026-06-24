# Course Flow Improvements — Implementation Notes

Tracks the guided-creation / edit-stability / export-reliability work. Baseline at start of this
pass: 437 tests green. After this pass: **469 tests green, typecheck clean, build passes.**

## Done (this pass)

### 1. Guided Steps is the default; Quick Build preserved (Goals 1, 2)
- `src/App.tsx` — `intakeMode` now defaults to `"guided"` (was `"quick"`); the mode toggle lists
  **Guided steps** first, **Quick build** second. Step numbering verified correct (`Step N of 6`);
  no malformed labels.

### 2. Schedule / Holidays / Blackout / academic-calendar fields fixed (Goals 3, 4)
- **Root cause:** the Holidays/Blackout fields re-derived their textarea value from the parsed array
  on every keystroke, so Enter, trailing spaces, and pasted multi-line text were stripped instantly.
- **Fix:** new `ListTextArea` component in `src/App.tsx` holds the editable text locally (decoupled
  from the parsed array); the array stays in sync for scheduling/generation. Verified in-browser:
  newlines, trailing spaces, and pasted multi-line lists are all preserved.
- **New academic-calendar paste field** (raw multi-line, preserves spacing/indent) added to the
  Schedule step, stored on `ScheduleSettings.academicCalendar` (`src/types.ts`,
  `src/data/defaultSettings.ts`). Helper text added under each field (`.field-hint` in `styles.css`).
- Pure, tested helpers in `src/services/scheduleInput.ts` (`parseDateList`, `seedDateList`,
  `cleanCalendarText`, `buildScheduleContext`) + `scheduleInput.test.ts` (12 tests). The pasted
  calendar + holidays + blackout dates are appended as generation context at both generate call
  sites in `App.tsx`.

### 3. Edit stability / model integrity / export reliability (Goals 5, 11 — the core promise)
- **`src/services/courseRepair.ts`** (`repairCourse`, `unrepairableIssues`) — pure, idempotent model
  repair covering the export-breaking classes: dangling module items, object/quiz-question moduleId
  drift, graded item on a missing module, missing/invalid assignment group, dangling rubric links,
  page slug generation, multiple-choice-with-no-choices → short answer, invalid question points,
  empty assignment descriptions, outcome-alignment strips (assignment/discussion/quiz/rubric/
  criterion/outcome→module), and weight rebalancing. 15 tests in `courseRepair.test.ts`, including
  "export survives a corrupted editing session" (corrupt 6 ways → package builds with zero
  error-severity issues).
- **Wired in:** `repairCourse` runs at the top of `buildImsccZip` and `validateImsccZip`
  (`src/services/imsccExport.ts`) so export always self-heals, and inside `makeCourseExportReady`
  (`src/services/courseTransforms.ts`) so the Transform tab surfaces what it fixed.
- **Validator severity refined** (`imsccExport.ts`): a *dangling* rubric/outcome reference is an
  error (genuinely broken), but an *absent* rubric/outcome is a warning (Canvas imports fine), so
  deleting a rubric or outcome no longer blocks export.
- **Transaction-safe AI revise:** `src/services/revisionGuard.ts` (`validateRevisionCandidate`, 5
  tests) rejects empty/unsafe revision output before commit; `reviseActiveContent` in `App.tsx` keeps
  the previous content and surfaces a recoverable `.revise-error` instead of overwriting good content.
- Readiness still independently detects drift/broken refs (`readiness.test.ts` unchanged) — the ideal
  split: **readiness warns the user, export self-heals.**

### 4. Post-login Dashboard & Create emphasis (Goal 10)
- `src/App.tsx` `TopBar`: when signed in, Dashboard + Create + Launchpad render in a grouped
  `.topnav-product` block that **leads** the nav (right after the brand, always visible — no longer
  scrolled off). **Create** is a gradient primary CTA (`.nav-cta`), Dashboard is emphasized
  (`.nav-emph`), separated from the marketing links by a divider (`styles.css`). Verified in-browser.

### 5. Canvas-safe themed renderer library + applied assignment theming (Goals 6, 7 — partial)
- `src/services/themeDesign.ts` already had a Canvas-safe renderer kit (`buildThemedCard`,
  `buildThemedCallout`, `buildThemedNote`, `buildThemedTable`, `buildThemedColumns`, `getThemeStyles`
  with border/muted/surface/heading tokens). **Expanded** with specialized domain renderers:
  `buildObjectiveBadges`, `buildAssignmentCard` (purpose/task/deliverable/success + due/points/time
  meta), `buildDiscussionCard`, `buildQuizCard`, `buildWorkloadTiles`, `buildModuleRoadmap`. All pure,
  inline-style-only (no JS / no `url()`), HTML-escaped. 15 tests in `themeDesign.cards.test.ts`
  asserting Canvas-safety + theme-color usage + escaping.
- **Applied:** assignment section headings (`assignmentBuilder.ts` `themedSection`) now carry the
  course theme (accent color + underline) on both `buildAssignmentTemplateHtml` and
  `reviseAssignmentInstructions` — i.e. the **add-assignment / revise** path. Export-safe (htmlSafety
  permits inline styles).
- **Scope note:** the **initial course generation** runs through `src/services/courseGenerator.ts`
  (a separate path from the per-object builders), so a freshly-generated/demo course's pages do not
  yet show the new theming — `courseGenerator.ts` is the main remaining visual surface and the
  highest-leverage place to apply the renderer kit + themed headings next.

## Remaining (recommended next steps, with file pointers)

These are larger content/visual efforts; deferred so they can be done well rather than rushed.

- **Finish wiring the renderer kit (Goals 6, 7).** The specialized cards above are built + tested but
  not yet wired into every generator. Next: use `buildAssignmentCard`/`buildDiscussionCard`/
  `buildQuizCard`/`buildObjectiveBadges`/`buildWorkloadTiles`/`buildModuleRoadmap` inside
  `assignmentBuilder.ts`, `discussionBuilder.ts`, `quizBuilder.ts`, `modulePlanner.ts`,
  `homepageTemplates.ts`. **Test-coupling caveat:** several builder tests pin exact HTML strings
  (e.g. `assignmentBuilder.test.ts` asserted `<h2>Purpose</h2>` — now `>Purpose</h2>`); each wiring
  step needs the matching assertion relaxed to text-based checks. Add a test that a theme change
  flows into export HTML (extend `imsccExport.test.ts` "carries refreshed theme styling…").
- **PDF / print polish (Goal 8).** `src/services/syllabusPdf.ts`, `coursePdf.ts`, `quizPdf.ts`,
  `pdfDoc.ts` — add a themed cover/header, course-at-a-glance, outcomes, module schedule,
  assignment/quiz breakdown, grading table, contact hours, policies; carry the active theme palette
  into the PDF styling. Extend `quizPdf.test.ts` / `syllabusPdf.test.ts`.
- **Content depth + humanized writing (Goal 9).** Deepen deterministic templates and the versioned
  prompt-template files in `src/ai/promptTemplates/*` (homepage, modules, assignments, discussions,
  quizzes, rubrics, syllabus, contactHours). Apply the writing-style guardrails (no em dashes, no
  "not X but Y", limited rule-of-three, concrete instructions). Server-side prompts only — no
  browser AI keys.
- **Quiz/QTI deepening.** QTI already round-trips MC / true-false / short-answer / essay
  (`imsccExport.qti-roundtrip.test.ts`). `repairCourse` now hardens question integrity; add explicit
  "add quiz → still exports", "regenerate quiz → preserves module/group" tests if expanding.
- **Readiness auto-fix surfacing.** Readiness detects issues `repairCourse` can fix — consider an
  "Auto-fix" button in the readiness UI that runs `makeCourseExportReady` (already wired) and reports
  the repair list.

## Verification
- `npm run typecheck` — clean. `npm test` — 469 passing. `npm run build` — passes (18 prerendered
  routes). Browser QA: guided default, Schedule field paste/enter/multi-line, post-login nav emphasis.
- Canvas sandbox `.imscc` import remains **NOT verified** — do not claim otherwise without a real
  sandbox import test.
