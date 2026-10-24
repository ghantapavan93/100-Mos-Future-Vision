// The Year 10 money picture on the Sponsors screen: what a lean team costs,
// what the other streams bring in, and how big a presenting partner has to be
// to close the gap. It reads the same model as Next 3 summers
// (future/proof.ts), so the two screens can never show different numbers.
// Every figure is a planning range, not a forecast.
// Kayla sets the real prices.

import { ALL_ROLES, PRESENTING_TOP, RELAY_OPTION, ROLES, moneyIn, teamCost, type Case as PlanCase, type RoleId, type StreamId } from "@/components/future/proof";
import { LOADED_FTE } from "@/domain/plans";

export type Case = "cautious" | "middle" | "strong";

/** Year 10 is the first summer of the plan. */
const YEAR = 2027;
const PLAN: Record<Case, PlanCase> = { cautious: "low", middle: "mid", strong: "high" };

export interface TeamLine {
  id: RoleId;
  label: string;
  /** Plain words: what it is. */
  note: string;
  cost: number;
}

/** How the Sponsors screen names each role. Partnerships work on commission in Year 10, so they add no fixed cost. */
const TEAM_WORDS: Record<RoleId, { label: string; note: string }> = {
  program: { label: "A program & community manager", note: "full-time: City Leads, the pilots, the weekly rhythm" },
  partnerships: { label: "Partnerships", note: "on commission: paid from the money it brings in" },
  engineer: { label: "Engineering for the Year 10 build", note: "about a quarter of an engineer's year" },
  fellowship: { label: "Seven City Lead stipends", note: "$1,000 each, a thank-you for about $1,700 of their time" },
};

/** A lean Year 10 team: the plan's roles with a cost this summer. */
export const TEAM: TeamLine[] = ROLES.map((r) => ({ id: r.id, ...TEAM_WORDS[r.id], cost: r.years[YEAR].cost })).filter((t) => t.cost > 0);

/** What the lean team costs: the same number Next 3 summers shows. */
export const TEAM_COST = teamCost(YEAR, ALL_ROLES);

export interface Stream {
  id: Exclude<StreamId, "presenting" | "relay">;
  label: string;
  note: string;
  amounts: Record<Case, number>;
}

const STREAM_WORDS: Record<Stream["id"], { label: string; note: string }> = {
  packages: { label: "Seven city packages", note: "a local brand per city" },
  teams: { label: "Company teams", note: "your Year 10 goal: about $4,000 a team" },
  grants: { label: "Grants through a partner charity", note: "for walks and programs only" },
  shop: { label: "The shop", note: "what's left after making the merch" },
};

const CASES: Case[] = ["cautious", "middle", "strong"];
const amountsOf = (id: StreamId) => Object.fromEntries(CASES.map((c) => [c, moneyIn(YEAR, PLAN[c])[id]])) as Record<Case, number>;

/** Money that isn't the presenting partner. The relay is an option on top (see RELAY). */
export const STREAMS: Stream[] = (Object.keys(STREAM_WORDS) as Stream["id"][]).map((id) => ({ id, ...STREAM_WORDS[id], amounts: amountsOf(id) }));

/** What a presenting partner pays in each case. */
export const PRESENTING: Record<Case, number> = amountsOf("presenting");
export const PRESENTING_MAX = 120_000;
/** "One big partner": the top of the usual range, the one number both money screens quote. */
export const BIG_PARTNER = PRESENTING_TOP;
/** Only if she chooses a Year 10 relay: one brand names it, once. */
export const RELAY = RELAY_OPTION;

/** The same words as the money chart on Next 3 summers. */
export const CASE_WORDS: Record<Case, string> = { cautious: "Low", middle: "Middle", strong: "High" };

export function streamsTotal(c: Case): number {
  return STREAMS.reduce((s, x) => s + x.amounts[c], 0);
}

export interface Picture {
  others: number;
  presenting: number;
  relay: number;
  total: number;
  /** Short of the lean team (0 once covered). */
  short: number;
  /** The presenting partner that covers the lean team, given the other streams. */
  need: number;
  covers: boolean;
}

export function picture(c: Case, presenting: number, withRelay = false): Picture {
  const others = streamsTotal(c);
  const relay = withRelay ? RELAY : 0;
  const total = others + relay + presenting;
  return {
    others,
    presenting,
    relay,
    total,
    short: Math.max(0, TEAM_COST - total),
    need: Math.max(0, TEAM_COST - others - relay),
    covers: total >= TEAM_COST,
  };
}

/** A program & community manager's loaded cost per month. */
const MANAGER_MONTH = LOADED_FTE / 12;
const STIPENDS = TEAM.find((t) => t.id === "fellowship")?.cost ?? 0;

/**
 * One way a presenting partner's fee could be spent, in hiring order: the City
 * Lead stipends first, then months of the program manager. Kayla decides; this
 * just turns a number into things a person can picture.
 */
export function paysFor(fee: number): { stipends: number; managerMonths: number; rest: number } {
  const stipends = Math.min(fee, STIPENDS);
  const months = Math.min(12, Math.floor((fee - stipends) / MANAGER_MONTH));
  const rest = Math.max(0, fee - stipends - months * MANAGER_MONTH);
  return { stipends, managerMonths: months, rest: Math.round(rest) };
}
