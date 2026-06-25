import { describe, expect, it } from "vitest";
import { formatUsd, getCourseAiSpend, recordCourseAiSpend, subscribeCourseAiSpend } from "./aiSpendMeter";

const cost = (costMicroUsd: number, model = "gpt-4o-mini") => ({ costMicroUsd, model });

describe("aiSpendMeter", () => {
  it("returns an empty, stable snapshot for an untracked course", () => {
    const a = getCourseAiSpend("course_unknown");
    const b = getCourseAiSpend("course_unknown");
    expect(a).toEqual({ calls: 0, totalMicroUsd: 0 });
    expect(a).toBe(b); // referentially stable -> safe for useSyncExternalStore
  });

  it("accumulates calls + micro-USD per course and notifies subscribers", () => {
    let notified = 0;
    const unsub = subscribeCourseAiSpend(() => {
      notified += 1;
    });
    const id = "course_accumulate";
    recordCourseAiSpend(id, cost(800)); // $0.0008
    recordCourseAiSpend(id, cost(750_000, "gpt-4o")); // $0.75
    const spend = getCourseAiSpend(id);
    expect(spend.calls).toBe(2);
    expect(spend.totalMicroUsd).toBe(750_800);
    expect(spend.lastModel).toBe("gpt-4o");
    expect(notified).toBe(2);
    unsub();
  });

  it("keeps courses isolated", () => {
    recordCourseAiSpend("course_a", cost(1000));
    recordCourseAiSpend("course_b", cost(2000));
    expect(getCourseAiSpend("course_a").totalMicroUsd).toBe(1000);
    expect(getCourseAiSpend("course_b").totalMicroUsd).toBe(2000);
  });

  it("is a no-op for null cost or a missing course id", () => {
    recordCourseAiSpend("course_noop", null);
    recordCourseAiSpend(undefined, cost(5000));
    expect(getCourseAiSpend("course_noop")).toEqual({ calls: 0, totalMicroUsd: 0 });
  });

  it("formats spend without ever collapsing a real sub-cent cost to $0.00", () => {
    expect(formatUsd(0)).toBe("$0");
    expect(formatUsd(800)).toBe("$0.0008"); // single builder call
    expect(formatUsd(5000)).toBe("$0.0050");
    expect(formatUsd(62_000)).toBe("$0.062"); // ~fully-AI course
    expect(formatUsd(1_500_000)).toBe("$1.50");
  });
});
