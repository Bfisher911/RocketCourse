import type { CourseSettings } from "../types";

export const defaultSettings: CourseSettings = {
  // Retained for stored-project compatibility; the intake no longer exposes it.
  buildMode: "guided",
  contentDepth: "complete-course",
  // Title and description intentionally start empty: real generations must derive
  // entirely from the user's intake. The public demo passes its own explicit settings
  // (see sampleProject in courseGenerator.ts) — demo copy must never live in defaults.
  title: "",
  description: "",
  level: "Undergraduate",
  modality: "Online asynchronous",
  creditHours: 3,
  courseLengthPreset: "12-weeks",
  lengthWeeks: 12,
  organizationPattern: "weeks",
  customOrganizationLabel: "Module",
  moduleCount: 12,
  themeId: "modern-minimal",
  tone: "Friendly academic",
  assignmentTypes: ["Reflection papers", "Case analysis", "Final project"],
  quizFrequency: "weekly",
  quizQuestionsPerQuiz: 5,
  quizDifficulty: "balanced",
  quizPurpose: "knowledge-check",
  discussionFrequency: "weekly",
  discussionStyle: "application",
  assignmentCadence: "major-milestones",
  finalProject: true,
  finalProjectType: "portfolio",
  scaffoldFinalProject: true,
  scaffoldPattern: "key-milestones",
  includeRubrics: true,
  includeObjectives: true,
  includeBloom: true,
  outcomeFramework: "bloom",
  structureFramework: "linear",
  modulePattern: "standard",
  themeIntensity: "polished",
  includeContactHours: true,
  interactionDensity: "balanced",
  accessibilityFocus: true,
  accessibilityTier: "AA",
  schedule: {
    enableDueDates: false,
    meetingCadence: "weekly",
    weeklyPattern: ["Monday", "Wednesday"],
    holidays: [],
    blackoutDates: [],
    academicCalendar: "",
    preferredDueDay: 0,
    preferredDueTime: "23:59",
    moduleReleaseDay: 1,
    allowDueDatesOutsideTerm: false
  },
  imageSettings: {
    homepageBannerMode: "generated-svg",
    courseTileMode: "generated-svg",
    moduleHeaderImages: true,
    futureImageCreditLimit: 20
  },
  sourceFiles: []
};
