// What Kayla's week is made of, computed from the same world every screen
// reads: how the week reads at a glance, three numbers, how each City Lead is
// doing, the few decisions only she can make (and how long they take), money
// in versus promised, and what people asked the coach — by topic.

import type { CommandInput } from "@/domain/commands";
import { impactPool } from "@/domain/engine";
import { OPENING_TICK } from "@/domain/fixtures";
import { economics, usd } from "@/domain/finance";
import type { Intent } from "@/domain/quantum/types";
import { founderView } from "@/domain/selectors";
import type { Actor, Proposal, StampKind, World } from "@/domain/types";
import { actors } from "@/lib/store";

const DAY = 1440;
const WEEK = 7 * DAY;

export interface WeekNumber {
  id: "miles" | "firsts" | "walks";
  label: string;
  value: number;
  /** The same days of last week, for the arrow. Absent for a number that looks ahead or a week just begun. */
  last?: number;
  /** Said instead of an arrow when there is nothing fair to compare with. */
  note?: string;
  /** The same number, city by city. */
  byCity: { city: string; value: number }[];
}

/** Under two days in, a week has too little to compare: say "new week" instead of an arrow. */
const NEW_WEEK = 2 * DAY;

/**
 * Week to date against the same days of last week. Season weeks run Saturday to
 * Friday (day 0 is Saturday, May 1), so Thursday is compared with last Saturday
 * to Thursday, never with a whole week.
 */
function windowOf(now: number, weeksAgo: number): { from: number; to: number } {
  const start = Math.floor(now / WEEK) * WEEK;
  const from = start - weeksAgo * WEEK;
  return { from, to: from + (now - start) };
}

function inWeek(t: number, now: number, weeksAgo: number): boolean {
  const { from, to } = windowOf(now, weeksAgo);
  return t >= from && t <= to;
}

/**
 * Most circle members are background people the sample world holds only as a
 * season-to-date total (`backgroundSharedMiles`, as of the opening day). They
 * keep moving at that same daily pace, so the week reads at the movement's real
 * scale; the named sample people's walks add on top. Nothing before May 1 counts.
 */
function backgroundMiles(w: World, now: number, weeksAgo: number, city?: string): number {
  const shared = Object.values(w.chapters)
    .filter((c) => !city || c.id === city)
    .reduce((sum, c) => sum + c.backgroundSharedMiles, 0);
  const { from, to } = windowOf(now, weeksAgo);
  const minutes = Math.max(0, to - Math.max(0, from));
  return (shared / OPENING_TICK) * minutes;
}

/**
 * The week in three numbers: miles moved and first-timers (each against the
 * same days last week), and the walks on the calendar — the same walks each
 * City Lead card counts, so the three never disagree.
 */
export function weekNumbers(w: World): WeekNumber[] {
  const now = w.clock;
  const newWeek = now % WEEK < NEW_WEEK;
  const chapterOf = (memberId: string) => w.members[memberId]?.chapterId ?? w.members[memberId]?.homeChapterId ?? null;
  const cities = Object.values(w.chapters);
  const counted = Object.values(w.activities).filter((a) => a.status === "counted");
  const miles = (ago: number, city?: string) =>
    Math.round(
      counted.filter((a) => inWeek(a.startedAt, now, ago) && (!city || chapterOf(a.memberId) === city)).reduce((s, a) => s + a.distanceMi, 0) + backgroundMiles(w, now, ago, city),
    );
  const compare = (last: number) => (newWeek ? { note: "new week" } : { last });
  // A first-timer is someone whose first group walk ever fell in that week.
  const people = Object.values(w.members).filter((m) => !m.background);
  const firsts = (ago: number, city?: string) =>
    people.filter((m) => m.stamps.some((s) => s.kind === "first-event" && inWeek(s.at, now, ago)) && (!city || m.homeChapterId === city)).length;
  const calendar = founderView(w).chapters;
  const walks = (city?: string) => calendar.filter((c) => !city || c.id === city).reduce((sum, c) => sum + c.events, 0);
  const walkCities = calendar.filter((c) => c.events > 0).length;
  return [
    { id: "miles", label: "miles moved", value: miles(0), ...compare(miles(1)), byCity: cities.map((c) => ({ city: c.city, value: miles(0, c.id) })) },
    { id: "firsts", label: firsts(0) === 1 ? "first-timer" : "first-timers", value: firsts(0), ...compare(firsts(1)), byCity: cities.map((c) => ({ city: c.city, value: firsts(0, c.id) })) },
    {
      id: "walks",
      label: walks() === 1 ? "walk on the calendar" : "walks on the calendar",
      value: walks(),
      note: `in ${walkCities} cit${walkCities === 1 ? "y" : "ies"}`,
      byCity: cities.map((c) => ({ city: c.city, value: walks(c.id) })),
    },
  ];
}

/**
 * How the week reads at a glance, the way Kayla would say it: calm, people
 * first, then the miles. A full week is never an alarm — it names who could
 * use a hand, and everything else waits.
 */
export function weekSummary(w: World): { good: boolean; headline: string; line: string } {
  const [miles] = weekNumbers(w);
  const checks = cityChecks(w);
  const fine = checks.filter((c) => c.mood === "good").length;
  const helpNow = checks.some((c) => c.mood === "help");
  const last = miles!.last ?? 0;
  const pct = last > 0 ? Math.round(((miles!.value - last) / last) * 100) : null;
  // Within a few percent is the same week, said plainly rather than as "up 0%".
  const steady = pct !== null && Math.abs(pct) < 3;
  const good = (pct === null || pct >= 0 || steady) && !helpNow;
  // A week's first hours hold a handful of walks: no number reads fairly yet, so none is said.
  const trend =
    miles!.last === undefined
      ? "A new week just started."
      : pct === null
        ? `${miles!.value.toLocaleString("en-US")} miles so far.`
        : steady
          ? "Miles are steady with last week."
          : pct >= 0
            ? `Miles are up ${pct}% on last week.`
            : `Miles are down ${-pct}% on last week.`;
  // People first: who's doing fine, then (kindly) who could use a hand.
  const stretched = checks.filter((c) => c.mood !== "good").map((c) => c.city);
  const leads =
    fine === checks.length
      ? "Every City Lead is doing fine."
      : good
        ? `${fine} of ${checks.length} City Leads are doing fine — ${stretched.join(" and ")} could use a hand.`
        : `${fine * 2 >= checks.length ? "Most cities are humming." : "A few cities could use you."} ${stretched.join(" and ")} could use a hand.`;
  return { good, headline: good ? "A calm week." : "A full week.", line: `${leads} ${trend}` };
}

/** Roughly how long the decisions take: about a minute each, since each is one tap with its reason beside it. */
export function clearTime(decisionCount: number): string {
  if (decisionCount === 0) return "nothing to decide";
  const minutes = decisionCount;
  return `${decisionCount} decision${decisionCount === 1 ? "" : "s"} · about ${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export type CityMood = "good" | "hand" | "help";

export interface CityCheck {
  id: string;
  city: string;
  lead: string;
  mood: CityMood;
  /** One plain sentence on how the city is doing. */
  line: string;
  members: number;
  walks: number;
  waiting: number;
  /** A ready-to-send note to the City Lead. */
  note: string;
}

/** The same thresholds as the night-city halos: 3 walks per lead is busy, 4 is too many. */
export function cityChecks(w: World): CityCheck[] {
  return founderView(w).chapters.map((c) => {
    const perLead = c.eventsPerOrganizer;
    const mood: CityMood = perLead >= 4 ? "help" : perLead >= 3 || c.queue > 0 ? "hand" : "good";
    const line =
      mood === "help"
        ? `${c.city}'s City Lead, ${c.leadName}, is leading ${c.events} walks alone — that's a lot.`
        : perLead >= 3
          ? `${c.leadName} is running ${c.events} walks on their own in ${c.city}. A co-lead would help.`
          : c.queue > 0
            ? `${c.queue} walk${c.queue === 1 ? " is" : "s are"} waiting for ${c.leadName} to put on the calendar.`
            : `${c.city} is doing well: ${c.events} walk${c.events === 1 ? "" : "s"} coming up and ${c.members} members.`;
    const note =
      mood === "good"
        ? `Hi ${c.leadName} — ${c.city} looks great this week. Thank you for everything you're doing.`
        : `Hi ${c.leadName} — I see you're carrying ${c.events} walks in ${c.city}. Want me to find you a co-lead or move one walk? Thank you for showing up for everyone.`;
    return { id: c.id, city: c.city, lead: c.leadName, mood, line, members: c.members, walks: c.events, waiting: c.queue, note };
  });
}

export interface Decision {
  id: string;
  /** What Kayla is saying yes to. */
  ask: string;
  /** Why it's on her plate, in one line. */
  why: string;
  /** The button. */
  ok: string;
  /** The commands the OK sends, in order. */
  run: { input: CommandInput; actor: Actor }[];
  /** What to say once it worked. */
  done: string;
}

function dealCities(w: World, p: Proposal): string {
  const ids = p.chapterIds.length >= p.inputs.communities ? p.chapterIds : ["detroit", "charleston"].slice(0, p.inputs.communities);
  return ids.map((id) => w.chapters[id]?.city ?? id).join(" and ");
}

/** Only what needs Kayla this week — three at most, each one tap. */
export function decisions(w: World): Decision[] {
  const out: Decision[] = [];
  const founder = actors.founder;
  for (const p of Object.values(w.proposals)) {
    const name = w.partners[p.partnerId]?.name ?? p.partnerId;
    const e = economics(p.inputs);
    if (p.stage === "proposal" && e.contribution >= 0) {
      const run: Decision["run"] = [];
      if (p.chapterIds.length < p.inputs.communities) {
        run.push({ input: { type: "SET_PROPOSAL_CHAPTERS", payload: { proposalId: p.id, chapterIds: ["detroit", "charleston"].slice(0, p.inputs.communities) } }, actor: founder });
      }
      run.push({ input: { type: "ADVANCE_DEAL", payload: { proposalId: p.id } }, actor: founder });
      out.push({
        id: `sign-${p.id}`,
        ask: `Sign ${name.endsWith("s") ? `${name}'` : `${name}'s`} ${usd(p.inputs.fee)} deal for ${dealCities(w, p)}`,
        why: `${usd(e.impact)} of it goes to giving back, and ${usd(e.contribution)} is left for the team after costs.`,
        ok: "Sign it",
        run,
        done: `Signed. ${name} owes ${usd(p.inputs.fee)}.`,
      });
    }
    if (p.signedAt !== null && p.paidAt === null && p.stage !== "lost") {
      out.push({
        id: `pay-${p.id}`,
        ask: `${name} paid — mark the ${usd(p.inputs.fee)} as received`,
        why: "Giving-back money only counts once it has really arrived.",
        ok: "Mark paid",
        run: [{ input: { type: "RECORD_PAYMENT", payload: { proposalId: p.id } }, actor: founder }],
        done: `Received. ${usd(e.impact)} is ready for giving back.`,
      });
    }
    if (p.stage === "contract" && p.paidAt !== null) {
      out.push({
        id: `live-${p.id}`,
        ask: `Put ${name.endsWith("s") ? `${name}'` : `${name}'s`} walks on the calendar`,
        why: "The City Leads get the walks to plan and publish.",
        ok: "Go live",
        run: [{ input: { type: "ADVANCE_DEAL", payload: { proposalId: p.id } }, actor: founder }],
        done: `Live. The walks are with the City Leads.`,
      });
    }
  }

  const pool = impactPool(w);
  const prog = w.programs[w.impact.selectedProgram] ?? Object.values(w.programs)[0];
  if (prog) {
    const votes = prog.votes.length + prog.backgroundVotes;
    const advance = [{ input: { type: "ADVANCE_PROGRAM", payload: { programId: prog.id } } as CommandInput, actor: founder }];
    if (prog.stage === "proposed") {
      out.push({ id: `open-${prog.id}`, ask: `Let members vote on “${prog.name}”`, why: "Members choose where the giving goes. This opens the vote.", ok: "Open the vote", run: advance, done: "The vote is open." });
    } else if (prog.stage === "community-review" && votes >= 10) {
      out.push({ id: `approve-${prog.id}`, ask: `Members picked “${prog.name}” — approve it`, why: `${votes} members voted for it.`, ok: "Approve", run: advance, done: "Approved. It's funded as soon as the money is there." });
    } else if (prog.stage === "approved" && pool.available >= prog.cost) {
      out.push({ id: `fund-${prog.id}`, ask: `Fund “${prog.name}” with ${usd(prog.cost)}`, why: `${usd(pool.available)} of sponsor money is ready for giving back.`, ok: "Fund it", run: advance, done: "Funded. The next walks can happen." });
    }
  }

  const cand = w.coach.candidate;
  if (cand && !cand.approvals.includes("content")) {
    out.push({
      id: "coach",
      ask: "New coach answers are ready for your OK",
      why: "Nothing new reaches members until you and Kirk both say yes.",
      ok: "Approve",
      run: [{ input: { type: "APPROVE_RULESET", payload: { as: "content" } }, actor: founder }],
      done: "Approved. Waiting on Kirk.",
    });
  }
  return out.slice(0, 3);
}

const DEAL_WORDS: Record<Proposal["stage"], string> = {
  inquiry: "Talking",
  qualified: "Interested",
  proposal: "Offer ready",
  contract: "Signed",
  live: "Walks on the calendar",
  reported: "Report sent",
  renewed: "Coming back",
  lost: "Said no",
};

/** Sponsor money by how real it is: in the bank, signed and owed, or only promised. */
export function moneyIn(w: World): { inBank: number; owed: number; promised: number } {
  const all = Object.values(w.proposals).filter((p) => p.stage !== "lost");
  const sum = (ps: Proposal[]) => ps.reduce((s, p) => s + p.inputs.fee, 0);
  return {
    inBank: sum(all.filter((p) => p.paidAt !== null)),
    owed: sum(all.filter((p) => p.signedAt !== null && p.paidAt === null)),
    promised: sum(all.filter((p) => p.signedAt === null)),
  };
}

export interface SponsorLine {
  id: string;
  name: string;
  status: string;
  money: string;
  next: string;
}

export function sponsorSnapshot(w: World): SponsorLine[] {
  return Object.values(w.proposals).map((p) => {
    const name = w.partners[p.partnerId]?.name ?? p.partnerId;
    const fee = usd(p.inputs.fee);
    const money = p.paidAt !== null ? `${fee} paid` : p.signedAt !== null ? `${fee} owed` : `${fee} offered`;
    const next =
      p.stage === "proposal"
        ? "Waiting for your signature"
        : p.stage === "contract"
          ? p.paidAt === null
            ? "Waiting for their payment"
            : "Ready to go live"
          : p.stage === "live"
            ? "Report due after the first walk"
            : p.stage === "reported"
              ? "Ask about next summer"
              : p.stage === "lost"
                ? "Try again next season"
                : "Still talking";
    return { id: p.id, name, status: DEAL_WORDS[p.stage], money, next };
  });
}

/** Topics a founder can read. Safety answers are counted, never shown. */
const TOPIC: Partial<Record<Intent, string>> = {
  start: "Getting started",
  restart: "Coming back after a break",
  "first-5k": "A first 5K",
  "race-big": "Big race plans",
  community: "Finding people to walk with",
  rest: "Rest days",
  heat: "Moving in the heat",
  wellbeing: "Stress and motivation",
  nutrition: "Food and supplements",
  kayla: "Questions for Kayla",
  general: "Something else",
};

export function askedTopics(w: World): { topics: { topic: string; count: number }[]; safety: number } {
  const counts = new Map<string, number>();
  let safety = 0;
  for (const a of Object.values(w.coach.answers)) {
    const topic = TOPIC[a.intent];
    if (!topic) {
      safety += 1;
      continue;
    }
    counts.set(topic, (counts.get(topic) ?? 0) + 1);
  }
  return { topics: [...counts.entries()].map(([topic, count]) => ({ topic, count })).sort((a, b) => b.count - a.count).slice(0, 4), safety };
}

const STAMP_WORDS: Record<StampKind, string> = {
  "first-mile": "walked a first mile",
  "first-event": "came to a first group walk",
  "brought-a-friend": "brought a friend",
  "ten-miles": "passed 10 miles",
  "fifty-miles": "passed 50 miles",
  "hundred-miles": "finished 100 miles",
  "welcomed-someone": "welcomed someone new",
  "own-goal": "reached a goal of their own",
};

/** Members who said yes to sharing their summer, and their latest win. */
export function stories(w: World): { name: string; line: string }[] {
  return Object.values(w.members)
    .filter((m) => !m.background && m.consents.storyWall && m.stamps.length > 0)
    .map((m) => ({ name: m.name, line: `${m.name} ${STAMP_WORDS[m.stamps.at(-1)!.kind]} this summer.` }));
}

