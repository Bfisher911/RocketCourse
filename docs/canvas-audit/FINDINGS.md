# Canvas export audit — August 2026

Audit of a live RocketCourse export in Canvas, and the generator fixes that came out of it.

**Course audited:** Tulane Canvas course `2325839`, *Emergency Medical Services Leadership*
(10 weeks, 3 credits, online asynchronous, undergraduate).
**Note:** that course ID no longer exists. The equivalent course is now `2326009`. Every fix below
was made in the generator, so it applies to any future export rather than to one course.

Pulled through the Canvas API, not sampled: all 68 pages, 15 assignments, 10 quizzes with every
question and answer key, 12 discussions, 4 announcements, 10 outcomes, 33 files, 13 modules, the
Syllabus tab body, and the printable artifacts.

## Verification status

An 8-lens agent audit ran; 6 lenses completed before the session hit its usage limit, and 81 of 82
adversarial verifiers plus the completeness critic died with it. Rather than ship 80 unverified
claims, the highest-severity ones were re-checked by hand against the raw course data. Findings are
tagged **VERIFIED** (confirmed against the data), **REPORTED** (specific and plausible, not
independently confirmed), or **REFUTED** (checked and untrue — listed so nobody re-reports them).

---

## Blockers

### B1. The Week 5 quiz teaches supervisors not to listen to their crew — VERIFIED

`Week 5 Knowledge Check` systematically keys anti-Crew-Resource-Management doctrine as correct, in a
course whose Week 4 *is* Crew Resource Management.

- **Q2** *"In high-stress EMS situations, it is important to involve all team members in the
  decision-making process."* → keyed **False**, with feedback shown to the student:
  *"The misconception is that all voices must be heard. In urgent scenarios, this can lead to
  indecision and delay."*
- **Q4** keys *"All of the above"* where option A is *"Over-relying on team input"*.
- **Q1** keys *"The Intuitive Model"* — gut feeling — as most effective. None of its four
  named models is taught anywhere in the course.

CRM exists because crew members who saw the error stayed silent. This marks a student wrong for
holding that belief. It also contradicts the course's own `crew-resource-management-lecture-notes`
and Week 6 Q1, so a consistent student is guaranteed to lose points somewhere. This is the one
finding an adversarial verifier reached before the budget ran out: `refuted: false`, confidence high.

**Content defect — not fixed in code.** Requires an instructor rewrite of the item.

### B2/B3. Seven of eight short-answer items were unpassable — VERIFIED → FIXED

Canvas grades `short_answer_question` by exact string match. Four items keyed the literal
placeholder `[Instructor review required]` (W5 Q3, W7 Q3, W7 Q5, W8 Q3). Three more keyed
comma-joined phrases no student would type verbatim (`High-stress decision-making, managing team
dynamics`; `Patient satisfaction surveys, performance metrics`; `Communication and teamwork`).
**20 of 99 quiz points that a correct student scored zero on, silently** — and a visible cheat code,
since typing the bracket string scored full marks.

### B4. The Legal and Ethical module contains no law — VERIFIED

Searching the entire course, none of HIPAA, EMTALA, scope of practice, negligence, refusal of care,
mandatory reporting, duty to act, abandonment, or malpractice appears anywhere. Partially addressed:
the new EMS subject profile puts *scope of practice* and *medical direction* into the vocabulary,
but the module still needs real legal content.

### B5. No way to contact the instructor — VERIFIED

No email address appears anywhere in the course. Every page defers to another: the Communication and
Help page says to use *"the instructor's stated contact method"*, which is never stated.

### B6. The calendar promises dates and delivers "See Canvas" 118 times — VERIFIED → PARTLY FIXED

`Course Calendar and Workload Plan` contains that literal string 118 times and not one hour figure,
while every graded item has `due_at: null`. Readiness now says so explicitly (`due-dates-decided`)
instead of passing silently, but `enableDueDates` still defaults off — a product decision.

### B7. Four identical announcements, none clickable — VERIFIED → FIXED

All four opened with the same day-one welcome, including two titled "Midpoint check-in" and "Final
stretch". Every navigation link inside them was an `<a>` with **no href** — 11 styled buttons that
did nothing.

### B8. The instructor guide was downloadable by every student — VERIFIED → FIXED

`instructor-guide.pdf` and `instructor-guide-printable.html` shipped `hidden:false, locked:false`.
The unpublished Instructor Resources module hides the *page*, never the *file*.

### B9. Graded work depends on artifacts that do not exist — REPORTED

Confirmed sub-case: the Week 10 Design critique (20 pts) requires reviewing a peer's portfolio, but
`peer_reviews` is `false` on **every** assignment — VERIFIED. `[insert due date]` also leaked into
two discussion prompts.

---

## Major (selected)

| # | Finding | Status |
|---|---|---|
| M1 | 10 CLOs were a 6-frame Bloom template; CLO 1≈7, 2≈8, 4≈10 | VERIFIED → FIXED |
| M2 | Alignment map states every quiz as 18 pts; real values 6–11 | VERIFIED → FIXED |
| M3 | Equivalent weekly quizzes worth 6–11 points in one 15% group | VERIFIED → FIXED |
| M4 | 2 attempts + immediate answers + keep-highest = free full marks | VERIFIED → FIXED |
| M6 | A rubric level scoring 2 points for both Proficient and Developing | VERIFIED → FIXED |
| M8 | Theme-picker tagline "Quiet precision" printed 57× to students | VERIFIED → FIXED |
| M9 | "EMS" lowercased to "ems" 44× across 17 pages | VERIFIED → FIXED |
| M11 | Course still named "CNVS - Blaine's Blank Course" | VERIFIED |
| M12 | `require_initial_post` on the ungraded help forum | VERIFIED → FIXED |
| M13 | 20 paragraphs repeated across 3+ documents; 20,344 redundant chars | VERIFIED |
| — | Printable syllabus dropped its policy box and support menu | VERIFIED → FIXED |
| — | 32 of 33 visual templates shipped WCAG AA contrast failures | VERIFIED → FIXED (3 left) |

---

## Refuted — do not re-report

- **"Workload figures contradict: 135 vs 227 vs 146 hours."** Only 135 appears anywhere, and it is
  internally consistent (30+34+30+14+11+16). Two lenses reported this; both were wrong.
- **"Rubric criteria totals do not match assignment points."** All 15 rubrics total exactly their
  `points_possible`. The real defect was the non-discriminating level (M6).
- **"Week 1 discussion criteria sum to 35 points."** The embedded scheme totals 10.
- **"Four divergent syllabus copies."** The Syllabus tab and the syllabus Page are 100% identical.
  The printable differed by 3.8%, entirely the two interaction blocks — a real bug, now fixed.
- **"16 of 33 files are never referenced."** The ten `module-N-header.svg` files are intentional
  instructor handoff assets, and `course-tile.svg` is the Canvas course-card image set through
  course settings rather than an HTML link.
- **"The ten discussion formats are cosmetic."** `discussionFormatDetails` gives each a genuinely
  different prompt; what repeats is the shared scaffolding around them.
- **Internal links.** All 160 resolve. The only dead links were the href-less announcement anchors.

---

## Root causes fixed

| Root cause | Location | Explains |
|---|---|---|
| Unresolvable hrefs "repaired" by deleting the href and keeping the `<a>`, producing styled dead buttons — and blinding `placeholder-links`, which can only see hrefs that exist | `htmlSafety.ts`, `courseRepair.ts` | B7 |
| Announcements were in no quality gate at all — `readiness.ts` and `courseQuality.ts` had zero references to them | `readiness.ts` | B7 |
| The announcement AI prompt received only the title — no term position, no draft, no link tokens | `aiBuilders.ts`, `fullCourseContent.ts` | B7 |
| No validation that a `short_answer` key is matchable; the generator's own templates emitted `short_answer` with no key at all | `aiBuilders.ts`, `quizBuilder.ts` | B2, B3 |
| Instructor scheduling notes rendered as the student-facing weekly schedule | `courseGenerator.ts` | B6 |
| Outcomes hardcoded to 10 while Bloom has 6 levels; no health/public-safety subject profile, so EMS fell to a generic fallback | `courseGenerator.ts` | M1 |
| Every due-date check short-circuited to "passed" when due dates are off | `readiness.ts` | B6 |
| Instructor artifacts exported as ordinary unrestricted course files | `imsccExport.ts` | B8 |
| Naive `.toLowerCase()` on topic/title at ~33 call sites | `courseGenerator.ts`, `moduleOverviewTemplates.ts` | M9 |
| `bannerLabel` (theme-picker UI copy) exported to students | `courseGenerator.ts`, `data/themes.ts` | M8 |
| Printables built from raw `bodyHtml`, dropping composed interaction blocks | `imsccExport.ts` | printable syllabus |
| Nothing checked contrast of colours inside generated HTML | `htmlSafety.ts`, `readiness.ts` | 32 templates |
| The alignment map is a page rendered during generation, so it froze the template quizzes' 4+2+4+5+3 = 18 and never saw the AI fill pass recompute them | `courseGenerator.ts`, `fullCourseContent.ts` | M2 |

**The pattern underneath all of it:** RocketCourse validated *structure* thoroughly — 76 readiness
checks covering modules, rubrics, weights, links, heading order — and validated *truth* almost not
at all. Nothing checked whether an answer key was achievable, whether a stated point value matched
the real one, whether a "Legal Issues" module contained law, or whether an announcement's body
matched its title. That is why this course passed its own readiness gate and still could not be
taught.

---

## Measured result

Regenerated an EMS course from the fixed generator, put it through the same
`prepareStudentFacingHtmlForCanvas` the exporter applies, and re-ran the checker:

| | live export | after fixes |
|---|---|---|
| **blockers** | **22** | **3** |
| major | 66 | 26 |
| minor | 14 | 10 |

Driven to zero: dead anchors (11), quiz answer-key exploit (10), unpassable short-answer keys (7),
duplicate outcomes (4), bracket placeholders (4), duplicate announcement bodies, theme tagline (57),
lowercased acronyms (44), quiz point and length disparity, and both syllabus placeholder leaks.

## Still open

- **Content defects needing an instructor**, not code: B1 (the CRM quiz items), B4 (no EMS law),
  B5 (no contact route), M11 (course name).
- **`enableDueDates` defaults off** — a product decision, now surfaced honestly rather than hidden.
- **Three visual templates** still fail AA: palette limits (an accent too light to carry white, one
  gradient where neither black nor white clears AA), not code defects.
- **Template repetition** — 20 paragraphs across 3+ documents. Template design, the largest
  remaining content-quality item.
- **`late_policy.xml`** — Canvas emits it, RocketCourse does not. The syllabus describes a late-work
  policy in prose while the gradebook ships without one. See `fixtures/canvas-export-reference/`.
- **Two audit lenses never ran to completion** as agent passes: accessibility and cross-document
  consistency. Both were subsequently done by hand and are reflected above.
