// Live course-blueprint preview for the guided creation wizard. Turns the settings form into a
// visual "blueprint" — module roadmap, assessment cadence, what's included, and the selected theme —
// that updates as the user changes settings. Pure presentational (derives everything from settings).

import {
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  Layers,
  MessageSquare,
  Palette,
  Rocket,
  Target
} from "lucide-react";
import { getTheme } from "../data/themes";
import type { CourseSettings } from "../types";

const titleCase = (value: string): string => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value);

const cadenceLabel = (value: string): string =>
  ({ none: "None", weekly: "Weekly", biweekly: "Biweekly", module: "Per module" } as Record<string, string>)[value] ??
  titleCase(value);

const orgUnit = (pattern: string): string =>
  ({ weeks: "Week", topics: "Topic", chapters: "Chapter", units: "Unit", quarters: "Quarter", custom: "Section" } as Record<string, string>)[
    pattern
  ] ?? "Module";

export function CourseBlueprintPreview({ settings }: { settings: CourseSettings }) {
  const theme = getTheme(settings.themeId);
  const unit = orgUnit(settings.organizationPattern);
  const moduleCount = Math.max(1, settings.moduleCount);
  const shown = Math.min(moduleCount, 8);

  const includes = [
    { on: settings.includeRubrics, label: "Rubrics", icon: ClipboardCheck },
    { on: settings.includeObjectives, label: "Objectives", icon: Target },
    { on: settings.finalProject, label: "Final project", icon: Rocket },
    { on: settings.includeContactHours, label: "Contact hours", icon: Clock },
    { on: settings.accessibilityFocus, label: "Accessibility", icon: CheckCircle2 }
  ];

  const cadence = [
    { label: "Assignments", value: titleCase(String(settings.assignmentCadence)), icon: FileText },
    { label: "Discussions", value: cadenceLabel(settings.discussionFrequency), icon: MessageSquare },
    { label: "Quizzes", value: cadenceLabel(settings.quizFrequency), icon: ClipboardCheck }
  ];

  return (
    <aside className="blueprint" aria-label="Course blueprint preview">
      <header className="blueprint-head">
        <span className="blueprint-eyebrow">
          <Layers size={13} /> Course blueprint
        </span>
        <h3>{settings.title?.trim() || "Your course"}</h3>
        <div className="blueprint-chips">
          <span className="bp-chip strong">{moduleCount} modules</span>
          <span className="bp-chip">{settings.lengthWeeks} weeks</span>
          {settings.level && <span className="bp-chip">{settings.level}</span>}
          {settings.modality && <span className="bp-chip">{settings.modality}</span>}
        </div>
      </header>

      <section className="blueprint-section">
        <span className="bp-label">{unit} roadmap</span>
        <div className="bp-modules">
          {Array.from({ length: shown }).map((_, index) => (
            <div className="bp-module" key={index} style={{ borderColor: theme.accent }}>
              <span className="bp-module-num" style={{ background: theme.accent }}>{index + 1}</span>
              <span className="bp-module-label">{unit} {index + 1}</span>
            </div>
          ))}
          {moduleCount > shown && <div className="bp-module more">+{moduleCount - shown} more</div>}
        </div>
      </section>

      <section className="blueprint-section">
        <span className="bp-label">Assessment cadence</span>
        <div className="bp-cadence">
          {cadence.map((item) => (
            <div className="bp-cad" key={item.label}>
              <item.icon size={15} />
              <strong>{item.label}</strong>
              <em>{item.value}</em>
            </div>
          ))}
        </div>
      </section>

      <section className="blueprint-section">
        <span className="bp-label">Included</span>
        <div className="bp-includes">
          {includes.map((inc) => (
            <span key={inc.label} className={`bp-inc ${inc.on ? "on" : "off"}`}>
              <inc.icon size={13} /> {inc.label}
            </span>
          ))}
        </div>
      </section>

      <footer className="blueprint-theme">
        <span className="bp-label">
          <Palette size={12} /> Theme
        </span>
        <span className="bp-theme-name">{theme.name}</span>
        <span className="bp-swatches" aria-hidden="true">
          <i style={{ background: theme.accent }} />
          <i style={{ background: theme.accentDark }} />
          <i style={{ background: theme.soft }} />
        </span>
      </footer>
    </aside>
  );
}
