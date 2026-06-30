// ============================================================================
// Syllabus PDF export
// ----------------------------------------------------------------------------
// A clean, printable PDF of the course syllabus, built from the same syllabus
// page that becomes the Canvas syllabus — so the PDF and the Canvas page stay
// aligned. Renders the page's real structure (headings, lists, paragraphs).
// ============================================================================

import type { CourseProject, CoursePage } from "../types";
import { slugify } from "../utils/text";
import { PdfDoc } from "./pdfDoc";
import { defaultSyllabusContent, syllabusContextFromCourse } from "./syllabusTemplates";

/** The page that backs the Canvas syllabus (slug "syllabus"), if present. */
export const findSyllabusPage = (course: CourseProject): CoursePage | undefined =>
  course.pages.find((page) => page.slug === "syllabus") ??
  course.pages.find((page) => /syllabus/i.test(page.title));

const buildSyllabusDoc = (course: CourseProject): PdfDoc => {
  const doc = new PdfDoc().theme(course.theme.accent, course.theme.accentDark);
  doc.setFooter(`${course.title || "Course"} - Syllabus`);
  const settings = course.settings;
  const schedule = settings.schedule;
  const content = defaultSyllabusContent(syllabusContextFromCourse(course));
  const contentModules = course.modules.filter((module) => module.kind === "content");
  const termLabel = schedule.termStartDate ? `${schedule.termStartDate}${schedule.termEndDate ? ` to ${schedule.termEndDate}` : ""}` : "See Canvas course calendar";

  doc.title(course.title || "Course Syllabus");
  doc.subtitle(`${settings.level || "Course"} | ${settings.modality || "Canvas course"} | ${settings.creditHours || 0} credits | ${settings.lengthWeeks} weeks`);
  doc.para(content.courseDescription);
  doc.spacer(4);

  doc.heading("Course at a Glance", 14);
  if (settings.level) doc.keyValue("Level:", settings.level);
  if (settings.modality) doc.keyValue("Modality:", settings.modality);
  if (settings.creditHours) doc.keyValue("Credit hours:", String(settings.creditHours));
  doc.keyValue("Length:", `${settings.lengthWeeks} weeks`);
  doc.keyValue("Modules:", String(contentModules.length));
  doc.keyValue("Term:", termLabel);
  doc.spacer(4);

  doc.heading("How This Course Works", 14);
  doc.para(content.scheduleSummary);
  [
    "Begin each module with the overview page before opening graded work.",
    "Use module materials as the evidence base for discussions, quizzes, and assignments.",
    "Review rubrics and examples before submitting.",
    "Read feedback before starting the next major task."
  ].forEach((item) => doc.bullet(item));

  if (content.learningOutcomes.length) {
    doc.heading("Course Learning Outcomes", 14);
    content.learningOutcomes.forEach((outcome) => doc.bullet(outcome));
  }

  if (content.gradingBreakdown.length) {
    doc.heading("Assignment Categories and Grading", 14);
    content.gradingBreakdown.forEach((item) => doc.bullet(item));
  }

  if (content.assignmentOverview.length) {
    doc.heading("Major Work and Success Expectations", 14);
    content.assignmentOverview.slice(0, 14).forEach((item) => doc.bullet(item));
  }

  doc.heading("Weekly Schedule and Pacing", 14);
  content.weeklySchedule.slice(0, 18).forEach((item) => doc.bullet(item));
  if (content.weeklySchedule.length > 18) doc.note(`Additional schedule items are available in Canvas. Showing first 18 of ${content.weeklySchedule.length}.`);

  doc.heading("Materials and Technology", 14);
  content.requiredMaterials.forEach((item) => doc.bullet(item));
  doc.para(content.technologyRequirements);

  doc.heading("Communication and Help", 14);
  doc.para(content.communicationExpectations);
  content.studentSupportResources.forEach((item) => doc.bullet(item));

  doc.heading("Policies for Success", 14);
  doc.subheading("Late Work", 12);
  doc.para(content.lateWorkPolicy);
  doc.subheading("Academic Integrity", 12);
  doc.para(content.academicIntegrityPolicy);
  doc.subheading("AI Use Guidance", 12);
  doc.para(content.aiUsePolicy);
  doc.subheading("Accessibility and Inclusion", 12);
  doc.para(content.accessibilityAccommodations);

  doc.heading("Workload and Contact Hours", 14);
  doc.para(content.workloadContactHours);

  doc.heading("Instructor Contact", 14);
  doc.para(content.instructorContactBlock);

  doc.spacer(10);
  doc.rule();
  doc.note(
    "This printable syllabus is generated from the RocketCourse syllabus model. Review dates, contact details, " +
      "institutional policies, required materials, links, grading, and accessibility information before publishing."
  );
  return doc;
};

/** The printable syllabus as raw PDF bytes-string (for embedding in the .imscc web_resources). */
export const buildSyllabusPdf = (course: CourseProject): string => buildSyllabusDoc(course).build();

export const buildSyllabusPdfBlob = (course: CourseProject): Blob => buildSyllabusDoc(course).blob();

export const syllabusPdfFileName = (course: CourseProject): string => `${slugify(course.title || "course")}-syllabus.pdf`;
