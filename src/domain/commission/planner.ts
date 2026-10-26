// Plays a commission's weeks the way the cities would. Before a walk the
// organizer names a sweep and publishes it; on the day the clock moves to the
// start, people check in by name, and the organizer marks it done. Every step
// is a real command through `execute`, so a week is a log that replays to the
// same world. Who turns up is seeded: the same program always plays out the
// same way. A heat forecast stops the week before the walk it hits, until
// someone moves or cancels that walk.

import { execute, type LogEntry, type Machine, type Receipt } from "../engine";
import type { CommandInput } from "../commands";
import { rng } from "../finance";
import { fnv1a } from "../hash";
import type { Actor, ChapterId, World } from "../types";
import { SWEEP_NAMES, WALKER_NAMES } from "./fixtures";
import { commissionOf, crewById, heatAlertFor, heatHandled, walksOf, type HeatAlert } from "./model";
import type { Commission } from "./types";

const SCHEDULER: Actor = { role: "system", id: "scheduler" };
const SWEEP_WHY = "Sweep the commission walks";
const META = { via: "commission" } as const;
/** Share of a city's walkers who come back to the next walk (sample). */
const RETURN_RATE = 0.6;

function shuffled<T>(items: T[], r: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export interface WeekRun {
  machine: Machine;
  entries: LogEntry[];
  /** Set when the week stopped for a heat forecast that needs a decision. */
  paused: HeatAlert | null;
}

/** Who runs a city's walks: the crew lead when a crew co-hosts, otherwise the City Lead. */
export function organizerFor(w: World, c: Commission, chapterId: ChapterId): Actor {
  const city = c.cities.find((x) => x.chapterId === chapterId);
  const crew = city?.coverage === "crew" ? crewById(city.crewId) : undefined;
  return { role: "organizer", id: crew?.leadId ?? w.chapters[chapterId]?.organizers[0] ?? "" };
}

/** Weeks the program spans: its schedule once live (makeups can add one), its terms before. */
export function weeksIn(w: World, c: Commission): number {
  const walks = walksOf(w, c);
  if (walks.length) return Math.max(...walks.map((x) => x.week)) + 1;
  return w.proposals[c.proposalId]?.inputs.eventsPerCommunity ?? 0;
}

/** The commission's participants in a city: people who joined to walk with this buyer. */
function walkersIn(w: World, chapterId: ChapterId, why: string): string[] {
  return Object.values(w.members)
    .filter((m) => m.chapterId === chapterId && m.why === why)
    .map((m) => m.id);
}

export function runWeek(start: Machine, commissionId: string, week: number): WeekRun {
  let machine = start;
  const entries: LogEntry[] = [];
  const send = (input: CommandInput, actor: Actor): Receipt => {
    const r = execute(machine, input, actor, META);
    machine = r.machine;
    entries.push({ input, actor, meta: META });
    return r.receipt;
  };
  /** Joins one person to a city's circle and returns their new member id. */
  const join = (actorId: string, name: string, chapterId: ChapterId, why: string): string | null => {
    const before = new Set(Object.keys(machine.world.members));
    send({ type: "JOIN_MOVEMENT", payload: { name, moves: ["walk"], goalLabel: why, goalKind: "events", target: 6, chapterId, needs: [] } }, { role: "member", id: actorId });
    return Object.keys(machine.world.members).find((id) => !before.has(id)) ?? null;
  };
  const world = () => machine.world;
  const c0 = commissionOf(world(), commissionId);
  if (!c0) return { machine, entries, paused: null };
  const why = `Walking with ${world().partners[c0.buyerId]?.name ?? "my team"}`.slice(0, 90);
  const due = () =>
    walksOf(world(), commissionOf(world(), commissionId)!)
      .filter((x) => x.week === week && x.status === "pending")
      .map((x) => x.event.id);

  // Preparation: every walk this week gets a named sweep and goes live for members.
  for (const id of due()) {
    const e = world().events[id]!;
    const c = commissionOf(world(), commissionId)!;
    const organizer = organizerFor(world(), c, e.chapterId);
    if (!e.sweep) {
      const name = SWEEP_NAMES[e.chapterId] ?? "Sam";
      const existing = Object.values(world().members).find((m) => m.chapterId === e.chapterId && m.why === SWEEP_WHY);
      const sweep = existing?.id ?? join(`sweep-${e.chapterId}`, name, e.chapterId, SWEEP_WHY);
      if (sweep) send({ type: "ASSIGN_SWEEP", payload: { eventId: id, memberId: sweep } }, organizer);
    }
    if (world().events[id]!.status === "submitted") send({ type: "PUBLISH_EVENT", payload: { eventId: id } }, organizer);
  }

  // The days: walk by walk, in time order.
  for (const id of due()) {
    const c = commissionOf(world(), commissionId)!;
    const alert = heatAlertFor(world(), c);
    const e = world().events[id]!;
    if (alert?.eventId === id && !heatHandled(e)) {
      // The forecast lands the evening before: stop there and let someone decide.
      const eve = (e.day - 1) * 1440 + 18 * 60;
      if (world().clock < eve) send({ type: "ADVANCE_CLOCK", payload: { to: eve } }, SCHEDULER);
      return { machine, entries, paused: alert };
    }
    if (e.status !== "published") continue;
    const begin = e.day * 1440 + e.startMinute;
    if (world().clock < begin + 45) send({ type: "ADVANCE_CLOCK", payload: { to: begin + 45 } }, SCHEDULER);
    const organizer = organizerFor(world(), c, e.chapterId);
    const r = rng(parseInt(fnv1a(`${commissionId}:${id}`), 16));
    // About three in five come back each week, give or take one; which ones is a seeded shuffle.
    const walkers = walkersIn(world(), e.chapterId, why);
    const known = walkers.length;
    const back = Math.min(known, Math.max(0, Math.round(known * RETURN_RATE + (r() - 0.5) * 2)));
    const regulars = shuffled(walkers, r).slice(0, back);
    const newcomers = week === 0 ? 6 + Math.floor(r() * 3) : 1 + Math.floor(r() * 3);
    const cityIndex = Object.keys(world().chapters).indexOf(e.chapterId);
    const fresh: string[] = [];
    for (let n = 0; n < newcomers; n++) {
      const name = WALKER_NAMES[(cityIndex * 17 + known + n) % WALKER_NAMES.length]!;
      const id2 = join(`walker-${e.chapterId}-${known + n}`, name, e.chapterId, why);
      if (id2) fresh.push(id2);
    }
    for (const memberId of [...regulars, ...fresh]) {
      const distanceMi = e.distanceOptions[r() < 0.55 ? 0 : e.distanceOptions.length - 1]!;
      send({ type: "CHECK_IN", payload: { eventId: id, memberId, distanceMi } }, organizer);
    }
    send({ type: "COMPLETE_EVENT", payload: { eventId: id } }, organizer);
  }
  return { machine, entries, paused: null };
}

/** Every remaining week, stopping early for a heat decision. For tests and "run the rest". */
export function runToEnd(start: Machine, commissionId: string): WeekRun {
  let machine = start;
  const entries: LogEntry[] = [];
  const c = commissionOf(machine.world, commissionId);
  if (!c) return { machine, entries, paused: null };
  for (let week = 0; week < weeksIn(machine.world, commissionOf(machine.world, commissionId)!); week++) {
    const run = runWeek(machine, commissionId, week);
    machine = run.machine;
    entries.push(...run.entries);
    if (run.paused) return { machine, entries, paused: run.paused };
  }
  return { machine, entries, paused: null };
}
