// Programs for any organization: the company-team setup (Kayla's Year 10 goal)
// run for an employer or a university, under its name. One settings object
// drives both what members see and what the organizer sees, and a planning
// price. Employers pay the one company-team price used on every screen — about
// $4,000 a team of up to 1,200 people for the season (future/proof.ts,
// TEAM_FEE). Universities publish no prices, so they use per-person
// team-challenge rates ($7–$11 a person who joins) — a planning assumption.

import { TEAM_FEE } from "@/components/future/proof";

export type OrgKind = "employer" | "university";

export interface ProgramSettings {
  kind: OrgKind;
  name: string;
  /** A 100 Miles of Summer city id. */
  city: string;
  weeks: 4 | 6 | 8;
  invited: number;
}

export const ORG_WORDS: Record<OrgKind, { label: string; people: string; sample: string; invited: number }> = {
  employer: { label: "An employer", people: "employees", sample: "Lakeshore Logistics", invited: 1200 },
  university: { label: "A university", people: "students and staff", sample: "Riverbend University", invited: 5000 },
};

export const JOIN_LOW = 0.2;
export const JOIN_HIGH = 0.4;
/** One company team takes up to this many people invited. */
export const TEAM_SIZE = 1200;
const MIN_DEAL = 1600;
const PER_STUDENT = { low: 7, high: 11 };

const hundred = (n: number) => Math.round(n / 100) * 100;

export function joiners(invited: number): { low: number; high: number } {
  return { low: Math.round(invited * JOIN_LOW), high: Math.round(invited * JOIN_HIGH) };
}

/** How many company teams an employer of this size needs. */
export function teamsFor(invited: number): number {
  return Math.max(1, Math.ceil(invited / TEAM_SIZE));
}

/** A planning price for the whole program: one figure for employers, a range for universities. */
export function programPrice(s: Pick<ProgramSettings, "kind" | "invited" | "weeks">): { low: number; high: number } {
  if (s.kind === "employer") {
    const price = teamsFor(s.invited) * TEAM_FEE;
    return { low: price, high: price };
  }
  const j = joiners(s.invited);
  return { low: Math.max(MIN_DEAL, hundred(j.low * PER_STUDENT.low)), high: Math.max(MIN_DEAL, hundred(j.high * PER_STUDENT.high)) };
}
