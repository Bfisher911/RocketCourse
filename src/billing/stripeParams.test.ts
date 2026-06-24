import { describe, expect, it } from "vitest";
import { getPlan } from "../data/plans";
import { TEAM_SEAT_MAX, isSeatSelectable, resolveSeatCount } from "./stripeParams";

describe("isSeatSelectable", () => {
  it("is true only for the team-capable recurring plan", () => {
    expect(isSeatSelectable(getPlan("team"))).toBe(true);
  });
  it("is false for individual plans", () => {
    expect(isSeatSelectable(getPlan("individual_annual"))).toBe(false);
    expect(isSeatSelectable(getPlan("monthly_instructor"))).toBe(false);
    expect(isSeatSelectable(getPlan("designer_pro"))).toBe(false);
  });
  it("is false for contact-sales plans (no self-serve checkout)", () => {
    expect(isSeatSelectable(getPlan("department_pilot"))).toBe(false);
    expect(isSeatSelectable(getPlan("institution"))).toBe(false);
  });
});

describe("resolveSeatCount", () => {
  const team = getPlan("team"); // seatsLimit = 5

  it("defaults to the plan's included seats when no request is given", () => {
    expect(resolveSeatCount(team)).toBe(5);
    expect(resolveSeatCount(team, null)).toBe(5);
    expect(resolveSeatCount(team, undefined)).toBe(5);
  });

  it("never drops below the included floor", () => {
    expect(resolveSeatCount(team, 1)).toBe(5);
    expect(resolveSeatCount(team, 3)).toBe(5);
    expect(resolveSeatCount(team, 0)).toBe(5);
    expect(resolveSeatCount(team, -10)).toBe(5);
  });

  it("honors a larger valid request", () => {
    expect(resolveSeatCount(team, 8)).toBe(8);
    expect(resolveSeatCount(team, 25)).toBe(25);
  });

  it("caps self-serve at TEAM_SEAT_MAX", () => {
    expect(resolveSeatCount(team, 999)).toBe(TEAM_SEAT_MAX);
    expect(resolveSeatCount(team, TEAM_SEAT_MAX + 1)).toBe(TEAM_SEAT_MAX);
  });

  it("ignores garbage input and falls back to the floor", () => {
    expect(resolveSeatCount(team, "abc")).toBe(5);
    expect(resolveSeatCount(team, Number.NaN)).toBe(5);
    expect(resolveSeatCount(team, "12")).toBe(12); // numeric strings are honored
  });

  it("returns 1 for non-seat individual plans regardless of request", () => {
    expect(resolveSeatCount(getPlan("individual_annual"), 10)).toBe(1);
    expect(resolveSeatCount(getPlan("monthly_instructor"))).toBe(1);
  });
});
