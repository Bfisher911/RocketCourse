import { slugify, stripHtml } from "../utils/text";
import { CALENDAR_HREF, PRINTABLE_HTML_HREF, PRINTABLE_PDF_HREF } from "./syllabusTemplates";

export type SyllabusCheckStatus = "pass" | "warn" | "fail";

export interface SyllabusCheck {
  id: string;
  label: string;
  status: SyllabusCheckStatus;
  detail: string;
  severity: "required" | "recommended";
}

export interface SyllabusValidationResult {
  score: number;
  checks: SyllabusCheck[];
  failures: number;
  warnings: number;
}

export interface SyllabusValidationOptions {
  knownTargets?: Set<string>;
  includeContactHours?: boolean;
}

interface Anchor {
  href: string;
  text: string;
}

const attrValue = (attrs: string, name: string): string => {
  const match = attrs.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match ? match[1].trim() : "";
};

const anchorsFrom = (html: string): Anchor[] =>
  Array.from(html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)).map((match) => ({
    href: attrValue(match[1], "href"),
    text: stripHtml(match[2]).replace(/\s+/g, " ").trim()
  }));

const imagesFrom = (html: string): string[] => Array.from(html.matchAll(/<img\b[^>]*>/gi)).map((match) => match[0]);

const headingLevels = (html: string): number[] => Array.from(html.matchAll(/<h([1-6])\b/gi)).map((match) => Number(match[1]));
const unsafeEventHandler = (html: string): string | null => {
  for (const match of html.matchAll(/<[a-z][^>]*\son[a-z]+\s*=\s*["']?/gi)) {
    const handler = match[0].match(/\son[a-z]+\s*=\s*["']?/i);
    if (handler) return handler[0].trim();
  }
  return null;
};

const hasText = (html: string, pattern: RegExp): boolean => pattern.test(stripHtml(html));
const hasHeading = (html: string, pattern: RegExp): boolean => new RegExp(`<h[1-6][^>]*>[^<]*${pattern.source}`, "i").test(html);
const isPlaceholderHref = (href: string): boolean => href === "" || href === "#" || /^javascript:/i.test(href) || href.includes("TODO_LINK");
const vagueLinkText = /^(click here|here|read more|read|more|link|this|go|continue|learn more)$/i;

const check = (id: string, label: string, status: SyllabusCheckStatus, detail: string, severity: "required" | "recommended" = "required"): SyllabusCheck => ({
  id,
  label,
  status,
  detail,
  severity
});

const hasSection = (html: string, id: string, label: string, pattern: RegExp, why: string): SyllabusCheck =>
  check(id, label, hasHeading(html, pattern) || hasText(html, pattern) ? "pass" : "fail", hasHeading(html, pattern) || hasText(html, pattern) ? `${label} is present.` : why);

export const validateSyllabus = (html: string, options: SyllabusValidationOptions = {}): SyllabusValidationResult => {
  const anchors = anchorsFrom(html);
  const hrefs = anchors.map((anchor) => anchor.href);
  const images = imagesFrom(html);
  const levels = headingLevels(html);
  const checks: SyllabusCheck[] = [];

  const h1Count = levels.filter((level) => level === 1).length;
  checks.push(check("single-h1", "One clear H1", h1Count === 1 ? "pass" : "fail", h1Count === 1 ? "The syllabus has one main title." : `${h1Count} H1 headings found; keep exactly one.`));

  let headingJump: string | null = null;
  for (let index = 1; index < levels.length; index += 1) {
    if (levels[index] - levels[index - 1] > 1) {
      headingJump = `h${levels[index - 1]} to h${levels[index]}`;
      break;
    }
  }
  checks.push(check("heading-order", "Heading order is reasonable", headingJump ? "warn" : "pass", headingJump ? `Heading order jumps from ${headingJump}.` : "Headings do not skip levels.", "recommended"));

  checks.push(hasSection(html, "description", "Course description", /course description/i, "Add a short course description so students understand the purpose."));
  checks.push(hasSection(html, "outcomes", "Learning outcomes", /(learning outcomes|course outcomes|outcomes)/i, "Add measurable learning outcomes."));
  checks.push(hasSection(html, "grading", "Grading structure", /(grading|gradebook|breakdown)/i, "Add grading categories or point/percentage structure."));
  checks.push(hasSection(html, "assignments", "Assignment overview", /(assignment overview|assignments|deliverables)/i, "Add an overview of major assignments and expectations."));
  checks.push(hasSection(html, "schedule", "Schedule or pacing", /(weekly schedule|schedule|pacing|calendar)/i, "Add weekly schedule or pacing information."));
  checks.push(hasSection(html, "communication", "Communication expectations", /(communication|announcements|office hours|contact)/i, "Add communication and response-time expectations."));
  checks.push(hasSection(html, "late-work", "Late work policy", /(late work|deadline|extension)/i, "Add local late work or extension policy placeholder."));
  checks.push(hasSection(html, "academic-integrity", "Academic integrity policy", /(academic integrity|original work|plagiarism)/i, "Add academic integrity policy or placeholder."));
  checks.push(hasSection(html, "ai-use", "AI use policy", /\bAI use\b|artificial intelligence|AI-use/i, "Add an editable AI-use policy."));
  checks.push(hasSection(html, "accessibility", "Accessibility or accommodations", /(accessibility|accommodations|assistive technology)/i, "Add accessibility/accommodations guidance."));
  checks.push(hasSection(html, "support", "Support resources", /(support resources|student support|canvas help|library|tutoring)/i, "Add student support resources."));
  if (options.includeContactHours !== false) {
    checks.push(hasSection(html, "workload", "Workload/contact hours", /(workload|contact hours|credit hours)/i, "Add workload and contact-hour expectations."));
  }

  const unsafeTag = /<\s*(script|iframe|object|embed|form|style|link|meta|base|applet|frame|frameset)[\s>/]/i.exec(html);
  checks.push(check("no-scripts", "No scripts or unsafe elements", unsafeTag ? "fail" : "pass", unsafeTag ? `Found <${unsafeTag[1].toLowerCase()}>, which Canvas strips on import.` : "No script, iframe, form, style, or unsafe structural element."));

  const handler = unsafeEventHandler(html);
  checks.push(check("no-event-handlers", "No inline event handlers", handler ? "fail" : "pass", handler ? `Inline handler "${handler}" will be stripped by Canvas.` : "No onclick/onload/onerror style attributes."));

  const jsLink = hrefs.find((href) => /^javascript:/i.test(href));
  checks.push(check("no-js-links", "No javascript links", jsLink ? "fail" : "pass", jsLink ? `Link uses ${jsLink}.` : "No javascript: URLs."));

  const placeholders = anchors.filter((anchor) => isPlaceholderHref(anchor.href));
  checks.push(check("no-empty-links", "No empty or placeholder links", placeholders.length ? "fail" : "pass", placeholders.length ? `${placeholders.length} link(s) need real targets.` : "Every link has a usable target."));

  const missingAlt = images.filter((img) => {
    const alt = img.match(/\salt\s*=\s*["']([^"']*)["']/i);
    return !alt || alt[1].trim().length === 0;
  });
  checks.push(check("image-alt", "Images have alt text", missingAlt.length ? "fail" : "pass", images.length === 0 ? "No images in this syllabus." : missingAlt.length ? `${missingAlt.length} image(s) are missing alt text.` : `All ${images.length} image(s) include alt text.`));

  const vague = anchors.filter((anchor) => anchor.text.length === 0 || vagueLinkText.test(anchor.text));
  checks.push(check("link-text", "Link text is meaningful", vague.length ? "warn" : "pass", vague.length ? `${vague.length} link(s) use vague text such as "${vague[0].text || "(no text)"}".` : "Links describe where they go.", "recommended"));

  const printableLinks = hrefs.filter((href) => href.includes("syllabus-printable"));
  const printableTargets = new Set([PRINTABLE_HTML_HREF, PRINTABLE_PDF_HREF, "web_resources/syllabus-printable.html", "web_resources/syllabus-printable.pdf", "syllabus-printable.html", "syllabus-printable.pdf"]);
  const printableValid = printableLinks.some((href) => printableTargets.has(href) || options.knownTargets?.has(href));
  checks.push(
    check(
      "printable-link",
      "Printable copy link works",
      printableValid ? "pass" : "warn",
      printableValid ? "The syllabus links to an exported print-friendly copy." : "No resolvable printable syllabus link found; label print workflow as unavailable or add one.",
      "recommended"
    )
  );

  if (options.knownTargets) {
    const normalize = (href: string): string => href.replace(/^\.\//, "");
    const internal = hrefs
      .filter((href) => !isPlaceholderHref(href))
      .filter((href) => !/^https?:\/\//i.test(href) && !/^mailto:/i.test(href) && !href.startsWith("#"));
    const unresolved = internal.filter((href) => !options.knownTargets!.has(normalize(href)) && !options.knownTargets!.has(slugify(normalize(href))));
    checks.push(check("internal-links", "Internal links resolve in export", unresolved.length ? "warn" : "pass", unresolved.length ? `${unresolved.length} internal link(s) may not resolve: ${unresolved.slice(0, 3).join(", ")}.` : "Internal links match exported page or asset files.", "recommended"));
  }

  const totalWeight = checks.reduce((sum, item) => sum + (item.severity === "required" ? 10 : 6), 0);
  const earnedWeight = checks.reduce((sum, item) => sum + (item.status === "pass" ? (item.severity === "required" ? 10 : 6) : 0), 0);
  const failures = checks.filter((item) => item.status === "fail").length;
  const warnings = checks.filter((item) => item.status === "warn").length;

  return {
    score: Math.round((earnedWeight / totalWeight) * 100),
    checks,
    failures,
    warnings
  };
};
