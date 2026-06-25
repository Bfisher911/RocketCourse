// Inline-SVG data visualizations for the Canvas export — turn the abstract structure a course
// already knows (grade weights, outcomes, workload, alignment) into visuals that read as "premium"
// and are unique to an LMS builder. All static inline SVG/HTML: no <script>, no url(), no web fonts,
// so they survive Canvas import. Self-contained (colors derived from the theme; no themeDesign cycle).

import type { Theme } from "../types";
import { mix, shiftHue, withAlpha } from "../utils/color";

const VIZ_FONT = "'Lato', 'Helvetica Neue', Helvetica, Arial, sans-serif";

interface VizPalette {
  accent: string;
  accentDark: string;
  soft: string;
  gradFrom: string;
  gradTo: string;
  ink: string;
  muted: string;
  border: string;
}

const palette = (theme: Theme): VizPalette => ({
  accent: theme.accent,
  accentDark: theme.accentDark,
  soft: theme.soft,
  gradFrom: theme.gradientFrom ?? theme.accent,
  gradTo: theme.gradientTo ?? theme.accentDark,
  ink: "#334155",
  muted: "#64748b",
  border: "#e2e8f0"
});

const esc = (value: string): string =>
  String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// A spread of distinct-but-related segment colors from the theme accent (hue-rotated + lightness mix).
const seriesColor = (theme: Theme, index: number, total: number): string => {
  const base = shiftHue(theme.accent, (index * 47) % 360);
  return mix(base, index % 2 ? theme.accentDark : "#ffffff", total > 1 ? (index / Math.max(1, total - 1)) * 0.28 : 0);
};

/** Grade-weight donut from assignment groups, with a legend. Weights are normalized to 100%. */
export const buildGradeWeightDonut = (theme: Theme, groups: Array<{ name: string; weight: number }>): string => {
  const pal = palette(theme);
  const valid = groups.filter((g) => g.weight > 0);
  const total = valid.reduce((sum, g) => sum + g.weight, 0);
  if (!valid.length || total <= 0) return "";
  const r = 66;
  const cx = 84;
  const cy = 84;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const segments = valid
    .map((group, index) => {
      const fraction = group.weight / total;
      const dash = fraction * circumference;
      const color = seriesColor(theme, index, valid.length);
      const seg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="26" stroke-dasharray="${dash.toFixed(2)} ${(circumference - dash).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>`;
      offset += dash;
      return seg;
    })
    .join("");
  const legend = valid
    .map(
      (group, index) =>
        `<div style="margin: 0 0 7px;"><span style="display: inline-block; width: 11px; height: 11px; border-radius: 3px; background: ${seriesColor(theme, index, valid.length)}; vertical-align: middle; margin-right: 9px;"></span><span style="color: ${pal.ink}; font-weight: 600;">${esc(group.name)}</span><span style="float: right; color: ${pal.accentDark}; font-weight: 800;">${Math.round((group.weight / total) * 100)}%</span></div>`
    )
    .join("");
  return `<div style="margin: 18px 0; font-size: 0;">
  <div style="display: inline-block; vertical-align: middle; width: 168px;">
    <svg width="168" height="168" viewBox="0 0 168 168" role="img" aria-label="Grade weight by category">
      ${segments}
      <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-family="${VIZ_FONT}" font-size="13" fill="${pal.muted}">Grade</text>
      <text x="${cx}" y="${cy + 18}" text-anchor="middle" font-family="${VIZ_FONT}" font-size="20" font-weight="800" fill="${pal.accentDark}">100%</text>
    </svg>
  </div>
  <div style="display: inline-block; vertical-align: middle; width: calc(100% - 180px); min-width: 220px; font-size: 14px; padding-left: 12px; box-sizing: border-box;">${legend}</div>
</div>`.trim();
};

/** Bloom's (or any leveled) outcome pyramid — stacked trapezoid tiers, top → bottom as given. */
export const buildBloomPyramid = (theme: Theme, tiers: Array<{ label: string; count?: number }>): string => {
  const pal = palette(theme);
  if (!tiers.length) return "";
  const n = tiers.length;
  const W = 360;
  const tierH = 46;
  const gap = 6;
  const H = n * tierH + (n - 1) * gap;
  const minHalf = 46;
  const maxHalf = 168;
  const cx = W / 2;
  const bands = tiers
    .map((tier, index) => {
      const topY = index * (tierH + gap);
      const botY = topY + tierH;
      // Width grows toward the bottom of the pyramid.
      const tHalf = minHalf + ((maxHalf - minHalf) * index) / Math.max(1, n - 1);
      const bHalf = minHalf + ((maxHalf - minHalf) * (index + 1)) / Math.max(1, n);
      const color = mix(pal.gradFrom, pal.gradTo, index / Math.max(1, n - 1));
      const points = `${cx - tHalf},${topY} ${cx + tHalf},${topY} ${cx + bHalf},${botY} ${cx - bHalf},${botY}`;
      const count = tier.count !== undefined ? ` <tspan fill="${withAlpha("#ffffff", 0.85)}" font-weight="700">(${tier.count})</tspan>` : "";
      return `<polygon points="${points}" fill="${color}"/><text x="${cx}" y="${topY + tierH / 2 + 5}" text-anchor="middle" font-family="${VIZ_FONT}" font-size="14" font-weight="800" fill="#ffffff">${esc(tier.label)}${count}</text>`;
    })
    .join("");
  return `<div style="margin: 18px 0;"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Outcome levels pyramid" style="max-width: 100%;">${bands}</svg></div>`;
};

/** A workload sparkline (hours across weeks) — area + line + endpoint dots. */
export const buildWorkloadSparkline = (theme: Theme, points: Array<{ label?: string; value: number }>): string => {
  const pal = palette(theme);
  if (points.length < 2) return "";
  const W = 520;
  const H = 120;
  const padX = 14;
  const padY = 16;
  const max = Math.max(...points.map((p) => p.value), 1);
  const stepX = (W - padX * 2) / (points.length - 1);
  const coords = points.map((p, index) => {
    const x = padX + index * stepX;
    const y = H - padY - (p.value / max) * (H - padY * 2);
    return { x, y, value: p.value, label: p.label };
  });
  const line = coords.map((c, index) => `${index ? "L" : "M"}${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  const area = `${line} L${coords[coords.length - 1].x.toFixed(1)} ${H - padY} L${coords[0].x.toFixed(1)} ${H - padY} Z`;
  const dots = coords
    .map((c) => `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="3.5" fill="${pal.accentDark}"/>`)
    .join("");
  const gradId = `wlGrad_${theme.id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return `<div style="margin: 18px 0;"><svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Estimated workload across the term">
  <defs><linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${withAlpha(pal.accent, 0.28)}"/><stop offset="1" stop-color="${withAlpha(pal.accent, 0.02)}"/></linearGradient></defs>
  <path d="${area}" fill="url(#${gradId})"/>
  <path d="${line}" fill="none" stroke="${pal.accent}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
  ${dots}
</svg></div>`.trim();
};

/** A module → outcome alignment map: a compact grid with accent cells where a module hits an outcome. */
export const buildCourseMap = (
  theme: Theme,
  modules: Array<{ title: string; outcomeCodes: string[] }>,
  outcomes: string[]
): string => {
  const pal = palette(theme);
  if (!modules.length || !outcomes.length) return "";
  const head = `<th style="text-align: left; padding: 8px 10px; font-family: ${VIZ_FONT}; color: ${pal.muted}; font-size: 12px;"></th>${outcomes
    .map((code) => `<th scope="col" style="padding: 8px 6px; font-family: ${VIZ_FONT}; font-size: 12px; font-weight: 800; color: ${pal.accentDark}; text-align: center;">${esc(code)}</th>`)
    .join("")}`;
  const rows = modules
    .map((module, index) => {
      const cells = outcomes
        .map((code) => {
          const hit = module.outcomeCodes.includes(code);
          const dot = hit
            ? `<span style="display: inline-block; width: 14px; height: 14px; border-radius: 4px; background: ${pal.accent};"></span>`
            : `<span style="display: inline-block; width: 14px; height: 14px; border-radius: 4px; background: ${withAlpha(pal.accent, 0.1)};"></span>`;
          return `<td style="padding: 7px 6px; text-align: center; border-top: 1px solid ${pal.border};">${dot}</td>`;
        })
        .join("");
      return `<tr style="background: ${index % 2 ? withAlpha(pal.accent, 0.04) : "#ffffff"};"><th scope="row" style="text-align: left; padding: 7px 10px; border-top: 1px solid ${pal.border}; font-family: ${VIZ_FONT}; font-size: 13px; font-weight: 700; color: ${pal.ink};">${esc(module.title)}</th>${cells}</tr>`;
    })
    .join("");
  return `<div style="margin: 18px 0; border: 1px solid ${pal.border}; border-radius: 14px; overflow: hidden;">
  <table style="width: 100%; border-collapse: collapse;"><thead><tr style="background: ${pal.soft};">${head}</tr></thead><tbody>${rows}</tbody></table>
</div>`.trim();
};
