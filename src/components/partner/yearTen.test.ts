import { describe, expect, it } from "vitest";
import { ALL_ROLES, gapFor, teamCost, topPartnerCloses, totalIn } from "@/components/future/proof";
import { LOADED_FTE } from "@/domain/plans";
import { BIG_PARTNER, PRESENTING, RELAY, TEAM_COST, paysFor, picture, streamsTotal } from "./yearTen";

describe("the Year 10 money picture on Sponsors", () => {
  it("is the same lean team Next 3 summers shows: about $167K", () => {
    expect(TEAM_COST).toBe(teamCost(2027, ALL_ROLES));
    expect(Math.round(TEAM_COST / 1000)).toBe(167);
  });

  it("brings in exactly what Next 3 summers' money chart says, case by case, with and without a relay", () => {
    expect(streamsTotal("cautious") + PRESENTING.cautious).toBe(totalIn(2027, "low"));
    expect(streamsTotal("middle") + PRESENTING.middle).toBe(totalIn(2027, "mid"));
    expect(streamsTotal("strong") + PRESENTING.strong).toBe(totalIn(2027, "high"));
    expect(picture("middle", PRESENTING.middle, true).total).toBe(totalIn(2027, "mid", true));
    expect(streamsTotal("middle")).toBe(49_000);
    expect(RELAY).toBe(25_000);
  });

  it("the middle case falls short by the same amount the plan calls still to raise", () => {
    const now = picture("middle", PRESENTING.middle);
    expect(now.covers).toBe(false);
    expect(now.short).toBe(-gapFor(2027, "mid", ALL_ROLES).left);
    expect(Math.round(now.short / 1000)).toBe(88);
  });

  it("one big partner gets within about $18K; with a relay it covers the team — the same reading as the plan", () => {
    const big = picture("middle", BIG_PARTNER);
    expect(big.covers).toBe(false);
    expect(big.short).toBe(-topPartnerCloses(2027, ALL_ROLES).left);
    expect(Math.round(big.short / 1000)).toBe(18);
    const both = picture("middle", BIG_PARTNER, true);
    expect(both.covers).toBe(true);
    expect(both.total - TEAM_COST).toBe(topPartnerCloses(2027, ALL_ROLES, true).left);
    expect(Math.round(picture("middle", 0, true).need / 1000)).toBe(93);
  });

  it("turns a fee into stipends first, then whole months of the program manager", () => {
    const p = paysFor(100_000);
    expect(p.stipends).toBe(7_000);
    expect(p.managerMonths).toBe(Math.floor(93_000 / (LOADED_FTE / 12)));
    expect(p.stipends + p.managerMonths * (LOADED_FTE / 12) + p.rest).toBeCloseTo(100_000, -1);
    expect(paysFor(5_000)).toEqual({ stipends: 5_000, managerMonths: 0, rest: 0 });
  });
});
