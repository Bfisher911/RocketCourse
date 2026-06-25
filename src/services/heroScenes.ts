// Figurative full-bleed hero illustrations — a tier above the corner motifs. Each scene is a
// duotone landscape drawn in the theme's own palette (sky = the hero gradient; silhouettes = accent
// / accent-dark; highlights = the on-gradient ink), sized to sit behind the homepage hero title.
// Pure inline SVG (no url(), no raster, no web fonts) so it survives Canvas import. Decoupled from
// themeDesign via a tiny palette interface (no import cycle).

import { withAlpha } from "../utils/color";
import type { ThemeHeroScene } from "../types";

export type { ThemeHeroScene };

export interface ScenePalette {
  gradientFrom: string;
  gradientTo: string;
  accent: string;
  accentDark: string;
  /** "#ffffff" or "#0b1020" — the readable-on-gradient ink, used for sparse highlights. */
  onGradient: string;
}

// Scene contents drawn on a 1440×420 stage, horizon ~y300, composed back→front. `ink` is the
// on-gradient highlight color; `mid`/`fore` are translucent accent silhouettes. Exported so the
// banner (a 1440×360 viewBox) can reuse the same art (its lower foreground simply clips).
export const sceneArt = (scene: ThemeHeroScene, pal: ScenePalette): string => {
  const ink = pal.onGradient;
  const mid = withAlpha(pal.accentDark, 0.45);
  const fore = withAlpha(pal.accentDark, 0.72);
  const soft = withAlpha(ink, 0.14);
  switch (scene) {
    case "lab":
      return `
  <g fill="${soft}"><circle cx="1180" cy="120" r="120"/></g>
  <rect x="0" y="320" width="1440" height="100" fill="${fore}"/>
  <g fill="${mid}"><rect x="0" y="300" width="1440" height="22"/></g>
  <g fill="none" stroke="${ink}" stroke-width="3" opacity="0.6">
    <path d="M980 320 v-70 l-26 -16 v-30 h54 v30 l-26 16 v70" fill="${withAlpha(ink, 0.12)}"/>
    <path d="M1070 320 v-92 h44 v92" fill="${withAlpha(ink, 0.1)}"/><path d="M1070 252 h44"/>
    <path d="M1150 320 l16 -86 h40 l16 86 z" fill="${withAlpha(ink, 0.12)}"/>
  </g>
  <g fill="${ink}" opacity="0.5"><circle cx="996" cy="296" r="5"/><circle cx="1180" cy="300" r="4"/><circle cx="1086" cy="288" r="3.5"/></g>
  <g fill="none" stroke="${ink}" stroke-width="2" opacity="0.4"><path d="M1240 320 v-50 a26 26 0 0 1 52 0 v50"/><circle cx="1266" cy="262" r="10"/></g>`;
    case "city":
      return `
  <g fill="${soft}"><circle cx="1230" cy="110" r="80"/></g>
  <g fill="${mid}"><rect x="120" y="200" width="90" height="120"/><rect x="320" y="160" width="70" height="160"/><rect x="900" y="180" width="80" height="140"/><rect x="1180" y="150" width="100" height="170"/></g>
  <g fill="${fore}"><rect x="0" y="240" width="120" height="180"/><rect x="210" y="210" width="110" height="210"/><rect x="430" y="170" width="80" height="250"/><rect x="540" y="250" width="130" height="170"/><rect x="780" y="220" width="120" height="200"/><rect x="980" y="190" width="100" height="230"/><rect x="1280" y="230" width="160" height="190"/></g>
  <g fill="${withAlpha(ink, 0.5)}"><rect x="450" y="190" width="10" height="14"/><rect x="470" y="190" width="10" height="14"/><rect x="450" y="220" width="10" height="14"/><rect x="1010" y="210" width="10" height="14"/><rect x="1030" y="210" width="10" height="14"/><rect x="1010" y="240" width="10" height="14"/><rect x="250" y="240" width="9" height="12"/><rect x="270" y="240" width="9" height="12"/></g>`;
    case "manuscript":
      return `
  <g fill="${soft}"><circle cx="1200" cy="120" r="100"/></g>
  <rect x="0" y="330" width="1440" height="90" fill="${fore}"/>
  <g>
    <path d="M1000 330 C1080 296 1160 296 1200 312 C1160 304 1080 304 1000 330 Z" fill="${withAlpha(ink, 0.16)}"/>
    <path d="M1200 312 C1240 296 1320 296 1400 330 C1320 304 1240 304 1200 330 Z" fill="${withAlpha(ink, 0.12)}"/>
    <path d="M1200 312 V330" stroke="${ink}" stroke-width="2" opacity="0.4"/>
    <g stroke="${ink}" stroke-width="1.6" opacity="0.3"><path d="M1040 314 h120 M1036 322 h128 M1240 314 h120 M1240 322 h128"/></g>
  </g>
  <g stroke="${ink}" stroke-width="3" fill="none" opacity="0.55"><path d="M1330 300 l60 -120"/><path d="M1390 180 l10 -18 l-22 6 z" fill="${ink}"/></g>`;
    case "mountains":
      return `
  <g fill="${withAlpha(ink, 0.5)}"><circle cx="1120" cy="150" r="56"/></g>
  <path d="M0 330 L260 170 L470 330 Z" fill="${mid}"/>
  <path d="M340 330 L640 130 L940 330 Z" fill="${fore}"/>
  <path d="M820 330 L1120 200 L1440 330 L1440 420 L0 420 L0 360 Z" fill="${withAlpha(pal.accentDark, 0.85)}"/>
  <path d="M580 200 l40 50 l-28 14 l36 26 l-72 14 z" fill="${withAlpha(ink, 0.5)}"/>
  <rect x="0" y="330" width="1440" height="90" fill="${withAlpha(pal.accentDark, 0.85)}"/>`;
    case "tech":
      return `
  <g fill="${soft}"><circle cx="1200" cy="120" r="110"/></g>
  <g fill="none" stroke="${mid}" stroke-width="3"><path d="M120 320 V210 H320 V150 H560"/><path d="M900 320 V230 H1120 V160 H1320"/><path d="M620 320 V250 H820"/></g>
  <g fill="${fore}"><rect x="100" y="200" width="60" height="40" rx="6"/><rect x="540" y="130" width="60" height="40" rx="6"/><rect x="1300" y="140" width="60" height="40" rx="6"/><rect x="800" y="230" width="60" height="40" rx="6"/></g>
  <g fill="${ink}" opacity="0.6"><circle cx="320" cy="210" r="6"/><circle cx="1120" cy="230" r="6"/><circle cx="620" cy="250" r="6"/><circle cx="900" cy="230" r="6"/></g>
  <rect x="0" y="320" width="1440" height="100" fill="${withAlpha(pal.accentDark, 0.8)}"/>
  <g fill="${withAlpha(ink, 0.3)}"><rect x="1180" y="332" width="180" height="10" rx="3"/><rect x="1180" y="352" width="180" height="10" rx="3"/><rect x="1180" y="372" width="180" height="10" rx="3"/></g>`;
    case "cosmos":
    default:
      return `
  <g fill="none" stroke="${withAlpha(ink, 0.3)}"><ellipse cx="1180" cy="170" rx="220" ry="80" transform="rotate(-16 1180 170)" stroke-width="2.5"/></g>
  <circle cx="1180" cy="170" r="74" fill="${withAlpha(ink, 0.16)}"/>
  <circle cx="1150" cy="146" r="16" fill="${withAlpha(ink, 0.12)}"/>
  <g fill="${ink}"><circle cx="300" cy="90" r="2.5" opacity="0.6"/><circle cx="520" cy="180" r="2" opacity="0.5"/><circle cx="760" cy="100" r="3" opacity="0.6"/><circle cx="900" cy="220" r="2" opacity="0.45"/><circle cx="1360" cy="120" r="2.5" opacity="0.55"/><circle cx="180" cy="240" r="2" opacity="0.4"/></g>
  <path d="M620 300 l4 11 l11 4 l-11 4 l-4 11 l-4 -11 l-11 -4 l11 -4 z" fill="${ink}" opacity="0.6"/>
  <path d="M0 360 C260 330 520 384 820 350 C1080 322 1280 366 1440 344 L1440 420 L0 420 Z" fill="${withAlpha(pal.accentDark, 0.8)}"/>`;
  }
};

/**
 * A full-bleed scene SVG that fills its container (position the parent relative + overflow hidden,
 * lay the hero title over the top). `preserveAspectRatio="xMidYMid slice"` keeps it covering at any
 * width. The dark-on-left scrim keeps overlaid title text readable.
 */
export const buildHeroSceneSvg = (scene: ThemeHeroScene, pal: ScenePalette): string =>
  `<svg aria-hidden="true" viewBox="0 0 1440 420" preserveAspectRatio="xMidYMid slice" style="position: absolute; inset: 0; width: 100%; height: 100%; display: block;">
  <defs>
    <linearGradient id="hsSky" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${pal.gradientFrom}"/><stop offset="1" stop-color="${pal.gradientTo}"/></linearGradient>
    <linearGradient id="hsScrim" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${pal.gradientTo}" stop-opacity="0.82"/><stop offset="0.62" stop-color="${pal.gradientTo}" stop-opacity="0.1"/></linearGradient>
  </defs>
  <rect width="1440" height="420" fill="url(#hsSky)"/>
  ${sceneArt(scene, pal)}
  <rect width="1440" height="420" fill="url(#hsScrim)"/>
</svg>`;
