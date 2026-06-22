import { describe, expect, it } from "vitest";
import { parseBlueprint } from "./blueprint";

const validRaw = {
  title: "Intro to Marine Biology",
  description: "An 8-week survey of marine ecosystems.",
  audience: "Undergraduate non-majors",
  level: "Undergraduate",
  modality: "Online asynchronous",
  creditHours: 3,
  lengthWeeks: 8,
  teachingApproach: "Inquiry-based with weekly case studies.",
  outcomes: [
    { code: "CO1", text: "Explain ocean zonation." },
    { code: "CO2", text: "Analyze food webs." }
  ],
  modules: [
    { title: "Ocean Zones and Light", summary: "Pelagic vs benthic.", objectives: ["Identify zones"] },
    { title: "Primary Production", summary: "Phytoplankton.", objectives: ["Explain production", "Diagram a web"] }
  ],
  majorAssessments: ["Ecosystem case study", "Final field report"],
  finalProject: "Design a marine protected area proposal.",
  accessibilityNotes: "Alt text on all diagrams.",
  validationWarnings: ["Confirm institutional lab safety policy."]
};

describe("parseBlueprint", () => {
  it("parses a well-formed blueprint", () => {
    const bp = parseBlueprint(validRaw);
    expect(bp.title).toBe("Intro to Marine Biology");
    expect(bp.modules).toHaveLength(2);
    expect(bp.outcomes[1].code).toBe("CO2");
    expect(bp.modules[1].objectives).toEqual(["Explain production", "Diagram a web"]);
  });

  it("fills sensible defaults for missing optional fields", () => {
    const bp = parseBlueprint({ modules: [{ title: "Only Module" }] });
    expect(bp.title).toBe("Untitled Course");
    expect(bp.creditHours).toBe(3);
    expect(bp.lengthWeeks).toBe(1);
    expect(bp.modules[0].objectives).toEqual([]);
    expect(bp.outcomes).toEqual([]);
  });

  it("assigns outcome codes when the model omits them", () => {
    const bp = parseBlueprint({ outcomes: [{ text: "Do a thing" }], modules: [{ title: "M1" }] });
    expect(bp.outcomes[0].code).toBe("CO1");
  });

  it("rejects non-objects and module-less blueprints", () => {
    expect(() => parseBlueprint(null)).toThrow();
    expect(() => parseBlueprint("nope")).toThrow();
    expect(() => parseBlueprint({ title: "X", modules: [] })).toThrow(/no modules/i);
  });

  it("coerces stringy/garbage module objectives safely", () => {
    const bp = parseBlueprint({ modules: [{ title: "M", objectives: ["ok", 42, null, "good"] }] });
    expect(bp.modules[0].objectives).toEqual(["ok", "good"]);
  });
});
