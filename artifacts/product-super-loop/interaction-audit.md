# RocketCourse interaction and defect audit

Run date: 2026-07-20

## Scope and evidence

- Active repository: `/Users/blainefisher/Documents/CourseForge`
- Current stack: React 18, TypeScript, Vite, Supabase persistence/auth, Netlify Functions, server-side OpenAI proxy, Stripe entitlement, JSZip IMSCC export, Vitest.
- Detailed grouped control inventory: `artifacts/product-super-loop/interaction-inventory.md`.
- Current-run visual evidence: landing page at 1920x1080, 1440x1000, 768x1024, and 390x844; public demo entry; editor Overview/readiness state.
- Automated evidence: 81 test files / 727 tests, lint, TypeScript application/functions checks, production build/prerender, focused generation/readiness/IMSCC regressions, and browser runtime log review with zero error-level entries.

## Interaction inventory summary

| Surface | Primary controls | State and downstream effects | Validation/recovery |
| --- | --- | --- | --- |
| Public shell | Home, Demo, Pricing, Guides, About, Contact, Blog, Sign in | Internal route state / URL; no course mutation | Keyboard-visible buttons, skip link, and compact mobile menu |
| Create intake | Guided/Quick mode, prompt, description, structure, assessment, schedule, theme, accessibility, sources | `CourseSettings`; feeds blueprint, generation, editor, readiness, export | Guided default, progressive steps, inferred-setting explanation, file parsing status |
| Blueprint | Approve, return/edit | Approved blueprint feeds full generation | Human approval boundary before full generation |
| Editor shell | Phase rail, Guided/All sections, Undo/Redo, Review, Ready to export, AI revision actions | Course object graph; autosave for authenticated projects | Undo/redo; guarded AI revisions; live readiness |
| Object editors | Create, duplicate, delete, move, reorder, edit, attach/alignment controls | Pages, modules, assignments, discussions, quizzes, rubrics, groups and references | Object-specific validation, protected content, snapshots/confirmations |
| Readiness/review | Individual checks, issue navigation, safe repairs | Recomputes from the full project graph | Specific check details and direct editor routing |
| Export | Full/selection modes, validate, IMSCC/QTI/PDF downloads | Serializes current project and dependencies | XML, reference, HTML, QTI, identifier, and package validation |

## Prioritized findings and disposition

| Severity | Finding | Evidence | Disposition |
| --- | --- | --- | --- |
| P1 | Readiness rated verb-swapped, semantically repetitive outcomes as fully ready. | Demo outcomes repeated one generic tail and included “Create key ... concepts”; readiness showed 100%. | Fixed generator and readiness; added regression tests. |
| P1 | Cross-discipline subject leakage/export safety needed a repeatable matrix, not spot checks. | Required seven unrelated courses were not represented together in an end-to-end regression. | Added seven subject/length/module-count/no-leak/IMSCC scenarios. |
| P1 | Global “AI revise” controls acted on unrelated content and silently used canned fallback copy. | On Overview, Concise/Add examples/Accessibility revised the homepage while Rubric note revised the first assignment; the visible tab was not the target. | Removed the misleading duplicate toolbar. Contextual object editors retain explicit deterministic improvements and gated AI generation. |
| P1 | The new subject-specific outcome generator produced “Apply with [subject] methods...” and lowercased proper course names. | Live demo Overview showed “Apply with ai and modern society methods...”. | Corrected verb grammar and preserved the course title's capitalization; added regression assertions. |
| P1 | Object-level buttons promised AI even when the product intentionally fell back to a deterministic generator, and fallback status exposed local developer setup instructions. | Demo claimed no AI credits while Overview still displayed “Draft description with AI”; source note referenced `netlify dev` and `OPENAI_API_KEY`. | Relabeled actions around the user outcome (“Generate draft”, “Draft description”, etc.). The post-action status now reports AI versus built-in generation in user language without leaking setup details. |
| P1 | Guided intake allowed an entirely empty course brief to advance, while a valid source-only course could not enable generation. | Browser test advanced from “What do you teach?” to Course basics with no input; `hasIntake` ignored parsed source files. | Continue now requires a brief, title, or readable source. Source-only syllabus workflows are accepted, and the inline guidance names all three valid paths. |
| P2 | Intake displayed settings whose downstream feature was disabled. | Quiz details remained visible with no quizzes; discussion style with no discussions; scaffold settings without a final project; all calendar fields while due-date generation defaulted off. | Added progressive disclosure tied to the authoritative enable/frequency controls and clear guidance when scheduling is off. Disabling the final project also disables its scaffold state. |
| P1 | A source-only intake generated “Untitled Course” with default 12-week structure even when the source named a four-week course. | Live local-auth run used a pasted “Course: Emergency Preparedness for School Leaders” brief and produced Untitled Course. | Source text now participates in title, duration, level, and modality inference in both Guided and Quick modes. Added inference and generator regression tests. |
| P2 | “Modules” meant teaching modules in intake but total modules after generation, making a selected count of 4 appear as 7. | Source-only four-week run generated four content modules plus Start Here, Final Project, and Instructor Resources; completion dialog reported 7 modules without explaining the difference. | Intake and blueprint now say “teaching modules”; completion reports total modules and explains the teaching/support split; Overview labels the aggregate as total modules. |
| P1 | Export and marketing copy claimed “Ready for launch” and “Canvas-ready” while the same product correctly disclosed that Canvas sandbox import is unverified. | Live Export tab paired “Canvas sandbox import is not verified” with “Ready for launch” and “Canvas-ready package”; SEO/campaign strings repeated the stronger claim. | Replaced unverified compatibility claims with “Canvas-oriented,” “ready for local validation,” and explicit sandbox-testing language across export, SEO, quiz, invite, and campaign copy. |
| P1 | The public demo promised that it never used AI credit, but its Export workflow offered “Generate full content” and described 112 AI requests. | Browser audit of Demo → All sections → Export. | Replaced the AI generation step in demo mode with an honest pre-populated-sample explanation; signed-in workspaces retain full-content generation. |
| P1 | Export validation contradicted editor readiness after identifiers were namespaced for packaging. | Browser validation showed editor readiness at 100%/0 blockers but package validation at 95% with a false Start Here link blocker. A new end-to-end test reproduced the mismatch. | Readiness now resolves the actual exported success-guide and calendar identifiers instead of comparing links with static pre-namespace IDs. The namespaced demo package now validates at 100% with zero blockers and warnings. |
| P2 | Copy/Undo/Redo needed live state evidence, not only unit coverage. | Browser run on Demo → Pages copied the homepage (78→79 pages), undid it (79→78), and exposed Redo. | Verified; the operation participates in the editor snapshot history and restores the original count. |
| P2 | Production bundle remains large. | Vite reports a 1.41 MB minified main chunk and an ineffective dynamic import warning. | Open; performance/code-splitting pass recommended after functional work. |
| P2 | Mobile public navigation required horizontal scrolling and did not visually disclose all destinations at once. | 390px baseline showed Home through Guides; remaining destinations were off-screen. | Fixed with a labeled, keyboard-accessible compact menu that exposes every destination and closes after navigation. |
| Owner | Canvas sandbox import compatibility is not proven by local validation alone. | Product copy correctly says Canvas-oriented/not affiliated and asks users to test in a blank course. | Requires a Canvas sandbox or known-good imported package evidence. |

## Cycle reassessment

- Cycle 1 combined code inspection with the baseline suite and found the P1 outcome-quality/readiness mismatch plus the missing cross-discipline regression matrix.
- Cycle 2 exercised the landing page, intake, public demo, editor, and export flows in the browser. It found the misleading global AI toolbar, empty/source-only intake failures, unverified Canvas claims, demo AI-credit contradiction, and mobile navigation defect.
- Cycle 3 regenerated a source-only course, exercised progressive intake state, and ran package validation. It found the source-inference failure and the namespaced export-readiness contradiction; both received browser-reproduced regression tests and fixes.
- Cycle 4 repeated source-only generation, mobile navigation, demo export validation, and object Copy/Undo behavior. No new P0/P1 issue was found in the repaired browser paths.
- Cycle 5 reran the complete lint, type, unit/integration, IMSCC, and production-build gates. No new P0/P1 issue was found locally.
- Local automation cannot prove every browser control, assistive-technology announcement, paid external AI response, Stripe checkout, Supabase policy, or Canvas sandbox import. Those limits remain explicit.

## Final verification record

| Gate | Result |
| --- | --- |
| Full Vitest suite | 81 files passed; 727 tests passed |
| Lint | Passed; no leaked secrets, focused tests, or debugger statements |
| Type checking | `tsc -b` and Netlify Functions config passed |
| Production build | Passed; 1,790 modules transformed and 19 route HTML files plus sitemap prerendered |
| Diff hygiene | `git diff --check` passed |
| Browser runtime | No error-level console entries during the audited flows |
| Demo package validation | 100% score, zero blockers, zero warnings after namespaced-ID repair |
| Responsive evidence | Wide desktop, desktop, tablet, and 390px mobile captures saved under `artifacts/product-super-loop` |
