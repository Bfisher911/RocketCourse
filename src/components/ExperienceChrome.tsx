// ExperienceChrome — the one utility strip shared by ALL ten editor states
// (the original tabbed editor and the eight workflow experiences). Shows the
// course, the current experience (W-code), and an accessible switcher.
// Switching changes presentation only; course content never changes.

import { experiencesByCode, getExperience } from "../workflows/experienceRegistry";
import "../design-system/tokens/rc-tokens.css";
// The chrome's .rc-xchrome styles live in the workflow shell sheet; import it
// here (its former importer, WorkflowHost, is gone).
import "../workflows/workflow-shell.css";

interface ExperienceChromeProps {
  courseTitle: string;
  experienceId: string;
  readinessScore: number;
  readinessBlockers: number;
  saveState: "idle" | "saving" | "saved" | "error";
  onSwitch: (id: string) => void;
  onOpenPalette: () => void;
}

export function ExperienceChrome(props: ExperienceChromeProps) {
  const current = getExperience(props.experienceId);
  const readinessWord = props.readinessBlockers > 0 ? "Blocked" : props.readinessScore >= 90 ? "Ready" : "Review";
  return (
    <div data-rc-ds className="rc-xchrome" role="region" aria-label="Course workspace controls">
      <div className="rc-xchrome__seg">
        <span className="rc-xchrome__k">Course</span>
        <span className="rc-xchrome__v" title={props.courseTitle}>{props.courseTitle}</span>
      </div>
      <div className="rc-xchrome__seg">
        <span className="rc-xchrome__k">Experience</span>
        <label className="rc-xchrome__switch">
          <span className="rc-xchrome__code">{current?.code ?? "W02"}</span>
          <select
            className="rc-xchrome__select"
            aria-label="Switch course-building experience — your course content never changes"
            value={props.experienceId}
            onChange={e => props.onSwitch(e.target.value)}
          >
            {experiencesByCode().filter(exp => exp.enabled).map(exp => (
              <option key={exp.id} value={exp.id}>
                {exp.code} · {exp.name}{exp.isDefault ? " (recommended)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="rc-xchrome__seg">
        <span className="rc-xchrome__k">Readiness</span>
        <span className={"rc-xchrome__v rc-xchrome__v--" + readinessWord.toLowerCase()}>
          {readinessWord} · {props.readinessScore}
        </span>
      </div>
      <div className="rc-xchrome__seg">
        <span className="rc-xchrome__k">Autosave</span>
        <span className="rc-xchrome__v">
          {props.saveState === "saving" ? "Saving…" : props.saveState === "error" ? "Retry needed" : props.saveState === "saved" ? "Saved" : "Local"}
        </span>
      </div>
      <button
        type="button"
        className="rc-xchrome__cmdk"
        onClick={props.onOpenPalette}
        aria-label="Open command palette"
        title="Command palette"
      >
        <span aria-hidden="true">⌘K</span> Commands
      </button>
      <span className="rc-xchrome__note">Switching experiences never changes your course.</span>
    </div>
  );
}
