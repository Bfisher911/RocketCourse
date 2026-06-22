import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Compass, X } from "lucide-react";
import type { EditorTab } from "../types";

// Optional guided walkthrough for the public demo. Rather than fragile pixel-spotlighting, each step
// drives the editor's active tab and explains what the visitor is looking at — reliable, accessible,
// and resilient to layout changes. The panel is non-blocking: users can still click around between
// steps.

interface TourStep {
  tab?: EditorTab;
  title: string;
  body: string;
}

const STEPS: TourStep[] = [
  {
    tab: "Overview",
    title: "Welcome to the RocketCourse demo",
    body: "This is the editor for a pre-populated AI and Modern Society course. The Overview tab is your command center — course summary, readiness, and quick links into every section. No AI credits are used here."
  },
  {
    tab: "Overview",
    title: "Readiness & quality, always visible",
    body: "The right-hand panel scores readiness and instructional quality as you work, so you always know what to check before exporting. It updates live as you edit."
  },
  {
    tab: "Homepage",
    title: "Homepage",
    body: "A structured, Canvas-safe homepage with a Start Here call to action. Edit the welcome, highlights, and navigation help — the underlying Canvas HTML stays in sync."
  },
  {
    tab: "Syllabus",
    title: "Syllabus",
    body: "A full syllabus with outcomes, policies, grading, and schedule. It maps to the Canvas syllabus page and can also be exported as a PDF."
  },
  {
    tab: "Modules",
    title: "Modules",
    body: "Start Here, sequenced content modules, a final project module, and an unpublished instructor-only module. Drag to reorder modules and items; add, duplicate, or remove them."
  },
  {
    tab: "Pages",
    title: "Pages",
    body: "Module overviews and lesson pages with real instructional content — examples, key terms, misconception callouts, and checks for understanding."
  },
  {
    tab: "Assignments",
    title: "Assignments",
    body: "Each assignment has a specific prompt, deliverables, format expectations, an estimated workload, and grading notes — all editable before export."
  },
  {
    tab: "Discussions",
    title: "Discussions",
    body: "Discussion prompts with clear expectations, reply requirements, and facilitation notes for the instructor."
  },
  {
    tab: "Quizzes",
    title: "Quizzes",
    body: "Editable quizzes with question stems, choices, correct answers, distractors, feedback, points, and difficulty labels. Export each as Canvas QTI, or as printable student and answer-key PDFs."
  },
  {
    tab: "Rubrics",
    title: "Rubrics",
    body: "Editable rubrics with criteria, performance levels, points, and descriptions — ready to attach to assignments and the final project."
  },
  {
    tab: "Gradebook Setup",
    title: "Gradebook Setup",
    body: "Assignment groups and weights that total 100%. Rebalance weights and see exactly how the gradebook will import into Canvas."
  },
  {
    tab: "Contact Hours",
    title: "Contact Hours",
    body: "A workload command center using a Carnegie-style model, with a clear rationale for the estimated student hours behind the course."
  },
  {
    tab: "Theme",
    title: "Theme",
    body: "Apply a cohesive visual theme across generated content while preserving anything you've edited by hand."
  },
  {
    tab: "Export",
    title: "Export — your Canvas package",
    body: "Run local validation, then download the Canvas-oriented .imscc package, QTI quiz files, printable quiz PDFs and answer keys, the syllabus PDF, an export validation report, and an instructor review checklist."
  },
  {
    tab: "Export",
    title: "Importing into Canvas",
    body: "Open a blank Canvas course → Settings → Import Course Content → upload the .imscc → review modules, pages, assignments, quizzes, and files. See the Guides page for step-by-step import and QTI instructions. Use “Back to RocketCourse Home” any time to leave the demo."
  }
];

export function DemoTour({ onSetTab, onClose }: { onSetTab: (tab: EditorTab) => void; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const total = STEPS.length;
  const current = STEPS[step];
  const isLast = step === total - 1;

  // Drive the editor tab whenever the step changes.
  useEffect(() => {
    if (current.tab) onSetTab(current.tab);
  }, [step, current.tab, onSetTab]);

  const next = (): void => {
    if (isLast) onClose();
    else setStep((value) => Math.min(total - 1, value + 1));
  };
  const back = (): void => setStep((value) => Math.max(0, value - 1));

  // Keyboard support: Escape closes, arrows/Enter navigate.
  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowRight" || event.key === "Enter") next();
      else if (event.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  return (
    <div className="demo-tour" role="region" aria-label="Guided demo tour">
      <div className="demo-tour-card">
        <div className="demo-tour-head">
          <span className="demo-tour-step">
            <Compass size={14} /> Step {step + 1} of {total}
          </span>
          <button className="demo-tour-close" onClick={onClose} aria-label="Skip the tour">
            <X size={16} /> Skip tour
          </button>
        </div>
        <div className="demo-tour-progress" aria-hidden="true">
          <i style={{ width: `${((step + 1) / total) * 100}%` }} />
        </div>
        <h3 aria-live="polite">{current.title}</h3>
        <p aria-live="polite">{current.body}</p>
        <div className="demo-tour-actions">
          <button className="ghost-button" onClick={back} disabled={step === 0}>
            <ArrowLeft size={15} /> Back
          </button>
          <button className="primary" onClick={next}>
            {isLast ? (
              <>
                <Check size={15} /> Finish
              </>
            ) : (
              <>
                Next <ArrowRight size={15} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
