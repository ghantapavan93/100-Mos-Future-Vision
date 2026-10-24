import { describe, expect, it } from "vitest";
import { execute, initialMachine, type Machine } from "./engine";
import { contributionBand, economics, runYear, v2Gross } from "./finance";
import { ASSUMPTIONS, basisFor, FORK, forkBands, FTE_LOAD, liveGates, LOADED_FTE, PRESETS, presetYear, programHeadline, summariseFork, withSliders, YEARS } from "./plans";
import type { Actor } from "./types";

const kayla: Actor = { role: "founder", id: "kayla" };
const kirk: Actor = { role: "engineer", id: "kirk" };

function sign(m: Machine, proposalId: string, chapterIds: string[]): Machine {
  let next = execute(m, { type: "SET_PROPOSAL_CHAPTERS", payload: { proposalId, chapterIds } }, kayla).machine;
  while (next.world.proposals[proposalId]!.signedAt === null) {
    const r = execute(next, { type: "ADVANCE_DEAL", payload: { proposalId } }, kayla);
    expect(r.receipt.outcome).toBe("applied");
    next = r.machine;
  }
  return next;
}

function pay(m: Machine, proposalId: string): Machine {
  const r = execute(m, { type: "RECORD_PAYMENT", payload: { proposalId } }, kayla);
  expect(r.receipt.outcome).toBe("applied");
  return r.machine;
}

const gate = (m: Machine, id: string) => liveGates(m.world, m.ledger).find((g) => g.id === id)!;
const assumption = (key: string) => ASSUMPTIONS.find((a) => a.key === key)!;

describe("three-year plans", () => {
  it("every preset and path year produces finite results", () => {
    for (const preset of Object.values(PRESETS)) {
      for (const y of preset.years) {
        const r = runYear(y);
        for (const v of Object.values(r)) expect(Number.isFinite(v)).toBe(true);
      }
    }
    for (const path of FORK) {
      const s = summariseFork(path);
      expect(s.cumulative).toHaveLength(3);
      expect(s.cumulative.every(Number.isFinite)).toBe(true);
      expect(s.reach.every((r) => r.newcomers > 0)).toBe(true);
    }
  });

  it("the fork is a real trade-off: A welcomes more newcomers, B needs less bridge money", () => {
    const [a, b] = FORK.map(summariseFork);
    expect(a!.reach.at(-1)!.newcomers).toBeGreaterThan(b!.reach.at(-1)!.newcomers * 3);
    expect(b!.bridge).toBeLessThan(a!.bridge);
    expect(a!.bridgePerNewcomer).toBeLessThan(b!.bridgePerNewcomer / 3);
  });

  it("keeps V2's formula: 8 × $7,500 + 4 × $12,000 = $108,000, and the lab's gross agrees with it", () => {
    const scenario = initialMachine().world.scenario;
    expect(v2Gross(scenario)).toBe(108_000);
    for (const year of YEARS) expect(runYear(withSliders(presetYear("base", year), scenario)).gross).toBe(108_000);
    // V2's defaults are exactly the ambitious 2027 case.
    expect(runYear(presetYear("ambitious", 2027)).gross).toBe(108_000);
  });

  it("staff are costed loaded, not at the bare wage: a community manager's median wage × the employer-cost load", () => {
    // BLS: $78,240 median wage; wages are 70% of employer cost, so ×1.43.
    expect(FTE_LOAD).toBe(1.43);
    expect(LOADED_FTE).toBe(Math.round(78_240 * FTE_LOAD));
    // About $112K: inside the loaded range for this role ($112K–$117K at the top).
    expect(LOADED_FTE).toBeGreaterThan(110_000);
    expect(LOADED_FTE).toBeLessThan(117_500);
    for (const preset of Object.values(PRESETS)) for (const y of preset.years) expect(y.costPerFte).toBe(LOADED_FTE);
  });

  it("the chart, the headline and the bridge come from the same runs", () => {
    for (const path of FORK) {
      const s = summariseFork(path);
      const last = forkBands(path).at(-1)!;
      expect([last.p10, last.p50, last.p90]).toEqual([s.band.p10, s.band.p50, s.band.p90]);
      expect(s.bridge).toBe(s.bridgeBand.p50);
      expect(s.bridgeBand.p10).toBeLessThanOrEqual(s.bridgeBand.p50);
      expect(s.bridgeBand.p50).toBeLessThanOrEqual(s.bridgeBand.p90);
      // Uncertainty leans pessimistic: the median season needs at least as much bridge as the plan as written.
      expect(s.bridge).toBeGreaterThanOrEqual(s.planBridge);
    }
  });
});

describe("one headline per program", () => {
  it("leads with the band's median; the arithmetic is the plan", () => {
    const inputs = initialMachine().world.proposals["pr-northline"]!.inputs;
    const h = programHeadline(inputs);
    expect(h.expected).toBe(contributionBand(inputs).p50);
    expect(h.plan).toBe(economics(inputs).contribution);
    expect(h.expected).toBeLessThanOrEqual(h.plan);
  });

  it("calls a value evidence only inside a cited range", () => {
    expect(basisFor(assumption("brandAvgFee"), 3500)).toBe("evidence");
    expect(basisFor(assumption("brandAvgFee"), 7500)).toBe("outside-evidence");
    expect(basisFor(assumption("brandAvgFee"), 20_000)).toBe("evidence");
    expect(basisFor(assumption("workplaceAvgFee"), 12_000)).toBe("evidence");
    expect(basisFor(assumption("costPerFte"), LOADED_FTE)).toBe("evidence");
    expect(basisFor(assumption("deliveryCostPct"), 37)).toBe("assumption");
  });
});

describe("live 2027 gates", () => {
  it("start honest: nothing signed or paid, no disclosures, screens agree", () => {
    const m = initialMachine();
    expect(gate(m, "pilots").pass).toBe(false);
    expect(gate(m, "coach-safety").evidence).toMatch(/Ruleset v1/);
    expect(gate(m, "disclosures").pass).toBe(true);
    expect(gate(m, "screens-agree").pass).toBe(true);
    expect(gate(m, "organizer-load").pass).toBe(true);
  });

  it("the pilot gate counts paid contracts, not signatures", () => {
    let m = sign(initialMachine(), "pr-northline", ["dallas", "atlanta"]);
    m = sign(m, "pr-lakeshore", ["dallas"]);
    expect(gate(m, "pilots").pass).toBe(false);
    expect(gate(m, "pilots").evidence).toMatch(/2 signed, awaiting payment/);
    m = pay(m, "pr-northline");
    expect(gate(m, "pilots").pass).toBe(false);
    m = pay(m, "pr-lakeshore");
    expect(gate(m, "pilots").pass).toBe(true);
    expect(gate(m, "pilots").evidence).toMatch(/Northline.*Lakeshore/);
  });

  it("a corrupted read model fails the screens gate until it is rebuilt", () => {
    let m = execute(initialMachine(), { type: "CORRUPT_PROJECTION", payload: { chapterId: "dallas", delta: 300 } }, kirk).machine;
    expect(gate(m, "screens-agree").pass).toBe(false);
    m = execute(m, { type: "REBUILD_PROJECTIONS", payload: {} }, kirk).machine;
    expect(gate(m, "screens-agree").pass).toBe(true);
  });

  it("the coach gate follows whichever ruleset is active", () => {
    let m = initialMachine();
    m = execute(m, { type: "PROPOSE_RULESET", payload: { version: "v2" } }, kirk).machine;
    m = execute(m, { type: "APPROVE_RULESET", payload: { as: "engineering" } }, kirk).machine;
    m = execute(m, { type: "APPROVE_RULESET", payload: { as: "content" } }, kayla).machine;
    expect(gate(m, "coach-safety").evidence).toMatch(new RegExp(`Ruleset ${m.world.coach.activeRuleset}`));
  });

  it("counts refused partner requests without counting them as disclosures", () => {
    const r = execute(initialMachine(), { type: "PARTNER_DATA_REQUEST", payload: { proposalId: "pr-northline", request: "participant-list" } }, kayla);
    const g = liveGates(r.machine.world, r.machine.ledger).find((x) => x.id === "disclosures")!;
    expect(g.pass).toBe(true);
    expect(g.evidence).toMatch(/1 partner request refused/);
  });
});
