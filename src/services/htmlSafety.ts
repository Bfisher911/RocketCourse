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
