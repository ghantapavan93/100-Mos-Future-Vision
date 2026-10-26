import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { tick } from "./calendar";
import type { CommandInput } from "./commands";
import { campaignReport, execute, headHash, impactPool, initialMachine, replay, seasonMiles, type LogEntry, type Machine } from "./engine";
import { economics, v2Gross } from "./finance";
import { NORTHLINE_DEFAULTS } from "./fixtures";
import { chapterTotalFromLedger, verifyProjections } from "./projections";
import type { Actor } from "./types";

const kayla: Actor = { role: "founder", id: "kayla" };
const kirk: Actor = { role: "engineer", id: "kirk" };
const nina: Actor = { role: "organizer", id: "nina" };
const as = (id: string): Actor => ({ role: "member", id });
const provider = (id: string): Actor => ({ role: "provider", id });

function run(m: Machine, input: CommandInput, actor: Actor) {
  return execute(m, input, actor);
}

function chain(steps: [CommandInput, Actor][], start = initialMachine()) {
  let m = start;
  const receipts = [];
  for (const [input, actor] of steps) {
    const r = run(m, input, actor);
    m = r.machine;
    receipts.push(r.receipt);
  }
  return { m, receipts };
}

const delivery = (over: Partial<Extract<CommandInput, { type: "PROVIDER_DELIVERY" }>["payload"]> = {}): CommandInput => ({
  type: "PROVIDER_DELIVERY",
  payload: { provider: "healthkit", memberId: "maya", externalId: "hk:walk-77", version: 1, op: "upsert", distanceMi: 1.6, mode: "walk", startedAt: tick(12, 7 * 60), durationMin: 30, ...over },
});

describe("V2 parity", () => {
  it("keeps the V2 persona miles, defaults and formulas", () => {
    const w = initialMachine().world;
    expect(seasonMiles(w, "maya")).toBe(12.4);
    expect(seasonMiles(w, "sarah")).toBe(68.7);
    expect(seasonMiles(w, "james")).toBe(31.2);
    expect(seasonMiles(w, "nina")).toBe(44.1);
    const e = economics({ ...NORTHLINE_DEFAULTS, staffHours: 0 });
    expect(e.delivery).toBe(2800);
    expect(e.impact).toBe(1125);
    expect(e.contribution).toBe(3575);
    expect(v2Gross(w.scenario)).toBe(108000);
  });
});

describe("activity reconciliation", () => {
  it("counts a delivery once, however many times it arrives", () => {
    const { m, receipts } = chain([
      [delivery(), provider("healthkit")],
      [delivery(), provider("healthkit")],
      [delivery(), provider("healthkit")],
    ]);
    expect(receipts.map((r) => r.outcome)).toEqual(["applied", "noop", "noop"]);
    expect(seasonMiles(m.world, "maya")).toBe(14);
  });

  it("ignores an older version that arrives after a newer one", () => {
    const { m } = chain([
      [delivery({ version: 2, distanceMi: 2.0 }), provider("healthkit")],
      [delivery({ version: 1, distanceMi: 1.6 }), provider("healthkit")],
    ]);
    expect(seasonMiles(m.world, "maya")).toBe(14.4);
  });

  it("counts the same outing once when it is re-sent with a new record id", () => {
    const { m, receipts } = chain([
      [delivery({ externalId: "hk:a" }), provider("healthkit")],
      [delivery({ externalId: "hk:b", distanceMi: 1.62 }), provider("healthkit")],
    ]);
    expect(receipts[1]!.summary).toMatch(/once/);
    expect(seasonMiles(m.world, "maya")).toBe(14);
  });

  it("prefers a first-party log of the same outing and keeps the other as superseded", () => {
    const { m } = chain([
      [delivery(), provider("healthkit")],
      [{ type: "LOG_ACTIVITY", payload: { memberId: "maya", clientRequestId: "c1", distanceMi: 1.6, mode: "walk", startedAt: tick(12, 7 * 60 + 5), durationMin: 30 } }, as("maya")],
    ]);
    const statuses = Object.values(m.world.activities).filter((a) => a.startedAt >= tick(12, 7 * 60)).map((a) => `${a.source}:${a.status}`);
    expect(statuses.sort()).toEqual(["healthkit:superseded", "manual:counted"]);
    expect(seasonMiles(m.world, "maya")).toBe(14);
  });

  it("holds for any order and multiplicity of duplicate deliveries", () => {
    const outings = [
      { externalId: "x1", version: 1, distanceMi: 1.1, startedAt: tick(12, 300) },
      { externalId: "x2", version: 1, distanceMi: 2.3, startedAt: tick(12, 400) },
      { externalId: "x2", version: 2, distanceMi: 2.5, startedAt: tick(12, 400) },
      { externalId: "x3", version: 1, distanceMi: 0.9, startedAt: tick(12, 600) },
    ];
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 3 }), { minLength: 4, maxLength: 14 }), (order) => {
        const seq = [0, 1, 2, 3, ...order];
        let m = initialMachine();
        for (const i of seq) m = run(m, delivery(outings[i]!), provider("healthkit")).machine;
        // x2 always ends at its newest version, whatever order the copies arrived in.
        return seasonMiles(m.world, "maya") === 12.4 + 1.1 + 2.5 + 0.9;
      }),
      { numRuns: 60 },
    );
  });

  it("quarantines a delivery with no distance and counts it nowhere", () => {
    const { m, receipts } = chain([[delivery({ distanceMi: null }), provider("healthkit")]]);
    expect(receipts[0]!.outcome).toBe("quarantined");
    expect(seasonMiles(m.world, "maya")).toBe(12.4);
  });

  it("retries a timed-out delivery and applies it exactly once", () => {
    const { m, receipts } = chain([
      [delivery({ timeout: true }), provider("healthkit")],
      [delivery({ timeout: true }), provider("healthkit")],
      [{ type: "RETRY_PENDING", payload: {} }, { role: "system", id: "scheduler" }],
      [{ type: "RETRY_PENDING", payload: {} }, { role: "system", id: "scheduler" }],
    ]);
    expect(receipts.map((r) => r.outcome)).toEqual(["deferred", "deferred", "applied", "noop"]);
    expect(seasonMiles(m.world, "maya")).toBe(14);
  });

  it("refuses manual logs pre-filled from a provider (no laundering)", () => {
    const { receipts } = chain([[{ type: "LOG_ACTIVITY", payload: { memberId: "sarah", clientRequestId: "c2", distanceMi: 4, mode: "run", startedAt: tick(11), durationMin: 40, prefilledFrom: "strava" } }, as("sarah")]]);
    expect(receipts[0]!.outcome).toBe("blocked");
    expect(receipts[0]!.ruleIds).toContain("X-02");
  });
});

describe("source rules", () => {
  it("never counts Strava in a season total or chapter total", () => {
    const w = initialMachine().world;
    const strava = Object.values(w.activities).filter((a) => a.source === "strava");
    expect(strava.length).toBe(3);
    expect(strava.every((a) => a.status === "owner-panel")).toBe(true);
    const detroit = chapterTotalFromLedger(w, "detroit");
    expect(detroit.excluded.find((e) => e.ruleId === "STRAVA-04")?.miles).toBe(12.3);
  });

  it("expires Strava records after 7 days", () => {
    const { m, receipts } = chain([[{ type: "ADVANCE_CLOCK", payload: { to: tick(19) } }, kayla]]);
    expect(receipts[0]!.ruleIds).toContain("STRAVA-05");
    expect(Object.values(m.world.activities).filter((a) => a.source === "strava" && a.status === "owner-panel")).toHaveLength(0);
  });

  it("disconnecting Strava purges its data and refuses late webhooks", () => {
    const { m, receipts } = chain([
      [{ type: "REVOKE_PROVIDER", payload: { memberId: "sarah", provider: "strava" } }, as("sarah")],
      [delivery({ provider: "strava", memberId: "sarah", externalId: "st:late" }), provider("strava")],
    ]);
    expect(receipts[0]!.ruleIds).toContain("STRAVA-06");
    expect(receipts[1]!.outcome).toBe("rejected");
    expect(Object.values(m.world.activities).filter((a) => a.source === "strava" && a.status !== "purged")).toHaveLength(0);
    expect(seasonMiles(m.world, "sarah")).toBe(68.7);
    // Deleted means deleted: no Strava distance, time or provider id survives anywhere.
    const tombstones = Object.values(m.world.activities).filter((a) => a.source === "strava");
    expect(tombstones.every((a) => a.distanceMi === 0 && a.startedAt === 0 && a.externalId.startsWith("strava:deleted:"))).toBe(true);
  });

  it("keeps HealthKit miles out of the chapter total until the member opts in", () => {
    const base = initialMachine();
    const before = chapterTotalFromLedger(base.world, "detroit").total;
    const { m } = chain([
      [{ type: "JOIN_CHAPTER", payload: { memberId: "maya", chapterId: "detroit" } }, as("maya")],
    ]);
    const joined = chapterTotalFromLedger(m.world, "detroit").total;
    expect(Math.round((joined - before) * 10) / 10).toBe(4.6); // manual only
    const { m: m2 } = chain([[{ type: "SET_CONSENT", payload: { memberId: "maya", purpose: "chapter", source: "healthkit", granted: true } }, as("maya")]], m);
    expect(Math.round((chapterTotalFromLedger(m2.world, "detroit").total - before) * 10) / 10).toBe(12.4);
  });

  it("refuses every individual-level partner request, even with a founder override", () => {
    for (const request of ["participant-list", "activity-history", "health-audience"] as const) {
      const { receipts } = chain([[{ type: "PARTNER_DATA_REQUEST", payload: { proposalId: "pr-northline", request, override: "Board asked for it" } }, kayla]]);
      expect(receipts[0]!.outcome).toBe("blocked");
    }
  });

  it("does not let a partner ask about someone else's program", () => {
    const { receipts } = chain([[{ type: "PARTNER_DATA_REQUEST", payload: { proposalId: "pr-lakeshore", request: "aggregate-attendance" } }, { role: "partner", id: "northline" }]]);
    expect(receipts[0]!.outcome).toBe("rejected");
  });
});

describe("community", () => {
  it("shows a member's RSVP on the organizer roster and survives cancellation", () => {
    const { m, receipts } = chain([
      [{ type: "RSVP", payload: { memberId: "maya", eventId: "det-first-mile" } }, as("maya")],
      [{ type: "RSVP", payload: { memberId: "maya", eventId: "det-first-mile" } }, as("maya")],
      [{ type: "CANCEL_EVENT", payload: { eventId: "det-first-mile", reason: "Heat advisory" } }, nina],
      [{ type: "RSVP", payload: { memberId: "sarah", eventId: "det-first-mile" } }, as("sarah")],
    ]);
    expect(receipts.map((r) => r.outcome)).toEqual(["applied", "noop", "applied", "rejected"]);
    expect(m.world.events["det-first-mile"]!.rsvps).toContain("maya");
    expect(m.world.events["det-first-mile"]!.status).toBe("cancelled");
  });

  it("won't publish an event without a sweep", () => {
    const { m, receipts } = chain([
      [{ type: "PUBLISH_EVENT", payload: { eventId: "det-roll-stroll" } }, nina],
      [{ type: "ASSIGN_SWEEP", payload: { eventId: "det-roll-stroll", memberId: "nina" } }, nina],
      [{ type: "PUBLISH_EVENT", payload: { eventId: "det-roll-stroll" } }, nina],
    ]);
    expect(receipts.map((r) => r.outcome)).toEqual(["blocked", "applied", "applied"]);
    expect(m.world.events["det-roll-stroll"]!.status).toBe("published");
  });

  it("refuses an organizer acting outside their chapter", () => {
    const { receipts } = chain([[{ type: "CANCEL_EVENT", payload: { eventId: "chi-lakefront", reason: "Rain" } }, nina]]);
    expect(receipts[0]!.outcome).toBe("rejected");
  });

  it("turns a check-in into counted first-party miles", () => {
    const { m } = chain([
      [{ type: "RSVP", payload: { memberId: "maya", eventId: "det-first-mile" } }, as("maya")],
      [{ type: "ADVANCE_CLOCK", payload: { to: tick(14, 9 * 60) } }, kayla],
      [{ type: "CHECK_IN", payload: { eventId: "det-first-mile", memberId: "maya", distanceMi: 1 } }, nina],
      [{ type: "CHECK_IN", payload: { eventId: "det-first-mile", memberId: "maya", distanceMi: 1 } }, nina],
    ]);
    expect(seasonMiles(m.world, "maya")).toBe(13.4);
    expect(m.world.members.maya!.stamps.some((s) => s.kind === "first-event")).toBe(true);
  });

  it("rejects event titles that are empty or too long, and stores special characters as plain text", () => {
    const draft = (title: string): CommandInput => ({
      type: "DRAFT_EVENT",
      payload: { chapterId: "detroit", title, day: 30, startMinute: 480, meetingArea: "Park", distanceOptions: [1], mode: "walk", access: [], capacity: 20 },
    });
    const { m, receipts } = chain([
      [draft("   "), as("maya")],
      [draft("x".repeat(56)), as("maya")],
      [draft(`<img src=x onerror="alert(1)"> & "walk"`), as("maya")],
    ]);
    expect(receipts.map((r) => r.outcome)).toEqual(["rejected", "rejected", "applied"]);
    expect(Object.values(m.world.events).some((e) => e.title.startsWith("<img"))).toBe(true);
  });
});

describe("partners and impact", () => {
  it("won't sign a losing contract without a written override", () => {
    const steps: [CommandInput, Actor][] = [
      [{ type: "SET_PROPOSAL_CHAPTERS", payload: { proposalId: "pr-northline", chapterIds: ["detroit", "charleston"] } }, kayla],
      [{ type: "SET_PROPOSAL_INPUT", payload: { proposalId: "pr-northline", key: "fee", value: 2500 } }, kayla],
      [{ type: "ADVANCE_DEAL", payload: { proposalId: "pr-northline" } }, kayla],
      [{ type: "ADVANCE_DEAL", payload: { proposalId: "pr-northline", override: "Strategic first partner in Charleston" } }, kayla],
    ];
    const { m, receipts } = chain(steps);
    expect(receipts[2]!.outcome).toBe("blocked");
    expect(receipts[3]!.outcome).toBe("applied");
    expect(m.world.proposals["pr-northline"]!.override).toMatch(/Charleston/);
  });

  it("funds a program only from paid impact money, and delivers only with evidence after funding", () => {
    const { m, receipts } = chain([
      [{ type: "ADVANCE_PROGRAM", payload: { programId: "neighborhood" } }, kayla], // → community-review
      [{ type: "ADVANCE_PROGRAM", payload: { programId: "neighborhood" } }, kayla], // → approved (21 votes)
      [{ type: "ADVANCE_PROGRAM", payload: { programId: "neighborhood" } }, kayla], // funded? nothing paid → blocked
      [{ type: "SET_PROPOSAL_CHAPTERS", payload: { proposalId: "pr-northline", chapterIds: ["detroit", "charleston"] } }, kayla],
      [{ type: "ADVANCE_DEAL", payload: { proposalId: "pr-northline" } }, kayla], // → contract (signed, not paid)
      [{ type: "ADVANCE_PROGRAM", payload: { programId: "neighborhood" } }, kayla], // still blocked: signed isn't paid
      [{ type: "RECORD_PAYMENT", payload: { proposalId: "pr-northline" } }, kayla],
      [{ type: "ADVANCE_PROGRAM", payload: { programId: "neighborhood" } }, kayla], // → funded
      [{ type: "ADVANCE_PROGRAM", payload: { programId: "neighborhood" } }, kayla], // delivered? no event since funding → blocked
    ]);
    expect(receipts.map((r) => r.outcome)).toEqual(["applied", "applied", "blocked", "applied", "applied", "blocked", "applied", "applied", "blocked"]);
    expect(impactPool(m.world)).toMatchObject({ committed: 1125, disbursed: 750, available: 375 });

    // A completed Detroit walk after funding is proof — unless a partner already paid for it.
    const withWalk = (fundedBy: string | null): Machine => {
      const next = structuredClone(m);
      const walk = next.world.events["det-first-mile"]!;
      Object.assign(walk, { status: "completed", day: 60, fundedBy });
      return next;
    };
    const advance: CommandInput = { type: "ADVANCE_PROGRAM", payload: { programId: "neighborhood" } };
    expect(execute(withWalk("pr-northline"), advance, kayla).receipt.outcome).toBe("blocked");
    expect(execute(withWalk(null), advance, kayla).receipt.outcome).toBe("applied");
  });

  it("reports counts only and suppresses small groups", () => {
    const steps: [CommandInput, Actor][] = [
      [{ type: "SET_PROPOSAL_CHAPTERS", payload: { proposalId: "pr-northline", chapterIds: ["detroit", "charleston"] } }, kayla],
      [{ type: "ADVANCE_DEAL", payload: { proposalId: "pr-northline" } }, kayla],
      [{ type: "ADVANCE_DEAL", payload: { proposalId: "pr-northline" } }, kayla],
    ];
    const { m } = chain(steps);
    const report = campaignReport(m.world, "pr-northline");
    expect(report.eventsPlanned).toBe(6);
    expect(report.attendance).toBe("fewer than 10");
  });
});

describe("coaching governance", () => {
  it("activates v2 with both approvals and refuses v3 at the gate", () => {
    const { m, receipts } = chain([
      [{ type: "PROPOSE_RULESET", payload: { version: "v2" } }, kirk],
      [{ type: "APPROVE_RULESET", payload: { as: "engineering" } }, kirk],
      [{ type: "APPROVE_RULESET", payload: { as: "content" } }, kirk],
      [{ type: "APPROVE_RULESET", payload: { as: "content" } }, kayla],
      [{ type: "PROPOSE_RULESET", payload: { version: "v3" } }, kirk],
      [{ type: "APPROVE_RULESET", payload: { as: "engineering" } }, kirk],
      [{ type: "APPROVE_RULESET", payload: { as: "content" } }, kayla],
    ]);
    expect(receipts.map((r) => r.outcome)).toEqual(["applied", "applied", "rejected", "applied", "applied", "applied", "blocked"]);
    expect(m.world.coach.activeRuleset).toBe("v2");
  });

  it("catches an unsafe draft and sends a safe answer instead", () => {
    const { m } = chain([
      [{ type: "SET_DRIFT", payload: { on: true } }, kirk],
      [{ type: "ASK_COACH", payload: { memberId: "maya", question: "I missed 12 days and I feel like I ruined everything." } }, as("maya")],
    ]);
    const a = Object.values(m.world.coach.answers)[0]!;
    expect(a.rejectedDraft?.failed).toContain("no-prescription");
    expect(a.blocks.map((b) => b.text).join(" ")).not.toMatch(/8 miles/);
    expect(a.checks.every((c) => c.pass)).toBe(true);
  });

  it("never puts Strava data in the coach's context", () => {
    const { m } = chain([
      [{ type: "SET_CONSENT", payload: { memberId: "sarah", purpose: "coach", source: "healthkit", granted: true } }, as("sarah")],
      [{ type: "ASK_COACH", payload: { memberId: "sarah", question: "How do I train for my first 5K?" } }, as("sarah")],
    ]);
    const a = Object.values(m.world.coach.answers)[0]!;
    expect(a.context.included.map((l) => l.source)).toEqual(["healthkit"]);
    expect(a.context.excluded.find((l) => l.source === "strava")?.ruleId).toBe("STRAVA-03");
  });
});

describe("read models and replay", () => {
  it("detects a corrupted chapter total and repairs it from the ledger", () => {
    const { m } = chain([[{ type: "CORRUPT_PROJECTION", payload: { chapterId: "detroit", delta: 250 } }, kirk]]);
    expect(verifyProjections(m.world)).toHaveLength(1);
    const { m: fixed } = chain([[{ type: "REBUILD_PROJECTIONS", payload: {} }, kirk]], m);
    expect(verifyProjections(fixed.world)).toHaveLength(0);
  });

  it("records refusals with the stage that refused", () => {
    const { receipts } = chain([[{ type: "RSVP", payload: { memberId: "maya", eventId: "det-first-mile" } }, as("sarah")]]);
    expect(receipts[0]!.outcome).toBe("rejected");
    expect(receipts[0]!.stages.find((s) => s.status === "fail")?.stage).toBe("authorize");
  });

  it("replays the same log to the same hash", () => {
    const log: LogEntry[] = [
      { input: { type: "JOIN_CHAPTER", payload: { memberId: "maya", chapterId: "detroit" } }, actor: as("maya") },
      { input: { type: "RSVP", payload: { memberId: "maya", eventId: "det-first-mile" } }, actor: as("maya") },
      { input: delivery(), actor: provider("healthkit") },
      { input: { type: "ASK_COACH", payload: { memberId: "maya", question: "Are there any groups near me?" } }, actor: as("maya") },
      { input: { type: "SET_PROPOSAL_INPUT", payload: { proposalId: "pr-northline", key: "fee", value: 9000 } }, actor: kayla },
    ];
    const a = replay(log);
    const b = replay(log);
    expect(headHash(a)).toBe(headHash(b));
    expect(a.ledger).toHaveLength(5);
    expect(headHash(replay(log, 3))).toBe(a.ledger[2]!.hash);
  });
});
