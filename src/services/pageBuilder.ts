import type { CourseModule, CoursePage, CourseProject, ModuleItem, ModuleItemType, ObjectMetadata, PublishState } from "../types";
import { nowIso, slugify, stripHtml } from "../utils/text";
import { canvasRefTargets } from "./canvasLinks";
import { sanitizeHtmlForPreview, unsafeHtmlDetail } from "./htmlSafety";
import { buildVisualBlockHtml, type VisualBlockId } from "./visualBlocks";

// Canvas HTML safety is defined once in htmlSafety.ts and shared by every builder, the readiness
// report, and the export validator. Re-exported here so existing page imports keep working.
export { unsafeHtmlReasons } from "./htmlSafety";

export type PageTemplateId =
  | "module-overview"
  | "lecture-notes"
  | "recap"
  | "reading-guide"
  | "activity-instructions"
  | "student-support"
  | "instructor-planning"
  | "resource-list";

export type PageIssueSeverity = "error" | "warning";
export type PagePlanStatus = "Ready" | "Needs review";
export type PageRole = "Homepage" | "Syllabus" | "Instructor-only" | "Module page" | "Standalone page";

export interface PageTemplate {
  id: PageTemplateId;
  name: string;
  description: string;
  recommendedPublishState?: PublishState;
}

export interface PageIssue {
  id: string;
  pageId: string;
  severity: PageIssueSeverity;
  title: string;
  detail: string;
}

export interface PageSummary {
  pageId: string;
  role: PageRole;
  wordCount: number;
  readingMinutes: number;
  issues: PageIssue[];
  status: PagePlanStatus;
}

export interface PagePlanValidation {
  score: number;
  status: PagePlanStatus;
  issues: PageIssue[];
  summaries: PageSummary[];
}

export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    id: "module-overview",
    name: "Module Overview",
    description: "Introduces a module path, objectives, workload, activities, and next steps.",
    recommendedPublishState: "published"
  },
  {
    id: "lecture-notes",
    name: "Lecture Notes",
    description: "Canvas-friendly mini-lecture with concepts, examples, misconception checks, and review prompts.",
    recommendedPublishState: "published"
  },
  {
    id: "recap",
    name: "Recap Page",
    description: "Closes a module with synthesis, reflection, check-for-understanding, and next-module bridge.",
    recommendedPublishState: "published"
  },
  {
    id: "reading-guide",
    name: "Reading Guide",
    description: "Helps students prepare, annotate, and use readings or media without fabricated source links.",
    recommendedPublishState: "published"
  },
  {
    id: "activity-instructions",
    name: "Activity Instructions",
    description: "Clear steps, deliverables, timing, success markers, and accessibility notes for practice work.",
    recommendedPublishState: "published"
  },
  {
    id: "student-support",
    name: "Student Support",
    description: "Support channels, help-seeking guidance, technology expectations, and accommodation reminders.",
    recommendedPublishState: "published"
  },
  {
    id: "instructor-planning",
    name: "Instructor-Only Planning",
    description: "Private planning page for publish checks, facilitation notes, risks, and local policy reminders.",
    recommendedPublishState: "unpublished"
  },
  {
    id: "resource-list",
    name: "Resource List",
    description: "Organizes verified resources, replacement notes, accessibility checks, and student use guidance.",
    recommendedPublishState: "published"
  }
];

const REQUIRED_SLUGS = new Set(["syllabus", "course-success-guide", "instructor-guide"]);

const escapeHtml = (value: string | number | undefined | null): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const paragraph = (value: string): string => `<p>${escapeHtml(value)}</p>`;

const list = (items: string[]): string => `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;

const section = (title: string, body: string): string => `<h2>${escapeHtml(title)}</h2>${body}`;

const touchedMetadata = (metadata: ObjectMetadata | undefined, timestamp: string): ObjectMetadata => ({
  createdAt: metadata?.createdAt ?? timestamp,
  updatedAt: timestamp,
  lastExportedAt: metadata?.lastExportedAt,
  exportVersion: metadata?.exportVersion ?? 0,
  source: "edited"
});

const templateById = (templateId: PageTemplateId): PageTemplate => PAGE_TEMPLATES.find((template) => template.id === templateId) ?? PAGE_TEMPLATES[0];

const uniqueValue = (base: string, existing: Set<string>): string => {
  let candidate = base;
  let index = 2;
  while (existing.has(candidate)) {
    candidate = `${base}-${index}`;
    index += 1;
  }
  existing.add(candidate);
  return candidate;
};

const renumberItems = (items: ModuleItem[]): ModuleItem[] => items.map((item, index) => ({ ...item, order: index + 1, status: "edited" }));

const defaultModule = (course: CourseProject): CourseModule | undefined =>
  course.modules.find((module) => module.kind === "content") ?? course.modules.find((module) => module.kind !== "instructor") ?? course.modules[0];

const themedShellStyle = (course: CourseProject): string =>
  `border-left: 6px solid ${escapeHtml(course.theme.accent)}; background: ${escapeHtml(course.theme.soft)}; padding: 16px 18px; margin: 16px 0;`;

const templateBodies: Record<PageTemplateId, { title: string; subtitle: string; sections: Array<[string, string]> }> = {
  "module-overview": {
    title: "Module Overview",
    subtitle: "Use this page to understand the module path before beginning work.",
    sections: [
      ["Learning Objectives", list(["Explain the core idea for this module.", "Apply one course concept to a realistic example.", "Prepare for the graded work in this module."])],
      ["What You Will Do", list(["Read the module resources.", "Study the lecture notes.", "Complete the practice or discussion activity.", "Review the rubric before submitting graded work."])],
      ["Estimated Workload", paragraph("Plan your time across reading, note-taking, practice, discussion, assessment, and reflection.")],
      ["Next Steps", list(["Open the first resource.", "Write down one question.", "Check due dates and module item order."])]
    ]
  },
  "lecture-notes": {
    title: "Lecture Notes",
    subtitle: "Canvas-friendly lesson content with examples and check-for-understanding prompts.",
    sections: [
      ["Mini-Lecture", paragraph("Introduce the concept, explain why it matters, and connect it to course outcomes using discipline-specific examples.")],
      ["Key Terms", list(["Core concept", "Evidence", "Context", "Stakeholder", "Tradeoff"])],
      ["Worked Example", paragraph("Use a concrete example that shows how students should reason with evidence rather than summarize broadly.")],
      ["Common Misconception", paragraph("Name one likely misunderstanding and explain how students can avoid it.")],
      ["Check for Understanding", list(["Define one term in your own words.", "Connect the example to the module outcome.", "Write one question you still need answered."])]
    ]
  },
  recap: {
    title: "Module Recap",
    subtitle: "Close the module with synthesis, reflection, and a bridge to what comes next.",
    sections: [
      ["What Should Be Clear Now", list(["The module's central concept.", "How evidence supports a claim.", "How this module prepares you for upcoming work."])],
      ["Reflection Prompt", paragraph("Identify one idea that changed, one skill you practiced, and one question you want to carry forward.")],
      ["Before You Move On", list(["Confirm submitted work is complete.", "Review feedback or notes.", "Preview the next module's first page."])],
      ["Next Steps", paragraph("Use this recap to prepare for the next discussion, assignment, quiz, or final project checkpoint.")]
    ]
  },
  "reading-guide": {
    title: "Reading Guide",
    subtitle: "Use this page to prepare for readings, media, and evidence-based discussion.",
    sections: [
      ["Before Reading", list(["Skim headings and key terms.", "Identify the question the source seems to answer.", "Note unfamiliar terms."])],
      ["While Reading", list(["Mark one claim.", "Find one piece of evidence.", "Write one connection to the module outcome."])],
      ["After Reading", list(["Summarize the source in two sentences.", "Name one limitation or open question.", "Bring one discussion-ready observation."])],
      ["Accessibility Note", paragraph("Instructor should verify captions, transcripts, readable PDFs, descriptive links, and accessible file formats before publishing.")]
    ]
  },
  "activity-instructions": {
    title: "Activity Instructions",
    subtitle: "A structured practice page with steps, deliverables, and success markers.",
    sections: [
      ["Purpose", paragraph("This activity helps you practice the module concept before graded work.")],
      ["What To Submit", list(["A short response, file, table, sketch, or artifact as directed.", "A brief explanation of the choices you made.", "One question or next step."])],
      ["Steps", list(["Review the prompt.", "Complete the activity.", "Check your response against the success markers.", "Submit or save the work as directed."])],
      ["Success Markers", list(["Specific example.", "Evidence or course concept used accurately.", "Clear organization.", "Accessible file or link."])]
    ]
  },
  "student-support": {
    title: "Student Support",
    subtitle: "Support routes, help-seeking guidance, and access expectations.",
    sections: [
      ["When To Ask For Help", list(["Instructions are unclear.", "Technology blocks access.", "Workload feels unmanageable.", "You need accommodations or support."])],
      ["Where To Start", list(["Check the current module overview.", "Review the assignment rubric.", "Use the instructor's preferred contact method.", "Use Canvas or campus technical support for access issues."])],
      ["Accessibility and Accommodations", paragraph("Students who need accommodations should contact the appropriate campus office and notify the instructor as local policy allows.")],
      ["Technology Support", paragraph("Use descriptive issue reports that include the page name, browser/device, what you expected, and what happened.")]
    ]
  },
  "instructor-planning": {
    title: "Instructor Planning Notes",
    subtitle: "Private planning page for facilitation, publish checks, and local customization.",
    sections: [
      ["Before Publishing", list(["Replace placeholders.", "Verify dates.", "Check links and files.", "Confirm pages are published or unpublished intentionally."])],
      ["Facilitation Notes", list(["Where students may need examples.", "Where announcements can help pacing.", "Where feedback should connect to outcomes."])],
      ["Local Policy Reminders", paragraph("Add official institutional policy language for grading, accessibility, academic integrity, AI use, and communication expectations.")],
      ["Risk Check", paragraph("Confirm this planning page remains unpublished if it includes instructor-only notes.")]
    ]
  },
  "resource-list": {
    title: "Resource List",
    subtitle: "Organize verified resources and make expectations clear for students.",
    sections: [
      ["Required Resources", list(["Instructor-verified reading or media title.", "Purpose for using the source.", "Estimated time."])],
      ["Optional Resources", paragraph("Add enrichment resources only when they are clearly marked as optional.")],
      ["How To Use These Resources", list(["Start with required items.", "Take notes on claims and evidence.", "Bring questions to discussion or office hours."])],
      ["Accessibility Check", paragraph("Confirm links are descriptive, files are accessible, videos include captions, and media alternatives are available where practical.")]
    ]
  }
};

const templateVisualBlocks: Record<PageTemplateId, VisualBlockId[]> = {
  "module-overview": ["course-journey-map", "module-mission-briefing", "module-objectives-chips", "this-week-at-a-glance"],
  "lecture-notes": ["key-terms-cards", "concept-and-example-block", "common-mistake-callout", "pause-and-think-reflection-box"],
  recap: ["prior-module-connection-card", "next-module-preview-card", "student-success-path", "stretch-goal"],
  "reading-guide": ["read-watch-do-layout", "resource-list", "before-you-begin-checklist"],
  "activity-instructions": ["try-this-now-activity-block", "process-diagram", "student-decision-point"],
  "student-support": ["need-help-support-panel", "technology-needed-block", "accessibility-and-inclusion-panel"],
  "instructor-planning": ["instructor-facilitation-notes", "announcement-bank", "course-launch-checklist"],
  "resource-list": ["resource-list", "comparison-table", "field-note-box"]
};

export const makeUniqueSlug = (value: string, course: CourseProject, currentPageId?: string): string => {
  const existing = new Set(course.pages.filter((page) => page.id !== currentPageId).map((page) => page.slug));
  return uniqueValue(slugify(value), existing);
};

const looksInstructorOnlyPage = (page: CoursePage): boolean =>
  /instructor|before-publishing|human-review|alignment-map|outcome-and-assessment/i.test(`${page.slug} ${page.title}`);

export const pageRole = (page: CoursePage): PageRole => {
  if (page.frontPage) return "Homepage";
  if (page.slug === "syllabus") return "Syllabus";
  if (page.publishState === "unpublished" || looksInstructorOnlyPage(page)) return "Instructor-only";
  if (page.moduleId) return "Module page";
  return "Standalone page";
};

export const isRequiredPage = (page: CoursePage): boolean => Boolean(page.frontPage || REQUIRED_SLUGS.has(page.slug));

export const pageWordCount = (html: string): number => stripHtml(html).split(/\s+/).filter(Boolean).length;

export const buildPageTemplateHtml = (templateId: PageTemplateId, course: CourseProject, page?: CoursePage): string => {
  const template = templateById(templateId);
  const body = templateBodies[template.id];
  const moduleTitle = page?.moduleId ? course.modules.find((module) => module.id === page.moduleId)?.title : undefined;
  const visualBlocks = templateVisualBlocks[template.id].map((blockId) => buildVisualBlockHtml(blockId, { course, page })).join("\n");
  return [
    `<div style="${themedShellStyle(course)}"><h1 style="margin: 0 0 8px;">${escapeHtml(page?.title || body.title)}</h1>${paragraph(body.subtitle)}${moduleTitle ? paragraph(`Module: ${moduleTitle}`) : ""}</div>`,
    ...body.sections.map(([title, content]) => section(title, content)),
    visualBlocks
  ].join("\n");
};

const headingsFrom = (html: string): number[] =>
  Array.from(html.matchAll(/<h([1-6])\b[^>]*>/gi)).map((match) => Number(match[1]));

const hrefsFrom = (html: string): string[] => Array.from(html.matchAll(/href\s*=\s*["']([^"']*)["']/gi)).map((match) => match[1].trim());

const anchorTextsFrom = (html: string): string[] =>
  Array.from(html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)).map((match) => stripHtml(match[1]).trim().toLowerCase());

const imageTagsMissingAlt = (html: string): number =>
  Array.from(html.matchAll(/<img\b[^>]*>/gi)).filter((match) => !/\salt\s*=/i.test(match[0])).length;

// A truly empty heading (no text and no child content) gives screen-reader users a navigation
// landmark that announces nothing. Headings whose only child is an image with alt text are not
// matched, so this never punishes a legitimate image heading.
const hasEmptyHeading = (html: string): boolean =>
  /<h([1-6])\b[^>]*>(?:\s|&nbsp;|&#160;|&#xa0;)*<\/h\1>/i.test(html);

// Data tables that carry no <th> header cells (and are not explicitly marked as layout tables)
// are unreadable with a screen reader, which cannot announce which column or row a cell belongs
// to. Tables flagged role="presentation"/"none" are layout-only and exempt.
const dataTablesMissingHeaders = (html: string): number =>
  Array.from(html.matchAll(/<table\b([^>]*)>([\s\S]*?)<\/table>/gi)).filter(
    (match) => !/role\s*=\s*["']?(presentation|none)/i.test(match[1]) && !/<th[\s>]/i.test(match[2])
  ).length;

// Links that open a new tab without rel="noopener" leak the opener reference (a tabnabbing risk)
// and, for screen-reader users, give no warning that focus is about to jump to a new window.
const blankTargetLinksMissingRel = (html: string): number =>
  Array.from(html.matchAll(/<a\b[^>]*>/gi)).filter(
    (match) => /target\s*=\s*["']?_blank/i.test(match[0]) && !/rel\s*=\s*["'][^"']*noopener/i.test(match[0])
  ).length;

const knownTargetsFor = (course: CourseProject): Set<string> => {
  const targets = canvasRefTargets(course);
  course.pages.forEach((page) => {
    const slug = slugify(page.slug || page.title);
    targets.add(page.slug);
    targets.add(`${slug}.html`);
    targets.add(`wiki_content/${slug}.html`);
    if (page.assetPath) targets.add(page.assetPath);
  });
  course.fileAssets.forEach((asset) => {
    targets.add(asset.path);
    targets.add(`../${asset.path}`);
    targets.add(asset.fileName);
  });
  return targets;
};

const itemTypeForPage = (page: CoursePage): ModuleItemType => (page.slug === "syllabus" ? "syllabus" : "page");

const pageModuleItems = (course: CourseProject, page: CoursePage): Array<{ moduleId: string; item: ModuleItem }> =>
  course.modules.flatMap((module) =>
    module.items
      .filter((item) => (item.type === "page" || item.type === "syllabus") && item.refId === page.id)
      .map((item) => ({ moduleId: module.id, item }))
  );

export const validatePagePlan = (course: CourseProject): PagePlanValidation => {
  const issues: PageIssue[] = [];
  const moduleIds = new Set(course.modules.map((module) => module.id));
  const knownTargets = knownTargetsFor(course);
  const slugCounts = new Map<string, number>();
  const titleCounts = new Map<string, number>();
  const exportPathCounts = new Map<string, number>();
  course.pages.forEach((page) => {
    slugCounts.set(page.slug, (slugCounts.get(page.slug) ?? 0) + 1);
    titleCounts.set(page.title.trim().toLowerCase(), (titleCounts.get(page.title.trim().toLowerCase()) ?? 0) + 1);
    const exportKey = slugify(page.slug || page.title);
    exportPathCounts.set(exportKey, (exportPathCounts.get(exportKey) ?? 0) + 1);
  });

  const add = (page: CoursePage, id: string, severity: PageIssueSeverity, title: string, detail: string): void => {
    issues.push({ id: `${page.id}-${id}`, pageId: page.id, severity, title, detail });
  };

  course.pages.forEach((page) => {
    const visibleText = stripHtml(page.bodyHtml);
    const headings = headingsFrom(page.bodyHtml);
    const h1Count = headings.filter((heading) => heading === 1).length;
    const moduleItems = pageModuleItems(course, page);

    if (!page.title.trim()) add(page, "title", "error", "Title missing", "Canvas pages need a clear student-facing title.");
    if (!page.slug.trim()) add(page, "slug", "error", "Slug missing", "Canvas export paths need a stable page slug.");
    if ((slugCounts.get(page.slug) ?? 0) > 1) add(page, "slug-duplicate", "error", "Slug is duplicated", "Each Canvas page slug should be unique before export.");
    else if ((exportPathCounts.get(slugify(page.slug || page.title)) ?? 0) > 1) {
      add(page, "slug-collision", "error", "Export path collides", "Two pages resolve to the same wiki_content file path, so one would overwrite the other. Give this page a distinct slug.");
    }
    if ((titleCounts.get(page.title.trim().toLowerCase()) ?? 0) > 1) add(page, "title-duplicate", "warning", "Title is duplicated", "Duplicate titles make it harder to find the right page in Canvas.");
    if (h1Count !== 1) add(page, "h1", h1Count === 0 ? "warning" : "error", "H1 needs review", h1Count === 0 ? "Add one clear H1 so the page has a student-facing heading." : "Use only one H1 and lower-level headings for sections.");
    headings.forEach((heading, index) => {
      const previous = headings[index - 1];
      if (previous && heading - previous > 1) add(page, `heading-order-${index}`, "warning", "Heading order jumps", "Avoid skipping heading levels so screen-reader navigation stays predictable.");
    });
    const unsafeDetail = unsafeHtmlDetail(page.bodyHtml, "page");
    if (unsafeDetail) add(page, "unsafe-html", "error", "Unsafe HTML", unsafeDetail);
    if (imageTagsMissingAlt(page.bodyHtml) > 0) add(page, "image-alt", "warning", "Image alt attribute missing", "Add alt text or an empty alt attribute for decorative images.");
    if (hasEmptyHeading(page.bodyHtml)) add(page, "empty-heading", "warning", "Empty heading", "Remove or fill empty headings so screen-reader navigation is not cluttered with blank landmarks.");
    if (dataTablesMissingHeaders(page.bodyHtml) > 0) add(page, "table-headers", "warning", "Table needs header cells", "Add <th> header cells (or mark the table role=\"presentation\" if it is layout-only) so the data is readable with a screen reader.");
    if (visibleText.length < 160) add(page, "substance", "warning", "Page is thin", "Add enough student-facing explanation, steps, examples, or next actions.");
    if (page.moduleId && !moduleIds.has(page.moduleId)) add(page, "module-missing", "error", "Module missing", "The page references a module that no longer exists.");
    if (page.moduleId && moduleItems.length > 0 && moduleItems.some(({ moduleId }) => moduleId !== page.moduleId)) {
      add(page, "module-mismatch", "error", "Module placement mismatch", "The page object and module item location disagree.");
    }
    if (page.moduleId && moduleItems.length === 0 && page.publishState === "published") {
      add(page, "module-item-missing", "warning", "Missing from Modules", "Published pages should usually appear in a module so students can find them.");
    }
    if (page.publishState === "unpublished" && !/instructor|planning|review|alignment|draft/i.test(`${page.title} ${page.slug}`)) {
      add(page, "draft-label", "warning", "Draft purpose unclear", "Mark draft or instructor-only pages clearly so they are not accidentally published.");
    }
    if (looksInstructorOnlyPage(page) && page.publishState === "published") {
      add(page, "instructor-published", "error", "Instructor-only page is published", "Instructor-only planning and review pages should remain unpublished.");
    }

    const weakLinks = anchorTextsFrom(page.bodyHtml).filter((text) =>
      /^(click here|click|here|link|read more|read|more|details|this|this page|this link|learn more|see here|go|continue|download)$/i.test(text)
    );
    if (weakLinks.length > 0) add(page, "link-text", "warning", "Link text is vague", "Use descriptive link text so students and screen readers know where links go.");
    if (blankTargetLinksMissingRel(page.bodyHtml) > 0) {
      add(page, "link-target", "warning", "New-tab link needs rel=\"noopener\"", "Links that open a new tab should include rel=\"noopener\" and tell students they open a new window.");
    }
    const placeholderLinks = hrefsFrom(page.bodyHtml).filter((href) => href === "" || href === "#" || href.includes("TODO_LINK"));
    if (placeholderLinks.length > 0) add(page, "placeholder-links", "warning", "Placeholder link present", "Replace empty, hash, or TODO links before export.");
    const brokenLinks = hrefsFrom(page.bodyHtml)
      .filter((href) => href !== "" && href !== "#" && !/^javascript:/i.test(href))
      .filter((href) => !/^https?:\/\//i.test(href) && !/^mailto:/i.test(href) && !href.startsWith("#"))
      .filter((href) => !knownTargets.has(href.replace(/^\.\//, "")));
    if (brokenLinks.length > 0) add(page, "broken-links", "warning", "Internal link may not resolve", `Check ${brokenLinks.slice(0, 2).join(", ")} before export.`);
  });

  const summaries = course.pages.map((page) => {
    const pageIssues = issues.filter((issue) => issue.pageId === page.id);
    const words = pageWordCount(page.bodyHtml);
    return {
      pageId: page.id,
      role: pageRole(page),
      wordCount: words,
      readingMinutes: Math.max(1, Math.ceil(words / 220)),
      issues: pageIssues,
      status: pageIssues.some((issue) => issue.severity === "error") ? "Needs review" : "Ready"
    } satisfies PageSummary;
  });

  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.filter((issue) => issue.severity === "warning").length;
  return {
    score: Math.max(0, Math.round(100 - errors * 8 - warnings * 2)),
    status: errors > 0 ? "Needs review" : "Ready",
    issues,
    summaries
  };
};

export const createPage = (
  course: CourseProject,
  options: { templateId?: PageTemplateId; pageId?: string; timestamp?: string; title?: string } = {}
): CourseProject => {
  const timestamp = options.timestamp ?? nowIso();
  const template = templateById(options.templateId ?? "module-overview");
  const module = defaultModule(course);
  const title = options.title ?? `New ${template.name}`;
  const pageId = options.pageId ?? `page_${slugify(template.id)}_${Date.now().toString(36)}`;
  const page: CoursePage = {
    id: pageId,
    title,
    slug: makeUniqueSlug(title, course),
    bodyHtml: "",
    moduleId: module?.id,
    frontPage: false,
    publishState: template.recommendedPublishState ?? "published",
    status: "edited",
    metadata: touchedMetadata(undefined, timestamp)
  };
  const completePage = { ...page, bodyHtml: buildPageTemplateHtml(template.id, course, page) };
  const item: ModuleItem | undefined = module
    ? {
        id: `item_${pageId}`,
        type: itemTypeForPage(completePage),
        title: completePage.title,
        refId: completePage.id,
        order: module.items.length + 1,
        indent: 0,
        publishState: completePage.publishState,
        status: "edited",
        metadata: touchedMetadata(undefined, timestamp)
      }
    : undefined;
  return {
    ...course,
    pages: [...course.pages, completePage],
    modules: item
      ? course.modules.map((entry) =>
          entry.id === module?.id
            ? { ...entry, expanded: true, items: renumberItems([...entry.items, item]), status: "edited", metadata: touchedMetadata(entry.metadata, timestamp) }
            : entry
        )
      : course.modules
  };
};

export const changePageModule = (course: CourseProject, pageId: string, moduleId: string | undefined, timestamp = nowIso()): CourseProject => {
  const page = course.pages.find((entry) => entry.id === pageId);
  const targetModule = moduleId ? course.modules.find((module) => module.id === moduleId) : undefined;
  if (!page || (moduleId && !targetModule)) return course;
  const existingItem = course.modules.flatMap((module) => module.items).find((item) => (item.type === "page" || item.type === "syllabus") && item.refId === pageId);
  const movedItem: ModuleItem | undefined =
    moduleId && targetModule
      ? {
          ...(existingItem ?? {
            id: `item_${pageId}`,
            type: itemTypeForPage(page),
            title: page.title,
            refId: page.id,
            order: targetModule.items.length + 1,
            indent: 0,
            publishState: page.publishState,
            status: "edited" as const,
            metadata: touchedMetadata(undefined, timestamp)
          }),
          type: itemTypeForPage(page),
          title: page.title,
          publishState: page.publishState,
          status: "edited" as const,
          metadata: touchedMetadata(existingItem?.metadata, timestamp)
        }
      : undefined;

  return {
    ...course,
    pages: course.pages.map((entry) => (entry.id === pageId ? { ...entry, moduleId, status: "edited", metadata: touchedMetadata(entry.metadata, timestamp) } : entry)),
    modules: course.modules.map((module) => {
      const withoutPage = module.items.filter((item) => !((item.type === "page" || item.type === "syllabus") && item.refId === pageId));
      if (!moduleId || module.id !== moduleId || !movedItem) return { ...module, items: renumberItems(withoutPage) };
      return { ...module, expanded: true, items: renumberItems([...withoutPage, movedItem]), status: "edited", metadata: touchedMetadata(module.metadata, timestamp) };
    }),
    schedule: course.schedule.map((entry) => (entry.itemId === pageId && moduleId ? { ...entry, moduleId } : entry))
  };
};

export const renamePageEverywhere = (course: CourseProject, pageId: string, title: string, timestamp = nowIso()): CourseProject => ({
  ...course,
  pages: course.pages.map((page) => (page.id === pageId ? { ...page, title, status: "edited", metadata: touchedMetadata(page.metadata, timestamp) } : page)),
  modules: course.modules.map((module) => ({
    ...module,
    items: module.items.map((item) =>
      (item.type === "page" || item.type === "syllabus") && item.refId === pageId ? { ...item, title, status: "edited", metadata: touchedMetadata(item.metadata, timestamp) } : item
    )
  })),
  schedule: course.schedule.map((entry) => (entry.itemId === pageId ? { ...entry, title } : entry))
});

export const updatePageSlug = (course: CourseProject, pageId: string, slug: string, timestamp = nowIso()): CourseProject => ({
  ...course,
  pages: course.pages.map((page) => (page.id === pageId ? { ...page, slug: slugify(slug), status: "edited", metadata: touchedMetadata(page.metadata, timestamp) } : page))
});

export const duplicatePage = (course: CourseProject, pageId: string, options: { stamp?: string | number; timestamp?: string } = {}): CourseProject => {
  const page = course.pages.find((entry) => entry.id === pageId);
  if (!page) return course;
  const stamp = options.stamp ?? Date.now();
  const timestamp = options.timestamp ?? nowIso();
  const copiedPageId = uniqueValue(`${page.id}_copy_${stamp}`, new Set(course.pages.map((entry) => entry.id)));
  const copy: CoursePage = {
    ...page,
    id: copiedPageId,
    title: `${page.title} Copy`,
    slug: makeUniqueSlug(`${page.slug || page.title}-copy-${stamp}`, course),
    frontPage: false,
    assetPath: undefined,
    status: "edited",
    metadata: touchedMetadata(page.metadata, timestamp)
  };
  const module = copy.moduleId ? course.modules.find((entry) => entry.id === copy.moduleId) : undefined;
  const item: ModuleItem | undefined = module
    ? {
        id: uniqueValue(`item_${copiedPageId}`, new Set(course.modules.flatMap((entry) => entry.items.map((moduleItem) => moduleItem.id)))),
        type: "page",
        title: copy.title,
        refId: copy.id,
        order: module.items.length + 1,
        indent: 0,
        publishState: copy.publishState,
        status: "edited",
        metadata: touchedMetadata(undefined, timestamp)
      }
    : undefined;
  return {
    ...course,
    pages: [...course.pages, copy],
    modules: item
      ? course.modules.map((entry) =>
          entry.id === module?.id ? { ...entry, expanded: true, items: renumberItems([...entry.items, item]), status: "edited", metadata: touchedMetadata(entry.metadata, timestamp) } : entry
        )
      : course.modules
  };
};

export const deletePage = (course: CourseProject, pageId: string, allowRequired = false): CourseProject => {
  const page = course.pages.find((entry) => entry.id === pageId);
  if (!page || (isRequiredPage(page) && !allowRequired)) return course;
  return {
    ...course,
    pages: course.pages.filter((entry) => entry.id !== pageId),
    modules: course.modules.map((module) => ({
      ...module,
      items: renumberItems(module.items.filter((item) => !((item.type === "page" || item.type === "syllabus") && item.refId === pageId)))
    })),
    schedule: course.schedule.filter((entry) => entry.itemId !== pageId)
  };
};

export const restorePage = (course: CourseProject, page: CoursePage, timestamp = nowIso()): CourseProject => {
  const restored = { ...page, status: "edited" as const, metadata: touchedMetadata(page.metadata, timestamp) };
  const withPage = course.pages.some((entry) => entry.id === page.id)
    ? { ...course, pages: course.pages.map((entry) => (entry.id === page.id ? restored : entry)) }
    : { ...course, pages: [...course.pages, restored] };
  return changePageModule(withPage, page.id, page.moduleId, timestamp);
};

// Shared Canvas preview sanitizer (defined in htmlSafety.ts). Aliased under the page-specific
// name so existing PagesTab and test imports keep working.
export const sanitizePageHtmlForPreview = sanitizeHtmlForPreview;
