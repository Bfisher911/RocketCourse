export type PromptTemplateStage =
  | "blueprint"
  | "moduleDraft"
  | "lessonPageDraft"
  | "assignmentDraft"
  | "discussionDraft"
  | "quizDraft"
  | "rubricDraft"
  | "syllabusDraft"
  | "homepageDraft"
  | "resourceDraft"
  | "contactHourDraft"
  | "revision";

export type PromptTemplateVersion = `v${number}`;

export interface PromptTemplate {
  id: string;
  stage: PromptTemplateStage;
  name: string;
  version: PromptTemplateVersion;
  purpose: string;
  inputSchemaDescription: string;
  outputSchemaDescription: string;
  systemInstructions: string;
  developerInstructions: string;
  userPromptTemplate: string;
  qualityChecklist: string[];
  failureModes: string[];
  createdAt: string;
  notes: string;
}

export interface PromptTemplateVersionNote {
  version: PromptTemplateVersion;
  active: boolean;
  improvementPass: string;
  notes: string;
}

export interface PromptTemplateRegistryEntry {
  stage: PromptTemplateStage;
  activeVersion: PromptTemplateVersion;
  activeTemplate: PromptTemplate;
  versions: PromptTemplate[];
  changeLog: PromptTemplateVersionNote[];
}

export type PromptTemplateRegistry = Record<PromptTemplateStage, PromptTemplateRegistryEntry>;

export interface PromptTemplateComparison {
  stage: PromptTemplateStage;
  fromVersion: PromptTemplateVersion;
  toVersion: PromptTemplateVersion;
  addedChecklistItems: string[];
  removedChecklistItems: string[];
  changedInstructions: string[];
  rollbackTarget?: PromptTemplateVersion;
}

export interface PromptImprovementPass {
  version: PromptTemplateVersion;
  name: string;
  developerInstruction: string;
  checklistItems: string[];
  failureModes: string[];
  notes: string;
}

export interface PromptTemplateSeriesDefinition {
  idBase: string;
  stage: PromptTemplateStage;
  name: string;
  purpose: string;
  inputSchemaDescription: string;
  outputSchemaDescription: string;
  systemInstructions: string;
  developerInstructions: string;
  userPromptTemplate: string;
  qualityChecklist: string[];
  failureModes: string[];
  notes: string;
}
