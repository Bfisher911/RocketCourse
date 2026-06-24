import { useId, type CSSProperties, type ReactNode } from "react";

/**
 * Single source for every readiness / score ring in the app.
 *
 * Replaces three older ad-hoc rings (the editor conic `.score-ring`, the
 * Homepage/Syllabus `.hp-score-ring`, and the landing `.cockpit-ring`). All
 * variants now share one SVG arc, one draw-in animation, and one set of tokens.
 *
 * Tones:
 *  - "brand"  → cyan→orchid→pink gradient arc (course identity / decorative)
 *  - "ok|warn|danger" → semantic stroke
 *  - "auto"   → derive ok/warn/danger from `failures` / `warnings`
 *
 * The arc draws in on mount (CSS keyframe) and is held static under
 * prefers-reduced-motion. Pass `decorative` for illustrative use (hides it
 * from assistive tech); otherwise it announces as an image with a label.
 */

type RingTone = "brand" | "ok" | "warn" | "danger" | "auto";

type ReadinessRingProps = {
  /** 0–100. Clamped and rounded for display. */
  score: number;
  /** Rendered pixel size (square). Default 72. */
  size?: number;
  /** Colour treatment. Default "brand". */
  tone?: RingTone;
  /** Failing checks — used only when tone="auto". */
  failures?: number;
  /** Warning checks — used only when tone="auto". */
  warnings?: number;
  /** Small caption under the number (e.g. "ready"). */
  caption?: ReactNode;
  /** Unit shown next to the number (e.g. "%"). */
  unit?: string;
  /** Illustrative use: hidden from the a11y tree. */
  decorative?: boolean;
  /** Accessible label when not decorative. Defaults to "Readiness N%". */
  ariaLabel?: string;
  className?: string;
};

const VIEW = 100;
const RADIUS = 44;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ReadinessRing({
  score,
  size = 72,
  tone = "brand",
  failures = 0,
  warnings = 0,
  caption,
  unit,
  decorative = false,
  ariaLabel,
  className
}: ReadinessRingProps) {
  // useId() can contain ":" — fine as an id but awkward in url(#…), so strip it.
  const gradientId = `rc-ring-grad-${useId().replace(/:/g, "")}`;
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const resolvedTone = tone === "auto" ? (failures ? "danger" : warnings ? "warn" : "ok") : tone;
  const offset = CIRCUMFERENCE * (1 - clamped / 100);

  const style = {
    width: size,
    height: size,
    "--ring-c": CIRCUMFERENCE.toFixed(2),
    "--ring-offset": offset.toFixed(2),
    "--ring-num": `${Math.round(size * 0.3)}px`,
    "--ring-cap": `${Math.max(8, Math.round(size * 0.12))}px`
  } as CSSProperties;

  return (
    <div
      className={["rc-ring", resolvedTone, className].filter(Boolean).join(" ")}
      style={style}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : (ariaLabel ?? `Readiness ${clamped}%`)}
    >
      <svg className="rc-ring__svg" viewBox={`0 0 ${VIEW} ${VIEW}`} width={size} height={size} aria-hidden="true">
        {resolvedTone === "brand" && (
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#22e6ff" />
              <stop offset="0.55" stopColor="#c77dff" />
              <stop offset="1" stopColor="#ff2ea6" />
            </linearGradient>
          </defs>
        )}
        <circle className="rc-ring__track" cx="50" cy="50" r={RADIUS} />
        <circle
          className="rc-ring__fill"
          cx="50"
          cy="50"
          r={RADIUS}
          stroke={resolvedTone === "brand" ? `url(#${gradientId})` : undefined}
        />
      </svg>
      <span className="rc-ring__label" aria-hidden="true">
        <strong>
          {clamped}
          {unit ? <i>{unit}</i> : null}
        </strong>
        {caption ? <small>{caption}</small> : null}
      </span>
    </div>
  );
}
