// Blueprint approval screen — extracted from App.tsx.

import { AlertTriangle, CheckCircle2, ClipboardCheck, Loader2, RotateCcw, Sparkles } from "lucide-react";
import type { CourseBlueprint } from "../ai/blueprint";

export function BlueprintReview({
  blueprint,
  busy,
  error,
  onApprove,
  onRegenerate,
  onBack
}: {
  blueprint: CourseBlueprint;
  busy: boolean;
  error: string | null;
  onApprove: () => void;
  onRegenerate: () => void;
  onBack: () => void;
}) {
  return (
    <main id="main-content" tabIndex={-1} className="blueprint page-shell">
      <section className="page-heading">
        <div>
          <span className="section-eyebrow">
            <Sparkles size={14} /> AI Blueprint — Step 2 of 3
          </span>
          <h1>{blueprint.title}</h1>
          <p>
            Review the AI's instructional plan below. Approving builds the full Canvas course (step 3) — you can still edit
            everything afterwards.
          </p>
        </div>
        <div className="blueprint-actions">
          <button className="secondary" onClick={onBack}>
            Back
          </button>
          <button className="secondary" onClick={onRegenerate} disabled={busy}>
            {busy ? <Loader2 size={16} className="spin" /> : <RotateCcw size={16} />} Regenerate
          </button>
          <button className="primary" onClick={onApprove} disabled={busy}>
            <CheckCircle2 size={18} /> Approve &amp; Build Course
          </button>
        </div>
      </section>

      {error && (
        <p className="intake-ai-error">
          <AlertTriangle size={15} /> {error}
        </p>
      )}

      <section className="blueprint-meta">
        <span><strong>Audience</strong>{blueprint.audience || "—"}</span>
        <span><strong>Level</strong>{blueprint.level || "—"}</span>
        <span><strong>Modality</strong>{blueprint.modality || "—"}</span>
        <span><strong>Credit hours</strong>{blueprint.creditHours}</span>
        <span><strong>Length</strong>{blueprint.lengthWeeks} weeks</span>
        <span><strong>Modules</strong>{blueprint.modules.length}</span>
      </section>

      <p className="blueprint-description">{blueprint.description}</p>
      {blueprint.teachingApproach && (
        <p className="blueprint-approach"><strong>Teaching approach:</strong> {blueprint.teachingApproach}</p>
      )}

      <div className="blueprint-grid">
        <section className="blueprint-card">
          <h2>Learning outcomes</h2>
          <ul className="blueprint-outcomes">
            {blueprint.outcomes.length === 0 && <li>No outcomes returned.</li>}
            {blueprint.outcomes.map((outcome) => (
              <li key={outcome.code}>
                <span className="outcome-code">{outcome.code}</span> {outcome.text}
              </li>
            ))}
          </ul>
        </section>

        <section className="blueprint-card">
          <h2>Assessment plan</h2>
          <ul className="blueprint-assessments">
            {blueprint.majorAssessments.map((item, index) => (
              <li key={index}>
                <ClipboardCheck size={14} /> {item}
              </li>
            ))}
          </ul>
          {blueprint.finalProject && (
            <p className="blueprint-final">
              <strong>Final project:</strong> {blueprint.finalProject}
            </p>
          )}
        </section>
      </div>

      <section className="blueprint-modules">
        <h2>Module map</h2>
        <div className="blueprint-module-list">
          {blueprint.modules.map((module, index) => (
            <article key={index} className="blueprint-module">
              <span className="blueprint-module-index">{index + 1}</span>
              <div>
                <strong>{module.title}</strong>
                <p>{module.summary}</p>
                {module.objectives.length > 0 && (
                  <ul>
                    {module.objectives.map((objective, objectiveIndex) => (
                      <li key={objectiveIndex}>{objective}</li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      {blueprint.validationWarnings.length > 0 && (
        <section className="blueprint-warnings">
          <h2><AlertTriangle size={16} /> Things to verify</h2>
          <ul>
            {blueprint.validationWarnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

// Shown once, right after generation finishes: celebrate what was built and hand the
// user a single obvious next action ("Start reviewing") instead of a cold workspace.
