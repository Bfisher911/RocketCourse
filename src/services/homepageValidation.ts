// ============================================================================
// Homepage safety + quality validation
// ----------------------------------------------------------------------------
// Regex-based (no DOM dependency, so it runs in plain Node tests and in the
// browser) checks that the homepage HTML is Canvas-safe, accessible, and
// structurally sound. Surfaced inline in the Homepage tab as a checklist and
// reused to compute the homepage mini-score.
// ============================================================================

import { contrastRatio } from "../utils/color";
import { BANNER_SRC, SUCCESS_GUIDE_HREF, SYLLABUS_HREF } from "./homepageTemplates";

export type HomepageCheckStatus = "pass" | "warn" | "fail";

export interface HomepageCheck {
  id: string;
  label: string;
  status: HomepageCheckStatus;
  detail: string;
  severity: "required" | "recommended";
}

export interface HomepageValidationResult {
  score: number;
  checks: HomepageCheck[];
  failures: number;
  warnings: number;
}

export interface HomepageValidationOptions {
  // Resolvable export targets (page slugs + file names). When provided, internal links are
  // verified against it; when omitted, the internal-link check is skipped (informational).
  knownTargets?: Set<string>;
}

interface Anchor {
  href: string;
  text: string;
  style: string;
}

const stripTags = (html: string): string => html.replace(/<[^>]+>/g, " ");

const decodeBasic = (value: string): string =>
  value
    .replace(/&rarr;|&#8594;|→/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

const attrValue = (attrs: string, name: string): string => {
  const match = attrs.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match ? match[1].trim() : "";
};

const anchorsFrom = (html: string): Anchor[] =>
  Array.from(html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)).map((match) => ({
    href: attrValue(match[1], "href"),
    style: attrValue(match[1], "style"),
    text: decodeBasic(stripTags(match[2]))
  }));

const imagesFrom = (html: string): string[] => Array.from(html.matchAll(/<img\b[^>]*>/gi)).map((match) => match[0]);

const headingLevels = (html: string): number[] => Array.from(html.matchAll(/<h([1-6])\b/gi)).map((match) => Number(match[1]));

const VAGUE_LINK_TEXT = /^(click here|here|read more|read|more|link|this|go|continue|learn more)$/i;

const isPlaceholderHref = (href: string): boolean => href === "" || href === "#" || /^javascript:/i.test(href) || href.includes("TODO_LINK");

// Pull the background + color declarations out of an inline style string for a contrast estimate.
const styleColor = (style: string, property: "background" | "color"): string | null => {
  const re = property === "background" ? /background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,6})/ : /(?:^|;)\s*color\s*:\s*(#[0-9a-fA-F]{3,6})/;
  const match = style.match(re);
  return match ? match[1] : null;
};

const check = (id: string, label: string, status: HomepageCheckStatus, detail: string, severity: "required" | "recommended" = "required"): HomepageCheck => ({
  id,
  label,
  status,
  detail,
  severity
});

export const validateHomepage = (html: string, options: HomepageValidationOptions = {}): HomepageValidationResult => {
  const anchors = anchorsFrom(html);
  const images = imagesFrom(html);
  const levels = headingLevels(html);
  const hrefs = anchors.map((anchor) => anchor.href);

  const checks: HomepageCheck[] = [];

  // 1. No script / unsafe structural tags.
  const unsafeTag = /<\s*(script|iframe|object|embed|form|style|link|meta|base|applet|frame|frameset)[\s>/]/i.exec(html);
  checks.push(
    check(
      "no-scripts",
      "No scripts or unsafe elements",
      unsafeTag ? "fail" : "pass",
      unsafeTag ? `Found <${unsafeTag[1].toLowerCase()}>, which Canvas strips on import.` : "No script, iframe, form, or style elements."
    )
  );

  // 2. No inline event handlers.
  const handler = /\son[a-z]+\s*=\s*["']?/i.exec(html);
  checks.push(
    check(
      "no-event-handlers",
      "No inline event handlers",
      handler ? "fail" : "pass",
      handler ? `Inline handler "${handler[0].trim()}" will be removed by Canvas.` : "No onclick / onload / onerror style attributes."
    )
  );

  // 3. No javascript: links.
  const jsLink = hrefs.find((href) => /^javascript:/i.test(href));
  checks.push(check("no-js-links", "No javascript: links", jsLink ? "fail" : "pass", jsLink ? `Link uses ${jsLink}.` : "No javascript: URLs in links."));

  // 4. No empty / placeholder hrefs.
  const placeholders = anchors.filter((anchor) => isPlaceholderHref(anchor.href));
  checks.push(
    check(
      "no-empty-links",
      "No empty or placeholder links",
      placeholders.length ? "fail" : "pass",
      placeholders.length ? `${placeholders.length} link(s) point to "#", an empty href, or a TODO target — including "${placeholders[0].text || "(no text)"}".` : "Every link has a real destination."
    )
  );

  // 5. Every image has non-empty alt text.
  const missingAlt = images.filter((img) => {
    const alt = img.match(/\salt\s*=\s*["']([^"']*)["']/i);
    return !alt || alt[1].trim().length === 0;
  });
  checks.push(
    check(
      "image-alt",
      "Images have alt text",
      images.length === 0 ? "pass" : missingAlt.length ? "fail" : "pass",
      images.length === 0 ? "No images to describe." : missingAlt.length ? `${missingAlt.length} image(s) are missing descriptive alt text.` : `All ${images.length} image(s) include alt text.`
    )
  );

  // 6 + 7. Exactly one H1 and no skipped heading levels.
  const h1Count = levels.filter((level) => level === 1).length;
  checks.push(
    check(
      "single-h1",
      "Exactly one main heading (H1)",
      h1Count === 1 ? "pass" : "fail",
      h1Count === 1 ? "The page has a single, clear H1." : h1Count === 0 ? "No H1 found — students get no clear page title." : `${h1Count} H1 headings found; keep exactly one.`
    )
  );
  let jump: string | null = null;
  for (let i = 1; i < levels.length; i += 1) {
    if (levels[i] - levels[i - 1] > 1) {
      jump = `h${levels[i - 1]} jumps to h${levels[i]}`;
      break;
    }
  }
  checks.push(
    check(
      "heading-order",
      "Headings don't skip levels",
      jump ? "warn" : "pass",
      jump ? `Heading order ${jump}; screen-reader users lose the outline.` : "Heading levels increase one step at a time.",
      "recommended"
    )
  );

  // 8. A clear start path.
  const hasStartPath = hrefs.some((href) => href.includes(SUCCESS_GUIDE_HREF)) || /start here/i.test(stripTags(html));
  checks.push(
    check(
      "start-path",
      "Clear start path for students",
      hasStartPath ? "pass" : "fail",
      hasStartPath ? "Students are pointed to Start Here / the Course Success Guide." : "Add a Start Here button linking to the Course Success Guide."
    )
  );

  // 9. A syllabus link.
  const hasSyllabus = hrefs.some((href) => href.includes(SYLLABUS_HREF));
  checks.push(
    check(
      "syllabus-link",
      "Syllabus link present",
      hasSyllabus ? "pass" : "fail",
      hasSyllabus ? "The homepage links to the syllabus." : "Add a link or button to the syllabus."
    )
  );

  // 10. Meaningful link text.
  const vague = anchors.filter((anchor) => anchor.text.length === 0 || VAGUE_LINK_TEXT.test(anchor.text));
  checks.push(
    check(
      "link-text",
      "Link text is meaningful",
      vague.length ? "warn" : "pass",
      vague.length ? `${vague.length} link(s) use vague or empty text such as "${vague[0].text || "(no text)"}".` : "Links describe where they go.",
      "recommended"
    )
  );

  // 11. Button contrast estimate.
  const buttonAnchors = anchors.filter((anchor) => /background/i.test(anchor.style));
  const lowContrast = buttonAnchors.filter((anchor) => {
    const bg = styleColor(anchor.style, "background");
    const fg = styleColor(anchor.style, "color");
    if (!bg || !fg) return false;
    return contrastRatio(fg, bg) < 3;
  });
  checks.push(
    check(
      "contrast",
      "Buttons have readable contrast",
      lowContrast.length ? "warn" : "pass",
      lowContrast.length ? `${lowContrast.length} button(s) may not meet WCAG AA contrast for large text.` : "Button text and background contrast looks acceptable.",
      "recommended"
    )
  );

  // 12. Internal links resolve (only when targets are supplied).
  if (options.knownTargets) {
    const normalize = (href: string): string => href.replace(/^\.\//, "");
    const internal = hrefs
      .filter((href) => !isPlaceholderHref(href))
      .filter((href) => !/^https?:\/\//i.test(href) && !/^mailto:/i.test(href) && !href.startsWith("#"));
    const unresolved = internal.filter((href) => !options.knownTargets!.has(normalize(href)));
    checks.push(
      check(
        "internal-links",
        "Internal links resolve in the export",
        unresolved.length ? "warn" : "pass",
        unresolved.length ? `${unresolved.length} internal link(s) may not resolve: ${unresolved.slice(0, 3).join(", ")}.` : "Internal page links match exported Canvas files.",
        "recommended"
      )
    );
  }

  // 13. Banner image references the correct, included asset path.
  const bannerImg = images.find((img) => /course-banner\.svg/i.test(img));
  if (bannerImg) {
    const src = bannerImg.match(/\ssrc\s*=\s*["']([^"']*)["']/i)?.[1] ?? "";
    const correct = src === BANNER_SRC;
    checks.push(
      check(
        "banner-path",
        "Course banner path is correct",
        correct ? "pass" : "warn",
        correct ? "Banner references ../web_resources/course-banner.svg (the included asset)." : `Banner src "${src}" should be ${BANNER_SRC} so it resolves from wiki_content/.`,
        "recommended"
      )
    );
  }

  const requiredFailures = checks.filter((item) => item.severity === "required" && item.status === "fail").length;
  const warnings = checks.filter((item) => item.status === "warn" || (item.severity === "recommended" && item.status === "fail")).length;
  const weight = (item: HomepageCheck): number => (item.severity === "required" ? 10 : 5);
  const totalWeight = checks.reduce((sum, item) => sum + weight(item), 0);
  const earned = checks.reduce((sum, item) => sum + (item.status === "pass" ? weight(item) : item.status === "warn" ? weight(item) * 0.5 : 0), 0);

  return {
    score: totalWeight === 0 ? 100 : Math.round((earned / totalWeight) * 100),
    checks,
    failures: requiredFailures,
    warnings
  };
};
