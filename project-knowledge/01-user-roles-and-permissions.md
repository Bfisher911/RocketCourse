# User Roles And Permissions

## Summary

The implemented app has no real authentication, authorization, user table, role table, route guards, organization membership, tenant membership, or admin permission model. All users are effectively one local browser user interacting with in-memory React state.

The product plan discusses future `User`, `Subscription`, institution, role, Supabase, and Stripe concepts in `docs/COURSEFORGE_MVP_PLAN.md`, but those are not implemented in the current source tree.

## Implemented Access Model

| Role or actor | Current implementation | How created | Access | Cannot access | Evidence |
| --- | --- | --- | --- | --- | --- |
| Local browser user | Only real implemented actor | Created implicitly when app loads | All screens and all local course data | Nothing is technically restricted except export when the simulated subscription flag is off | `src/App.tsx`, `useState` calls for `screen`, `projects`, `course`, and `subscriptionActive` |
| Simulated paid user | Boolean state, not a persisted account | Top-bar button toggles `subscriptionActive` | Export button enabled and `exportCourse` runs | No backend-only paid features | `src/App.tsx`, `subscriptionActive`, `TopBar`, `ExportTab`, `exportCourse` |
| Simulated unpaid/preview user | Same local user with `subscriptionActive` false | Top-bar button toggles state | Can view, edit, generate, preview readiness | Export button disabled; `exportCourse` early returns | `src/App.tsx`, `subscriptionActive` and disabled export button |

## Student

Status: Not implemented as an app role.

Students are a content audience, not a user class in the app. Generated pages, syllabus language, assignments, discussions, and support copy are written for students. The export engine also writes Canvas settings related to student discussion behavior.

Evidence:

- `src/services/courseGenerator.ts` writes student-facing guidance, student task wording, and support language into generated HTML.
- `src/services/imsccExport.ts` writes Canvas course settings such as `allow_student_discussion_topics` and `allow_student_forum_attachments`.
- `src/types.ts` has no `Student`, `Enrollment`, or role interface.

Access:

- No student dashboard.
- No assignment submission.
- No student authentication.
- No route protection.

## Instructor

Status: Product target, not implemented as an auth role.

Instructors are the assumed primary app users. The editor lets the current browser user create and edit instructor-facing course objects.

Evidence:

- `docs/COURSEFORGE_MVP_PLAN.md` lists individual instructors as primary users.
- `src/services/courseGenerator.ts` inserts instructor placeholder text in the homepage and syllabus.
- `src/services/imsccExport.ts` sets wiki page metadata `editing_roles` to `teachers`.

Access:

- In practice, every visitor can access instructor-style editor functionality.
- No route guard prevents non-instructors from creating, editing, or exporting.

## Instructional Designer

Status: Product target, not implemented as an auth role.

Instructional designers are explicitly listed in the MVP plan as primary users. No separate permissions, screens, or metadata distinguish designers from instructors.

Evidence:

- `docs/COURSEFORGE_MVP_PLAN.md` lists instructional designers as primary users.
- No `designer` role or permission string appears in source.

## Admin

Status: Not implemented.

There is no admin dashboard, user management, organization management, billing dashboard, system settings, or analytics console.

Evidence:

- No admin routes exist in `src/App.tsx`.
- `src/types.ts` contains no role, permission, organization, admin, or user interfaces beyond future-looking product-plan concepts.

## Super Admin

Status: Not implemented.

No super-admin concept exists in the current code.

Evidence:

- Keyword search found no implemented `super admin` or equivalent source object.

## Guest Or Demo User

Status: Implicit local demo, not a role.

The app starts with `sampleProject` in state and a default prompt/settings set. That gives the app demo behavior, but there is no explicit guest account or protected demo environment.

Evidence:

- `src/services/courseGenerator.ts` exports `sampleProject`.
- `src/App.tsx` initializes `projects` and `course` from `sampleProject`.
- `README.md` describes deterministic generation for local demos.

## Organization, Institution, Tenant, School, Workspace

Status: Planned or implied, not implemented.

The MVP plan mentions department/school staff, institution templates, and future Supabase/Postgres. The current app has no tenant object, organization membership, school account, workspace switcher, invite flow, or institution-specific template library.

Evidence:

- `docs/COURSEFORGE_MVP_PLAN.md` includes future `User` and institution concepts.
- `src/types.ts` does not define organization, tenant, workspace, invite, or enrollment types.

## Route Protections

There are no URL routes and no route protections.

The app uses:

- `Screen = "landing" | "dashboard" | "intake" | "progress" | "editor"` in `src/types.ts`.
- Conditional rendering in `src/App.tsx`.
- Top-bar navigation buttons that can move directly to `dashboard`, `intake`, and `editor`.

Implication: Any user who can load the app can open the editor. The only access gate is the client-side export button, and that gate can be toggled by the user.

## Permission Concerns

- Export gating is client-side only and must not be treated as real billing enforcement.
- There is no auth provider, session check, route guard, server-side policy, or database RLS.
- The top-bar `Editor` button can open the editor directly with the sample project.
- Student/instructor/admin concepts are mixed in content language and future docs but are not app permissions.
- Future agents should implement auth and billing on the server before using this as a paid SaaS.

