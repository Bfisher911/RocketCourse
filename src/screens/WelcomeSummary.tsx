// Post-generation welcome summary — extracted from App.tsx.

import { ArrowRight, Rocket, Sparkles } from "lucide-react";
import { useModalFocus } from "../hooks/useModalFocus";
import type { CourseProject } from "../types";

export function WelcomeSummary({
  course,
  onStartReviewing,
  onDismiss
}: {
  course: CourseProject;
  onStartReviewing: () => void;
  onDismiss: () => void;
}) {
  const dialogRef = useModalFocus<HTMLDivElement>(true, onDismiss);

  const teachingModuleCount = course.modules.filter((module) => module.kind === "content").length;
  const supportModuleCount = course.modules.length - teachingModuleCount;
  const stats: Array<[number, string]> = [
    [course.modules.length, "total modules"],
    [course.pages.length, "pages"],
    [course.assignments.length, "assignments"],
    [course.discussions.length, "discussions"],
    [course.quizzes.length, "quizzes"],
    [course.rubrics.length, "rubrics"]
  ];

  return (
    <div ref={dialogRef} tabIndex={-1} className="welcome-overlay" role="dialog" aria-modal="true" aria-labelledby="welcome-title" onClick={onDismiss}>
      <div className="welcome-card" onClick={(event) => event.stopPropagation()}>
        <span className="hp-eyebrow">
          <Sparkles size={14} /> Draft complete
        </span>
        <h2 id="welcome-title">{course.title} is ready to review</h2>
        <div className="welcome-stats">
          {stats.filter(([count]) => count > 0).map(([count, label]) => (
            <div key={label}>
              <strong>{count}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
        {supportModuleCount > 0 && (
          <p className="welcome-module-note">{teachingModuleCount} teaching modules plus {supportModuleCount} support modules for orientation, final work, or instructor resources.</p>
        )}
        <p>
          This is a complete first draft — not a finished course. The guided review walks you through it step by
          step so you can polish it, then export to Canvas.
        </p>
        <p className="welcome-module-note">
          Prefer a different way of working? The Experience menu in the top bar offers other workspaces for the
          same course — switching never changes your content.
        </p>
        <div className="welcome-actions">
          <button className="primary" onClick={onStartReviewing}>
            <Rocket size={16} /> Start guided review <ArrowRight size={16} />
          </button>
          <button className="ghost-button" onClick={onDismiss}>
            Explore on my own
          </button>
        </div>
      </div>
    </div>
  );
}
