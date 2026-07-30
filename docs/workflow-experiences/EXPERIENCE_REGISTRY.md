# Experience Registry (Phase 2)

The nine interchangeable course-building experiences are defined in one typed source of truth:
`src/workflows/experienceRegistry.ts`. The Experience Selector and the Workflow Host both read
this list, so **adding a future experience means adding one entry** — no selector or host rewrite.

## The nine experiences

| Code | id | Name | Guidance | Navigation | Prototype key | Default |
|---|---|---|---|---|---|:--:|
| W01 | `original` | Original RocketCourse | medium | legacy tabs | — (live editor) | |
| W02 | `guided-journey` | Guided Course Journey | high | linear milestones | `guided` | ✅ |
| W03 | `blueprint-studio` | Blueprint-First Studio | medium | decisions first | `blueprint` | |
| W04 | `course-map` | Course Map Workspace | low | tree + inspector | `map` | |
| W05 | `course-partner` | Conversational Course Partner | adaptive | course + AI proposals | `partner` | |
| W06 | `task-command-center` | Task-Based Command Center | medium | job board | `tasks` | |
| W07 | `visual-storyboard` | Visual Storyboard | low | zoom filmstrip | `storyboard` | |
| W08 | `guided-expert` | Guided & Expert Modes | switchable | density toggle | `modes` | |
| W09 | `wildcard` | Reading-Room Desk | low | document desk | `wildcard` | |

## Metadata each entry defines
Stable `id` (URL-safe, never a DB id) · `code` (W01–W09) · `name` · `shortDescription` ·
`longDescription` · `bestFor` · `guidance` · `navModel` · `prototypeKey` (renderer under
`prototypes/concepts/<key>.js`, or `null` for the live editor) · `demoAvailable` · `isDefault` ·
`enabled` · `recommendedUserTypes` · `supportedResponsive` · `featureFlag` · `analyticsId` ·
`accent` (semantic color, always paired with a text label — never color alone).

## Preference hierarchy
`resolveExperienceId(courseSpecific, userPreferred)` returns, in order:
1. an explicit **course-specific** experience (if enabled),
2. the user's **preferred** experience (if enabled),
3. the **default** (`guided-journey`).

User preference persists to `localStorage` (`rc.workflow.userPreferred`); course-specific
preference to `rc.workflow.course.<courseId>` — see `src/workflows/workflowContext.ts`. Neither
stores course content; they store only *which experience* to show.

## First-run behavior
New users begin in **Guided Course Journey** (marked `Recommended` in the selector) and are told
other experiences exist — they are never forced to choose among nine before understanding the
product.

## How to add a future experience
1. Add one `WorkflowExperience` object to `EXPERIENCES` in `experienceRegistry.ts`.
2. Provide a renderer: either a `prototypeKey` pointing at a
   `prototypes/concepts/<key>.js` module exporting `mount(stage, ctx)` (+ optional `rationale()`),
   or, for a React experience, register its entry component (next slice).
3. Set `enabled: true` and a `featureFlag`. The selector and host pick it up automatically.

## Switching contract (never changes content)
Switching an experience changes only navigation, presentation, editing context, guidance,
progressive disclosure, the order work is surfaced, and how next actions are recommended. It must
**never** regenerate, duplicate, reset, reorder, or lose course content, readiness, theme, source
materials, or export history, and must not trigger an AI call merely because the view changed. See
`SWITCHING_BEHAVIOR.md`.
