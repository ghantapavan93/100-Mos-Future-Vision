// Commercial arithmetic. Pure functions only: the partner studio, the impact
// pool, the founder console and the three-year lab all call these, so no two
// screens can disagree about a number. Revenue is not contribution, and
// contribution is not profit; every function names which one it returns.

import type { ProposalInputs } from "./types";

export type FlagId = "NEGATIVE_CONTRIBUTION" | "IMPACT_EXCEEDS_CONTRIBUTION" | "THIN_MARGIN" | "DELIVERY_EXCEEDS_FEE" | "STAFF_UNPRICED";

export interface Flag {
  id: FlagId;
  severity: "block" | "warn";
  text: string;
}

export interface Economics {
  /** Gross contracted fee. */
  revenue: number;
  events: number;
  eventCosts: number;
  stipends: number;
  creative: number;
  /** What V2 called "delivery": events + stipends + creative/report. */
  delivery: number;
  staffCost: number;
  processing: number;
  directCosts: number;
  contributionBeforeImpact: number;
  impact: number;
  /** Contribution margin after the impact commitment. Not profit: overheads are not allocated here. */
  contribution: number;
  marginPct: number;
  /** The fee at which contribution after impact is exactly zero. */
  breakEvenFee: number;
  flags: Flag[];
}

const round = (n: number) => Math.round(n);

export function economics(i: ProposalInputs): Economics {
  const events = i.communities * i.eventsPerCommunity;
  const eventCosts = events * i.costPerEvent;
  const stipends = events * i.organizerStipendPerEvent;
  const creative = i.creativeAndReporting;
  const delivery = eventCosts + stipends + creative;
  const staffCost = i.staffHours * i.staffRate;
  const processing = (i.fee * i.paymentFeePct) / 100;
  const directCosts = delivery + staffCost + processing;
  const contributionBeforeImpact = i.fee - directCosts;
  const impact = (i.fee * i.impactPct) / 100;
  const contribution = contributionBeforeImpact - impact;
  // fee - delivery - staff - fee*p - fee*impact = 0  →  fee = (delivery + staff) / (1 - p - impact)
  const variableShare = 1 - i.paymentFeePct / 100 - i.impactPct / 100;
  const breakEvenFee = variableShare > 0 ? (delivery + staffCost) / variableShare : Number.POSITIVE_INFINITY;

  const flags: Flag[] = [];
  if (delivery > i.fee) flags.push({ id: "DELIVERY_EXCEEDS_FEE", severity: "block", text: "Delivering this program costs more than the partner pays." });
  if (contribution < 0)
    flags.push({ id: "NEGATIVE_CONTRIBUTION", severity: "block", text: `This contract loses ${usd(-contribution)} before any overhead. It needs a written override to be signed.` });
  if (impact > 0 && contributionBeforeImpact < impact)
    flags.push({ id: "IMPACT_EXCEEDS_CONTRIBUTION", severity: "warn", text: "The impact promise is larger than what the contract earns. The difference would come from other money." });
  if (contribution >= 0 && i.fee > 0 && contribution / i.fee < 0.15)
    flags.push({ id: "THIN_MARGIN", severity: "warn", text: "Less than 15% of the fee is left after delivery and impact. One cancelled event could erase it." });
  if (i.staffHours === 0) flags.push({ id: "STAFF_UNPRICED", severity: "warn", text: "Staff time is priced at zero. V2 did this; real campaigns take hours to sell and run." });

  return {
    revenue: i.fee,
    events,
    eventCosts,
    stipends,
    creative,
    delivery,
    staffCost,
    processing: round(processing),
    directCosts: round(directCosts),
    contributionBeforeImpact: round(contributionBeforeImpact),
    impact: round(impact),
    contribution: round(contribution),
    marginPct: i.fee > 0 ? Math.round((contribution / i.fee) * 1000) / 10 : 0,
    breakEvenFee: Number.isFinite(breakEvenFee) ? round(breakEvenFee) : breakEvenFee,
    flags,
  };
}

export function usd(n: number): string {
  const sign = n < 0 ? "−" : "";
  return `${sign}$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
}

// ── Seeded randomness for uncertainty ───────────────────────────────────────

/** mulberry32: small, fast, deterministic. Same seed, same simulation, every time. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Triangular distribution: a believable min, most-likely and max. */
export function triangular(r: number, low: number, mode: number, high: number): number {
  const c = (mode - low) / (high - low);
  return r < c ? low + Math.sqrt(r * (high - low) * (mode - low)) : high - Math.sqrt((1 - r) * (high - low) * (high - mode));
}

export interface Uncertainty {
  /** Multiplier on cost per event (permits, heat-day water, insurance riders). */
  eventCost: [number, number, number];
  /** Multiplier on staff hours (selling and running always take longer). */
  staffHours: [number, number, number];
  /** Chance any one event is cancelled (summer heat, storms) and must be rerun. */
  cancelRate: number;
}

/** Assumption, not evidence: ranges chosen to be pessimistic-leaning for a first season. */
export const DEFAULT_UNCERTAINTY: Uncertainty = {
  eventCost: [0.85, 1.05, 1.6],
  staffHours: [0.9, 1.2, 2.0],
  cancelRate: 0.08,
};

export interface Band {
  p10: number;
  p50: number;
  p90: number;
  /** Share of runs in which contribution after impact is below zero. */
  pLoss: number;
  runs: number;
}

function quantile(sorted: number[], q: number): number {
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[idx]!;
}

/** Contribution after impact under uncertainty. Deterministic for a given seed. */
export function contributionBand(i: ProposalInputs, u: Uncertainty = DEFAULT_UNCERTAINTY, seed = 2027, runs = 2000): Band {
  const next = rng(seed);
  const results: number[] = [];
  const events = i.communities * i.eventsPerCommunity;
  for (let run = 0; run < runs; run++) {
    const costMult = triangular(next(), ...u.eventCost);
    const staffMult = triangular(next(), ...u.staffHours);
    let reruns = 0;
    for (let e = 0; e < events; e++) if (next() < u.cancelRate) reruns++;
    // A cancelled event loses half its cost (permits, supplies) and is rerun at full cost.
    const eventCosts = (events + reruns * 1.5) * i.costPerEvent * costMult;
    const stipends = (events + reruns) * i.organizerStipendPerEvent;
    const staff = i.staffHours * staffMult * i.staffRate;
    const direct = eventCosts + stipends + i.creativeAndReporting + staff + (i.fee * i.paymentFeePct) / 100;
    results.push(i.fee - direct - (i.fee * i.impactPct) / 100);
  }
  results.sort((a, b) => a - b);
  return {
    p10: round(quantile(results, 0.1)),
    p50: round(quantile(results, 0.5)),
    p90: round(quantile(results, 0.9)),
    pLoss: Math.round((results.filter((r) => r < 0).length / runs) * 1000) / 10,
    runs,
  };
}

// ── Three-year lab ──────────────────────────────────────────────────────────

/** V2's formula, preserved: brand programs × average fee + organization programs × average fee. */
export function v2Gross(s: { partners: number; partnerAvg: number; workplaces: number; workplaceAvg: number }): number {
  return s.partners * s.partnerAvg + s.workplaces * s.workplaceAvg;
}

export interface YearPlan {
  year: 2027 | 2028 | 2029;
  chapters: number;
  brandPrograms: number;
  brandAvgFee: number;
  workplacePrograms: number;
  workplaceAvgFee: number;
  /** Direct delivery cost as a share of program revenue (events, stipends, report, staff time). */
  deliveryCostPct: number;
  impactPct: number;
  /** Paid staff, full-time equivalents (founder salary included from 2028). */
  staffFte: number;
  costPerFte: number;
  /** Engineering, hosting, insurance, legal review and tools. */
  platformCost: number;
  eventsPerChapterPerMonth: number;
  /** Volunteer organizer hours each chapter can sustain per month before burnout. */
  organizerHoursPerChapter: number;
}

export interface YearResult {
  year: number;
  gross: number;
  directCosts: number;
  contribution: number;
  impact: number;
  fixedCosts: number;
  operatingResult: number;
  events: number;
  organizerHoursNeeded: number;
  organizerHoursAvailable: number;
  organizerLoad: number;
}

/** Hours an organizer spends per event: planning, the event, follow-up. Assumption. */
export const HOURS_PER_EVENT = 6;
/** Months of the May–August season. */
export const SEASON_MONTHS = 4;
/** A lighter September, counted as half a month. Assumption. */
export const SEPTEMBER_WEIGHT = 0.5;
/** Months a chapter runs events: the season plus a half-weight September. */
export const ACTIVE_MONTHS = SEASON_MONTHS + SEPTEMBER_WEIGHT;

export function runYear(p: YearPlan): YearResult {
  const gross = p.brandPrograms * p.brandAvgFee + p.workplacePrograms * p.workplaceAvgFee;
  const directCosts = (gross * p.deliveryCostPct) / 100;
  const impact = (gross * p.impactPct) / 100;
  const contribution = gross - directCosts - impact;
  const fixedCosts = p.staffFte * p.costPerFte + p.platformCost;
  const events = Math.round(p.chapters * p.eventsPerChapterPerMonth * ACTIVE_MONTHS);
  const organizerHoursNeeded = events * HOURS_PER_EVENT;
  const organizerHoursAvailable = p.chapters * p.organizerHoursPerChapter * ACTIVE_MONTHS;
  return {
    year: p.year,
    gross: round(gross),
    directCosts: round(directCosts),
    contribution: round(contribution),
    impact: round(impact),
    fixedCosts: round(fixedCosts),
    operatingResult: round(contribution - fixedCosts),
    events,
    organizerHoursNeeded,
    organizerHoursAvailable,
    organizerLoad: organizerHoursAvailable > 0 ? Math.round((organizerHoursNeeded / organizerHoursAvailable) * 100) : 0,
  };
}

export interface Path {
  id: string;
  name: string;
  thesis: string;
  years: [YearPlan, YearPlan, YearPlan];
  /** What has to be true for this path to work, in plain words. */
  dependsOn: string[];
  /** What we do if the first-year gate fails. */
  ifGateFails: string;
}

export interface PathResult {
  path: Path;
  years: YearResult[];
  cumulativeOperating: number;
  cumulativeImpact: number;
  peakOrganizerLoad: number;
  band: Band;
}

/** Year-level uncertainty: deal count and fee slip, delivery creeps. Assumption ranges. */
export function pathBand(path: Path, seed = 29, runs = 1500): Band {
  const next = rng(seed);
  const totals: number[] = [];
  for (let run = 0; run < runs; run++) {
    let cumulative = 0;
    for (const y of path.years) {
      const dealMult = triangular(next(), 0.45, 0.85, 1.15);
      const feeMult = triangular(next(), 0.8, 0.95, 1.1);
      const costMult = triangular(next(), 0.95, 1.05, 1.35);
      const r = runYear({
        ...y,
        brandPrograms: y.brandPrograms * dealMult,
        workplacePrograms: y.workplacePrograms * dealMult,
        brandAvgFee: y.brandAvgFee * feeMult,
        workplaceAvgFee: y.workplaceAvgFee * feeMult,
        deliveryCostPct: Math.min(95, y.deliveryCostPct * costMult),
      });
      cumulative += r.operatingResult;
    }
    totals.push(cumulative);
  }
  totals.sort((a, b) => a - b);
  return {
    p10: round(quantile(totals, 0.1)),
    p50: round(quantile(totals, 0.5)),
    p90: round(quantile(totals, 0.9)),
    pLoss: Math.round((totals.filter((t) => t < 0).length / runs) * 1000) / 10,
    runs,
  };
}

export function runPath(path: Path): PathResult {
  const years = path.years.map(runYear);
  return {
    path,
    years,
    cumulativeOperating: years.reduce((a, y) => a + y.operatingResult, 0),
    cumulativeImpact: years.reduce((a, y) => a + y.impact, 0),
    peakOrganizerLoad: Math.max(...years.map((y) => y.organizerLoad)),
    band: pathBand(path),
  };
}
