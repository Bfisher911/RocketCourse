// Generation progress screen — extracted from App.tsx.

import { CheckCircle2, ChevronRight, Loader2 } from "lucide-react";
import { RocketCourseLoader } from "../components/brand";

import { progressSteps } from "./appModel";

export function Progress({ progressIndex, moduleTitles = [] }: { progressIndex: number; moduleTitles?: string[] }) {
  const percent = Math.min(100, Math.round(((progressIndex + 1) / progressSteps.length) * 100));
  // Reveal the actual module titles being built as progress advances — real evidence
  // of the draft taking shape rather than a generic spinner.
  const visibleModules = Math.min(moduleTitles.length, Math.ceil((percent / 100) * moduleTitles.length));
  return (
    <main id="main-content" tabIndex={-1} className="progress page-shell">
      <section className="progress-card">
        <RocketCourseLoader size="lg" className="progress-loader" />
        <h1>Building your Canvas course</h1>
        <p aria-live="polite">{progressSteps[Math.min(progressIndex, progressSteps.length - 1)]}</p>
        <div className="progress-track" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${percent}%` }} />
        </div>
        <span className="progress-percent">{percent}% complete</span>
        <ol>
          {progressSteps.map((step, index) => (
            <li key={step} className={index < progressIndex ? "done" : index === progressIndex ? "current" : ""}>
              {index < progressIndex ? <CheckCircle2 size={16} /> : index === progressIndex ? <Loader2 size={16} className="spin" /> : <ChevronRight size={16} />}
              {step}
            </li>
          ))}
        </ol>
        {moduleTitles.length > 0 && (
          <div className="progress-modules" aria-label="Modules being created">
            <span className="progress-modules-label">Your modules</span>
            <ul>
              {moduleTitles.slice(0, visibleModules).map((title) => (
                <li key={title}>
                  <CheckCircle2 size={13} /> {title}
                </li>
              ))}
            </ul>
            {visibleModules < moduleTitles.length && (
              <small>
                +{moduleTitles.length - visibleModules} more on the way…
              </small>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
