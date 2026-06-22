export type CourseStatus = "draft" | "generated" | "edited" | "ready" | "exported";

export type ModuleItemType = "page" | "assignment" | "discussion" | "quiz" | "syllabus";

export type Screen = "landing" | "pricing" | "login" | "signup" | "dashboard" | "intake" | "blueprint" | "progress" | "editor";

export type EditorTab =
  | "Overview"
  | "Homepage"
  | "Syllabus"
  | "Modules"
  | "Pages"
  | "Assignments"
  | "Discussions"
  | "Quizzes"
  | "Rubrics"
  | "Gradebook Setup"
  | "Contact Hours"
  | "Theme"
  | "Export";

export type BuildMode = "vibe" | "guided" | "hybrid";

export type CourseLengthPreset = "4-weeks" | "6-weeks" | "8-weeks" | "12-weeks" | "15-weeks" | "16-weeks" | "maymester" | "custom";

export type ModuleOrganizationPattern = "weeks" | "topics" | "chapters" | "units" | "quarters" | "custom";

export type QuizDifficulty = "introductory" | "balanced" | "challenging";

export type DiscussionStyle = "reflective" | "case-based" | "debate" | "peer-review" | "application";

export type AssignmentCadence = "every-module" | "every-other-module" | "major-milestones" | "custom";

export type FinalProjectType = "project" | "presentation" | "paper" | "portfolio" | "exam" | "case-study" | "simulation" | "other";

export type ScaffoldPattern = "every-other-module" | "key-milestones" | "custom";

export type ExportMode = "full" | "selected" | "new" | "changed";

export type PublishState = "published" | "unpublished";

export type ModuleKind = "start" | "content" | "final" | "instructor";

export type ResourceType = "textbook" | "oer" | "scholarly-article" | "website" | "video" | "podcast" | "local-file" | "instructor-added" | "supplemental";

export type MeetingCadence = "weekly" | "twice-weekly" | "self-paced" | "custom";

export type ReviewPriority = "must" | "recommended" | "optional";

export type CourseQualityCategory =
  | "completeness"
  | "accessibility"
  | "outcomeAlignment"
  | "workloadBalance"
  | "assessmentVariety"
  | "instructorReadiness"
  | "studentClarity"
  | "canvasCompatibility"
  | "syllabusQuality"
  | "rubricQuality"
  | "moduleLearningPath"
  | "exportReadiness";

export interface ObjectMetadata {
  createdAt: string;
  updatedAt: string;
  lastExportedAt?: string;
  exportVersion: number;
  source: "generated" | "imported" | "edited";
}

export interface CourseImageSettings {
  homepageBannerMode: "generated-svg" | "upload" | "url" | "future-ai";
  homepageBannerUrl?: string;
  courseTileMode: "generated-svg" | "upload" | "url" | "future-ai";
  courseTileUrl?: string;
  moduleHeaderImages: boolean;
  futureImageCreditLimit: number;
}

export interface ScheduleSettings {
  enableDueDates: boolean;
  termStartDate?: string;
  termEndDate?: string;
  meetingCadence: MeetingCadence;
  weeklyPattern: string[];
  holidays: string[];
  blackoutDates: string[];
  preferredDueDay: number;
  preferredDueTime: string;
  moduleReleaseDay: number;
  allowDueDatesOutsideTerm: boolean;
}

export interface CourseSettings {
  buildMode: BuildMode;
  title: string;
  description: string;
  level: string;
  modality: string;
  creditHours: number;
  courseLengthPreset: CourseLengthPreset;
  lengthWeeks: number;
  organizationPattern: ModuleOrganizationPattern;
  customOrganizationLabel: string;
  moduleCount: number;
  themeId: string;
  tone: string;
  assignmentTypes: string[];
  quizFrequency: "none" | "weekly" | "biweekly" | "module";
  quizQuestionsPerQuiz: number;
  quizDifficulty: QuizDifficulty;
  discussionFrequency: "none" | "weekly" | "biweekly" | "module";
  discussionStyle: DiscussionStyle;
  assignmentCadence: AssignmentCadence;
  finalProject: boolean;
  finalProjectType: FinalProjectType;
  scaffoldFinalProject: boolean;
  scaffoldPattern: ScaffoldPattern;
  includeRubrics: boolean;
  includeObjectives: boolean;
  includeBloom: boolean;
  includeContactHours: boolean;
  accessibilityFocus: boolean;
  schedule: ScheduleSettings;
  imageSettings: CourseImageSettings;
  sourceFiles: SourceFile[];
}

export interface SourceFile {
  id: string;
  name: string;
  sizeLabel: string;
  status: "attached" | "parsed";
}

// Subtle, Canvas-safe texture rendered as pure CSS gradients (no url() — Canvas's sanitizer
// can strip url() in inline styles, but CSS gradient functions survive).
export type ThemePattern = "none" | "dots" | "grid" | "diagonal" | "crosshatch";

export interface Theme {
  id: string;
  name: string;
  accent: string;
  accentDark: string;
  soft: string;
  contrastText: string;
  bannerLabel: string;
  contrastStatus: "pass" | "review";
  // Optional visual richness. When omitted, heroes fall back to an accent→accentDark gradient
  // and no pattern, so every existing/custom theme keeps working and simply gains a subtle hero.
  gradientFrom?: string;
  gradientTo?: string;
  pattern?: ThemePattern;
}

export interface CourseOutcome {
  id: string;
  code: string;
  text: string;
  bloomLevel: string;
  alignedModuleIds: string[];
}

export interface ModuleItem {
  id: string;
  type: ModuleItemType;
  title: string;
  refId: string;
  order: number;
  indent: number;
  publishState: PublishState;
  status: CourseStatus;
  metadata: ObjectMetadata;
}

export interface CourseModule {
  id: string;
  title: string;
  description: string;
  objectives: string[];
  workloadHours: number;
  order: number;
  kind: ModuleKind;
  publishState: PublishState;
  expanded: boolean;
  items: ModuleItem[];
  status: CourseStatus;
  metadata: ObjectMetadata;
}

export interface CoursePage {
  id: string;
  title: string;
  slug: string;
  bodyHtml: string;
  moduleId?: string;
  frontPage?: boolean;
  assetPath?: string;
  publishState: PublishState;
  status: CourseStatus;
  metadata: ObjectMetadata;
}

export interface Assignment {
  id: string;
  title: string;
  descriptionHtml: string;
  points: number;
  estimatedHours: number;
  submissionType: string;
  moduleId: string;
  dueAt?: string;
  assignmentGroupId: string;
  rubricId?: string;
  alignedOutcomeIds: string[];
  publishState: PublishState;
  status: CourseStatus;
  metadata: ObjectMetadata;
}

export interface Discussion {
  id: string;
  title: string;
  promptHtml: string;
  points: number;
  moduleId: string;
  dueAt?: string;
  assignmentGroupId: string;
  rubricId?: string;
  alignedOutcomeIds: string[];
  publishState: PublishState;
  status: CourseStatus;
  metadata: ObjectMetadata;
}

export type QuizQuestionType = "multiple_choice" | "true_false" | "short_answer" | "essay";

export interface QuizQuestion {
  id: string;
  type: QuizQuestionType;
  stem: string;
  choices?: string[];
  correctAnswer?: string;
  feedback?: string;
  correctFeedback?: string;
  incorrectFeedback?: string;
  difficulty: QuizDifficulty;
  alignedOutcomeIds: string[];
  moduleId: string;
  instructorReviewRequired?: boolean;
  points: number;
}

export interface Quiz {
  id: string;
  title: string;
  purpose: string;
  moduleId: string;
  dueAt?: string;
  assignmentGroupId: string;
  points: number;
  questions: QuizQuestion[];
  alignedOutcomeIds: string[];
  publishState: PublishState;
  status: CourseStatus;
  metadata: ObjectMetadata;
}

export interface RubricCriterion {
  id: string;
  title: string;
  description: string;
  outcomeId?: string;
  levels: {
    label: string;
    points: number;
    description: string;
  }[];
}

export interface Rubric {
  id: string;
  title: string;
  criteria: RubricCriterion[];
  points: number;
  alignedOutcomeIds: string[];
  publishState: PublishState;
  status: CourseStatus;
  metadata: ObjectMetadata;
}

export interface AssignmentGroup {
  id: string;
  name: string;
  weight: number;
  dropLowest?: number;
}

export interface CourseResource {
  id: string;
  moduleId: string;
  title: string;
  type: ResourceType;
  whyItMatters: string;
  estimatedMinutes: number;
  studentInstructions: string;
  instructorEditNote: string;
  placeholder: string;
  optional: boolean;
  publishState: PublishState;
  status: CourseStatus;
  metadata: ObjectMetadata;
}

export interface CourseScheduleEntry {
  id: string;
  moduleId: string;
  title: string;
  itemId?: string;
  itemType: ModuleItemType | "module" | "resource";
  releaseAt?: string;
  dueAt?: string;
  workloadHours: number;
  notes: string;
}

export interface HumanReviewChecklistItem {
  id: string;
  priority: ReviewPriority;
  title: string;
  rationale: string;
  action: string;
  relatedObjectId?: string;
  relatedObjectType?: ModuleItemType | "course" | "module" | "resource" | "navigation" | "gradebook" | "schedule" | "policy" | "accessibility";
  completed: boolean;
}

export interface ContactHourPlan {
  instructionalTime: number;
  readingMediaTime: number;
  assignmentTime: number;
  discussionTime: number;
  quizStudyTime: number;
  finalProjectTime: number;
  totalHours: number;
  justification: string;
}

export interface ExportHistoryItem {
  id: string;
  exportedAt: string;
  fileName: string;
  mode: ExportMode;
  validationScore: number;
}

export interface FileAsset {
  id: string;
  path: string;
  fileName: string;
  title: string;
  mimeType: string;
  description: string;
  usage: "banner" | "tile" | "syllabus-printable" | "instructor-guide" | "module-header" | "other";
  publishState: PublishState;
  metadata: ObjectMetadata;
}

export interface CanvasNavigationItem {
  id: string;
  label: string;
  visible: boolean;
  reason: string;
}

export interface CourseQualityItem {
  category: CourseQualityCategory;
  label: string;
  score: number;
  reason: string;
  issues: string[];
  recommendedFixes: string[];
  autoFixAvailable: boolean;
}

export interface CourseQualityReport {
  score: number;
  checkedAt: string;
  categories: CourseQualityItem[];
}

// A single editable link target on the homepage (button or quick link). Targets are exported
// Canvas page file names (e.g. "syllabus.html"), mailto:, or absolute URLs.
export interface HomepageLink {
  label: string;
  target: string;
}

// Structured, template-driven model for the course homepage. The homepage's rendered
// `bodyHtml` is always derivable from (templateId, content, theme), which keeps the friendly
// builder, the preview, and the exported page in sync and lets a theme change re-color the
// page without touching instructor-authored text.
export interface HomepageContent {
  bannerAlt: string;
  heroEyebrow: string;
  heroHeading: string;
  welcome: string;
  primaryButton: HomepageLink;
  secondaryButton: HomepageLink;
  pathItems: string[];
  instructorNote: string;
  weeklyItems: string[];
  resourceLinks: HomepageLink[];
  purpose: string;
}

export type HomepageMode = "builder" | "custom";

// A point-in-time copy of the homepage, captured before risky actions (template apply, revise,
// theme refresh) so the instructor can restore or compare.
export interface HomepageSnapshot {
  id: string;
  label: string;
  takenAt: string;
  mode: HomepageMode;
  templateId: string;
  content: HomepageContent;
  bodyHtml: string;
}

// Persisted homepage builder state. Lives on the project so it survives tab switches, theme
// changes, and re-themes. `themeId` records the theme the current HTML was rendered with so the
// editor can detect drift and offer a one-click re-theme.
export interface HomepageState {
  mode: HomepageMode;
  templateId: string;
  content: HomepageContent;
  themeId: string;
  updatedAt: string;
  snapshots: HomepageSnapshot[];
}

export interface SyllabusContent {
  courseDescription: string;
  learningOutcomes: string[];
  requiredMaterials: string[];
  scheduleSummary: string;
  weeklySchedule: string[];
  gradingBreakdown: string[];
  assignmentOverview: string[];
  communicationExpectations: string;
  lateWorkPolicy: string;
  academicIntegrityPolicy: string;
  aiUsePolicy: string;
  accessibilityAccommodations: string;
  studentSupportResources: string[];
  instructorContactBlock: string;
  workloadContactHours: string;
  technologyRequirements: string;
  instructorReviewNotes: string[];
}

export type SyllabusMode = "builder" | "custom";

export interface SyllabusSnapshot {
  id: string;
  label: string;
  takenAt: string;
  mode: SyllabusMode;
  templateId: string;
  content: SyllabusContent;
  bodyHtml: string;
  validationScore: number;
}

export interface SyllabusState {
  mode: SyllabusMode;
  templateId: string;
  content: SyllabusContent;
  themeId: string;
  updatedAt: string;
  snapshots: SyllabusSnapshot[];
}

export interface CourseProject {
  id: string;
  title: string;
  description: string;
  prompt: string;
  settings: CourseSettings;
  theme: Theme;
  status: CourseStatus;
  updatedAt: string;
  homepage?: HomepageState;
  syllabus?: SyllabusState;
  outcomes: CourseOutcome[];
  modules: CourseModule[];
  pages: CoursePage[];
  assignments: Assignment[];
  discussions: Discussion[];
  quizzes: Quiz[];
  rubrics: Rubric[];
  resources: CourseResource[];
  schedule: CourseScheduleEntry[];
  reviewChecklist: HumanReviewChecklistItem[];
  quality?: CourseQualityReport;
  assignmentGroups: AssignmentGroup[];
  fileAssets: FileAsset[];
  navigation: CanvasNavigationItem[];
  contactHours: ContactHourPlan;
  exportHistory: ExportHistoryItem[];
  exportMode: ExportMode;
  metadata: ObjectMetadata;
}

export interface ReadinessCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
  severity: "required" | "recommended";
}

export interface ReadinessReport {
  score: number;
  checks: ReadinessCheck[];
  blockers: number;
  warnings: number;
}

export interface ExportValidationIssue {
  id: string;
  message: string;
  severity: "error" | "warning";
}

export interface ExportValidationReport {
  valid: boolean;
  score: number;
  packageName: string;
  checkedAt: string;
  issues: ExportValidationIssue[];
  files: string[];
  sandboxImportStatus: "not_tested" | "passed" | "failed";
}
