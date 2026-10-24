// The fault lab. Each fault is a short stream of ordinary commands with
// `meta.fault` set — a duplicate webhook, a late delivery, a sponsor asking for
// too much. Faults change the INPUT the engine sees; they never reach inside
// the engine. Every fault states a promise in plain words and a `check` that
// decides, from the worlds before and after, whether the promise held.
//
// `build` takes a nonce (the ledger length when injected) so injecting the same
// fault twice creates fresh records instead of silently replaying old ids.

import { tick } from "./calendar";
import type { CommandInput } from "./commands";
import { campaignReport, execute, offerCodes, seasonMiles, type LogEntry, type Machine, type Receipt } from "./engine";
import { leaks, shredErased } from "./erasure";
import { hashOf } from "./hash";
import { economics } from "./finance";
import { verifyProjections } from "./projections";
import { DEAL_STAGES, type Activity, type Actor, type Provider, type World } from "./types";

export type FaultGroup = "ingest" | "data-rights" | "coach" | "commercial" | "community" | "read-model";

export const GROUP_LABEL: Record<FaultGroup, string> = {
  ingest: "Activity import",
  "data-rights": "Data rights",
  coach: "QUANTUM",
  commercial: "Commercial",
  community: "Community",
  "read-model": "Read models",
};

export interface FaultCheck {
  kept: boolean;
  evidence: string;
}

export interface Fault {
  id: string;
  title: string;
  group: FaultGroup;
  plainEnglish: string;
  promise: string;
  /** What injecting this does to the live session beyond the fault itself. */
  sideEffect?: string;
  build(world: World, nonce: number): LogEntry[];
  check(before: World, after: World, receipts: Receipt[]): FaultCheck;
  /**
   * Promises that need the commands themselves, not just the worlds — e.g. "a shredded
   * log replays to the same chain". Runs the entries again from `before` in a sandbox.
   */
  prove?(before: World, entries: LogEntry[]): FaultCheck;
}

/** Run entries from a world in a sandbox machine (its own ledger), leaving the live session alone. */
export function sandbox(before: World, entries: LogEntry[]): Machine {
  return entries.reduce<Machine>((m, e) => execute(m, e.input, e.actor, e.meta).machine, { world: before, ledger: [] });
}

/** A fault's verdict: its world check, and its sandbox proof when it has one. */
export function verdict(fault: Fault, before: World, after: World, receipts: Receipt[], entries: LogEntry[]): FaultCheck {
  const checked = fault.check(before, after, receipts);
  const proved = fault.prove?.(before, entries);
  if (!proved) return checked;
  return { kept: checked.kept && proved.kept, evidence: `${checked.evidence} ${proved.evidence}` };
}

// ── helpers ────────────────────────────────────────────────────────────────

const member = (id: string): Actor => ({ role: "member", id });
const providerActor = (id: string): Actor => ({ role: "provider", id });
const engineer: Actor = { role: "engineer", id: "kirk" };
const founder: Actor = { role: "founder", id: "kayla" };
const system: Actor = { role: "system", id: "scheduler" };
const nina: Actor = { role: "organizer", id: "nina" };

function entry(fault: string, input: CommandInput, actor: Actor): LogEntry {
  return { input, actor, meta: { fault } };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const close = (a: number, b: number) => Math.abs(a - b) < 0.05;

/** A start time and distance unique to this fault and injection, so faults don't collide with each other. */
function slot(world: World, salt: number, nonce: number): { startedAt: number; distanceMi: number } {
  return {
    startedAt: Math.max(0, world.clock - 20 - ((salt * 97 + nonce * 41) % 1380)),
    distanceMi: round1(1.1 + ((salt * 7 + nonce * 3) % 23) * 0.13),
  };
}

function ensureConnected(world: World, memberId: string, provider: Provider, fault: string): LogEntry[] {
  return world.members[memberId]?.connections[provider].status === "connected"
    ? []
    : [entry(fault, { type: "CONNECT_PROVIDER", payload: { memberId, provider } }, member(memberId))];
}

/** About a 20-minute mile: plausible for a walk, so faults test reconciliation, not the pace check. */
function plausibleMinutes(distanceMi: number | null): number {
  return distanceMi ? Math.max(10, Math.round(distanceMi * 20)) : 30;
}

function delivery(fault: string, provider: Provider, memberId: string, externalId: string, version: number, distanceMi: number | null, startedAt: number, extra: { timeout?: boolean } = {}): LogEntry {
  return entry(
    fault,
    {
      type: "PROVIDER_DELIVERY",
      payload: { provider, memberId, externalId, version, op: "upsert", distanceMi, mode: provider === "health_connect" ? "roll" : "walk", startedAt, durationMin: plausibleMinutes(distanceMi), ...extra },
    },
    providerActor(provider),
  );
}

interface DeliveryPayload {
  provider: Provider;
  memberId: string;
  externalId: string;
  version: number;
  distanceMi: number | null;
}

function deliveries(receipts: Receipt[]): DeliveryPayload[] {
  return receipts.filter((r) => r.type === "PROVIDER_DELIVERY").map((r) => r.payload as DeliveryPayload);
}

function records(world: World, source: string, externalIds: string[]): Activity[] {
  return Object.values(world.activities).filter((a) => a.source === source && externalIds.includes(a.externalId));
}

function delta(before: World, after: World, memberId: string): number {
  return round1(seasonMiles(after, memberId) - seasonMiles(before, memberId));
}

function hadRemoval(world: World, id: string): boolean {
  return Boolean(world.activities[id]?.removal);
}

function outcomes(receipts: Receipt[]): string {
  return receipts.map((r) => r.outcome).join(" → ");
}

// ── the catalogue ──────────────────────────────────────────────────────────

const CORE_FAULTS: Fault[] = [
  {
    id: "duplicate-delivery",
    title: "Same webhook, three times",
    group: "ingest",
    plainEnglish: "Apple Health delivers Maya's walk, then retries and delivers it twice more.",
    promise: "The walk counts once.",
    build(world, nonce) {
      const f = "duplicate-delivery";
      const { startedAt, distanceMi } = slot(world, 1, nonce);
      const copy = delivery(f, "healthkit", "maya", `hk:dup-${nonce}`, 1, distanceMi, startedAt);
      return [...ensureConnected(world, "maya", "healthkit", f), copy, copy, copy];
    },
    check(before, after, receipts) {
      const d = deliveries(receipts);
      const ext = d[0]?.externalId ?? "";
      const counted = records(after, "healthkit", [ext]).filter((a) => a.status === "counted").length;
      const change = delta(before, after, "maya");
      const kept = counted === 1 && close(change, d[0]?.distanceMi ?? -1);
      return { kept, evidence: `${d.length} deliveries (${outcomes(receipts.filter((r) => r.type === "PROVIDER_DELIVERY"))}); ${counted} counted record; Maya +${change} mi.` };
    },
  },
  {
    id: "out-of-order",
    title: "Newer copy arrives first",
    group: "ingest",
    plainEnglish: "Apple Health sends version 2 of a walk (corrected distance), then the stale version 1 shows up late.",
    promise: "The newest version wins, whatever order the copies arrive in.",
    build(world, nonce) {
      const f = "out-of-order";
      const { startedAt, distanceMi } = slot(world, 2, nonce);
      const ext = `hk:ooo-${nonce}`;
      return [
        ...ensureConnected(world, "maya", "healthkit", f),
        delivery(f, "healthkit", "maya", ext, 2, round1(distanceMi + 0.4), startedAt),
        delivery(f, "healthkit", "maya", ext, 1, distanceMi, startedAt),
      ];
    },
    check(before, after, receipts) {
      const d = deliveries(receipts);
      const v2 = d.find((x) => x.version === 2);
      const rec = records(after, "healthkit", [v2?.externalId ?? ""])[0];
      const change = delta(before, after, "maya");
      const kept = Boolean(rec && rec.version === 2 && close(rec.distanceMi, v2?.distanceMi ?? -1) && close(change, v2?.distanceMi ?? -1));
      return { kept, evidence: `Stored v${rec?.version ?? "—"} at ${rec?.distanceMi ?? "—"} mi; the late v1 was ${receipts.at(-1)?.outcome ?? "—"}. Maya +${change} mi.` };
    },
  },
  {
    id: "new-id-resend",
    title: "Same outing, new record id",
    group: "ingest",
    plainEnglish: "Health Connect re-writes James's roll with a fresh record id — the case that double-counts when dedupe looks at ids alone.",
    promise: "The outing counts once; the copy is kept but superseded.",
    build(world, nonce) {
      const f = "new-id-resend";
      const { startedAt, distanceMi } = slot(world, 3, nonce);
      return [
        ...ensureConnected(world, "james", "health_connect", f),
        delivery(f, "health_connect", "james", `hc:${nonce}-a`, 1, distanceMi, startedAt),
        delivery(f, "health_connect", "james", `hc:${nonce}-b`, 1, distanceMi, startedAt + 2),
      ];
    },
    check(before, after, receipts) {
      const d = deliveries(receipts);
      const recs = records(after, "health_connect", d.map((x) => x.externalId));
      const counted = recs.filter((a) => a.status === "counted").length;
      const superseded = recs.filter((a) => a.status === "superseded").length;
      const change = delta(before, after, "james");
      const kept = counted === 1 && superseded === 1 && close(change, d[0]?.distanceMi ?? -1);
      return { kept, evidence: `${counted} counted, ${superseded} superseded by time-and-distance fingerprint. James +${change} mi.` };
    },
  },
  {
    id: "timeout-retry",
    title: "Provider times out, then retries",
    group: "ingest",
    plainEnglish: "Garmin's delivery of Nina's jog times out. The scheduler retries it — then retries again by mistake.",
    promise: "The jog applies exactly once; the second retry changes nothing.",
    build(world, nonce) {
      const f = "timeout-retry";
      const { startedAt, distanceMi } = slot(world, 4, nonce);
      return [
        ...ensureConnected(world, "nina", "garmin", f),
        delivery(f, "garmin", "nina", `gm:to-${nonce}`, 1, distanceMi, startedAt, { timeout: true }),
        entry(f, { type: "RETRY_PENDING", payload: {} }, system),
        entry(f, { type: "RETRY_PENDING", payload: {} }, system),
      ];
    },
    check(before, after, receipts) {
      const d = deliveries(receipts)[0];
      const counted = records(after, "garmin", [d?.externalId ?? ""]).filter((a) => a.status === "counted").length;
      const change = delta(before, after, "nina");
      const stillPending = after.pendingRetries.some((p) => p.key.includes(d?.externalId ?? "∅"));
      const kept = counted === 1 && close(change, d?.distanceMi ?? -1) && !stillPending;
      return { kept, evidence: `${outcomes(receipts.filter((r) => r.type !== "CONNECT_PROVIDER"))}; ${counted} counted record; Nina +${change} mi; queue ${stillPending ? "still holds it" : "empty"}.` };
    },
  },
  {
    id: "missing-distance",
    title: "A record with no distance",
    group: "ingest",
    plainEnglish: "Garmin sends a workout for Nina with the distance field missing.",
    promise: "It is quarantined and counted nowhere.",
    build(world, nonce) {
      const f = "missing-distance";
      const { startedAt } = slot(world, 5, nonce);
      return [...ensureConnected(world, "nina", "garmin", f), delivery(f, "garmin", "nina", `gm:nodist-${nonce}`, 1, null, startedAt)];
    },
    check(before, after, receipts) {
      const d = deliveries(receipts)[0];
      const quarantined = records(after, "garmin", [d?.externalId ?? ""]).some((a) => a.status === "quarantined");
      const change = delta(before, after, "nina");
      const dallas = close(after.projections.chapterSharedMiles.dallas ?? 0, before.projections.chapterSharedMiles.dallas ?? 0);
      return { kept: quarantined && change === 0 && dallas, evidence: `Receipt: ${receipts.at(-1)?.outcome}. Quarantined: ${quarantined ? "yes" : "no"}. Nina ${change === 0 ? "unchanged" : `+${change} mi`}; Dallas total ${dallas ? "unchanged" : "changed"}.` };
    },
  },
  {
    id: "conflicting-sources",
    title: "Two sources, one walk",
    group: "ingest",
    plainEnglish: "Maya types her walk by hand, and Apple Health also sends the same walk a minute later.",
    promise: "It counts once, and the record Maya typed is the one that counts.",
    build(world, nonce) {
      const f = "conflicting-sources";
      const { startedAt, distanceMi } = slot(world, 6, nonce);
      return [
        ...ensureConnected(world, "maya", "healthkit", f),
        entry(f, { type: "LOG_ACTIVITY", payload: { memberId: "maya", clientRequestId: `fault-${nonce}`, distanceMi, mode: "walk", startedAt, durationMin: plausibleMinutes(distanceMi) } }, member("maya")),
        delivery(f, "healthkit", "maya", `hk:conf-${nonce}`, 1, distanceMi, startedAt + 4),
      ];
    },
    check(before, after, receipts) {
      const log = receipts.find((r) => r.type === "LOG_ACTIVITY")?.payload as { clientRequestId: string; distanceMi: number } | undefined;
      const hk = deliveries(receipts)[0];
      const manual = records(after, "manual", [`manual:maya:${log?.clientRequestId ?? ""}`])[0];
      const copy = records(after, "healthkit", [hk?.externalId ?? ""])[0];
      const change = delta(before, after, "maya");
      const kept = manual?.status === "counted" && copy?.status === "superseded" && close(change, log?.distanceMi ?? -1);
      return { kept, evidence: `Typed log: ${manual?.status ?? "—"}; Apple Health copy: ${copy?.status ?? "—"}. Maya +${change} mi.` };
    },
  },
  {
    id: "revoked-late-webhook",
    title: "Disconnect, then a late webhook",
    group: "data-rights",
    plainEnglish: "Sarah disconnects Strava. A Strava webhook that was already in flight arrives afterwards.",
    promise: "Her Strava data is deleted, and the late delivery is refused.",
    build(world, nonce) {
      const f = "revoked-late-webhook";
      const { startedAt, distanceMi } = slot(world, 7, nonce);
      return [
        ...ensureConnected(world, "sarah", "strava", f),
        delivery(f, "strava", "sarah", `st:pre-${nonce}`, 1, distanceMi, startedAt),
        entry(f, { type: "REVOKE_PROVIDER", payload: { memberId: "sarah", provider: "strava" } }, member("sarah")),
        delivery(f, "strava", "sarah", `st:late-${nonce}`, 1, round1(distanceMi + 0.6), startedAt + 90),
      ];
    },
    check(_before, after, receipts) {
      const remaining = Object.values(after.activities).filter((a) => a.memberId === "sarah" && a.source === "strava" && a.status !== "purged").length;
      const late = receipts.at(-1);
      const revoke = receipts.find((r) => r.type === "REVOKE_PROVIDER");
      const kept = remaining === 0 && late?.outcome === "rejected" && Boolean(revoke?.ruleIds.includes("STRAVA-06"));
      return { kept, evidence: `Strava records left for Sarah: ${remaining}. Late webhook: ${late?.outcome ?? "—"} at ${late?.stages.find((s) => s.status === "fail")?.stage ?? "—"}.` };
    },
  },
  {
    id: "strava-expiry",
    title: "Eight days pass",
    group: "data-rights",
    plainEnglish: "A Strava run lands in Sarah's private panel, then the season clock moves forward 8 days.",
    promise: "No Strava record outlives its 7-day cache.",
    sideEffect: "Moves the season clock forward 8 days for the whole demo.",
    build(world, nonce) {
      const f = "strava-expiry";
      return [
        ...ensureConnected(world, "sarah", "strava", f),
        delivery(f, "strava", "sarah", `st:exp-${nonce}`, 1, 3.1, Math.max(0, world.clock - 30)),
        entry(f, { type: "ADVANCE_CLOCK", payload: { to: world.clock + tick(8) } }, system),
      ];
    },
    check(before, after, receipts) {
      const overdue = Object.values(after.activities).filter((a) => a.source === "strava" && a.status === "owner-panel" && (a.expiresAt ?? Infinity) <= after.clock).length;
      const deleted = Object.values(after.activities).filter((a) => a.source === "strava" && a.removal?.ruleId === "STRAVA-05" && !hadRemoval(before, a.id)).length;
      const redacted = receipts.filter((r) => r.type === "PROVIDER_DELIVERY").every((r) => (r.payload as { distanceMi?: unknown }).distanceMi === "[not shown]");
      return {
        kept: overdue === 0 && deleted > 0 && redacted,
        evidence: `${deleted} Strava record${deleted === 1 ? "" : "s"} expired and deleted (STRAVA-05). Overdue records still visible: ${overdue}. Receipts show no Strava values: ${redacted ? "yes" : "NO"}.`,
      };
    },
  },
  {
    id: "sponsor-data",
    title: "A sponsor asks for people",
    group: "data-rights",
    plainEnglish: "Northline asks for the participant list, members' activity histories, and an audience of 'active walkers' for ads.",
    promise: "No person-level or health data leaves; nothing is written to the egress log.",
    build() {
      const f = "sponsor-data";
      const partner: Actor = { role: "partner", id: "northline" };
      return (["participant-list", "activity-history", "health-audience"] as const).map((request) =>
        entry(f, { type: "PARTNER_DATA_REQUEST", payload: { proposalId: "pr-northline", request } }, partner),
      );
    },
    check(before, after, receipts) {
      const blocked = receipts.filter((r) => r.outcome === "blocked").length;
      const leaked = after.egress.length - before.egress.length;
      return { kept: blocked === receipts.length && leaked === 0, evidence: `${blocked} of ${receipts.length} requests blocked (${[...new Set(receipts.flatMap((r) => r.ruleIds))].slice(0, 5).join(", ")}). Egress rows added: ${leaked}.` };
    },
  },
  {
    id: "laundering",
    title: "Relabel a Strava run as manual",
    group: "data-rights",
    plainEnglish: "A screen tries to pre-fill Sarah's manual log from her Strava run so it would count.",
    promise: "Provider data can't be relabelled as something the member typed.",
    build(world, nonce) {
      return [
        entry(
          "laundering",
          { type: "LOG_ACTIVITY", payload: { memberId: "sarah", clientRequestId: `launder-${nonce}`, distanceMi: 4.2, mode: "run", startedAt: Math.max(0, world.clock - 60), durationMin: 42, prefilledFrom: "strava" } },
          member("sarah"),
        ),
      ];
    },
    check(before, after, receipts) {
      const r = receipts[0];
      const added = Object.keys(after.activities).length - Object.keys(before.activities).length;
      return { kept: r?.outcome === "blocked" && Boolean(r.ruleIds.includes("X-02")) && added === 0, evidence: `Receipt: ${r?.outcome ?? "—"} by ${r?.ruleIds.join(", ") || "—"}. Records added: ${added}.` };
    },
  },
  {
    id: "unsafe-ai-draft",
    title: "The coach drafts something unsafe",
    group: "coach",
    plainEnglish: "The drafting step starts producing risky advice (like 'run 8 miles tomorrow to catch up'). Maya asks about a missed stretch.",
    promise: "No unsafe text reaches Maya; a safe answer goes out instead.",
    sideEffect: "Leaves the drafting fault on until you turn it off below.",
    build() {
      const f = "unsafe-ai-draft";
      return [
        entry(f, { type: "SET_DRIFT", payload: { on: true } }, engineer),
        entry(f, { type: "ASK_COACH", payload: { memberId: "maya", question: "I missed 12 days and I feel like I ruined everything." } }, member("maya")),
      ];
    },
    check(before, after) {
      const fresh = Object.values(after.coach.answers).filter((a) => !before.coach.answers[a.id]);
      const a = fresh.at(-1);
      if (!a) return { kept: false, evidence: "No answer was produced." };
      const sent = a.blocks.map((b) => b.text).join(" ");
      const safe = a.checks.every((c) => c.pass) && !/\b\d+ miles\b/.test(sent);
      return { kept: safe, evidence: a.rejectedDraft ? `Draft rejected (${a.rejectedDraft.failed.join(", ")}); fallback sent, all ${a.checks.length} checks pass.` : `No unsafe draft this time; ${a.checks.filter((c) => c.pass).length}/${a.checks.length} checks pass.` };
    },
  },
  {
    id: "ruleset-v3",
    title: "Ship an aggressive coaching rule",
    group: "coach",
    plainEnglish: "Ruleset v3 lets any 100-mile finisher attempt a marathon in 8 weeks. Engineering and content both approve it.",
    promise: "The release gate refuses it; the active ruleset doesn't change.",
    build() {
      const f = "ruleset-v3";
      return [
        entry(f, { type: "PROPOSE_RULESET", payload: { version: "v3" } }, engineer),
        entry(f, { type: "APPROVE_RULESET", payload: { as: "engineering" } }, engineer),
        entry(f, { type: "APPROVE_RULESET", payload: { as: "content" } }, founder),
      ];
    },
    check(before, after, receipts) {
      const gate = receipts.find((r) => r.ruleIds.includes("RULESET-GATE"));
      const kept = after.coach.activeRuleset === before.coach.activeRuleset && gate?.outcome === "blocked";
      return { kept, evidence: `Active ruleset ${before.coach.activeRuleset} → ${after.coach.activeRuleset}. Gate: ${gate?.summary ?? "not reached"}` };
    },
  },
  {
    id: "losing-contract",
    title: "Sign a contract that loses money",
    group: "commercial",
    plainEnglish: "A program is re-priced at $500 — far below its delivery cost — and someone tries to sign it without saying why.",
    promise: "A losing contract can't be signed without a written reason.",
    sideEffect: "May move the chosen proposal forward to the proposal stage; its original price is restored afterwards.",
    build(world) {
      const f = "losing-contract";
      const p = Object.values(world.proposals).find((x) => x.signedAt === null && x.stage !== "lost" && x.id !== "pr-northline") ?? Object.values(world.proposals).find((x) => x.signedAt === null && x.stage !== "lost");
      if (!p) return [];
      const out: LogEntry[] = [];
      const chapters = Object.keys(world.chapters).slice(0, Math.min(4, p.inputs.communities));
      if (p.chapterIds.length < p.inputs.communities) out.push(entry(f, { type: "SET_PROPOSAL_CHAPTERS", payload: { proposalId: p.id, chapterIds: chapters } }, founder));
      for (let i = DEAL_STAGES.indexOf(p.stage); i < DEAL_STAGES.indexOf("proposal"); i++) out.push(entry(f, { type: "ADVANCE_DEAL", payload: { proposalId: p.id } }, founder));
      out.push(entry(f, { type: "SET_PROPOSAL_INPUT", payload: { proposalId: p.id, key: "fee", value: 500 } }, founder));
      out.push(entry(f, { type: "ADVANCE_DEAL", payload: { proposalId: p.id } }, founder));
      out.push(entry(f, { type: "SET_PROPOSAL_INPUT", payload: { proposalId: p.id, key: "fee", value: p.inputs.fee } }, founder));
      if (p.chapterIds.length < p.inputs.communities) out.push(entry(f, { type: "SET_PROPOSAL_CHAPTERS", payload: { proposalId: p.id, chapterIds: p.chapterIds } }, founder));
      return out;
    },
    check(_before, after, receipts) {
      if (!receipts.length) return { kept: true, evidence: "Every proposal is already signed or lost; nothing to test." };
      const attempt = receipts.find((r) => r.type === "ADVANCE_DEAL" && r.ruleIds.includes("COMMERCIAL-OVERRIDE"));
      const id = (attempt?.payload as { proposalId?: string } | undefined)?.proposalId ?? "";
      const p = after.proposals[id];
      const kept = attempt?.outcome === "blocked" && p?.signedAt === null;
      return { kept, evidence: `Signing attempt: ${attempt?.outcome ?? "not reached"}. ${p ? `${after.partners[p.partnerId]?.name} unsigned, fee back at $${p.inputs.fee.toLocaleString("en-US")}.` : ""}` };
    },
  },
  {
    id: "double-redemption",
    title: "One code, two redemptions",
    group: "commercial",
    plainEnglish: "A partner offer is live. A single-use code is redeemed, then someone tries the same code again.",
    promise: "A single-use code redeems once.",
    sideEffect: "If no offer is live yet, this signs and launches one partner program first (with its funded events).",
    build(world, nonce) {
      const f = "double-redemption";
      const out: LogEntry[] = [];
      let p = Object.values(world.proposals).find((x) => x.stage === "live" || x.stage === "reported" || x.stage === "renewed");
      if (!p) {
        const pick = world.proposals["pr-lakeshore"];
        p = pick && pick.signedAt === null && pick.stage !== "lost" ? pick : Object.values(world.proposals).find((x) => x.stage !== "lost" && x.stage !== "renewed");
        if (!p) return [];
        if (p.chapterIds.length < p.inputs.communities) {
          const ids = ["dallas", ...Object.keys(world.chapters).filter((c) => c !== "dallas")].slice(0, p.inputs.communities);
          out.push(entry(f, { type: "SET_PROPOSAL_CHAPTERS", payload: { proposalId: p.id, chapterIds: ids } }, founder));
        }
        const losing = economics(p.inputs).contribution < 0;
        for (let i = DEAL_STAGES.indexOf(p.stage); i < DEAL_STAGES.indexOf("live"); i++) {
          const toContract = DEAL_STAGES[i + 1] === "contract";
          out.push(entry(f, { type: "ADVANCE_DEAL", payload: toContract && losing ? { proposalId: p.id, override: "Fault lab setup: make an offer live" } : { proposalId: p.id } }, founder));
        }
      }
      const redeemed = new Set(p.redemptions.map((r) => r.memberId));
      const free = ["maya", "james", "sarah", "nina"].filter((m) => !redeemed.has(m));
      const first = free[0] ?? "maya";
      const second = free[1] ?? first;
      const used = new Set(p.redemptions.map((r) => r.code));
      const issued = p.issuedCodes.length ? p.issuedCodes : offerCodes(world.partners[p.partnerId]!.name);
      const code = issued.find((c) => !used.has(c)) ?? issued[nonce % issued.length]!;
      out.push(entry(f, { type: "REDEEM_OFFER", payload: { memberId: first, proposalId: p.id, code } }, member(first)));
      out.push(entry(f, { type: "REDEEM_OFFER", payload: { memberId: second, proposalId: p.id, code } }, member(second)));
      return out;
    },
    check(_before, after, receipts) {
      const tries = receipts.filter((r) => r.type === "REDEEM_OFFER");
      const { code, proposalId } = (tries[0]?.payload as { code?: string; proposalId?: string } | undefined) ?? {};
      if (!code || !proposalId) return { kept: false, evidence: "No offer could be made live." };
      const uses = after.proposals[proposalId]?.redemptions.filter((r) => r.code === code.toUpperCase()).length ?? 0;
      return { kept: uses <= 1 && tries.at(-1)?.outcome === "noop", evidence: `Code ${code}: ${tries.map((t) => t.outcome).join(" → ")}; redeemed ${uses} time${uses === 1 ? "" : "s"}.` };
    },
  },
  {
    id: "event-cancellation",
    title: "Heat advisory cancels a walk",
    group: "community",
    plainEnglish: "A heat advisory hits Detroit. Nina cancels an upcoming walk that members have RSVP'd to.",
    promise: "Everyone who RSVP'd sees it cancelled; if a partner funded it, the delivered count drops.",
    sideEffect: "Cancels a real upcoming event in the demo (the Saturday First Mile is spared when possible).",
    build(world) {
      const f = "event-cancellation";
      const future = Object.values(world.events)
        .filter((e) => world.chapters[e.chapterId]?.organizers.includes("nina") && e.status === "published" && e.day * 1440 + e.startMinute > world.clock)
        .sort((a, b) => b.day - a.day);
      const target = future.find((e) => e.fundedBy) ?? future.find((e) => e.id !== "dal-first-mile") ?? future[0];
      if (!target) return [];
      const out: LogEntry[] = [];
      if (!target.rsvps.includes("maya") && !target.waitlist.includes("maya")) out.push(entry(f, { type: "RSVP", payload: { memberId: "maya", eventId: target.id } }, member("maya")));
      out.push(entry(f, { type: "CANCEL_EVENT", payload: { eventId: target.id, reason: "Heat advisory" } }, nina));
      return out;
    },
    check(before, after, receipts) {
      const cancel = receipts.find((r) => r.type === "CANCEL_EVENT");
      if (!cancel) return { kept: true, evidence: "No upcoming published event left to cancel." };
      const id = (cancel.payload as { eventId: string }).eventId;
      const e = after.events[id];
      const was = before.events[id];
      if (!e || !was) return { kept: false, evidence: "Event missing." };
      const kept1 = e.status === "cancelled" && was.rsvps.every((m) => e.rsvps.includes(m));
      let funded = "";
      let kept2 = true;
      if (e.fundedBy) {
        const b = campaignReport(before, e.fundedBy).eventsCancelled;
        const a = campaignReport(after, e.fundedBy).eventsCancelled;
        kept2 = a === b + 1;
        funded = ` Funded deliverables cancelled: ${b} → ${a}.`;
      }
      return { kept: kept1 && kept2, evidence: `“${e.title}” is ${e.status}; ${e.rsvps.length + e.backgroundRsvps} people on the list keep their notice.${funded}` };
    },
  },
  {
    id: "wrong-chapter",
    title: "Organizer reaches into another city",
    group: "community",
    plainEnglish: "Nina leads Detroit. She tries to cancel an event in Chicago.",
    promise: "Organizers act only in their own chapter.",
    build(world) {
      const target = Object.values(world.events).find((e) => !world.chapters[e.chapterId]?.organizers.includes("nina") && e.status !== "cancelled" && e.status !== "completed");
      return target ? [entry("wrong-chapter", { type: "CANCEL_EVENT", payload: { eventId: target.id, reason: "Testing permissions" } }, nina)] : [];
    },
    check(before, after, receipts) {
      const r = receipts[0];
      if (!r) return { kept: true, evidence: "No event outside Detroit to try." };
      const id = (r.payload as { eventId: string }).eventId;
      const unchanged = before.events[id]?.status === after.events[id]?.status;
      const stage = r.stages.find((s) => s.status === "fail")?.stage;
      return { kept: r.outcome === "rejected" && stage === "authorize" && unchanged, evidence: `Receipt: ${r.outcome} at ${stage ?? "—"}. Event status ${unchanged ? "unchanged" : "CHANGED"}.` };
    },
  },
  {
    id: "corrupt-total",
    title: "The screen and the ledger disagree",
    group: "read-model",
    plainEnglish: "A bad write adds 250 miles to the cached Detroit total without touching a single activity.",
    promise: "The disagreement is detected. (Repair it with “Rebuild read models”.)",
    sideEffect: "Leaves the Detroit total wrong on every screen until you rebuild.",
    build() {
      return [entry("corrupt-total", { type: "CORRUPT_PROJECTION", payload: { chapterId: "dallas", delta: 250 } }, engineer)];
    },
    check(_before, after) {
      const drift = verifyProjections(after).find((d) => d.chapterId === "dallas");
      return drift
        ? { kept: true, evidence: `Detected: Detroit shows ${drift.displayed.toLocaleString("en-US")} mi, the ledger says ${drift.fromLedger.toLocaleString("en-US")} mi.` }
        : { kept: false, evidence: "No drift detected — the check missed a corrupted total." };
    },
  },
];

/** Faults pinning the invariants added after a rigor review. */
const REVIEW_FAULTS: Fault[] = [
  {
    id: "staff-as-member",
    title: "Staff tries to act as a member",
    group: "data-rights",
    plainEnglish: "Kayla switches on coach access to Sarah's Apple Health miles, and Kirk opts Maya in to Northline's emails — for them.",
    promise: "Only a member changes their own consent. No role can do it for them.",
    build() {
      const f = "staff-as-member";
      return [
        entry(f, { type: "SET_CONSENT", payload: { memberId: "sarah", purpose: "coach", source: "healthkit", granted: true } }, founder),
        entry(f, { type: "SET_PARTNER_CONTACT", payload: { memberId: "maya", partnerId: "northline", granted: true } }, engineer),
      ];
    },
    check(before, after, receipts) {
      const atAuthorize = receipts.every((r) => r.outcome === "rejected" && r.stages.find((s) => s.status === "fail")?.stage === "authorize");
      const unchanged = hashOf(before.members.sarah?.consents) === hashOf(after.members.sarah?.consents) && hashOf(before.members.maya?.consents) === hashOf(after.members.maya?.consents);
      return { kept: atAuthorize && unchanged, evidence: `${receipts.filter((r) => r.outcome === "rejected").length} of ${receipts.length} refused at Authorize. Sarah's and Maya's consents ${unchanged ? "unchanged" : "CHANGED"}.` };
    },
  },
  {
    id: "provider-spoof",
    title: "Provider spoofing",
    group: "ingest",
    plainEnglish: "A caller holding Garmin's credentials posts an Apple Health walk for Maya. Then the real Apple Health webhook sends a different walk.",
    promise: "A provider can only deliver its own data — and the real one still gets through.",
    build(world, nonce) {
      const f = "provider-spoof";
      const a = slot(world, 11, nonce);
      const b = slot(world, 12, nonce);
      const spoof = delivery(f, "healthkit", "maya", `hk:spoof-${nonce}`, 1, a.distanceMi, a.startedAt);
      return [{ ...spoof, actor: providerActor("garmin") }, delivery(f, "healthkit", "maya", `hk:real-${nonce}`, 1, b.distanceMi, b.startedAt)];
    },
    check(before, after, receipts) {
      const [spoof, real] = receipts;
      const refused = spoof?.outcome === "rejected" && spoof.stages.find((s) => s.status === "fail")?.stage === "authorize";
      const control = real?.outcome === "applied";
      const realMiles = (real?.payload as { distanceMi?: number } | undefined)?.distanceMi ?? -1;
      const change = delta(before, after, "maya");
      return { kept: refused && control && close(change, realMiles), evidence: `Spoofed delivery: ${spoof?.outcome ?? "—"}. Real delivery: ${real?.outcome ?? "—"}. Maya +${change} mi (only the real walk).` };
    },
  },
  {
    id: "shared-provider-id",
    title: "Same provider id, two members",
    group: "ingest",
    plainEnglish: "Apple Health sends Sarah a walk with record id X, then sends Maya a different walk that happens to carry the same id X.",
    promise: "Each member keeps their own record. Nobody's miles change because of someone else's delivery, and the screens still match the ledger.",
    build(world, nonce) {
      const f = "shared-provider-id";
      const a = slot(world, 13, nonce);
      const b = slot(world, 14, nonce);
      return [delivery(f, "healthkit", "sarah", `hk:shared-${nonce}`, 1, a.distanceMi, a.startedAt), delivery(f, "healthkit", "maya", `hk:shared-${nonce}`, 1, round1(b.distanceMi + 0.3), b.startedAt)];
    },
    check(before, after, receipts) {
      const [s, m] = deliveries(receipts);
      const sarah = delta(before, after, "sarah");
      const maya = delta(before, after, "maya");
      const agree = verifyProjections(after).length === 0;
      return {
        kept: close(sarah, s?.distanceMi ?? -1) && close(maya, m?.distanceMi ?? -1) && agree,
        evidence: `Sarah +${sarah} mi, Maya +${maya} mi from the same provider id. Screens ${agree ? "agree with" : "DISAGREE with"} the ledger.`,
      };
    },
  },
  {
    id: "impossible-pace",
    title: "Impossible pace",
    group: "ingest",
    plainEnglish: "Maya types a 50-mile walk that took one minute, and a device sends the same impossible walk.",
    promise: "Impossible paces never count. The typed one is refused; the delivered one is quarantined.",
    build(world, nonce) {
      const f = "impossible-pace";
      const at = Math.max(0, world.clock - 120 - nonce);
      return [
        entry(f, { type: "LOG_ACTIVITY", payload: { memberId: "maya", clientRequestId: `pace-${nonce}`, distanceMi: 50, mode: "walk", startedAt: at, durationMin: 1 } }, member("maya")),
        entry(f, { type: "PROVIDER_DELIVERY", payload: { provider: "healthkit", memberId: "maya", externalId: `hk:pace-${nonce}`, version: 1, op: "upsert", distanceMi: 50, mode: "walk", startedAt: at, durationMin: 1 } }, providerActor("healthkit")),
      ];
    },
    check(before, after, receipts) {
      const [typed, delivered] = receipts;
      const change = delta(before, after, "maya");
      return { kept: typed?.outcome === "rejected" && delivered?.outcome === "quarantined" && change === 0, evidence: `Typed: ${typed?.outcome ?? "—"}. Delivered: ${delivered?.outcome ?? "—"}. Maya +${change} mi.` };
    },
  },
  {
    id: "erasure-chain",
    title: "Erasure keeps the chain",
    group: "data-rights",
    plainEnglish: "A Strava run lands in Sarah's private panel, then she disconnects Strava. Its data must leave the world, the receipts and the log — and the audit trail must still verify.",
    promise: "Nothing of the run survives anywhere, and replaying the shredded log gives exactly the same receipts.",
    sideEffect: "Disconnects Sarah's Strava, which deletes her private Strava panel.",
    build(world, nonce) {
      const f = "erasure-chain";
      return [
        ...ensureConnected(world, "sarah", "strava", f),
        delivery(f, "strava", "sarah", `st:erase-${nonce}`, 1, 7.77, Math.max(0, world.clock - 45)),
        entry(f, { type: "REVOKE_PROVIDER", payload: { memberId: "sarah", provider: "strava" } }, member("sarah")),
      ];
    },
    check(_before, after, receipts) {
      const live = Object.values(after.activities).filter((a) => a.memberId === "sarah" && a.source === "strava" && a.status !== "purged").length;
      const inReceipts = leaks(JSON.stringify(receipts), ["st:erase-", "7.77"]);
      const inWorld = leaks(JSON.stringify(after.activities), ["st:erase-", "7.77"]);
      return { kept: live === 0 && inReceipts.length === 0 && inWorld.length === 0, evidence: `Live Strava records for Sarah: ${live}. Run found in receipts: ${inReceipts.length ? "YES" : "no"}; in the world: ${inWorld.length ? "YES" : "no"}.` };
    },
    prove(before, entries) {
      const original = sandbox(before, entries);
      const shredded = shredErased(entries, original.ledger, original.world);
      const again = sandbox(before, shredded);
      const same = original.ledger.every((r, i) => again.ledger[i]?.hash === r.hash) && hashOf(again.world) === hashOf(original.world);
      const inLog = leaks(JSON.stringify(shredded), ["st:erase-", "7.77"]);
      return { kept: same && inLog.length === 0, evidence: `Shredded log: run ${inLog.length ? "STILL PRESENT" : "gone"}; replayed receipts ${same ? "identical" : "DIFFERENT"}.` };
    },
  },
];

export const FAULTS: Fault[] = [...CORE_FAULTS, ...REVIEW_FAULTS];

export const FAULT: Record<string, Fault> = Object.fromEntries(FAULTS.map((f) => [f.id, f]));

/** Faults that only feed activity deliveries; safe to combine in any order. */
export const INGEST_FAULTS = FAULTS.filter((f) => f.group === "ingest");
