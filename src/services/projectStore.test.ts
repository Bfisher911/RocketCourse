import { describe, expect, it } from "vitest";
import { dedupeById } from "./projectStore";

describe("dedupeById", () => {
  it("keeps the first occurrence of each id (input is newest-first)", () => {
    const items = [
      { id: "a", v: 1 },
      { id: "b", v: 2 },
      { id: "a", v: 99 }, // stale duplicate — dropped
      { id: "c", v: 3 },
      { id: "b", v: 88 }, // stale duplicate — dropped
    ];
    const out = dedupeById(items);
    expect(out.map((i) => i.id)).toEqual(["a", "b", "c"]);
    // the FIRST (freshest) copy is kept
    expect(out.find((i) => i.id === "a")!.v).toBe(1);
    expect(out.find((i) => i.id === "b")!.v).toBe(2);
  });

  it("is a no-op when all ids are unique, preserving order", () => {
    const items = [{ id: "x" }, { id: "y" }, { id: "z" }];
    expect(dedupeById(items)).toEqual(items);
  });

  it("handles an empty list", () => {
    expect(dedupeById([])).toEqual([]);
  });
});
