import JSZip from "jszip";
import type {
  Announcement,
  Assignment,
  CourseModule,
  CoursePage,
  CourseProject,
  Discussion,
  ExportMode,
  ExportValidationIssue,
  ExportValidationReport,
  ModuleItem,
  PublishState,
  Quiz,
  QuizQuestion,
  Rubric
} from "../types";
import { escapeXml, slugify, stripHtml } from "../utils/text";
import { unsafeHtmlReasons } from "./htmlSafety";
import { validateAssignmentPlan } from "./assignmentBuilder";
import { validateDiscussionPlan } from "./discussionBuilder";
import { validateModulePlan } from "./modulePlanner";
import { validatePagePlan } from "./pageBuilder";
import { validateQuizPlan } from "./quizBuilder";
import { validateRubricPlan } from "./rubricBuilder";
import { buildReadinessReport } from "./readiness";
import { repairCourse } from "./courseRepair";
import { buildBannerSvg, buildCourseTileSvg, buildModuleHeaderSvg } from "./themeDesign";
import { canvasRefResolves, canvasRefTargets, isCanvasRef } from "./canvasLinks";
import { collectXmlParseErrors, formatXmlParseError } from "./xmlWellFormed";

const CANVAS_NAMESPACE = "http://canvas.instructure.com/xsd/cccv1p0";
const CANVAS_XSD_URI = "https://canvas.instructure.com/xsd/cccv1p0.xsd";
const XSI = "http://www.w3.org/2001/XMLSchema-instance";
const CC_NAMESPACE = "http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1";
const LOM_RESOURCE = "http://ltsc.ieee.org/xsd/imsccv1p1/LOM/resource";
const LOM_MANIFEST = "http://ltsc.ieee.org/xsd/imsccv1p1/LOM/manifest";
const QTI_NAMESPACE = "http://www.imsglobal.org/xsd/ims_qtiasiv1p2";

const resourceType = {
  webcontent: "webcontent",
  learningApplicationResource: "associatedcontent/imscc_xmlv1p1/learning-application-resource",
  discussionTopic: "imsdt_xmlv1p1",
  assessment: "imsqti_xmlv1p2/imscc_xmlv1p1/assessment"
};

const xml = (value: string | number | boolean | undefined | null): string => escapeXml(value == null ? value : String(value));

const pagePath = (page: CoursePage): string => page.assetPath ?? `wiki_content/${slugify(page.slug || page.title)}.html`;
const assignmentPath = (assignment: Assignment): string => `${assignment.id}/${slugify(assignment.title)}.html`;
const assignmentSettingsPath = (assignment: Assignment): string => `${assignment.id}/assignment_settings.xml`;
const discussionPath = (discussion: Discussion): string => `${discussion.id}.xml`;
const discussionMetaPath = (discussion: Discussion): string => `${discussion.id}_meta.xml`;
const announcementPath = (announcement: Announcement): string => `${announcement.id}.xml`;
const announcementMetaPath = (announcement: Announcement): string => `${announcement.id}_meta.xml`;
const courseAnnouncements = (course: CourseProject): Announcement[] => course.announcements ?? [];
const quizCcPath = (quiz: Quiz): string => `${quiz.id}/assessment_qti.xml`;
const quizMetaPath = (quiz: Quiz): string => `${quiz.id}/assessment_meta.xml`;
const quizCanvasQtiPath = (quiz: Quiz): string => `non_cc_assessments/${quiz.id}.xml.qti`;

const canvasSchemaAttrs = `xmlns="${CANVAS_NAMESPACE}" xmlns:xsi="${XSI}" xsi:schemaLocation="${CANVAS_NAMESPACE} ${CANVAS_XSD_URI}"`;

const workflowState = (publishState: PublishState): "active" | "unpublished" => (publishState === "unpublished" ? "unpublished" : "active");

const htmlMeta = (fields: Record<string, string | number | boolean | undefined | null>): string =>
  Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `<meta name="${xml(key)}" content="${xml(String(value))}"/>`)
    .join("\n");

const wrappedHtmlDocument = (
  title: string,
  bodyHtml: string,
  metaFields: Record<string, string | number | boolean | undefined | null> = {}
): string => `<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
<title>${xml(title)}</title>
${htmlMeta(metaFields)}
</head>
<body>
${bodyHtml}
</body>
</html>`;

const wrappedWikiPage = (page: CoursePage): string =>
  wrappedHtmlDocument(page.title, page.bodyHtml, {
    identifier: page.id,
    editing_roles: "teachers",
    notify_of_update: "false",
    workflow_state: workflowState(page.publishState),
    front_page: page.frontPage ? "true" : "false"
  });

const createBannerSvg = (course: CourseProject): string => buildBannerSvg(course.title, course.theme);

// The 1:1 course tile shares the banner's design language (gradient + pattern + motif), themed to
// the course — so the dashboard thumbnail and the export tile match the rest of the package.
const createCourseTileSvg = (course: CourseProject): string => buildCourseTileSvg(course.title, course.theme);

// PDF text uses single-byte Helvetica (WinAnsi). Restrict to printable ASCII so decoded
// Unicode (e.g. checkmarks) cannot desync the byte count from the /Length declared below.
const pdfAsciiSafe = (value: string): string =>
  value
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[✓✔•]/g, "-")
    .replace(/[^\x20-\x7E]/g, " ");

const pdfEscape = (value: string): string => pdfAsciiSafe(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

const createSimplePdf = (title: string, lines: string[]): string => {
  const clippedLines = [title, "", ...lines].flatMap((line) => line.match(/.{1,88}(\s|$)/g)?.map((part) => part.trim()) ?? [line]).slice(0, 46);
  const text = clippedLines
    .map((line, index) => `BT /F1 ${index === 0 ? 18 : 11} Tf 54 ${760 - index * 15} Td (${pdfEscape(line)}) Tj ET`)
    .join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return body;
};

const createCanvasExportFlag = (): string => `Canvas export generated by RocketCourse Canvas Builder.
This marker mirrors Canvas course export packages so Canvas uses the Canvas-flavored Common Cartridge importer.`;

// Canvas built-in navigation tab ids (from app/models/course.rb TAB_* constants). Used to build the
// tab_configuration JSON Canvas reads on import to decide which tabs are visible/hidden to students.
const CANVAS_TAB_IDS: Record<string, number> = {
  home: 0,
  syllabus: 1,
  pages: 2,
  assignments: 3,
  quizzes: 4,
  grades: 5,
  people: 6,
  discussions: 8,
  modules: 10,
  files: 11,
  conferences: 12,
  settings: 13,
  announcements: 14,
  outcomes: 15,
  collaborations: 16,
  rubrics: 17
};

// Build the Canvas tab_configuration: visible tabs first (in nav order), then hidden tabs flagged
// hidden:true. This is what makes the imported student navigation show only the intended tools.
const canvasTabConfiguration = (course: CourseProject): string => {
  const idsSeen = new Set<number>();
  const entries: string[] = [];
  const push = (navId: string, hidden: boolean): void => {
    const tabId = CANVAS_TAB_IDS[navId];
    if (tabId === undefined || idsSeen.has(tabId)) return;
    idsSeen.add(tabId);
    entries.push(hidden ? `{"id":${tabId},"hidden":true}` : `{"id":${tabId}}`);
  };
  course.navigation.filter((item) => item.visible).forEach((item) => push(item.id, false));
  course.navigation.filter((item) => !item.visible).forEach((item) => push(item.id, true));
  // Always hide the remaining non-essential built-in tabs even if the course nav didn't list them.
  ["pages", "assignments", "quizzes", "discussions", "files", "outcomes", "collaborations", "rubrics", "conferences"].forEach((navId) => push(navId, true));
  return `[${entries.join(",")}]`;
};

const createCourseSettingsXml = (course: CourseProject): string => `<?xml version="1.0" encoding="UTF-8"?>
<course identifier="${xml(course.id)}" ${canvasSchemaAttrs}>
  <title>${xml(course.title)}</title>
  <course_code>${xml(slugify(course.title).slice(0, 24).toUpperCase())}</course_code>
  <default_view>wiki</default_view>
  <group_weighting_scheme>percent</group_weighting_scheme>
  <is_public>false</is_public>
  <public_syllabus>false</public_syllabus>
  <syllabus_course_summary>false</syllabus_course_summary>
  <allow_student_discussion_topics>false</allow_student_discussion_topics>
  <allow_student_forum_attachments>true</allow_student_forum_attachments>
  <show_total_grade_as_points>false</show_total_grade_as_points>
  <show_announcements_on_home_page>true</show_announcements_on_home_page>
  <home_page_announcement_limit>3</home_page_announcement_limit>
  <course_color>${xml(course.theme.accent)}</course_color>
  <tab_configuration>${canvasTabConfiguration(course)}</tab_configuration>
</course>`;

const createContextInfoXml = (course: CourseProject): string => `<?xml version="1.0" encoding="UTF-8"?>
<context_info ${canvasSchemaAttrs}>
  <course_id>${xml(course.id)}</course_id>
  <course_name>${xml(course.title)}</course_name>
  <root_account_id>rocketcourse</root_account_id>
  <root_account_name>RocketCourse Canvas Builder</root_account_name>
  <root_account_uuid>rocketcourse-local-mvp</root_account_uuid>
  <canvas_domain>canvas.instructure.com</canvas_domain>
</context_info>`;

const createCourseNavigationXml = (course: CourseProject): string => `<?xml version="1.0" encoding="UTF-8"?>
<courseNavigation ${canvasSchemaAttrs}>
${course.navigation
  .map(
    (item, index) => `  <tab identifier="${xml(item.id)}">
    <label>${xml(item.label)}</label>
    <position>${index + 1}</position>
    <hidden>${item.visible ? "false" : "true"}</hidden>
    <reason>${xml(item.reason)}</reason>
  </tab>`
  )
  .join("\n")}
</courseNavigation>`;

const createAssignmentXml = (assignment: Assignment): string => `<?xml version="1.0" encoding="UTF-8"?>
<assignment identifier="${xml(assignment.id)}" ${canvasSchemaAttrs}>
  <title>${xml(assignment.title)}</title>
  <workflow_state>${workflowState(assignment.publishState)}</workflow_state>
  <assignment_group_identifierref>${xml(assignment.assignmentGroupId)}</assignment_group_identifierref>
  <points_possible>${assignment.points}</points_possible>
  <grading_type>points</grading_type>
  ${assignment.dueAt ? `<due_at>${xml(assignment.dueAt)}</due_at>` : ""}
  <submission_types>online_text_entry,online_upload</submission_types>
  ${assignment.rubricId ? `<rubric_identifierref>${xml(assignment.rubricId)}</rubric_identifierref>` : ""}
  <description>${xml(stripHtml(assignment.descriptionHtml))}</description>
</assignment>`;

const createDiscussionXml = (discussion: Discussion): string => `<?xml version="1.0" encoding="UTF-8"?>
<topic xmlns="http://www.imsglobal.org/xsd/imsccv1p1/imsdt_v1p1" xmlns:xsi="${XSI}" xsi:schemaLocation="http://www.imsglobal.org/xsd/imsccv1p1/imsdt_v1p1 http://www.imsglobal.org/profile/cc/ccv1p1/ccv1p1_imsdt_v1p1.xsd">
  <title>${xml(discussion.title)}</title>
  <text texttype="text/html">${xml(discussion.promptHtml)}</text>
</topic>`;

const createDiscussionMetaXml = (discussion: Discussion): string => `<?xml version="1.0" encoding="UTF-8"?>
<topicMeta identifier="${xml(`${discussion.id}_meta`)}" ${canvasSchemaAttrs}>
  <topic_id>${xml(discussion.id)}</topic_id>
  <title>${xml(discussion.title)}</title>
  <type>topic</type>
  <workflow_state>${workflowState(discussion.publishState)}</workflow_state>
  <discussion_type>threaded</discussion_type>
  <require_initial_post>true</require_initial_post>
  ${
    discussion.points > 0
      ? `<assignment identifier="${xml(`${discussion.id}_assignment`)}">
    <title>${xml(discussion.title)}</title>
    <points_possible>${discussion.points}</points_possible>
    <grading_type>points</grading_type>
    ${discussion.dueAt ? `<due_at>${xml(discussion.dueAt)}</due_at>` : ""}
    <assignment_group_identifierref>${xml(discussion.assignmentGroupId)}</assignment_group_identifierref>
    ${discussion.rubricId ? `<rubric_identifierref>${xml(discussion.rubricId)}</rubric_identifierref>` : ""}
  </assignment>`
      : ""
  }
</topicMeta>`;

// Announcements export as Canvas discussion topics flagged <type>announcement</type>. With the
// course setting show_announcements_on_home_page on, Canvas surfaces the latest ones above the home page.
const createAnnouncementXml = (announcement: Announcement): string => `<?xml version="1.0" encoding="UTF-8"?>
<topic xmlns="http://www.imsglobal.org/xsd/imsccv1p1/imsdt_v1p1" xmlns:xsi="${XSI}" xsi:schemaLocation="http://www.imsglobal.org/xsd/imsccv1p1/imsdt_v1p1 http://www.imsglobal.org/profile/cc/ccv1p1/ccv1p1_imsdt_v1p1.xsd">
  <title>${xml(announcement.title)}</title>
  <text texttype="text/html">${xml(announcement.bodyHtml)}</text>
</topic>`;

const createAnnouncementMetaXml = (announcement: Announcement): string => `<?xml version="1.0" encoding="UTF-8"?>
<topicMeta identifier="${xml(`${announcement.id}_meta`)}" ${canvasSchemaAttrs}>
  <topic_id>${xml(announcement.id)}</topic_id>
  <title>${xml(announcement.title)}</title>
  <type>announcement</type>
  <workflow_state>${workflowState(announcement.publishState)}</workflow_state>
  <discussion_type>side_comment</discussion_type>
  <require_initial_post>false</require_initial_post>
  ${announcement.postedAt ? `<delayed_post_at>${xml(announcement.postedAt)}</delayed_post_at>` : ""}
  <position>1</position>
</topicMeta>`;

const createRubricsXml = (rubrics: Rubric[]): string => `<?xml version="1.0" encoding="UTF-8"?>
<rubrics ${canvasSchemaAttrs}>
${rubrics
  .map(
    (rubric) => `  <rubric identifier="${xml(rubric.id)}">
    <title>${xml(rubric.title)}</title>
    <reusable>false</reusable>
    <public>false</public>
    <workflow_state>${workflowState(rubric.publishState)}</workflow_state>
    <points_possible>${rubric.points}</points_possible>
    <aligned_outcome_identifierrefs>${xml(rubric.alignedOutcomeIds.join(","))}</aligned_outcome_identifierrefs>
    <free_form_criterion_comments>false</free_form_criterion_comments>
    <criteria>
${rubric.criteria
  .map(
    (criterion) => `      <criterion>
        <criterion_id>${xml(criterion.id)}</criterion_id>
        <points>${Math.max(...criterion.levels.map((level) => level.points))}</points>
        <description>${xml(criterion.title)}</description>
        <long_description>${xml(criterion.description)}</long_description>
        ${criterion.outcomeId ? `<learning_outcome_identifierref>${xml(criterion.outcomeId)}</learning_outcome_identifierref>` : ""}
        <ratings>
${criterion.levels
  .map(
    (level) => `          <rating>
            <description>${xml(level.label)}</description>
            <points>${level.points}</points>
            <criterion_id>${xml(criterion.id)}</criterion_id>
            <long_description>${xml(level.description)}</long_description>
          </rating>`
  )
  .join("\n")}
        </ratings>
      </criterion>`
  )
  .join("\n")}
    </criteria>
  </rubric>`
  )
  .join("\n")}
</rubrics>`;

const createAssignmentGroupsXml = (course: CourseProject): string => `<?xml version="1.0" encoding="UTF-8"?>
<assignmentGroups ${canvasSchemaAttrs}>
${course.assignmentGroups
  .map(
    (group, index) => `  <assignmentGroup identifier="${xml(group.id)}">
    <title>${xml(group.name)}</title>
    <position>${index + 1}</position>
    <group_weight>${group.weight}</group_weight>
    ${
      group.dropLowest
        ? `<rules><rule><drop_type>drop_lowest</drop_type><drop_count>${group.dropLowest}</drop_count></rule></rules>`
        : ""
    }
  </assignmentGroup>`
  )
  .join("\n")}
</assignmentGroups>`;

const createLearningOutcomesXml = (course: CourseProject): string => `<?xml version="1.0" encoding="UTF-8"?>
<learningOutcomes ${canvasSchemaAttrs}>
${course.outcomes
  .map(
    (outcome) => `  <learningOutcome identifier="${xml(outcome.id)}">
    <title>${xml(outcome.code)}</title>
    <description>${xml(outcome.text)}</description>
    <calculation_method>decaying_average</calculation_method>
    <calculation_int>65</calculation_int>
    <points_possible>5</points_possible>
    <mastery_points>3</mastery_points>
    <ratings>
      <rating><description>Exceeds mastery</description><points>5</points></rating>
      <rating><description>Meets mastery</description><points>3</points></rating>
      <rating><description>Developing</description><points>1</points></rating>
    </ratings>
  </learningOutcome>`
  )
  .join("\n")}
</learningOutcomes>`;

const itemContentType = (item: ModuleItem): string => {
  if (item.type === "subheader") return "ContextModuleSubHeader";
  if (item.type === "page" || item.type === "syllabus") return "WikiPage";
  if (item.type === "assignment") return "Assignment";
  if (item.type === "discussion") return "DiscussionTopic";
  if (item.type === "quiz") return "Quizzes::Quiz";
  return "WikiPage";
};

// A module's release/unlock date comes from the generated schedule (set only when a term schedule
// is configured). Written as Canvas <unlock_at> so modules release on schedule after import.
const moduleReleaseAt = (course: CourseProject, module: CourseModule): string | undefined =>
  course.schedule.find((entry) => entry.itemType === "module" && entry.moduleId === module.id)?.releaseAt;

const createModuleMetaXml = (course: CourseProject): string => `<?xml version="1.0" encoding="UTF-8"?>
<modules ${canvasSchemaAttrs}>
${course.modules
  .map(
    (module: CourseModule) => `  <module identifier="${xml(module.id)}">
    <title>${xml(module.title)}</title>
    <workflow_state>${workflowState(module.publishState)}</workflow_state>
    <position>${module.order}</position>${moduleReleaseAt(course, module) ? `
    <unlock_at>${xml(moduleReleaseAt(course, module) as string)}</unlock_at>` : ""}
    <items>
${module.items
  .map(
    (item) => `      <item identifier="${xml(item.id)}">
        <content_type>${itemContentType(item)}</content_type>
        <workflow_state>${workflowState(item.publishState)}</workflow_state>
        <title>${xml(item.title)}</title>${item.type === "subheader" ? "" : `
        <identifierref>${xml(item.refId)}</identifierref>`}
        <position>${item.order}</position>
        <indent>${item.indent}</indent>
      </item>`
  )
  .join("\n")}
    </items>
  </module>`
  )
  .join("\n")}
</modules>`;

const isAutoGradedChoice = (question: QuizQuestion): boolean =>
  (question.type === "multiple_choice" || question.type === "true_false") &&
  Array.isArray(question.choices) &&
  question.choices.length > 0 &&
  Boolean(question.correctAnswer) &&
  question.choices.includes(question.correctAnswer as string);

// A short-answer question is auto-gradable only when it carries an answer key. Acceptable
// answers may be pipe-delimited; each becomes a case-insensitive fill-in-the-blank match.
const acceptableAnswers = (question: QuizQuestion): string[] =>
  (question.correctAnswer ?? "")
    .split("|")
    .map((answer) => answer.trim())
    .filter(Boolean);

const isFillInBlank = (question: QuizQuestion): boolean => question.type === "short_answer" && acceptableAnswers(question).length > 0;

// Canvas reads question_type from item metadata to pick its native question editor.
// short_answer/essay prompts without an answer key map to manually graded essay_question
// rather than short_answer_question (which would auto-mark every response wrong).
const canvasQuestionType = (question: QuizQuestion): string => {
  if (question.type === "multiple_choice") return "multiple_choice_question";
  if (question.type === "true_false") return "true_false_question";
  if (isFillInBlank(question)) return "short_answer_question";
  return "essay_question";
};

// Common Cartridge QTI 1.2 profile identifiers for the cc-flavored assessment.
const ccQuestionProfile = (question: QuizQuestion): string => {
  if (question.type === "multiple_choice") return "cc.multiple_choice.v0p1";
  if (question.type === "true_false") return "cc.true_false.v0p1";
  if (isFillInBlank(question)) return "cc.fib.v0p1";
  return "cc.essay.v0p1";
};

const choiceLabelId = (questionId: string, index: number): string => `${questionId}_a${index + 1}`;
const responseLid = (questionId: string): string => `response_${questionId}`;

const qtiItemFeedback = (ident: string, html: string): string =>
  html
    ? `        <itemfeedback ident="${xml(ident)}">
          <flow_mat><material><mattext texttype="text/html">${xml(html)}</mattext></material></flow_mat>
        </itemfeedback>`
    : "";

const createQtiItem = (question: QuizQuestion, canvasFlavor: boolean): string => {
  const metaFields = [
    `<qtimetadatafield><fieldlabel>question_type</fieldlabel><fieldentry>${xml(canvasQuestionType(question))}</fieldentry></qtimetadatafield>`,
    canvasFlavor
      ? ""
      : `<qtimetadatafield><fieldlabel>cc_profile</fieldlabel><fieldentry>${xml(ccQuestionProfile(question))}</fieldentry></qtimetadatafield>`,
    `<qtimetadatafield><fieldlabel>points_possible</fieldlabel><fieldentry>${question.points}</fieldentry></qtimetadatafield>`
  ]
    .filter(Boolean)
    .join("\n            ");

  const itemMetadata = `        <itemmetadata>
          <qtimetadata>
            ${metaFields}
          </qtimetadata>
        </itemmetadata>`;
  const stem = `          <material><mattext texttype="text/html">${xml(question.stem)}</mattext></material>`;

  if (isAutoGradedChoice(question)) {
    const choices = question.choices ?? [];
    const correctIndex = choices.findIndex((choice) => choice === question.correctAnswer);
    const lid = responseLid(question.id);
    const labels = choices
      .map(
        (choice, index) => `              <response_label ident="${xml(choiceLabelId(question.id, index))}">
                <material><mattext texttype="text/plain">${xml(choice)}</mattext></material>
              </response_label>`
      )
      .join("\n");
    const feedback = [
      qtiItemFeedback(`${question.id}_correct_fb`, question.correctFeedback || question.feedback || ""),
      qtiItemFeedback(`${question.id}_incorrect_fb`, question.incorrectFeedback || question.feedback || "")
    ]
      .filter(Boolean)
      .join("\n");
    return `      <item ident="${xml(question.id)}" title="${xml(question.stem.slice(0, 72))}">
${itemMetadata}
        <presentation>
${stem}
          <response_lid ident="${xml(lid)}" rcardinality="Single">
            <render_choice>
${labels}
            </render_choice>
          </response_lid>
        </presentation>
        <resprocessing>
          <outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>
          <respcondition continue="No">
            <conditionvar><varequal respident="${xml(lid)}">${xml(choiceLabelId(question.id, correctIndex))}</varequal></conditionvar>
            <setvar action="Set" varname="SCORE">100</setvar>
            <displayfeedback feedbacktype="Response" linkrefid="${xml(`${question.id}_correct_fb`)}"/>
          </respcondition>
          <respcondition continue="Yes">
            <conditionvar><other/></conditionvar>
            <displayfeedback feedbacktype="Response" linkrefid="${xml(`${question.id}_incorrect_fb`)}"/>
          </respcondition>
        </resprocessing>
${feedback}
      </item>`;
  }

  if (isFillInBlank(question)) {
    const lid = responseLid(question.id);
    const answers = acceptableAnswers(question);
    const varequals = answers.map((answer) => `<varequal respident="${xml(lid)}" case="No">${xml(answer)}</varequal>`);
    // Multiple acceptable answers are alternatives, so wrap them in <or>; a lone answer needs no wrapper.
    const conditionBody = varequals.length > 1 ? `<or>${varequals.join("")}</or>` : varequals.join("");
    const feedback = [
      qtiItemFeedback(`${question.id}_correct_fb`, question.correctFeedback || question.feedback || ""),
      qtiItemFeedback(`${question.id}_incorrect_fb`, question.incorrectFeedback || question.feedback || "")
    ]
      .filter(Boolean)
      .join("\n");
    return `      <item ident="${xml(question.id)}" title="${xml(question.stem.slice(0, 72))}">
${itemMetadata}
        <presentation>
${stem}
          <response_str ident="${xml(lid)}" rcardinality="Single">
            <render_fib><response_label ident="${xml(`${question.id}_answer`)}" rshuffle="No"/></render_fib>
          </response_str>
        </presentation>
        <resprocessing>
          <outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>
          <respcondition continue="No">
            <conditionvar>${conditionBody}</conditionvar>
            <setvar action="Set" varname="SCORE">100</setvar>
            <displayfeedback feedbacktype="Response" linkrefid="${xml(`${question.id}_correct_fb`)}"/>
          </respcondition>
          <respcondition continue="Yes">
            <conditionvar><other/></conditionvar>
            <displayfeedback feedbacktype="Response" linkrefid="${xml(`${question.id}_incorrect_fb`)}"/>
          </respcondition>
        </resprocessing>
${feedback}
      </item>`;
  }

  const lid = responseLid(question.id);
  const generalFeedback = qtiItemFeedback(`${question.id}_general_fb`, question.feedback || question.correctFeedback || "");
  return `      <item ident="${xml(question.id)}" title="${xml(question.stem.slice(0, 72))}">
${itemMetadata}
        <presentation>
${stem}
          <response_str ident="${xml(lid)}" rcardinality="Single">
            <render_fib><response_label ident="${xml(`${question.id}_answer`)}" rshuffle="No"/></render_fib>
          </response_str>
        </presentation>
        <resprocessing>
          <outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>
          <respcondition continue="No">
            <conditionvar><other/></conditionvar>
            <displayfeedback feedbacktype="Response" linkrefid="${xml(`${question.id}_general_fb`)}"/>
          </respcondition>
        </resprocessing>
${generalFeedback}
      </item>`;
};

const createAssessmentQtiXml = (quiz: Quiz, canvasFlavor: boolean): string => `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop xmlns="${QTI_NAMESPACE}" xmlns:xsi="${XSI}" xsi:schemaLocation="${QTI_NAMESPACE} ${
  canvasFlavor ? "http://www.imsglobal.org/xsd/ims_qtiasiv1p2p1.xsd" : "http://www.imsglobal.org/profile/cc/ccv1p1/ccv1p1_qtiasiv1p2p1_v1p0.xsd"
}">
  <assessment ident="${xml(quiz.id)}" title="${xml(quiz.title)}">
    <qtimetadata>
      ${canvasFlavor ? "" : "<qtimetadatafield><fieldlabel>cc_profile</fieldlabel><fieldentry>cc.exam.v0p1</fieldentry></qtimetadatafield>"}
      ${canvasFlavor ? "" : "<qtimetadatafield><fieldlabel>qmd_assessmenttype</fieldlabel><fieldentry>Examination</fieldentry></qtimetadatafield>"}
      ${canvasFlavor ? "" : "<qtimetadatafield><fieldlabel>qmd_scoretype</fieldlabel><fieldentry>Percentage</fieldentry></qtimetadatafield>"}
      <qtimetadatafield><fieldlabel>points_possible</fieldlabel><fieldentry>${quiz.points}</fieldentry></qtimetadatafield>
      <qtimetadatafield><fieldlabel>cc_maxattempts</fieldlabel><fieldentry>1</fieldentry></qtimetadatafield>
      <qtimetadatafield><fieldlabel>aligned_outcome_identifierrefs</fieldlabel><fieldentry>${xml(quiz.alignedOutcomeIds.join(","))}</fieldentry></qtimetadatafield>
    </qtimetadata>
    <section ident="root_section">
${quiz.questions.map((question) => createQtiItem(question, canvasFlavor)).join("\n")}
    </section>
  </assessment>
</questestinterop>`;

const createAssessmentMetaXml = (quiz: Quiz): string => `<?xml version="1.0" encoding="UTF-8"?>
<quiz identifier="${xml(quiz.id)}" ${canvasSchemaAttrs}>
  <title>${xml(quiz.title)}</title>
  <description>${xml(quiz.purpose)}</description>
  <workflow_state>${workflowState(quiz.publishState)}</workflow_state>
  <shuffle_answers>${quiz.shuffleAnswers ? "true" : "false"}</shuffle_answers>
  <scoring_policy>keep_highest</scoring_policy>
  <hide_results></hide_results>
  <quiz_type>assignment</quiz_type>
  <points_possible>${quiz.points}</points_possible>
  ${quiz.dueAt ? `<due_at>${xml(quiz.dueAt)}</due_at>` : ""}
  <allowed_attempts>${quiz.allowedAttempts ?? 1}</allowed_attempts>
  <one_question_at_a_time>false</one_question_at_a_time>
  <cant_go_back>false</cant_go_back>
  <available>true</available>
  <assignment_group_identifierref>${xml(quiz.assignmentGroupId)}</assignment_group_identifierref>
  <aligned_outcome_identifierrefs>${xml(quiz.alignedOutcomeIds.join(","))}</aligned_outcome_identifierrefs>
</quiz>`;

const createManifest = (course: CourseProject): string => {
  const courseSettingsFiles = [
    "course_settings/course_settings.xml",
    "course_settings/module_meta.xml",
    "course_settings/assignment_groups.xml",
    "course_settings/rubrics.xml",
    "course_settings/learning_outcomes.xml",
    "course_settings/course_navigation.xml",
    "course_settings/context.xml",
    "course_settings/canvas_export.txt"
  ];

  const pageResources = course.pages
    .map(
      (page) => `    <resource identifier="${xml(page.id)}" type="${resourceType.webcontent}" href="${xml(pagePath(page))}">
      <file href="${xml(pagePath(page))}" />
    </resource>`
    )
    .join("\n");

  const assignmentResources = course.assignments
    .map(
      (assignment) => `    <resource identifier="${xml(assignment.id)}" type="${resourceType.learningApplicationResource}" href="${xml(assignmentPath(assignment))}">
      <file href="${xml(assignmentPath(assignment))}" />
      <file href="${xml(assignmentSettingsPath(assignment))}" />
    </resource>`
    )
    .join("\n");

  const discussionResources = course.discussions
    .map(
      (discussion) => `    <resource identifier="${xml(discussion.id)}" type="${resourceType.discussionTopic}">
      <file href="${xml(discussionPath(discussion))}" />
      <dependency identifierref="${xml(`${discussion.id}_meta`)}" />
    </resource>
    <resource identifier="${xml(`${discussion.id}_meta`)}" type="${resourceType.learningApplicationResource}" href="${xml(discussionMetaPath(discussion))}">
      <file href="${xml(discussionMetaPath(discussion))}" />
    </resource>`
    )
    .join("\n");

  const announcementResources = courseAnnouncements(course)
    .map(
      (announcement) => `    <resource identifier="${xml(announcement.id)}" type="${resourceType.discussionTopic}">
      <file href="${xml(announcementPath(announcement))}" />
      <dependency identifierref="${xml(`${announcement.id}_meta`)}" />
    </resource>
    <resource identifier="${xml(`${announcement.id}_meta`)}" type="${resourceType.learningApplicationResource}" href="${xml(announcementMetaPath(announcement))}">
      <file href="${xml(announcementMetaPath(announcement))}" />
    </resource>`
    )
    .join("\n");

  const quizResources = course.quizzes
    .map(
      (quiz) => `    <resource identifier="${xml(quiz.id)}" type="${resourceType.assessment}">
      <file href="${xml(quizCcPath(quiz))}" />
      <dependency identifierref="${xml(`${quiz.id}_canvas`)}" />
    </resource>
    <resource identifier="${xml(`${quiz.id}_canvas`)}" type="${resourceType.learningApplicationResource}" href="${xml(quizMetaPath(quiz))}">
      <file href="${xml(quizMetaPath(quiz))}" />
      <file href="${xml(quizCanvasQtiPath(quiz))}" />
    </resource>`
    )
    .join("\n");

  const assetResources = course.fileAssets
    .map(
      (asset) => `    <resource identifier="${xml(asset.id)}" type="${resourceType.webcontent}" href="${xml(asset.path)}">
      <file href="${xml(asset.path)}" />
    </resource>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${xml(`common_cartridge_${course.id}`)}"
  xmlns="${CC_NAMESPACE}"
  xmlns:lom="${LOM_RESOURCE}"
  xmlns:lomimscc="${LOM_MANIFEST}"
  xmlns:xsi="${XSI}"
  xsi:schemaLocation="${CC_NAMESPACE} http://www.imsglobal.org/profile/cc/ccv1p1/ccv1p1_imscp_v1p2_v1p0.xsd ${LOM_RESOURCE} http://www.imsglobal.org/profile/cc/ccv1p1/LOM/ccv1p1_lomresource_v1p0.xsd ${LOM_MANIFEST} http://www.imsglobal.org/profile/cc/ccv1p1/LOM/ccv1p1_lommanifest_v1p0.xsd">
  <metadata>
    <schema>IMS Common Cartridge</schema>
    <schemaversion>1.1.0</schemaversion>
    <lomimscc:lom>
      <lomimscc:general><lomimscc:title><lomimscc:string>${xml(course.title)}</lomimscc:string></lomimscc:title></lomimscc:general>
      <lomimscc:lifeCycle><lomimscc:contribute><lomimscc:date><lomimscc:dateTime>${new Date().toISOString()}</lomimscc:dateTime></lomimscc:date></lomimscc:contribute></lomimscc:lifeCycle>
    </lomimscc:lom>
  </metadata>
  <organizations>
    <organization identifier="org_${xml(course.id)}" structure="rooted-hierarchy">
      <title>${xml(course.title)}</title>
${course.modules
  .map(
    (module) => `      <item identifier="${xml(`${module.id}_org`)}">
        <title>${xml(module.title)}</title>
${module.items
  .filter((item) => item.type !== "subheader")
  .map((item) => `        <item identifier="${xml(`${item.id}_org`)}" identifierref="${xml(item.refId)}"><title>${xml(item.title)}</title></item>`)
  .join("\n")}
      </item>`
  )
  .join("\n")}
    </organization>
  </organizations>
  <resources>
    <resource identifier="${xml(course.id)}" type="${resourceType.learningApplicationResource}" href="course_settings/canvas_export.txt">
${courseSettingsFiles.map((file) => `      <file href="${xml(file)}" />`).join("\n")}
    </resource>
    <resource identifier="${xml(`${course.id}_syllabus`)}" type="${resourceType.learningApplicationResource}" href="course_settings/syllabus.html" intendeduse="syllabus">
      <file href="course_settings/syllabus.html" />
    </resource>
${pageResources}
${assignmentResources}
${discussionResources}
${announcementResources}
${quizResources}
${assetResources}
  </resources>
</manifest>`;
};

const printableHtml = (title: string, bodyHtml: string): string =>
  wrappedHtmlDocument(
    title,
    `<div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.55; max-width: 760px; margin: 0 auto;">${bodyHtml}</div>`,
    { printable: "true" }
  );

export const buildImsccZip = async (input: CourseProject): Promise<JSZip> => {
  // Safety net: repair structural corruption (dangling refs, moduleId drift, weights, slugs) before
  // building so a messy editing session can never produce a broken package. Idempotent.
  const { course } = repairCourse(input);
  const zip = new JSZip();
  const syllabusPage = course.pages.find((page) => page.slug === "syllabus");
  const instructorGuidePage = course.pages.find((page) => page.slug === "instructor-guide");

  zip.file("imsmanifest.xml", createManifest(course));
  zip.file("course_settings/course_settings.xml", createCourseSettingsXml(course));
  zip.file("course_settings/module_meta.xml", createModuleMetaXml(course));
  zip.file("course_settings/assignment_groups.xml", createAssignmentGroupsXml(course));
  zip.file("course_settings/rubrics.xml", createRubricsXml(course.rubrics));
  zip.file("course_settings/learning_outcomes.xml", createLearningOutcomesXml(course));
  zip.file("course_settings/course_navigation.xml", createCourseNavigationXml(course));
  zip.file("course_settings/context.xml", createContextInfoXml(course));
  zip.file("course_settings/canvas_export.txt", createCanvasExportFlag());
  zip.file("course_settings/syllabus.html", wrappedHtmlDocument("Syllabus", syllabusPage?.bodyHtml ?? ""));
  zip.file("web_resources/course-banner.svg", createBannerSvg(course));
  zip.file("web_resources/course-tile.svg", createCourseTileSvg(course));
  // Per-module header banners (opt-in). The generator references web_resources/module-<N>-header.svg
  // on each CONTENT module's overview page, where <N> is the module number embedded in its id
  // ("module_3"). Key off that id — not the array index — so Start Here / Final / Instructor modules
  // don't shift the numbering and every reference resolves to the right SVG.
  if (course.settings.imageSettings?.moduleHeaderImages) {
    course.modules.forEach((module) => {
      const match = /^module_(\d+)$/.exec(module.id);
      if (match) {
        const moduleNumber = Number(match[1]);
        zip.file(`web_resources/module-${moduleNumber}-header.svg`, buildModuleHeaderSvg(course.theme, moduleNumber, module.title));
      }
    });
  }
  zip.file("web_resources/syllabus-printable.html", printableHtml("Printable Syllabus", syllabusPage?.bodyHtml ?? ""));
  zip.file(
    "web_resources/syllabus-printable.pdf",
    createSimplePdf(`${course.title} Syllabus`, [
      stripHtml(syllabusPage?.bodyHtml ?? "").slice(0, 2800),
      "Generated by RocketCourse. Review in Canvas before publishing."
    ])
  );
  zip.file("web_resources/instructor-guide-printable.html", printableHtml("Instructor Guide", instructorGuidePage?.bodyHtml ?? ""));
  zip.file(
    "web_resources/instructor-guide.pdf",
    createSimplePdf("Instructor Guide", [
      stripHtml(instructorGuidePage?.bodyHtml ?? "").slice(0, 2800),
      "Canvas sandbox import verification is still required."
    ])
  );

  course.pages.forEach((page) => {
    zip.file(pagePath(page), wrappedWikiPage(page));
  });

  course.assignments.forEach((assignment) => {
    zip.file(assignmentPath(assignment), wrappedHtmlDocument(`Assignment: ${assignment.title}`, assignment.descriptionHtml));
    zip.file(assignmentSettingsPath(assignment), createAssignmentXml(assignment));
  });

  course.discussions.forEach((discussion) => {
    zip.file(discussionPath(discussion), createDiscussionXml(discussion));
    zip.file(discussionMetaPath(discussion), createDiscussionMetaXml(discussion));
  });

  courseAnnouncements(course).forEach((announcement) => {
    zip.file(announcementPath(announcement), createAnnouncementXml(announcement));
    zip.file(announcementMetaPath(announcement), createAnnouncementMetaXml(announcement));
  });

  course.quizzes.forEach((quiz) => {
    zip.file(quizCcPath(quiz), createAssessmentQtiXml(quiz, false));
    zip.file(quizMetaPath(quiz), createAssessmentMetaXml(quiz));
    zip.file(quizCanvasQtiPath(quiz), createAssessmentQtiXml(quiz, true));
  });

  zip.file(
    "rocketcourse-readme.txt",
    [
      "RocketCourse Canvas Builder export",
      `Export mode: ${course.exportMode}`,
      "This package is generated from structured course data.",
      "The package includes Canvas-flavored course metadata, navigation defaults, assignment groups, rubrics, outcomes, guide assets, and Common Cartridge resources.",
      "Canvas may duplicate edited objects when reimporting into an existing course.",
      "Canvas sandbox import verification is still required before production compatibility claims."
    ].join("\n")
  );

  return zip;
};

const htmlBlocks = (course: CourseProject): Array<{ id: string; title: string; html: string }> => [
  ...course.pages.map((page) => ({ id: page.id, title: page.title, html: page.bodyHtml })),
  ...course.assignments.map((assignment) => ({ id: assignment.id, title: assignment.title, html: assignment.descriptionHtml })),
  ...course.discussions.map((discussion) => ({ id: discussion.id, title: discussion.title, html: discussion.promptHtml }))
];

const hrefsFrom = (html: string): string[] => Array.from(html.matchAll(/href\s*=\s*["']([^"']*)["']/gi)).map((match) => match[1].trim());
const placeholderHref = (href: string): boolean => href === "" || href === "#" || /^javascript:/i.test(href) || href.includes("TODO_LINK");
const externalHref = (href: string): boolean => /^(https?:|mailto:|tel:)/i.test(href);
const normalizeHref = (href: string): string => href.split("#")[0].split("?")[0].replace(/^\.\//, "");
const pageLinkTargets = (course: CourseProject): Set<string> =>
  new Set(course.pages.flatMap((page) => [page.slug, `${slugify(page.slug || page.title)}.html`, `wiki_content/${slugify(page.slug || page.title)}.html`]));
const resourceLinkTargets = (course: CourseProject): Set<string> =>
  new Set(course.fileAssets.flatMap((asset) => [asset.path, `../${asset.path}`, asset.fileName]));
const dateOnly = (iso?: string): string | undefined => iso?.slice(0, 10);
const dateInTerm = (iso: string | undefined, start?: string, end?: string): boolean => {
  const value = dateOnly(iso);
  if (!value) return false;
  if (start && value < start) return false;
  if (end && value > end) return false;
  return true;
};
const isBlockedDate = (iso: string | undefined, blockedDates: Set<string>): boolean => {
  const value = dateOnly(iso);
  return Boolean(value && blockedDates.has(value));
};

export const validateImsccZip = async (input: CourseProject, zip: JSZip): Promise<ExportValidationReport> => {
  // Validate against the same repaired course the package was built from (repair is deterministic).
  const { course } = repairCourse(input);
  const files = Object.keys(zip.files).filter((path) => !zip.files[path].dir).sort();
  const issues: ExportValidationIssue[] = [];
  const readiness = buildReadinessReport(course);
  const fail = (id: string, message: string): void => {
    issues.push({ id, message, severity: "error" });
  };
  const warn = (id: string, message: string): void => {
    issues.push({ id, message, severity: "warning" });
  };

  if (!zip.file("imsmanifest.xml")) fail("manifest-missing", "imsmanifest.xml is required.");
  if (!zip.file("course_settings/canvas_export.txt")) fail("canvas-export-flag-missing", "course_settings/canvas_export.txt is required for Canvas-flavored course exports.");
  if (!zip.file("course_settings/course_settings.xml")) fail("course-settings-missing", "course_settings/course_settings.xml is required.");
  if (!zip.file("course_settings/module_meta.xml")) fail("module-meta-missing", "course_settings/module_meta.xml is required for Canvas module order.");
  if (!zip.file("course_settings/assignment_groups.xml")) fail("assignment-groups-missing", "course_settings/assignment_groups.xml is required for gradebook grouping.");
  if (!zip.file("course_settings/course_navigation.xml")) warn("navigation-missing", "course_settings/course_navigation.xml was not found.");
  if (!zip.file("course_settings/rubrics.xml")) warn("rubrics-missing", "course_settings/rubrics.xml was not found.");
  if (!zip.file("course_settings/learning_outcomes.xml")) warn("outcomes-missing", "course_settings/learning_outcomes.xml was not found.");
  if (!zip.file("web_resources/syllabus-printable.pdf")) fail("syllabus-pdf-missing", "Printable syllabus PDF is missing.");
  if (!zip.file("web_resources/instructor-guide.pdf")) fail("instructor-guide-pdf-missing", "Instructor guide PDF is missing.");

  const groupIds = new Set(course.assignmentGroups.map((group) => group.id));
  const activeGroupUse = new Map<string, number>();
  const rubricIds = new Set(course.rubrics.map((rubric) => rubric.id));
  const outcomeIds = new Set(course.outcomes.map((outcome) => outcome.id));
  const blockedDates = new Set([...(course.settings.schedule.holidays ?? []), ...(course.settings.schedule.blackoutDates ?? [])]);
  const validateDueDate = (id: string, title: string, dueAt: string | undefined): void => {
    if (!course.settings.schedule.enableDueDates) return;
    if (!dueAt) {
      fail(`due-date-missing-${id}`, `${title} is missing a due date while due dates are enabled.`);
      return;
    }
    if (!dateInTerm(dueAt, course.settings.schedule.termStartDate, course.settings.schedule.termEndDate) && !course.settings.schedule.allowDueDatesOutsideTerm) {
      fail(`due-date-outside-term-${id}`, `${title} has a due date outside the configured term.`);
    }
    if (isBlockedDate(dueAt, blockedDates)) fail(`due-date-blocked-${id}`, `${title} is due on a holiday or blackout date.`);
  };

  course.assignments.forEach((assignment) => {
    if (!zip.file(assignmentPath(assignment))) fail(`missing-assignment-${assignment.id}`, `Missing assignment HTML for ${assignment.title}.`);
    if (!zip.file(assignmentSettingsPath(assignment))) fail(`missing-assignment-settings-${assignment.id}`, `Missing assignment settings for ${assignment.title}.`);
    if (!groupIds.has(assignment.assignmentGroupId)) fail(`assignment-group-${assignment.id}`, `${assignment.title} references a missing assignment group.`);
    activeGroupUse.set(assignment.assignmentGroupId, (activeGroupUse.get(assignment.assignmentGroupId) ?? 0) + 1);
    // A DANGLING rubric/outcome reference (points at something deleted) is a broken package → error.
    // An ABSENT rubric/outcome is valid for Canvas import → warning (so deleting one never blocks export).
    if (assignment.rubricId && !rubricIds.has(assignment.rubricId)) fail(`assignment-rubric-${assignment.id}`, `${assignment.title} references a rubric that no longer exists.`);
    else if (!assignment.rubricId && course.rubrics.length > 0) warn(`assignment-rubric-missing-${assignment.id}`, `${assignment.title} is graded without a rubric.`);
    if (assignment.alignedOutcomeIds.some((outcomeId) => !outcomeIds.has(outcomeId))) fail(`assignment-outcomes-${assignment.id}`, `${assignment.title} aligns to an outcome that no longer exists.`);
    else if (assignment.alignedOutcomeIds.length === 0) warn(`assignment-outcomes-${assignment.id}`, `${assignment.title} has no outcome alignment.`);
    validateDueDate(assignment.id, assignment.title, assignment.dueAt);
  });

  course.discussions.forEach((discussion) => {
    if (!zip.file(discussionPath(discussion))) fail(`missing-discussion-${discussion.id}`, `Missing discussion topic file for ${discussion.title}.`);
    if (!zip.file(discussionMetaPath(discussion))) fail(`missing-discussion-meta-${discussion.id}`, `Missing discussion metadata for ${discussion.title}.`);
    if (discussion.points > 0) {
      if (!groupIds.has(discussion.assignmentGroupId)) fail(`discussion-group-${discussion.id}`, `${discussion.title} references a missing assignment group.`);
      activeGroupUse.set(discussion.assignmentGroupId, (activeGroupUse.get(discussion.assignmentGroupId) ?? 0) + 1);
      if (discussion.rubricId && !rubricIds.has(discussion.rubricId)) fail(`discussion-rubric-${discussion.id}`, `${discussion.title} references a rubric that no longer exists.`);
      else if (!discussion.rubricId && course.rubrics.length > 0) warn(`discussion-rubric-missing-${discussion.id}`, `${discussion.title} is graded without a rubric.`);
      if (discussion.alignedOutcomeIds.some((outcomeId) => !outcomeIds.has(outcomeId))) fail(`discussion-outcomes-${discussion.id}`, `${discussion.title} aligns to an outcome that no longer exists.`);
      else if (discussion.alignedOutcomeIds.length === 0) warn(`discussion-outcomes-${discussion.id}`, `${discussion.title} has no outcome alignment.`);
      validateDueDate(discussion.id, discussion.title, discussion.dueAt);
    }
  });

  course.quizzes.forEach((quiz) => {
    if (!zip.file(quizCcPath(quiz))) fail(`missing-quiz-qti-${quiz.id}`, `Missing Common Cartridge QTI file for ${quiz.title}.`);
    if (!zip.file(quizMetaPath(quiz))) fail(`missing-quiz-meta-${quiz.id}`, `Missing Canvas quiz metadata for ${quiz.title}.`);
    if (!zip.file(quizCanvasQtiPath(quiz))) fail(`missing-quiz-canvas-qti-${quiz.id}`, `Missing Canvas-flavored QTI file for ${quiz.title}.`);
    if (!groupIds.has(quiz.assignmentGroupId)) fail(`quiz-group-${quiz.id}`, `${quiz.title} references a missing assignment group.`);
    activeGroupUse.set(quiz.assignmentGroupId, (activeGroupUse.get(quiz.assignmentGroupId) ?? 0) + 1);
    if (quiz.alignedOutcomeIds.length === 0 || quiz.alignedOutcomeIds.some((outcomeId) => !outcomeIds.has(outcomeId))) fail(`quiz-outcomes-${quiz.id}`, `${quiz.title} is missing valid outcome alignment.`);
    validateDueDate(quiz.id, quiz.title, quiz.dueAt);
  });

  course.rubrics.forEach((rubric) => {
    if (rubric.alignedOutcomeIds.length === 0 || rubric.alignedOutcomeIds.some((outcomeId) => !outcomeIds.has(outcomeId))) {
      fail(`rubric-outcomes-${rubric.id}`, `${rubric.title} is missing valid outcome alignment.`);
    }
  });

  const groupTotal = course.assignmentGroups.reduce((sum, group) => sum + Number(group.weight || 0), 0);
  if (Math.round(groupTotal) !== 100) fail("assignment-group-total", `Assignment group weights total ${groupTotal}%, not 100%.`);
  course.assignmentGroups.forEach((group) => {
    if ((activeGroupUse.get(group.id) ?? 0) > 0 && Number(group.weight) === 0) fail(`assignment-group-zero-${group.id}`, `${group.name} has graded items but 0% weight.`);
  });

  const finalModule = course.modules.find((module) => module.kind === "final");
  const instructorModule = course.modules.find((module) => module.kind === "instructor");
  if (!finalModule) fail("final-module-missing", "Final Project module is required.");
  if (!instructorModule) fail("instructor-module-missing", "Instructor Guide module is required.");
  if (instructorModule && instructorModule.publishState !== "unpublished") fail("instructor-module-published", "Instructor Guide module must be unpublished by default.");

  course.modules
    .filter((module) => module.kind === "content")
    .forEach((module) => {
      if (!module.items.some((item) => item.type === "page" && /(overview|about )/i.test(item.title))) fail(`module-overview-${module.id}`, `${module.title} is missing an About/overview page.`);
      if (!module.items.some((item) => item.type === "page" && /(wrap|recap|end of )/i.test(item.title))) fail(`module-recap-${module.id}`, `${module.title} is missing an End/recap page.`);
    });

  course.pages.forEach((page) => {
    if (!zip.file(pagePath(page))) fail(`missing-page-${page.id}`, `Missing page file for ${page.title}.`);
  });
  validatePagePlan(course).issues.forEach((issue) => {
    const id = `page-quality-${issue.id}`;
    if (issue.severity === "error") fail(id, issue.detail);
    else warn(id, issue.detail);
  });

  htmlBlocks(course).forEach((block) => {
    const blockUnsafeReasons = unsafeHtmlReasons(block.html);
    if (blockUnsafeReasons.length > 0) fail(`unsafe-html-${block.id}`, `${block.title} includes Canvas-hostile HTML: ${blockUnsafeReasons.join(", ")}.`);
    hrefsFrom(block.html).forEach((href) => {
      if (placeholderHref(href)) fail(`placeholder-link-${block.id}`, `${block.title} includes a placeholder or unsafe link: ${href || "(empty)"}.`);
    });
  });

  const knownPageTargets = pageLinkTargets(course);
  const knownResourceTargets = resourceLinkTargets(course);
  // Canvas substitution tokens are the links that actually resolve in an imported course.
  const knownTokenTargets = canvasRefTargets(course);
  htmlBlocks(course).forEach((block) => {
    hrefsFrom(block.html)
      .filter((href) => !placeholderHref(href) && !externalHref(href) && !href.startsWith("#"))
      .forEach((href) => {
        const normalized = normalizeHref(href);
        if (!normalized) return;
        if (isCanvasRef(href)) {
          // A Canvas token that doesn't resolve to a real object is a broken link in the imported course.
          if (!canvasRefResolves(href, course)) {
            warn(`broken-internal-link-${block.id}-${slugify(href).slice(0, 40)}`, `${block.title} links to a missing Canvas object: ${href}.`);
          }
          return;
        }
        if (!knownPageTargets.has(normalized) && !knownResourceTargets.has(normalized) && !knownTokenTargets.has(normalized)) {
          warn(`broken-internal-link-${block.id}-${slugify(href).slice(0, 40)}`, `${block.title} links to missing internal content or file: ${href}.`);
        }
      });
  });

  course.modules.forEach((module) => {
    module.items.forEach((item) => {
      if (item.type === "subheader") return; // text headers have no backing object
      const exists =
        course.pages.some((page) => page.id === item.refId) ||
        course.assignments.some((assignment) => assignment.id === item.refId) ||
        course.discussions.some((discussion) => discussion.id === item.refId) ||
        course.quizzes.some((quiz) => quiz.id === item.refId);
      if (!exists) fail(`broken-module-ref-${item.id}`, `Module item "${item.title}" references a missing object.`);
    });
  });
  validateModulePlan(course).issues
    .filter((issue) => /-module-mismatch$/.test(issue.id))
    .forEach((issue) => fail(`module-object-alignment-${issue.itemId ?? issue.id}`, issue.detail));
  validateAssignmentPlan(course).issues.forEach((issue) => {
    const id = `assignment-quality-${issue.id}`;
    if (issue.severity === "error") fail(id, issue.detail);
    else warn(id, issue.detail);
  });
  validateDiscussionPlan(course).issues.forEach((issue) => {
    const id = `discussion-quality-${issue.id}`;
    if (issue.severity === "error") fail(id, issue.detail);
    else warn(id, issue.detail);
  });
  validateQuizPlan(course).issues.forEach((issue) => {
    const id = `quiz-quality-${issue.id}`;
    if (issue.severity === "error") fail(id, issue.detail);
    else warn(id, issue.detail);
  });
  validateRubricPlan(course).issues.forEach((issue) => {
    const id = `rubric-quality-${issue.id}`;
    if (issue.severity === "error") fail(id, issue.detail);
    else warn(id, issue.detail);
  });

  if (readiness.blockers > 0) {
    warn("readiness-blockers", `${readiness.blockers} readiness blocker(s) should be resolved before Canvas import.`);
  }

  const manifestText = await zip.file("imsmanifest.xml")?.async("text");
  const resourceIdList = Array.from(manifestText?.matchAll(/<resource\s+identifier="([^"]+)"/g) ?? []).map((match) => match[1]);
  const resourceIds = new Set(resourceIdList);
  const identifierRefs = Array.from(manifestText?.matchAll(/identifierref="([^"]+)"/g) ?? []).map((match) => match[1]);
  identifierRefs.forEach((ref) => {
    if (!resourceIds.has(ref)) fail(`missing-resource-${ref}`, `Manifest identifierref ${ref} does not point to a resource.`);
  });

  // Duplicate resource identifiers make the manifest ambiguous; Canvas can drop or mis-link the
  // second resource on import, so they are a hard error.
  const seenResourceIds = new Set<string>();
  resourceIdList.forEach((id) => {
    if (seenResourceIds.has(id)) fail(`duplicate-resource-${id}`, `Manifest declares more than one resource with identifier "${id}".`);
    seenResourceIds.add(id);
  });

  const fileRefs = Array.from(manifestText?.matchAll(/<file\s+href="([^"]+)"/g) ?? []).map((match) => match[1]);
  fileRefs.forEach((ref) => {
    if (!zip.file(ref)) fail(`missing-file-${ref}`, `Manifest file reference ${ref} is missing from the package.`);
  });

  // A required descriptor or the syllabus can exist yet be empty (e.g. a generation bug writes a
  // blank string). Canvas's importer treats an empty descriptor as malformed, so flag any present-
  // but-empty required file. Empty XML is already caught by the parse step below; this covers the
  // non-XML required files too.
  const requiredNonEmptyFiles = [
    "imsmanifest.xml",
    "course_settings/course_settings.xml",
    "course_settings/module_meta.xml",
    "course_settings/assignment_groups.xml",
    "course_settings/canvas_export.txt",
    "course_settings/syllabus.html"
  ];
  for (const path of requiredNonEmptyFiles) {
    const entry = zip.file(path);
    if (!entry) continue; // a genuinely missing required file is already reported above
    const content = await entry.async("text");
    if (content.trim().length === 0) fail(`empty-required-${path}`, `Required file ${path} is present but empty.`);
  }

  // Parse every generated XML document (manifest, course settings, QTI, meta, SVG) and fail
  // the package on any that is not well-formed, naming the exact file and parse error. Canvas
  // aborts an import the moment its XML parser hits a malformed descriptor, so this is a hard
  // error rather than a warning.
  const xmlParseErrors = await collectXmlParseErrors(zip);
  xmlParseErrors.forEach((error) => {
    fail(`malformed-xml-${error.path}`, formatXmlParseError(error));
  });

  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;

  // Errors are blocking and dominate the score (18 each). Warnings are advisory — a package
  // with zero errors still imports — so their penalty is capped (max 30 total). Without the
  // cap, a perfectly valid course with many minor warnings (e.g. unresolved external links)
  // would read as "passed (score 0)", which is alarming and contradictory. With it, a valid
  // package never scores below 70; errors are what pull it down.
  const WARNING_PENALTY_CAP = 30;

  return {
    valid: errorCount === 0,
    score: Math.max(0, 100 - errorCount * 18 - Math.min(warningCount * 5, WARNING_PENALTY_CAP)),
    packageName: `${slugify(course.title)}.imscc`,
    checkedAt: new Date().toISOString(),
    issues,
    files,
    sandboxImportStatus: "not_tested"
  };
};

export const generateImsccBlob = async (
  course: CourseProject,
  mode: ExportMode = course.exportMode
): Promise<{ blob: Blob; report: ExportValidationReport; fileName: string }> => {
  const exportCourse: CourseProject = { ...course, exportMode: mode };
  const zip = await buildImsccZip(exportCourse);
  const report = await validateImsccZip(exportCourse, zip);
  const blob = await zip.generateAsync({ type: "blob", mimeType: "application/zip" });
  return { blob, report, fileName: report.packageName };
};

// --- Standalone QTI export ---------------------------------------------------
// A QTI-only Common Cartridge (manifest + assessment XML) that Canvas imports via
// "Import Course Content -> QTI .zip file". Reuses the same CC-flavored QTI the full
// package uses, so a quiz exported on its own is identical to the one inside the .imscc.
const qtiPackageManifest = (quizzes: Quiz[]): string => {
  const resources = quizzes
    .map(
      (quiz) => `    <resource identifier="${xml(quiz.id)}" type="${resourceType.assessment}" href="${xml(quizCcPath(quiz))}">
      <file href="${xml(quizCcPath(quiz))}" />
    </resource>`
    )
    .join("\n");
  const items = quizzes
    .map((quiz) => `        <item identifier="${xml(`${quiz.id}_org`)}" identifierref="${xml(quiz.id)}"><title>${xml(quiz.title)}</title></item>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="qti_export" xmlns="${CC_NAMESPACE}" xmlns:lom="${LOM_RESOURCE}" xmlns:lomimscc="${LOM_MANIFEST}" xmlns:xsi="${XSI}">
  <metadata><schema>IMS Common Cartridge</schema><schemaversion>1.1.0</schemaversion></metadata>
  <organizations>
    <organization identifier="org_qti" structure="rooted-hierarchy">
      <item identifier="qti_root">
${items}
      </item>
    </organization>
  </organizations>
  <resources>
${resources}
  </resources>
</manifest>`;
};

const buildQtiZip = async (quizzes: Quiz[]): Promise<Blob> => {
  const zip = new JSZip();
  zip.file("imsmanifest.xml", qtiPackageManifest(quizzes));
  quizzes.forEach((quiz) => zip.file(quizCcPath(quiz), createAssessmentQtiXml(quiz, false)));
  return zip.generateAsync({ type: "blob", mimeType: "application/zip" });
};

/** Export one quiz as a standalone Canvas-importable QTI .zip. */
export const generateQuizQtiBlob = async (quiz: Quiz): Promise<{ blob: Blob; fileName: string }> => ({
  blob: await buildQtiZip([quiz]),
  fileName: `${slugify(quiz.title || quiz.id)}-qti.zip`
});

/** Export every quiz in the course as one bulk QTI .zip. */
export const generateAllQuizzesQtiBlob = async (course: CourseProject): Promise<{ blob: Blob; fileName: string; count: number }> => ({
  blob: await buildQtiZip(course.quizzes),
  fileName: `${slugify(course.title || "course")}-all-quizzes-qti.zip`,
  count: course.quizzes.length
});
