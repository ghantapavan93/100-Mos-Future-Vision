// Erasure for an event-sourced system. The command log is what replay folds,
// so deleting a world record is not enough: the log entry that created it
// still holds the data. Production would encrypt restricted fields per member
// and destroy the key (crypto-shredding). This is the same idea, made visible:
//
//   - once the world no longer holds a Strava record (disconnect, cache expiry,
//     deletion on Strava), its log entries lose distance, time, type and id;
//   - once a member asks the coach to forget, their questions are replaced by a
//     marker carrying only what the engine derived (intent, safety) and a digest.
//
// Receipts already hold digests (engine.ts, invariant 5), so a shredded log
// replays to the SAME audit chain. erasure.test.ts proves it.

import { digest, STRAVA_SHREDDED, type LogEntry, type Receipt } from "./engine";
import { FORGOTTEN } from "./quantum/classify";
import type { World } from "./types";

type Delivery = { provider: string; memberId: string; externalId: string; version: number; op: string; distanceMi: number | null; startedAt: number; durationMin: number; mode: string; timeout?: boolean };

function stravaKey(memberId: string, externalId: string): string {
  return `${memberId}|${externalId}`;
}

/** Returns a new log with every entry whose restricted data the world has let go of shredded. */
export function shredErased(log: LogEntry[], ledger: Receipt[], world: World): LogEntry[] {
  // The kind of record each Strava id created (counted panel record or quarantined), from its first receipt.
  const kind = new Map<string, "c" | "q">();
  log.forEach((entry, i) => {
    if (entry.input.type !== "PROVIDER_DELIVERY") return;
    const p = entry.input.payload as Delivery;
    if (p.provider !== "strava" || p.op !== "upsert" || p.externalId.startsWith(STRAVA_SHREDDED)) return;
    const outcome = ledger[i]?.outcome;
    const key = stravaKey(p.memberId, p.externalId);
    if (!kind.has(key) && (outcome === "applied" || outcome === "quarantined")) kind.set(key, outcome === "quarantined" ? "q" : "c");
  });

  const live = new Set(
    Object.values(world.activities)
      .filter((a) => a.source === "strava" && a.status !== "purged")
      .map((a) => stravaKey(a.memberId, a.externalId)),
  );
  const pending = new Set(world.pendingRetries.map((r) => r.key));
  const sessions = new Set(world.coach.sessions.map((s) => `${s.memberId}|${s.question}`));

  return log.map((entry, i) => {
    const { input } = entry;

    if (input.type === "PROVIDER_DELIVERY") {
      const p = input.payload as Delivery;
      if (p.provider !== "strava" || p.externalId.startsWith(STRAVA_SHREDDED)) return entry;
      const key = stravaKey(p.memberId, p.externalId);
      if (live.has(key) || pending.has(`strava:${p.externalId}:v${p.version}`)) return entry;
      const shreddedId = `${STRAVA_SHREDDED}${digest(p.externalId).slice(1)}:${kind.get(key) ?? "c"}`;
      return { ...entry, input: { type: "PROVIDER_DELIVERY", payload: { ...p, externalId: shreddedId, distanceMi: null, startedAt: 0, durationMin: 1, mode: "walk" } } as LogEntry["input"] };
    }

    if (input.type === "LOG_ACTIVITY") {
      const p = input.payload as { prefilledFrom?: string; distanceMi: number };
      // A refused attempt to copy Strava data into a manual log still carried Strava numbers.
      if (p.prefilledFrom === "strava" && p.distanceMi !== 1) return { ...entry, input: { type: "LOG_ACTIVITY", payload: { ...input.payload, distanceMi: 1, startedAt: 0, durationMin: 1 } } as LogEntry["input"] };
      return entry;
    }

    if (input.type === "ASK_COACH") {
      const p = input.payload as { memberId: string; question: string };
      if (FORGOTTEN.test(p.question) || sessions.has(`${p.memberId}|${p.question}`)) return entry;
      const facts = ledger[i]?.facts;
      const marker = `⟦forgotten:${facts?.intent ?? "general"}:${facts?.safety ?? "ok"}:${digest(p.question)}⟧`;
      // The AI's draft goes with the question: forgetting means its words are gone too.
      const { ai: _ai, ...rest } = p as { memberId: string; question: string; ai?: unknown };
      return { ...entry, input: { type: "ASK_COACH", payload: { ...rest, question: marker } } };
    }

    return entry;
  });
}

/** True if any restricted value still appears anywhere in the log or the ledger. Used by tests and the X-Ray. */
export function leaks(serialised: string, restricted: string[]): string[] {
  return restricted.filter((value) => value.length > 0 && serialised.includes(value));
}
