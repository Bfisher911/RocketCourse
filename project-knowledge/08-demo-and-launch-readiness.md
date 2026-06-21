# Demo And Launch Readiness

## Demo Environment

There is no separate hosted demo environment in this repo.

There is a local demo experience:

- `sampleProject` loads on startup.
- `defaultSettings` provide a polished AI and Modern Society sample.
- Generation is deterministic and does not require external services.
- Export can be demonstrated locally when simulated subscription is active.

Evidence:

- `src/services/courseGenerator.ts`
- `src/data/defaultSettings.ts`
- `src/App.tsx`
- `README.md`

## Demo Data

Demo data exists as generated local objects:

- Sample prompt.
- Default course settings.
- Theme definitions.
- Generated sample course.

No database demo users or seed data exist.

## Demo Users

No demo users exist.

The app has no login. The current browser user can toggle subscription state.

## Can Public Users Try Product Safely?

Prototype-only yes, production no.

Current safety positives:

- No real AI calls.
- No billing calls.
- No database writes.
- No private backend data.

Current production concerns:

- No auth.
- No rate limits.
- No persistence.
- No server-side export/billing enforcement.
- User-editable HTML preview.
- Canvas import unverified.

## Does Demo Behavior Use Real AI Calls?

No.

The generator and revise buttons are deterministic local code.

## Broken Or Misleading Demo Flows

- Upload step suggests source files matter, but files are not parsed or used.
- Progress step says it is reading uploads and creating AI-like artifacts, but it is just a timer and deterministic generator.
- AI revise toolbar is not AI.
- Subscription can be toggled by the user.
- Canvas sandbox import status is always `not_tested`.
- Exported quizzes likely need more QTI detail before Canvas imports produce usable quiz questions.

## Marketing To Demo Flow

The landing page points to:

- Build a course -> Intake.
- View dashboard -> Dashboard.

This is coherent for local demo. It does not expose a separate demo route or guard users from prototype assumptions.

## Onboarding Clarity

The onboarding is understandable for a first-time prototype user:

- Prompt field.
- Course title/description.
- Guided settings.
- Generate button.
- Progress screen.
- Editor tabs.

Areas needing polish:

- Explain or hide metadata-only uploads.
- Clarify that AI actions are simulated.
- Clarify Canvas verification status.
- Reduce duplicate editor navigation if users find side rail plus tabs confusing.
- Add empty/error states for failed generation/export.

## Launch Readiness Checklist

### Ready Now

- Local React/Vite app builds successfully.
- Vitest export/readiness tests pass.
- Deterministic generation is good enough for controlled demos.
- Course object model is broad and useful.
- Editor covers many Canvas-relevant objects.
- Browser-side package generation works locally.
- Readiness panel gives useful prototype feedback.
- README warns against claiming Canvas compatibility before sandbox testing.

### Needs Polish

- Add lint and standalone typecheck scripts.
- Persist projects locally at minimum, then in a backend.
- Add clear demo/prototype labels or tighten claims.
- Improve HTML safety validation.
- Improve quiz/rubric editing depth.
- Update theme changes to regenerate or update course HTML consistently.
- Add real file parsing or remove upload affordance from demo.
- Add better error handling around export.
- Add accessibility QA across mobile/desktop.
- Add a Canvas sandbox import checklist/report.

### Blocking Issues Before Launch

- No authentication or account model.
- No database/persistence.
- No real billing enforcement.
- No Supabase/Stripe/OpenAI implementation despite product positioning.
- Canvas sandbox import not verified.
- Quiz QTI export appears incomplete for real Canvas quiz behavior.
- Uploads are not parsed or stored.
- Client-only subscription gate is not secure.
- No privacy, terms, data retention, or security model.
- No production deployment configuration or monitoring.

## Demo/Beta/Production Readiness

Current status:

- Demo: Ready for a local, guided prototype demo with caveats.
- Beta: Not ready.
- Production: Not ready.

The biggest reason: the product works as a local builder/export prototype, but not as a secure, persistent, verified SaaS.

