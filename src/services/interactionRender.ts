// ============================================================================
// Canvas interaction rendering
// ----------------------------------------------------------------------------
// Turns an InteractionBlock (pattern + course-specific content) into Canvas-safe
// HTML. All markup is inline-styled from the course theme (no stylesheets — a
// stylesheet would be missing after IMSCC import), all text is escaped, and all
// ids are suffixed with the block id so repeated patterns never collide.
//
// External (iframe-tier) patterns render an iframe ONLY when a validated
// ExternalInteractiveConfig is supplied AND external embeds are explicitly
// enabled; otherwise they render the pattern's native fallback or an honest
// external-link panel. RocketCourse's export validator treats raw iframes as
// Canvas-hostile, and this module never bypasses it.
// ============================================================================

import type { ExternalInteractiveConfig, InteractionBlock, InteractionContent, InteractionItem, Theme } from "../types";
import { getThemeStyles, type ThemeStyles } from "./themeDesign";
import { withAlpha } from "../utils/color";
import {
  interactionPatternById,
  type InteractionPatternDef,
  type InteractionTemplate
} from "../data/interactionPatterns";

export type { ExternalInteractiveConfig, InteractionBlock, InteractionContent, InteractionItem };

/** Host-side switch for iframe emission. Off until RocketCourse ships a host. */
export interface ExternalEmbedPolicy {
  enabled: boolean;
  allowedDomains: string[];
}

export const DEFAULT_EMBED_POLICY: ExternalEmbedPolicy = { enabled: false, allowedDomains: [] };

// ── Escaping and small helpers ──────────────────────────────────────────────

const esc = (value: string | number | undefined | null): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Real Canvas refs ($TOKEN$/…), https URLs, mailto, and in-page anchors only.
const SAFE_HREF = /^(?:https:\/\/|mailto:|#|\$[A-Z][A-Z0-9_.-]*\$)/;

const safeHref = (href: string | undefined): string | null => {
  const trimmed = (href ?? "").trim();
  if (!trimmed || trimmed === "#") return null;
  return SAFE_HREF.test(trimmed) ? trimmed : null;
};

const uid = (blockId: string, patternId: string): string =>
  `${patternId}-${blockId}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-");

interface RenderCtx {
  styles: ThemeStyles;
  headingId: string;
}

const sectionShell = (ctx: RenderCtx, content: InteractionContent, body: string, options: { soft?: boolean; accentEdge?: boolean } = {}): string => {
  const { styles } = ctx;
  const background = options.soft ? styles.soft : "#ffffff";
  const edge = options.accentEdge ? `border-left:6px solid ${styles.accentDark};` : `border-top:5px solid ${styles.accent};`;
  return `<section aria-labelledby="${ctx.headingId}" style="margin:20px 0;padding:18px 20px;background:${background};border:1px solid ${withAlpha(styles.accentDark, 0.28)};${edge}border-radius:12px;color:${styles.canvasText};font-family:${styles.font};line-height:1.6;">
<h3 id="${ctx.headingId}" style="margin:0 0 10px;color:${styles.accentDark};font-size:20px;line-height:1.25;">${esc(content.title)}</h3>
${content.intro ? `<p style="margin:0 0 12px;">${esc(content.intro)}</p>` : ""}
${body}
${content.note ? `<p style="margin:12px 0 0;font-size:13px;color:${styles.mutedText};">${esc(content.note)}</p>` : ""}
</section>`;
};

const detailsPanel = (ctx: RenderCtx, item: InteractionItem): string => {
  const { styles } = ctx;
  return `<details${item.open ? " open" : ""} style="border:1px solid ${withAlpha(styles.accentDark, 0.3)};border-radius:9px;margin:10px 0;overflow:hidden;">
<summary style="padding:12px 14px;font-weight:700;cursor:pointer;background:${styles.soft};color:${styles.accentDark};">${esc(item.heading)}${item.meta ? ` <span style="font-weight:400;color:${styles.mutedText};">· ${esc(item.meta)}</span>` : ""}</summary>
<div style="padding:12px 14px;background:#ffffff;"><p style="margin:0;">${esc(item.body)}</p></div>
</details>`;
};

const revealBlock = (ctx: RenderCtx, reveal: { label: string; body: string }): string =>
  detailsPanel(ctx, { heading: reveal.label, body: reveal.body });

// ── Template renderers ──────────────────────────────────────────────────────

type TemplateRenderer = (ctx: RenderCtx, content: InteractionContent) => string;

const renderRevealPanels: TemplateRenderer = (ctx, content) =>
  sectionShell(ctx, content, `${content.items.map((item) => detailsPanel(ctx, item)).join("\n")}${content.reveal ? revealBlock(ctx, content.reveal) : ""}`);

const renderStepsReveal: TemplateRenderer = (ctx, content) => {
  const steps = `<ol style="margin:0;padding-left:24px;">${content.items
    .map((item) => `<li style="margin:12px 0;"><strong>${esc(item.heading)}:</strong> ${esc(item.body)}${item.meta ? ` <span style="color:${ctx.styles.mutedText};font-size:13px;">(${esc(item.meta)})</span>` : ""}</li>`)
    .join("")}</ol>`;
  return sectionShell(ctx, content, `${steps}${content.reveal ? revealBlock(ctx, content.reveal) : ""}`);
};

const renderPromptList: TemplateRenderer = (ctx, content) => {
  const prompts = `<ul style="margin:0;padding-left:22px;">${content.items
    .map((item) => `<li style="margin:9px 0;"><strong>${esc(item.heading)}:</strong> ${esc(item.body)}</li>`)
    .join("")}</ul>`;
  return sectionShell(ctx, content, `${prompts}${content.reveal ? revealBlock(ctx, content.reveal) : ""}`);
};

const renderChecklist: TemplateRenderer = (ctx, content) => {
  const items = `<ul style="list-style:none;margin:0;padding:0;">${content.items
    .map(
      (item) =>
        `<li style="position:relative;margin:9px 0;padding-left:28px;"><span aria-hidden="true" style="position:absolute;left:0;top:0;color:${ctx.styles.accentDark};font-weight:900;">&#10003;</span><strong>${esc(item.heading)}</strong>${item.body ? ` — ${esc(item.body)}` : ""}</li>`
    )
    .join("")}</ul>`;
  const persistence = `<p style="margin:12px 0 0;font-size:13px;color:${ctx.styles.mutedText};">These visual checkmarks are a reading aid; Canvas does not save checked-off state between visits.</p>`;
  return sectionShell(ctx, content, `${items}${persistence}`);
};

const renderCardLinkGrid: TemplateRenderer = (ctx, content) => {
  const { styles } = ctx;
  const cards = content.items
    .map((item) => {
      const href = safeHref(item.href);
      const inner = `<strong style="display:block;color:${styles.accentDark};margin-bottom:4px;">${esc(item.heading)}</strong><span style="display:block;color:${styles.canvasText};font-size:14px;">${esc(item.body)}</span>${item.meta ? `<span style="display:block;margin-top:6px;color:${styles.mutedText};font-size:12px;">${esc(item.meta)}</span>` : ""}`;
      // A card with no resolvable destination renders as a static card — never a dead link.
      return href
        ? `<a href="${esc(href)}" style="display:block;border:1px solid ${withAlpha(styles.accentDark, 0.3)};border-radius:10px;padding:14px 16px;text-decoration:none;background:${styles.soft};">${inner}</a>`
        : `<div style="border:1px solid ${withAlpha(styles.accentDark, 0.3)};border-radius:10px;padding:14px 16px;background:${styles.soft};">${inner}</div>`;
    })
    .join("\n");
  const nav = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;">${cards}</div>`;
  return sectionShell(ctx, content, nav);
};

const renderCallout: TemplateRenderer = (ctx, content) => {
  const body = content.items.length
    ? `<ul style="margin:0;padding-left:22px;">${content.items.map((item) => `<li style="margin:8px 0;"><strong>${esc(item.heading)}</strong>${item.body ? ` — ${esc(item.body)}` : ""}</li>`).join("")}</ul>`
    : "";
  return sectionShell(ctx, content, `${body}${content.reveal ? revealBlock(ctx, content.reveal) : ""}`, { soft: true, accentEdge: true });
};

const renderScenario: TemplateRenderer = (ctx, content) => {
  const { styles } = ctx;
  const kicker = `<p style="margin:0 0 6px;font-size:12px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:${styles.accentDark};">Scenario</p>`;
  const facets = content.items.map((item) => `<p style="margin:8px 0;"><strong>${esc(item.heading)}:</strong> ${esc(item.body)}</p>`).join("");
  const questions = content.reveal ? revealBlock(ctx, content.reveal) : "";
  return `<article aria-labelledby="${ctx.headingId}" style="margin:20px 0;padding:18px 20px;background:${styles.soft};border:1px solid ${withAlpha(styles.accentDark, 0.3)};border-radius:12px;color:${styles.canvasText};font-family:${styles.font};line-height:1.6;">
${kicker}<h3 id="${ctx.headingId}" style="margin:0 0 8px;color:${styles.accentDark};font-size:20px;">${esc(content.title)}</h3>
${content.intro ? `<p style="margin:0 0 10px;">${esc(content.intro)}</p>` : ""}${facets}${questions}
</article>`;
};

const renderOptionsReveal: TemplateRenderer = (ctx, content) => {
  const options = `<ol style="margin:0;padding-left:24px;">${content.items
    .map((item) => `<li style="margin:10px 0;"><strong>${esc(item.heading)}:</strong> ${esc(item.body)}</li>`)
    .join("")}</ol>`;
  return sectionShell(ctx, content, `${options}${content.reveal ? revealBlock(ctx, content.reveal) : ""}`);
};

const renderFlawRepair: TemplateRenderer = (ctx, content) => {
  const { styles } = ctx;
  const flawed = content.quote
    ? `<blockquote style="border-left:5px solid ${styles.accentDark};margin:0 0 4px;padding:12px 16px;background:${styles.soft};color:${styles.canvasText};">${esc(content.quote)}</blockquote>`
    : "";
  const symptoms = content.items.map((item) => detailsPanel(ctx, item)).join("\n");
  return sectionShell(ctx, content, `${flawed}${symptoms}${content.reveal ? revealBlock(ctx, content.reveal) : ""}`);
};

const renderMatrixTable: TemplateRenderer = (ctx, content) => {
  const { styles } = ctx;
  const columns = content.columns ?? [];
  const rows = content.rows ?? [];
  // Without real matrix data a table would export as an empty grid — degrade to
  // the prompt-list form so the pattern still teaches instead of shipping a shell.
  if (!columns.length || !rows.length) return renderPromptList(ctx, content);
  const head = columns.map((column) => `<th scope="col" style="text-align:left;padding:10px 12px;background:${styles.accentDark};color:${styles.onAccentDark};border:1px solid ${styles.accentDark};">${esc(column)}</th>`).join("");
  const body = rows
    .map(
      (row, rowIndex) =>
        `<tr style="background:${rowIndex % 2 ? styles.soft : "#ffffff"};">${row
          .map((cell, cellIndex) =>
            cellIndex === 0
              ? `<th scope="row" style="text-align:left;vertical-align:top;padding:10px 12px;border:1px solid ${styles.border};color:${styles.accentDark};">${esc(cell)}</th>`
              : `<td style="vertical-align:top;padding:10px 12px;border:1px solid ${styles.border};">${esc(cell)}</td>`
          )
          .join("")}</tr>`
    )
    .join("");
  const table = `<div style="max-width:100%;overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:14px;"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  return sectionShell(ctx, content, `${table}${content.reveal ? revealBlock(ctx, content.reveal) : ""}`);
};

const renderTimeline: TemplateRenderer = (ctx, content) => {
  const { styles } = ctx;
  const events = content.items
    .map(
      (item) => `<details style="border-left:6px solid ${styles.accent};padding:10px 14px;margin:12px 0;background:#ffffff;border-radius:0 9px 9px 0;">
<summary style="font-weight:700;cursor:pointer;color:${styles.accentDark};">${esc(item.heading)}${item.meta ? ` <span style="font-weight:400;color:${styles.mutedText};">· ${esc(item.meta)}</span>` : ""}</summary>
<p style="margin:8px 0 0;">${esc(item.body)}</p>
</details>`
    )
    .join("\n");
  return sectionShell(ctx, content, events);
};

const renderFlipCard: TemplateRenderer = (ctx, content) => {
  const { styles } = ctx;
  const front = content.items[0];
  if (!front) return "";
  return `<details style="border:2px solid ${styles.accent};border-radius:12px;margin:20px 0;overflow:hidden;font-family:${styles.font};">
<summary style="padding:22px;text-align:center;font-size:19px;font-weight:700;cursor:pointer;background:${styles.soft};color:${styles.accentDark};">${esc(front.heading)}</summary>
<div style="padding:22px;text-align:center;background:#ffffff;color:${styles.canvasText};"><p style="margin:0;">${esc(front.body)}</p></div>
</details>`;
};

// Media/figure templates render only when a real asset URL is provided — otherwise
// the block is omitted entirely (rule: never export an unfinished shell).
const renderFigurePanel: TemplateRenderer = (ctx, content) => {
  const media = content.items.find((item) => safeHref(item.href));
  if (!media) return "";
  const { styles } = ctx;
  const figure = `<figure style="margin:0 0 12px;"><img src="${esc(safeHref(media.href) ?? "")}" alt="${esc(media.body)}" style="max-width:100%;height:auto;border:1px solid ${styles.border};border-radius:9px;" /><figcaption style="margin-top:6px;color:${styles.mutedText};font-size:13px;">${esc(media.heading)}</figcaption></figure>`;
  const rest = content.items.filter((item) => item !== media).map((item) => detailsPanel(ctx, item)).join("\n");
  return sectionShell(ctx, content, `${figure}${rest}${content.reveal ? revealBlock(ctx, content.reveal) : ""}`);
};

const renderGallery: TemplateRenderer = (ctx, content) => {
  const images = content.items.filter((item) => safeHref(item.href));
  if (!images.length) return "";
  const { styles } = ctx;
  const cells = images
    .map(
      (item) =>
        `<figure style="margin:0;border:1px solid ${styles.border};border-radius:10px;padding:10px;"><img src="${esc(safeHref(item.href) ?? "")}" alt="${esc(item.body)}" style="width:100%;height:auto;border-radius:6px;" /><figcaption style="margin-top:6px;font-size:13px;color:${styles.mutedText};">${esc(item.heading)}</figcaption></figure>`
    )
    .join("\n");
  return sectionShell(ctx, content, `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;">${cells}</div>`);
};

const renderMediaAudio: TemplateRenderer = (ctx, content) => {
  const media = content.items.find((item) => safeHref(item.href));
  if (!media) return "";
  const transcript = content.reveal ? revealBlock(ctx, content.reveal) : "";
  return sectionShell(ctx, content, `<audio controls src="${esc(safeHref(media.href) ?? "")}" style="width:100%;">Your browser does not support the audio element.</audio><p style="margin:8px 0 0;font-size:13px;color:${ctx.styles.mutedText};">${esc(media.heading)}</p>${transcript}`);
};

const renderMediaVideo: TemplateRenderer = (ctx, content) => {
  const media = content.items.find((item) => safeHref(item.href));
  if (!media) return "";
  const captions = content.items.find((item) => item.meta === "captions" && safeHref(item.href) && item !== media);
  const track = captions ? `<track kind="captions" src="${esc(safeHref(captions.href) ?? "")}" srclang="en" label="English" />` : "";
  const transcript = content.reveal ? revealBlock(ctx, content.reveal) : "";
  return sectionShell(ctx, content, `<video controls style="max-width:100%;height:auto;"><source src="${esc(safeHref(media.href) ?? "")}" type="video/mp4" />${track}</video><p style="margin:8px 0 0;font-size:13px;color:${ctx.styles.mutedText};">${esc(media.heading)}</p>${transcript}`);
};

const renderImageMap: TemplateRenderer = (ctx, content) => {
  // Coordinate-accurate image maps cannot be generated reliably without a real
  // annotated image, so this renders the accessible text-equivalent form: the
  // figure plus a linked region list (the PDF's required companion).
  return renderFigurePanel(ctx, content);
};

const renderInstructorPanel: TemplateRenderer = (ctx, content) => {
  const facts = content.items.map((item) => `<p style="margin:6px 0;"><strong>${esc(item.heading)}:</strong> ${esc(item.body)}</p>`).join("");
  return sectionShell(ctx, content, facts, { soft: true, accentEdge: true });
};

const TEMPLATE_RENDERERS: Record<Exclude<InteractionTemplate, "iframe-embed">, TemplateRenderer> = {
  "reveal-panels": renderRevealPanels,
  "steps-reveal": renderStepsReveal,
  "prompt-list": renderPromptList,
  checklist: renderChecklist,
  "card-link-grid": renderCardLinkGrid,
  callout: renderCallout,
  scenario: renderScenario,
  "options-reveal": renderOptionsReveal,
  "flaw-repair": renderFlawRepair,
  "matrix-table": renderMatrixTable,
  timeline: renderTimeline,
  "flip-card": renderFlipCard,
  "media-audio": renderMediaAudio,
  "media-video": renderMediaVideo,
  "figure-panel": renderFigurePanel,
  gallery: renderGallery,
  "image-map": renderImageMap,
  "instructor-panel": renderInstructorPanel
};

// ── External embeds ─────────────────────────────────────────────────────────

const domainMatches = (url: string, allowedDomain: string): boolean => {
  try {
    const host = new URL(url).hostname.toLowerCase();
    const allowed = allowedDomain.toLowerCase().replace(/^\*\./, "");
    return host === allowed || host.endsWith(`.${allowed}`);
  } catch {
    return false;
  }
};

export const validateExternalConfig = (config: ExternalInteractiveConfig, policy: ExternalEmbedPolicy): string[] => {
  const errors: string[] = [];
  if (!/^https:\/\//i.test(config.url)) errors.push("External interactive URL must use HTTPS.");
  if (!config.title.trim()) errors.push("External interactive needs a descriptive title.");
  if (!config.textAlternative.trim()) errors.push("External interactive needs a text alternative.");
  if (!domainMatches(config.url, config.allowedDomain)) errors.push("URL does not match its allowed domain.");
  if (policy.enabled && !policy.allowedDomains.some((domain) => domainMatches(config.url, domain))) {
    errors.push("Domain is not on the workspace embed allowlist.");
  }
  return errors;
};

const renderExternalEmbed = (ctx: RenderCtx, content: InteractionContent, config: ExternalInteractiveConfig): string => {
  const { styles } = ctx;
  const height = Math.min(1200, Math.max(320, config.height ?? 700));
  return `<div style="border:1px solid ${withAlpha(styles.accentDark, 0.3)};border-radius:10px;overflow:hidden;margin:20px 0;">
<iframe src="${esc(config.url)}" title="${esc(config.title)}" width="100%" height="${height}" loading="lazy" allowfullscreen style="border:0;width:100%;min-height:${height}px;"></iframe>
</div>
<p style="margin:6px 0 0;font-size:13px;color:${styles.mutedText};">${esc(config.textAlternative)}</p>
<p style="margin:6px 0 0;"><a href="${esc(config.url)}" target="_blank" rel="noreferrer noopener">Open ${esc(config.title)} in a new window</a></p>`;
};

/** Honest link-out panel used when an iframe pattern has a URL but embeds are disabled. */
const renderExternalLinkPanel = (ctx: RenderCtx, content: InteractionContent, config: ExternalInteractiveConfig): string =>
  sectionShell(
    ctx,
    { ...content, note: content.note },
    `<p style="margin:0 0 10px;">${esc(config.textAlternative)}</p><p style="margin:0;"><a href="${esc(config.url)}" target="_blank" rel="noreferrer noopener" style="font-weight:700;color:${ctx.styles.accentDark};">Open ${esc(config.title)} in a new window</a></p>`,
    { soft: true, accentEdge: true }
  );

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Render one interaction block to Canvas-safe HTML. Returns "" when the block
 * cannot render honestly (missing required assets/config) — callers must treat
 * "" as "omit the block", never as an error to paper over.
 */
export const renderInteractionBlock = (block: InteractionBlock, theme: Theme, policy: ExternalEmbedPolicy = DEFAULT_EMBED_POLICY): string => {
  const pattern = interactionPatternById(block.patternId);
  if (!pattern) return "";
  const ctx: RenderCtx = { styles: getThemeStyles(theme), headingId: `${uid(block.id, pattern.id)}-heading` };

  if (pattern.template === "iframe-embed") {
    if (block.external && validateExternalConfig(block.external, policy).length === 0) {
      return policy.enabled
        ? renderExternalEmbed(ctx, block.content, block.external)
        : renderExternalLinkPanel(ctx, block.content, block.external);
    }
    // No configured host: render the native fallback pattern with this block's content.
    const fallback = pattern.fallbackPatternId ? interactionPatternById(pattern.fallbackPatternId) : undefined;
    if (!fallback || fallback.template === "iframe-embed") return "";
    const renderer = TEMPLATE_RENDERERS[fallback.template];
    return renderer(ctx, block.content);
  }

  const renderer = TEMPLATE_RENDERERS[pattern.template];
  return renderer(ctx, block.content);
};

/** All of a container's interaction blocks rendered in order, omitting empty renders. */
export const renderInteractionBlocks = (blocks: InteractionBlock[] | undefined, theme: Theme, policy?: ExternalEmbedPolicy): string =>
  (blocks ?? [])
    .map((block) => renderInteractionBlock(block, theme, policy))
    .filter((html) => html.trim().length > 0)
    .join("\n");

/**
 * A page/assignment/discussion body plus its interaction blocks, ready for
 * preview or IMSCC export. Blocks always append AFTER the authored body so the
 * instructor's own content stays first.
 */
export const composeBodyWithInteractions = (
  bodyHtml: string,
  blocks: InteractionBlock[] | undefined,
  theme: Theme,
  policy?: ExternalEmbedPolicy
): string => {
  const rendered = renderInteractionBlocks(blocks, theme, policy);
  return rendered ? `${bodyHtml}\n${rendered}` : bodyHtml;
};

export const describePatternTier = (pattern: InteractionPatternDef): string =>
  pattern.tier === "iframe"
    ? "External embed — renders its native fallback until an external host is configured"
    : pattern.tier === "canvas-native"
      ? "Canvas quiz / LTI companion"
      : "Native Canvas HTML";
