// ============================================================================
// Shared form + presentation primitives
// ----------------------------------------------------------------------------
// Extracted from App.tsx FIRST, on purpose, and in its own commit. These are
// used by both Intake and the editor screens, so if they stayed in App.tsx while
// those screens moved out, every extracted screen would import App.tsx while
// App.tsx lazily imported it back. Across a chunk boundary that cycle does not
// fail the build — it surfaces at runtime as an undefined component or a TDZ
// ReferenceError, which no existing test would catch.
// ============================================================================

import { useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, FileText, Info, Loader2 } from "lucide-react";
import type { SourceFile } from "../../types";
import { parseDateList, seedDateList } from "../../services/scheduleInput";
import { LogoMark } from "../brand";

export function Input({
  label,
  value,
  type = "text",
  placeholder,
  onChange
}: {
  label: string;
  value: string;
  type?: "text" | "date" | "time";
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export function NumberInput({
  label,
  value,
  min,
  max,
  suffix,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="number-input">
        <input type="number" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
        {suffix && <small>{suffix}</small>}
      </div>
    </label>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  compact,
  placeholder,
  rows = compact ? 4 : 8
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea rows={rows} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

// A multi-line list field (Holidays / Blackout dates) whose EDITABLE text is held locally and
// decoupled from the parsed array. This is the fix for the long-standing bug where pressing Enter,
// typing a trailing space, or pasting a multi-line list was stripped on every keystroke (the field
// used to re-derive its value from the parsed array each render). The parsed array is kept in sync
// for scheduling/generation; the visible text is whatever the user typed or pasted.
export function ListTextArea({
  label,
  value,
  onChange,
  helper,
  rows = 3
}: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  helper?: string;
  rows?: number;
}) {
  const [draft, setDraft] = useState(() => seedDateList(value));
  return (
    <label className="field">
      <span>{label}</span>
      <textarea
        rows={rows}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          onChange(parseDateList(event.target.value));
        }}
      />
      {helper && <small className="field-hint">{helper}</small>}
    </label>
  );
}

export function Select({
  label,
  value,
  options,
  labels,
  hint,
  onChange
}: {
  label: string;
  value: string;
  options: string[];
  labels?: Record<string, string>;
  /** One plain-language sentence about what this choice changes — shown under the control. */
  hint?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {labels?.[option] ?? option}
          </option>
        ))}
      </select>
      {hint && <small className="field-help">{hint}</small>}
    </label>
  );
}

export function Toggle({ label, checked, hint, onChange }: { label: string; checked: boolean; hint?: string; onChange: (value: boolean) => void }) {
  return (
    <label className="toggle" title={hint}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
      {hint && (
        <span className="toggle-hint" aria-hidden="true">
          <Info size={13} />
        </span>
      )}
      {hint && <span className="sr-only">{hint}</span>}
    </label>
  );
}

// Accordion section used on the Create page so advanced settings stay tucked away until wanted.
export function CollapsibleSection({
  title,
  open,
  onToggle,
  children
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className={`collapsible-section ${open ? "open" : ""}`}>
      <button type="button" className="collapsible-head" onClick={onToggle} aria-expanded={open}>
        <ChevronRight size={16} className="collapsible-chevron" />
        <span>{title}</span>
        <small>{open ? "Hide" : "Edit"}</small>
      </button>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <LogoMark size={48} decorative className="empty-state-mark" />
      <h2>{title}</h2>
      <p>{body}</p>
    </div>
  );
}

// Parse-status pill for an attached/pasted source on the Create page.
export function SourceStatusBadge({ status }: { status: SourceFile["status"] }) {
  const map: Record<SourceFile["status"], { label: string; tone: string; icon: typeof CheckCircle2 }> = {
    attached: { label: "Attached", tone: "muted", icon: FileText },
    parsing: { label: "Parsing…", tone: "info", icon: Loader2 },
    parsed: { label: "Parsed", tone: "ok", icon: CheckCircle2 },
    "needs-review": { label: "Needs review", tone: "warn", icon: AlertTriangle },
    failed: { label: "Failed to parse", tone: "danger", icon: AlertTriangle }
  };
  const { label, tone, icon: Icon } = map[status];
  return (
    <span className={`source-badge ${tone}`}>
      <Icon size={12} className={status === "parsing" ? "spin" : ""} /> {label}
    </span>
  );
}
