import type { Assignment, CourseProject, Discussion, ObjectMetadata, Rubric, RubricCriterion } from "../types";
import { nowIso, slugify, stripHtml } from "../utils/text";

export type RubricTemplateId =
  | "writing"
  | "discussion"
  | "presentation"
  | "project"
  | "case-study"
  | "reflection"
  | "data-analysis"
  | "lab-fieldwork"
  | "portfolio"
  | "peer-review";

export type RubricIssueSeverity = "error" | "warning";
export type RubricPlanStatus = "Ready" | "Needs review";

export interface RubricTemplate {
  id: RubricTemplateId;
  name: string;
  description: string;
  points: number;
  criteria: string[];
}

export interface RubricUsage {
  assignments: Assignment[];
  discussions: Discussion[];
}

export interface RubricIssue {
  id: string;
  rubricId: string;
  criterionId?: string;
  severity: RubricIssueSeverity;
  title: string;
  detail: string;
}

export interface RubricPlanValidation {
  score: number;
  status: RubricPlanStatus;
  issues: RubricIssue[];
}

export const RUBRIC_TEMPLATES: RubricTemplate[] = [
  { id: "writing", name: "Writing Assignment", description: "Thesis, evidence, organization, and academic style.", points: 60, criteria: ["Argument and purpose", "Evidence and source use", "Organization", "Style and mechanics"] },
  { id: "discussion", name: "Discussion", description: "Initial post, evidence, replies, and discussion citizenship.", points: 20, criteria: ["Initial post quality", "Evidence and examples", "Peer replies", "Tone and presence"] },
  { id: "presentation", name: "Presentation", description: "Content accuracy, delivery, visuals, and audience fit.", points: 50, criteria: ["Content accuracy", "Organization and pacing", "Visual support", "Delivery and engagement"] },
  { id: "project", name: "Project", description: "Problem framing, deliverables, process, and final quality.", points: 100, criteria: ["Problem framing", "Design and execution", "Evidence of process", "Final deliverable"] },
  { id: "case-study", name: "Case Study", description: "Context, stakeholder analysis, recommendation, and tradeoffs.", points: 60, criteria: ["Case understanding", "Stakeholder analysis", "Evidence-based recommendation", "Risk and tradeoff analysis"] },
  { id: "reflection", name: "Reflection", description: "Specific experience, concept connection, insight, and next steps.", points: 30, criteria: ["Specific learning moment", "Concept connection", "Depth of reflection", "Future action"] },
  { id: "data-analysis", name: "Data Analysis", description: "Data interpretation, method, evidence, and communication.", points: 70, criteria: ["Data interpretation", "Method and assumptions", "Evidence-based conclusion", "Communication"] },
  { id: "lab-fieldwork", name: "Lab Or Fieldwork", description: "Preparation, procedure, observations, and conclusions.", points: 80, criteria: ["Preparation and safety", "Procedure", "Observation quality", "Conclusion and limitations"] },
  { id: "portfolio", name: "Portfolio", description: "Artifact selection, revision, reflection, and presentation.", points: 100, criteria: ["Artifact selection", "Revision evidence", "Reflective rationale", "Portfolio presentation"] },
  { id: "peer-review", name: "Peer Review", description: "Specificity, usefulness, criteria connection, and tone.", points: 20, criteria: ["Specific observations", "Actionable feedback", "Criteria connection", "Respectful tone"] }
];

const touchedMetadata = (metadata: ObjectMetadata | undefined, timestamp: string): ObjectMetadata => ({
  createdAt: metadata?.createdAt ?? timestamp,
  updatedAt: timestamp,
  lastExportedAt: metadata?.lastExportedAt,
  exportVersion: metadata?.exportVersion ?? 0,
  source: "edited"
});

const templateById = (templateId: RubricTemplateId): RubricTemplate => RUBRIC_TEMPLATES.find((template) => template.id === templateId) ?? RUBRIC_TEMPLATES[0];

const levelsFor = (points: number) => [
  { label: "Exemplary", points, description: "Complete, specific, polished, and strongly aligned to the task." },
  { label: "Proficient", points: Math.round(points * 0.75), description: "Mostly complete and accurate with minor gaps or unevenness." },
  { label: "Developing", points: Math.round(points * 0.45), description: "Partially complete, vague, or missing important expectations." },
  { label: "Beginning", points: Math.round(points * 0.2), description: "Limited, incomplete, or not yet connected to the criteria." }
];

export const getRubricUsage = (course: CourseProject, rubricId: string): RubricUsage => ({
  assignments: course.assignments.filter((assignment) => assignment.rubricId === rubricId),
  discussions: course.discussions.filter((discussion) => discussion.rubricId === rubricId)
});

export const buildRubricFromTemplate = (templateId: RubricTemplateId, course: CourseProject, options: { rubricId?: string; timestamp?: string; title?: string } = {}): Rubric => {
  const timestamp = options.timestamp ?? nowIso();
  const template = templateById(templateId);
  const rubricId = options.rubricId ?? `rubric_${slugify(template.id)}_${Date.now().toString(36)}`;
  const alignedOutcomeIds = course.outcomes.slice(0, 3).map((outcome) => outcome.id);
  const basePoints = Math.max(1, Math.round(template.points / template.criteria.length));
  const criteria = template.criteria.map<RubricCriterion>((title, index) => ({
    id: `${rubricId}_criterion_${index + 1}`,
    title,
    description: `Student work demonstrates ${title.toLowerCase()} in a way that fits the assignment, audience, and course outcomes.`,
    outcomeId: alignedOutcomeIds[index % Math.max(1, alignedOutcomeIds.length)],
    levels: levelsFor(index === template.criteria.length - 1 ? Math.max(1, template.points - basePoints * (template.criteria.length - 1)) : basePoints)
  }));
  return {
    id: rubricId,
    title: options.title ?? `${template.name} Rubric`,
    criteria,
    points: criteria.reduce((sum, criterion) => sum + Math.max(...criterion.levels.map((level) => level.points)), 0),
    alignedOutcomeIds,
    publishState: "published",
    status: "edited",
    metadata: touchedMetadata(undefined, timestamp)
  };
};

export const validateRubricPlan = (course: CourseProject): RubricPlanValidation => {
  const issues: RubricIssue[] = [];
  const outcomeIds = new Set(course.outcomes.map((outcome) => outcome.id));
  const add = (rubric: Rubric, id: string, severity: RubricIssueSeverity, title: string, detail: string, criterion?: RubricCriterion) => {
    issues.push({ id: `${rubric.id}${criterion ? `-${criterion.id}` : ""}-${id}`, rubricId: rubric.id, criterionId: criterion?.id, severity, title, detail });
  };
  course.rubrics.forEach((rubric) => {
    const usage = getRubricUsage(course, rubric.id);
    if (!rubric.title.trim()) add(rubric, "title", "error", "Title missing", "Rubrics need a clear student-facing title.");
    if (rubric.criteria.length === 0) add(rubric, "criteria", "error", "No criteria", "Add at least one criterion.");
    if (!Number.isFinite(rubric.points) || rubric.points <= 0) add(rubric, "points", "error", "Points invalid", "Rubric total points should be positive.");
    if (rubric.alignedOutcomeIds.length === 0 || rubric.alignedOutcomeIds.some((outcomeId) => !outcomeIds.has(outcomeId))) add(rubric, "outcomes", "warning", "Outcomes not aligned", "Align the rubric to valid course outcomes.");
    if (usage.assignments.length === 0 && usage.discussions.length === 0) add(rubric, "unused", "warning", "Rubric unused", "Attach this rubric to a graded assignment or discussion, or keep it intentionally reusable.");
    rubric.criteria.forEach((criterion) => {
      if (!criterion.title.trim()) add(rubric, "criterion-title", "error", "Criterion title missing", "Each criterion needs a title.", criterion);
      if (stripHtml(criterion.description).length < 24) add(rubric, "criterion-description", "warning", "Criterion description thin", "Describe what students should demonstrate.", criterion);
      if (criterion.levels.length < 2) add(rubric, "levels", "error", "Performance levels missing", "Each criterion needs at least two performance levels.", criterion);
      const descriptions = new Set(criterion.levels.map((level) => stripHtml(level.description).trim().toLowerCase()).filter(Boolean));
      if (descriptions.size < Math.min(criterion.levels.length, 2)) add(rubric, "level-descriptions", "warning", "Level descriptions too similar", "Performance descriptions should be distinct and useful.", criterion);
      if (criterion.levels.some((level) => !level.label.trim() || !Number.isFinite(level.points) || level.points < 0)) add(rubric, "level-points", "error", "Level values invalid", "Levels need labels and non-negative point values.", criterion);
      if (criterion.outcomeId && !outcomeIds.has(criterion.outcomeId)) add(rubric, "criterion-outcome", "error", "Criterion outcome missing", "Criterion outcome alignment must reference an existing outcome.", criterion);
    });
  });
  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.filter((issue) => issue.severity === "warning").length;
  return { score: Math.max(0, Math.round(100 - errors * 9 - warnings * 2)), status: errors > 0 ? "Needs review" : "Ready", issues };
};

const recalcPoints = (rubric: Rubric): Rubric => ({
  ...rubric,
  points: rubric.criteria.reduce((sum, criterion) => sum + Math.max(0, ...criterion.levels.map((level) => Number(level.points || 0))), 0)
});

export const createRubric = (course: CourseProject, templateId: RubricTemplateId = "project"): CourseProject => ({
  ...course,
  rubrics: [...course.rubrics, buildRubricFromTemplate(templateId, course)]
});

export const applyRubricTemplate = (course: CourseProject, rubricId: string, templateId: RubricTemplateId): CourseProject => ({
  ...course,
  rubrics: course.rubrics.map((rubric) => (rubric.id === rubricId ? { ...buildRubricFromTemplate(templateId, course, { rubricId: rubric.id, title: rubric.title }), metadata: touchedMetadata(rubric.metadata, nowIso()) } : rubric))
});

export const updateRubric = (course: CourseProject, rubricId: string, updater: (rubric: Rubric) => Rubric): CourseProject => ({
  ...course,
  rubrics: course.rubrics.map((rubric) => (rubric.id === rubricId ? recalcPoints({ ...updater(rubric), status: "edited", metadata: touchedMetadata(rubric.metadata, nowIso()) }) : rubric))
});

export const attachRubricToAssignment = (course: CourseProject, assignmentId: string, rubricId: string): CourseProject => ({
  ...course,
  assignments: course.assignments.map((assignment) => (assignment.id === assignmentId ? { ...assignment, rubricId, status: "edited" } : assignment))
});

export const attachRubricToDiscussion = (course: CourseProject, discussionId: string, rubricId: string): CourseProject => ({
  ...course,
  discussions: course.discussions.map((discussion) => (discussion.id === discussionId ? { ...discussion, rubricId, status: "edited" } : discussion))
});
