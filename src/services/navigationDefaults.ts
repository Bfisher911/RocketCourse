import type { CanvasNavigationItem } from "../types";

export const REQUIRED_VISIBLE_NAVIGATION_LABELS = ["Home", "Announcements", "Syllabus", "Modules", "Grades", "People"] as const;

export const REQUIRED_VISIBLE_NAVIGATION_IDS = ["home", "announcements", "syllabus", "modules", "grades", "people"] as const;

export const navigationDefaults = (): CanvasNavigationItem[] => [
  { id: "home", label: "Home", visible: true, reason: "Front page starts students in the guided course path." },
  { id: "announcements", label: "Announcements", visible: true, reason: "Faculty need one clear communication channel." },
  { id: "syllabus", label: "Syllabus", visible: true, reason: "Students need grading, schedule, and policy details." },
  { id: "modules", label: "Modules", visible: true, reason: "Modules are the primary learning path." },
  { id: "grades", label: "Grades", visible: true, reason: "Students need gradebook visibility." },
  { id: "people", label: "People", visible: true, reason: "Useful for class community and group workflows." },
  { id: "assignments", label: "Assignments", visible: false, reason: "Assignments are intentionally reached through Modules by default." },
  { id: "discussions", label: "Discussions", visible: false, reason: "Discussions are intentionally reached through Modules by default." },
  { id: "quizzes", label: "Quizzes", visible: false, reason: "Quizzes are intentionally reached through Modules by default." },
  { id: "pages", label: "Pages", visible: false, reason: "Pages are intentionally reached through Modules by default." },
  { id: "files", label: "Files", visible: false, reason: "Files are linked from relevant pages to avoid exposing a file dump." },
  { id: "outcomes", label: "Outcomes", visible: false, reason: "Outcomes support assessment design but are not a student-facing destination." },
  { id: "rubrics", label: "Rubrics", visible: false, reason: "Rubrics are attached to assignments; students reach them in context." },
  { id: "collaborations", label: "Collaborations", visible: false, reason: "Not used by default; enable only if your design needs it." },
  { id: "conferences", label: "Conferences", visible: false, reason: "Not used by default; enable only for live meeting workflows." }
];

export const visibleNavigationLabels = (navigation: CanvasNavigationItem[]): string[] => navigation.filter((item) => item.visible).map((item) => item.label);

export const navigationMatchesRequiredDefaults = (navigation: CanvasNavigationItem[]): boolean => {
  const visible = visibleNavigationLabels(navigation);
  return visible.length === REQUIRED_VISIBLE_NAVIGATION_LABELS.length && REQUIRED_VISIBLE_NAVIGATION_LABELS.every((label, index) => visible[index] === label);
};
