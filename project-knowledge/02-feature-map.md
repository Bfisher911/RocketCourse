# Feature Map

## Authentication And Onboarding

| Feature | What it does | Status | Main files | Routes/screens | Data | External services | Gaps |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Landing entry | Presents value proposition and two CTAs | Working prototype | `src/App.tsx`, `src/styles.css`, `index.html` | `landing` screen | None | None | Marketing claim needs Canvas verification qualifier |
| Account/subscription status | Top-bar toggle simulates paid vs locked export | Mocked | `src/App.tsx` | All screens | React state only | None | Needs real auth, account, plan, and server enforcement |
| Onboarding wizard | Intake prompt plus guided settings | Working prototype | `src/App.tsx`, `src/data/defaultSettings.ts`, `src/data/themes.ts`, `src/types.ts` | `intake` screen | In-memory `CourseSettings` | None | No persistence, no validation beyond control constraints |

## Dashboard

| Feature | What it does | Status | Main files | Routes/screens | Data | External services | Gaps |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Project list | Shows local projects and opens selected project | Working prototype | `src/App.tsx` | `dashboard` | In-memory `projects` | None | Lost on refresh; no owner/user filtering |
| Stats panels | Shows count of projects, exports, and simulated plan | Working prototype | `src/App.tsx` | `dashboard` | In-memory `projects`, `subscriptionActive` | None | Not backed by analytics or billing |

## Course Creation And Generation

| Feature | What it does | Status | Main files | Routes/screens | Data | External services | Gaps |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Prompt-based generation | Generates a structured course from prompt/settings | Working deterministic simulation | `src/services/courseGenerator.ts`, `src/App.tsx` | `intake` -> `progress` -> `editor` | `CourseProject` object | None | No LLM, no prompt template versioning, no source parsing |
| Generation progress | Timed progress list while generation runs | Mocked | `src/App.tsx` | `progress` | `progressIndex` | None | Progress is time-based, not job-based |
| Course settings | Lets users set level, modality, credits, weeks, modules, pattern, tone, quiz/discussion cadence, toggles | Working prototype | `src/App.tsx`, `src/data/defaultSettings.ts`, `src/types.ts` | `intake` | `CourseSettings` | None | Some settings are not fully honored; `assignmentTypes`, `includeObjectives`, `includeBloom`, `includeRubrics`, `includeContactHours`, and `accessibilityFocus` are not consistently conditional in generation |
| Source file attachments | Shows attached file names and sizes | Partially built | `src/App.tsx`, `src/types.ts` | `intake` | `SourceFile` metadata | Browser File API | Files are not read, parsed, uploaded, stored, or used by generator |

## Course Editor

| Feature | What it does | Status | Main files | Routes/screens | Data | External services | Gaps |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Overview editor | Edits title, description, and outcome text | Working prototype | `src/App.tsx`, `src/types.ts` | `editor`, Overview tab | `CourseProject.outcomes` | None | No add/delete outcome controls |
| Homepage and syllabus editor | Edits title/body HTML and previews HTML | Working prototype with safety caveat | `src/App.tsx` | Homepage/Syllabus tabs | `CoursePage` | None | Uses `dangerouslySetInnerHTML`; validation only checks script tags |
| Page, assignment, discussion editors | Edits title and body/prompt HTML | Working prototype | `src/App.tsx` | Pages/Assignments/Discussions tabs | `CoursePage`, `Assignment`, `Discussion` | None | No object creation/deletion; limited field editing |
| Quiz editor | Edits quiz title, purpose, and question stems | Partial | `src/App.tsx`, `src/types.ts` | Quizzes tab | `Quiz` | None | Cannot edit choices, correct answers, feedback, points, or add/delete questions |
| Rubric editor | Edits rubric title and displays criteria count/points | Partial | `src/App.tsx`, `src/types.ts` | Rubrics tab | `Rubric` | None | Cannot edit criteria, levels, descriptions, or points |
| Gradebook setup | Edits group name and weight | Working prototype | `src/App.tsx` | Gradebook Setup tab | `AssignmentGroup` | None | No add/delete groups; no assignment regrouping UI |
| Contact hours | Edits workload-hour fields and justification | Working prototype | `src/App.tsx`, `src/types.ts` | Contact Hours tab | `ContactHourPlan` | None | No institution rule validation |
| Theme picker | Selects visual theme for course/export | Working prototype | `src/App.tsx`, `src/data/themes.ts` | Theme tab | `Theme` | None | Does not update already-generated inline HTML colors except course theme state/export banner |

## Modules And Reordering

| Feature | What it does | Status | Main files | Routes/screens | Data | External services | Gaps |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Drag module reorder | Reorders modules and renumbers module order | Working prototype | `src/App.tsx` | Modules tab | `CourseModule[]` | None | Positions start at 0; Canvas may expect 1-based ordering |
| Drag module-item reorder | Reorders items within or across modules | Partial | `src/App.tsx` | Modules tab | `ModuleItem[]` | None | Moving an item does not update underlying page/assignment/discussion/quiz `moduleId` |
| Add blank module | Adds empty draft module | Working prototype | `src/App.tsx` | Modules tab | `CourseModule` | None | Readiness fails if module has no items; no add-item UI |
| Duplicate module | Copies module shell/items | Partial | `src/App.tsx` | Modules tab | `CourseModule` | None | Duplicated items keep original `refId`, so they point to original content objects |

## AI Assistant Or Chatbot

| Feature | What it does | Status | Main files | Routes/screens | Data | External services | Gaps |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AI revise toolbar | Appends canned HTML snippets to homepage/syllabus or first assignment | Mocked | `src/App.tsx`, `reviseActiveContent` | Editor header | Current course object | None | Not AI; no model call, no prompt, no undo, no per-object regeneration |
| Chatbot | None | Not built | None | None | None | None | No chat UI or service exists |

## Readiness And Validation

| Feature | What it does | Status | Main files | Routes/screens | Data | External services | Gaps |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Course readiness score | Checks objectives, modules, rubrics, weights, workload, homepage, syllabus, Start Here, scripts, and content length | Working prototype | `src/services/readiness.ts`, `src/App.tsx` | Editor/readiness panel/export tab | `CourseProject` | None | Some checks are shallow; broken internal links are marked true until export |
| Local IMSCC validation | Checks package file presence, manifest references, module references, scripts, readiness warning, quiz files | Working local validation | `src/services/imsccExport.ts`, `src/services/imsccExport.test.ts` | Export tab | JSZip package and `CourseProject` | None | Does not parse XML despite planned claim; no Canvas import confirmation |

## Export

| Feature | What it does | Status | Main files | Routes/screens | Data | External services | Gaps |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Browser-side `.imscc` package | Creates a ZIP blob with `.imscc` filename | Working prototype | `src/services/imsccExport.ts`, `src/App.tsx` | Export tab | `CourseProject` | JSZip | Canvas sandbox import unverified |
| Canvas course files | Writes manifest, course settings, module metadata, assignment groups, rubrics, outcomes, syllabus, pages, assignments, discussions, quizzes, banner | Working structure, compatibility unknown | `src/services/imsccExport.ts` | Export tab | `CourseProject` | JSZip | Quiz QTI is minimal and likely incomplete; XML compatibility needs real import tests |
| Export history | Adds local history after successful validation/download | Working prototype | `src/App.tsx`, `src/types.ts` | Dashboard/export flow | `ExportHistoryItem[]` | None | Lost on refresh; not audit-quality |

## Billing Or Pricing

| Feature | What it does | Status | Main files | Routes/screens | Data | External services | Gaps |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Individual plan display | Shows `$20/mo` when subscription is active | Mocked | `src/App.tsx` | Dashboard/top bar/export | `subscriptionActive` | None | No Stripe, checkout, customer, plans, invoices, limits |
| Export gate | Disables export button when inactive | Mocked client gate | `src/App.tsx` | Export tab/top bar | `subscriptionActive` | None | User can toggle gate; no server enforcement |

## Organization Or Institution Management

Status: Not built.

The MVP plan references school/department users and future institution templates, but no implemented feature exists.

## Uploads And Files

Status: Partially built.

The intake accepts `FileList` and stores `name`, `sizeLabel`, and status. No file content is loaded or persisted. Generated assignments use a Canvas submission type that allows online upload/text entry, but that is Canvas export metadata, not an app upload system.

## Analytics, Reporting, Notifications, Settings

Status: Not built.

No analytics, notifications, email provider, user settings page, app settings table, or reporting route exists.

## Public Marketing Pages

Status: Minimal single landing screen.

The app has a landing screen and document metadata in `index.html`, but no separate marketing site, pricing page, docs page, testimonials, terms, privacy, or public demo route.

