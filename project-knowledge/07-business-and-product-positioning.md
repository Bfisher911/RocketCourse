# Business And Product Positioning

## Current Target Market

Based on `docs/COURSEFORGE_MVP_PLAN.md`, the target market is instructors, instructional designers, and school/department staff who build Canvas LMS courses.

Inference: The product is best positioned as a Canvas-first course build accelerator rather than a general LMS. Its strongest value is producing structured course shells and export packages that fit an instructor/designer workflow.

## Current Customer Type

Likely customer types:

- Individual instructors paying personally or with professional development funds.
- Freelance instructional designers.
- Small departments needing repeated course shell production.
- Schools or programs that need templates but do not yet need a full enterprise integration.

Inference: The current `$20/mo` UI language points toward an individual plan first, not enterprise procurement.

## Main Pain Points Addressed

The app appears designed to solve:

- Starting from a blank Canvas shell.
- Turning rough course ideas into structured modules.
- Drafting student-facing Canvas pages.
- Creating aligned assignments, discussions, quizzes, and rubrics.
- Estimating workload/contact hours.
- Preparing an importable course package instead of manually building every Canvas object.

Evidence:

- Landing copy in `src/App.tsx` promises generating a full Canvas course in minutes.
- The MVP plan centers on prompt-to-course-shell and `.imscc` export.
- The generator creates native Canvas-like objects rather than one flat document.

## Current Marketing Claims

Implemented/public-facing claims include:

- "Generate a full Canvas course in minutes."
- "Canvas Builder."
- "Canvas-ready export path."
- "Canvas-native structure."
- "Editable before export."
- "IMSCC package check."
- HTML metadata says the app "generates editable Canvas course shells and exports Canvas-ready IMSCC packages."

Evidence:

- `src/App.tsx`, `Landing`.
- `index.html`.
- `README.md`.

Concern:

- "Canvas-ready" should be softened until a generated package imports successfully into a real Canvas sandbox. The README and fixture README already warn about this, but the landing UI is more confident than the verification status.

## Pricing References

Implemented pricing reference:

- `$20/mo` shown in the Dashboard when `subscriptionActive` is true.

Evidence:

- `src/App.tsx`, `Dashboard`.

Future billing references:

- `docs/COURSEFORGE_MVP_PLAN.md` mentions Stripe checkout, webhooks, subscriptions, and paid export.

Current reality:

- No Stripe integration.
- No checkout.
- No plan table.
- No trial logic.
- No invoices.
- No usage limits.

## Trial, Free, Demo, Or Plan References

Implemented:

- "Preview" appears when simulated subscription is inactive.
- Export disabled when inactive.
- The app starts with sample/demo data.

Not implemented:

- Free plan.
- Trial period.
- Demo account.
- Public demo mode.
- Plan limits.
- Upgrade flow.

## Inconsistent Messaging

- UI implies AI and Canvas readiness; code is deterministic and Canvas import is not verified.
- Dashboard implies subscription/account state; code uses local boolean state.
- Intake says file attachments are read during progress, but the implementation only stores metadata.
- MVP plan mentions approve/regenerate blueprint, but current flow jumps from timed progress to full editor; there is no real approval checkpoint.
- MVP plan mentions XML parsing in validation, but current validation is mostly presence/reference checks and regex scanning.

## Monetizable Features

Features that appear monetizable:

- `.imscc` export/download.
- Course generation volume.
- Advanced editor controls.
- Institution-specific templates.
- Canvas import validation reports.
- Live AI regeneration.
- Source file parsing.
- Rubric/assessment generation.
- Contact-hour/accreditation support.
- Collaboration/workspaces.
- Template/theme library.

## Possible Higher-Tier Features

Inference:

- Team/department workspaces.
- Shared institution templates.
- Canvas API direct publish.
- Bulk course generation.
- Advanced QA/accessibility checking.
- Real sandbox import verification.
- Version history and approvals.
- Export history and compliance reports.
- White-label branding.
- LTI integration.

## Product Language To Clarify Before Launch

- Whether the product is "AI-powered" now or "AI-ready/prototype."
- Whether exported packages are Canvas-verified or only Canvas-oriented.
- Whether $20/mo is real target pricing or placeholder.
- Whether the first paid product is for individuals or institutions.
- Whether CourseForge remains the brand name.
- Whether "Canvas-ready" should become "Canvas-oriented export package; sandbox import verification pending" until validated.
- Whether file uploads are included in MVP or should be hidden until parsing works.

