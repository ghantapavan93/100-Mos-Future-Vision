// The three-summer plan in plain words: the existing plan arithmetic (runYear,
// reachOf, the two FORK paths) with four levers a founder understands, and the
// live Year 10 goals rewritten as sentences. People first, money second: every
// summer leads with walks and first-timers, and money is "still to raise",
// never a loss. Nothing here changes the domain math; it only chooses what to
// show and how to say it.

import type { Receipt } from "@/domain/engine";
import { runYear, type YearPlan, type YearResult } from "@/domain/finance";
import { FORK, LATER_GATES, liveGates, reachOf, type ForkPath, type Year } from "@/domain/plans";
import { founderView } from "@/domain/selectors";
import { DEAL_STAGES, type World } from "@/domain/types";
import { actors, store } from "@/lib/store";

export type PathId = "circles-first" | "workplace-first";

export const PATH_NAME: Record<PathId, string> = {
  "circles-first": "City circles first",
  "workplace-first": "Company teams first",
};

export function pathOf(id: PathId): ForkPath {
  return FORK.find((p) => p.id === id) ?? FORK[0];
}

/** The four numbers on the phone, all set for Year 10; later summers grow from them as the path does. */
export interface Levers {
  cities: number;
  sponsors: number;
  price: number;
  /** Percent of sponsor money that goes to giving back. */
  giving: number;
}

export function leversFor(id: PathId): Levers {
  const y = pathOf(id).years[0];
  return { cities: y.chapters, sponsors: y.brandPrograms, price: y.brandAvgFee, giving: y.impactPct };
}

export const LEVER_RANGE: Record<keyof Levers, { min: number; max: number; step: number }> = {
  cities: { min: 2, max: 24, step: 1 },
  sponsors: { min: 0, max: 40, step: 1 },
  price: { min: 1000, max: 15000, step: 500 },
  giving: { min: 0, max: 30, step: 1 },
};

export interface PlannedYear {
  year: Year;
  plan: YearPlan;
  result: YearResult;
  newcomers: number;
  teammates: number;
}

/** Each summer of the path, with the levers applied: Year 10 takes them as set, later years keep the path's growth. */
export function plannedYears(id: PathId, levers: Levers): PlannedYear[] {
  const path = pathOf(id);
  const base = path.years[0];
  const cityGrowth = levers.cities / Math.max(1, base.chapters);
  const sponsorGrowth = levers.sponsors / Math.max(1, base.brandPrograms);
  const priceGrowth = levers.price / Math.max(1, base.brandAvgFee);
  return path.years.map((y) => {
    const plan: YearPlan = {
      ...y,
      chapters: Math.max(1, Math.round(y.chapters * cityGrowth)),
      brandPrograms: base.brandPrograms === 0 ? levers.sponsors : Math.round(y.brandPrograms * sponsorGrowth),
      brandAvgFee: Math.round((y.brandAvgFee * priceGrowth) / 50) * 50,
      impactPct: levers.giving,
    };
    const reach = reachOf(plan);
    return { year: plan.year as Year, plan, result: runYear(plan), newcomers: reach.newcomers, teammates: reach.employees };
  });
}

/** The other path, for the scene's second line. */
export function otherPath(id: PathId): PathId {
  return id === "circles-first" ? "workplace-first" : "circles-first";
}

/** People who join each summer: first-timers at group walks plus teammates on company teams. */
export function peopleOf(y: PlannedYear): number {
  return y.newcomers + y.teammates;
}

/** "3,200" — a plan's people, rounded so nobody reads it as a count. */
export function about(n: number): string {
  const step = n >= 1000 ? 100 : 10;
  return (Math.round(n / step) * step).toLocaleString("en-US");
}

/** "$12K" / "−$40K" — short enough for a phone row. */
export function kUsd(n: number): string {
  const k = Math.round(Math.abs(n) / 1000);
  return `${n < 0 ? "−" : ""}$${k.toLocaleString("en-US")}K`;
}

/** One plain sentence on a summer's money: what it leaves over, or what is still to raise. */
export function moneyLine(operatingResult: number): string {
  if (operatingResult >= 0) return `Covers its costs, ${kUsd(operatingResult)} left over`;
  return `Still to raise: ${kUsd(-operatingResult)}`;
}

export const SUMMERS: Record<Year, { tag: string; name: string; line: string; build: string; goal: string }> = {
  2027: {
    tag: "Year 10",
    name: "Ten summers strong",
    line: "The tenth summer: a kickoff in every city, company teams — your Year 10 goal — and sponsors who pay for real walks.",
    build: "Totals everyone can trust, “Start your summer”, the City Lead toolkit, and company teams on the same miles.",
    goal: "7 cities · first company teams · a movers and miles goal you set",
  },
  2028: {
    tag: "Year 11",
    name: "Repeat it",
    line: "Turn what worked into a kit. New cities start ready, and sponsors and teams come back.",
    build: "Circle in a Box for new cities, a sponsor package you can sell again, giving votes in every city.",
    goal: "Circle in a Box for new cities · half the sponsors come back",
  },
  2029: {
    tag: "Year 12",
    name: "Grow it",
    line: "Grow only where it stays good, give more back, and let partners carry more of the season.",
    build: "City tools for many leads, a yearly giving report, miles or kilometres.",
    goal: "A bigger giving fund · partners carry more of the season",
  },
};

export interface Check {
  id: string;
  title: string;
  pass: boolean | null;
  /** Where it stands now, in one line. */
  status: string;
}

const PILOT_IDS = ["pr-northline", "pr-lakeshore", "pr-riverside"];

/** Sponsors who have actually paid (a signature isn't money). */
export function paidSponsors(world: World): number {
  return Object.values(world.proposals).filter((p) => p.signedAt !== null && p.paidAt !== null && p.stage !== "lost").length;
}

/** The live Year 10 goals — the same tests the plan uses — said plainly. */
export function yearTenChecks(world: World, ledger: readonly Receipt[]): Check[] {
  const gates = Object.fromEntries(liveGates(world, ledger).map((g) => [g.id, g]));
  const paid = paidSponsors(world);
  const signedOnly = Object.values(world.proposals).filter((p) => p.signedAt !== null && p.paidAt === null && p.stage !== "lost").length;
  const busiest = founderView(world).chapters.reduce((max, c) => (c.eventsPerOrganizer > max.eventsPerOrganizer ? c : max));
  return [
    {
      id: "pilots",
      title: "Two sponsors have paid",
      pass: gates.pilots?.pass ?? false,
      status: `${Math.min(paid, 2)} of 2 paid${signedOnly ? ` · ${signedOnly} signed, not paid yet` : ""}. It turns green when the money arrives.`,
    },
    {
      id: "coach-safety",
      title: "The coach passes its safety test",
      pass: gates["coach-safety"]?.pass ?? false,
      status: gates["coach-safety"]?.pass ? "Passed. Members can ask anything." : "Not yet. Until it passes, members pick from safe, ready-made questions.",
    },
    {
      id: "disclosures",
      title: "No one's data has been shared",
      pass: gates.disclosures?.pass ?? false,
      status: gates.disclosures?.pass ? "Sponsors have only ever seen totals." : "Something left without permission. Sponsor reports pause.",
    },
    {
      id: "screens-agree",
      title: "Every total adds up",
      pass: gates["screens-agree"]?.pass ?? false,
      status: gates["screens-agree"]?.pass ? "Each city's total matches every walk logged." : "A city's total doesn't match its walks. Fix it before reporting.",
    },
    {
      id: "organizer-load",
      title: "City Leads aren't stretched thin",
      pass: gates["organizer-load"]?.pass ?? false,
      status: `Busiest: ${busiest.city}, ${busiest.eventsPerOrganizer} walks per lead.${busiest.eventsPerOrganizer >= 4 ? " Time to find a co-lead." : ""}`,
    },
  ];
}

const LATER_PLAIN: Record<string, string> = {
  renewal: "Half of Year 10 sponsors come back",
  return: "Members come back for another summer",
  "co-leads": "Every city has two leads",
  contribution: "Sponsor programs earn more than they cost",
  operating: "The season pays for itself",
  legal: "Data questions answered by a lawyer",
  "impact-audit": "Giving is checked and shared publicly",
};

/** Goals for 2028 and 2029 can only be measured after those summers. */
export function laterChecks(year: 2028 | 2029): Check[] {
  return LATER_GATES[year].map((g) => ({ id: g.id, title: LATER_PLAIN[g.id] ?? g.title, pass: null, status: "Measured after the summer." }));
}

/**
 * The next sponsor who hasn't paid, signed and paid through the real engine:
 * choose where it runs, move the deal to a signed contract, record the payment.
 * Returns false when nobody is left or the engine says no.
 */
export function payNextSponsor(): boolean {
  const world = store.get().machine.world;
  const id = PILOT_IDS.find((pid) => {
    const p = world.proposals[pid];
    return p && p.stage !== "lost" && p.paidAt === null;
  });
  if (!id) return false;
  const meta = { via: "next-three-summers" };
  const p = world.proposals[id]!;
  if (p.signedAt === null) {
    if (new Set(p.chapterIds).size < p.inputs.communities) {
      const led = Object.values(world.chapters).filter((c) => c.organizers.length > 0).map((c) => c.id);
      store.dispatch({ type: "SET_PROPOSAL_CHAPTERS", payload: { proposalId: id, chapterIds: led.slice(0, p.inputs.communities) } }, actors.founder, meta);
    }
    const contract = DEAL_STAGES.indexOf("contract");
    for (let guard = 0; guard < DEAL_STAGES.length; guard++) {
      const now = store.get().machine.world.proposals[id]!;
      if (now.signedAt !== null || DEAL_STAGES.indexOf(now.stage) >= contract) break;
      const r = store.dispatch({ type: "ADVANCE_DEAL", payload: { proposalId: id } }, actors.founder, meta);
      if (r.outcome !== "applied") return false;
    }
  }
  return store.dispatch({ type: "RECORD_PAYMENT", payload: { proposalId: id } }, actors.founder, meta).outcome === "applied";
}
