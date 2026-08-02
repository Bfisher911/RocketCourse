// ============================================================================
// Canvas HTML safety — single source of truth
// ----------------------------------------------------------------------------
// Canvas runs every imported page, assignment, discussion, and quiz body through a
// strict allowlist sanitizer. Anything matched by UNSAFE_HTML_RULES is either active
// content that is a security risk (scripts, event handlers, javascript:/vbscript:/
// data:text/html URLs, frames, embedded objects, form controls) or markup Canvas
// silently strips on import (<style>, <link>, <meta>, <base>) — which loses the
// instructor's styling or intent without warning.
//
// This module is the ONE place that defines "unsafe Canvas HTML". Every builder's
// validator (page, assignment, discussion, quiz), the readiness report, and the
// .imscc export validator import from here, and `sanitizeHtmlForPreview` mirrors the
// same rules so the editor preview matches what Canvas actually renders after import.
//
// Inline `style=` attributes are deliberately NOT flagged — Canvas keeps them and the
// generated shell uses them throughout. The rules match `<style` blocks, never the
// `style=` attribute (there is no `<style` substring in `<div style="…">`).
// ============================================================================

// Each rule names the exact Canvas-hostile construct so editors and validators can show
// a specific, actionable reason instead of a generic "unsafe HTML". The `<\s*tag[\s/>]`
// shape also catches whitespace-padded evasions like `< script >` and self-closing forms.
export const UNSAFE_HTML_RULES: Array<{ test: RegExp; label: string }> = [
  { test: /<\s*script[\s/>]/i, label: "script tags" },
  { test: /\son[a-z]+\s*=/i, label: "inline event handlers" },
  { test: /(?:javascript|vbscript)\s*:/i, label: "javascript:/vbscript: URLs" },
  { test: /data:\s*text\/html/i, label: "data:text/html URLs" },
  { test: /<\s*style[\s/>]/i, label: "style blocks (Canvas strips these)" },
  { test: /<\s*link[\s/>]/i, label: "link elements (Canvas strips these)" },
  { test: /<\s*meta[\s/>]/i, label: "meta elements" },
  { test: /<\s*base[\s/>]/i, label: "base elements" },
  { test: /<\s*(?:iframe|frame|frameset)[\s/>]/i, label: "frames" },
  { test: /<\s*(?:object|embed|applet)[\s/>]/i, label: "embedded objects" },
  { test: /<\s*(?:form|input|button|textarea|select)[\s/>]/i, label: "form controls" },
  { test: /<\s*marquee[\s/>]/i, label: "marquee elements" }
];

// The distinct Canvas-hostile constructs present in an HTML fragment, named for editors and
// validators. An empty array means the HTML is safe to import.
export const unsafeHtmlReasons = (html: string): string[] =>
  UNSAFE_HTML_RULES.filter((rule) => rule.test.test(html)).map((rule) => rule.label);

export const hasUnsafeHtml = (html: string): boolean => UNSAFE_HTML_RULES.some((rule) => rule.test.test(html));

export const hrefsFromHtml = (html: string): string[] => Array.from(html.matchAll(/href\s*=\s*["']([^"']*)["']/gi)).map((match) => match[1].trim());

export const malformedLinksFromHtml = (html: string): string[] =>
  hrefsFromHtml(html).filter((href) => {
    if (!href || href === "#") return false;
    if (/[\u0000-\u001f<>]/.test(href)) return true;
    if (/^www\./i.test(href)) return true;
    if (/^https?:\/(?!\/)/i.test(href)) return true;
    if (/^mailto:\s*$/i.test(href)) return true;
    if (/^tel:\s*$/i.test(href)) return true;
    return false;
  });

export const imageTagsMissingAltCount = (html: string): number =>
  Array.from(html.matchAll(/<img\b[^>]*>/gi)).filter((match) => {
    const tag = match[0];
    const alt = tag.match(/\salt\s*=\s*(["'])(.*?)\1/i);
    if (!alt) return true;
    const value = alt[2].trim();
    if (value) return false;
    return !/(role\s*=\s*["']?(presentation|none)|aria-hidden\s*=\s*["']?true)/i.test(tag);
  }).length;

export const headingOrderIssues = (html: string): string[] => {
  const levels = Array.from(html.matchAll(/<h([1-6])\b[^>]*>/gi)).map((match) => Number(match[1]));
  const issues: string[] = [];
  let previous = 0;
  levels.forEach((level, index) => {
    if (index === 0 && level > 1) issues.push(`First heading is h${level}, not h1.`);
    if (previous && level > previous + 1) issues.push(`Heading jumps from h${previous} to h${level}.`);
    previous = level;
  });
  return issues;
};

export interface HtmlSafetyIssue {
  id: string;
  label: string;
  detail: string;
}

export const htmlSafetyIssues = (html: string): HtmlSafetyIssue[] => {
  const issues: HtmlSafetyIssue[] = unsafeHtmlReasons(html).map((reason) => ({
    id: `unsafe-${reason.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
    label: "Canvas-hostile HTML",
    detail: reason
  }));
  malformedLinksFromHtml(html).forEach((href, index) => {
    issues.push({ id: `malformed-link-${index + 1}`, label: "Malformed link", detail: href });
  });
  const missingAlt = imageTagsMissingAltCount(html);
  if (missingAlt > 0) issues.push({ id: "missing-image-alt", label: "Image alt text missing", detail: `${missingAlt} image(s) need alt text or decorative marking.` });
  const headingIssues = headingOrderIssues(html);
  headingIssues.forEach((detail, index) => {
    issues.push({ id: `heading-order-${index + 1}`, label: "Heading order issue", detail });
  });
  return issues;
};

// A ready-to-show validation detail naming the exact unsafe constructs found, or null when the
// HTML is safe. `subject` is the thing being described, e.g. "page", "assignment", "question".
export const unsafeHtmlDetail = (html: string, subject: string): string | null => {
  const reasons = unsafeHtmlReasons(html);
  return reasons.length > 0 ? `Remove ${reasons.join(", ")} so Canvas keeps the ${subject} intact and safe.` : null;
};

// Mirror the Canvas sanitizer in the editor preview: strip active content and elements Canvas
// drops, and neutralise javascript:/vbscript:/data:text/html URLs to "#". Kept in lockstep with
// UNSAFE_HTML_RULES so what the instructor previews is what Canvas renders after import.
export const sanitizeHtmlForPreview = (html: string): string =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
    .replace(/(href|src|action|formaction|poster|background)\s*=\s*["']\s*(?:javascript:|vbscript:|data:\s*text\/html)[^"']*["']/gi, '$1="#"')
    .replace(/<(iframe|frame|frameset|object|embed|applet|form|input|button|textarea|select|marquee)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<(iframe|frame|frameset|object|embed|applet|form|input|button|textarea|select|marquee|link|meta|base)\b[^>]*\/?>/gi, "");

// A page may carry at most one <h1> (the page-quality validator treats a second h1 as a
// blocking export error). Model-authored bodies routinely open with an h1 AND add another,
// so demote every h1 after the first to an h2 instead of blocking the download.
export const demoteExtraH1s = (html: string): string => {
  let seen = 0;
  return html.replace(/<(\/?)h1(\b[^>]*)>/gi, (match, slash: string, attrs: string) => {
    if (!slash) {
      seen += 1;
      return seen > 1 ? `<h2${attrs}>` : match;
    }
    // Close tag: pair it with the demotion decision of its opener.
    return seen > 1 ? "</h2>" : match;
  });
};

// Model-authored bodies also skip heading levels (h1 straight to h3), which the
// heading-order validator flags on every later readiness/export pass. Clamp each
// heading to at most one level below the previous one; the first heading keeps
// its level (the h1 rules above handle that separately).
export const normalizeHeadingOrder = (html: string): string => {
  let prev = 0;
  let open: { from: number; to: number } | null = null;
  return html.replace(/<(\/?)h([1-6])(\b[^>]*)>/gi, (match, slash: string, lvl: string, attrs: string) => {
    const level = Number(lvl);
    if (!slash) {
      const target = prev === 0 ? level : Math.min(level, prev + 1);
      prev = target;
      open = { from: level, to: target };
      return target === level ? match : `<h${target}${attrs}>`;
    }
    if (open && open.from === level) {
      const target = open.to;
      open = null;
      return target === level ? match : `</h${target}>`;
    }
    return match;
  });
};

// For builders whose contract is plain prose (<p> only): headings the model sneaks in are
// flattened to bold paragraphs so appended fragments never introduce heading-order or
// duplicate-h1 export errors on the page they land in.
export const flattenHeadingsToParagraphs = (html: string): string =>
  html
    .replace(/<h[1-6]\b[^>]*>/gi, "<p><strong>")
    .replace(/<\/h[1-6]>/gi, "</strong></p>");

const AUTHORING_NOTE_LABEL =
  "(?:instructor (?:note|notes|edit note|review notes|facilitation tips?)|validation warnings?|model gaps?|rubric recommendations?|accessibility check)";

// Keep authoring and model-review metadata in the RocketCourse editor, never in content students
// receive. The patterns are deliberately label-based and conservative so legitimate prose that
// happens to mention an instructor is left intact.
export const stripStudentFacingAuthoringNotes = (html: string): string => {
  const labelledBlock = new RegExp(
    `<(?:p|li)\\b[^>]*>\\s*(?:<strong\\b[^>]*>)?\\s*${AUTHORING_NOTE_LABEL}\\s*:?\\s*(?:<\\/strong>)?[\\s\\S]*?<\\/(?:p|li)>`,
    "gi"
  );
  const labelledSection = new RegExp(
    `<section\\b[^>]*>[\\s\\S]*?<h[2-6]\\b[^>]*>\\s*${AUTHORING_NOTE_LABEL}\\s*<\\/h[2-6]>[\\s\\S]*?<\\/section>`,
    "gi"
  );
  return html.replace(labelledSection, "").replace(labelledBlock, "");
};

// Canvas displays its own title above wiki pages, assignments, and discussions. Demoting body H1s
// prevents duplicate page titles while preserving the document outline and all visible wording.
export const prepareStudentFacingHtmlForCanvas = (html: string, canvasProvidesTitle = true): string => {
  const clean = stripStudentFacingAuthoringNotes(html);
  return canvasProvidesTitle ? clean.replace(/<(\/?)h1(\b[^>]*)>/gi, "<$1h2$2>") : clean;
};

// An href a Canvas import can actually resolve: absolute web/mail/tel links, in-page anchors,
// Canvas substitution tokens ($CANVAS_OBJECT_REFERENCE$/…, $IMS-CC-FILEBASE$/…, plus their
// URL-encoded forms), and package-relative web_resources/wiki_content paths the exporter emits.
// Everything else — model-hallucinated relative paths ("modules/module_start", "syllabus",
// "calendar") and template moustaches ("{{link_to_start_here}}") — 404s after import.
const RESOLVABLE_HREF =
  /^(?:https?:\/\/|mailto:|tel:|#|\$[A-Z][A-Z0-9_.-]*\$|%24[A-Z][A-Z0-9_.-]*%24|(?:\.\.\/)?web_resources\/|wiki_content\/)/i;

// Drop href attributes Canvas cannot resolve; the anchor text is kept so no words are lost.
export const stripUnresolvableHrefs = (html: string): string =>
  html.replace(/\shref\s*=\s*(["'])([^"']*)\1/gi, (match, _quote: string, href: string) =>
    RESOLVABLE_HREF.test(href.trim()) && !href.includes("{{") ? match : ""
  );

// Make model-authored HTML safe to STORE and EXPORT (not just preview). On top of the Canvas
// sanitizer it drops placeholder/empty/"#" hrefs, which the .imscc export validator treats as
// blocking "placeholder or unsafe link" errors, and any href a Canvas import can't resolve
// (hallucinated relative paths, moustache tokens). The anchor text stays; only the dead href
// attribute is removed. Apply to every AI builder that returns HTML.
export const sanitizeAiHtml = (html: string): string =>
  stripStudentFacingAuthoringNotes(normalizeHeadingOrder(demoteExtraH1s(
    stripUnresolvableHrefs(
      sanitizeHtmlForPreview(html).replace(/\shref\s*=\s*(["'])\s*(?:#[^"']*)?\1/gi, "")
    )
  )));
