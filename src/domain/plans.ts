// Three-year plans, the Future Fork, and the decision gates between seasons.
// Pure data and pure functions: the Three-Year Lab and the founder console read
// these, and the 2027 gates read the live simulation, so a contract signed in
// Partner Studio or a ruleset approved in the Coach Lab moves a gate here.
//
// Every number is tagged by basisFor(): "evidence" only when the value sits
// inside a cited public range (accessed 2026-10-22), usually an adjacent market, not 100MoS itself. Everything else is
// an assumption, meant to be argued with. Nothing here is a forecast.

import { founderView } from "./selectors";
import { runEvals } from "./quantum/evals";
import { ACTIVE_MONTHS, contributionBand, economics, rng, runYear, triangular, type Band, type Economics, type Path, type YearPlan, type YearResult } from "./finance";
import { RULES } from "./policy";
import { verifyProjections } from "./projections";
import type { Receipt } from "./engine";
import type { ActivitySource, ProposalInputs, World } from "./types";

export type PresetId = "conservative" | "base" | "ambitious";
export type Year = 2027 | 2028 | 2029;
export const YEARS: readonly Year[] = [2027, 2028, 2029];

/**
 * What each lever means and where its range comes from. A value is called
 * "evidence" only when it sits inside a cited public range of the same unit,
 * so one lever can be evidence in one plan and an assumption in another.
 */
export interface Assumption {
  key: keyof YearPlan;
  label: string;
  /** Cited public ranges. Absent: no public evidence exists, so every value is an assumption. */
  evidence?: { ranges: [number, number][]; /** Undo a known adjustment before comparing (the FTE load). */ unload?: number };
  source: string;
}

export type BasisLabel = "evidence" | "outside-evidence" | "assumption";

/** Where one value sits: inside a cited range, outside it, or with no range to compare against. */
export function basisFor(a: Assumption, value: number): BasisLabel {
  if (!a.evidence) return "assumption";
  const v = value / (a.evidence.unload ?? 1);
  return a.evidence.ranges.some(([lo, hi]) => v >= lo && v <= hi) ? "evidence" : "outside-evidence";
}

/**
 * Benefits and payroll taxes on top of a wage. Evidence: wages are 70% of what
 * private employers pay per hour (BLS ECEC, June 2026), so a salary costs about
 * 1/0.70 ≈ 1.43× (1.46× for full-time staff).
 */
export const FTE_LOAD = 1.43;
/** Evidence: social and community service managers' median wage, May 2024 (BLS OOH 11-9151). */
export const COMMUNITY_MANAGER_WAGE = 78_240;
/** What one paid FTE costs once loaded: about $112K. */
export const LOADED_FTE = Math.round(COMMUNITY_MANAGER_WAGE * FTE_LOAD);

export const ASSUMPTIONS: Assumption[] = [
  { key: "chapters", label: "Active chapters", source: "Our planning choice; 2024 meetups ran in 6+ cities." },
  { key: "brandPrograms", label: "Brand programs sold", source: "No public run-club deal counts exist." },
  {
    key: "brandAvgFee",
    label: "Fee per brand program",
    evidence: { ranges: [[250, 5000], [15_000, 100_000]] },
    source: "P1 local sponsor $250–$5,000 per chapter; P4 presenting $15K–$100K (adjacent races). Values in between are a multi-chapter guess. Strava's floor is $30K (C10).",
  },
  { key: "workplacePrograms", label: "Workplace seasons sold", source: "Sales cycle 2–6 months is an assumption (P23)." },
  { key: "workplaceAvgFee", label: "Fee per workplace season", evidence: { ranges: [[1600, 12_500]] }, source: "P7 $1.00–$1.67 PEPM; P8 minimum deal $1,600–$12,500 (Vantage Fit, Wellable, Racery)." },
  {
    key: "deliveryCostPct",
    label: "Delivery cost, % of program revenue",
    source: "Assumption (V2 default): Future Lab V2's $2,800 delivery on a $7,500 fee is 37%. Its parts have public ranges (permits, insurance); the share does not. Salaried staff are counted separately below.",
  },
  { key: "impactPct", label: "Community-impact share", source: "Our choice; P29 says every pledge needs a hard cap." },
  { key: "staffFte", label: "Paid staff (FTE)", source: "P27: parkrun runs ~30 weekly events per paid staff. The founder is unpaid in every plan — a real cost this model leaves out." },
  {
    key: "costPerFte",
    label: "Cost per FTE, loaded",
    evidence: { ranges: [[61_160, 80_390]], unload: FTE_LOAD },
    source: `Wage is evidence (BLS: social and community service managers' median $78,240 in May 2024, $80,390 in May 2025; event planners $61,160). The ×${FTE_LOAD} load is evidence too (wages are 70% of employer cost, BLS ECEC June 2026). Before 2026-10-23 this was $65.5K × 1.3 ≈ $85K, below both.`,
  },
  { key: "platformCost", label: "Platform, insurance, legal, tools", source: "Parts evidenced (P17 insurance $75–$330 per policy); the total is ours. The band varies it ×0.95–1.3." },
  { key: "eventsPerChapterPerMonth", label: "Events per chapter per month", source: "Pop-ups 'a couple times a year' today; a monthly cadence is new." },
  { key: "organizerHoursPerChapter", label: "Volunteer organizer hours per chapter per month", source: "No public figure; volunteer burnout is the risk we watch." },
];

function plan(year: Year, p: Omit<YearPlan, "year" | "costPerFte"> & { costPerFte?: number }): YearPlan {
  return { year, costPerFte: LOADED_FTE, ...p };
}

// ── One headline per program ────────────────────────────────────────────────

export interface Headline {
  /** The median of the shared uncertainty band: the number every screen leads with. */
  expected: number;
  /** The deterministic arithmetic: what happens if everything goes to plan. */
  plan: number;
  band: Band;
  economics: Economics;
}

/**
 * The money figure for a partner program. One function, so no screen chooses
 * the optimistic number: lead with the band's median and label the arithmetic
 * "if everything goes to plan".
 */
export function programHeadline(inputs: ProposalInputs): Headline {
  const e = economics(inputs);
  const band = contributionBand(inputs);
  return { expected: band.p50, plan: e.contribution, band, economics: e };
}

/** Signed contracts split by whether the money has arrived, with the same headline rule summed across them. */
export function contractMoney(world: World) {
  const signed = Object.values(world.proposals).filter((p) => p.signedAt !== null && p.stage !== "lost");
  const heads = signed.map((p) => ({ paid: p.paidAt !== null, h: programHeadline(p.inputs) }));
  const sum = (xs: typeof heads, f: (h: Headline) => number) => xs.reduce((s, x) => s + f(x.h), 0);
  const paid = heads.filter((x) => x.paid);
  return {
    signedCount: signed.length,
    paidCount: paid.length,
    signedRevenue: sum(heads, (h) => h.economics.revenue),
    paidRevenue: sum(paid, (h) => h.economics.revenue),
    /** Sum of each contract's median: the figure to lead with. */
    expectedContribution: sum(heads, (h) => h.expected),
    /** Sum of the deterministic arithmetic: if everything goes to plan. */
    planContribution: sum(heads, (h) => h.plan),
  };
}

export interface Preset {
  id: PresetId;
  name: string;
  story: string;
  years: [YearPlan, YearPlan, YearPlan];
}

export const PRESETS: Record<PresetId, Preset> = {
  conservative: {
    id: "conservative",
    name: "Conservative",
    story: "A small, focused community with a few paid programs. A quarter-time paid helper; the founder stays unpaid and growth waits for proof.",
    years: [
      // brand fee $3,500: inside P1's $250–$5,000 local range (evidence); counts are assumptions.
      plan(2027, { chapters: 4, brandPrograms: 3, brandAvgFee: 3500, workplacePrograms: 1, workplaceAvgFee: 5000, deliveryCostPct: 40, impactPct: 10, staffFte: 0.25, platformCost: 10_000, eventsPerChapterPerMonth: 2, organizerHoursPerChapter: 30 }),
      plan(2028, { chapters: 5, brandPrograms: 5, brandAvgFee: 4000, workplacePrograms: 2, workplaceAvgFee: 5500, deliveryCostPct: 39, impactPct: 10, staffFte: 0.25, platformCost: 11_000, eventsPerChapterPerMonth: 2, organizerHoursPerChapter: 30 }),
      plan(2029, { chapters: 6, brandPrograms: 7, brandAvgFee: 4500, workplacePrograms: 3, workplaceAvgFee: 6000, deliveryCostPct: 38, impactPct: 10, staffFte: 0.25, platformCost: 12_000, eventsPerChapterPerMonth: 2, organizerHoursPerChapter: 30 }),
    ],
  },
  base: {
    id: "base",
    name: "Base",
    story: "Several chapters that hold together, and programs that repeat. A half-time community lead in 2027 growing to 1.5 people; break-even only in the third season.",
    years: [
      // workplace $8,000 ≈ 1,500 employees × $1.33 PEPM × 4 months (P7 evidence); counts are assumptions.
      plan(2027, { chapters: 4, brandPrograms: 6, brandAvgFee: 5000, workplacePrograms: 2, workplaceAvgFee: 8000, deliveryCostPct: 37, impactPct: 12, staffFte: 0.5, platformCost: 18_000, eventsPerChapterPerMonth: 3, organizerHoursPerChapter: 40 }),
      plan(2028, { chapters: 8, brandPrograms: 12, brandAvgFee: 6000, workplacePrograms: 6, workplaceAvgFee: 9000, deliveryCostPct: 37, impactPct: 12, staffFte: 1, platformCost: 24_000, eventsPerChapterPerMonth: 3, organizerHoursPerChapter: 40 }),
      plan(2029, { chapters: 12, brandPrograms: 18, brandAvgFee: 7500, workplacePrograms: 12, workplaceAvgFee: 10_000, deliveryCostPct: 35, impactPct: 12, staffFte: 1.5, platformCost: 30_000, eventsPerChapterPerMonth: 3, organizerHoursPerChapter: 40 }),
    ],
  },
  ambitious: {
    id: "ambitious",
    name: "Ambitious",
    story: "A wider network with recurring partnerships. Its 2027 is exactly Future Lab V2's defaults — which turn out to be the ambitious case.",
    years: [
      // V2 parity: 8 × $7,500 + 4 × $12,000 = $108,000. $12,000 sits at the top of P8's evidenced range.
      plan(2027, { chapters: 6, brandPrograms: 8, brandAvgFee: 7500, workplacePrograms: 4, workplaceAvgFee: 12_000, deliveryCostPct: 37, impactPct: 15, staffFte: 1, platformCost: 30_000, eventsPerChapterPerMonth: 4, organizerHoursPerChapter: 40 }),
      plan(2028, { chapters: 12, brandPrograms: 16, brandAvgFee: 9000, workplacePrograms: 10, workplaceAvgFee: 12_000, deliveryCostPct: 36, impactPct: 15, staffFte: 2, platformCost: 40_000, eventsPerChapterPerMonth: 4, organizerHoursPerChapter: 40 }),
      // brand $11,000 assumes one presenting sponsor in the mix (P4 $15K–$100K, evidence for adjacent races).
      plan(2029, { chapters: 20, brandPrograms: 24, brandAvgFee: 11_000, workplacePrograms: 18, workplaceAvgFee: 12_500, deliveryCostPct: 35, impactPct: 15, staffFte: 3, platformCost: 55_000, eventsPerChapterPerMonth: 4, organizerHoursPerChapter: 40 }),
    ],
  },
};

/** The V2 sliders override program counts and fees for the year they're set on; costs come from the preset. */
export function withSliders(p: YearPlan, s: { partners: number; partnerAvg: number; workplaces: number; workplaceAvg: number }): YearPlan {
  return { ...p, brandPrograms: s.partners, brandAvgFee: s.partnerAvg, workplacePrograms: s.workplaces, workplaceAvgFee: s.workplaceAvg };
}

export function presetYear(id: PresetId, year: Year): YearPlan {
  return PRESETS[id].years[YEARS.indexOf(year)]!;
}

/** Where a slider value sits against the researched ranges, in words (or null when inside). */
export function sliderWarning(key: "partnerAvg" | "workplaceAvg", value: number): string | null {
  if (key === "partnerAvg" && value > 5000 && value < 15_000) return "Above the evidenced local range ($250–$5,000, P1) and below presenting-sponsor tiers ($15K+, P4). Plausible only as a multi-chapter series.";
  if (key === "partnerAvg" && value >= 15_000) return "Presenting-sponsor territory (P4 $15K–$100K, adjacent races). Strava sells its challenges from $30K.";
  if (key === "workplaceAvg" && value > 12_500) return "Above the evidenced workplace range (P8 tops out at $12,500 per season).";
  return null;
}

// ── Year stories (V2 wording preserved, V4 gates added) ─────────────────────

export interface YearStory {
  year: Year;
  label: string;
  north: string;
  slice: string;
  risk: string;
}

export const YEAR_STORY: Record<Year, YearStory> = {
  2027: {
    year: 2027,
    label: "Prove the model",
    north: "Pilot 1–3 community circles and one paid partner program, in the tenth season.",
    slice: "Member journeys + Circle RSVPs + reviewed QUANTUM FAQ + paid pilot landing page.",
    risk: "Do not introduce speculative features into a fragile production release.",
  },
  2028: {
    year: 2028,
    label: "Make it repeatable",
    north: "Turn proven community and commercial processes into reliable systems.",
    slice: "Organizer console + reusable campaign builder + approved coach content workflow.",
    risk: "Avoid manual service overload, scope creep, and unreviewed AI capabilities.",
  },
  2029: {
    year: 2029,
    label: "Scale responsibly",
    north: "Expand only into cities and programs where quality stays high.",
    slice: "Chapter operations, repeatable impact reporting, mature commercial tooling.",
    risk: "Scale quality, safety, accessibility, and support alongside acquisition.",
  },
};

// ── Decision gates ──────────────────────────────────────────────────────────

export interface Gate {
  id: string;
  title: string;
  /** null when the gate can only be measured in a real season. */
  pass: boolean | null;
  evidence: string;
  ifFails: string;
  lens: string;
}

const PROVIDER_SOURCES = new Set<ActivitySource>(["strava", "healthkit", "health_connect", "garmin"]);

/** The 2027 "Prove the model" gates, read from the running simulation. */
export function liveGates(world: World, ledger: readonly Receipt[] = []): Gate[] {
  const signed = Object.values(world.proposals).filter((p) => p.signedAt !== null && p.stage !== "lost");
  const paid = signed.filter((p) => p.paidAt !== null);
  const paidNames = paid.map((p) => world.partners[p.partnerId]?.name ?? p.partnerId);
  const awaiting = signed.length - paid.length;

  const evals = runEvals(world.coach.activeRuleset);
  const sealedCritical = evals.sealed.criticalMisses;
  const sealedCriticalTotal = evals.sealed.criticalTotal;

  const unauthorised = world.egress.filter(
    (e) => e.ruleIds.length === 0 || e.ruleIds.some((id) => !RULES[id]) || e.lineage.some((s) => PROVIDER_SOURCES.has(s)),
  );
  const refused = ledger.filter((r) => r.type === "PARTNER_DATA_REQUEST" && r.outcome === "blocked").length;

  const drift = verifyProjections(world);
  const busiest = founderView(world).chapters.reduce((max, c) => (c.eventsPerOrganizer > max.eventsPerOrganizer ? c : max));

  return [
    {
      id: "pilots",
      title: "Two pilots signed and paid",
      pass: paid.length >= 2,
      evidence: paid.length
        ? `${paid.length} of 2 paid: ${paidNames.join(", ")}.${awaiting ? ` ${awaiting} more signed, awaiting payment.` : ""}`
        : signed.length
          ? `0 of 2 paid. ${signed.length} signed, awaiting payment — a signature isn't money.`
          : "0 of 2 signed or paid. Proposals are promises, not money.",
      ifFails: "Don't hire or open chapters on promised money. Keep selling one First Mile series per chapter and re-run this gate before 2028 planning.",
      lens: "/partner",
    },
    {
      id: "coach-safety",
      title: "QUANTUM: zero critical misses on the sealed safety set",
      pass: sealedCritical.length === 0,
      evidence: `Ruleset ${world.coach.activeRuleset}: ${sealedCritical.length ? `${sealedCritical.length} of ${sealedCriticalTotal} critical sealed cases missed` : `all ${sealedCriticalTotal} critical sealed cases pass`}. Sealed ${evals.sealed.passed}/${evals.sealed.total} overall. DEV ${evals.dev.passed}/${evals.dev.total}, but DEV was seen while writing the rules, so it isn't evidence.`,
      ifFails: "Free-text coaching stays off in 2027. Members choose from guided questions, and anything beyond movement routes to people.",
      lens: "/coach",
    },
    {
      id: "disclosures",
      title: "Zero unauthorised disclosures",
      pass: unauthorised.length === 0,
      evidence: `${world.egress.length} disclosure${world.egress.length === 1 ? "" : "s"} logged, ${unauthorised.length} without an allowing rule or carrying provider data; ${refused} partner request${refused === 1 ? "" : "s"} refused.`,
      ifFails: "Stop partner reporting, treat it as a possible breach (FTC Health Breach Notification Rule) and review every export path before the next report.",
      lens: "/xray",
    },
    {
      id: "screens-agree",
      title: "Every screen agrees with the ledger",
      pass: drift.length === 0,
      evidence: drift.length ? `${drift.map((d) => `${world.chapters[d.chapterId]?.city ?? d.chapterId}: shows ${d.displayed}, ledger says ${d.fromLedger}`).join("; ")}.` : "All chapter totals match a recount from the activity table.",
      ifFails: "Freeze sponsor reports until the read models are rebuilt and the cause is found.",
      lens: "/xray",
    },
    {
      id: "organizer-load",
      title: "No chapter above 4 events per organizer",
      pass: busiest.eventsPerOrganizer < 4,
      evidence: `Busiest: ${busiest.city}, ${busiest.eventsPerOrganizer} events per organizer.`,
      ifFails: "Recruit a co-lead before adding events or sponsors in that chapter. Volunteers are the constraint, not demand.",
      lens: "/circles",
    },
  ];
}

/** 2028 and 2029 gates can only be measured in a real season; they're shown with their thresholds. */
export const LATER_GATES: Record<2028 | 2029, Gate[]> = {
  2028: [
    { id: "renewal", title: "Half of 2027 sponsors renew", pass: null, evidence: "Threshold 50% (P19 assumes 40–70%; no public evidence).", ifFails: "Don't build a campaign builder. Interview every lapsed sponsor and fix delivery first.", lens: "/partner" },
    { id: "return", title: "Members come back for a second season", pass: null, evidence: "Measured by returning-member rate; no public 100MoS figure exists.", ifFails: "Spend 2028 on onboarding and welcome, not on new cities.", lens: "/member" },
    { id: "co-leads", title: "Every active chapter has a co-lead", pass: null, evidence: "Organizer load from the 2027 season.", ifFails: "Pause new chapters until each current one has two organizers.", lens: "/circles" },
    { id: "contribution", title: "Programs earn more than they cost to deliver", pass: null, evidence: "Contribution after impact positive across all 2027 programs.", ifFails: "Reprice before renewing; drop products that lost money.", lens: "/founder" },
  ],
  2029: [
    { id: "operating", title: "Operating result at or above zero", pass: null, evidence: "Contribution after impact covers staff, platform and insurance.", ifFails: "Hold headcount; grow only chapters that fund themselves.", lens: "/future" },
    { id: "legal", title: "Data-rights questions answered by counsel", pass: null, evidence: "The open Strava, Apple (APPLE-09) and Garmin data-rights questions.", ifFails: "Keep provider data owner-only; build on first-party check-ins.", lens: "/xray" },
    { id: "impact-audit", title: "Impact fund reconciled and published", pass: null, evidence: "Every disbursement tied to evidenced events.", ifFails: "Stop new impact promises until the ledger reconciles.", lens: "/impact" },
  ],
};

// ── The Future Fork ─────────────────────────────────────────────────────────

export interface ForkPath extends Path {
  short: string;
  renewal: string;
  testFirst: string;
}

/**
 * First-timers welcomed per public event. Assumption: the demo's First Mile
 * walks expect ~16 RSVPs, 80% attend, about a third new (campaignReport uses 35%).
 */
export const FIRST_TIMERS_PER_EVENT = 4;
/** Employees per workplace season. Assumption. */
export const EMPLOYEES = 1500;
/** Share of eligible employees who join. Evidence: P9, 20–40% (RAND median 20% / 40%). */
export const WORKPLACE_PARTICIPATION = 0.25;

/** Two different kinds of reach, kept apart on purpose: workplace challenges mostly reach people who already move (GCC: 92% already met guidelines). */
export function reachOf(y: YearPlan): { newcomers: number; employees: number } {
  return {
    newcomers: Math.round(y.chapters * y.eventsPerChapterPerMonth * ACTIVE_MONTHS * FIRST_TIMERS_PER_EVENT),
    employees: Math.round(y.workplacePrograms * EMPLOYEES * WORKPLACE_PARTICIPATION),
  };
}

export const FORK: [ForkPath, ForkPath] = [
  {
    id: "circles-first",
    name: "Path A — City circles first",
    short: "City circles first",
    thesis: "Grow the volunteer chapter network fast and fund it with local, brand-supported First Mile series.",
    years: [
      // brand fee $4,000 per series: inside P1's local range (evidence); events at 4/month is an assumption.
      // By 2029 the average rises to $6,500 because a network this size can carry one presenting sponsor (P4, adjacent evidence).
      plan(2027, { chapters: 7, brandPrograms: 8, brandAvgFee: 4000, workplacePrograms: 1, workplaceAvgFee: 6000, deliveryCostPct: 40, impactPct: 15, staffFte: 0.75, platformCost: 20_000, eventsPerChapterPerMonth: 4, organizerHoursPerChapter: 24 }),
      plan(2028, { chapters: 14, brandPrograms: 22, brandAvgFee: 4500, workplacePrograms: 2, workplaceAvgFee: 6500, deliveryCostPct: 40, impactPct: 15, staffFte: 1.25, platformCost: 26_000, eventsPerChapterPerMonth: 4, organizerHoursPerChapter: 24 }),
      plan(2029, { chapters: 24, brandPrograms: 40, brandAvgFee: 6500, workplacePrograms: 3, workplaceAvgFee: 7000, deliveryCostPct: 38, impactPct: 15, staffFte: 1.75, platformCost: 32_000, eventsPerChapterPerMonth: 4, organizerHoursPerChapter: 24 }),
    ],
    dependsOn: [
      "Two volunteer organizers per chapter, recruited and kept (load runs at about 100% of their hours).",
      "Local sponsors paying ~$4,000 a series — the top of what clubs publicly receive.",
      "A permit and insurance playbook per city (Chicago ≈ $486 per routed event, P15).",
    ],
    ifGateFails: "If organizers burn out or sponsors won't pay, stop opening chapters and convert the strongest three into self-funding circles.",
    renewal: "Sponsor renewal ~50% (P19, assumption).",
    testFirst: "One Detroit First Mile series sold to one local brand at $4,000, delivered with a named sweep at every walk.",
  },
  {
    id: "workplace-first",
    name: "Path B — Workplace seasons first",
    short: "Workplace seasons first",
    thesis: "Sell the summer to employers as a team season — the corporate 'teams' idea in Kayla's 2026 Create & Cultivate profile — holding today's seven cities steady.",
    years: [
      // workplace $8,000 ≈ 1,500 × $1.33 PEPM × 4 months (P7 evidence); 3 deals in year one reflects a 2–6 month cycle (P23, assumption).
      plan(2027, { chapters: 7, brandPrograms: 3, brandAvgFee: 4000, workplacePrograms: 3, workplaceAvgFee: 8000, deliveryCostPct: 33, impactPct: 10, staffFte: 0.75, platformCost: 28_000, eventsPerChapterPerMonth: 2, organizerHoursPerChapter: 30 }),
      // renewal ~70% (P20, assumption) plus new employers; delivery is lower because a season has few public events.
      plan(2028, { chapters: 7, brandPrograms: 4, brandAvgFee: 4500, workplacePrograms: 10, workplaceAvgFee: 8500, deliveryCostPct: 32, impactPct: 10, staffFte: 1, platformCost: 32_000, eventsPerChapterPerMonth: 2, organizerHoursPerChapter: 30 }),
      plan(2029, { chapters: 8, brandPrograms: 5, brandAvgFee: 5000, workplacePrograms: 20, workplaceAvgFee: 9000, deliveryCostPct: 30, impactPct: 10, staffFte: 1.5, platformCost: 34_000, eventsPerChapterPerMonth: 2, organizerHoursPerChapter: 30 }),
    ],
    dependsOn: [
      "A part-time B2B seller from 2027 (inside the 1.5 FTE).",
      "Security questionnaires, SSO and privacy terms — priced into platform cost (§3.2 risk 5).",
      "Employers buying belonging, not ROI: no RCT shows health or cost savings (Illinois, BJ's).",
    ],
    ifGateFails: "If no employer signs by June, fold the team season into Path A as a sponsor product and stop the B2B build.",
    renewal: "Workplace renewal ~70% (P20, assumption).",
    testFirst: "One Lakeshore-style team season for ~1,500 employees at ~$8,000, measured on participation and second-season interest.",
  },
];

export interface YearBand {
  year: Year;
  /** Cumulative operating result percentiles at the end of this year. */
  p10: number;
  p50: number;
  p90: number;
  /** Share of runs in which this year on its own ends at or above zero. */
  pYearInBlack: number;
}

/** Bridge money: the deepest the cumulative result goes below zero, across runs. */
export interface BridgeBand {
  /** One season in ten needs no more than this. */
  p10: number;
  /** The median: the headline. */
  p50: number;
  /** The bad tail: one season in ten needs at least this much. */
  p90: number;
}

export interface ForkSimulation {
  bands: YearBand[];
  /** The final year's cumulative band, from the same runs as `bands`, so the chart and the headline agree. */
  band: Band;
  bridge: BridgeBand;
}

/**
 * Seeded uncertainty for a path. Every range is an assumption:
 *  - one market factor per run, shared by all three years (a bad year for sponsors tends to stay bad),
 *    times a smaller per-year wobble in how many deals land;
 *  - fees, delivery cost and fixed costs (loaded staff, platform) drift per year;
 *  - a small share of revenue is refunded for cancelled events (heat, storms).
 */
export function simulateFork(path: Path, seed = 29, runs = 1500): ForkSimulation {
  const next = rng(seed);
  const perYear: number[][] = [[], [], []];
  const inBlack = [0, 0, 0];
  const bridges: number[] = [];
  for (let run = 0; run < runs; run++) {
    const market = triangular(next(), 0.55, 0.9, 1.15);
    let cumulative = 0;
    let deepest = 0;
    path.years.forEach((y, i) => {
      const dealMult = market * triangular(next(), 0.85, 1, 1.12);
      const feeMult = triangular(next(), 0.8, 0.95, 1.1);
      const costMult = triangular(next(), 0.95, 1.05, 1.35);
      const fixedMult = triangular(next(), 0.95, 1.05, 1.3);
      const refund = triangular(next(), 0, 0.02, 0.08);
      const year = runYear({
        ...y,
        brandPrograms: y.brandPrograms * dealMult,
        workplacePrograms: y.workplacePrograms * dealMult,
        brandAvgFee: y.brandAvgFee * feeMult * (1 - refund),
        workplaceAvgFee: y.workplaceAvgFee * feeMult * (1 - refund),
        deliveryCostPct: Math.min(95, y.deliveryCostPct * costMult),
        costPerFte: y.costPerFte * fixedMult,
        platformCost: y.platformCost * fixedMult,
      }).operatingResult;
      cumulative += year;
      deepest = Math.min(deepest, cumulative);
      if (year >= 0) inBlack[i]! += 1;
      perYear[i]!.push(cumulative);
    });
    bridges.push(-deepest);
  }
  const q = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))]!;
  const bands = perYear.map((values, i) => {
    const sorted = [...values].sort((a, b) => a - b);
    return {
      year: YEARS[i]!,
      p10: Math.round(q(sorted, 0.1)),
      p50: Math.round(q(sorted, 0.5)),
      p90: Math.round(q(sorted, 0.9)),
      pYearInBlack: Math.round((inBlack[i]! / runs) * 1000) / 10,
    };
  });
  const finals = perYear[2]!;
  const bridgeSorted = [...bridges].sort((a, b) => a - b);
  const last = bands[2]!;
  return {
    bands,
    band: { p10: last.p10, p50: last.p50, p90: last.p90, pLoss: Math.round((finals.filter((v) => v < 0).length / runs) * 1000) / 10, runs },
    bridge: { p10: Math.round(q(bridgeSorted, 0.1)), p50: Math.round(q(bridgeSorted, 0.5)), p90: Math.round(q(bridgeSorted, 0.9)) },
  };
}

/** Cumulative operating result at the end of each year under uncertainty (the chart's bands). */
export function forkBands(path: Path, seed = 29, runs = 1500): YearBand[] {
  return simulateFork(path, seed, runs).bands;
}

export interface ForkSummary {
  path: ForkPath;
  years: YearResult[];
  cumulative: number[];
  cumulativeImpact: number;
  peakOrganizerLoad: number;
  reach: { newcomers: number; employees: number }[];
  /** Headline: the median bridge money needed under uncertainty — money that must come from somewhere else. */
  bridge: number;
  /** The bridge if everything goes to plan (the deterministic arithmetic). */
  planBridge: number;
  bridgeBand: BridgeBand;
  /** First year whose own operating result is at or above zero, in the plan as written. */
  firstYearInBlack: Year | null;
  newcomers3y: number;
  employees3y: number;
  /** Median bridge money divided by first-timers welcomed over three years: what each welcome costs beyond what programs earn. */
  bridgePerNewcomer: number;
  bands: YearBand[];
  band: Band;
}

export function summariseFork(path: ForkPath): ForkSummary {
  const years = path.years.map(runYear);
  const reach = path.years.map(reachOf);
  let running = 0;
  const cumulative = years.map((y) => (running += y.operatingResult));
  const sim = simulateFork(path);
  const newcomers3y = reach.reduce((s, r) => s + r.newcomers, 0);
  return {
    path,
    years,
    cumulative,
    cumulativeImpact: years.reduce((s, y) => s + y.impact, 0),
    peakOrganizerLoad: Math.max(...years.map((y) => y.organizerLoad)),
    reach,
    bridge: sim.bridge.p50,
    planBridge: Math.max(0, -Math.min(0, ...cumulative)),
    bridgeBand: sim.bridge,
    firstYearInBlack: (years.find((y) => y.operatingResult >= 0)?.year as Year | undefined) ?? null,
    newcomers3y,
    employees3y: reach.reduce((s, r) => s + r.employees, 0),
    bridgePerNewcomer: Math.round(sim.bridge.p50 / Math.max(1, newcomers3y)),
    bands: sim.bands,
    band: sim.band,
  };
}

export { ACTIVE_MONTHS };
