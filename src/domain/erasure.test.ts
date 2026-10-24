import { describe, expect, it } from "vitest";
import { tick } from "./calendar";
import type { CommandInput } from "./commands";
import { execute, headHash, initialMachine, receiptHash, replay, type LogEntry, type Machine } from "./engine";
import { leaks, shredErased } from "./erasure";
import { hashOf } from "./hash";
import type { Actor } from "./types";

const sarah: Actor = { role: "member", id: "sarah" };
const maya: Actor = { role: "member", id: "maya" };
const strava: Actor = { role: "provider", id: "strava" };
const system: Actor = { role: "system", id: "scheduler" };

const SECRET_ID = "st:9999-secret";
const SECRET_MILES = 13.37;
const CRISIS = "I keep thinking about ending my life";

const delivery = (over: Record<string, unknown> = {}): CommandInput => ({
  type: "PROVIDER_DELIVERY",
  payload: { provider: "strava", memberId: "sarah", externalId: SECRET_ID, version: 1, op: "upsert", distanceMi: SECRET_MILES, mode: "run", startedAt: tick(12, 6 * 60), durationMin: 101, ...over },
});

/** Run a log the way the store does: execute, then shred what the world let go of. */
function runAsStore(entries: LogEntry[]): { machine: Machine; log: LogEntry[] } {
  let machine = initialMachine();
  let log: LogEntry[] = [];
  for (const e of entries) {
    machine = execute(machine, e.input, e.actor, e.meta).machine;
    log = shredErased([...log, e], machine.ledger, machine.world);
  }
  return { machine, log };
}

const SCENARIO: LogEntry[] = [
  { input: delivery(), actor: strava },
  { input: delivery(), actor: strava },
  { input: delivery({ version: 2, distanceMi: 14.1 }), actor: strava },
  { input: delivery({ externalId: "st:no-distance", distanceMi: null }), actor: strava },
  { input: { type: "LOG_ACTIVITY", payload: { memberId: "sarah", clientRequestId: "copy", distanceMi: SECRET_MILES, mode: "run", startedAt: tick(12), durationMin: 101, prefilledFrom: "strava" } }, actor: sarah },
  { input: { type: "ASK_COACH", payload: { memberId: "maya", question: CRISIS } }, actor: maya },
  { input: { type: "ASK_COACH", payload: { memberId: "maya", question: "How do I train for my first 5K?" } }, actor: maya },
  { input: { type: "ASK_COACH", payload: { memberId: "maya", question: CRISIS } }, actor: { role: "founder", id: "kayla" } },
  { input: { type: "REVOKE_PROVIDER", payload: { memberId: "sarah", provider: "strava" } }, actor: sarah },
  { input: delivery({ externalId: "st:late" }), actor: strava },
  { input: { type: "ADVANCE_CLOCK", payload: { to: tick(21) } }, actor: system },
  { input: { type: "FORGET_COACH_HISTORY", payload: { memberId: "maya" } }, actor: maya },
];

describe("erasure", () => {
  it("receipts never hold Strava data or what a member told the coach", () => {
    const m = replay(SCENARIO);
    expect(leaks(JSON.stringify(m.ledger), [SECRET_ID, String(SECRET_MILES), "14.1", "st:late", CRISIS, "ending my life"])).toEqual([]);
  });

  it("after erasure, the log and the world hold none of it either", () => {
    const { machine, log } = runAsStore(SCENARIO);
    const everything = JSON.stringify({ log, ledger: machine.ledger, world: machine.world });
    expect(leaks(everything, [SECRET_ID, String(SECRET_MILES), "14.1", "st:late", "st:no-distance", CRISIS, "ending my life", "first 5K"])).toEqual([]);
  });

  it("a shredded log replays to exactly the same audit chain and world", () => {
    const original = replay(SCENARIO);
    const { log } = runAsStore(SCENARIO);
    const again = replay(log);
    expect(again.ledger.map((r) => r.hash)).toEqual(original.ledger.map((r) => r.hash));
    expect(headHash(again)).toBe(headHash(original));
    expect(hashOf(again.world)).toBe(hashOf(original.world));
  });

  it("keeps Strava data the member still has, and the coach history they didn't forget", () => {
    const { log } = runAsStore(SCENARIO.slice(0, 7));
    expect(JSON.stringify(log)).toContain(SECRET_ID);
    expect(JSON.stringify(log)).toContain("first 5K");
  });

  it("every stored receipt still verifies after erasure", () => {
    const { machine } = runAsStore(SCENARIO);
    machine.ledger.forEach((r, i) => {
      expect(r.prevHash).toBe(i === 0 ? "00000000" : machine.ledger[i - 1]!.hash);
      expect(receiptHash(r)).toBe(r.hash);
    });
  });
});
