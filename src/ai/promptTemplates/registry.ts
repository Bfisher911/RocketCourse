import { assignmentPromptTemplates } from "./assignments";
import { blueprintPromptTemplates } from "./blueprint";
import { contactHourPromptTemplates } from "./contactHours";
import { discussionPromptTemplates } from "./discussions";
import { homepagePromptTemplates } from "./homepage";
import { lessonPagePromptTemplates } from "./lessonPages";
import { moduleDraftPromptTemplates } from "./modules";
import { quizPromptTemplates } from "./quizzes";
import { resourcePromptTemplates } from "./resources";
import { revisionPromptTemplates } from "./revisions";
import { rubricPromptTemplates } from "./rubrics";
import { syllabusPromptTemplates } from "./syllabus";
import { improvementPasses } from "./templateFactory";
import type {
  PromptTemplate,
  PromptTemplateComparison,
  PromptTemplateRegistry,
  PromptTemplateRegistryEntry,
  PromptTemplateStage,
  PromptTemplateVersion
} from "./types";

export const allPromptTemplates: PromptTemplate[] = [
  ...blueprintPromptTemplates,
  ...moduleDraftPromptTemplates,
  ...lessonPagePromptTemplates,
  ...assignmentPromptTemplates,
  ...discussionPromptTemplates,
  ...quizPromptTemplates,
  ...rubricPromptTemplates,
  ...syllabusPromptTemplates,
  ...homepagePromptTemplates,
  ...resourcePromptTemplates,
  ...contactHourPromptTemplates,
  ...revisionPromptTemplates
];

export const activePromptTemplateVersions: Record<PromptTemplateStage, PromptTemplateVersion> = {
  blueprint: "v6",
  moduleDraft: "v6",
  lessonPageDraft: "v6",
  assignmentDraft: "v6",
  discussionDraft: "v6",
  quizDraft: "v6",
  rubricDraft: "v6",
  syllabusDraft: "v6",
  homepageDraft: "v6",
  resourceDraft: "v6",
  contactHourDraft: "v6",
  revision: "v6"
};

const promptStages = Object.keys(activePromptTemplateVersions) as PromptTemplateStage[];

const templateVersionNumber = (version: PromptTemplateVersion): number => Number(version.replace(/^v/, ""));

const templatesByStage = (stage: PromptTemplateStage): PromptTemplate[] =>
  allPromptTemplates
    .filter((template) => template.stage === stage)
    .sort((left, right) => templateVersionNumber(left.version) - templateVersionNumber(right.version));

const findTemplate = (stage: PromptTemplateStage, version: PromptTemplateVersion): PromptTemplate | undefined =>
  templatesByStage(stage).find((template) => template.version === version);

export const createPromptTemplateRegistry = (
  activeOverrides: Partial<Record<PromptTemplateStage, PromptTemplateVersion>> = {}
): PromptTemplateRegistry => {
  const entries = promptStages.map<[PromptTemplateStage, PromptTemplateRegistryEntry]>((stage) => {
    const versions = templatesByStage(stage);
    const activeVersion = activeOverrides[stage] ?? activePromptTemplateVersions[stage];
    const activeTemplate = versions.find((template) => template.version === activeVersion);

    if (!activeTemplate) {
      throw new Error(`No active prompt template found for ${stage}.${activeVersion}`);
    }

    return [
      stage,
      {
        stage,
        activeVersion,
        activeTemplate,
        versions,
        changeLog: versions.map((template) => {
          const pass = improvementPasses.find((item) => item.version === template.version);
          return {
            version: template.version,
            active: template.version === activeVersion,
            improvementPass: pass?.name ?? `Prompt ${template.version}`,
            notes: template.notes
          };
        })
      }
    ];
  });

  return Object.fromEntries(entries) as PromptTemplateRegistry;
};

export const promptTemplateRegistry = createPromptTemplateRegistry();

export const getPromptTemplatesByStage = (stage: PromptTemplateStage): PromptTemplate[] => promptTemplateRegistry[stage].versions;

export const getActivePromptTemplate = (stage: PromptTemplateStage): PromptTemplate => promptTemplateRegistry[stage].activeTemplate;

export const getActivePromptTemplates = (): PromptTemplate[] => promptStages.map((stage) => getActivePromptTemplate(stage));

export const getPromptTemplateById = (id: string): PromptTemplate | undefined => allPromptTemplates.find((template) => template.id === id);

export const getPromptTemplateVersion = (stage: PromptTemplateStage, version: PromptTemplateVersion): PromptTemplate | undefined => findTemplate(stage, version);

export const getRollbackTemplate = (stage: PromptTemplateStage, fromVersion: PromptTemplateVersion = activePromptTemplateVersions[stage]): PromptTemplate | undefined => {
  const versions = templatesByStage(stage);
  const currentIndex = versions.findIndex((template) => template.version === fromVersion);
  return currentIndex > 0 ? versions[currentIndex - 1] : undefined;
};

const difference = (left: string[], right: string[]): string[] => left.filter((item) => !right.includes(item));

export const comparePromptTemplateVersions = (
  stage: PromptTemplateStage,
  fromVersion: PromptTemplateVersion,
  toVersion: PromptTemplateVersion
): PromptTemplateComparison => {
  const fromTemplate = findTemplate(stage, fromVersion);
  const toTemplate = findTemplate(stage, toVersion);

  if (!fromTemplate || !toTemplate) {
    throw new Error(`Cannot compare prompt templates for ${stage}: ${fromVersion} -> ${toVersion}`);
  }

  return {
    stage,
    fromVersion,
    toVersion,
    addedChecklistItems: difference(toTemplate.qualityChecklist, fromTemplate.qualityChecklist),
    removedChecklistItems: difference(fromTemplate.qualityChecklist, toTemplate.qualityChecklist),
    changedInstructions: [
      fromTemplate.systemInstructions === toTemplate.systemInstructions ? "" : "systemInstructions changed",
      fromTemplate.developerInstructions === toTemplate.developerInstructions ? "" : "developerInstructions changed",
      fromTemplate.userPromptTemplate === toTemplate.userPromptTemplate ? "" : "userPromptTemplate changed"
    ].filter(Boolean),
    rollbackTarget: getRollbackTemplate(stage, toVersion)?.version
  };
};
