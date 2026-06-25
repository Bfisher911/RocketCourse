// Themeable inline-SVG line-icon set — a Canvas-safe replacement for the emoji that used to label
// notes, columns, and meta rows (emoji render inconsistently across OS/Canvas and never pick up the
// course accent). Each icon is a 24×24 stroke path drawn in the passed color, so it inherits the
// theme. Inline SVG only — no <use>, no url(), no sprite sheet (all of which Canvas can strip).

export type IconName =
  | "objective"
  | "deadline"
  | "clock"
  | "reading"
  | "discussion"
  | "quiz"
  | "rubric"
  | "instructor"
  | "tip"
  | "warning"
  | "check"
  | "compass"
  | "flag"
  | "resource"
  | "video"
  | "download"
  | "star"
  | "award"
  | "info"
  | "key-term"
  | "steps"
  | "module"
  | "mail"
  | "arrow-right"
  | "chart"
  | "effort"
  | "assignment"
  | "folder";

// Inner markup for each icon, drawn on a 0 0 24 24 grid with `currentColor` so the wrapper can theme
// it. Kept Feather-ish: 2px strokes, round caps/joins, no fills except small dots.
const PATHS: Record<IconName, string> = {
  objective: `<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>`,
  deadline: `<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M12 12.5v3l2 1.5"/>`,
  clock: `<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.2l3.4 2"/>`,
  reading: `<path d="M12 6.5C10 5 6.5 4.7 4 5.4V18c2.5-.7 6-.4 8 1 2-1.4 5.5-1.7 8-1V5.4C17.5 4.7 14 5 12 6.5Z"/><path d="M12 6.5V19"/>`,
  discussion: `<path d="M4 5.5h11a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H9l-4 3v-3a2 2 0 0 1-1-2v-4a2 2 0 0 1 2-2Z"/><path d="M20 9.5a2 2 0 0 1 0 0v5a2 2 0 0 1-1 1.7"/>`,
  quiz: `<rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 3.5h6v3H9z"/><path d="M8.5 12l2.2 2.2L15.5 9.5"/>`,
  rubric: `<path d="M4 6.5h4M4 12h4M4 17.5h4"/><path d="M11 6.5h9M11 12h9M11 17.5h9"/><path d="M5 5.5l1 1 1.5-1.6" stroke-width="1.6"/>`,
  instructor: `<circle cx="12" cy="8.5" r="3.5"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/>`,
  tip: `<path d="M9 16.5a5 5 0 1 1 6 0c-.7.5-1 1.2-1 2v.5h-4V18.5c0-.8-.3-1.5-1-2Z"/><path d="M10 21.5h4"/>`,
  warning: `<path d="M12 4 2.8 19.5h18.4L12 4Z"/><path d="M12 10v4.5"/><circle cx="12" cy="17.4" r="1" fill="currentColor" stroke="none"/>`,
  check: `<circle cx="12" cy="12" r="8.6"/><path d="M8 12.2l2.6 2.6L16 9.4"/>`,
  compass: `<circle cx="12" cy="12" r="8.6"/><path d="M15.6 8.4l-1.7 5-5 1.7 1.7-5 5-1.7Z"/>`,
  flag: `<path d="M6 21V4"/><path d="M6 5h11l-2 3 2 3H6"/>`,
  resource: `<path d="M10 13.5a3.5 3.5 0 0 0 5 0l2.5-2.5a3.5 3.5 0 0 0-5-5L11 7.5"/><path d="M14 10.5a3.5 3.5 0 0 0-5 0L6.5 13a3.5 3.5 0 0 0 5 5L13 16.5"/>`,
  video: `<rect x="3.5" y="6" width="12" height="12" rx="2.5"/><path d="M15.5 10l5-3v10l-5-3"/>`,
  download: `<path d="M12 4v10"/><path d="M8 10.5l4 4 4-4"/><path d="M5 19.5h14"/>`,
  star: `<path d="M12 4l2.5 5.2 5.5.8-4 4 1 5.6L12 17l-5 2.6 1-5.6-4-4 5.5-.8L12 4Z"/>`,
  award: `<circle cx="12" cy="9.5" r="5.5"/><path d="M9 14.5 7.5 21l4.5-2.4L16.5 21 15 14.5"/>`,
  info: `<circle cx="12" cy="12" r="8.6"/><path d="M12 11v5"/><circle cx="12" cy="8" r="1" fill="currentColor" stroke="none"/>`,
  "key-term": `<path d="M6 4h10a2 2 0 0 1 2 2v14l-7-3-7 3V6a2 2 0 0 1 2-2Z"/>`,
  steps: `<path d="M9 6.5h11M9 12h11M9 17.5h11"/><path d="M4 5.5h1.5V8M4 11h2l-2 2.5h2M4.2 16.5H6v4.5H4.2" stroke-width="1.5"/>`,
  module: `<path d="M12 3.5 3.5 8 12 12.5 20.5 8 12 3.5Z"/><path d="M3.5 12 12 16.5 20.5 12M3.5 16 12 20.5 20.5 16"/>`,
  mail: `<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="m4 7 8 5.5L20 7"/>`,
  "arrow-right": `<path d="M4 12h15"/><path d="m13 6 6 6-6 6"/>`,
  chart: `<path d="M4 20.5h16"/><path d="M7 20.5v-6M12 20.5V8M17 20.5v-9" stroke-width="2.4"/>`,
  effort: `<path d="M13 3 5 13h5l-1 8 8-10h-5l1-8Z"/>`,
  assignment: `<path d="M16.5 4.5 19.5 7.5 9.5 17.5 5.5 18.5 6.5 14.5 16.5 4.5Z"/><path d="M14.5 6.5 17.5 9.5"/>`,
  folder: `<path d="M3.5 7a2 2 0 0 1 2-2H10l2 2.5h6.5a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V7Z"/>`
};

export interface IconOptions {
  /** Stroke color (usually the theme accent or a note's semantic foreground). Default currentColor. */
  color?: string;
  /** Rendered px size. Default 18. */
  size?: number;
  strokeWidth?: number;
  /** When set, the icon is meaningful and gets a <title>; otherwise it's aria-hidden decoration. */
  title?: string;
  /** Vertical alignment for inline use beside text. Default "-3px". */
  valign?: string;
}

const escAttr = (value: string): string =>
  String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Render one themed inline-SVG icon. Returns "" for an unknown name so callers never crash. */
export const icon = (name: IconName, options: IconOptions = {}): string => {
  const inner = PATHS[name];
  if (!inner) return "";
  const size = options.size ?? 18;
  const color = options.color ?? "currentColor";
  const sw = options.strokeWidth ?? 2;
  const valign = options.valign ?? "-3px";
  const a11y = options.title
    ? `role="img" aria-label="${escAttr(options.title)}"`
    : `aria-hidden="true" focusable="false"`;
  const titleEl = options.title ? `<title>${escAttr(options.title)}</title>` : "";
  return `<svg ${a11y} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: ${valign}; flex-shrink: 0;">${titleEl}${inner}</svg>`;
};

/** A small inline label: icon + text, baseline-aligned. Handy for meta rows and chips. */
export const iconLabel = (name: IconName, text: string, options: IconOptions = {}): string =>
  `<span style="display: inline-flex; align-items: center; gap: 7px;">${icon(name, options)}<span>${escAttr(text)}</span></span>`;

export const ICON_NAMES = Object.keys(PATHS) as IconName[];
