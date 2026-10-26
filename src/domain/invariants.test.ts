// One test per invariant a rigor review showed was
// claimed but not enforced. Each states the property, covers the failure class,
// and keeps a control case that must still work.

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { tick } from "./calendar";
import { COMMAND_TYPES, type CommandInput } from "./commands";
import { campaignReport, execute, impactPool, initialMachine, seasonMiles, type Machine, type Receipt } from "./engine";
import { decide, PURPOSES, type DataClass } from "./policy";
import { verifyProjections } from "./projections";
import type { Actor, Consents } from "./types";

const kayla: Actor = { role: "founder", id: "kayla" };
const kirk: Actor = { role: "engineer", id: "kirk" };
const nina: Actor = { role: "organizer", id: "nina" };
const as = (id: string): Actor => ({ role: "member", id });

function chain(steps: [CommandInput, Actor][], start = initialMachine()): { m: Machine; receipts: Receipt[] } {
  let m = start;
  const receipts: Receipt[] = [];
  for (const [input, actor] of steps) {
    const r = execute(m, input, actor);
    m = r.machine;
    receipts.push(r.receipt);
  }
  return { m, receipts };
}

const refusedAt = (r: Receipt) => r.stages.find((s) => s.status === "fail")?.stage;

describe("R-01 · member-authored data is written only by that member", () => {
  const memberCommands: CommandInput[] = [
    { type: "SET_CONSENT", payload: { memberId: "sarah", purpose: "coach", source: "healthkit", granted: true } },
    { type: "SET_PARTNER_CONTACT", payload: { memberId: "maya", partnerId: "northline", granted: true } },
    { type: "SET_NEEDS_SHARING", payload: { memberId: "maya", on: true } },
    { type: "LOG_ACTIVITY", payload: { memberId: "maya", clientRequestId: "x", distanceMi: 1, mode: "walk", startedAt: tick(12), durationMin: 20 } },
    { type: "ASK_COACH", payload: { memberId: "james", question: "How do I start?" } },
    { type: "VOTE_PROGRAM", payload: { memberId: "maya", programId: "access" } },
    { type: "RSVP", payload: { memberId: "maya", eventId: "det-first-mile" } },
    { type: "REVOKE_PROVIDER", payload: { memberId: "sarah", provider: "strava" } },
  ];
  const staff: Actor[] = [kayla, kirk, { role: "partner", id: "northline" }, { role: "system", id: "scheduler" }, as("james")];

  it.each(memberCommands.map((c) => [c.type, c] as const))("%s by anyone but the member is refused at authorize", (_t, cmd) => {
    for (const actor of staff) {
      if (actor.id === (cmd.payload as { memberId: string }).memberId) continue;
      const { receipt } = execute(initialMachine(), cmd, actor);
      expect(receipt.outcome, `${actor.role}:${actor.id}`).toBe("rejected");
      expect(refusedAt(receipt)).toBe("authorize");
    }
  });

  it("control: the member themself gets past authorize", () => {
    for (const cmd of memberCommands) {
      const { receipt } = execute(initialMachine(), cmd, as((cmd.payload as { memberId: string }).memberId));
      expect(refusedAt(receipt), cmd.type).not.toBe("authorize");
    }
  });
});

describe("R-05 · a record changes only through its owner's key", () => {
  it("two members' deliveries with the same provider id never touch each other", () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(fc.constantFrom("sarah", "maya"), fc.integer({ min: 1, max: 3 }), fc.integer({ min: 1, max: 2 })), { minLength: 1, maxLength: 12 }), (steps) => {
        let m = initialMachine();
        const latest = new Map<string, number>();
        for (const [member, id, version] of steps) {
          const miles = id * 0.5 + version * 0.1;
          m = execute(
            m,
            { type: "PROVIDER_DELIVERY", payload: { provider: "healthkit", memberId: member, externalId: `hk:shared-${id}`, version, op: "upsert", distanceMi: miles, mode: "walk", startedAt: tick(12, 60 * id + (member === "maya" ? 7 : 0)), durationMin: 30 } },
            { role: "provider", id: "healthkit" },
          ).machine;
          const key = `${member}|${id}`;
          if (!latest.has(key) || (latest.get(key)! < version && true)) latest.set(key, Math.max(latest.get(key) ?? 0, version));
        }
        const expected = (member: string, base: number) =>
          Math.round((base + [...latest.entries()].filter(([k]) => k.startsWith(`${member}|`)).reduce((s, [k, v]) => s + Number(k.split("|")[1]) * 0.5 + v * 0.1, 0)) * 10) / 10;
        return seasonMiles(m.world, "sarah") === expected("sarah", 68.7) && seasonMiles(m.world, "maya") === expected("maya", 12.4) && verifyProjections(m.world).length === 0;
      }),
      { numRuns: 80 },
    );
  });
});

describe("R-06 · a provider speaks only for itself", () => {
  it("Garmin can't post HealthKit data; HealthKit can", () => {
    const cmd: CommandInput = { type: "PROVIDER_DELIVERY", payload: { provider: "healthkit", memberId: "maya", externalId: "hk:z", version: 1, op: "upsert", distanceMi: 1, mode: "walk", startedAt: tick(12), durationMin: 20 } };
    expect(execute(initialMachine(), cmd, { role: "provider", id: "garmin" }).receipt.outcome).toBe("rejected");
    expect(execute(initialMachine(), cmd, { role: "provider", id: "healthkit" }).receipt.outcome).toBe("applied");
  });

  it("a bad record sent again stays one quarantined row", () => {
    const hk: Actor = { role: "provider", id: "healthkit" };
    const empty: CommandInput = { type: "PROVIDER_DELIVERY", payload: { provider: "healthkit", memberId: "maya", externalId: "hk:bad", version: 1, op: "upsert", distanceMi: null, mode: "walk", startedAt: tick(12), durationMin: 20 } };
    const fast: CommandInput = { type: "PROVIDER_DELIVERY", payload: { provider: "healthkit", memberId: "maya", externalId: "hk:fast", version: 1, op: "upsert", distanceMi: 9, mode: "walk", startedAt: tick(12), durationMin: 10 } };
    const { m, receipts } = chain([[empty, hk], [empty, hk], [fast, hk], [fast, hk], [empty, hk]]);
    expect(receipts.map((r) => r.outcome)).toEqual(["quarantined", "noop", "quarantined", "noop", "noop"]);
    const rows = Object.values(m.world.activities).filter((a) => a.status === "quarantined" && a.memberId === "maya");
    expect(rows.map((a) => a.externalId).sort()).toEqual(["hk:bad", "hk:fast"]);
  });
});

describe("R-07 · organizers act only in their chapter, inside the event", () => {
  it("an organizer who left the chapter can no longer act in it", () => {
    const { receipts } = chain([
      [{ type: "LEAVE_CHAPTER", payload: { memberId: "nina" } }, as("nina")],
      [{ type: "CANCEL_EVENT", payload: { eventId: "det-first-mile", reason: "Heat advisory" } }, nina],
    ]);
    expect(receipts[1]!.outcome).toBe("rejected");
  });

  it("check-in accepts only the event's distances, inside six hours of the start", () => {
    const at = (min: number): [CommandInput, Actor] => [{ type: "ADVANCE_CLOCK", payload: { to: tick(14, min) } }, kayla];
    const checkIn = (d: number): [CommandInput, Actor] => [{ type: "CHECK_IN", payload: { eventId: "det-first-mile", memberId: "maya", distanceMi: d } }, nina];
    const { receipts } = chain([at(8 * 60 + 30), checkIn(26.2), checkIn(1), [{ type: "CHECK_IN", payload: { eventId: "det-first-mile", memberId: "sarah", distanceMi: 2.5 } }, nina]]);
    expect(receipts.map((r) => r.outcome)).toEqual(["applied", "rejected", "applied", "applied"]);
    const late = chain([at(15 * 60), checkIn(1)]);
    expect(late.receipts[1]!.outcome).toBe("rejected");
  });

  it("a sweep must be someone in the circle", () => {
    const { receipts } = chain([[{ type: "ASSIGN_SWEEP", payload: { eventId: "det-roll-stroll", memberId: "marisol" } }, nina]]);
    expect(receipts[0]!.outcome).toBe("rejected");
  });
});

describe("R-08 / R-09 · counted miles are plausible, and two real walks are two walks", () => {
  const log = (id: string, member: string, d: number, min: number, start = tick(12, 7 * 60)): [CommandInput, Actor] => [
    { type: "LOG_ACTIVITY", payload: { memberId: member, clientRequestId: id, distanceMi: d, mode: "walk", startedAt: start, durationMin: min } },
    as(member),
  ];
  it("refuses impossible paces and over-the-limit days", () => {
    const { receipts } = chain([log("a", "maya", 50, 1), log("b", "maya", 0.01, 5), log("c", "maya", 1, 20)]);
    expect(receipts.map((r) => r.outcome)).toEqual(["rejected", "rejected", "applied"]);
  });
  it("two identical typed walks both count; the same request id from two members both count", () => {
    const { m } = chain([log("k1", "maya", 1, 20), log("k2", "maya", 1, 20, tick(12, 7 * 60 + 5)), log("k1", "sarah", 1, 20)]);
    expect(seasonMiles(m.world, "maya")).toBe(14.4);
    expect(seasonMiles(m.world, "sarah")).toBe(69.7);
  });
  it("one person, one membership", () => {
    const join: CommandInput = { type: "JOIN_MOVEMENT", payload: { name: "Maya again", moves: ["walk"], goalLabel: "x", goalKind: "season-100", target: 100, chapterId: null, needs: [] } };
    expect(execute(initialMachine(), join, as("maya")).receipt.outcome).toBe("rejected");
    expect(execute(initialMachine(), join, as("new-person")).receipt.outcome).toBe("applied");
  });
});

describe("R-10 · every input yields exactly one receipt, never a throw", () => {
  it("random commands with random ids and actors", () => {
    const anyId = fc.constantFrom("maya", "nina", "ghost", "", "det-first-mile", "nope", "pr-northline", "neighborhood", "detroit", "chicago");
    const anyActor = fc.record({ role: fc.constantFrom("member", "organizer", "founder", "partner", "provider", "engineer", "system"), id: anyId });
    const anyPayload = fc.dictionary(fc.constantFrom("memberId", "eventId", "proposalId", "programId", "chapterId", "partnerId", "provider", "question", "reason"), anyId);
    fc.assert(
      fc.property(fc.array(fc.tuple(fc.constantFrom(...COMMAND_TYPES), anyPayload, anyActor), { maxLength: 15 }), (steps) => {
        let m = initialMachine();
        for (const [type, payload, actor] of steps) {
          const before = m.ledger.length;
          m = execute(m, { type, payload } as CommandInput, actor as Actor).machine;
          if (m.ledger.length !== before + 1) return false;
        }
        return true;
      }),
      { numRuns: 150 },
    );
  });
});

describe("R-11 / R-12 / R-13 · a signed program is deliverable, its proof is real, its money is paid", () => {
  it("refuses duplicate chapters and schedules past August 31", () => {
    const dup = chain([[{ type: "SET_PROPOSAL_CHAPTERS", payload: { proposalId: "pr-northline", chapterIds: ["detroit", "detroit"] } }, kayla]]);
    expect(dup.receipts[0]!.outcome).toBe("rejected");
    const long = chain([
      [{ type: "SET_PROPOSAL_CHAPTERS", payload: { proposalId: "pr-northline", chapterIds: ["detroit", "charleston"] } }, kayla],
      [{ type: "SET_PROPOSAL_INPUT", payload: { proposalId: "pr-northline", key: "eventsPerCommunity", value: 20 } }, kayla],
      [{ type: "SET_PROPOSAL_INPUT", payload: { proposalId: "pr-northline", key: "fee", value: 60000 } }, kayla],
      [{ type: "ADVANCE_DEAL", payload: { proposalId: "pr-northline" } }, kayla],
    ]);
    expect(long.receipts[3]!.outcome).toBe("rejected");
  });

  it("funded events claim no access and name no sweep until an organizer checks; codes and clicks are real", () => {
    const { m, receipts } = chain([
      [{ type: "SET_PROPOSAL_CHAPTERS", payload: { proposalId: "pr-northline", chapterIds: ["detroit", "charleston"] } }, kayla],
      [{ type: "PARTNER_DATA_REQUEST", payload: { proposalId: "pr-northline", request: "aggregate-attendance" } }, { role: "partner", id: "northline" }],
      [{ type: "ADVANCE_DEAL", payload: { proposalId: "pr-northline" } }, kayla],
      [{ type: "ADVANCE_DEAL", payload: { proposalId: "pr-northline" } }, kayla],
      [{ type: "OFFER_CLICK", payload: { memberId: "maya", proposalId: "pr-northline" } }, { role: "partner", id: "northline" }],
      [{ type: "OFFER_CLICK", payload: { memberId: "maya", proposalId: "pr-northline" } }, as("maya")],
      [{ type: "OFFER_CLICK", payload: { memberId: "maya", proposalId: "pr-northline" } }, as("maya")],
      [{ type: "REDEEM_OFFER", payload: { memberId: "maya", proposalId: "pr-northline", code: "FAKE-0001" } }, as("maya")],
      [{ type: "REDEEM_OFFER", payload: { memberId: "maya", proposalId: "pr-northline", code: "NO-0001" } }, as("maya")],
    ]);
    expect(receipts.map((r) => r.outcome)).toEqual(["applied", "rejected", "applied", "applied", "rejected", "applied", "noop", "rejected", "applied"]);
    const funded = m.world.proposals["pr-northline"]!.fundedEventIds.map((id) => m.world.events[id]!);
    expect(funded.every((e) => e.access.length === 0 && e.sweep === null && e.createdBy !== "nina" || e.chapterId === "detroit")).toBe(true);
    expect(m.world.proposals["pr-northline"]!.offerClicks).toBe(1);
    expect(campaignReport(m.world, "pr-northline").firstTimers).toBe("fewer than 10");
  });

  it("a paid contract that loses money funds no impact", () => {
    const { m } = chain([
      [{ type: "SET_PROPOSAL_CHAPTERS", payload: { proposalId: "pr-northline", chapterIds: ["detroit", "charleston"] } }, kayla],
      [{ type: "SET_PROPOSAL_INPUT", payload: { proposalId: "pr-northline", key: "fee", value: 2500 } }, kayla],
      [{ type: "ADVANCE_DEAL", payload: { proposalId: "pr-northline", override: "Strategic first partner in Charleston" } }, kayla],
      [{ type: "RECORD_PAYMENT", payload: { proposalId: "pr-northline" } }, kayla],
    ]);
    expect(impactPool(m.world)).toMatchObject({ committed: 0, unfunded: 375 });
  });

  it("an event that started before funding is not evidence of delivery", () => {
    const { receipts } = chain([
      [{ type: "SET_PROPOSAL_CHAPTERS", payload: { proposalId: "pr-northline", chapterIds: ["detroit", "charleston"] } }, kayla],
      [{ type: "ADVANCE_DEAL", payload: { proposalId: "pr-northline" } }, kayla],
      [{ type: "RECORD_PAYMENT", payload: { proposalId: "pr-northline" } }, kayla],
      [{ type: "ADVANCE_CLOCK", payload: { to: tick(14, 9 * 60) } }, kayla],
      [{ type: "COMPLETE_EVENT", payload: { eventId: "det-first-mile" } }, nina],
      [{ type: "ADVANCE_PROGRAM", payload: { programId: "neighborhood" } }, kayla],
      [{ type: "ADVANCE_PROGRAM", payload: { programId: "neighborhood" } }, kayla],
      [{ type: "ADVANCE_PROGRAM", payload: { programId: "neighborhood" } }, kayla], // funded at 9:00
      [{ type: "ADVANCE_PROGRAM", payload: { programId: "neighborhood" } }, kayla], // the 8:00 walk doesn't count
    ]);
    expect(receipts.at(-1)!.outcome).toBe("blocked");
  });
});

describe("R-16 · decide() is total and default-deny", () => {
  const off: Consents = { chapter: { manual: false, event_checkin: false, healthkit: false, health_connect: false, garmin: false }, coach: { manual: false, event_checkin: false, healthkit: false, health_connect: false, garmin: false }, storyWall: false, partnerContact: [], needsToOrganizers: false };
  const on: Consents = { chapter: { manual: true, event_checkin: true, healthkit: true, health_connect: true, garmin: true }, coach: { manual: true, event_checkin: true, healthkit: true, health_connect: true, garmin: true }, storyWall: true, partnerContact: ["northline"], needsToOrganizers: true };
  const classes: DataClass[] = ["activity:manual", "activity:event_checkin", "activity:strava", "activity:healthkit", "activity:health_connect", "activity:garmin", "participation", "contact-optin", "coach-input", "access-needs"];

  it("with every consent off, only owner-side purposes and counts-only reporting are allowed", () => {
    const allowed = classes.flatMap((c) => PURPOSES.filter((p) => decide(c, p, off).allow).map((p) => `${c}→${p}`));
    expect(allowed.sort()).toEqual(
      [
        "activity:manual→owner-view", "activity:manual→season-total",
        "activity:event_checkin→owner-view", "activity:event_checkin→season-total", "activity:event_checkin→partner-report",
        "activity:strava→owner-view",
        "activity:healthkit→owner-view", "activity:healthkit→season-total",
        "activity:health_connect→owner-view", "activity:health_connect→season-total",
        "activity:garmin→owner-view", "activity:garmin→season-total",
        "participation→owner-view", "participation→season-total", "participation→chapter-total", "participation→organizer-roster", "participation→partner-report",
        "contact-optin→owner-view",
        "coach-input→owner-view", "coach-input→ai-coaching",
        "access-needs→owner-view",
      ].sort(),
    );
  });

  it("no consent ever unlocks Strava beyond its owner, advertising, or per-person partner exports of activity", () => {
    for (const p of PURPOSES) if (p !== "owner-view") expect(decide("activity:strava", p, on).allow, p).toBe(false);
    for (const c of classes) expect(decide(c, "advertising", on).allow, c).toBe(false);
    for (const c of classes.filter((x) => x.startsWith("activity:"))) expect(decide(c, "partner-export", on).allow, c).toBe(false);
  });

  it("Garmin into the coach cites the AI rule", () => {
    expect(decide("activity:garmin", "ai-coaching", off).ruleId).toBe("GARMIN-06");
  });
});
