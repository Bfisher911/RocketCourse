// Interactive "one prompt → Canvas course" walkthrough for the public splash. A self-advancing,
// fully clickable 7-step journey that shows RocketCourse is simple on the surface with deep controls
// underneath. Pure HTML/CSS/React (no Remotion) so it ships in the existing stack and stays light;
// see docs/ for how to swap in a Remotion-rendered video later. Respects prefers-reduced-motion.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileDown,
  GraduationCap,
  LayoutGrid,
  PanelLeft,
  PlayCircle,
  Settings2,
  Sparkles,
  UploadCloud,
  Wand2
} from "lucide-react";

interface Step {
  title: string;
  blurb: string;
  points: string[];
  icon: typeof Wand2;
}

const STEPS: Step[] = [
  {
    title: "Describe your course",
    blurb: "Start from a topic, a syllabus, or an existing Canvas export — one prompt is enough.",
    points: ["Topic, syllabus, or .imscc", "Your own learning outcomes", "No blank-shell busywork"],
    icon: Wand2
  },
  {
    title: "Choose depth & structure",
    blurb: "Dial in module count, rigor, assessment mix, and contact hours — or accept smart defaults.",
    points: ["Modules & week count", "Assessment balance", "Carnegie contact hours"],
    icon: Settings2
  },
  {
    title: "Generate a full draft",
    blurb: "RocketCourse builds the entire Canvas shell in one pass — not just an outline.",
    points: ["Homepage & syllabus", "Pages, assignments, discussions", "Quizzes, rubrics, gradebook"],
    icon: Sparkles
  },
  {
    title: "Review & refine everything",
    blurb: "Every object is editable. Tune a page, reorder a module, or rewrite a rubric — deep control when you want it.",
    points: ["Inline edit any object", "Readiness scoring", "Accessibility & workload checks"],
    icon: LayoutGrid
  },
  {
    title: "Export the .imscc package",
    blurb: "Download a validated Common Cartridge with QTI quizzes — checked before it ever leaves the browser.",
    points: ["Manifest & references validated", "QTI quiz package", "Printable PDFs & syllabus"],
    icon: FileDown
  },
  {
    title: "Import into Canvas",
    blurb: "Settings → Import Course Content → Canvas Course Export Package. Guided every step of the way.",
    points: ["Step-by-step import guide", "Sandbox-first checklist", "Common-warning troubleshooting"],
    icon: UploadCloud
  },
  {
    title: "Teach from a polished shell",
    blurb: "A complete, consistent, accessible course — ready to review, publish, and teach.",
    points: ["Consistent structure", "Editable in Canvas", "Ship to students"],
    icon: GraduationCap
  }
];

const AUTO_MS = 4200;

function StepScreen({ index }: { index: number }) {
  // Lightweight stylized "screen" mock for the active step.
  switch (index) {
    case 0:
      return (
        <div className="walk-screen walk-prompt">
          <span className="walk-chip"><Wand2 size={13} /> New course</span>
          <div className="walk-promptbox">Intro to Environmental Science for first-year non-majors, 14 weeks, project-based…</div>
          <div className="walk-prompt-actions"><span className="walk-fakebtn primary">Generate course</span></div>
        </div>
      );
    case 1:
      return (
        <div className="walk-screen walk-controls">
          {[["Modules", "14"], ["Rigor", "Moderate"], ["Assessments", "Mixed"], ["Contact hrs", "Carnegie"]].map(([k, v]) => (
            <div className="walk-control" key={k}><span>{k}</span><strong>{v}</strong></div>
          ))}
        </div>
      );
    case 2:
      return (
        <div className="walk-screen walk-generate">
          {["Homepage", "Syllabus", "Modules", "Assignments", "Quizzes", "Rubrics"].map((label, i) => (
            <div className="walk-genrow" key={label} style={{ animationDelay: `${i * 90}ms` }}>
              <CheckCircle2 size={14} /> <span>{label}</span><i style={{ width: `${60 + ((i * 7) % 38)}%` }} />
            </div>
          ))}
        </div>
      );
    case 3:
      return (
        <div className="walk-screen walk-review">
          <div className="walk-tabs">
            {["Overview", "Syllabus", "Modules", "Assignments", "Quizzes", "Rubrics", "Gradebook"].map((t, i) => (
              <span className={i === 2 ? "active" : ""} key={t}>{t}</span>
            ))}
          </div>
          <div className="walk-readiness"><span>Readiness</span><strong>94%</strong></div>
        </div>
      );
    case 4:
      return (
        <div className="walk-screen walk-export">
          <div className="walk-export-file"><FileDown size={16} /> environmental-science.imscc</div>
          <div className="walk-export-checks">
            {["Manifest", "References", "HTML safety", "QTI"].map((c) => (
              <span key={c}><CheckCircle2 size={12} /> {c}</span>
            ))}
          </div>
        </div>
      );
    case 5:
      return (
        <div className="walk-screen walk-canvas">
          <ol>
            <li>Open a Canvas sandbox course</li>
            <li>Settings → Import Course Content</li>
            <li>Canvas Course Export Package</li>
            <li>Upload .imscc → Import</li>
          </ol>
        </div>
      );
    default:
      return (
        <div className="walk-screen walk-done">
          <GraduationCap size={30} />
          <strong>Course ready</strong>
          <span>Modules, assessments, rubrics & gradebook — consistent and editable in Canvas.</span>
        </div>
      );
  }
}

export function ProductWalkthrough({
  onTryDemo,
  onGuides,
  onStart
}: {
  onTryDemo: () => void;
  onGuides: () => void;
  onStart: () => void;
}) {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  const timer = useRef<number | null>(null);

  const reducedMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    []
  );

  useEffect(() => {
    if (!playing || reducedMotion) return;
    timer.current = window.setTimeout(() => setActive((a) => (a + 1) % STEPS.length), AUTO_MS);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [active, playing, reducedMotion]);

  const select = (i: number) => {
    setPlaying(false);
    setActive(i);
  };

  return (
    <section className="landing-section product-walkthrough" aria-labelledby="walk-heading">
      <span className="hp-eyebrow"><PlayCircle size={14} /> Interactive walkthrough</span>
      <h2 id="walk-heading">One prompt to a Canvas course shell</h2>
      <p>
        RocketCourse is simple on the surface and powerful underneath: go from a single prompt to a full, editable Canvas
        course — with deep controls the moment you want them.
      </p>

      <div className="walk-grid">
        <ol className="walk-steps" aria-label="Walkthrough steps">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <li key={step.title}>
                <button
                  type="button"
                  className={`walk-step ${i === active ? "active" : ""} ${i < active ? "done" : ""}`}
                  aria-current={i === active}
                  onClick={() => select(i)}
                >
                  <span className="walk-step-num"><Icon size={15} /></span>
                  <span className="walk-step-text">
                    <strong>{step.title}</strong>
                    <em>{step.blurb}</em>
                  </span>
                  {i === active && playing && !reducedMotion && <span className="walk-progress" key={active} />}
                </button>
              </li>
            );
          })}
        </ol>

        <div className="walk-stage" aria-live="polite">
          <div className="walk-stage-head">
            <span className="walk-stage-step">Step {active + 1} of {STEPS.length}</span>
            <h3>{STEPS[active].title}</h3>
          </div>
          <StepScreen index={active} />
          <ul className="walk-points">
            {STEPS[active].points.map((p) => (
              <li key={p}><CheckCircle2 size={14} /> {p}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="walk-cta">
        <button className="primary" onClick={onStart}>
          <Sparkles size={17} /> Build your first course <ArrowRight size={15} />
        </button>
        <button className="secondary" onClick={onTryDemo}>
          <PanelLeft size={16} /> Watch it in the demo
        </button>
        <button className="secondary" onClick={onGuides}>
          <BookOpen size={16} /> Canvas import help
        </button>
      </div>
    </section>
  );
}
