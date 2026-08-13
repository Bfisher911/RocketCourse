import { contrastRatio, parseHex, type Rgb } from "../utils/color";
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

// Whether Canvas can actually follow this href after import. Empty, "#", and moustache tokens are
// dead on arrival, as are model-hallucinated relative paths.
const isResolvableHref = (href: string): boolean => {
  const value = href.trim();
  if (!value || value === "#") return false;
  if (value.includes("{{")) return false;
  return RESOLVABLE_HREF.test(value);
};

// Anchors Canvas cannot follow: no href, an empty/"#"/moustache href, or a hallucinated relative
// path. Removing only the href attribute would leave an <a> that still carries the model's button
// styling — it looks clickable, highlights on hover, and does nothing. That is worse for a student
// than plain text, and it hides the defect from `malformedLinksFromHtml`/the placeholder-links
// readiness check, both of which only inspect hrefs that exist. So unwrap the whole element: the
// words survive, the fake affordance does not.
export const unwrapDeadAnchors = (html: string): string =>
  // Anchors cannot nest, so a non-greedy pair match is exact.
  html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (match, attrs: string, inner: string) => {
    const href = attrs.match(/\shref\s*=\s*(["'])([^"']*)\1/i);
    return href && isResolvableHref(href[2]) ? match : inner;
  });

// Anchors a student can see but not click. Zero is the only acceptable value in exported content.
export const deadAnchorCount = (html: string): number =>
  Array.from(html.matchAll(/<a\b([^>]*)>/gi)).filter((match) => {
    const href = match[1].match(/\shref\s*=\s*(["'])([^"']*)\1/i);
    return !href || !isResolvableHref(href[2]);
  }).length;

// Make model-authored HTML safe to STORE and EXPORT (not just preview). On top of the Canvas
// sanitizer it unwraps every anchor Canvas cannot follow — placeholder/empty/"#" hrefs, which the
// .imscc export validator treats as blocking "placeholder or unsafe link" errors, hallucinated
// relative paths, moustache tokens, and anchors the model emitted with no href at all. The words
// stay; the un-followable link element does not. Apply to every AI builder that returns HTML.
export const sanitizeAiHtml = (html: string): string =>
  stripStudentFacingAuthoringNotes(normalizeHeadingOrder(demoteExtraH1s(
    unwrapDeadAnchors(sanitizeHtmlForPreview(html))
  )));

// ============================================================================
// Inline-style contrast
// ----------------------------------------------------------------------------
// The theme's own palette is contrast-checked at generation time, but nothing checked the colours
// that land inside generated or model-authored HTML. A Tulane export shipped announcement buttons
// at #ffffff on #4caf50 (2.78:1) and #ffffff on #ff9800 (2.16:1) — both far below AA — because the
// model invented its own palette and announcements were outside every gate.
//
// Course HTML is styled entirely with inline `style=` attributes and carries no stylesheet, so a
// tag-stack walk reproduces the browser's computed values closely enough to gate on: text colour
// and background each come from the nearest ancestor that sets them.
// ============================================================================

export interface ContrastIssue {
  foreground: string;
  background: string;
  ratio: number;
  required: number;
  sample: string;
}

const VOID_ELEMENTS = new Set(["img", "br", "hr", "input", "meta", "link", "source", "area", "col", "embed", "track", "wbr"]);

const declarations = (style: string): Record<string, string> => {
  const out: Record<string, string> = {};
  style.split(";").forEach((part) => {
    const index = part.indexOf(":");
    if (index > 0) out[part.slice(0, index).trim().toLowerCase()] = part.slice(index + 1).trim();
  });
  return out;
};

// CSS named colours the models actually reach for. `color: white` on a coloured button is the single
// most common shape in model-authored HTML, and treating it as unparseable silently inherited the
// ancestor's colour and hid the very failures this scanner exists to catch.
const NAMED_COLORS: Record<string, string> = {
  white: "#ffffff", black: "#000000", red: "#ff0000", green: "#008000", blue: "#0000ff",
  yellow: "#ffff00", orange: "#ffa500", purple: "#800080", gray: "#808080", grey: "#808080",
  silver: "#c0c0c0", navy: "#000080", teal: "#008080", maroon: "#800000", lime: "#00ff00",
  olive: "#808000", aqua: "#00ffff", cyan: "#00ffff", fuchsia: "#ff00ff", magenta: "#ff00ff"
};

// A colour token plus its alpha. Translucent values are composited over what is behind them rather
// than discarded: `rgba(255,255,255,0.7)` on a dark panel renders as a real, measurable grey, and
// treating it as unreadable made the scanner fall back to an ancestor's colour and report a pair
// that never appears on screen.
const readColor = (value: string): { rgb: Rgb; alpha: number } | null => {
  const named = NAMED_COLORS[value.trim().toLowerCase()];
  const source = named ?? value;
  const match = source.match(/#[0-9a-fA-F]{3,6}|rgba?\([^)]*\)/);
  if (!match) {
    const word = source.toLowerCase().match(/\b(white|black|red|green|blue|yellow|orange|purple|gray|grey|silver|navy|teal|maroon|lime|olive|aqua|cyan|fuchsia|magenta)\b/);
    if (!word) return null;
    const rgb = parseHex(NAMED_COLORS[word[1]]);
    return rgb ? { rgb, alpha: 1 } : null;
  }
  const token = match[0];
  if (token.startsWith("#")) {
    const rgb = parseHex(token);
    return rgb ? { rgb, alpha: 1 } : null;
  }
  const parts = token.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)\s*(?:[,/]\s*([\d.]+)\s*)?\)/);
  if (!parts) return null;
  return {
    rgb: { r: Number(parts[1]), g: Number(parts[2]), b: Number(parts[3]) },
    alpha: parts[4] === undefined ? 1 : Number(parts[4])
  };
};

// Source-over compositing: what the eye actually sees when `layer` sits on `base`.
const composite = (layer: { rgb: Rgb; alpha: number }, base: Rgb): Rgb => ({
  r: Math.round(layer.rgb.r * layer.alpha + base.r * (1 - layer.alpha)),
  g: Math.round(layer.rgb.g * layer.alpha + base.g * (1 - layer.alpha)),
  b: Math.round(layer.rgb.b * layer.alpha + base.b * (1 - layer.alpha))
});

const toHex = ({ r, g, b }: Rgb): string => `#${[r, g, b].map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, "0")).join("")}`;

interface Frame { color: Rgb; background: Rgb; size: number; bold: boolean }

/** Inline colour pairs that fail WCAG 2.1 AA, one entry per distinct pair. */
export const contrastIssuesFromHtml = (html: string, pageBackground = "#ffffff"): ContrastIssue[] => {
  const issues: ContrastIssue[] = [];
  const seen = new Set<string>();
  const base = parseHex(pageBackground) ?? { r: 255, g: 255, b: 255 };
  const stack: Frame[] = [{ color: parseHex("#2b2d30")!, background: base, size: 16, bold: false }];

  const pattern = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>|([^<]+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const [full, tag, attrs, text] = match;

    if (text !== undefined) {
      const content = text.replace(/&[a-z#0-9]+;/gi, " ").trim();
      if (content.length < 3) continue;
      const top = stack[stack.length - 1];
      const large = top.size >= 24 || (top.size >= 18.66 && top.bold);
      const required = large ? 3 : 4.5;
      const foreground = toHex(top.color);
      const background = toHex(top.background);
      const ratio = contrastRatio(foreground, background);
      const key = `${foreground}|${background}|${large}`;
      if (ratio < required && !seen.has(key)) {
        seen.add(key);
        issues.push({ foreground, background, ratio: Math.round(ratio * 100) / 100, required, sample: content.slice(0, 60) });
      }
      continue;
    }

    const lower = tag.toLowerCase();
    if (full.startsWith("</")) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    if (VOID_ELEMENTS.has(lower) || full.endsWith("/>")) continue;

    const parent = stack[stack.length - 1];
    const style = declarations((attrs.match(/style\s*=\s*"([^"]*)"/i)?.[1] ?? ""));
    const size = Number(style["font-size"]?.match(/([\d.]+)px/)?.[1]) || parent.size;
    const weight = style["font-weight"];
    const backgroundLayer = readColor(style["background-color"] ?? "") ?? readColor(style.background ?? "");
    const background = backgroundLayer ? composite(backgroundLayer, parent.background) : parent.background;
    const colorLayer = style.color ? readColor(style.color) : null;
    stack.push({
      // Text composites over its OWN background, which is why background is resolved first.
      color: colorLayer ? composite(colorLayer, background) : parent.color,
      background,
      size,
      bold: weight ? weight === "bold" || weight === "bolder" || Number(weight) >= 700 : lower === "strong" || lower === "b" || lower === "th" || parent.bold
    });
  }
  return issues;
};
