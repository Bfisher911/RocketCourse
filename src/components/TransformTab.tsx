import { useState } from "react";
import { ArrowRight, Palette, ShieldCheck, Sparkles, Wand2 } from "lucide-react";
import type { CourseProject } from "../types";
import { themes as builtInThemes } from "../data/themes";
import { makeCourseExportReady, polishCourse, restyleCourse, type TransformResult } from "../services/courseTransforms";

type UpdateCourse = (updater: (current: CourseProject) => CourseProject) => void;

// One-click, course-wide transformations. Each runs deterministically on the current course, applies
// the result, and shows a plain-language summary of what changed.
export function TransformTab({ course, onUpdateCourse }: { course: CourseProject; onUpdateCourse: UpdateCourse }) {
  const [restyleThemeId, setRestyleThemeId] = useState(course.theme.id);
  const [summaries, setSummaries] = useState<Record<string, string[]>>({});

  const apply = (key: string, result: TransformResult): void => {
    setSummaries((current) => ({ ...current, [key]: result.summary }));
    onUpdateCourse(() => result.course);
  };

  const restyleTheme = builtInThemes.find((theme) => theme.id === restyleThemeId) ?? course.theme;

  return (
    <div className="transform-system">
      <header className="transform-intro">
        <span className="hp-eyebrow"><Wand2 size={14} /> Course transformations</span>
        <h2>Transform the whole course in one click</h2>
        <p>Deterministic, course-wide actions — no AI credits. Each shows exactly what it changed, and your hand-edits are preserved.</p>
      </header>

      <section className="transform-card">
        <span className="hp-eyebrow"><Palette size={14} /> Restyle</span>
        <h3>Apply a fresh look across the course</h3>
        <p>Recolor every generated page, the homepage, syllabus, and banner with a new theme.</p>
        <div className="transform-actions">
          <select aria-label="Restyle theme" value={restyleThemeId} onChange={(event) => setRestyleThemeId(event.target.value)}>
            {builtInThemes.map((theme) => (
              <option key={theme.id} value={theme.id}>{theme.name}</option>
            ))}
          </select>
          <button type="button" className="primary" onClick={() => apply("restyle", restyleCourse(course, restyleTheme))}>
            Apply to whole course <ArrowRight size={15} />
          </button>
        </div>
        {summaries.restyle && <TransformSummary items={summaries.restyle} />}
      </section>

      <section className="transform-card">
        <span className="hp-eyebrow"><Sparkles size={14} /> Polish pass</span>
        <h3>Add clarity &amp; accessibility guidance</h3>
        <p>Adds accessibility guidance to pages, a clarity pass to assignments, and example prompts to discussions. Idempotent — safe to re-run.</p>
        <button type="button" className="secondary" onClick={() => apply("polish", polishCourse(course))}>
          Run polish pass
        </button>
        {summaries.polish && <TransformSummary items={summaries.polish} />}
      </section>

      <section className="transform-card">
        <span className="hp-eyebrow"><ShieldCheck size={14} /> Make export-ready</span>
        <h3>Fix what is safely fixable</h3>
        <p>Aligns orphaned outcomes, rebalances gradebook weights to 100%, and reports any blockers that still need a human.</p>
        <button type="button" className="secondary" onClick={() => apply("exportReady", makeCourseExportReady(course))}>
          Make export-ready
        </button>
        {summaries.exportReady && <TransformSummary items={summaries.exportReady} />}
      </section>
    </div>
  );
}

function TransformSummary({ items }: { items: string[] }) {
  return (
    <ul className="transform-summary">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}
