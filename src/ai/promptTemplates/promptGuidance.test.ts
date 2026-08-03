import { describe, expect, it } from "vitest";
import { courseStandardMessage, qualityGuidanceMessage } from "./promptGuidance";
import { getActivePromptTemplate } from "./registry";
import { buildChatMessages } from "../../services/openaiClient";

describe("prompt quality guidance actually reaches the model", () => {
  it("renders a template's checklist and failure modes", () => {
    const message = qualityGuidanceMessage({
      qualityChecklist: ["Module titles are specific."],
      failureModes: ["Blueprint is only an outline."]
    });
    expect(message).toContain("Module titles are specific.");
    expect(message).toContain("Blueprint is only an outline.");
  });

  it("returns null when a template defines neither, so no empty system message is sent", () => {
    expect(qualityGuidanceMessage({ qualityChecklist: [], failureModes: [] })).toBeNull();
  });

  it("buildChatMessages includes the quality bar — the regression this fixes", () => {
    // Every per-object builder goes through buildChatMessages via aiAssist.
    // Before this, qualityChecklist/failureModes were dropped silently and the
    // model was never told what "good" meant.
    const template = getActivePromptTemplate("lessonPageDraft");
    const messages = buildChatMessages("draft a page", template);
    const systemText = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
    expect(template.qualityChecklist.length).toBeGreaterThan(0);
    for (const line of template.qualityChecklist) expect(systemText).toContain(line);
    for (const line of template.failureModes) expect(systemText).toContain(line);
    // The user prompt must still be last.
    expect(messages[messages.length - 1]).toEqual({ role: "user", content: "draft a page" });
  });

  it("the course standard carries the architecture, targets and anti-generic rules", () => {
    const standard = courseStandardMessage();
    expect(standard).toContain("Start Here module");
    expect(standard).toContain("gradebookTotalPercent: 100");
    expect(standard).toContain("Vague module titles.");
    expect(standard).toContain("Concrete examples.");
  });
});
