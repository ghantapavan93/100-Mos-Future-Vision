// The team and the money behind the next three summers, as planning numbers.
// One module, so the hiring ladder, its cost
// line and the money chart can never disagree: the team section toggles roles,
// and the money section draws the same team cost against what comes in.
//
// Wages and the employer-cost load are evidence (BLS); how many cities, which
// sponsors and how fast it grows are our planning choices, each written down
// below so anyone can argue with a line instead of a total.

import { FTE_LOAD, LOADED_FTE, type Year } from "@/domain/plans";

export const SUMMER_YEARS: readonly Year[] = [2027, 2028, 2029];

/** Cities with a City Lead each summer: the seven today, then the kit opens new ones. Planning choice. */
export const CITIES: Record<Year, number> = { 2027: 7, 2028: 10, 2029: 14 };

// ── The team ───────────────────────────────────────────────────────────────

export type RoleId = "program" | "partnerships" | "engineer" | "fellowship";

/** Evidence: fundraisers' median wage, May 2025 (BLS). */
const PARTNERSHIPS_WAGE = 72_550;
/** Evidence: software developers' median wage, May 2025 (BLS). */
const ENGINEER_WAGE = 135_980;
/** Planning choice: a season stipend per City Lead, rising once sponsors renew (a Lead gives about $1,700 of time, D13). */
const STIPEND: Record<Year, number> = { 2027: 1000, 2028: 1000, 2029: 1500 };

const loaded = (wage: number, share: number) => Math.round(wage * FTE_LOAD * share);

export interface RoleYear {
  /** "Full-time", "Quarter-time", "On commission", "7 Leads". */
  what: string;
  cost: number;
}

export interface Role {
  id: RoleId;
  title: string;
  /** What it takes off Kayla's plate, in her terms. */
  frees: string;
  years: Record<Year, RoleYear>;
}

export const ROLES: Role[] = [
  {
    id: "program",
    title: "Program & community manager",
    frees: "the weekly rhythm: Leads' questions, walk calendars, pilot follow-ups.",
    years: {
      2027: { what: "Full-time", cost: LOADED_FTE },
      2028: { what: "Full-time", cost: LOADED_FTE },
      2029: { what: "Full-time", cost: LOADED_FTE },
    },
  },
  {
    id: "partnerships",
    title: "Partnerships",
    frees: "chasing every sponsor and writing every season report.",
    years: {
      // Paid from the new sponsor money it brings in, so it never costs more than it earns.
      2027: { what: "On commission", cost: 0 },
      2028: { what: "Half-time", cost: loaded(PARTNERSHIPS_WAGE, 0.5) },
      2029: { what: "Half-time", cost: loaded(PARTNERSHIPS_WAGE, 0.5) },
    },
  },
  {
    id: "engineer",
    title: "Part-time engineer",
    frees: "app fires in the middle of the season.",
    years: {
      2027: { what: "Quarter-time", cost: loaded(ENGINEER_WAGE, 0.25) },
      2028: { what: "Quarter-time", cost: loaded(ENGINEER_WAGE, 0.25) },
      2029: { what: "Half-time", cost: loaded(ENGINEER_WAGE, 0.5) },
    },
  },
  {
    id: "fellowship",
    title: "City Lead Fellowship",
    frees: "running every new city yourself: Leads train the next Leads.",
    years: {
      2027: { what: `${CITIES[2027]} Leads`, cost: CITIES[2027] * STIPEND[2027] },
      2028: { what: `${CITIES[2028]} Leads`, cost: CITIES[2028] * STIPEND[2028] },
      2029: { what: `${CITIES[2029]} Leads`, cost: CITIES[2029] * STIPEND[2029] },
    },
  },
];

export const ALL_ROLES: ReadonlySet<RoleId> = new Set(ROLES.map((r) => r.id));

/** What the team costs in a summer, with these roles on. */
export function teamCost(year: Year, on: ReadonlySet<RoleId>): number {
  return ROLES.filter((r) => on.has(r.id)).reduce((sum, r) => sum + r.years[year].cost, 0);
}

// ── The money ──────────────────────────────────────────────────────────────

export type Case = "low" | "mid" | "high";
export const CASE_LABEL: Record<Case, string> = { low: "Low", mid: "Middle", high: "High" };

export type StreamId = "packages" | "presenting" | "teams" | "relay" | "grants" | "shop";

export interface Stream {
  id: StreamId;
  label: string;
  /** One plain line: what it is and where the range comes from. */
  line: string;
  /** Categorical slot, fixed order (validated for the night surface). */
  color: string;
}

/** Stack order = slot order, so neighbours in a bar are the validated neighbour pairs. */
export const STREAMS: Stream[] = [
  { id: "packages", label: "City packages", line: "A local brand funds one city's summer: usually $1K–$5K a season.", color: "#3987e5" },
  { id: "presenting", label: "Presenting partner", line: "One brand presents the whole season: usually $15K–$100K.", color: "#d95926" },
  { id: "teams", label: "Company teams", line: "Your Year 10 goal: coworkers walk together, about $4,000 a team for a six-week season.", color: "#199e70" },
  { id: "relay", label: "Relay sponsor", line: "Only if you choose a Year 10 relay: one brand names it, about $25K, once.", color: "#c98500" },
  { id: "grants", label: "Small grants", line: "Walkability and community grants, through a partner charity.", color: "#d55181" },
  { id: "shop", label: "Shop", line: "What's left after making the merch. Small, but it's yours.", color: "#008300" },
];

/** Package price per city, by case. Evidence range: local sponsors pay $1K–$5K a season (D21). */
const PACKAGE_PRICE: Record<Case, number> = { low: 1000, mid: 3000, high: 5000 };
/** Presenting partner per summer. Evidence range: $15K–$100K (D21); renewal and growth are planning choices. */
const PRESENTING: Record<Case, Record<Year, number>> = {
  low: { 2027: 15_000, 2028: 15_000, 2029: 20_000 },
  mid: { 2027: 30_000, 2028: 35_000, 2029: 40_000 },
  high: { 2027: 100_000, 2028: 100_000, 2029: 100_000 },
};
/**
 * One planning price for a company team, used on every screen: a six-week team
 * of up to 1,200 people. Evidence: minimum deals $1,600–$12,500 and $1.00–$1.67
 * per employee a month (D22); how many companies sign is a planning choice.
 */
export const TEAM_FEE = 4000;
const COMPANIES: Record<Case, Record<Year, number>> = {
  low: { 2027: 1, 2028: 2, 2029: 3 },
  mid: { 2027: 4, 2028: 8, 2029: 12 },
  high: { 2027: 10, 2028: 15, 2029: 20 },
};
/**
 * The Year 10 relay is a new idea, not something she has agreed to, so it never
 * props up a case: it is an add-on, "+ $25K if you choose a relay" (D21, D26).
 */
export const RELAY_OPTION = 25_000;
/** Grants through a partner charity: $2,500 microgrants up to $25K demonstration grants (D27). */
const GRANTS: Record<Case, Record<Year, number>> = {
  low: { 2027: 2500, 2028: 2500, 2029: 5000 },
  mid: { 2027: 10_000, 2028: 15_000, 2029: 20_000 },
  high: { 2027: 25_000, 2028: 35_000, 2029: 50_000 },
};
/** Shop, after costs: a small slice for most movements (D24). */
const SHOP: Record<Case, Record<Year, number>> = {
  low: { 2027: 500, 2028: 500, 2029: 1000 },
  mid: { 2027: 2000, 2028: 3000, 2029: 4000 },
  high: { 2027: 5000, 2028: 7000, 2029: 9000 },
};

/** What comes in, stream by stream, in a summer. The relay counts only if she chooses one (Year 10 only). */
export function moneyIn(year: Year, c: Case, relay = false): Record<StreamId, number> {
  return {
    packages: CITIES[year] * PACKAGE_PRICE[c],
    presenting: PRESENTING[c][year],
    teams: COMPANIES[c][year] * TEAM_FEE,
    relay: relay && year === 2027 ? RELAY_OPTION : 0,
    grants: GRANTS[c][year],
    shop: SHOP[c][year],
  };
}

export function totalIn(year: Year, c: Case, relay = false): number {
  return Object.values(moneyIn(year, c, relay)).reduce((a, b) => a + b, 0);
}

/** Companies signed in a summer, for plain sentences. */
export function companies(year: Year, c: Case): number {
  return COMPANIES[c][year];
}

/** The top of the usual presenting-partner range (D21): "one big partner". */
export const PRESENTING_TOP = 100_000;

export interface Gap {
  team: number;
  money: number;
  /** Money in minus the team: below zero is still to raise. */
  left: number;
  /** Share of the team the money covers, 0–1+. */
  covered: number;
}

export function gapFor(year: Year, c: Case, on: ReadonlySet<RoleId>, relay = false): Gap {
  const team = teamCost(year, on);
  const money = totalIn(year, c, relay);
  return { team, money, left: money - team, covered: team > 0 ? money / team : 1 };
}

/**
 * If the middle summer's presenting partner were one big partner, at the top of
 * the usual range, how much of the gap would it close? The honest headline
 * rests on this — with or without a relay.
 */
export function topPartnerCloses(year: Year, on: ReadonlySet<RoleId>, relay = false): { extra: number; left: number } {
  const g = gapFor(year, "mid", on, relay);
  const extra = PRESENTING_TOP - PRESENTING.mid[year];
  return { extra, left: g.left + extra };
}

/** Everything a middle summer brings except the presenting partner (and any relay). */
export function othersIn(year: Year, c: Case): number {
  return totalIn(year, c) - moneyIn(year, c).presenting;
}

/** "$104K" — the money, rounded to the thousand. */
export function k(n: number): string {
  return `$${Math.round(Math.abs(n) / 1000).toLocaleString("en-US")}K`;
}
