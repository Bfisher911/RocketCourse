# Switching Behavior & Context Mapping (Phase 4)

## The invariant
Switching an experience is a **presentation change only**. It must never:
regenerate · duplicate · reset · reorder · remove content · change approved content · change
readiness results · change source materials · change export history · change the course theme ·
lose unsaved work · create incompatible versions · require a second subscription · trigger an AI
call solely because the view changed.

It changes only: navigation · information presentation · editing context · guidance · progressive
disclosure · the order existing work is surfaced · how next actions are recommended.

## How the foundation enforces it
- **One shared course.** Every experience renders the same shared course state. In this slice that
  is the single mutable `session` object in `prototypes/shared/blocks.js`; the next slice swaps it
  for an adapter over the real `CourseProject`. Because the state is shared, an edit made in one
  experience is already present in the next — nothing is copied or regenerated on switch.
- **A shared context pointer.** `WorkflowContext.taskPointer` (1–12) is an experience-independent
  pointer to *where the user is* (start, sources, blueprint, Module 4, an item, readiness,
  preview, export). It lives outside any experience.
- **Restore on switch.** `WorkflowHost.show(id)` mounts the new experience and immediately calls
  its `goToTask(pointer)`, mapping the user to the equivalent context. Verified: Module 4 in
  Guided → Module 4 in Blueprint Studio; the same incomplete rubric and AI-draft flags are present.

## Context mapping across experiences (target)
| Shared pointer | Guided | Blueprint | Map | Partner | Tasks | Storyboard | Guided/Expert | Wildcard |
|---|---|---|---|---|---|---|---|---|
| Module 4 | Review→M4 | Studio→M4 | tree→M4 node | center→M4 | Content job→M4 | zoom→M4 scene | Modules→M4 | expand conversation 4 |
| An item (assignment) | inline editor | studio editor | item + inspector | center editor | assessment job | item scene | modules editor | reading panel |
| Readiness issue | Fix-issues stage | Readiness node | Readiness node | Readiness | Clear-blockers job | Readiness ribbon | Readiness section | margin note |
| Student preview | Preview stage | Preview node | Preview node | Student toggle | Preview job | Preview ribbon | Preview section | "Read as student" |
| Export | Export stage | Export node | Export node | Export | Canvas job | Export ribbon | Export section | "Send to Canvas" |

When an exact mapping is impossible, preserve the nearest meaningful **parent** context and tell
the user where they landed (to be surfaced as a small notice in the next slice).

## Preferences
`resolveExperienceId(courseSpecific, userPreferred)` → course-specific, else user-preferred, else
`guided-journey`. Persisted in `localStorage` (never in course content, never in the export).
