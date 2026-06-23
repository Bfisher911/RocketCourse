/**
 * RocketCourse brand components.
 *
 * Single source for logo/brand markup so we never scatter hard-coded
 * <img> tags around the app. All marks degrade to a text fallback if the
 * image fails to load, decorative instances use empty alt + aria-hidden,
 * and the loader animations are calmed by the prefers-reduced-motion rules
 * in brand.css.
 */
import { useState } from "react";

const MARK_128 = "/brand/rocketcourse-mark-128.png";
const MARK_256 = "/brand/rocketcourse-mark-256.png";
const LOGO_FULL = "/brand/rocketcourse-logo-full.png";

type LogoMarkProps = {
  /** Rendered pixel size (square). */
  size?: number;
  /** Override the source image (defaults to the 128px mark). */
  src?: string;
  /** Wrap in the midnight neon tile. */
  framed?: boolean;
  /** Decorative usage: empty alt + hidden from a11y tree. */
  decorative?: boolean;
  alt?: string;
  className?: string;
};

/** The icon-only galaxy/rocket mark. Use everywhere a small brand cue helps. */
export function LogoMark({
  size = 40,
  src = MARK_128,
  framed = true,
  decorative = false,
  alt = "RocketCourse logo",
  className
}: LogoMarkProps) {
  const [failed, setFailed] = useState(false);
  const classes = ["rc-mark", framed ? "rc-mark--framed" : "", className].filter(Boolean).join(" ");
  return (
    <span className={classes} style={{ width: size, height: size }}>
      {failed ? (
        <span className="rc-mark__fallback" style={{ fontSize: Math.round(size * 0.34) }} aria-hidden={decorative || undefined}>
          {decorative ? "" : "RC"}
        </span>
      ) : (
        <img
          src={src}
          width={size}
          height={size}
          alt={decorative ? "" : alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

type LogoWordmarkProps = {
  /** Rendered height in px (the asset is square, so width == height). */
  height?: number;
  alt?: string;
  className?: string;
  /** Load eagerly for above-the-fold hero use. */
  priority?: boolean;
};

/** The full logo with the RocketCourse wordmark — for hero/landing areas. */
export function LogoWordmark({ height = 150, alt = "RocketCourse", className, priority = false }: LogoWordmarkProps) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <span className={["rc-wordmark-fallback", className].filter(Boolean).join(" ")}>RocketCourse</span>;
  }
  return (
    <img
      className={["rc-wordmark", className].filter(Boolean).join(" ")}
      src={LOGO_FULL}
      alt={alt}
      width={height}
      height={height}
      style={{ height, width: height }}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

/** Clickable top-bar brand lockup: mark + wordmark + tagline. Navigates home. */
export function BrandHeader({
  onClick,
  tagline = "Canvas Builder",
  className
}: {
  onClick?: () => void;
  tagline?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={["brand", className].filter(Boolean).join(" ")}
      onClick={onClick}
      aria-label="RocketCourse — go to home page"
    >
      <LogoMark size={40} decorative />
      <span>
        <strong>RocketCourse</strong>
        <small>{tagline}</small>
      </span>
    </button>
  );
}

type LoaderProps = {
  size?: "sm" | "md" | "lg";
  /** Center in a padded block with label/sublabel beneath. */
  fullscreen?: boolean;
  label?: string;
  sublabel?: string;
  className?: string;
};

/** Branded launch loader: orbit rings + floating mark + neon pulse. */
export function RocketCourseLoader({ size = "md", fullscreen = false, label, sublabel, className }: LoaderProps) {
  const px = size === "sm" ? 44 : size === "lg" ? 104 : 68;
  const orb = (
    <span className="rc-loader" style={{ width: px, height: px }}>
      <span className="rc-loader__glow" aria-hidden="true" />
      <span className="rc-loader__orbit" aria-hidden="true" />
      <span className="rc-loader__orbit rc-loader__orbit--inner" aria-hidden="true" />
      <LogoMark size={Math.round(px * 0.58)} src={MARK_256} framed={false} decorative className="rc-loader__mark" />
    </span>
  );
  if (fullscreen) {
    return (
      <div className={["rc-loader-screen", className].filter(Boolean).join(" ")} role="status" aria-live="polite">
        {orb}
        {label && <p className="rc-loader__label">{label}</p>}
        {sublabel && <p className="rc-loader__sub">{sublabel}</p>}
        <span className="sr-only">{label || "Loading"}</span>
      </div>
    );
  }
  return (
    <span className={["rc-loader-inline", className].filter(Boolean).join(" ")} role="status" aria-live="polite">
      {orb}
      {label && <span className="rc-loader__label">{label}</span>}
      <span className="sr-only">{label || "Loading"}</span>
    </span>
  );
}

/** Small brand pill — for dashboard headers, stats rows, etc. */
export function BrandBadge({ label = "RocketCourse", className }: { label?: string; className?: string }) {
  return (
    <span className={["rc-badge", className].filter(Boolean).join(" ")}>
      <LogoMark size={20} src={MARK_128} decorative />
      <strong>{label}</strong>
    </span>
  );
}

/** Decorative orbit rings + swirl glow for hero backdrops. Purely cosmetic. */
export function BrandOrbitalAccent({ className }: { className?: string }) {
  return (
    <div className={["rc-orbital", className].filter(Boolean).join(" ")} aria-hidden="true">
      <span className="rc-orbital__glow" />
      <span className="rc-orbital__ring rc-orbital__ring--a" />
      <span className="rc-orbital__ring rc-orbital__ring--b" />
    </div>
  );
}
