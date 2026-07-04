import { describe, expect, it } from "vitest";

import { inferSettingsFromPrompt } from "./promptInference";

describe("inferSettingsFromPrompt", () => {
  it("infers weeks, level, and modality from a typical brief", () => {
    const { updates, notes } = inferSettingsFromPrompt(
      "An 8-week undergraduate course on AI and Modern Society for non-majors. Online asynchronous."
    );
    expect(updates.lengthWeeks).toBe(8);
    expect(updates.courseLengthPreset).toBe("8-weeks");
    expect(updates.moduleCount).toBe(8);
    expect(updates.level).toBe("Undergraduate");
    expect(updates.modality).toBe("Online asynchronous");
    expect(notes).toContain("8 weeks");
  });

  it("maps non-preset week counts to custom and clamps extremes", () => {
    expect(inferSettingsFromPrompt("a 7 week course").updates.courseLengthPreset).toBe("custom");
    expect(inferSettingsFromPrompt("a 1-week intensive").updates.lengthWeeks).toBe(3);
  });

  it("recognizes graduate level and hybrid modality", () => {
    const { updates } = inferSettingsFromPrompt("A 16-week graduate research methods course, hybrid format.");
    expect(updates.level).toBe("Graduate");
    expect(updates.modality).toBe("Hybrid");
    expect(updates.courseLengthPreset).toBe("16-weeks");
  });

  it("recognizes professional development briefs", () => {
    const { updates } = inferSettingsFromPrompt(
      "A 6-week professional development course on workplace safety for new EMS supervisors."
    );
    expect(updates.level).toBe("Professional");
    expect(updates.lengthWeeks).toBe(6);
  });

  it("returns nothing for prompts without signals", () => {
    const { updates, notes } = inferSettingsFromPrompt("A course about pottery.");
    expect(Object.keys(updates)).toHaveLength(0);
    expect(notes).toHaveLength(0);
  });

  it("prefers accelerated over other modality keywords", () => {
    const { updates } = inferSettingsFromPrompt("An accelerated online course.");
    expect(updates.modality).toBe("Accelerated");
  });
});
