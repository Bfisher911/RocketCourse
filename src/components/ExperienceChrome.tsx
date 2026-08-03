// ExperienceChrome — the one persistent "you are here" strip shared by every
// editor state (the Advanced Workspace and the guided journey). Answers the
// four questions a builder actually has mid-course: which course, how good is
// it (and is it improving), is my work safe, how do I jump anywhere.
// Switching the view changes presentation only; course content never changes.

import { useEffect, useRef } from "react";
import { experiencesForPicker } from "../workflows/experienceRegistry";
import "../design-system/tokens/rc-tokens.css";
// Chrome styling only — the lab shell sheet is no longer pulled into the app bundle.
import "./experienceChrome.css";

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
  const readinessWord = props.readinessBlockers > 0 ? "Blocked" : props.readinessScore >= 90 ? "Ready" : "Review";
  // Where this course stood when the session opened it. The score alone says
  // how good the course is; the delta says RocketCourse is making it better —
  // which is the thing the user should feel without having to look for it.
  const baseline = useRef<number | null>(null);
  useEffect(() => {
    baseline.current ??= props.readinessScore;
  }, [props.readinessScore]);
  const gain = baseline.current === null ? 0 : props.readinessScore - baseline.current;

  return (
    <div data-rc-ds className="rc-xchrome" role="region" aria-label="Course workspace controls">
      <div className="rc-xchrome__seg">
        <span className="rc-xchrome__k">Course</span>
        <span className="rc-xchrome__v" title={props.courseTitle}>{props.courseTitle}</span>
      </div>
      <div className="rc-xchrome__seg">
        <span className="rc-xchrome__k">Quality</span>
        <span className={"rc-xchrome__v rc-xchrome__v--" + readinessWord.toLowerCase()}>
          {readinessWord} · {props.readinessScore}
          {gain > 0 && (
            <span className="rc-xchrome__gain" title={`Up ${gain} points since you opened this course`}>
              ▲ {gain}
            </span>
          )}
        </span>
      </div>
      <div className="rc-xchrome__seg">
        <span className="rc-xchrome__k">Your work</span>
        <span className="rc-xchrome__v">
          {props.saveState === "saving" ? "Saving…" : props.saveState === "error" ? "Retry needed" : props.saveState === "saved" ? "Saved" : "Saved on this device"}
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
      {/* The view switcher is a preference, not a place — it sits last and
          quiet so the recommended journey stays the obvious way to work. */}
      <label className="rc-xchrome__switch rc-xchrome__switch--end">
        <span className="rc-xchrome__k">View</span>
        <select
          className="rc-xchrome__select"
          aria-label="Switch how you build this course — your course content never changes"
          title="Switching views never changes your course."
          value={props.experienceId}
          onChange={e => props.onSwitch(e.target.value)}
        >
          {experiencesForPicker().filter(exp => exp.enabled).map(exp => (
            <option key={exp.id} value={exp.id}>
              {exp.name}{exp.isDefault ? " (recommended)" : ""}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
