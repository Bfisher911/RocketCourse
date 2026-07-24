import { describe, expect, it } from "vitest";
import {
  DEFAULT_EXPERIENCE_ID,
  EXPERIENCES,
  experiencesByCode,
  getExperience,
  resolveExperienceId,
} from "./experienceRegistry";

describe("experience registry", () => {
  it("defines exactly nine experiences with unique W01–W09 codes", () => {
    expect(EXPERIENCES).toHaveLength(9);
    const codes = EXPERIENCES.map(e => e.code).sort();
    expect(codes).toEqual(["W01", "W02", "W03", "W04", "W05", "W06", "W07", "W08", "W09"]);
    expect(new Set(EXPERIENCES.map(e => e.id)).size).toBe(9);
  });

  it("Guided Course Journey is the single default", () => {
    const defaults = EXPERIENCES.filter(e => e.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe("guided-journey");
    expect(DEFAULT_EXPERIENCE_ID).toBe("guided-journey");
  });

  it("only the original workflow has no prototype renderer", () => {
    for (const exp of EXPERIENCES) {
      if (exp.id === "original") expect(exp.prototypeKey).toBeNull();
      else expect(typeof exp.prototypeKey).toBe("string");
    }
  });

  it("every experience is enabled and carries registry metadata", () => {
    for (const exp of EXPERIENCES) {
      expect(exp.enabled).toBe(true);
      expect(exp.name.length).toBeGreaterThan(0);
      expect(exp.bestFor.length).toBeGreaterThan(0);
      expect(exp.featureFlag.startsWith("wf.")).toBe(true);
      expect(exp.supportedResponsive.length).toBeGreaterThan(0);
    }
  });

  it("experiencesByCode sorts W01 first", () => {
    const byCode = experiencesByCode();
    expect(byCode[0].code).toBe("W01");
    expect(byCode[8].code).toBe("W09");
  });

  it("resolveExperienceId honors course → user → default hierarchy", () => {
    expect(resolveExperienceId("course-map", "wildcard")).toBe("course-map");
    expect(resolveExperienceId(null, "wildcard")).toBe("wildcard");
    expect(resolveExperienceId(null, null)).toBe(DEFAULT_EXPERIENCE_ID);
    expect(resolveExperienceId("not-a-real-id", "also-fake")).toBe(DEFAULT_EXPERIENCE_ID);
  });

  it("getExperience returns undefined for unknown ids", () => {
    expect(getExperience("nope")).toBeUndefined();
    expect(getExperience("guided-journey")?.code).toBe("W02");
  });
});
