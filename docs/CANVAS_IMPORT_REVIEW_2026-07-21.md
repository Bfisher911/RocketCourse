# Canvas import review — July 21, 2026

Live review of a RocketCourse .imscc imported into Canvas (Tulane sandbox course 2325538,
"Ethical Voids in Everyday Interface Design"), followed by fixes in the generator and export
pipeline. All findings were verified against the imported course through the Canvas UI and the
Canvas REST API before changing code.

## What already worked

- All 15 content images resolved to Canvas-hosted files; no broken references or leftover
  `$IMS-CC-FILEBASE$` tokens anywhere in the 68 imported pages.
- Every image imported with an alt attribute.
- Quizzes imported with mixed question types and intact answers; module structure, subheaders,
  points, and the unpublished Instructor Resources module all arrived correctly.
- Content pages (lecture/notes) are well structured and student-readable.

## Defects found and fixed

1. **Blueprint module overlay was off by one** (`src/services/aiGeneration.ts`).
   AI blueprint modules were overlaid onto `base.modules` by raw index, so the AI's first module
   title landed on the "Start Here" orientation module and every content week displayed the next
   module's title ("Module 2: …" holding Week 1 items; the last week kept its generic title).
   Fix: blueprint topics are now stripped of their own "Module N:" numbering and passed into the
   deterministic generator as `moduleTopicsOverride`, so module titles, page titles, discussion
   prompts, and quiz framing share the same subject; summaries/objectives overlay CONTENT modules
   only.

2. **"Alt text placeholder" and editor instructions leaked into student-facing HTML**
   (`src/utils/contentBlocks.ts`). The homepage hero printed its alt text below the banner, the
   welcome card shipped "Replace with the instructor's local response-time policy.", and the
   course-trailer block rendered "Video placeholder" guidance to students. Fixes: alt text lives
   only in the `alt` attribute; welcome/communication cards use student-safe copy pointing to the
   syllabus; the trailer placeholder block was removed from all homepage presets (still available
   in the block picker).

3. **"Week 1 Final Project Project Proposal Checkpoint"** — doubled word from
   `${finalTitle} ${milestoneLabel}` concatenation. Milestone label is now "Proposal Checkpoint"
   (`src/services/courseGenerator.ts`).

4. **Homepage module directory filler** — every card showed "Check Canvas for dates"; the
   week-at-a-glance block was titled "This Week at a Glance" (stale on a static page) and could
   surface a Week 3 assignment in the Week 1 summary via a course-wide fallback. Fixes: empty
   metadata pills are dropped; the glance block titles itself from the module label ("Week 1 at a
   Glance") and only counts graded work belonging to that module.

## Imagery tab UX fixes (ui-ux-pro-max review)

- `ImageryTab.tsx` used `primary-button` / `secondary-button` classes that had no CSS anywhere, so
  Upload / Generate / Compare-plans rendered as unstyled 22px native buttons. Now uses the design
  system's `.primary` / `.secondary` (44px min-height, brand gradient).
- Hidden file input got an `aria-label` and `tabIndex={-1}`; the visible Upload button is the
  single keyboard entry point.
- The upload hint now explains *why* the button is disabled until the rights acknowledgment is
  checked.
- Readiness ring caption changed from "images" (read as "33 images") to "readiness".
- Verified at 375px: no horizontal scroll; placement chips scroll in their own row.

## Still open / external

- The Tulane course itself was imported from an older export and still shows the pre-fix naming;
  re-export and re-import to verify the fixes end-to-end in Canvas.
- Canvas course-card assignment remains a documented manual step (not portable via IMSCC).
- 57 pages contain inline `height: Npx` styles (mostly small decorative elements); none broke
  mobile rendering in review, but a sweep toward aspect-ratio/min-height styles is a reasonable
  future cleanup.
