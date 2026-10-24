import { describe, expect, it } from "vitest";
import { PILOT_WALKS, marginPoints, perGroupToCompare, pilotFirstTimers, readPilot } from "./pilot";

describe("the pilot season", () => {
  it("is 18 walks; eight first-timers a walk is 144 people", () => {
    expect(PILOT_WALKS).toBe(18);
    expect(pilotFirstTimers(8)).toBe(144);
  });

  it("knows how sure it can be: the research table's margins", () => {
    expect(marginPoints(48)).toBe(14.1);
    expect(marginPoints(96)).toBe(10);
    expect(marginPoints(144)).toBe(8.2);
    expect(marginPoints(216)).toBe(6.7);
  });

  it("explains why every walk gets a back walker instead of an A/B test: about 170 first-timers per side", () => {
    const n = perGroupToCompare(0.5, 0.65);
    expect(n).toBeGreaterThanOrEqual(165);
    expect(n).toBeLessThanOrEqual(175);
    // A whole pilot holds about 144, fewer than one side of a fair comparison.
    expect(pilotFirstTimers(8)).toBeLessThan(n);
  });

  it("reads go / fix / stop at the lines", () => {
    expect(readPilot(8, 0.5).verdict).toBe("go");
    expect(readPilot(8, 0.49).verdict).toBe("fix");
    expect(readPilot(8, 0.35).verdict).toBe("fix");
    expect(readPilot(8, 0.34).verdict).toBe("stop");
  });

  it("never claims certainty a small pilot doesn't have", () => {
    expect(readPilot(4, 0.7).sureness).toMatch(/Run more walks/);
    expect(readPilot(12, 0.7).sureness).toMatch(/Clear enough/);
    // 52% on 144 people could still be under half: it says so.
    expect(readPilot(8, 0.52).sureness).toMatch(/It's close/);
  });

  it("keeps its range inside 0–100", () => {
    const r = readPilot(3, 0.05);
    expect(r.low).toBe(0);
    expect(readPilot(3, 0.99).high).toBe(100);
  });
});
