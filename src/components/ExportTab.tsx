import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Download,
  FileArchive,
  FileJson,
  FileText,
  Info,
  ListChecks,
  Loader2,
  MinusCircle,
  PackageCheck,
  Play,
  ShieldCheck
} from "lucide-react";
import { useState } from "react";
import { LogoMark } from "./brand";
import type { CourseProject, EditorTab, ExportMode, ExportValidationReport, ReadinessReport } from "../types";
import {
  buildImportChecklistText,
  buildValidationReportJson,
  exportChecklist,
  exportConfidence,
  groupValidationIssues,
  packageContents,
  type ChecklistStatus,
  type RichIssue
} from "../services/exportSummary";

const EXPORT_MODE_LABELS: Record<ExportMode, string> = {
  full: "Full course",
  selected: "Selected content",
  new: "New since export",
  changed: "Changed since export"
};

const triggerTextDownload = (text: string, fileName: string, mime: string): void => {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const formatDateTime = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

const statusTone = (status: ChecklistStatus): "ok" | "warn" | "danger" | "muted" => (status === "pass" ? "ok" : status === "warn" ? "warn" : status === "fail" ? "danger" : "muted");

const ChecklistIcon = ({ status }: { status: ChecklistStatus }) =>
  status === "pass" ? <CheckCircle2 size={15} /> : status === "na" ? <MinusCircle size={15} /> : status === "warn" ? <ShieldCheck size={15} /> : <AlertTriangle size={15} />;

export function ExportTab({
  course,
  readiness,
  validationReport,
  isExporting,
  exportMode,
  onExportModeChange,
  importNotes,
  subscriptionActive,
  exportError,
  lastDownloadName,
  onRunValidation,
  onDownload,
  onDownloadPdf,
  onDownloadSyllabusPdf,
  onDownloadAllQti,
  onDownloadAllQuizzesStudentPdf,
  onDownloadAllQuizzesAnswerKeyPdf,
  onJumpToTab
}: {
  course: CourseProject;
  readiness: ReadinessReport;
  validationReport: ExportValidationReport | null;
  isExporting: boolean;
  exportMode: ExportMode;
  onExportModeChange: (mode: ExportMode) => void;
  importNotes: string[];
  subscriptionActive: boolean;
  exportError: string | null;
  lastDownloadName: string | null;
  onRunValidation: () => void;
  onDownload: () => void;
  onDownloadPdf: () => void;
  onDownloadSyllabusPdf: () => void;
  onDownloadAllQti: () => void;
  onDownloadAllQuizzesStudentPdf: () => void;
  onDownloadAllQuizzesAnswerKeyPdf: () => void;
  onJumpToTab: (tab: EditorTab) => void;
}) {
  const confidence = exportConfidence(validationReport, readiness);
  const checklist = exportChecklist(course);
  const { blocking, warnings } = groupValidationIssues(validationReport);
  const contents = packageContents(course, validationReport);
  const lastExport = course.exportHistory[0];
  const [copyState, setCopyState] = useState("Copy import checklist");
  const [showFiles, setShowFiles] = useState(false);

  const heroTone = confidence.localValidation === "Passed" ? "ready" : confidence.localValidation === "Blocked" ? "blocked" : "review";
  const checklistFails = checklist.filter((item) => item.status === "fail").length;

  const copyChecklist = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(buildImportChecklistText(course, validationReport));
      setCopyState("Copied");
    } catch {
      setCopyState("Clipboard blocked");
    }
    window.setTimeout(() => setCopyState("Copy import checklist"), 1600);
  };

  const downloadReport = (): void => {
    if (!validationReport) return;
    triggerTextDownload(buildValidationReportJson(course, validationReport, readiness), `${validationReport.packageName.replace(/\.imscc$/, "")}-validation.json`, "application/json");
  };

  const metrics: Array<{ label: string; value: string; tone?: "ok" | "warn" | "danger" | "muted" }> = [
    { label: "Package validation", value: confidence.packageScore !== null ? `${confidence.packageScore}%` : "—", tone: confidence.packageScore === null ? "muted" : confidence.packageScore >= 90 ? "ok" : confidence.localValidation === "Blocked" ? "danger" : "warn" },
    { label: "Course readiness", value: `${confidence.courseScore}%`, tone: confidence.courseScore >= 90 ? "ok" : "warn" },
    { label: "Local validation", value: confidence.localValidation, tone: confidence.localValidation === "Passed" ? "ok" : confidence.localValidation === "Blocked" ? "danger" : "muted" },
    { label: "Canvas sandbox", value: confidence.sandboxLabel, tone: confidence.sandboxLabel === "Verified" ? "ok" : "muted" },
    { label: "Blocking issues", value: confidence.blockers !== null ? String(confidence.blockers) : "—", tone: confidence.blockers ? "danger" : confidence.blockers === 0 ? "ok" : "muted" },
    { label: "Warnings", value: confidence.warnings !== null ? String(confidence.warnings) : "—", tone: confidence.warnings ? "warn" : confidence.warnings === 0 ? "ok" : "muted" }
  ];

  const renderIssue = (item: RichIssue) => (
    <div className={`export-issue ${item.severity === "error" ? "danger" : "warn"}`} key={item.id}>
      <div className="export-issue-head">
        <span className="export-issue-cat">{item.category}</span>
        <button type="button" className="small-button" onClick={() => onJumpToTab(item.tab)}>
          {item.tab} <ArrowRight size={12} />
        </button>
      </div>
      <strong>{item.message}</strong>
      <p>
        <span className="export-issue-label">Why:</span> {item.why}
      </p>
      <p>
        <span className="export-issue-label">Fix:</span> {item.fix}
      </p>
    </div>
  );

  return (
    <div className="overview export-center">
      <section className="overview-hero">
        <div>
          <span className="hp-eyebrow">
            <FileArchive size={14} /> Package export
          </span>
          <h2>Export</h2>
          <p>
            RocketCourse builds a <strong>Canvas-oriented .imscc package</strong> in your browser and validates it locally. Canvas sandbox import is <strong>not verified</strong> — always test in a sandbox course before relying on it.
          </p>
          <div className="rc-launch">
            <LogoMark size={34} decorative />
            <div className="rc-launch__text">
              <strong>Ready for launch</strong>
              <span>Validate locally, then export your Canvas-ready package.</span>
            </div>
          </div>
        </div>
        <div className={`overview-health ${heroTone}`}>
          {confidence.localValidation === "Passed" ? <CheckCircle2 size={20} /> : confidence.localValidation === "Blocked" ? <AlertTriangle size={20} /> : <Info size={20} />}
          <strong>{confidence.packageScore !== null ? `${confidence.packageScore}%` : "—"}</strong>
          <span>{confidence.localValidation}</span>
        </div>
      </section>

      <section className="overview-card" aria-label="Export confidence">
        <header className="overview-card-head">
          <span className="hp-eyebrow">
            <PackageCheck size={14} /> Package confidence
          </span>
          <span className="overview-pill muted">Canvas sandbox verification pending</span>
        </header>
        <div className="overview-metric-grid">
          {metrics.map((metric) => (
            <div className={`gradebook-metric ${metric.tone ?? ""}`} key={metric.label}>
              <strong>{metric.value}</strong>
              <span>{metric.label}</span>
            </div>
          ))}
        </div>
        <ul className="export-signals">
          <li>
            <span>Package contents</span>
            <strong>
              {contents.modules} modules · {contents.pages} pages · {contents.assignments} assignments · {contents.discussions} discussions · {contents.quizzes} quizzes · {contents.rubrics} rubrics{contents.files !== null ? ` · ${contents.files} files` : ""}
            </strong>
          </li>
          <li>
            <span>Last local export</span>
            <strong>{lastExport ? `${lastExport.fileName} · ${formatDateTime(lastExport.exportedAt)}` : "Not exported yet"}</strong>
          </li>
        </ul>
      </section>

      <section className="overview-card" aria-label="Export workflow">
        <header className="overview-card-head">
          <span className="hp-eyebrow">
            <FileArchive size={14} /> Build &amp; validate
          </span>
          <span className={`overview-pill ${subscriptionActive ? "ok" : "warn"}`}>{subscriptionActive ? "Export enabled (demo plan)" : "Export locked (demo)"}</span>
        </header>

        <div className="mode-grid" role="radiogroup" aria-label="Export mode">
          {(Object.keys(EXPORT_MODE_LABELS) as ExportMode[]).map((mode) => (
            <label key={mode} className={exportMode === mode ? "mode-choice active" : "mode-choice"}>
              <input type="radio" name="export-mode" value={mode} checked={exportMode === mode} onChange={() => onExportModeChange(mode)} />
              <span>{EXPORT_MODE_LABELS[mode]}</span>
            </label>
          ))}
        </div>
        {exportMode !== "full" && <p className="overview-empty">This mode validates dependencies for the selection, but the browser-only package still includes supporting metadata, outcomes, rubrics, files, and module references so Canvas has context.</p>}

        <div className="export-actions">
          <button type="button" className="secondary" onClick={onRunValidation} disabled={isExporting}>
            {isExporting ? <Loader2 size={16} className="spin" /> : <Play size={16} />} Run local validation
          </button>
          <button type="button" className="primary" onClick={onDownload} disabled={isExporting || !subscriptionActive || !confidence.downloadable} title={!confidence.downloadable ? "Run validation and resolve blocking issues first." : "Download the .imscc package"}>
            <Download size={16} /> Download .imscc
          </button>
          <button type="button" className="secondary" onClick={onDownloadPdf} disabled={!subscriptionActive} title={subscriptionActive ? "Download a readable PDF copy of the whole course" : "Activate a plan to export"}>
            <FileText size={16} /> Download course PDF
          </button>
          <button type="button" className="secondary" onClick={onDownloadSyllabusPdf} disabled={!subscriptionActive} title={subscriptionActive ? "Download a clean syllabus PDF (aligned with the Canvas syllabus page)" : "Activate a plan to export"}>
            <FileText size={16} /> Syllabus PDF
          </button>
          <button
            type="button"
            className="secondary"
            onClick={onDownloadAllQti}
            disabled={!subscriptionActive || course.quizzes.length === 0}
            title={course.quizzes.length === 0 ? "This course has no quizzes yet." : "Download all quizzes as one Canvas QTI .zip"}
          >
            <FileArchive size={16} /> Quizzes QTI ({course.quizzes.length})
          </button>
          <button
            type="button"
            className="secondary"
            onClick={onDownloadAllQuizzesStudentPdf}
            disabled={!subscriptionActive || course.quizzes.length === 0}
            title={course.quizzes.length === 0 ? "This course has no quizzes yet." : "Download printable student copies of every quiz (no answers)"}
          >
            <FileText size={16} /> Quiz PDFs ({course.quizzes.length})
          </button>
          <button
            type="button"
            className="secondary"
            onClick={onDownloadAllQuizzesAnswerKeyPdf}
            disabled={!subscriptionActive || course.quizzes.length === 0}
            title={course.quizzes.length === 0 ? "This course has no quizzes yet." : "Download the combined instructor answer key (all quizzes)"}
          >
            <ClipboardCheck size={16} /> Answer keys ({course.quizzes.length})
          </button>
          <button type="button" className="secondary" onClick={downloadReport} disabled={!validationReport}>
            <FileJson size={16} /> Download report
          </button>
          <button type="button" className="secondary" onClick={() => void copyChecklist()}>
            <Copy size={16} /> {copyState}
          </button>
        </div>

        {isExporting && (
          <p className="export-status-line info">
            <Loader2 size={15} className="spin" /> Building and validating the package…
          </p>
        )}
        {!isExporting && exportError && (
          <p className="export-status-line danger">
            <AlertTriangle size={15} /> {exportError}
          </p>
        )}
        {!isExporting && !exportError && lastDownloadName && (
          <p className="export-status-line ok">
            <CheckCircle2 size={15} /> Downloaded {lastDownloadName}. Import it into a Canvas sandbox to verify.
          </p>
        )}
        {!isExporting && !exportError && !lastDownloadName && validationReport && !confidence.downloadable && (
          <p className="export-status-line danger">
            <AlertTriangle size={15} /> Local validation found {confidence.blockers} blocking issue{confidence.blockers === 1 ? "" : "s"}. Resolve them to enable download.
          </p>
        )}
      </section>

      <section className="overview-card" aria-label="Export checklist">
        <header className="overview-card-head">
          <span className="hp-eyebrow">
            <ListChecks size={14} /> Export checklist
          </span>
          <span className={`overview-pill ${checklistFails ? "danger" : "ok"}`}>
            {checklist.filter((item) => item.status === "pass").length}/{checklist.length} ready
          </span>
        </header>
        <div className="export-checklist">
          {checklist.map((item) => (
            <button type="button" className={`export-check ${statusTone(item.status)}`} key={item.id} onClick={() => onJumpToTab(item.tab)} title={`${item.detail} — open ${item.tab}`}>
              <ChecklistIcon status={item.status} />
              <span>{item.label}</span>
              <small>{item.detail}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="overview-card" aria-label="Validation report">
        <header className="overview-card-head">
          <span className="hp-eyebrow">
            <ShieldCheck size={14} /> Local validation report
          </span>
          {validationReport && (
            <span className={`overview-pill ${blocking.length ? "danger" : warnings.length ? "warn" : "ok"}`}>
              {blocking.length} blocking · {warnings.length} warnings
            </span>
          )}
        </header>

        {!validationReport ? (
          <p className="overview-empty">Run local validation to see grouped, actionable results. This checks package structure, references, HTML safety, and XML — it does not verify a real Canvas import.</p>
        ) : (
          <>
            <p className={`export-status-line ${validationReport.valid ? "ok" : "danger"}`}>
              {validationReport.valid ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
              {validationReport.valid ? `Local package validation passed (score ${validationReport.score}).` : `Local validation found ${blocking.length} blocking issue${blocking.length === 1 ? "" : "s"} (score ${validationReport.score}).`}
            </p>

            {blocking.length > 0 && (
              <div className="export-issue-group">
                <h4 className="danger">
                  <AlertTriangle size={14} /> Blocking issues ({blocking.length})
                </h4>
                {blocking.map(renderIssue)}
              </div>
            )}
            {warnings.length > 0 && (
              <div className="export-issue-group">
                <h4 className="warn">
                  <ShieldCheck size={14} /> Warnings ({warnings.length})
                </h4>
                {warnings.map(renderIssue)}
              </div>
            )}
            {blocking.length === 0 && warnings.length === 0 && (
              <p className="export-status-line ok">
                <CheckCircle2 size={15} /> Every local check passed.
              </p>
            )}

            <button type="button" className="export-files-toggle" onClick={() => setShowFiles((value) => !value)} aria-expanded={showFiles}>
              {showFiles ? "Hide" : "Show"} {validationReport.files.length} package files
            </button>
            {showFiles && (
              <ul className="export-file-list">
                {validationReport.files.map((file) => (
                  <li key={file}>{file}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <div className="overview-grid">
        <section className="overview-card" aria-label="Export history">
          <header className="overview-card-head">
            <span className="hp-eyebrow">
              <FileArchive size={14} /> Export history
            </span>
            <span className="overview-pill muted">Local · in-memory</span>
          </header>
          {course.exportHistory.length === 0 ? (
            <p className="overview-empty">No local exports yet. History is kept in this browser session only and is not an audit log.</p>
          ) : (
            <>
              <div className="export-history-list">
                {course.exportHistory.slice(0, 8).map((entry) => (
                  <div className="export-history-row" key={entry.id}>
                    <div>
                      <strong>{entry.fileName}</strong>
                      <small>
                        {formatDateTime(entry.exportedAt)} · {EXPORT_MODE_LABELS[entry.mode]}
                      </small>
                    </div>
                    <span className={`overview-pill ${entry.validationScore >= 90 ? "ok" : "warn"}`}>{entry.validationScore}% local</span>
                  </div>
                ))}
              </div>
              <p className="export-history-note">History lives in this browser session only — it clears on reload and is not an audit-grade record.</p>
            </>
          )}
        </section>

        <section className="overview-card" aria-label="Canvas import guide">
          <header className="overview-card-head">
            <span className="hp-eyebrow">
              <ClipboardCheck size={14} /> Canvas import guide
            </span>
            <button type="button" className="small-button" onClick={() => void copyChecklist()}>
              <Copy size={12} /> {copyState}
            </button>
          </header>
          <ol className="export-guide">
            <li>Open a Canvas <strong>sandbox</strong> course (not production).</li>
            <li>Settings → Import Course Content.</li>
            <li>Content Type → Canvas Course Export Package / Common Cartridge.</li>
            <li>Choose the downloaded .imscc file and run the import.</li>
            <li>Verify modules, syllabus, gradebook weights, rubrics, quizzes, and publish states.</li>
          </ol>
          <p className="export-history-note">Re-importing edited objects into an existing course can create duplicates instead of replacing earlier content.</p>
          {importNotes.length > 0 && (
            <ul className="export-file-list">
              {importNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
