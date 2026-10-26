// One commission, three cities: each step of the flagship scenario, and the
// consistency rules the screen relies on, run through the real engine.
//   - declined → no paid revenue
//   - cancelled → never completed
//   - prohibited data → never disclosed
//   - a cost change → a contribution change
//   - undeliverable → unfulfilled in the report
//   - a renewal is proposed, never signed or paid by the program

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { CommandInput } from "../commands";
import { campaignReport, execute, impactPool, initialMachine, replay, type LogEntry, type Machine, type Receipt } from "../engine";
import { economics } from "../finance";
import type { Actor } from "../types";
import { DEFAULT_COMMISSION, RATES } from "./fixtures";
import { counterOffer, deliverablesOf, floorFee, heatAlertFor, moneyOf, quoteInputs, readiness, suppressCells, walksOf } from "./model";
import { runToEnd, runWeek } from "./planner";
import { valueReport, type ValueReport } from "./report";

const kayla: Actor = { role: "founder", id: "kayla" };
const buyer: Actor = { role: "partner", id: "fairhaven" };

/** A machine plus the log that built it, so any state here can be replayed. */
interface Run {
  m: Machine;
  log: LogEntry[];
  last: Receipt;
}

function send(run: Run, input: CommandInput, actor: Actor = kayla): Run {
  const r = execute(run.m, input, actor);
  return { m: r.machine, log: [...run.log, { input, actor }], last: r.receipt };
}

function absorb(run: Run, week: { machine: Machine; entries: LogEntry[] }): Run {
  return { m: week.machine, log: [...run.log, ...week.entries], last: week.machine.ledger.at(-1)! };
}

function created(over: Partial<typeof DEFAULT_COMMISSION> = {}): Run & { id: string; proposalId: string } {
  const start: Run = { m: initialMachine(), log: [], last: undefined as unknown as Receipt };
  const run = send(start, { type: "CREATE_COMMISSION", payload: { ...DEFAULT_COMMISSION, ...over } });
  const commission = Object.values(run.m.world.commissions ?? {}).at(-1);
  return { ...run, id: commission?.id ?? "", proposalId: commission?.proposalId ?? "" };
}

/** The default program with Los Angeles handed to the partner crew, signed, paid and live. */
function live() {
  let run = created();
  const { id, proposalId } = run;
  run = { ...send(run, { type: "SET_COVERAGE", payload: { commissionId: id, chapterId: "la", coverage: "crew" } }), id, proposalId };
  run = { ...send(run, { type: "ADVANCE_DEAL", payload: { proposalId } }), id, proposalId };
  run = { ...send(run, { type: "RECORD_PAYMENT", payload: { proposalId } }), id, proposalId };
  run = { ...send(run, { type: "ADVANCE_DEAL", payload: { proposalId } }), id, proposalId };
  return run;
}

const commissionOf = (run: Run & { id: string }) => run.m.world.commissions![run.id]!;

describe("A · creating the commission", () => {
  it("starts empty: the seed world has no commissions, so existing screens are untouched", () => {
    expect(initialMachine().world.commissions).toBeUndefined();
  });

  it("becomes a proposal priced by economics(), with the buyer as a partner", () => {
    const run = created();
    expect(run.last.outcome).toBe("applied");
    const p = run.m.world.proposals[run.proposalId]!;
    expect(p.stage).toBe("proposal");
    expect(p.chapterIds).toEqual(["chicago", "detroit", "la"]);
    expect(p.inputs).toEqual(quoteInputs("workplace", 3, 6, true, 18000));
    expect(run.m.world.partners.fairhaven?.name).toBe("Fairhaven Mutual");
    expect(moneyOf(run.m.world, commissionOf(run)).planned).toEqual(economics(p.inputs));
  });

  it("refuses unknown buyers, repeated cities and programs that run past August 31", () => {
    expect(created({ buyerId: "nobody" }).last.outcome).toBe("rejected");
    expect(created({ chapterIds: ["chicago", "chicago", "la"] }).last.outcome).toBe("rejected");
    const late = send({ m: initialMachine(), log: [], last: undefined as unknown as Receipt }, { type: "ADVANCE_CLOCK", payload: { to: 100 * 1440 } }, { role: "system", id: "scheduler" });
    expect(send(late, { type: "CREATE_COMMISSION", payload: DEFAULT_COMMISSION }).last.outcome).toBe("rejected");
  });
});

describe("B · can we deliver it?", () => {
  it("Chicago and Detroit are covered by their leads; Los Angeles fails leadership, access and staffing", () => {
    const run = created();
    const r = readiness(run.m.world, commissionOf(run));
    expect(r.map((x) => x.coverage)).toEqual(["lead", "lead", "pending"]);
    const la = r.find((x) => x.chapterId === "la")!;
    expect(la.checks.filter((x) => !x.ok).map((x) => x.id)).toEqual(["lead", "access", "sweeps"]);
    expect(la.options).toMatchObject({ lead: false, descope: true });
    expect(la.options.crew?.id).toBe("crew-la");
  });

  it("won't sign while a city is undecided, and won't give it to a lead who isn't ready", () => {
    const run = created();
    const sign = send(run, { type: "ADVANCE_DEAL", payload: { proposalId: run.proposalId } });
    expect(sign.last.outcome).toBe("rejected");
    expect(sign.last.summary).toMatch(/Los Angeles still needs a decision/);
    expect(send(run, { type: "SET_COVERAGE", payload: { commissionId: run.id, chapterId: "la", coverage: "lead" } }).last.outcome).toBe("rejected");
  });

  it("a partner crew costs its onboarding hours, and the contribution moves by exactly that", () => {
    const run = created();
    const before = economics(run.m.world.proposals[run.proposalId]!.inputs);
    const after = send(run, { type: "SET_COVERAGE", payload: { commissionId: run.id, chapterId: "la", coverage: "crew" } });
    const p = after.m.world.proposals[run.proposalId]!;
    expect(after.last.outcome).toBe("applied");
    expect(p.inputs.staffHours).toBe(before.staffCost / RATES.staffRate + RATES.crewOnboardingHours);
    expect(before.contribution - economics(p.inputs).contribution).toBe(RATES.crewOnboardingHours * RATES.staffRate);
  });

  it("dropping a city removes it from the deal, cuts the fee by its share, and can't drop the last one", () => {
    let run = created();
    const ids = { id: run.id, proposalId: run.proposalId };
    run = { ...send(run, { type: "SET_COVERAGE", payload: { commissionId: run.id, chapterId: "la", coverage: "descope", reason: "Lead at her limit and no crew this summer" } }), ...ids };
    const p = run.m.world.proposals[run.proposalId]!;
    expect(p.chapterIds).toEqual(["chicago", "detroit"]);
    expect(p.inputs.communities).toBe(2);
    expect(p.inputs.fee).toBe(12000);
    run = { ...send(run, { type: "SET_COVERAGE", payload: { commissionId: run.id, chapterId: "detroit", coverage: "descope" } }), ...ids };
    expect(run.last.outcome).toBe("applied");
    expect(send(run, { type: "SET_COVERAGE", payload: { commissionId: run.id, chapterId: "chicago", coverage: "descope" } }).last.outcome).toBe("rejected");
  });
});

describe("C · challenging the proposal", () => {
  it("refuses the buyer's request for names and step counts, override or not, and discloses nothing", () => {
    const run = live();
    for (const request of ["participant-list", "activity-history", "health-audience"] as const) {
      for (const override of [undefined, "The CEO says it's fine"]) {
        const r = send(run, { type: "PARTNER_DATA_REQUEST", payload: { proposalId: run.proposalId, request, ...(override ? { override } : {}) } }, buyer);
        expect(r.last.outcome).toBe("blocked");
        expect(r.m.world.egress).toEqual(run.m.world.egress);
      }
    }
    const named = send(run, { type: "PARTNER_DATA_REQUEST", payload: { proposalId: run.proposalId, request: "participant-list" } }, buyer);
    expect(named.last.ruleIds).toContain("OURS-COUNTS-NOT-PEOPLE");
  });

  it("an underpriced counter shows its loss, needs a written override to sign, and its giving stays unfunded", () => {
    let run = created();
    const ids = { id: run.id, proposalId: run.proposalId };
    run = { ...send(run, { type: "SET_COVERAGE", payload: { commissionId: run.id, chapterId: "la", coverage: "crew" } }), ...ids };
    const counter = counterOffer(18000);
    expect(counter).toBe(9500);
    run = { ...send(run, { type: "SET_PROPOSAL_INPUT", payload: { proposalId: run.proposalId, key: "fee", value: counter } }), ...ids };
    const e = economics(run.m.world.proposals[run.proposalId]!.inputs);
    expect(e.contribution).toBeLessThan(0);
    const bare = send(run, { type: "ADVANCE_DEAL", payload: { proposalId: run.proposalId } });
    expect(bare.last.outcome).toBe("blocked");
    expect(bare.last.ruleIds).toContain("COMMERCIAL-OVERRIDE");
    run = { ...send(run, { type: "ADVANCE_DEAL", payload: { proposalId: run.proposalId, override: "First program with this employer; we accept the loss to prove it." } }), ...ids };
    expect(run.last.outcome).toBe("applied");
    run = { ...send(run, { type: "RECORD_PAYMENT", payload: { proposalId: run.proposalId } }), ...ids };
    expect(impactPool(run.m.world).unfunded).toBe(e.impact);
  });

  it("the floor fee is the smallest $500 step that leaves 15% after every cost", () => {
    const run = created();
    const i = run.m.world.proposals[run.proposalId]!.inputs;
    const fee = floorFee(i);
    expect(fee % 500).toBe(0);
    expect(economics({ ...i, fee }).contribution).toBeGreaterThanOrEqual(0.15 * fee);
    expect(economics({ ...i, fee: fee - 500 }).contribution).toBeLessThan(0.15 * (fee - 500));
  });
});

describe("declined → no paid revenue", () => {
  it("a declined commission can't be paid, changed or reported, and every walk asked for is unfulfilled", () => {
    let run = created();
    const ids = { id: run.id, proposalId: run.proposalId };
    run = { ...send(run, { type: "MARK_DEAL_LOST", payload: { proposalId: run.proposalId, reason: "Couldn't meet their price" } }), ...ids };
    expect(send(run, { type: "RECORD_PAYMENT", payload: { proposalId: run.proposalId } }).last.outcome).toBe("rejected");
    expect(send(run, { type: "SET_COVERAGE", payload: { commissionId: run.id, chapterId: "la", coverage: "crew" } }).last.outcome).toBe("rejected");
    const money = moneyOf(run.m.world, commissionOf(run));
    expect(money).toMatchObject({ state: "declined", received: 0 });
    const d = deliverablesOf(run.m.world, commissionOf(run));
    expect(d).toMatchObject({ requested: 18, promised: 0, fulfilled: 0, pending: 0, unfulfilled: 18 });
    expect(impactPool(run.m.world)).toEqual(impactPool(initialMachine().world));
  });
});

describe("D · delivering it", () => {
  it("publishes every walk with a named sweep, and stops for the heat forecast before the walk it hits", () => {
    const run = live();
    const c = commissionOf(run);
    const alert = heatAlertFor(run.m.world, c)!;
    expect(alert.city).toBe("Detroit");
    const played = runToEnd(run.m, run.id);
    expect(played.paused?.eventId).toBe(alert.eventId);
    const w = played.machine.world;
    const done = walksOf(w, c).filter((x) => x.status === "completed");
    expect(done.length).toBe(9 + 1); // three weeks in three cities, and Chicago's fourth-week walk before Detroit's
    expect(done.every((x) => x.event.sweep !== null && x.event.checkIns.length > 0)).toBe(true);
    expect(w.events[alert.eventId]!.status).toBe("published");
    expect(w.clock).toBeLessThan(w.events[alert.eventId]!.day * 1440 + w.events[alert.eventId]!.startMinute);
  });

  it("moving the hot walk earlier lets it happen; the whole program then delivers what it promised", () => {
    let run: Run & { id: string; proposalId: string } = live();
    const ids = { id: run.id, proposalId: run.proposalId };
    run = { ...absorb(run, runToEnd(run.m, run.id)), ...ids };
    const alert = heatAlertFor(run.m.world, commissionOf(run))!;
    const e = run.m.world.events[alert.eventId]!;
    run = { ...send(run, { type: "RESCHEDULE_EVENT", payload: { eventId: e.id, day: e.day, startMinute: alert.earlyStart, reason: "Heat advisory: earlier start" } }, { role: "organizer", id: "nina" }), ...ids };
    expect(run.last.outcome).toBe("applied");
    run = { ...absorb(run, runToEnd(run.m, run.id)), ...ids };
    const w = run.m.world;
    expect(w.events[e.id]).toMatchObject({ status: "completed", startMinute: alert.earlyStart, moved: { startMinute: 8 * 60 } });
    expect(deliverablesOf(w, commissionOf(run))).toMatchObject({ requested: 18, promised: 18, fulfilled: 18, pending: 0, unfulfilled: 0 });
    // The crew lead ran Los Angeles, as a co-organizer of that circle only.
    const laWalks = walksOf(w, commissionOf(run)).filter((x) => x.event.chapterId === "la");
    expect(laWalks.every((x) => x.event.createdBy === "crew-la-lead")).toBe(true);
    expect(w.chapters.la!.organizers).toContain("crew-la-lead");
    expect(w.chapters.detroit!.organizers).not.toContain("crew-la-lead");
    // State is a fold of the log.
    expect(replay(run.log).ledger.at(-1)!.hash).toBe(run.m.ledger.at(-1)!.hash);
  });
});

describe("cancelled → never completed; undeliverable → unfulfilled", () => {
  function cancelled() {
    let run: Run & { id: string; proposalId: string } = live();
    const ids = { id: run.id, proposalId: run.proposalId };
    run = { ...absorb(run, runToEnd(run.m, run.id)), ...ids };
    const alert = heatAlertFor(run.m.world, commissionOf(run))!;
    run = { ...send(run, { type: "CANCEL_EVENT", payload: { eventId: alert.eventId, reason: "Heat advisory" } }, { role: "organizer", id: "nina" }), ...ids };
    return { run, alert, ids };
  }

  it("a cancelled walk can't be checked into or completed, and stays cancelled to the end", () => {
    const { run, alert } = cancelled();
    const e = run.m.world.events[alert.eventId]!;
    expect(send(run, { type: "COMPLETE_EVENT", payload: { eventId: e.id } }, { role: "organizer", id: "nina" }).last.outcome).toBe("rejected");
    expect(send(run, { type: "CHECK_IN", payload: { eventId: e.id, memberId: "james", distanceMi: 1 } }, { role: "organizer", id: "nina" }).last.outcome).toBe("rejected");
    const end = runToEnd(run.m, run.id).machine.world;
    expect(end.events[e.id]!.status).toBe("cancelled");
    const d = deliverablesOf(end, commissionOf(run));
    expect(d).toMatchObject({ fulfilled: 17, pending: 0, unfulfilled: 1, canceled: 1 });
    expect(d.byCity.find((x) => x.chapterId === "detroit")!.reasons[0]).toMatch(/Heat advisory/);
  });

  it("a makeup walk costs exactly one more walk, and turns the unfulfilled slot back into a delivered one", () => {
    const { run: base, alert, ids } = cancelled();
    const before = moneyOf(base.m.world, commissionOf(base)).asRun.contribution;
    let run = { ...send(base, { type: "ADD_MAKEUP_WALK", payload: { commissionId: base.id, eventId: alert.eventId } }), ...ids };
    expect(run.last.outcome).toBe("applied");
    expect(before - moneyOf(run.m.world, commissionOf(run)).asRun.contribution).toBe(RATES.costPerWalk + RATES.stipendPerWalk);
    expect(deliverablesOf(run.m.world, commissionOf(run)).unfulfilled).toBe(0);
    expect(send(run, { type: "ADD_MAKEUP_WALK", payload: { commissionId: base.id, eventId: alert.eventId } }).last.outcome).toBe("noop");
    run = { ...absorb(run, runToEnd(run.m, run.id)), ...ids };
    expect(deliverablesOf(run.m.world, commissionOf(run))).toMatchObject({ fulfilled: 18, unfulfilled: 0, canceled: 1 });
  });
});

describe("F · the Community Value Report", () => {
  function delivered() {
    let run: Run & { id: string; proposalId: string } = live();
    const ids = { id: run.id, proposalId: run.proposalId };
    run = { ...absorb(run, runToEnd(run.m, run.id)), ...ids };
    const alert = heatAlertFor(run.m.world, commissionOf(run))!;
    run = { ...send(run, { type: "CANCEL_EVENT", payload: { eventId: alert.eventId, reason: "Heat advisory" } }, { role: "organizer", id: "nina" }), ...ids };
    run = { ...absorb(run, runToEnd(run.m, run.id)), ...ids };
    return run;
  }

  it("only Kayla's team sees it before it's sent; the buyer after; no other partner ever", () => {
    let run = delivered();
    const ids = { id: run.id, proposalId: run.proposalId };
    expect(valueReport(run.m.world, run.id, buyer).ok).toBe(false);
    expect(valueReport(run.m.world, run.id, kayla).ok).toBe(true);
    run = { ...send(run, { type: "ADVANCE_DEAL", payload: { proposalId: run.proposalId } }), ...ids };
    expect(run.m.world.proposals[run.proposalId]!.stage).toBe("reported");
    expect(run.m.world.egress.at(-1)).toMatchObject({ recipient: "Fairhaven Mutual", lineage: ["event_checkin"] });
    expect(valueReport(run.m.world, run.id, buyer).ok).toBe(true);
    expect(valueReport(run.m.world, run.id, { role: "partner", id: "northline" }).ok).toBe(false);
  });

  it("the buyer's copy names nobody, holds no money or modelled crowd, and hides every group under 10", () => {
    let run = delivered();
    const ids = { id: run.id, proposalId: run.proposalId };
    run = { ...send(run, { type: "ADVANCE_DEAL", payload: { proposalId: run.proposalId } }), ...ids };
    const r = valueReport(run.m.world, run.id, buyer) as { ok: true; report: ValueReport };
    const text = JSON.stringify(r.report);
    const walkers = Object.values(run.m.world.members).filter((m) => m.why.startsWith("Walking with") || m.why.startsWith("Sweep"));
    expect(walkers.length).toBeGreaterThan(20);
    for (const m of walkers) {
      expect(text).not.toContain(m.id);
      expect(text).not.toMatch(new RegExp(`\\b${m.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`));
    }
    expect(r.report.money).toBeUndefined();
    expect(r.report.modelledCrowd).toBeUndefined();
    expect(r.report.sources.excluded).toEqual(expect.arrayContaining(["Strava", "Apple Health", "Health Connect", "Garmin"]));
    for (const line of [...r.report.cities, r.report.totals]) {
      for (const cell of [line.people, line.firstWalks, line.cameBack, line.regulars]) if (typeof cell === "number") expect(cell).toBeGreaterThanOrEqual(10);
    }
  });

  it("separates held, cancelled, pending and unfulfilled, and agrees with the campaign report", () => {
    const run = delivered();
    const r = (valueReport(run.m.world, run.id, kayla) as { ok: true; report: ValueReport }).report;
    expect(r.deliverables).toMatchObject({ requested: 18, fulfilled: 17, unfulfilled: 1, pending: 0 });
    expect(r.canceled).toEqual([expect.objectContaining({ city: "Detroit", reason: "Heat advisory", rerun: false })]);
    expect(r.unfulfilled).toEqual([expect.objectContaining({ city: "Detroit", count: 1 })]);
    const campaign = campaignReport(run.m.world, run.proposalId);
    if (typeof r.totals.firstWalks === "number") expect(r.totals.firstWalks).toBe(campaign.firstTimers);
    expect(r.cities.reduce((s, x) => s + x.held, 0)).toBe(campaign.eventsCompleted);
    expect(r.money?.received).toBe(18000);
  });
});

describe("G · renewal is proposed, never signed or paid", () => {
  it("needs the report first, then drafts next summer at the proposal stage only", () => {
    let run: Run & { id: string; proposalId: string } = live();
    const ids = { id: run.id, proposalId: run.proposalId };
    run = { ...absorb(run, runToEnd(run.m, run.id)), ...ids };
    const alert = heatAlertFor(run.m.world, commissionOf(run))!;
    run = { ...send(run, { type: "RESCHEDULE_EVENT", payload: { eventId: alert.eventId, day: alert.day, startMinute: alert.earlyStart, reason: "Heat advisory: earlier start" } }, { role: "organizer", id: "nina" }), ...ids };
    run = { ...absorb(run, runToEnd(run.m, run.id)), ...ids };
    expect(send(run, { type: "PROPOSE_RENEWAL", payload: { commissionId: run.id } }).last.outcome).toBe("rejected");
    run = { ...send(run, { type: "ADVANCE_DEAL", payload: { proposalId: run.proposalId } }), ...ids };
    const pool = impactPool(run.m.world);
    run = { ...send(run, { type: "PROPOSE_RENEWAL", payload: { commissionId: run.id } }), ...ids };
    expect(run.last.outcome).toBe("applied");
    const renewal = run.m.world.proposals[commissionOf(run).renewalProposalId!]!;
    expect(renewal).toMatchObject({ stage: "proposal", signedAt: null, paidAt: null, partnerId: "fairhaven", chapterIds: ["chicago", "detroit", "la"] });
    expect(economics(renewal.inputs).contribution).toBeGreaterThanOrEqual(0.2 * renewal.inputs.fee);
    expect(impactPool(run.m.world).committed).toBe(pool.committed);
    expect(impactPool(run.m.world).pipeline).toBe(pool.pipeline + economics(renewal.inputs).impact);
    expect(send(run, { type: "PROPOSE_RENEWAL", payload: { commissionId: run.id } }).last.outcome).toBe("noop");
    // The old deal can't call itself renewed until next season is signed.
    expect(send(run, { type: "ADVANCE_DEAL", payload: { proposalId: run.proposalId } }).last.outcome).toBe("rejected");
  });
});

describe("properties", () => {
  it("suppression: shown cells are at least 10, and one hidden cell never sits beside a shown total", () => {
    fc.assert(
      fc.property(fc.array(fc.nat({ max: 40 }), { minLength: 1, maxLength: 4 }), (values) => {
        const total = values.reduce((s, v) => s + v, 0);
        const { cells, total: t } = suppressCells(values, total);
        if (cells.some((x) => typeof x === "number" && x < 10)) return false;
        if (typeof t === "number" && t < 10) return false;
        const hidden = cells.filter((x) => typeof x !== "number").length;
        return typeof t !== "number" || hidden !== 1;
      }),
      { numRuns: 300 },
    );
  });

  it("any quote's money is economics() of its terms, and a cost change moves contribution by cost × walks", () => {
    fc.assert(
      fc.property(fc.integer({ min: 3, max: 8 }), fc.integer({ min: 1, max: 60 }), fc.integer({ min: 1, max: 100 }), (weeks, k, bump) => {
        const fee = k * 1000;
        const run = created({ weeks, fee });
        if (run.last.outcome !== "applied") return false;
        const c = commissionOf(run);
        const p = run.m.world.proposals[run.proposalId]!;
        if (moneyOf(run.m.world, c).planned.contribution !== economics(p.inputs).contribution) return false;
        const after = send(run, { type: "SET_PROPOSAL_INPUT", payload: { proposalId: run.proposalId, key: "costPerEvent", value: p.inputs.costPerEvent + bump } });
        const moved = economics(p.inputs).contribution - moneyOf(after.m.world, commissionOf({ ...after, id: run.id })).planned.contribution;
        return Math.abs(moved - bump * 3 * weeks) <= 1;
      }),
      { numRuns: 40 },
    );
  });

  it("every walk asked for is exactly one of fulfilled, pending or unfulfilled, through any week, cancel or makeup", () => {
    const base = live();
    fc.assert(
      fc.property(fc.array(fc.tuple(fc.constantFrom("week", "cancel", "makeup"), fc.nat({ max: 20 })), { maxLength: 6 }), (steps) => {
        let m = base.m;
        let week = 0;
        for (const [kind, n] of steps) {
          const c = m.world.commissions![base.id]!;
          const walks = walksOf(m.world, c);
          if (kind === "week") {
            m = runWeek(m, base.id, week++).machine;
          } else if (kind === "cancel") {
            const target = walks.filter((x) => x.status === "pending")[n % Math.max(1, walks.length)];
            if (target) m = execute(m, { type: "CANCEL_EVENT", payload: { eventId: target.event.id, reason: "Storm" } }, kayla).machine;
          } else {
            const target = walks.filter((x) => x.status === "canceled")[0];
            if (target) m = execute(m, { type: "ADD_MAKEUP_WALK", payload: { commissionId: base.id, eventId: target.event.id } }, kayla).machine;
          }
          const d = deliverablesOf(m.world, m.world.commissions![base.id]!);
          if (d.byCity.some((x) => x.fulfilled + x.pending + x.unfulfilled !== x.requested)) return false;
          // Cancelled is final.
          if (walksOf(m.world, m.world.commissions![base.id]!).some((x) => x.event.status === "completed" && x.event.cancelReason)) return false;
        }
        return true;
      }),
      { numRuns: 12 },
    );
  });
});
