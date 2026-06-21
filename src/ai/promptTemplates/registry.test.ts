import { describe, expect, it } from "vitest";
import {
  activePromptTemplateVersions,
  allPromptTemplates,
  comparePromptTemplateVersions,
  createPromptTemplateRegistry,
  getActivePromptTemplate,
  getRollbackTemplate
} from "./registry";
import type { PromptTemplateStage } from "./types";

const stages = Object.keys(activePromptTemplateVersions) as PromptTemplateStage[];

describe("prompt template registry", () => {
  it("registers six explicit versions for every generation stage", () => {
    const registry = createPromptTemplateRegistry();

    expect(stages).toHaveLength(12);
    expect(allPromptTemplates).toHaveLength(stages.length * 6);

    stages.forEach((stage) => {
      expect(registry[stage].versions.map((template) => template.version)).toEqual(["v1", "v2", "v3", "v4", "v5", "v6"]);
      expect(registry[stage].activeVersion).toBe("v6");
      expect(registry[stage].activeTemplate.id).toBe(`${registry[stage].activeTemplate.id.split(".")[0]}.v6`);
    });
  });

  it("supports active-version overrides, comparison, and rollback", () => {
    const registry = createPromptTemplateRegistry({ assignmentDraft: "v5" });
    const activeBlueprint = getActivePromptTemplate("blueprint");
    const comparison = comparePromptTemplateVersions("assignmentDraft", "v5", "v6");
    const rollback = getRollbackTemplate("assignmentDraft", "v6");

    expect(registry.assignmentDraft.activeVersion).toBe("v5");
    expect(activeBlueprint.id).toBe("blueprint.v6");
    expect(comparison.addedChecklistItems.length).toBeGreaterThan(0);
    expect(comparison.changedInstructions).toContain("developerInstructions changed");
    expect(comparison.rollbackTarget).toBe("v5");
    expect(rollback?.version).toBe("v5");
  });
});
