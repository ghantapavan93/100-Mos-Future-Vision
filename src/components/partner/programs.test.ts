import { describe, expect, it } from "vitest";
import { TEAM_FEE } from "@/components/future/proof";
import { joiners, programPrice, teamsFor } from "./programs";

describe("programs for any organization", () => {
  it("prices an employer at the one company-team price, a team per 1,200 people", () => {
    expect(TEAM_FEE).toBe(4000);
    expect(programPrice({ kind: "employer", invited: 1200, weeks: 6 })).toEqual({ low: 4000, high: 4000 });
    expect(programPrice({ kind: "employer", invited: 300, weeks: 4 })).toEqual({ low: 4000, high: 4000 });
    expect(teamsFor(5000)).toBe(5);
    expect(programPrice({ kind: "employer", invited: 5000, weeks: 8 })).toEqual({ low: 20_000, high: 20_000 });
  });

  it("prices a university per person who joins, 20–40% of those invited", () => {
    expect(joiners(5000)).toEqual({ low: 1000, high: 2000 });
    expect(programPrice({ kind: "university", invited: 5000, weeks: 6 })).toEqual({ low: 7000, high: 22000 });
  });
});
