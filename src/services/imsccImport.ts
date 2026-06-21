import JSZip from "jszip";
import { defaultSettings } from "../data/defaultSettings";
import type { Assignment, CourseModule, CoursePage, CourseProject, CourseSettings, Discussion, ModuleItem, ObjectMetadata, Quiz } from "../types";
import { slugify, stripHtml } from "../utils/text";
import { generateCourseProject } from "./courseGenerator";

export interface ImportCanvasCourseResult {
  course: CourseProject;
  notes: string[];
}

const metadata = (timestamp: string): ObjectMetadata => ({
  createdAt: timestamp,
  updatedAt: timestamp,
  exportVersion: 0,
  source: "imported"
});

const textBetween = (value: string, tag: string): string | undefined => {
  const match = value.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match?.[1]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
};

const attr = (value: string, name: string): string | undefined => value.match(new RegExp(`${name}="([^"]+)"`, "i"))?.[1];

const blocksBetween = (value: string, tag: string): Array<{ attrs: string; body: string }> =>
  Array.from(value.matchAll(new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)</${tag}>`, "gi"))).map((match) => ({
    attrs: match[1],
    body: match[2]
  }));

const manifestResourceIdsByFile = (manifest: string | undefined): Map<string, string> => {
  const map = new Map<string, string>();
  if (!manifest) return map;

  blocksBetween(manifest, "resource").forEach((resource) => {
    const identifier = attr(resource.attrs, "identifier");
    if (!identifier) return;
    const href = attr(resource.attrs, "href");
    const fileHrefs = Array.from(resource.body.matchAll(/<file\s+[^>]*href="([^"]+)"/gi)).map((match) => match[1]);
    [href, ...fileHrefs].filter(Boolean).forEach((path) => {
      if (!path) return;
      map.set(path.replace(/^\.\//, ""), identifier);
    });
  });

  return map;
};

const extractHtmlTitle = (html: string, fallback: string): string => {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return stripHtml(h1 ?? title ?? fallback).trim() || fallback;
};

const extractBody = (html: string): string => html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1]?.trim() || html;

const moduleItem = (item: Omit<ModuleItem, "status" | "metadata" | "publishState" | "indent">, timestamp: string): ModuleItem => ({
  ...item,
  indent: 0,
  publishState: "published",
  status: "generated",
  metadata: metadata(timestamp)
});

const publishStateFrom = (value: string | undefined): "published" | "unpublished" => (value === "unpublished" ? "unpublished" : "published");

const moduleItemTypeFromCanvas = (contentType: string | undefined, title: string): ModuleItem["type"] | undefined => {
  if (!contentType) return undefined;
  if (/wiki/i.test(contentType)) return /syllabus/i.test(title) ? "syllabus" : "page";
  if (/assignment/i.test(contentType)) return "assignment";
  if (/discussion/i.test(contentType)) return "discussion";
  if (/quiz/i.test(contentType)) return "quiz";
  return undefined;
};

const parseCanvasModules = (moduleMetaXml: string | undefined, refAliases: Map<string, string>, timestamp: string): CourseModule[] => {
  if (!moduleMetaXml) return [];

  return blocksBetween(moduleMetaXml, "module")
    .map((moduleBlock, moduleIndex) => {
      const moduleId = `imported_module_${slugify(attr(moduleBlock.attrs, "identifier") ?? `module-${moduleIndex + 1}`)}`;
      const title = textBetween(moduleBlock.body, "title") ?? `Imported Module ${moduleIndex + 1}`;
      const items = blocksBetween(moduleBlock.body, "item")
        .map((itemBlock, itemIndex): ModuleItem | undefined => {
          const ref = textBetween(itemBlock.body, "identifierref");
          const refId = ref ? (refAliases.get(ref) ?? refAliases.get(slugify(ref)) ?? ref) : undefined;
          const itemTitle = textBetween(itemBlock.body, "title") ?? `Imported item ${itemIndex + 1}`;
          const type = moduleItemTypeFromCanvas(textBetween(itemBlock.body, "content_type"), itemTitle);
          if (!refId || !type) return undefined;

          return {
            id: `imported_item_${slugify(attr(itemBlock.attrs, "identifier") ?? `${moduleId}-${itemIndex + 1}`)}`,
            type,
            title: itemTitle,
            refId,
            order: Number(textBetween(itemBlock.body, "position") ?? itemIndex + 1),
            indent: Number(textBetween(itemBlock.body, "indent") ?? 0),
            publishState: publishStateFrom(textBetween(itemBlock.body, "workflow_state")),
            status: "generated",
            metadata: metadata(timestamp)
          };
        })
        .filter((item): item is ModuleItem => Boolean(item));

      return {
        id: moduleId,
        title,
        description: "Recovered from Canvas module metadata. Review item links and publish states before re-export.",
        objectives: ["Review recovered Canvas module flow.", "Revise imported items before publishing."],
        workloadHours: 1,
        order: Number(textBetween(moduleBlock.body, "position") ?? moduleIndex + 1),
        kind: "content" as const,
        publishState: publishStateFrom(textBetween(moduleBlock.body, "workflow_state")),
        expanded: moduleIndex === 0,
        items: items.sort((a, b) => a.order - b.order).map((item, index) => ({ ...item, order: index + 1 })),
        status: "generated" as const,
        metadata: metadata(timestamp)
      };
    })
    .filter((module) => module.items.length > 0)
    .sort((a, b) => a.order - b.order);
};

export const importCanvasCourseFromImscc = async (file: File, settings: CourseSettings = defaultSettings): Promise<ImportCanvasCourseResult> => {
  const timestamp = new Date().toISOString();
  const zipSource = typeof file.arrayBuffer === "function" ? await file.arrayBuffer() : file;
  const zip = await JSZip.loadAsync(zipSource);
  const notes: string[] = [];
  const manifest = await zip.file("imsmanifest.xml")?.async("text");
  const resourceIdsByFile = manifestResourceIdsByFile(manifest);
  const refAliases = new Map<string, string>();
  const manifestTitle = manifest ? textBetween(manifest, "title") : undefined;
  const title = manifestTitle && manifestTitle !== "Untitled" ? manifestTitle : file.name.replace(/\.imscc$/i, "").replace(/[-_]+/g, " ");
  const base = generateCourseProject({
    prompt: `Imported Canvas IMSCC package: ${file.name}`,
    settings: { ...settings, title, buildMode: "hybrid" }
  });

  const pageFiles = Object.keys(zip.files).filter((path) => /^wiki_content\/.+\.html$/i.test(path));
  const importedPages: CoursePage[] = [];

  for (const path of pageFiles) {
    const html = await zip.file(path)?.async("text");
    if (!html) continue;
    const titleFromHtml = extractHtmlTitle(html, path.split("/").pop() ?? "Imported Page");
    const slug = slugify(path.split("/").pop()?.replace(/\.html$/i, "") ?? titleFromHtml);
    const sourceRef = resourceIdsByFile.get(path);
    const pageId = `imported_page_${slugify(sourceRef ?? slug)}`;
    if (sourceRef) refAliases.set(sourceRef, pageId);
    importedPages.push({
      id: pageId,
      title: titleFromHtml,
      slug,
      bodyHtml: extractBody(html),
      moduleId: "module_imported_canvas",
      frontPage: /front_page" content="true"/i.test(html),
      publishState: /workflow_state" content="unpublished"/i.test(html) ? "unpublished" : "published",
      status: "generated",
      metadata: metadata(timestamp)
    });
  }

  if (!importedPages.some((page) => page.slug === "syllabus")) {
    const syllabusHtml = await zip.file("course_settings/syllabus.html")?.async("text");
    if (syllabusHtml) {
      importedPages.push({
        id: "imported_page_course_settings_syllabus",
        title: extractHtmlTitle(syllabusHtml, "Imported Syllabus"),
        slug: "syllabus",
        bodyHtml: extractBody(syllabusHtml),
        moduleId: "module_imported_canvas",
        frontPage: false,
        publishState: "published",
        status: "generated",
        metadata: metadata(timestamp)
      });
    }
  }

  if (importedPages.length === 0) notes.push("No Canvas wiki pages were recovered from wiki_content/*.html.");

  const assignmentSettingsFiles = Object.keys(zip.files).filter((path) => /assignment_settings\.xml$/i.test(path));
  const importedAssignments: Assignment[] = [];
  for (const path of assignmentSettingsFiles) {
    const xml = await zip.file(path)?.async("text");
    if (!xml) continue;
    const folder = path.split("/")[0];
    const titleText = textBetween(xml, "title") ?? folder;
    const points = Number(textBetween(xml, "points_possible") ?? 0);
    const sourceRef = resourceIdsByFile.get(path) ?? resourceIdsByFile.get(folder);
    const assignmentId = `imported_assignment_${slugify(sourceRef ?? folder)}`;
    if (sourceRef) refAliases.set(sourceRef, assignmentId);
    refAliases.set(folder, assignmentId);
    importedAssignments.push({
      id: assignmentId,
      title: titleText,
      descriptionHtml: `<h1>${titleText}</h1><p>${textBetween(xml, "description") ?? "Imported assignment details should be reviewed in Canvas."}</p>`,
      points,
      estimatedHours: 2,
      submissionType: textBetween(xml, "submission_types") ?? "Review imported Canvas settings",
      moduleId: "module_imported_canvas",
      assignmentGroupId: textBetween(xml, "assignment_group_identifierref") ?? "group_assignments",
      rubricId: undefined,
      alignedOutcomeIds: [],
      publishState: textBetween(xml, "workflow_state") === "unpublished" ? "unpublished" : "published",
      status: "generated",
      metadata: metadata(timestamp)
    });
  }
  if (importedAssignments.length === 0) notes.push("No assignment_settings.xml files were recovered.");

  const discussionMetaFiles = Object.keys(zip.files).filter((path) => /_meta\.xml$/i.test(path) && !/quiz/i.test(path));
  const importedDiscussions: Discussion[] = [];
  for (const path of discussionMetaFiles) {
    const xml = await zip.file(path)?.async("text");
    if (!xml) continue;
    const ident = attr(xml, "identifier") ?? path.replace(/_meta\.xml$/i, "");
    const originalRef = textBetween(xml, "topic_id") ?? ident.replace(/_meta$/i, "").replace(/_meta\.xml$/i, "");
    const titleText = textBetween(xml, "title") ?? ident;
    const discussionId = `imported_discussion_${slugify(originalRef)}`;
    refAliases.set(originalRef, discussionId);
    refAliases.set(ident, discussionId);
    importedDiscussions.push({
      id: discussionId,
      title: titleText,
      promptHtml: `<h1>${titleText}</h1><p>Imported discussion prompt recovered partially. Review the original Canvas topic after import.</p>`,
      points: Number(textBetween(xml, "points_possible") ?? 0),
      moduleId: "module_imported_canvas",
      assignmentGroupId: textBetween(xml, "assignment_group_identifierref") ?? "group_discussions",
      alignedOutcomeIds: [],
      publishState: textBetween(xml, "workflow_state") === "unpublished" ? "unpublished" : "published",
      status: "generated",
      metadata: metadata(timestamp)
    });
  }
  if (importedDiscussions.length === 0) notes.push("No discussion metadata files were recovered.");

  const quizMetaFiles = Object.keys(zip.files).filter((path) => /assessment_meta\.xml$/i.test(path));
  const importedQuizzes: Quiz[] = [];
  for (const path of quizMetaFiles) {
    const xml = await zip.file(path)?.async("text");
    if (!xml) continue;
    const folder = path.split("/")[0];
    const sourceRef = resourceIdsByFile.get(path) ?? resourceIdsByFile.get(folder) ?? folder;
    const titleText = textBetween(xml, "title") ?? folder;
    const quizId = `imported_quiz_${slugify(sourceRef)}`;
    refAliases.set(sourceRef, quizId);
    refAliases.set(folder, quizId);
    importedQuizzes.push({
      id: quizId,
      title: titleText,
      purpose: textBetween(xml, "description") ?? "Imported quiz metadata recovered partially. Review question details after import.",
      moduleId: "module_imported_canvas",
      assignmentGroupId: textBetween(xml, "assignment_group_identifierref") ?? "group_quizzes",
      points: Number(textBetween(xml, "points_possible") ?? 0),
      questions: [],
      alignedOutcomeIds: [],
      publishState: textBetween(xml, "workflow_state") === "unpublished" ? "unpublished" : "published",
      status: "generated",
      metadata: metadata(timestamp)
    });
  }
  if (importedQuizzes.length === 0) notes.push("No Canvas quiz assessment_meta.xml files were recovered.");

  const moduleMetaXml = await zip.file("course_settings/module_meta.xml")?.async("text");
  const parsedModules = parseCanvasModules(moduleMetaXml, refAliases, timestamp);

  const recoveredItems = [
    ...importedPages.map((page, index) => moduleItem({ id: `imported_item_page_${index}`, type: "page", title: page.title, refId: page.id, order: index + 1 }, timestamp)),
    ...importedAssignments.map((assignment, index) => moduleItem({ id: `imported_item_assignment_${index}`, type: "assignment", title: assignment.title, refId: assignment.id, order: importedPages.length + index + 1 }, timestamp)),
    ...importedDiscussions.map((discussion, index) => moduleItem({ id: `imported_item_discussion_${index}`, type: "discussion", title: discussion.title, refId: discussion.id, order: importedPages.length + importedAssignments.length + index + 1 }, timestamp)),
    ...importedQuizzes.map((quiz, index) => moduleItem({ id: `imported_item_quiz_${index}`, type: "quiz", title: quiz.title, refId: quiz.id, order: importedPages.length + importedAssignments.length + importedDiscussions.length + index + 1 }, timestamp))
  ];

  const importedModule: CourseModule = {
    id: "module_imported_canvas",
    title: "Imported Canvas Content",
    description: "Recovered objects from an existing Canvas IMSCC package. Review partial imports before exporting again.",
    objectives: ["Review recovered Canvas objects.", "Decide what should be revised before re-export."],
    workloadHours: 1,
    order: 1,
    kind: "content",
    publishState: "unpublished",
    expanded: true,
    items: recoveredItems,
    status: "generated",
    metadata: metadata(timestamp)
  };

  const referencedImportedIds = new Set(parsedModules.flatMap((module) => module.items.map((item) => item.refId)));
  const unplacedItems = recoveredItems.filter((item) => !referencedImportedIds.has(item.refId));
  const importedContentModules =
    parsedModules.length > 0
      ? [
          ...parsedModules,
          ...(unplacedItems.length
            ? [
                {
                  ...importedModule,
                  title: "Imported Canvas Content Not Found in Modules",
                  order: parsedModules.length + 1,
                  items: unplacedItems.map((item, index) => ({ ...item, order: index + 1 }))
                }
              ]
            : [])
        ]
      : [importedModule];
  const moduleIdByObjectId = new Map<string, string>();
  importedContentModules.forEach((module) => {
    module.items.forEach((item) => {
      if (!moduleIdByObjectId.has(item.refId)) moduleIdByObjectId.set(item.refId, module.id);
    });
  });
  const withRecoveredModuleId = <T extends { id: string; moduleId?: string }>(items: T[]): T[] =>
    items.map((item) => ({ ...item, moduleId: moduleIdByObjectId.get(item.id) ?? "module_imported_canvas" }) as T);

  notes.push(`Recovered ${importedPages.length} page(s), ${importedAssignments.length} assignment(s), ${importedDiscussions.length} discussion(s), and ${importedQuizzes.length} quiz shell(s).`);
  if (parsedModules.length > 0) {
    notes.push(`Recovered Canvas module structure for ${parsedModules.length} module(s).`);
  } else {
    notes.push("No Canvas module metadata was recovered; imported objects were placed into one review module.");
  }
  notes.push("Rubric, outcome, and file recovery is partial in this browser-only MVP parser.");

  const modules = [
    base.modules[0],
    ...importedContentModules.map((module, index) => ({ ...module, order: index + 1 })),
    ...base.modules.slice(1).map((module, index) => ({ ...module, order: importedContentModules.length + index + 1 }))
  ];

  return {
    course: {
      ...base,
      title,
      prompt: `Imported from ${file.name}`,
      status: "edited",
      updatedAt: timestamp,
      pages: [...base.pages, ...withRecoveredModuleId(importedPages)],
      assignments: [...base.assignments, ...withRecoveredModuleId(importedAssignments)],
      discussions: [...base.discussions, ...withRecoveredModuleId(importedDiscussions)],
      quizzes: [...base.quizzes, ...withRecoveredModuleId(importedQuizzes)],
      modules,
      metadata: metadata(timestamp)
    },
    notes
  };
};
