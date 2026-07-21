// ============================================================================
// Interaction HTML validation
// ----------------------------------------------------------------------------
// Structural checks for rendered interaction HTML, layered on top of the
// project-wide Canvas policy in htmlSafety.ts (which stays the single source of
// truth for Canvas-hostile constructs). This module adds the checks the pattern
// library requires: duplicate ids, dead/placeholder links, unfinished template
// text, iframe attribute policy, and table header structure.
// ============================================================================

import {
  headingOrderIssues,
  imageTagsMissingAltCount,
  malformedLinksFromHtml,
  unsafeHtmlReasons
} from "./htmlSafety";

export interface InteractionHtmlIssue {
  id: string;
  severity: "error" | "warning";
  label: string;
  detail: string;
}

/** Text that marks an unfinished template shell — must never reach an export. */
const PLACEHOLDER_TEXT_RULES: Array<{ test: RegExp; label: string }> = [
  { test: /replace this/i, label: '"Replace this" placeholder text' },
  { test: /add text here/i, label: '"Add text here" placeholder text' },
  { test: /\bYOUR-DOMAIN\b/i, label: "YOUR-DOMAIN placeholder URL" },
  { test: /\blorem ipsum\b/i, label: "lorem ipsum filler" },
  { test: /\bConcept [AB]\b/, label: "generic Concept A/B labels" },
  { test: /\bOption [ABC]:\s*(?:Add|Replace)/i, label: "generic Option A/B/C labels" },
  { test: /\bExample [ABC]: Add\b/i, label: "generic Example A/B/C labels" }
];

const duplicateIdIssues = (html: string): string[] => {
  const seen = new Map<string, number>();
  for (const match of html.matchAll(/\sid\s*=\s*["']([^"']+)["']/gi)) {
    const id = match[1].trim();
    if (id) seen.set(id, (seen.get(id) ?? 0) + 1);
  }
  return [...seen.entries()].filter(([, count]) => count > 1).map(([id, count]) => `id "${id}" appears ${count} times`);
};

const deadLinkIssues = (html: string): string[] => {
  const dead: string[] = [];
  for (const match of html.matchAll(/<a\b[^>]*>/gi)) {
    const tag = match[0];
    const href = tag.match(/\shref\s*=\s*["']([^"']*)["']/i)?.[1]?.trim() ?? "";
    if (!href || href === "#") dead.push(tag.slice(0, 60));
  }
  return dead;
};

interface IframeAttrs {
  src: string;
  title: string;
}

const iframeIssues = (html: string, allowIframes: boolean): string[] => {
  const issues: string[] = [];
  const iframes = [...html.matchAll(/<iframe\b[^>]*>/gi)];
  if (!iframes.length) return issues;
  if (!allowIframes) {
    issues.push("iframe present but external embeds are not enabled for this workspace");
    return issues;
  }
  iframes.forEach((match, index) => {
    const tag = match[0];
    const attrs: IframeAttrs = {
      src: tag.match(/\ssrc\s*=\s*["']([^"']*)["']/i)?.[1] ?? "",
      title: tag.match(/\stitle\s*=\s*["']([^"']*)["']/i)?.[1] ?? ""
    };
    if (!/^https:\/\//i.test(attrs.src)) issues.push(`iframe ${index + 1} src must be HTTPS`);
    if (!attrs.title.trim()) issues.push(`iframe ${index + 1} is missing a descriptive title`);
  });
  // Every embed needs an open-in-new-window escape hatch next to it.
  if (!/target="_blank"/i.test(html)) issues.push("iframe embed is missing an open-in-new-window link");
  return issues;
};

const tableHeaderIssues = (html: string): string[] => {
  const issues: string[] = [];
  for (const match of html.matchAll(/<table\b[\s\S]*?<\/table>/gi)) {
    const table = match[0];
    if (!/<th\s[^>]*scope\s*=\s*["']col["']/i.test(table)) issues.push("table is missing column headers with scope");
  }
  return issues;
};

export interface ValidateInteractionHtmlOptions {
  /** True only when the workspace has enabled external iframe embeds. */
  allowIframes?: boolean;
}

/**
 * Validate one rendered interaction (or a full composed body). Errors block
 * export; warnings surface in the editor.
 */
export const validateInteractionHtml = (html: string, options: ValidateInteractionHtmlOptions = {}): InteractionHtmlIssue[] => {
  const issues: InteractionHtmlIssue[] = [];

  // Canvas-hostile constructs (scripts, handlers, frames…) from the shared policy.
  // Frames are re-checked with the local iframe policy below, so exclude them here
  // when iframes are explicitly allowed.
  for (const reason of unsafeHtmlReasons(html)) {
    if (reason === "frames" && options.allowIframes) continue;
    issues.push({ id: `unsafe-${reason.replace(/[^a-z0-9]+/gi, "-")}`, severity: "error", label: "Canvas-hostile HTML", detail: reason });
  }

  for (const rule of PLACEHOLDER_TEXT_RULES) {
    if (rule.test.test(html)) issues.push({ id: `placeholder-${rule.label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`, severity: "error", label: "Unfinished template text", detail: rule.label });
  }

  duplicateIdIssues(html).forEach((detail, index) => issues.push({ id: `dup-id-${index}`, severity: "error", label: "Duplicate element id", detail }));
  deadLinkIssues(html).forEach((detail, index) => issues.push({ id: `dead-link-${index}`, severity: "error", label: "Dead or placeholder link", detail }));
  malformedLinksFromHtml(html).forEach((href, index) => issues.push({ id: `malformed-link-${index}`, severity: "error", label: "Malformed link", detail: href }));
  iframeIssues(html, options.allowIframes ?? false).forEach((detail, index) => issues.push({ id: `iframe-${index}`, severity: "error", label: "External embed policy", detail }));

  const missingAlt = imageTagsMissingAltCount(html);
  if (missingAlt > 0) issues.push({ id: "missing-alt", severity: "error", label: "Image alt text missing", detail: `${missingAlt} image(s) need alt text or decorative marking.` });

  headingOrderIssues(html).forEach((detail, index) => {
    // Interactions render as h3 sections inside a page whose h2s come from the body;
    // an isolated fragment legitimately starts at h3, so heading order is a warning here.
    issues.push({ id: `heading-${index}`, severity: "warning", label: "Heading order", detail });
  });

  tableHeaderIssues(html).forEach((detail, index) => issues.push({ id: `table-${index}`, severity: "error", label: "Table accessibility", detail }));

  return issues;
};

export const interactionHtmlErrors = (html: string, options?: ValidateInteractionHtmlOptions): InteractionHtmlIssue[] =>
  validateInteractionHtml(html, options).filter((issue) => issue.severity === "error");
