// Readiness panel — extracted from App.tsx. Renders the derived readiness
// report; the report itself is still computed in App and passed in.

import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, Info, ShieldCheck } from "lucide-react";
import { ReadinessRing } from "../../components/ReadinessRing";
import { buildCourseQualityReport } from "../../services/courseQuality";
import { buildReadinessReport } from "../../services/readiness";
import type { CourseProject, ExportValidationReport, ReadinessCheck } from "../../types";

import type { EditorTab } from "../../types";
import { readinessTab } from "./shared";

export function ReadinessPanel({
  course,
  readiness,
  quality,
  validationReport,
  subscriptionActive,
  onUpdateCourse,
  onJumpToTab
}: {
  course: CourseProject;
  readiness: ReturnType<typeof buildReadinessReport>;
  quality: ReturnType<typeof buildCourseQualityReport>;
  validationReport: ExportValidationReport | null;
  subscriptionActive: boolean;
  onUpdateCourse: (updater: (current: CourseProject) => CourseProject) => void;
  onJumpToTab: (tab: EditorTab) => void;
}) {
  const [fixSummary, setFixSummary] = useState<string[]>([]);
  // Surface what needs attention first (failed required, then recommended), then the passed checks.
  const ordered = [...readiness.checks].sort((a, b) => {
    const weight = (item: ReadinessCheck): number => (item.passed ? 2 : item.severity === "required" ? 0 : 1);
    return weight(a) - weight(b);
  });
  // Speak in outcomes, not scores: say whether the course is ready and what's left,
  // instead of leaving the user to interpret a percentage.
  const reviewCount = readiness.checks.filter((item) => !item.passed && item.severity !== "required").length;
  const statusSentence =
    readiness.blockers > 0
      ? `Not ready yet — ${readiness.blockers} blocking issue${readiness.blockers === 1 ? "" : "s"} to fix first.`
      : reviewCount > 0
        ? `Ready to export — ${reviewCount} small thing${reviewCount === 1 ? "" : "s"} worth reviewing.`
        : "Ready to export — everything checks out.";
  return (
    <div className="readiness-card">
      <ReadinessRing score={readiness.score} size={96} className="readiness-ring" ariaLabel={`Course readiness ${readiness.score} percent`} />
      <h2>Course Readiness</h2>
      <p>{statusSentence}</p>
      <div className="export-status">
        <strong>Content quality</strong>
        <span>{quality.score}% instructional</span>
      </div>
      {readiness.checks.some((item) => !item.passed) && (
        <div className="readiness-safe-fix">
          <button
            type="button"
            className="secondary"
            onClick={async () => {
              const { makeCourseExportReady } = await import("../../services/courseTransforms");
              const result = makeCourseExportReady(course);
              onUpdateCourse(() => result.course);
              setFixSummary(result.summary);
            }}
          >
            <ShieldCheck size={15} /> Fix all safe issues
          </button>
          <p>Repairs references, slugs, alignments, and gradebook weights. It never rewrites your teaching content, and you can Undo afterward.</p>
          {fixSummary.length > 0 && (
            <ul className="transform-summary" role="status" aria-label="Safe-fix results">
              {fixSummary.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
            </ul>
          )}
        </div>
      )}
      <ul className="readiness-list">
        {ordered.map((item) => {
          const target = readinessTab(item.id);
          const Icon = item.passed ? CheckCircle2 : item.severity === "required" ? AlertTriangle : Info;
          return (
            <li key={item.id} className={item.passed ? "passed" : item.severity}>
              <button type="button" onClick={() => onJumpToTab(target)} title={`${item.detail} — go to ${target}`}>
                <Icon size={15} /> <span>{item.label}</span> <ChevronRight size={14} className="readiness-go" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="export-status">
        <strong>Export</strong>
        <span>{subscriptionActive ? "Enabled" : "Subscription required"}</span>
      </div>
      <div className="export-status">
        <strong>Canvas package check</strong>
        <span>{validationReport ? `${validationReport.score}% passed` : "Not run yet"}</span>
      </div>
    </div>
  );
}
