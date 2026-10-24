import { describe, expect, it } from "vitest";
import { LOADED_FTE } from "@/domain/plans";
import { ALL_ROLES, RELAY_OPTION, ROLES, SUMMER_YEARS, TEAM_FEE, gapFor, moneyIn, othersIn, teamCost, topPartnerCloses, totalIn, type RoleId } from "./proof";

describe("the team", () => {
  it("costs a lean Year 10 inside the research range ($143K–$174K)", () => {
    const cost = teamCost(2027, ALL_ROLES);
    expect(cost).toBeGreaterThanOrEqual(143_000);
    expect(cost).toBeLessThanOrEqual(174_000);
  });

  it("prices the program manager like the plan does, so the two never disagree", () => {
    for (const y of SUMMER_YEARS) expect(ROLES.find((r) => r.id === "program")!.years[y].cost).toBe(LOADED_FTE);
  });

  it("partnerships start on commission: nothing fixed in Year 10", () => {
    expect(ROLES.find((r) => r.id === "partnerships")!.years[2027].cost).toBe(0);
  });

  it("turning a role off lowers the cost by exactly that role", () => {
    for (const y of SUMMER_YEARS) {
      for (const role of ROLES) {
        const without = new Set<RoleId>([...ALL_ROLES].filter((id) => id !== role.id));
        expect(teamCost(y, ALL_ROLES) - teamCost(y, without)).toBe(role.years[y].cost);
      }
    }
    expect(teamCost(2029, new Set())).toBe(0);
  });
});

describe("the money", () => {
  it("Year 10 without a relay: about $29K low, $79K middle, $205K high", () => {
    expect(Math.round(totalIn(2027, "low") / 1000)).toBe(29);
    expect(totalIn(2027, "mid")).toBe(79_000);
    expect(Math.round(totalIn(2027, "high") / 1000)).toBe(205);
  });

  it("one company-team price on every screen: $4,000 a team", () => {
    for (const y of SUMMER_YEARS) for (const c of ["low", "mid", "high"] as const) expect(moneyIn(y, c).teams % TEAM_FEE).toBe(0);
    expect(TEAM_FEE).toBe(4000);
  });

  it("the relay is an option, never part of a case: + $25K in Year 10 only, when chosen", () => {
    for (const c of ["low", "mid", "high"] as const) {
      expect(moneyIn(2027, c).relay).toBe(0);
      expect(totalIn(2027, c, true) - totalIn(2027, c)).toBe(RELAY_OPTION);
      expect(moneyIn(2028, c, true).relay).toBe(0);
    }
  });

  it("grows each summer in the middle case", () => {
    expect(totalIn(2028, "mid")).toBeGreaterThan(totalIn(2027, "mid"));
    expect(totalIn(2029, "mid")).toBeGreaterThan(totalIn(2028, "mid"));
  });

  it("orders the cases low < middle < high every summer", () => {
    for (const y of SUMMER_YEARS) {
      expect(totalIn(y, "low")).toBeLessThan(totalIn(y, "mid"));
      expect(totalIn(y, "mid")).toBeLessThan(totalIn(y, "high"));
    }
  });

  it("the honest headline holds: one big partner gets Year 10 within about $18K, and a relay covers the rest", () => {
    const g = gapFor(2027, "mid", ALL_ROLES);
    expect(Math.round(-g.left / 1000)).toBe(88);
    expect(othersIn(2027, "mid")).toBe(49_000);
    const big = topPartnerCloses(2027, ALL_ROLES);
    expect(big.extra).toBe(70_000);
    expect(Math.round(-big.left / 1000)).toBe(18);
    const withRelay = topPartnerCloses(2027, ALL_ROLES, true);
    expect(withRelay.left).toBeGreaterThan(0);
    expect(Math.round(withRelay.left / 1000)).toBe(7);
  });

  it("a high summer covers the full team every year", () => {
    for (const y of SUMMER_YEARS) expect(gapFor(y, "high", ALL_ROLES).left).toBeGreaterThan(0);
  });
});
