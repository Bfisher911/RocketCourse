import { describe, expect, it } from "vitest";
import { buildReadinessReport } from "./readiness";
import { mappedCheckIds, tabForCheck } from "./readinessTabs";
import { readinessTab } from "../components/editor/shared";
import { editorTabs } from "../screens/appModel";
import { generateCourseProject } from "./courseGenerator";
import { defaultSettings } from "../data/defaultSettings";

const sampleReport = () =>
  buildReadinessReport(generateCourseProject({ prompt: "Intro to marine biology", settings: defaultSettings }));

describe("readiness check → editor tab routing", () => {
  it("every check the readiness report can emit has an explicit tab", () => {
    const mapped = new Set(mappedCheckIds());
    const unmapped = sampleReport().checks.map((check) => check.id).filter((id) => !mapped.has(id));
    // A new readiness check must be given a home deliberately — otherwise it
    // silently falls back to Overview and the user is sent somewhere useless.
    expect(unmapped).toEqual([]);
  });

  it("routes every check to a real editor tab", () => {
    const valid = new Set<string>(editorTabs);
    for (const id of mappedCheckIds()) expect(valid.has(tabForCheck(id))).toBe(true);
  });

  it("the editor rail and the guided journey agree on every check", () => {
    // The regression this whole module exists to prevent: two independent maps
    // sending the user to different tabs for the same failing check.
    for (const check of sampleReport().checks) {
      expect(readinessTab(check.id)).toBe(tabForCheck(check.id));
    }
  });

  it("routes the checks that the two old maps disagreed about", () => {
    expect(tabForCheck("accessibility")).toBe("Pages");
    expect(tabForCheck("reference-integrity")).toBe("Modules");
    expect(tabForCheck("due-date-term")).toBe("Contact Hours");
    expect(tabForCheck("graded-due-dates")).toBe("Contact Hours");
    // Alt text is edited in Imagery — neither old map sent the user there.
    expect(tabForCheck("visual-image-alt")).toBe("Imagery");
  });

  it("falls back to the command center for an unknown id", () => {
    expect(tabForCheck("not-a-real-check")).toBe("Overview");
  });
});
