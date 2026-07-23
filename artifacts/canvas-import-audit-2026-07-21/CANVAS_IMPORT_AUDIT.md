# RocketCourse to Canvas IMSCC audit

Audit date: 2026-07-21  
Canvas course: `2325483`  
Imported course content: **Interstellar Logistics and Oort Cloud Settlement Patterns**

## Verdict

The package imports and its module, assignment, discussion, quiz, rubric, and navigation relationships resolve, but it is not ready for student use. The audit found several systemic RocketCourse export defects: Canvas removes part of the generated hero styling, internal authoring notes appear in student-facing content, placeholder resources are presented as readings, and quiz prompts are mapped to incorrect response types.

## Journey health

1. **Course shell and homepage — Needs work.** The Canvas shell retains the blank-course name, the generated banner title overflows its panel, recent announcements push the homepage content far below the fold, and the course title is repeated.
2. **Syllabus — Blocked for publication.** The page is readable, but contains duplicate content, placeholder textbook/contact/support information, instructor-only notes, and unconfirmed policy promises.
3. **Modules — Needs work.** The sequence imports and resolves, but all 15 modules open into a very long list and the styled template produces low accessibility scores across most generated pages.
4. **Guidance and overview pages — Blocked for publication.** Canvas strips the intended hero background while the export keeps white foreground text, leaving invisible headings and large blank regions.
5. **Readings and resources — Blocked for publication.** Items labeled Textbook, Scholarly Article, and Video contain generated prompts rather than actual linked sources. Instructor replacement notes are visible to students.
6. **Lecture — Usable with edits.** Semantic structure and Canvas accessibility are good, but the page is visually inconsistent with the rest of the course and contains a misleading next-step instruction and a course-scope factual imprecision.
7. **Assignment and rubric — Needs work.** The assignment and 60-point rubric import and remain linked, but the assignment exposes instructor notes and duplicates its title. The rubric is generic and has no zero/not-demonstrated rating.
8. **Discussion — Blocked for publication.** Internal fields including Instructor Facilitation Note, Rubric Recommendation, Validation Warnings, and Model Gaps are student-facing.
9. **Quiz — Blocked for publication.** Question 2 and Question 5 are explanatory prompts rendered as one-line fill-in-the-blank fields. Question 4 reads like true/false but renders as a full essay editor.
10. **Responsive behavior — Needs work.** Basic cards and buttons adapt at narrow width, but the rasterized banner overflow persists and the text becomes too small to be useful.

## Prioritized findings

### P0 / release blockers

1. **Canvas-incompatible hero styling.** On Course Success Guide, Week 1 Overview, and Readings and Resources, Canvas displays a large blank region. Computed styles show white heading/body text on a transparent background because the expected hero background does not survive Canvas sanitization. Use Canvas-safe inline colors or an actual image with a readable fallback, and validate the sanitized HTML after import.
2. **Student-facing internal notes.** Instructor notes, review checklists, validation metadata, resource replacement directions, and model-gap text appear in published student content. The exporter must separate authoring metadata from student HTML.
3. **Resources are not resources.** The Week 1 resource page labels three entries as a textbook, scholarly article, and video, but supplies no citation, link, file, or media. Export should block publication or clearly mark the module incomplete until real sources are attached.
4. **Quiz response types are wrong.** Long-answer prompts become fill-in-the-blank questions, and a true/false-style statement becomes an essay response. Add tests for QTI question type, answer controls, point values, and correct-answer mapping.
5. **Module overview navigation skips required work.** The Week 1 overview's custom `Next: Week 2` link bypasses the rest of Week 1, while Canvas native navigation correctly goes to Week 1 Readings. Remove custom next-week links or derive them from the actual module-item sequence.

### P1 / high priority

6. **Homepage banner overflow is embedded in the image.** The 1440×360 PNG contains the long title rasterized outside its white title panel. CSS wrapping cannot repair it after export. The banner generator needs measured text fitting, maximum lines, dynamic font scaling, and a no-text-image fallback for long titles.
7. **Unconfirmed policy claims and placeholders.** The syllabus promises 48-hour feedback, specifies a 10%-per-day late penalty, describes AI and integrity rules, and exposes placeholder textbook/contact/support text. These require instructor confirmation before they become authoritative student policy.
8. **Systematic duplicate headings.** Canvas supplies the page or assignment H1 and RocketCourse often adds the same H1 inside the body. Body content should start at H2 or omit the duplicate title.
9. **Accessibility pattern is systemic.** The Modules screen exposes 108 scored items. Sixty-eight score below 70%, one scores 70%, and 39 score 100%. The low scores cluster around RocketCourse's styled page templates; lecture, discussion, and quiz content tend to score 100%.
10. **Generated outcomes are repetitive and sometimes ungrammatical.** Syllabus outcomes repeat the same boilerplate with only the Bloom verb changed, including constructions such as “Create key ... concepts.” Generate distinct, measurable outcomes and validate verb-object grammar and assessment alignment.
11. **No usable schedule.** Assignments and quizzes show no due or availability dates, and schedule tables repeatedly say “Set by instructor.” Export should present this as an explicit pre-publication checklist, not finished student content.
12. **Course shell mismatch and navigation clutter.** IMSCC does not rename the existing Canvas shell, so the breadcrumb remains `CNVS - Blaine's Blank Course`. The course navigation also exposes many institution-specific tools. RocketCourse needs a post-import checklist for renaming the shell and hiding irrelevant navigation items.

### P2 / polish and clarity

13. Long recent announcements appear before the homepage and repeat the welcome content.
14. Overview pages repeat the same introduction in hero, briefing, and In Focus sections.
15. Literal internal labels such as `Objectives Chips` and `Read-Watch-Do Path` are visible to students.
16. Lecture and assessment pages use very long full-width lines and look visually disconnected from the styled pages.
17. The assignment repeats its title, submission instructions, and points.
18. The rubric's lowest selectable performance level still awards substantial credit; add a not-demonstrated/zero level and make criterion language specific to the task.

## What works

- The IMSCC imports and the tested module-item relationships resolve.
- The course has a consistent Start Here, Week 1–12, Final Project, and Instructor Resources structure.
- Instructor Resources is unpublished.
- The assignment remains linked to its rubric, and the rubric totals the assignment's 60 points.
- The homepage banner has descriptive alt text.
- Canvas reports 100% accessibility scores for the tested lecture, discussion, and quiz content.
- Native Canvas Previous/Next navigation works on tested items.

## Recommended RocketCourse changes

1. Replace the hero/template CSS with a Canvas-sanitization-tested HTML subset.
2. Add an export filter that removes authoring metadata and instructor-only notes from student HTML.
3. Add pre-export blockers for unresolved placeholders, missing source URLs/files, missing dates, and unconfirmed policies.
4. Correct QTI type mapping and add fixture tests for multiple choice, true/false, short answer, essay, feedback, scoring, and correct answers.
5. Stop embedding long course titles in fixed-width banner panels; use fit-tested artwork or a decorative image plus live HTML title.
6. Use Canvas's page title as the sole H1 and start generated body sections at H2.
7. Generate module navigation from actual module item ordering.
8. Add a post-import Canvas checklist for shell title, dates, navigation visibility, instructor/contact information, and policy approval.

## Evidence limits

This was a read-only instructor-view audit of the current imported course using desktop and narrow-width screenshots, Canvas accessibility scores, and page structure inspection. It did not submit quiz answers, modify the course, enter Student View, run a screen reader session, or re-import the package into a second Canvas instance. Correct-answer keys and all 108 individual content items were not exhaustively opened.
