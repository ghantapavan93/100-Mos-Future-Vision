// Commission rules as pure functions: the quote, the readiness check, the
// signing gate, what each promised walk became, and the money as run. The
// engine's handlers and the screen both call these, so a receipt and the page
// beside it can't disagree. Every dollar comes from `economics()`.

import { dayLabel } from "../calendar";
import { economics, type Economics } from "../finance";
import { MIN_REPORTABLE_GROUP } from "../policy";
import type { ChapterId, Member, MovementEvent, Partner, Product, Proposal, ProposalInputs, Tick, World } from "../types";
import { BUYERS, CITY_FACTS, COUNTER_SHARE, CREWS, HEAT, RATES, type Buyer, type Crew } from "./fixtures";
import type { Commission, Coverage } from "./types";

export const buyerOf = (id: string): Buyer | undefined => BUYERS.find((b) => b.id === id);
export const crewFor = (chapterId: ChapterId): Crew | undefined => CREWS.find((c) => c.chapterId === chapterId);
export const crewById = (id: string | null): Crew | undefined => CREWS.find((c) => c.id === id);

export function commissionOf(w: World, id: string): Commission | undefined {
  return w.commissions?.[id];
}

/** The commission a proposal belongs to, if it is one. Ordinary sponsor deals have none. */
export function commissionFor(w: World, proposalId: string): Commission | undefined {
  return Object.values(w.commissions ?? {}).find((c) => c.proposalId === proposalId);
}

export const activeCities = (c: Commission) => c.cities.filter((x) => x.coverage !== "descoped");

const cityName = (w: World, id: ChapterId) => w.chapters[id]?.city ?? id;

/** "Chicago", "Chicago and Detroit", "Chicago, Detroit and Los Angeles". */
export function listOf(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

// ── The quote ───────────────────────────────────────────────────────────────

const PRODUCT: Record<Partner["kind"], Product> = { workplace: "workplace-season", brand: "first-mile-series", city: "city-season" };

export function staffHoursFor(cities: number, kickoff: boolean, crews: number): number {
  return RATES.baseHours + RATES.hoursPerCity * cities + (kickoff ? RATES.kickoffHours : 0) + RATES.crewOnboardingHours * crews;
}

/** A commission's deal terms: one walk per city per week, priced from the sample rates. */
export function quoteInputs(kind: Partner["kind"], cities: number, weeks: number, kickoff: boolean, fee: number): ProposalInputs {
  return {
    product: PRODUCT[kind],
    communities: cities,
    eventsPerCommunity: weeks,
    fee,
    costPerEvent: RATES.costPerWalk,
    organizerStipendPerEvent: RATES.stipendPerWalk,
    creativeAndReporting: RATES.reportAndCreative,
    staffHours: staffHoursFor(cities, kickoff, 0),
    staffRate: RATES.staffRate,
    paymentFeePct: RATES.paymentFeePct,
    impactPct: RATES.impactPct,
  };
}

/** The smallest fee, in $500 steps, that leaves at least `share` of it after delivery, staff, card fees and giving. */
export function floorFee(i: ProposalInputs, share = 0.15): number {
  const variable = 1 - i.paymentFeePct / 100 - i.impactPct / 100 - share;
  if (variable <= 0) return Number.POSITIVE_INFINITY;
  const e = economics(i);
  let fee = Math.ceil((e.delivery + e.staffCost) / variable / 500) * 500;
  // economics() rounds; step up until the rounded result clears the bar too.
  while (economics({ ...i, fee }).contribution < share * fee) fee += 500;
  return fee;
}

/** What the buyer's side counters with: a little over half the fee, rounded down to $500. */
export function counterOffer(fee: number): number {
  return Math.max(500, Math.floor((fee * COUNTER_SHARE) / 500) * 500);
}

// ── Can we deliver it? ──────────────────────────────────────────────────────

export type CheckId = "lead" | "access" | "sweeps";

export interface Check {
  id: CheckId;
  label: string;
  ok: boolean;
  detail: string;
}

function sweepsCheck(n: number): Check {
  const detail = n >= 2 ? `${n} trained sweeps, so there's a backup.` : n === 1 ? "One trained sweep. No backup if they're out." : "No trained sweep.";
  return { id: "sweeps", label: "Sweeps", ok: n >= 2, detail };
}

/** The city's own team, against what a weekly walk needs: a lead with room, a step-free start, a backup sweep. */
export function leadChecks(w: World, chapterId: ChapterId): Check[] {
  const chapter = w.chapters[chapterId];
  const facts = CITY_FACTS[chapterId];
  const hasLead = Boolean(chapter && chapter.organizers.length > 0);
  const open = facts?.leadOpenWalksPerWeek ?? 0;
  const lead = chapter?.leadName ?? "The City Lead";
  return [
    {
      id: "lead",
      label: "Leadership",
      ok: hasLead && open >= 1,
      detail: !hasLead ? `${cityName(w, chapterId)} has no City Lead.` : open >= 1 ? `${lead} can take one more walk a week.` : `${lead} ${facts?.leadLoad ?? "has no room for more walks"}.`,
    },
    { id: "access", label: "Step-free start", ok: Boolean(facts?.stepFreeStart), detail: facts?.stepFreeStart ?? "No step-free start checked yet." },
    sweepsCheck(facts?.trainedSweeps ?? 0),
  ];
}

export function crewChecks(crew: Crew): Check[] {
  return [
    { id: "lead", label: "Leadership", ok: true, detail: `${crew.name} (sample crew) co-hosts. ${crew.leadName} leads.` },
    { id: "access", label: "Step-free start", ok: true, detail: crew.stepFreeStart },
    sweepsCheck(crew.sweeps),
  ];
}

export interface CityReadiness {
  chapterId: ChapterId;
  city: string;
  coverage: Coverage;
  checks: Check[];
  /** Decided, and every check passes (or the city was dropped). */
  ready: boolean;
  /** What can be chosen here: the city's own lead, a partner crew on file, or dropping it. */
  options: { lead: boolean; crew: Crew | null; descope: boolean };
}

export function readiness(w: World, c: Commission): CityReadiness[] {
  const active = activeCities(c).length;
  return c.cities.map((city) => {
    const own = leadChecks(w, city.chapterId);
    const crew = city.coverage === "crew" ? crewById(city.crewId) : undefined;
    const checks = crew ? crewChecks(crew) : own;
    const decided = city.coverage === "lead" || city.coverage === "crew";
    return {
      chapterId: city.chapterId,
      city: cityName(w, city.chapterId),
      coverage: city.coverage,
      checks,
      ready: city.coverage === "descoped" || (decided && checks.every((x) => x.ok)),
      options: { lead: own.every((x) => x.ok), crew: crewFor(city.chapterId) ?? null, descope: city.coverage !== "descoped" && active > 1 },
    };
  });
}

/** Why the commission can't be signed yet, or null when every city it promises can be delivered. */
export function signingGate(w: World, c: Commission, p: Proposal): string | null {
  const r = readiness(w, c);
  const undecided = r.filter((x) => x.coverage === "pending");
  if (undecided.length) return `${listOf(undecided.map((x) => x.city))} still need${undecided.length === 1 ? "s" : ""} a decision: its City Lead, a partner crew, or drop it.`;
  const gap = r.find((x) => !x.ready);
  if (gap) return `${gap.city} isn't ready: ${gap.checks.filter((x) => !x.ok).map((x) => x.detail).join(" ")}`;
  const active = activeCities(c).map((x) => x.chapterId);
  const same = active.length === p.chapterIds.length && active.every((id) => p.chapterIds.includes(id));
  if (!same) return "The deal's cities no longer match the commission's. Set them back before signing.";
  if (p.inputs.communities !== active.length) return `The price is for ${p.inputs.communities} cities, but the commission delivers ${active.length}.`;
  return null;
}

/** The deal after a coverage change: hours move with cities and crews; the fee moves only when a city is dropped. */
export function rescope(before: Commission, after: Commission, inputs: ProposalInputs): ProposalInputs {
  const cities = (c: Commission) => activeCities(c).length;
  const crews = (c: Commission) => c.cities.filter((x) => x.coverage === "crew").length;
  const dCities = cities(after) - cities(before);
  const dCrews = crews(after) - crews(before);
  const fee = dCities < 0 ? Math.round((inputs.fee * cities(after)) / cities(before) / 100) * 100 : inputs.fee;
  return {
    ...inputs,
    communities: cities(after),
    staffHours: Math.max(0, inputs.staffHours + RATES.hoursPerCity * dCities + RATES.crewOnboardingHours * dCrews),
    fee,
  };
}

// ── What each promised walk became ──────────────────────────────────────────

export type WalkStatus = "completed" | "canceled" | "pending";

export interface Walk {
  event: MovementEvent;
  status: WalkStatus;
  /** 0-based week of the program, from the walk's first scheduled day. */
  week: number;
  /** For a makeup walk, the cancelled walk it replaces. */
  makeupFor: string | null;
  /** For a cancelled walk, the makeup that replaces it. */
  rerunBy: string | null;
}

const scheduledDay = (e: MovementEvent) => e.moved?.day ?? e.day;

export function walksOf(w: World, c: Commission): Walk[] {
  const p = w.proposals[c.proposalId];
  if (!p) return [];
  const events = p.fundedEventIds.map((id) => w.events[id]).filter((e): e is MovementEvent => Boolean(e));
  if (!events.length) return [];
  const first = Math.min(...events.map(scheduledDay));
  const rerun = Object.fromEntries(Object.entries(c.makeups).map(([makeup, original]) => [original, makeup]));
  return events
    .map((e) => ({
      event: e,
      status: (e.status === "completed" ? "completed" : e.status === "cancelled" ? "canceled" : "pending") as WalkStatus,
      week: Math.floor((scheduledDay(e) - first) / 7),
      makeupFor: c.makeups[e.id] ?? null,
      rerunBy: rerun[e.id] ?? null,
    }))
    .sort((a, b) => a.event.day * 1440 + a.event.startMinute - (b.event.day * 1440 + b.event.startMinute));
}

export interface CityDelivery {
  chapterId: ChapterId;
  city: string;
  coverage: Coverage;
  /** Weekly walks the buyer asked for. */
  requested: number;
  /** Weekly walks in the signed deal. */
  promised: number;
  fulfilled: number;
  pending: number;
  unfulfilled: number;
  /** Walks that were cancelled, rerun or not. */
  canceled: number;
  /** Why anything here went unfulfilled, in words the buyer can read. */
  reasons: string[];
}

export interface Deliverables {
  requested: number;
  promised: number;
  fulfilled: number;
  pending: number;
  unfulfilled: number;
  canceled: number;
  byCity: CityDelivery[];
}

/**
 * Every walk the buyer asked for ends as exactly one of fulfilled, pending or
 * unfulfilled. A cancelled walk with a makeup takes the makeup's state; one
 * without is unfulfilled. A dropped city's walks are unfulfilled, with its reason.
 */
export function deliverablesOf(w: World, c: Commission): Deliverables {
  const p = w.proposals[c.proposalId];
  const weeks = p?.inputs.eventsPerCommunity ?? 0;
  const declined = p?.stage === "lost";
  const walks = walksOf(w, c);
  const byId = new Map(walks.map((x) => [x.event.id, x]));
  const byCity = c.cities.map((city): CityDelivery => {
    const line: CityDelivery = { chapterId: city.chapterId, city: cityName(w, city.chapterId), coverage: city.coverage, requested: weeks, promised: 0, fulfilled: 0, pending: 0, unfulfilled: 0, canceled: 0, reasons: [] };
    if (city.coverage === "descoped") {
      line.unfulfilled = weeks;
      line.reasons.push(`Not taken on: ${city.descopedBecause ?? "no lead or crew could deliver it"}.`);
      return line;
    }
    if (declined) {
      line.unfulfilled = weeks;
      line.reasons.push("The commission was declined.");
      return line;
    }
    line.promised = weeks;
    const mine = walks.filter((x) => x.event.chapterId === city.chapterId);
    line.canceled = mine.filter((x) => x.status === "canceled").length;
    const originals = mine.filter((x) => x.makeupFor === null);
    for (const slot of originals) {
      let last = slot;
      for (let guard = 0; last.status === "canceled" && last.rerunBy && guard < 10; guard++) last = byId.get(last.rerunBy) ?? last;
      if (last.status === "completed") line.fulfilled++;
      else if (last.status === "pending") line.pending++;
      else {
        line.unfulfilled++;
        line.reasons.push(`${dayLabel(slot.event.day)} walk cancelled (${slot.event.cancelReason ?? "no reason given"}), not rerun.`);
      }
    }
    // Before the program goes live there are no walks yet: everything promised is still to come.
    line.pending += Math.max(0, weeks - originals.length);
    return line;
  });
  const sum = (k: "requested" | "promised" | "fulfilled" | "pending" | "unfulfilled" | "canceled") => byCity.reduce((s, x) => s + x[k], 0);
  return { requested: sum("requested"), promised: sum("promised"), fulfilled: sum("fulfilled"), pending: sum("pending"), unfulfilled: sum("unfulfilled"), canceled: sum("canceled"), byCity };
}

// ── The money ───────────────────────────────────────────────────────────────

export type MoneyState = "quote" | "signed" | "paid" | "declined";

export interface CommissionMoney {
  /** The deal as priced. */
  planned: Economics;
  /** The same deal with the walks actually on the schedule (makeups cost a walk each). */
  asRun: Economics;
  walksOnSchedule: number;
  /** Money actually in: the fee once paid, zero before, zero if declined. */
  received: number;
  state: MoneyState;
}

export function moneyOf(w: World, c: Commission): CommissionMoney {
  const p = w.proposals[c.proposalId]!;
  const planned = economics(p.inputs);
  const scheduled = walksOf(w, c).length;
  const asRun = scheduled ? economics({ ...p.inputs, communities: 1, eventsPerCommunity: scheduled }) : planned;
  const state: MoneyState = p.stage === "lost" ? "declined" : p.paidAt !== null ? "paid" : p.signedAt !== null ? "signed" : "quote";
  return { planned, asRun, walksOnSchedule: scheduled || planned.events, received: p.paidAt !== null && p.stage !== "lost" ? p.inputs.fee : 0, state };
}

// ── Heat ────────────────────────────────────────────────────────────────────

export interface HeatAlert {
  eventId: string;
  chapterId: ChapterId;
  city: string;
  day: number;
  heatIndexF: number;
  earlyStart: number;
}

/** The sample forecast's walk: the HEAT week in the first hot city the program covers. */
export function heatAlertFor(w: World, c: Commission): HeatAlert | null {
  const chapterId = HEAT.cities.find((id) => activeCities(c).some((x) => x.chapterId === id));
  if (!chapterId) return null;
  const walks = walksOf(w, c).filter((x) => x.makeupFor === null && x.event.chapterId === chapterId);
  const target = walks[Math.min(HEAT.week, walks.length) - 1];
  if (!target) return null;
  return { eventId: target.event.id, chapterId, city: cityName(w, chapterId), day: target.event.day, heatIndexF: HEAT.heatIndexF, earlyStart: HEAT.earlyStart };
}

/** Someone decided: the walk was moved or cancelled. */
export const heatHandled = (e: MovementEvent | undefined) => Boolean(e && (e.status === "cancelled" || e.moved));

// ── Small groups ────────────────────────────────────────────────────────────

/** A count a buyer may see: a number of at least 10, or why it isn't shown. */
export type Cell = number | "fewer than 10" | "withheld";

/**
 * Small-cell suppression with a complementary cell: groups under 10 are hidden,
 * and when exactly one is hidden beside a shown total, the smallest shown cell
 * is withheld too, so the hidden one can't be worked out by subtraction.
 */
export function suppressCells(values: number[], total: number): { cells: Cell[]; total: Cell } {
  const small = (n: number) => n < MIN_REPORTABLE_GROUP;
  const cells: Cell[] = values.map((v) => (small(v) ? "fewer than 10" : v));
  const shownTotal: Cell = small(total) ? "fewer than 10" : total;
  if (typeof shownTotal === "number" && cells.filter((x) => typeof x !== "number").length === 1) {
    let k = -1;
    values.forEach((v, i) => {
      if (typeof cells[i] === "number" && (k < 0 || v < values[k]!)) k = i;
    });
    if (k >= 0) cells[k] = "withheld";
  }
  return { cells, total: shownTotal };
}

// ── Records the handlers create ─────────────────────────────────────────────

export function blankProposal(id: string, partnerId: string, inputs: ProposalInputs, chapterIds: ChapterId[]): Proposal {
  return {
    id,
    partnerId,
    inputs,
    stage: "proposal",
    signedAt: null,
    override: null,
    paidAt: null,
    chapterIds,
    fundedEventIds: [],
    offerClicks: 0,
    offerClickers: [],
    issuedCodes: [],
    redemptions: [],
    reportedAt: null,
  };
}

/** A partner crew's lead, as a member of the city's circle. Every sharing switch starts off. */
export function crewMember(crew: Crew, at: Tick): Member {
  const off = { manual: false, event_checkin: false, healthkit: false, health_connect: false, garmin: false };
  const never = <P extends "strava" | "healthkit" | "health_connect" | "garmin">(provider: P) => ({ provider, status: "never" as const, since: null, lastDeliveryAt: null });
  return {
    id: crew.leadId,
    name: crew.leadName,
    persona: "Partner crew lead",
    why: `I lead ${crew.name}.`,
    moves: ["walk"],
    goal: { kind: "events", target: 10, label: "Welcome ten newcomers" },
    racePath: "5k",
    chapterId: crew.chapterId,
    homeChapterId: crew.chapterId,
    consents: { chapter: { ...off }, coach: { ...off }, storyWall: false, partnerContact: [], needsToOrganizers: false },
    needs: [],
    connections: { strava: never("strava"), healthkit: never("healthkit"), health_connect: never("health_connect"), garmin: never("garmin") },
    invitesSent: 0,
    storyCardDrafted: false,
    rankMode: "personal",
    savedStep: null,
    stamps: [],
    joinedAt: at,
    fixture: true,
    background: true,
  };
}

/** Next summer's terms, priced on what was delivered: the cities that held walks, at least a 20% margin. */
export function renewalTerms(w: World, c: Commission): { inputs: ProposalInputs; chapterIds: ChapterId[] } | null {
  const p = w.proposals[c.proposalId];
  if (!p) return null;
  const delivered = deliverablesOf(w, c)
    .byCity.filter((x) => x.fulfilled > 0)
    .map((x) => x.chapterId);
  if (!delivered.length) return null;
  // Crews already know the routes and the rules, so onboarding isn't charged again.
  const base: ProposalInputs = { ...p.inputs, communities: delivered.length, staffHours: staffHoursFor(delivered.length, c.kickoff, 0) };
  const perCity = p.inputs.fee / Math.max(1, p.inputs.communities);
  const fee = Math.max(Math.round((perCity * delivered.length) / 500) * 500, floorFee(base, 0.2));
  return { inputs: { ...base, fee }, chapterIds: delivered };
}
