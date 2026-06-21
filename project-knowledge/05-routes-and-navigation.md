# Routes And Navigation

## Routing Model

There are no URL routes.

The app uses internal screen state:

- `landing`
- `dashboard`
- `intake`
- `progress`
- `editor`

This is defined as `Screen` in `src/types.ts` and rendered conditionally in `src/App.tsx`.

## Public Routes

Because there is no auth layer, every screen is public to anyone who can load the app.

| Path/screen | Page purpose | Main component files | Required auth or role | Data loaded | Actions available | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| `landing` | Marketing/value proposition and app entry | `src/App.tsx`, `Landing` | None | None | Start intake, view dashboard | Claims "Canvas-ready" before sandbox verification |
| `dashboard` | Local projects, export count, simulated plan status | `src/App.tsx`, `Dashboard` | None | In-memory `projects` | Create new course, open project | No persistence, no user/project ownership |
| `intake` | Prompt, course settings, file metadata | `src/App.tsx`, `Intake` | None | In-memory `prompt`, `settings` | Attach file metadata, generate course | Uploads not parsed or stored |
| `progress` | Timed generation progress | `src/App.tsx`, `Progress` | None | `progressIndex` | Passive progress display | Fake job progress, no cancel/error path |
| `editor` | Course editing and export workspace | `src/App.tsx`, `Editor` and tab components | None | Current `CourseProject` | Edit content, reorder, revise, validate/export | Entire editor is public in current prototype |

## Authenticated Routes

None.

## Student Routes

None.

There is no student-facing app surface. Students exist only as the intended audience for exported Canvas course content.

## Instructor Routes

No protected instructor routes exist.

The editor behaves like an instructor/designer workspace, but every visitor can access it.

## Admin Routes

None.

## Super Admin Routes

None.

## Demo Routes

No dedicated demo route exists.

The app starts with a generated `sampleProject`, which makes the normal app behave like a local demo.

## API Routes

None.

No backend or API route directory exists, and no frontend code calls `fetch`.

## Navigation Items

Top bar:

- Brand button -> `landing`.
- Dashboard button -> `dashboard`.
- Create button -> `intake`.
- Editor button -> `editor`.
- Subscription button toggles `subscriptionActive`.

Editor side rail:

- Overview.
- Modules.
- Assignments.
- Discussions.
- Export.

Editor tabs:

- Overview.
- Homepage.
- Syllabus.
- Modules.
- Pages.
- Assignments.
- Discussions.
- Quizzes.
- Rubrics.
- Gradebook Setup.
- Contact Hours.
- Theme.
- Export.

## Dead Routes

There are no URL routes to be dead.

Potential dead or misleading navigation:

- The top-bar `Editor` button is always shown and opens the editor with the current/sample course. In a production app, it should probably be hidden or redirected when no project is selected.
- The side rail only exposes a subset of editor tabs, while the horizontal tab strip exposes the full set. This is not broken, but it creates two navigation systems.

## Duplicate Routes

No duplicate URL routes exist.

There is duplication in navigation surfaces:

- `Editor` side rail duplicates some horizontal tabs.
- `Dashboard` and `Create` are available from both landing CTAs/top nav.

## Links Or Buttons That Lead Nowhere

No obvious buttons are nonfunctional in the current UI, but several simulate behavior:

- Subscription button toggles paid/unpaid status locally.
- AI revise buttons append canned snippets rather than calling AI.
- File upload stores metadata only.
- Export validation does not confirm Canvas import.

## Navigation Items That Should Be Hidden For Some Roles

Because roles do not exist, no navigation is hidden.

Future likely rules:

- Students should not see editor, export, billing, or generation screens.
- Unpaid users can edit/preview but should not download export packages.
- Org admins should see user/project/billing management.
- Super admins should have platform operations tools.
- Guests/demo users should be prevented from real AI spend and private data access.

