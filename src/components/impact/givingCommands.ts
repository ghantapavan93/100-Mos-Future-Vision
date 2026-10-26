// The real commands behind the Giving app's big buttons. Each builder looks at
// the world and returns only what is still missing, and `runUntil` asks again
// after each batch, so a step that creates something (a walk) can use it next.
// The same rules apply as anywhere else: money moves only after a sponsor pays,
// a program needs members' backing, and it is done only once a real walk happens.

import { tick } from "@/domain/calendar";
import type { CommandInput } from "@/domain/commands";
import type { Receipt } from "@/domain/engine";
import { IMPACT_STAGES, type Actor, type World } from "@/domain/types";
import { actors, store } from "@/lib/store";

type Cmd = { input: CommandInput; actor: Actor };

const MAYA = actors.member("maya");
const JAMES = actors.member("james");
const NINA = actors.organizer("nina");

/** The giving program's walk. The tour looks for the same title, so both find one walk, not two. */
export function walkTitle(programId: string): string {
  return programId === "neighborhood" ? "Neighborhood Walk, the members' pick" : "Community walk, the members' pick";
}

export const stageIndex = (stage: (typeof IMPACT_STAGES)[number]) => IMPACT_STAGES.indexOf(stage);

/** The sponsor signs and pays, so its giving share is real money in the pool. */
export function sponsorPays(w: World): Cmd[] {
  const p = w.proposals["pr-northline"];
  if (!p) return [];
  const out: Cmd[] = [];
  if (p.chapterIds.length < 2) out.push({ input: { type: "SET_PROPOSAL_CHAPTERS", payload: { proposalId: p.id, chapterIds: ["detroit", "charleston"] } }, actor: actors.founder });
  if (p.signedAt === null) out.push({ input: { type: "ADVANCE_DEAL", payload: { proposalId: p.id } }, actor: actors.founder });
  if (p.paidAt === null) out.push({ input: { type: "RECORD_PAYMENT", payload: { proposalId: p.id } }, actor: actors.founder });
  if (p.stage === "proposal" || p.stage === "contract") out.push({ input: { type: "ADVANCE_DEAL", payload: { proposalId: p.id } }, actor: actors.founder });
  return out;
}

/** Kayla moves a backed program forward until it is funded (or the engine says why not). */
export function fund(w: World, programId: string): Cmd[] {
  const prog = w.programs[programId];
  if (!prog) return [];
  const steps = Math.max(0, stageIndex("funded") - stageIndex(prog.stage));
  return Array.from({ length: steps }, () => ({ input: { type: "ADVANCE_PROGRAM", payload: { programId } } as CommandInput, actor: actors.founder }));
}

/** A real walk in Detroit for a funded program: posted, someone at the back, people come and check in, then it counts. */
export function walkIt(w: World, programId: string): Cmd[] {
  const prog = w.programs[programId];
  if (!prog || prog.fundedAt === null || stageIndex(prog.stage) < stageIndex("funded")) return [];
  const title = walkTitle(programId);
  const walk = Object.values(w.events).find((e) => e.chapterId === "detroit" && e.title === title && e.fundedBy === null && e.status !== "cancelled" && tick(e.day, e.startMinute) >= prog.fundedAt!);
  const out: Cmd[] = [];
  if (!walk) {
    const day = Math.floor(w.clock / 1440) + 1;
    out.push({
      input: {
        type: "DRAFT_EVENT",
        payload: { chapterId: "detroit", title, day, startMinute: 8 * 60, meetingArea: "Belle Isle, Casino lawn", distanceOptions: [1, 2], mode: "walk", access: ["step-free", "short-option", "shade"], capacity: 40 },
      },
      actor: NINA,
    });
    return out;
  }
  if (walk.status === "draft" || walk.status === "submitted") {
    if (!walk.sweep) out.push({ input: { type: "ASSIGN_SWEEP", payload: { eventId: walk.id, memberId: "james" } }, actor: NINA });
    out.push({ input: { type: "PUBLISH_EVENT", payload: { eventId: walk.id } }, actor: NINA });
    return out;
  }
  if (walk.status === "published") {
    if (!walk.rsvps.includes("maya")) out.push({ input: { type: "RSVP", payload: { memberId: "maya", eventId: walk.id } }, actor: MAYA });
    if (!walk.rsvps.includes("james")) out.push({ input: { type: "RSVP", payload: { memberId: "james", eventId: walk.id } }, actor: JAMES });
    const start = tick(walk.day, walk.startMinute);
    if (w.clock < start + 60) out.push({ input: { type: "ADVANCE_CLOCK", payload: { to: start + 60 } }, actor: actors.system });
    out.push({ input: { type: "CHECK_IN", payload: { eventId: walk.id, memberId: "maya", distanceMi: 1 } }, actor: NINA });
    out.push({ input: { type: "CHECK_IN", payload: { eventId: walk.id, memberId: "james", distanceMi: 1 } }, actor: NINA });
    out.push({ input: { type: "COMPLETE_EVENT", payload: { eventId: walk.id } }, actor: NINA });
    return out;
  }
  if (prog.stage === "funded") out.push({ input: { type: "ADVANCE_PROGRAM", payload: { programId } }, actor: actors.founder });
  return out;
}

/**
 * Sends a builder's commands, asking again after each batch, until `done`,
 * nothing is left, or the engine refuses (then the last refusal is returned, so
 * the phone can say why in plain words).
 */
export function runUntil(build: (w: World) => Cmd[], done: (w: World) => boolean, rounds = 6): Receipt | null {
  for (let i = 0; i < rounds; i++) {
    const w = store.get().machine.world;
    if (done(w)) return null;
    const cmds = build(w);
    if (!cmds.length) return null;
    for (const { input, actor } of cmds) {
      const r = store.dispatch(input, actor, { via: "giving-phone" });
      if (r.outcome === "rejected" || r.outcome === "blocked") return r;
    }
  }
  return null;
}
