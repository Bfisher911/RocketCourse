import { describe, expect, it } from "vitest";
import { fillTemplate, toCleanString, toPlainText, toPlainTextList, toStringList } from "./aiAssist";

describe("aiAssist coercions", () => {
  it("fillTemplate replaces known tokens and leaves unknown ones intact", () => {
    expect(fillTemplate("Hello {{name}}, {{missing}}", { name: "World" })).toBe("Hello World, {{missing}}");
  });

  it("toCleanString trims and rejects empties", () => {
    expect(toCleanString("  x  ")).toBe("x");
    expect(toCleanString("   ")).toBeUndefined();
    expect(toCleanString(7)).toBeUndefined();
  });

  it("toPlainText strips model-returned HTML so escaped template fields never show literal tags", () => {
    expect(toPlainText("<p>Welcome to <strong>The Course</strong>!</p>")).toBe("Welcome to The Course!");
    expect(toPlainText("Line one<br>Line two")).toBe("Line one Line two");
    expect(toPlainText("A &amp; B &lt;ok&gt;")).toBe("A & B <ok>");
    expect(toPlainText("<div></div>")).toBeUndefined();
    expect(toPlainText(42)).toBeUndefined();
  });

  it("toPlainTextList coerces each entry and drops empties", () => {
    expect(
      toPlainTextList([
        "<strong>Weekly Rhythm:</strong> readings and discussions",
        "<a class='btn' href='modules/module_start'>Start Here</a>",
        "",
        7
      ])
    ).toEqual(["Weekly Rhythm: readings and discussions", "Start Here"]);
  });

  it("toStringList keeps raw strings (for fields that legitimately allow markup)", () => {
    expect(toStringList(["a", " b ", 3, ""])).toEqual(["a", "b"]);
  });
});
