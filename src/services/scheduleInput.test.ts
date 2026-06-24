import { describe, expect, it } from "vitest";
import { buildScheduleContext, cleanCalendarText, parseDateList, seedDateList } from "./scheduleInput";

describe("parseDateList", () => {
  it("parses a comma-separated list", () => {
    expect(parseDateList("Dec 25, Jan 1, Mar 15")).toEqual(["Dec 25", "Jan 1", "Mar 15"]);
  });

  it("parses a multi-line (pasted) list", () => {
    expect(parseDateList("Thanksgiving Break\nWinter Recess\nSpring Break")).toEqual([
      "Thanksgiving Break",
      "Winter Recess",
      "Spring Break"
    ]);
  });

  it("handles mixed commas and newlines and blank lines", () => {
    expect(parseDateList("Dec 25,\nJan 1\n\nMar 15, ")).toEqual(["Dec 25", "Jan 1", "Mar 15"]);
  });

  it("preserves internal spaces within an entry", () => {
    expect(parseDateList("Reading Day 1\nFall Recess Week")).toEqual(["Reading Day 1", "Fall Recess Week"]);
  });

  it("is empty for whitespace-only input", () => {
    expect(parseDateList("   \n\n  ")).toEqual([]);
    expect(parseDateList("")).toEqual([]);
  });
});

describe("seedDateList", () => {
  it("seeds the editable textarea one entry per line", () => {
    expect(seedDateList(["Dec 25", "Jan 1"])).toBe("Dec 25\nJan 1");
  });
  it("round-trips with parseDateList", () => {
    const arr = ["Thanksgiving Break", "Winter Recess"];
    expect(parseDateList(seedDateList(arr))).toEqual(arr);
  });
});

describe("cleanCalendarText", () => {
  it("preserves multi-line layout, spaces, and single blank lines", () => {
    const pasted = "Fall 2026\n\nWeek 1: Aug 25 - Aug 29\n  Labor Day: Sep 1 (no class)\nWeek 2: Sep 2 - Sep 5";
    const cleaned = cleanCalendarText(pasted);
    expect(cleaned).toContain("Week 1: Aug 25 - Aug 29");
    expect(cleaned).toContain("  Labor Day: Sep 1 (no class)"); // indentation kept
    expect(cleaned).toContain("\n\n"); // single blank line kept
  });

  it("normalizes CRLF and trims trailing spaces without touching content", () => {
    expect(cleanCalendarText("Week 1   \r\nWeek 2")).toBe("Week 1\nWeek 2");
  });

  it("collapses 3+ blank lines to a single gap", () => {
    expect(cleanCalendarText("A\n\n\n\nB")).toBe("A\n\nB");
  });
});

describe("buildScheduleContext", () => {
  it("is empty when nothing is provided", () => {
    expect(buildScheduleContext({})).toBe("");
    expect(buildScheduleContext({ academicCalendar: "  ", holidays: [], blackoutDates: [] })).toBe("");
  });

  it("includes the pasted calendar, holidays, and blackout dates", () => {
    const ctx = buildScheduleContext({
      academicCalendar: "Week 1: Aug 25\nLabor Day: Sep 1 (no class)",
      holidays: ["Thanksgiving Break"],
      blackoutDates: ["Reading Day"]
    });
    expect(ctx).toContain("Academic calendar");
    expect(ctx).toContain("Labor Day: Sep 1 (no class)");
    expect(ctx).toContain("Thanksgiving Break");
    expect(ctx).toContain("Reading Day");
  });
});
