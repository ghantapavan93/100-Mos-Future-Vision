// The engine. One function, `execute`, takes the current machine and a command
// and returns the next machine plus a receipt that shows every stage the
// command went through:
//
//   input → authorize → reconcile → policy → apply → audit → project
//
// Invariants this file owns (each is pinned by tests):
//   1. Every input yields exactly one receipt — refusals and internal errors included.
//   2. Member-authored data (consent, logs, RSVPs, questions) is written only by that member.
//      Staff roles cannot act as a member.
//   3. A record changes only through its owner's key (member, source, external id).
//   4. A provider speaks only for itself; an organizer acts only in the chapter they lead.
//   5. The audit chain never holds restricted payloads (Strava data, what a member told
//      the coach): receipts carry digests, so erasing the source never breaks the chain.
// The engine is pure and deterministic: replaying the same commands gives the same hash.

import { SEASON, tick } from "./calendar";
import { schemas, HARNESS_COMMANDS, type CommandInput, type CommandType, type Payload } from "./commands";
import { economics, usd } from "./finance";
import { diff, fnv1a, hashOf, type Change } from "./hash";
import { decide, ruleFor, suppressSmall } from "./policy";
import { activitiesOf, chaptersTouchedBy, rebuildProjections, refreshChapters } from "./projections";
import { answer } from "./quantum/answer";
import { FORGOTTEN } from "./quantum/classify";
import { releaseGate } from "./quantum/evals";
import { seedWorld } from "./fixtures";
import {
  DEAL_STAGES,
  IMPACT_STAGES,
  type Activity,
  type ActivitySource,
  type Actor,
  type Member,
  type MovementEvent,
  type MovementMode,
  type Proposal,
  type Role,
  type StampKind,
  type Tick,
  type World,
} from "./types";

export type Stage = "input" | "authorize" | "reconcile" | "policy" | "apply" | "audit" | "project";
export const STAGES: readonly Stage[] = ["input", "authorize", "reconcile", "policy", "apply", "audit", "project"];

export type Outcome = "applied" | "noop" | "rejected" | "blocked" | "deferred" | "quarantined";

export interface StageNote {
  stage: Stage;
  status: "pass" | "fail" | "info" | "skip";
  detail: string;
  ruleId?: string;
}

export type Lens = "member" | "coach" | "circles" | "partner" | "impact" | "founder" | "future" | "xray";

export interface Meta {
  /** Set when an engineer injected this command as a fault. */
  fault?: string;
  /** Where the command came from: a screen, the presenter, or a coach proposal the member tapped. */
  via?: string;
  /** Set by the engine for test-harness commands (fault injection, clock, repair). */
  harness?: boolean;
}

export interface Receipt {
  seq: number;
  type: CommandType;
  /** The command as validated — with restricted fields replaced by digests. */
  payload: unknown;
  actor: Actor;
  at: Tick;
  outcome: Outcome;
  summary: string;
  stages: StageNote[];
  ruleIds: string[];
  /** Field-level changes, with restricted records collapsed to one redacted line each. */
  changes: Change[];
  /** How many changes there were, and whether `changes` shows fewer. */
  changeCount: { total: number; truncated: boolean };
  /** Non-restricted facts the engine derived (e.g. a coach answer's intent) — what erasure keeps. */
  facts?: Record<string, string>;
  lenses: Lens[];
  meta: Meta;
  prevHash: string;
  hash: string;
}

export interface Machine {
  world: World;
  ledger: Receipt[];
}

export const GENESIS = "00000000";

export function initialMachine(): Machine {
  return { world: seedWorld(), ledger: [] };
}

export function headHash(m: Machine): string {
  return m.ledger.length ? m.ledger[m.ledger.length - 1]!.hash : GENESIS;
}

/** Everything a receipt's hash covers. One definition, used to write and to verify. */
export function receiptBody(r: Omit<Receipt, "hash" | "prevHash" | "lenses">) {
  return {
    seq: r.seq,
    type: r.type,
    payload: r.payload,
    actor: r.actor,
    at: r.at,
    outcome: r.outcome,
    summary: r.summary,
    stages: r.stages,
    ruleIds: r.ruleIds,
    changes: r.changes,
    changeCount: r.changeCount,
    facts: r.facts,
    meta: r.meta,
  };
}

export function receiptHash(r: Receipt): string {
  return hashOf({ prevHash: r.prevHash, body: receiptBody(r) });
}

// ── Handler plumbing ────────────────────────────────────────────────────────

interface Ctx {
  w: World;
  actor: Actor;
  at: Tick;
  note(stage: Stage, status: StageNote["status"], detail: string, ruleId?: string): void;
  fact(key: string, value: string): void;
}

interface Result {
  outcome: Outcome;
  summary: string;
  /** For refusals: the stage that refused. */
  stage?: Stage;
  ruleId?: string;
}

type Handler<T extends CommandType> = {
  roles: Role[];
  /** Ownership check beyond the role: return a reason to refuse, or null. */
  owns?: (w: World, actor: Actor, p: Payload<T>) => string | null;
  run: (ctx: Ctx, p: Payload<T>) => Result;
};

const ok = (summary: string): Result => ({ outcome: "applied", summary });

/** Names people use for each source; ids like "healthkit" stay in stage notes for engineers. */
const SOURCE_NAME: Record<ActivitySource, string> = {
  manual: "logged-by-hand",
  event_checkin: "event check-in",
  strava: "Strava",
  healthkit: "Apple Health",
  health_connect: "Health Connect",
  garmin: "Garmin",
};
const noop = (summary: string, ruleId?: string): Result => (ruleId ? { outcome: "noop", summary, stage: "reconcile", ruleId } : { outcome: "noop", summary, stage: "reconcile" });
const reject = (stage: Stage, summary: string, ruleId?: string): Result => (ruleId ? { outcome: "rejected", summary, stage, ruleId } : { outcome: "rejected", summary, stage });
const block = (summary: string, ruleId: string): Result => ({ outcome: "blocked", summary, stage: "policy", ruleId });

/** A person's display name for messages; ids never reach the screen. */
function nameOf(w: World, id: string): string {
  return w.members[id]?.name ?? w.partners[id]?.name ?? id;
}

/** Invariant 2: only the member writes member-authored data. No staff bypass. */
function self(w: World, actor: Actor, memberId: string): string | null {
  if (actor.role !== "member" && actor.role !== "organizer") return `Only ${nameOf(w, memberId)} can do this. Staff can't act as a member.`;
  return actor.id === memberId ? null : `${nameOf(w, actor.id)} can't act for ${nameOf(w, memberId)}.`;
}

/** Invariant 4: an organizer acts only in a chapter they lead and still belong to. */
function organizes(w: World, actor: Actor, chapterId: string | undefined): string | null {
  if (actor.role === "founder") return null;
  const chapter = chapterId ? w.chapters[chapterId] : undefined;
  if (!chapter) return "Unknown chapter.";
  const leads = chapter.organizers.includes(actor.id) && w.members[actor.id]?.chapterId === chapter.id;
  return leads ? null : `${nameOf(w, actor.id)} does not organize ${chapter.city}.`;
}

function memberOf(w: World, id: string): Member {
  const m = w.members[id];
  if (!m) throw new Error(`Unknown member ${id}`);
  return m;
}

function eventOf(w: World, id: string): MovementEvent {
  const e = w.events[id];
  if (!e) throw new Error(`Unknown event ${id}`);
  return e;
}

function nextId(w: World, prefix: string): string {
  w.seq += 1;
  return `${prefix}-${w.seq}`;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function seasonMiles(w: World, memberId: string): number {
  return round1(
    activitiesOf(w, memberId)
      .filter((a) => a.status === "counted")
      .reduce((s, a) => s + a.distanceMi, 0),
  );
}

function award(ctx: Ctx, memberId: string): void {
  const m = ctx.w.members[memberId];
  if (!m) return;
  const has = (k: StampKind) => m.stamps.some((s) => s.kind === k);
  const give = (k: StampKind) => {
    if (!has(k)) {
      m.stamps.push({ kind: k, at: ctx.at });
      ctx.note("apply", "info", `Stamp earned: ${k}.`);
    }
  };
  const total = seasonMiles(ctx.w, memberId);
  if (total > 0) give("first-mile");
  if (total >= 10) give("ten-miles");
  if (total >= 50) give("fifty-miles");
  if (total >= 100) give("hundred-miles");
  if ((m.goal.kind === "own-distance" || m.goal.kind === "season-100") && total >= m.goal.target) give("own-goal");
}

/** After any change to a member's records or settings, keep the read models current. */
function touched(ctx: Ctx, memberId: string): void {
  refreshChapters(ctx.w, chaptersTouchedBy(ctx.w, memberId));
  award(ctx, memberId);
}

// ── Plausibility ────────────────────────────────────────────────────────────

/** Generous upper bounds, miles per hour. Anything faster is a typo or a fake. */
const MAX_MPH: Record<MovementMode, number> = { walk: 6, hike: 6, jog: 10, run: 16, roll: 25 };
const MAX_MILES_PER_DAY = 60;
const MIN_MILES = 0.1;

function implausible(w: World, memberId: string, distanceMi: number, durationMin: number, mode: MovementMode, startedAt: Tick): string | null {
  if (distanceMi < MIN_MILES) return `${distanceMi} mi is below the 0.1-mile minimum.`;
  const mph = distanceMi / (durationMin / 60);
  if (mph > MAX_MPH[mode]) return `${distanceMi} mi in ${durationMin} min is ${round1(mph)} mph — faster than a ${mode} can be.`;
  const day = Math.floor(startedAt / 1440);
  const thatDay = activitiesOf(w, memberId)
    .filter((a) => a.status === "counted" && Math.floor(a.startedAt / 1440) === day)
    .reduce((s, a) => s + a.distanceMi, 0);
  if (thatDay + distanceMi > MAX_MILES_PER_DAY) return `That would make ${round1(thatDay + distanceMi)} mi in one day, over the ${MAX_MILES_PER_DAY}-mile limit.`;
  return null;
}

// ── Activity reconciliation ─────────────────────────────────────────────────

/** When two sources describe one outing, keep one so it counts once. First-party wins. */
const PRIORITY: Record<ActivitySource, number> = { event_checkin: 5, manual: 4, healthkit: 3, health_connect: 3, garmin: 2, strava: 0 };

function sameOuting(a: Activity, b: { startedAt: number; distanceMi: number }): boolean {
  return Math.abs(a.startedAt - b.startedAt) <= 15 && Math.abs(a.distanceMi - b.distanceMi) <= Math.max(0.1, a.distanceMi * 0.03);
}

/** A Strava delivery whose data was erased from the log (see erasure.ts). */
export const STRAVA_SHREDDED = "strava:shredded:";

interface Incoming {
  memberId: string;
  source: ActivitySource;
  externalId: string;
  version: number;
  distanceMi: number;
  mode: Activity["mode"];
  startedAt: number;
  durationMin: number;
  eventId?: string;
}

function ingest(ctx: Ctx, input: Incoming): Result {
  const w = ctx.w;
  const strava = input.source === "strava";
  // Invariant 3: the identity of a record includes its owner.
  const existing = Object.values(w.activities).find((a) => a.memberId === input.memberId && a.source === input.source && a.externalId === input.externalId);
  if (existing) {
    if (existing.status === "purged") return noop(strava ? "That Strava record was removed earlier and stays removed." : `${input.externalId} was removed earlier and stays removed.`);
    if (input.version <= existing.version) {
      ctx.note("reconcile", "pass", strava ? `Already have this Strava record at v${existing.version}; ignored.` : `Already have ${input.externalId} at v${existing.version}; this delivery is v${input.version}. Duplicate or out-of-order — ignored.`);
      return noop(strava ? "Duplicate or stale Strava delivery ignored." : `The same ${SOURCE_NAME[input.source]} record arrived again. Ignored; miles unchanged.`);
    }
    ctx.note("reconcile", "pass", strava ? `Newer version v${input.version} of a Strava record replaces v${existing.version}.` : `Newer version v${input.version} of ${input.externalId} replaces v${existing.version}.`);
    existing.version = input.version;
    existing.distanceMi = input.distanceMi;
    existing.startedAt = input.startedAt;
    existing.durationMin = input.durationMin;
    existing.receivedAt = ctx.at;
    touched(ctx, existing.memberId);
    return ok(strava ? `Strava record updated to v${input.version}.` : `A newer version of a ${SOURCE_NAME[input.source]} record replaced the old one (${input.distanceMi} mi).`);
  }

  const id = nextId(w, "a");
  const record: Activity = {
    id,
    memberId: input.memberId,
    source: input.source,
    externalId: input.externalId,
    version: input.version,
    distanceMi: input.distanceMi,
    mode: input.mode,
    startedAt: input.startedAt,
    durationMin: input.durationMin,
    status: "counted",
    receivedAt: ctx.at,
  };
  if (input.eventId) record.eventId = input.eventId;

  if (strava) {
    record.status = "owner-panel";
    record.expiresAt = ctx.at + tick(7);
    ctx.note("policy", "info", "Strava record goes to the member's private 7-day panel. Not counted, not combined, not shared.", "STRAVA-04");
    w.activities[id] = record;
    return ok("Strava outing shown privately to its owner for 7 days.");
  }

  // Strava records are never compared with other sources (no combining, STRAVA-04), and two
  // entries a member typed are never merged: two real walks can share a length and a time.
  const twin = Object.values(w.activities).find(
    (a) =>
      a.memberId === input.memberId &&
      a.status === "counted" &&
      a.source !== "strava" &&
      !(a.source === "manual" && input.source === "manual") &&
      sameOuting(a, input),
  );
  if (twin) {
    const incomingWins = PRIORITY[input.source] > PRIORITY[twin.source];
    if (incomingWins) {
      twin.status = "superseded";
      twin.supersededBy = id;
      ctx.note("reconcile", "pass", `Same outing as an existing ${twin.source} record. ${input.source} is first-party, so it counts and the other is kept but superseded.`);
    } else {
      record.status = "superseded";
      record.supersededBy = twin.id;
      ctx.note(
        "reconcile",
        "pass",
        twin.source === input.source ? "Same outing, re-sent with a new record id. Kept once." : `Same outing as an existing ${twin.source} record. Counted once; this copy is kept but superseded.`,
      );
    }
  } else {
    ctx.note("reconcile", "pass", "New outing: no duplicate by owner, id, version or time-and-distance fingerprint.");
  }

  w.activities[id] = record;
  touched(ctx, input.memberId);
  return ok(record.status === "counted" ? `${input.distanceMi} mi counted for ${memberOf(w, input.memberId).name}.` : `Duplicate outing recorded once. Miles unchanged.`);
}

/**
 * Remove a record from every total. Strava records are deleted, not hidden: the
 * terms require the data itself to go (STRAVA-05, STRAVA-06), so only a
 * tombstone with no distance, time or provider id remains.
 */
export function removeRecord(a: Activity, reason: string, ruleId: string, at: Tick): void {
  a.status = "purged";
  a.removal = { reason, ruleId, at };
  if (a.source === "strava") {
    a.distanceMi = 0;
    a.durationMin = 0;
    a.startedAt = 0;
    a.mode = "walk";
    a.externalId = `strava:deleted:${a.id}`;
    delete a.expiresAt;
  }
}

function purgeSource(ctx: Ctx, memberId: string, source: ActivitySource, ruleId: string, reason: string): number {
  let n = 0;
  for (const a of Object.values(ctx.w.activities)) {
    if (a.memberId === memberId && a.source === source && a.status !== "purged") {
      removeRecord(a, reason, ruleId, ctx.at);
      n++;
    }
  }
  return n;
}

// ── Commercial helpers ──────────────────────────────────────────────────────

export function proposalOf(w: World, id: string): Proposal | undefined {
  return w.proposals[id];
}

export interface ImpactPool {
  /** Impact money from contracts the partner has PAID and that can fund their own promise. */
  committed: number;
  disbursed: number;
  available: number;
  /** Impact promised in signed contracts not yet paid. */
  awaitingPayment: number;
  /** Impact promised in paid contracts that lose money: the contract can't fund it. */
  unfunded: number;
  /** Impact promised in proposals nobody has signed. */
  pipeline: number;
}

export function impactPool(w: World): ImpactPool {
  let committed = 0;
  let awaitingPayment = 0;
  let unfunded = 0;
  let pipeline = 0;
  for (const p of Object.values(w.proposals)) {
    if (p.stage === "lost") continue;
    const e = economics(p.inputs);
    if (p.signedAt === null) pipeline += e.impact;
    else if (p.paidAt === null) awaitingPayment += e.impact;
    else if (e.contribution < 0) unfunded += e.impact;
    else committed += e.impact;
  }
  return { committed, disbursed: w.impact.disbursed, available: committed - w.impact.disbursed, awaitingPayment, unfunded, pipeline };
}

export interface CampaignReport {
  proposalId: string;
  eventsPlanned: number;
  eventsCompleted: number;
  eventsCancelled: number;
  /** Named people an organizer checked in at funded events (verifiable). Small groups suppressed. */
  attendance: number | "fewer than 10";
  /** Of those, people at their first event. */
  firstTimers: number | "fewer than 10";
  /** The fictional crowd at those events. MODELLED — never shown as a count of real people. */
  modelledAttendance: number;
  optInContacts: number;
  excludedSources: string[];
}

/** What a partner may see: counts from first-party check-ins at the events they funded. */
export function campaignReport(w: World, proposalId: string): CampaignReport {
  const p = w.proposals[proposalId];
  if (!p) throw new Error(`Unknown proposal ${proposalId}`);
  const events = p.fundedEventIds.map((id) => w.events[id]).filter((e): e is MovementEvent => Boolean(e));
  const completed = events.filter((e) => e.status === "completed");
  const named = completed.reduce((s, e) => s + e.checkIns.length, 0);
  const firstTimers = completed.reduce((s, e) => s + e.checkIns.filter((c) => c.firstEvent).length, 0);
  return {
    proposalId,
    eventsPlanned: events.length,
    eventsCompleted: completed.length,
    eventsCancelled: events.filter((e) => e.status === "cancelled").length,
    attendance: suppressSmall(named),
    firstTimers: suppressSmall(firstTimers),
    modelledAttendance: completed.reduce((s, e) => s + (e.backgroundAttended ?? 0), 0),
    optInContacts: Object.values(w.members).filter((m) => m.consents.partnerContact.includes(p.partnerId)).length,
    excludedSources: ["strava", "healthkit", "health_connect", "garmin", "manual"],
  };
}

/** The weekly schedule a campaign would run, per chapter. Shared by the signing guard and the launch. */
export function campaignSchedule(at: Tick, p: Proposal): { chapterId: string; day: number }[] {
  const baseDay = Math.max(14, Math.ceil(at / 1440) + 2);
  const out: { chapterId: string; day: number }[] = [];
  p.chapterIds.forEach((chapterId, ci) => {
    for (let i = 0; i < p.inputs.eventsPerCommunity; i++) out.push({ chapterId, day: baseDay + 7 * i + ci + 7 });
  });
  return out;
}

const LIVE_STAGES = new Set(["live", "reported", "renewed"]);

/** The 20 single-use codes a program issues when it goes live (handed out at its events). */
export function offerCodes(partnerName: string): string[] {
  const prefix = partnerName
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 3);
  return Array.from({ length: 20 }, (_, n) => `${prefix}-${String(n + 1).padStart(4, "0")}`);
}

function launchCampaign(ctx: Ctx, p: Proposal): string[] {
  const created: string[] = [];
  const partner = ctx.w.partners[p.partnerId]!;
  for (const { chapterId, day } of campaignSchedule(ctx.at, p)) {
    const chapter = ctx.w.chapters[chapterId]!;
    const id = nextId(ctx.w, `ev-${chapterId}`);
    ctx.w.events[id] = {
      id,
      chapterId,
      title: `First Mile, supported by ${partner.name}`.slice(0, 55),
      mode: "mixed",
      day,
      startMinute: 8 * 60,
      meetingArea: `${chapter.city} — meeting point set by the organizer`,
      distanceOptions: [1, 2],
      paceNote: "Every pace. A sweep finishes at the back.",
      // Access is unknown until an organizer has checked the site; nothing is claimed.
      access: [],
      capacity: 40,
      rsvps: [],
      waitlist: [],
      checkIns: [],
      backgroundRsvps: 12,
      backgroundAttended: null,
      status: "submitted",
      createdBy: chapter.organizers[0]!,
      sweep: null,
      fundedBy: p.id,
    };
    created.push(id);
  }
  return created;
}

// ── Handlers ────────────────────────────────────────────────────────────────

const MEMBER_ROLES: Role[] = ["member", "organizer"];
const ORGANIZER_ROLES: Role[] = ["organizer", "founder"];

const handlers: { [T in CommandType]: Handler<T> } = {
  JOIN_MOVEMENT: {
    roles: ["member"],
    owns: (w, a) => (w.members[a.id] ? `${nameOf(w, a.id)} is already a member; one person, one membership.` : null),
    run(ctx, p) {
      if (p.chapterId && !ctx.w.chapters[p.chapterId]) return reject("input", "Unknown chapter.");
      const id = nextId(ctx.w, "guest");
      const off = { manual: false, event_checkin: false, healthkit: false, health_connect: false, garmin: false };
      ctx.w.members[id] = {
        id,
        name: p.name,
        persona: "You",
        why: p.goalLabel,
        moves: p.moves,
        goal: { kind: p.goalKind, target: p.target, label: p.goalLabel },
        racePath: "5k",
        chapterId: p.chapterId,
        homeChapterId: p.chapterId ?? "detroit",
        // Joining a circle is not consent to share: every switch starts off (WA-02).
        consents: { chapter: { ...off }, coach: { ...off }, storyWall: false, partnerContact: [], needsToOrganizers: false },
        needs: p.needs,
        connections: {
          strava: { provider: "strava", status: "never", since: null, lastDeliveryAt: null },
          healthkit: { provider: "healthkit", status: "never", since: null, lastDeliveryAt: null },
          health_connect: { provider: "health_connect", status: "never", since: null, lastDeliveryAt: null },
          garmin: { provider: "garmin", status: "never", since: null, lastDeliveryAt: null },
        },
        invitesSent: 0,
        storyCardDrafted: false,
        rankMode: "personal",
        savedStep: null,
        stamps: [],
        joinedAt: ctx.at,
        fixture: true,
      };
      if (p.chapterId) ctx.w.chapters[p.chapterId]!.members.push(id);
      ctx.note("apply", "info", "Account created with only what the member typed. Every sharing switch starts off.");
      refreshChapters(ctx.w, p.chapterId ? [p.chapterId] : []);
      return ok(`${p.name} started their summer${p.chapterId ? ` in ${ctx.w.chapters[p.chapterId]!.city}` : ""}.`);
    },
  },
  SET_GOAL: {
    roles: MEMBER_ROLES,
    owns: (w, a, p) => self(w, a, p.memberId),
    run(ctx, p) {
      const m = memberOf(ctx.w, p.memberId);
      m.goal = { kind: p.kind, target: p.target, label: p.label };
      award(ctx, m.id);
      return ok(`${m.name}'s goal is now “${p.label}”.`);
    },
  },
  SET_RACE_PATH: {
    roles: MEMBER_ROLES,
    owns: (w, a, p) => self(w, a, p.memberId),
    run(ctx, p) {
      const m = memberOf(ctx.w, p.memberId);
      if (m.racePath === p.racePath) return noop(`Race path already ${p.racePath}.`);
      m.racePath = p.racePath;
      return ok(`${m.name} is exploring the ${p.racePath} path.`);
    },
  },
  SET_RANK_MODE: {
    roles: MEMBER_ROLES,
    owns: (w, a, p) => self(w, a, p.memberId),
    run(ctx, p) {
      const m = memberOf(ctx.w, p.memberId);
      m.rankMode = p.mode;
      return ok(p.mode === "personal" ? "Showing your own progress. No comparison." : "Showing your circle's shared total. Every pace counts.");
    },
  },
  LOG_ACTIVITY: {
    roles: MEMBER_ROLES,
    owns: (w, a, p) => self(w, a, p.memberId),
    run(ctx, p) {
      if (p.prefilledFrom) return block(`A manual log can't be pre-filled from ${p.prefilledFrom}. The member types it, or it isn't a manual log.`, "X-02");
      if (!(p.distanceMi > 0)) return reject("input", "Distance must be more than zero.");
      if (p.distanceMi > 50) return reject("input", "More than 50 miles in one outing is outside what this app accepts without review.");
      if (p.startedAt > ctx.w.clock) return reject("input", "That outing starts in the future.");
      const odd = implausible(ctx.w, p.memberId, p.distanceMi, p.durationMin, p.mode, p.startedAt);
      if (odd) return reject("input", `${odd} Check the distance or the minutes.`);
      ctx.note("input", "pass", `${p.distanceMi} mi ${p.mode}, typed by the member.`);
      return ingest(ctx, {
        memberId: p.memberId,
        source: "manual",
        // The member's own request key: one member's key can never swallow another's log.
        externalId: `manual:${p.memberId}:${p.clientRequestId}`,
        version: 1,
        distanceMi: round1(p.distanceMi),
        mode: p.mode,
        startedAt: p.startedAt,
        durationMin: p.durationMin,
      });
    },
  },
  DELETE_ACTIVITY: {
    roles: MEMBER_ROLES,
    owns: (w, a, p) => self(w, a, p.memberId),
    run(ctx, p) {
      const a = ctx.w.activities[p.activityId];
      if (!a || a.memberId !== p.memberId) return reject("authorize", "That record isn't yours.");
      if (a.status === "purged") return noop("Already removed.");
      const what = a.source === "strava" ? "a Strava record" : `${a.distanceMi} mi (${a.source})`;
      removeRecord(a, "Deleted by the member.", "OWNER", ctx.at);
      touched(ctx, p.memberId);
      return ok(`Removed ${what}.`);
    },
  },
  SET_CONSENT: {
    roles: MEMBER_ROLES,
    owns: (w, a, p) => self(w, a, p.memberId),
    run(ctx, p) {
      const m = memberOf(ctx.w, p.memberId);
      const bucket = m.consents[p.purpose];
      if (bucket[p.source] === p.granted) return noop("No change.");
      bucket[p.source] = p.granted;
      touched(ctx, m.id);
      const where = p.purpose === "chapter" ? "the circle total" : "the coach";
      return ok(`${m.name}'s ${SOURCE_NAME[p.source]} miles ${p.granted ? "now reach" : "no longer reach"} ${where}.`);
    },
  },
  SET_STORY_WALL: {
    roles: MEMBER_ROLES,
    owns: (w, a, p) => self(w, a, p.memberId),
    run(ctx, p) {
      const m = memberOf(ctx.w, p.memberId);
      if (m.consents.storyWall === p.on) return noop("No change.");
      m.consents.storyWall = p.on;
      return ok(p.on ? `${m.name}'s first name and miles appear on the chapter wall.` : `${m.name} is off the chapter wall.`);
    },
  },
  SET_PARTNER_CONTACT: {
    roles: MEMBER_ROLES,
    owns: (w, a, p) => self(w, a, p.memberId),
    run(ctx, p) {
      const m = memberOf(ctx.w, p.memberId);
      const has = m.consents.partnerContact.includes(p.partnerId);
      if (has === p.granted) return noop("No change.");
      m.consents.partnerContact = p.granted ? [...m.consents.partnerContact, p.partnerId] : m.consents.partnerContact.filter((x) => x !== p.partnerId);
      return ok(`${m.name} ${p.granted ? "chose to share an email with" : "withdrew their email from"} ${ctx.w.partners[p.partnerId]!.name}.`);
    },
  },
  SET_NEEDS_SHARING: {
    roles: MEMBER_ROLES,
    owns: (w, a, p) => self(w, a, p.memberId),
    run(ctx, p) {
      const m = memberOf(ctx.w, p.memberId);
      if (m.consents.needsToOrganizers === p.on) return noop("No change.");
      m.consents.needsToOrganizers = p.on;
      return ok(p.on ? `Organizers of events ${m.name} joins can see the access needs ${m.name} listed.` : `${m.name}'s access needs are private again.`);
    },
  },
  CONNECT_PROVIDER: {
    roles: MEMBER_ROLES,
    owns: (w, a, p) => self(w, a, p.memberId),
    run(ctx, p) {
      const c = memberOf(ctx.w, p.memberId).connections[p.provider];
      if (c.status === "connected") return noop("Already connected.");
      c.status = "connected";
      c.since = ctx.at;
      return ok(`${SOURCE_NAME[p.provider]} connected.`);
    },
  },
  REVOKE_PROVIDER: {
    roles: MEMBER_ROLES,
    owns: (w, a, p) => self(w, a, p.memberId),
    run(ctx, p) {
      const m = memberOf(ctx.w, p.memberId);
      const c = m.connections[p.provider];
      if (c.status !== "connected") return noop("Not connected.");
      c.status = "revoked";
      const rule = p.provider === "strava" ? "STRAVA-06" : p.provider === "healthkit" ? "APPLE-06" : "OURS-DISCONNECT";
      const n = purgeSource(ctx, m.id, p.provider, rule, `Disconnected ${p.provider}.`);
      ctx.note("policy", "pass", `${n} ${p.provider} record${n === 1 ? "" : "s"} removed; later deliveries will be refused.`, rule);
      touched(ctx, m.id);
      return ok(`${SOURCE_NAME[p.provider]} disconnected. ${n} record${n === 1 ? "" : "s"} removed${p.provider === "strava" ? " and deleted" : " from every total"}.`);
    },
  },
  JOIN_CHAPTER: {
    roles: MEMBER_ROLES,
    owns: (w, a, p) => self(w, a, p.memberId),
    run(ctx, p) {
      const m = memberOf(ctx.w, p.memberId);
      const c = ctx.w.chapters[p.chapterId]!;
      if (m.chapterId === p.chapterId) return noop(`Already in ${c.city}.`);
      const old = m.chapterId;
      if (old) {
        const prev = ctx.w.chapters[old]!;
        prev.members = prev.members.filter((x) => x !== m.id);
        if (prev.organizers.includes(m.id)) {
          prev.organizers = prev.organizers.filter((x) => x !== m.id);
          ctx.note("apply", "info", `${m.name} no longer organizes ${prev.city}.`);
        }
      }
      c.members.push(m.id);
      m.chapterId = p.chapterId;
      refreshChapters(ctx.w, old ? [old, p.chapterId] : [p.chapterId]);
      return ok(`${m.name} joined ${c.name}.`);
    },
  },
  LEAVE_CHAPTER: {
    roles: MEMBER_ROLES,
    owns: (w, a, p) => self(w, a, p.memberId),
    run(ctx, p) {
      const m = memberOf(ctx.w, p.memberId);
      if (!m.chapterId) return noop("Not in a chapter.");
      const old = ctx.w.chapters[m.chapterId]!;
      old.members = old.members.filter((x) => x !== m.id);
      if (old.organizers.includes(m.id)) {
        old.organizers = old.organizers.filter((x) => x !== m.id);
        ctx.note("apply", "info", `${m.name} stepped down as an organizer of ${old.city}.`);
      }
      m.chapterId = null;
      refreshChapters(ctx.w, [old.id]);
      return ok(`${m.name} left ${old.name}. Their miles still count for them.`);
    },
  },
  RSVP: {
    roles: MEMBER_ROLES,
    owns: (w, a, p) => self(w, a, p.memberId),
    run(ctx, p) {
      const e = eventOf(ctx.w, p.eventId);
      const m = memberOf(ctx.w, p.memberId);
      if (e.status === "cancelled") return reject("policy", `${e.title} was cancelled${e.cancelReason ? `: ${e.cancelReason}` : ""}.`);
      if (e.status !== "published") return reject("policy", `${e.title} isn't published yet.`);
      if (e.day * 1440 + e.startMinute < ctx.w.clock) return reject("policy", `${e.title} already started.`);
      if (e.rsvps.includes(m.id) || e.waitlist.includes(m.id)) return noop(`${m.name} is already on the list.`);
      const going = e.rsvps.length + e.backgroundRsvps;
      if (going >= e.capacity) {
        e.waitlist.push(m.id);
        return ok(`${e.title} is full; ${m.name} is #${e.waitlist.length} on the waitlist.`);
      }
      e.rsvps.push(m.id);
      const needs = decide("access-needs", "organizer-roster", m.consents);
      ctx.note("apply", "info", `The organizer's roster shows “${m.name}”${needs.allow ? " and the access needs they chose to share" : ""}. No activity data.`, "OURS-ROSTER");
      return ok(`${m.name} is going to ${e.title}.`);
    },
  },
  CANCEL_RSVP: {
    roles: MEMBER_ROLES,
    owns: (w, a, p) => self(w, a, p.memberId),
    run(ctx, p) {
      const e = eventOf(ctx.w, p.eventId);
      if (e.waitlist.includes(p.memberId)) {
        e.waitlist = e.waitlist.filter((x) => x !== p.memberId);
        return ok("Left the waitlist.");
      }
      if (!e.rsvps.includes(p.memberId)) return noop("Wasn't going.");
      e.rsvps = e.rsvps.filter((x) => x !== p.memberId);
      const promoted = e.waitlist.shift();
      if (promoted) {
        e.rsvps.push(promoted);
        ctx.note("apply", "info", `${memberOf(ctx.w, promoted).name} moved up from the waitlist.`);
      }
      return ok(`RSVP cancelled for ${e.title}.${promoted ? ` ${memberOf(ctx.w, promoted).name} got the spot.` : ""}`);
    },
  },
  INVITE_FRIEND: {
    roles: MEMBER_ROLES,
    owns: (w, a, p) => self(w, a, p.memberId),
    run(ctx, p) {
      const m = memberOf(ctx.w, p.memberId);
      m.invitesSent += 1;
      return ok(`Invite link made (${m.invitesSent}). Nothing was sent; the member shares it themselves.`);
    },
  },
  TOGGLE_STORY_CARD: {
    roles: MEMBER_ROLES,
    owns: (w, a, p) => self(w, a, p.memberId),
    run(ctx, p) {
      const m = memberOf(ctx.w, p.memberId);
      m.storyCardDrafted = !m.storyCardDrafted;
      return ok(m.storyCardDrafted ? "Story card drafted. City-level only, no map, no pace." : "Story card draft cleared.");
    },
  },
  ASK_COACH: {
    roles: MEMBER_ROLES,
    owns: (w, a, p) => self(w, a, p.memberId),
    run(ctx, p) {
      const id = nextId(ctx.w, "q");
      const a = answer(ctx.w, p.memberId, p.question, ctx.w.coach.activeRuleset, ctx.w.coach.drift, id, p.ai);
      ctx.w.coach.answers[id] = a;
      ctx.w.coach.sessions.push({ id, memberId: p.memberId, question: p.question, at: ctx.at, ruleset: a.ruleset, answerId: id });
      ctx.fact("intent", a.intent);
      ctx.fact("safety", a.safety);
      // The member's words and the phrases that matched stay with the member, not in the audit trail.
      ctx.note("reconcile", "info", `Intent ${a.intent}, safety ${a.safety}, ruleset ${a.ruleset}.`);
      for (const ex of a.context.excluded) ctx.note("policy", "pass", `${ex.records} ${ex.source} record${ex.records === 1 ? "" : "s"} kept out of the coach's context.`, ex.ruleId);
      if (a.rejectedDraft) ctx.note("policy", "fail", `Validator rejected the draft (${a.rejectedDraft.failed.join(", ")}); safe fallback sent instead.`);
      if (a.generator === "ai-model") ctx.note("policy", "pass", `AI draft (${a.model}) passed every check; facts are approved tips.`);
      return ok(a.rejectedDraft ? "QUANTUM caught an unsafe draft and sent a safe answer." : a.generator === "ai-model" ? `QUANTUM answered with AI (${a.intent}).` : `QUANTUM answered (${a.intent}).`);
    },
  },
  SAVE_NEXT_STEP: {
    roles: MEMBER_ROLES,
    owns: (w, a, p) => self(w, a, p.memberId),
    run(ctx, p) {
      const a = ctx.w.coach.answers[p.answerId];
      if (!a || a.memberId !== p.memberId) return reject("authorize", "That answer isn't yours.");
      if (!a.nextStep) return reject("policy", "That answer proposed no step.");
      memberOf(ctx.w, p.memberId).savedStep = { text: a.nextStep.label, cardId: a.nextStep.cardId, savedAt: ctx.at };
      return ok(`Saved: ${a.nextStep.label}.`);
    },
  },
  CLEAR_NEXT_STEP: {
    roles: MEMBER_ROLES,
    owns: (w, a, p) => self(w, a, p.memberId),
    run(ctx, p) {
      const m = memberOf(ctx.w, p.memberId);
      if (!m.savedStep) return noop("Nothing saved.");
      m.savedStep = null;
      return ok("Saved step cleared.");
    },
  },
  FORGET_COACH_HISTORY: {
    roles: MEMBER_ROLES,
    owns: (w, a, p) => self(w, a, p.memberId),
    run(ctx, p) {
      const mine = ctx.w.coach.sessions.filter((s) => s.memberId === p.memberId);
      if (!mine.length) return noop("Nothing to forget.");
      for (const s of mine) delete ctx.w.coach.answers[s.answerId];
      ctx.w.coach.sessions = ctx.w.coach.sessions.filter((s) => s.memberId !== p.memberId);
      ctx.note("apply", "info", "Questions and answers deleted. The log keeps only what the engine derived (intent and safety), never the words.", "WA-02");
      return ok(`${mine.length} coach conversation${mine.length === 1 ? "" : "s"} forgotten.`);
    },
  },
  VOTE_PROGRAM: {
    roles: MEMBER_ROLES,
    owns: (w, a, p) => self(w, a, p.memberId),
    run(ctx, p) {
      const prog = ctx.w.programs[p.programId]!;
      if (prog.stage !== "community-review" && prog.stage !== "proposed") return reject("policy", "Voting has closed for this program.");
      if (prog.votes.includes(p.memberId)) return noop("Already voted.");
      prog.votes.push(p.memberId);
      return ok(`${memberOf(ctx.w, p.memberId).name} backed “${prog.name}”.`);
    },
  },
  REDEEM_OFFER: {
    roles: MEMBER_ROLES,
    owns: (w, a, p) => self(w, a, p.memberId),
    run(ctx, p) {
      const prop = ctx.w.proposals[p.proposalId]!;
      if (!LIVE_STAGES.has(prop.stage)) return reject("policy", "This offer isn't live.");
      const code = p.code.toUpperCase();
      if (!prop.issuedCodes.includes(code)) return reject("input", `${code} isn't a code this program issued.`);
      if (prop.redemptions.some((r) => r.code === code)) {
        ctx.note("reconcile", "pass", `Code ${code} was redeemed before. Single-use codes redeem once.`);
        return noop(`Code ${code} already redeemed. No second redemption.`);
      }
      if (prop.redemptions.some((r) => r.memberId === p.memberId)) return noop("One offer per member.");
      prop.redemptions.push({ memberId: p.memberId, code, at: ctx.at });
      return ok(`Offer redeemed with ${code}. The partner sees a count, not a name.`);
    },
  },
  OFFER_CLICK: {
    roles: MEMBER_ROLES,
    owns: (w, a, p) => self(w, a, p.memberId),
    run(ctx, p) {
      const prop = ctx.w.proposals[p.proposalId]!;
      if (!LIVE_STAGES.has(prop.stage)) return reject("policy", "This offer isn't live.");
      if (prop.offerClickers.includes(p.memberId)) return noop("Already counted; a member counts once.");
      prop.offerClickers.push(p.memberId);
      prop.offerClicks += 1;
      return ok("Offer interaction counted once. Voluntary, and never tied to workout data.");
    },
  },

  DRAFT_EVENT: {
    roles: ["member", "organizer", "founder"],
    run(ctx, p) {
      if (p.day * 1440 + p.startMinute < ctx.w.clock) return reject("input", "Pick a time that hasn't passed.");
      const id = nextId(ctx.w, `ev-${p.chapterId}`);
      ctx.w.events[id] = {
        id,
        chapterId: p.chapterId,
        title: p.title,
        mode: p.mode,
        day: p.day,
        startMinute: p.startMinute,
        meetingArea: p.meetingArea,
        distanceOptions: p.distanceOptions,
        paceNote: "Every pace. A sweep finishes at the back.",
        access: p.access,
        capacity: p.capacity,
        rsvps: [],
        waitlist: [],
        checkIns: [],
        backgroundRsvps: 0,
        backgroundAttended: null,
        status: "draft",
        createdBy: ctx.actor.id,
        sweep: null,
        fundedBy: null,
      };
      return ok(`Draft saved: “${p.title}”. Nothing is public until an organizer publishes it.`);
    },
  },
  SUBMIT_EVENT: {
    roles: ["member", "organizer", "founder"],
    owns: (w, a, p) => (a.role === "founder" || w.events[p.eventId]?.createdBy === a.id ? null : "Only the person who drafted it can submit it."),
    run(ctx, p) {
      const e = eventOf(ctx.w, p.eventId);
      if (e.status !== "draft") return noop(`Already ${e.status}.`);
      e.status = "submitted";
      return ok(`“${e.title}” sent to the ${ctx.w.chapters[e.chapterId]!.city} organizer for review.`);
    },
  },
  ASSIGN_SWEEP: {
    roles: ORGANIZER_ROLES,
    owns: (w, a, p) => organizes(w, a, w.events[p.eventId]?.chapterId),
    run(ctx, p) {
      const e = eventOf(ctx.w, p.eventId);
      if (e.status === "cancelled" || e.status === "completed") return reject("policy", `It's ${e.status}.`);
      if (!ctx.w.chapters[e.chapterId]!.members.includes(p.memberId)) return reject("policy", `${nameOf(ctx.w, p.memberId)} isn't in this circle.`);
      e.sweep = p.memberId;
      return ok(`${memberOf(ctx.w, p.memberId).name} will finish at the back of “${e.title}”.`);
    },
  },
  PUBLISH_EVENT: {
    roles: ORGANIZER_ROLES,
    owns: (w, a, p) => organizes(w, a, w.events[p.eventId]?.chapterId),
    run(ctx, p) {
      const e = eventOf(ctx.w, p.eventId);
      if (e.status === "published") return noop("Already published.");
      if (e.status === "cancelled" || e.status === "completed") return reject("policy", `It's ${e.status}.`);
      if (!e.sweep) return block(`“${e.title}” has no sweep. Assign someone to finish at the back first.`, "WELCOME-SWEEP");
      ctx.note("policy", "pass", `Sweep assigned: ${memberOf(ctx.w, e.sweep).name}.`, "WELCOME-SWEEP");
      e.status = "published";
      return ok(`“${e.title}” is live for members.`);
    },
  },
  CANCEL_EVENT: {
    roles: ORGANIZER_ROLES,
    owns: (w, a, p) => organizes(w, a, w.events[p.eventId]?.chapterId),
    run(ctx, p) {
      const e = eventOf(ctx.w, p.eventId);
      if (e.status === "cancelled") return noop("Already cancelled.");
      if (e.status === "completed") return reject("policy", "It already happened.");
      e.status = "cancelled";
      e.cancelReason = p.reason;
      const affected = e.rsvps.length + e.backgroundRsvps;
      if (e.fundedBy) ctx.note("apply", "info", `Funded by ${ctx.w.partners[ctx.w.proposals[e.fundedBy]!.partnerId]!.name}: one fewer deliverable until it's rerun.`);
      return ok(`“${e.title}” cancelled (${p.reason}). ${affected} people would be told.`);
    },
  },
  CHECK_IN: {
    roles: ORGANIZER_ROLES,
    owns: (w, a, p) => organizes(w, a, w.events[p.eventId]?.chapterId),
    run(ctx, p) {
      const e = eventOf(ctx.w, p.eventId);
      const start = e.day * 1440 + e.startMinute;
      if (e.status !== "published") return reject("policy", `Can't check in: the event is ${e.status}.`);
      if (ctx.w.clock < start) return reject("policy", "The event hasn't started yet.");
      if (ctx.w.clock > start + 6 * 60) return reject("policy", "Check-in closes six hours after the start.");
      if (!e.distanceOptions.some((d) => Math.abs(d - p.distanceMi) < 0.05)) return reject("input", `This event offers ${e.distanceOptions.join(" or ")} mi.`);
      if (e.checkIns.some((c) => c.memberId === p.memberId)) return noop("Already checked in.");
      const m = memberOf(ctx.w, p.memberId);
      if (!e.rsvps.includes(m.id)) ctx.note("reconcile", "info", `${m.name} walked up without an RSVP; checked in and flagged as a walk-up.`);
      const firstEvent = !Object.values(ctx.w.events).some((x) => x.checkIns.some((c) => c.memberId === p.memberId));
      e.checkIns.push({ memberId: p.memberId, distanceMi: p.distanceMi, firstEvent });
      if (firstEvent && !m.stamps.some((s) => s.kind === "first-event")) m.stamps.push({ kind: "first-event", at: ctx.at });
      const result = ingest(ctx, {
        memberId: p.memberId,
        source: "event_checkin",
        externalId: `checkin:${e.id}:${p.memberId}`,
        version: 1,
        distanceMi: p.distanceMi,
        mode: m.moves[0] ?? "walk",
        startedAt: start,
        durationMin: Math.round(p.distanceMi * 18),
        eventId: e.id,
      });
      return result.outcome === "applied" ? ok(`${m.name} checked in at “${e.title}” (${p.distanceMi} mi${firstEvent ? ", first event" : ""}).`) : result;
    },
  },
  COMPLETE_EVENT: {
    roles: ORGANIZER_ROLES,
    owns: (w, a, p) => organizes(w, a, w.events[p.eventId]?.chapterId),
    run(ctx, p) {
      const e = eventOf(ctx.w, p.eventId);
      if (e.status !== "published") return reject("policy", `It's ${e.status}.`);
      if (ctx.w.clock < e.day * 1440 + e.startMinute) return reject("policy", "The event hasn't happened yet.");
      e.status = "completed";
      e.backgroundAttended = Math.round(e.backgroundRsvps * 0.8);
      if (e.sweep && e.checkIns.some((c) => c.firstEvent)) {
        const sweep = ctx.w.members[e.sweep];
        if (sweep && !sweep.stamps.some((s) => s.kind === "welcomed-someone")) sweep.stamps.push({ kind: "welcomed-someone", at: ctx.at });
      }
      return ok(`“${e.title}” completed: ${e.checkIns.length} checked in by name, ${e.backgroundAttended} modelled.`);
    },
  },

  SET_PROPOSAL_INPUT: {
    roles: ["founder"],
    run(ctx, p) {
      const prop = ctx.w.proposals[p.proposalId]!;
      if (prop.signedAt !== null) return reject("policy", "Signed contracts can't be edited. Renew with new terms instead.");
      if (p.key === "fee" && p.value < 500) return reject("input", "A fee under $500 isn't a program.");
      if ((p.key === "communities" || p.key === "eventsPerCommunity") && (p.value < 1 || !Number.isInteger(p.value))) return reject("input", "Use a whole number of at least 1.");
      if (p.key === "impactPct" && p.value > 50) return reject("input", "Impact share is capped at 50% in this model.");
      const before = economics(prop.inputs).contribution;
      prop.inputs = { ...prop.inputs, [p.key]: p.value };
      const after = economics(prop.inputs);
      for (const f of after.flags) ctx.note("policy", f.severity === "block" ? "fail" : "info", f.text);
      return ok(`${p.key} → ${p.value}. Contribution after impact ${usd(before)} → ${usd(after.contribution)}.`);
    },
  },
  SET_PROPOSAL_CHAPTERS: {
    roles: ["founder"],
    run(ctx, p) {
      const prop = ctx.w.proposals[p.proposalId]!;
      if (prop.signedAt !== null) return reject("policy", "Signed contracts can't be edited.");
      if (new Set(p.chapterIds).size !== p.chapterIds.length) return reject("input", "Each chapter can be chosen once.");
      prop.chapterIds = p.chapterIds;
      return ok(`Cities in this deal: ${p.chapterIds.map((c) => ctx.w.chapters[c]!.city).join(", ") || "none"}.`);
    },
  },
  ADVANCE_DEAL: {
    roles: ["founder"],
    run(ctx, p) {
      const prop = ctx.w.proposals[p.proposalId]!;
      const partner = ctx.w.partners[prop.partnerId]!;
      const i = DEAL_STAGES.indexOf(prop.stage);
      if (prop.stage === "lost" || i === DEAL_STAGES.length - 1) return noop(`Deal is ${prop.stage}.`);
      const next = DEAL_STAGES[i + 1]!;
      if (next === "contract") {
        const e = economics(prop.inputs);
        const chapters = [...new Set(prop.chapterIds)];
        if (chapters.length < prop.inputs.communities) return reject("policy", `Choose ${prop.inputs.communities} different chapter${prop.inputs.communities === 1 ? "" : "s"} to deliver in before signing.`);
        const leaderless = chapters.filter((c) => ctx.w.chapters[c]!.organizers.length === 0);
        if (leaderless.length) return reject("policy", `${leaderless.map((c) => ctx.w.chapters[c]!.city).join(", ")} has no organizer to deliver it.`);
        const lastDay = Math.max(...campaignSchedule(ctx.at, prop).map((s) => s.day));
        if (lastDay > SEASON.days - 1) return reject("policy", "One event a week from now runs past August 31. Fewer events per chapter, or sign earlier.");
        const blocking = e.flags.filter((f) => f.severity === "block");
        if (blocking.length) {
          if (!p.override || p.override.length < 10) return block(`${blocking.map((f) => f.text).join(" ")}`, "COMMERCIAL-OVERRIDE");
          prop.override = p.override;
          ctx.note("policy", "info", `Signed below zero with a written override: “${p.override}”. Its impact share stays unfunded.`, "COMMERCIAL-OVERRIDE");
        } else ctx.note("policy", "pass", `Contribution after impact ${usd(e.contribution)} (${e.marginPct}%).`);
        prop.signedAt = ctx.at;
        ctx.note("apply", "info", `${usd(e.impact)} of impact is promised; it becomes money when the partner pays.`, "IMPACT-POOL");
      }
      if (next === "live") {
        prop.fundedEventIds = launchCampaign(ctx, prop);
        prop.issuedCodes = offerCodes(partner.name);
        ctx.note("apply", "info", `${prop.fundedEventIds.length} funded events created as submissions, with no access claims and no sweep yet; organizers check each site and publish. 20 single-use offer codes issued.`);
      }
      if (next === "reported") {
        const report = campaignReport(ctx.w, prop.id);
        if (report.eventsCompleted === 0) return reject("policy", "Nothing to report until a funded event has happened.");
        prop.reportedAt = ctx.at;
        ctx.w.egress.push({
          seq: ctx.w.egress.length + 1,
          at: ctx.at,
          recipient: partner.name,
          purpose: "partner-report",
          ruleIds: ["OURS-COUNTS-NOT-PEOPLE", "OURS-SMALL-GROUPS"],
          lineage: ["event_checkin"],
          what: `Campaign report: ${report.eventsCompleted} events, ${report.attendance} checked in by name, first-timers ${report.firstTimers}.`,
        });
        ctx.note("audit", "info", "Report written to the egress log.", "X-04");
      }
      if (next === "renewed") {
        const report = campaignReport(ctx.w, prop.id);
        const rate = report.eventsPlanned ? report.eventsCompleted / report.eventsPlanned : 0;
        if (rate < 0.6) return reject("policy", `Renewal unlikely: ${report.eventsCompleted} of ${report.eventsPlanned} funded events delivered.`);
      }
      prop.stage = next;
      return ok(`${partner.name}: ${DEAL_STAGES[i]} → ${next}.`);
    },
  },
  RECORD_PAYMENT: {
    roles: ["founder"],
    run(ctx, p) {
      const prop = ctx.w.proposals[p.proposalId]!;
      if (prop.signedAt === null) return reject("policy", "Nothing is owed before a contract is signed.");
      if (prop.paidAt !== null) return noop("Payment already recorded.");
      prop.paidAt = ctx.at;
      const e = economics(prop.inputs);
      const funds = e.contribution >= 0;
      ctx.note("policy", funds ? "pass" : "info", funds ? `${usd(e.impact)} enters the impact pool.` : "This contract loses money, so its impact promise can't be funded from it.", "IMPACT-POOL");
      return ok(`${ctx.w.partners[prop.partnerId]!.name} paid ${usd(prop.inputs.fee)}.`);
    },
  },
  MARK_DEAL_LOST: {
    roles: ["founder"],
    run(ctx, p) {
      const prop = ctx.w.proposals[p.proposalId]!;
      if (prop.signedAt !== null) return reject("policy", "A signed contract isn't lost; it's delivered or cancelled by agreement.");
      prop.stage = "lost";
      return ok(`${ctx.w.partners[prop.partnerId]!.name}: lost (${p.reason}).`);
    },
  },
  PARTNER_DATA_REQUEST: {
    roles: ["partner", "founder"],
    owns: (w, a, p) => (a.role === "founder" || w.proposals[p.proposalId]?.partnerId === a.id ? null : "Partners can only ask about their own program."),
    run(ctx, p) {
      const prop = ctx.w.proposals[p.proposalId]!;
      const partner = ctx.w.partners[prop.partnerId]!;
      if (p.override) ctx.note("policy", "info", "An override was supplied. Overrides apply to commercial rules only; data rules have none.", "FTC-02");
      switch (p.request) {
        case "aggregate-attendance": {
          if (!LIVE_STAGES.has(prop.stage)) return reject("policy", "No program is running yet, so there is nothing to report.");
          const d = decide("participation", "partner-report");
          const report = campaignReport(ctx.w, prop.id);
          ctx.w.egress.push({ seq: ctx.w.egress.length + 1, at: ctx.at, recipient: partner.name, purpose: "partner-report", ruleIds: [d.ruleId, "OURS-SMALL-GROUPS"], lineage: ["event_checkin"], what: `${report.attendance} checked in by name across ${report.eventsCompleted} completed events.` });
          ctx.note("policy", "pass", "Counts of named, organizer-recorded check-ins at funded events. Small groups suppressed. Modelled crowds are never reported as people.", d.ruleId);
          return ok(`${partner.name} received check-in counts (${report.attendance}).`);
        }
        case "participant-list":
          return block("Partners get counts, never people. A member list would be an unauthorised disclosure.", "OURS-COUNTS-NOT-PEOPLE");
        case "activity-history": {
          const rules = new Set<string>();
          for (const src of ["strava", "healthkit", "health_connect", "garmin", "manual"] as ActivitySource[]) rules.add(decide(`activity:${src}`, "partner-export").ruleId);
          for (const r of rules) ctx.note("policy", "fail", ruleFor(r).title, r);
          return block("Per-member activity can't go to a partner from any source.", "STRAVA-02");
        }
        case "health-audience": {
          for (const r of ["STRAVA-08", "APPLE-02", "HC-02", "OURS-NO-ADS"]) ctx.note("policy", "fail", ruleFor(r).title, r);
          return block("No audience built from movement data. A partner sponsors programs, not people's health data.", "OURS-NO-ADS");
        }
        case "optin-contacts": {
          if (!LIVE_STAGES.has(prop.stage)) return reject("policy", "No program is running yet.");
          const count = Object.values(ctx.w.members).filter((m) => m.consents.partnerContact.includes(partner.id)).length;
          if (count === 0) return noop(`No member has chosen to share an email with ${partner.name}.`, "OURS-OPTIN-CONTACT");
          ctx.w.egress.push({ seq: ctx.w.egress.length + 1, at: ctx.at, recipient: partner.name, purpose: "partner-export", ruleIds: ["OURS-OPTIN-CONTACT"], lineage: [], what: `${count} email address${count === 1 ? "" : "es"} members chose to share.` });
          return ok(`${count} opted-in contact${count === 1 ? "" : "s"} shared with ${partner.name}.`);
        }
      }
    },
  },
  SELECT_PROGRAM: {
    roles: ["founder", "member", "organizer"],
    run(ctx, p) {
      if (ctx.w.impact.selectedProgram === p.programId) return noop("Already selected.");
      ctx.w.impact.selectedProgram = p.programId;
      return ok(`Showing “${ctx.w.programs[p.programId]!.name}”.`);
    },
  },
  ADVANCE_PROGRAM: {
    roles: ["founder"],
    run(ctx, p) {
      const prog = ctx.w.programs[p.programId]!;
      const i = IMPACT_STAGES.indexOf(prog.stage);
      if (i === IMPACT_STAGES.length - 1) return noop("Already verified.");
      const next = IMPACT_STAGES[i + 1]!;
      if (next === "approved") {
        const votes = prog.votes.length + prog.backgroundVotes;
        if (votes < 10) return block(`Only ${votes} members have backed it; community review needs 10.`, "IMPACT-EVIDENCE");
        ctx.note("policy", "pass", `${votes} members backed it.`);
      }
      if (next === "funded") {
        const pool = impactPool(ctx.w);
        if (pool.available < prog.cost) {
          const waiting = pool.awaitingPayment > 0 ? ` ${usd(pool.awaitingPayment)} is signed but not yet paid.` : "";
          const promised = pool.pipeline > 0 ? ` ${usd(pool.pipeline)} is only promised in unsigned proposals.` : "";
          return block(`The paid impact pool has ${usd(pool.available)} available; this needs ${usd(prog.cost)}.${waiting}${promised}`, "IMPACT-POOL");
        }
        prog.funded = prog.cost;
        prog.fundedAt = ctx.at;
        ctx.w.impact.disbursed += prog.cost;
        ctx.note("policy", "pass", `${usd(prog.cost)} from paid contracts.`, "IMPACT-POOL");
      }
      if (next === "delivered") {
        const claimed = new Set(
          Object.values(ctx.w.programs)
            .filter((x) => x.id !== prog.id)
            .flatMap((x) => x.evidenceEventIds),
        );
        // An event is proof for one funder: a walk a partner already paid for can't also prove impact money.
        const evidence = Object.values(ctx.w.events).filter(
          (e) =>
            prog.chapterIds.includes(e.chapterId) &&
            e.status === "completed" &&
            e.fundedBy === null &&
            prog.fundedAt !== null &&
            e.day * 1440 + e.startMinute >= prog.fundedAt &&
            !claimed.has(e.id),
        );
        if (!evidence.length)
          return block(
            "No completed event in this program's chapters has happened since it was funded and isn't already proof for another program or a partner's campaign.",
            "IMPACT-EVIDENCE",
          );
        prog.evidenceEventIds = evidence.map((e) => e.id);
      }
      if (next === "verified") {
        const named = prog.evidenceEventIds.reduce((s, id) => s + (ctx.w.events[id]?.checkIns.length ?? 0), 0);
        if (named < 10) return block(`Evidence shows ${named} ${named === 1 ? "person" : "people"} checked in by name; verification needs 10. Modelled crowds don't count.`, "IMPACT-EVIDENCE");
        ctx.note("policy", "pass", `${named} named check-ins across ${prog.evidenceEventIds.length} event${prog.evidenceEventIds.length === 1 ? "" : "s"}.`, "IMPACT-EVIDENCE");
      }
      prog.stage = next;
      return ok(`“${prog.name}”: ${IMPACT_STAGES[i]} → ${next}.`);
    },
  },
  SET_SCENARIO: {
    roles: ["founder"],
    run(ctx, p) {
      if (p.key === "year") {
        if (p.value !== 2027 && p.value !== 2028 && p.value !== 2029) return reject("input", "Year must be 2027, 2028 or 2029.");
        ctx.w.scenario.year = p.value;
      } else ctx.w.scenario[p.key] = p.value;
      return ok(`Scenario ${p.key} = ${p.value}.`);
    },
  },

  PROPOSE_RULESET: {
    roles: ["engineer", "founder"],
    run(ctx, p) {
      if (p.version === ctx.w.coach.activeRuleset) return noop(`${p.version} is already active.`);
      ctx.w.coach.candidate = { version: p.version, approvals: [] };
      return ok(`Ruleset ${p.version} proposed. It needs content and engineering approval and a clean regression run.`);
    },
  },
  APPROVE_RULESET: {
    roles: ["engineer", "founder"],
    run(ctx, p) {
      const cand = ctx.w.coach.candidate;
      if (!cand) return reject("policy", "No ruleset is waiting for approval.");
      if (p.as === "content" && ctx.actor.role !== "founder") return reject("authorize", "Content approval belongs to the founder.");
      if (p.as === "engineering" && ctx.actor.role !== "engineer") return reject("authorize", "Engineering approval belongs to the engineering lead.");
      if (cand.approvals.includes(p.as)) return noop(`${p.as} already approved.`);
      cand.approvals.push(p.as);
      if (cand.approvals.length < 2) return ok(`${p.as} approval recorded for ${cand.version}. Waiting on the other.`);
      const gate = releaseGate(ctx.w.coach.activeRuleset, cand.version);
      ctx.note("policy", gate.pass ? "pass" : "fail", gate.reason, "RULESET-GATE");
      // Reported every time, never folded into the line above: "no regressions" must not read as "safe".
      ctx.note("policy", gate.safety.pass ? "pass" : "info", gate.safety.reason, "SAFETY-GATE");
      if (!gate.pass) {
        ctx.w.coach.candidate = null;
        return block(`Release gate refused ${cand.version}: ${gate.reason}`, "RULESET-GATE");
      }
      const from = ctx.w.coach.activeRuleset;
      ctx.w.coach.activeRuleset = cand.version;
      ctx.w.coach.candidate = null;
      return ok(`QUANTUM ruleset ${from} → ${cand.version}. ${gate.reason}`);
    },
  },
  SET_DRIFT: {
    roles: ["engineer"],
    run(ctx, p) {
      if (ctx.w.coach.drift === p.on) return noop("No change.");
      ctx.w.coach.drift = p.on;
      return ok(p.on ? "Fault on: the drafting step now produces unsafe text. Watch the validator." : "Drafting fault cleared.");
    },
  },

  PROVIDER_DELIVERY: {
    roles: ["provider", "engineer", "system"],
    // Invariant 4: a provider speaks only for itself.
    owns: (w, a, p) => (a.role === "provider" && a.id !== p.provider ? `${a.id} can't deliver ${p.provider} data.` : null),
    run(ctx, p) {
      const m = memberOf(ctx.w, p.memberId);
      const strava = p.provider === "strava";
      const c = m.connections[p.provider];
      if (c.status !== "connected") {
        const rule = strava ? "STRAVA-06" : p.provider === "healthkit" ? "APPLE-06" : "OURS-DISCONNECT";
        return reject("authorize", `${m.name} ${c.status === "revoked" ? "disconnected" : "never connected"} ${p.provider}. Delivery refused.`, rule);
      }
      if (p.timeout) {
        const key = `${p.provider}:${p.externalId}:v${p.version}`;
        if (!ctx.w.pendingRetries.some((r) => r.key === key)) {
          const { timeout: _t, ...retry } = p;
          ctx.w.pendingRetries.push({ key, command: retry });
        }
        return { outcome: "deferred", summary: `${p.provider} timed out. Queued for retry; a retry can apply at most once.`, stage: "input" };
      }
      c.lastDeliveryAt = ctx.at;
      if (p.op === "delete") {
        const a = Object.values(ctx.w.activities).find((x) => x.memberId === m.id && x.source === p.provider && x.externalId === p.externalId);
        if (!a || a.status === "purged") return noop("Nothing to delete.");
        removeRecord(a, `Deleted on ${p.provider}.`, strava ? "STRAVA-06" : "OURS-DISCONNECT", ctx.at);
        touched(ctx, a.memberId);
        return ok(`Deletion on ${p.provider} mirrored here.`);
      }
      // A Strava entry whose data was erased from the log replays as the record it was, without the data.
      const shredded = strava && p.externalId.startsWith(STRAVA_SHREDDED);
      const wasQuarantined = shredded && p.externalId.endsWith(":q");
      const invalid = p.distanceMi === null || !Number.isFinite(p.distanceMi) || p.distanceMi <= 0 || p.distanceMi > 60;
      // A bad record sent again is the same bad record: one key, one quarantined row.
      const requarantine = () =>
        Object.values(ctx.w.activities).some(
          (x) => x.memberId === m.id && x.source === p.provider && x.externalId === p.externalId && x.status === "quarantined" && x.version >= p.version,
        );
      if (wasQuarantined || (!shredded && invalid)) {
        if (requarantine()) return noop(`${p.provider} sent that record again. It stays quarantined, once.`);
        const id = nextId(ctx.w, "a");
        ctx.w.activities[id] = {
          id,
          memberId: m.id,
          source: p.provider,
          externalId: p.externalId,
          version: p.version,
          distanceMi: 0,
          mode: strava ? "walk" : p.mode,
          startedAt: strava ? 0 : p.startedAt,
          durationMin: strava ? 0 : p.durationMin,
          status: "quarantined",
          receivedAt: ctx.at,
          removal: { reason: "Delivery had no usable distance.", ruleId: "OWNER", at: ctx.at },
        };
        return { outcome: "quarantined", summary: `${p.provider} sent a record with no usable distance. Quarantined; counted nowhere.`, stage: "input" };
      }
      const distanceMi = shredded ? 0 : round1(p.distanceMi!);
      if (!strava) {
        const odd = implausible(ctx.w, m.id, distanceMi, p.durationMin, p.mode, p.startedAt);
        if (odd) {
          if (requarantine()) return noop(`${p.provider} sent that record again. It stays quarantined, once.`);
          const id = nextId(ctx.w, "a");
          ctx.w.activities[id] = {
            id,
            memberId: m.id,
            source: p.provider,
            externalId: p.externalId,
            version: p.version,
            distanceMi: 0,
            mode: p.mode,
            startedAt: p.startedAt,
            durationMin: p.durationMin,
            status: "quarantined",
            receivedAt: ctx.at,
            removal: { reason: odd, ruleId: "OWNER", at: ctx.at },
          };
          return { outcome: "quarantined", summary: `${p.provider} sent an implausible record: ${odd} Quarantined.`, stage: "input" };
        }
        ctx.note("input", "pass", `${p.provider} ${p.externalId} v${p.version}: ${distanceMi} mi.`);
      } else ctx.note("input", "pass", `Strava delivery v${p.version} for ${m.name}.`);
      return ingest(ctx, {
        memberId: m.id,
        source: p.provider,
        externalId: p.externalId,
        version: p.version,
        distanceMi,
        mode: shredded ? "walk" : p.mode,
        startedAt: shredded ? 0 : p.startedAt,
        durationMin: shredded ? 1 : p.durationMin,
      });
    },
  },
  RETRY_PENDING: {
    roles: ["system", "engineer"],
    run(ctx) {
      const pending = ctx.w.pendingRetries;
      if (!pending.length) return noop("Nothing waiting to retry.");
      ctx.w.pendingRetries = [];
      const results: string[] = [];
      for (const r of pending) {
        const parsed = schemas.PROVIDER_DELIVERY.safeParse(r.command);
        if (!parsed.success) continue;
        const res = handlers.PROVIDER_DELIVERY.run(ctx, parsed.data);
        results.push(`${parsed.data.provider} v${parsed.data.version}: ${res.outcome}`);
      }
      return ok(`Retried ${pending.length}: ${results.join("; ")}.`);
    },
  },
  ADVANCE_CLOCK: {
    roles: ["system", "founder", "engineer"],
    run(ctx, p) {
      const end = tick(SEASON.days - 1, 1439);
      if (p.to < ctx.w.clock) return reject("input", "Time only moves forward. Use replay to go back.");
      const to = Math.min(p.to, end);
      if (to === ctx.w.clock) return noop("Clock unchanged.");
      ctx.w.clock = to;
      let expired = 0;
      for (const a of Object.values(ctx.w.activities)) {
        if (a.source === "strava" && a.status === "owner-panel" && a.expiresAt !== undefined && a.expiresAt <= to) {
          removeRecord(a, "7-day Strava cache expired.", "STRAVA-05", to);
          expired++;
        }
      }
      if (expired) ctx.note("policy", "pass", `${expired} Strava record${expired === 1 ? "" : "s"} expired from the 7-day cache and deleted.`, "STRAVA-05");
      return ok(`Clock moved forward.${expired ? ` ${expired} Strava record${expired === 1 ? "" : "s"} expired.` : ""}`);
    },
  },
  CORRUPT_PROJECTION: {
    roles: ["engineer"],
    run(ctx, p) {
      const before = ctx.w.projections.chapterSharedMiles[p.chapterId] ?? 0;
      ctx.w.projections.chapterSharedMiles[p.chapterId] = round1(before + p.delta);
      return ok(`Fault: the cached ${ctx.w.chapters[p.chapterId]!.city} total was written as ${round1(before + p.delta)} without touching any activity.`);
    },
  },
  REBUILD_PROJECTIONS: {
    roles: ["engineer", "system"],
    run(ctx) {
      rebuildProjections(ctx.w);
      return ok("Every read model rebuilt from the activity table.");
    },
  },
  RECORD_EXPORT: {
    roles: ["engineer", "founder"],
    run(ctx, p) {
      ctx.w.egress.push({ seq: ctx.w.egress.length + 1, at: ctx.at, recipient: p.recipient, purpose: "staff-export", ruleIds: ["X-04"], lineage: p.lineage, what: p.what });
      return ok(`Export recorded in the egress log: ${p.what}`);
    },
  },
};

// ── Reference check (invariant 1: bad ids are refusals, never crashes) ──────

const REFS: [key: string, table: "members" | "events" | "proposals" | "programs" | "chapters" | "partners", label: string][] = [
  ["memberId", "members", "member"],
  ["eventId", "events", "event"],
  ["proposalId", "proposals", "proposal"],
  ["programId", "programs", "program"],
  ["chapterId", "chapters", "chapter"],
  ["partnerId", "partners", "partner"],
];

function missingRef(w: World, payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  for (const [key, table, label] of REFS) {
    const v = p[key];
    if (typeof v !== "string") continue;
    if (!(w[table] as Record<string, unknown>)[v]) return `No such ${label}.`;
  }
  if (Array.isArray(p.chapterIds) && p.chapterIds.some((c) => typeof c !== "string" || !w.chapters[c])) return "No such chapter.";
  return null;
}

// ── Redaction (invariant 5) ─────────────────────────────────────────────────

/** A short digest that identifies a value without revealing it. */
export function digest(value: string): string {
  return `#${fnv1a(`fl4-salt:${value}`)}`;
}

/** The digest a shredded log entry carries, or a fresh one for live data. */
function stravaDigest(externalId: string): string {
  if (externalId.startsWith(STRAVA_SHREDDED)) return `#${externalId.slice(STRAVA_SHREDDED.length).split(":")[0]}`;
  return digest(externalId);
}


function questionDigest(q: string): string {
  const m = FORGOTTEN.exec(q);
  return m ? `#${m[3]}` : digest(q);
}

function redactPayload(type: CommandType, payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return payload;
  const p = payload as Record<string, unknown>;
  if (type === "PROVIDER_DELIVERY" && p.provider === "strava") {
    return {
      provider: "strava",
      memberId: p.memberId,
      op: p.op,
      version: p.version,
      externalId: stravaDigest(String(p.externalId)),
      distanceMi: "[not shown]",
      startedAt: "[not shown]",
      durationMin: "[not shown]",
      mode: "[not shown]",
      ...(p.timeout ? { timeout: true } : {}),
    };
  }
  if (type === "LOG_ACTIVITY" && p.prefilledFrom === "strava") return { ...p, distanceMi: "[not shown]", startedAt: "[not shown]", durationMin: "[not shown]" };
  if (type === "ASK_COACH" && typeof p.question === "string") {
    // The AI's lines can echo the member's words, so they stay out of the audit trail too.
    const ai = p.ai as { heard: string[]; cards: string[]; model: string } | undefined;
    return { ...p, question: `[member's words · ${questionDigest(p.question)}]`, ...(ai ? { ai: { ...ai, heard: ai.heard.map(() => "[coach's words]") } } : {}) };
  }
  return payload;
}

/** Restricted records collapse to one line each, so the audit trail shows that they changed, never what they hold. */
function redactChanges(before: World, after: World, changes: Change[]): Change[] {
  const out: Change[] = [];
  const seen = new Set<string>();
  const isStrava = (id: string) => before.activities[id]?.source === "strava" || after.activities[id]?.source === "strava";
  for (const c of changes) {
    const parts = c.path.split(".");
    if (parts[0] === "activities" && parts[1] && isStrava(parts[1])) {
      const key = `activities.${parts[1]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const was = before.activities[parts[1]];
      const now = after.activities[parts[1]];
      out.push({ path: key, before: was ? "[Strava record · not shown]" : null, after: now ? (now.status === "purged" ? "[Strava record · deleted]" : "[Strava record · not shown]") : null });
      continue;
    }
    if (parts[0] === "pendingRetries") {
      if (seen.has("pendingRetries")) continue;
      seen.add("pendingRetries");
      out.push({ path: "pendingRetries", before: `[${before.pendingRetries.length} queued]`, after: `[${after.pendingRetries.length} queued]` });
      continue;
    }
    if (parts[0] === "coach" && (parts[1] === "answers" || parts[1] === "sessions")) {
      const key = parts[1] === "answers" && parts[2] ? `coach.answers.${parts[2]}` : "coach.sessions";
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ path: key, before: c.before === null ? null : "[coach conversation · kept with the member]", after: c.after === null ? null : "[coach conversation · kept with the member]" });
      continue;
    }
    out.push(c);
  }
  return out;
}

const SHOWN_CHANGES = 60;

// ── Lens mapping ────────────────────────────────────────────────────────────

function lensesFor(changes: Change[]): Lens[] {
  const out = new Set<Lens>(["xray"]);
  for (const c of changes) {
    const root = c.path.split(".")[0];
    switch (root) {
      case "members":
        out.add("member");
        if (c.path.includes("consents")) out.add("circles").add("coach");
        break;
      case "activities":
        out.add("member").add("coach").add("circles");
        break;
      case "chapters":
      case "events":
        out.add("circles").add("member");
        if (c.path.includes("status") || c.path.includes("checkIns")) out.add("impact").add("partner");
        break;
      case "proposals":
      case "partners":
        out.add("partner").add("founder").add("impact");
        break;
      case "programs":
      case "impact":
        out.add("impact").add("founder");
        break;
      case "coach":
        out.add("coach");
        break;
      case "scenario":
        out.add("future").add("founder");
        break;
      case "projections":
        out.add("circles");
        break;
      case "egress":
        out.add("partner");
        break;
    }
  }
  return [...out];
}

// ── execute ─────────────────────────────────────────────────────────────────

const HARNESS = new Set<string>(HARNESS_COMMANDS);

export function execute(machine: Machine, input: CommandInput, actor: Actor, meta: Meta = {}): { machine: Machine; receipt: Receipt } {
  const world = machine.world;
  const at = world.clock;
  const stages: StageNote[] = [];
  const facts: Record<string, string> = {};
  const note = (stage: Stage, status: StageNote["status"], detail: string, ruleId?: string) => {
    stages.push(ruleId ? { stage, status, detail, ruleId } : { stage, status, detail });
  };
  const fullMeta: Meta = HARNESS.has(input.type) ? { ...meta, harness: true } : meta;

  const finish = (next: World, outcome: Outcome, summary: string, payload: unknown, redacted: Change[]): { machine: Machine; receipt: Receipt } => {
    const ruleIds = [...new Set(stages.map((s) => s.ruleId).filter((r): r is string => Boolean(r)))];
    const prevHash = headHash(machine);
    const lenses = outcome === "applied" || outcome === "deferred" || outcome === "quarantined" ? lensesFor(redacted) : (["xray"] as Lens[]);
    note("audit", "pass", `Receipt #${machine.ledger.length + 1} chained to ${prevHash}.`);
    if (lenses.length > 1) note("project", "info", `Views refreshed: ${lenses.filter((l) => l !== "xray").join(", ")}.`);
    const receipt: Receipt = {
      seq: machine.ledger.length + 1,
      type: input.type,
      payload: redactPayload(input.type, payload),
      actor,
      at,
      outcome,
      summary,
      stages: sortStages(stages),
      ruleIds,
      changes: redacted.slice(0, SHOWN_CHANGES),
      changeCount: { total: redacted.length, truncated: redacted.length > SHOWN_CHANGES },
      ...(Object.keys(facts).length ? { facts } : {}),
      lenses,
      meta: fullMeta,
      prevHash,
      hash: "",
    };
    receipt.hash = receiptHash(receipt);
    return { machine: { world: next, ledger: [...machine.ledger, receipt] }, receipt };
  };

  // input
  const handler = handlers[input.type] as Handler<CommandType> | undefined;
  const schema = schemas[input.type];
  if (!handler || !schema) {
    note("input", "fail", `Unknown command ${String(input.type)}.`);
    return finish(world, "rejected", "Unknown command.", input.payload, []);
  }
  const parsed = schema.safeParse(input.payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const detail = issue ? `${issue.path.join(".") || "payload"}: ${issue.message}` : "Invalid payload.";
    note("input", "fail", detail);
    return finish(world, "rejected", `Refused at input: ${detail}`, input.payload, []);
  }
  const payload = parsed.data as Payload<CommandType>;
  const missing = missingRef(world, payload);
  if (missing) {
    note("input", "fail", missing);
    return finish(world, "rejected", `Refused at input: ${missing}`, payload, []);
  }
  note("input", "pass", "Shape, types and references valid.");

  // authorize
  if (!handler.roles.includes(actor.role)) {
    note("authorize", "fail", `A ${actor.role} can't ${input.type}.`);
    return finish(world, "rejected", `Refused: a ${actor.role} can't do that.`, payload, []);
  }
  const ownership = handler.owns?.(world, actor, payload as never) ?? null;
  if (ownership) {
    note("authorize", "fail", ownership);
    return finish(world, "rejected", `Refused: ${ownership}`, payload, []);
  }
  note("authorize", "pass", `${nameOf(world, actor.id)} (${actor.role}) may do this.`);

  // reconcile → policy → apply (handler mutates a draft; refusals and errors discard it)
  const draft = structuredClone(world);
  const ctx: Ctx = { w: draft, actor, at, note, fact: (k, v) => (facts[k] = v) };
  let result: Result;
  try {
    result = handler.run(ctx, payload as never);
  } catch (err) {
    result = reject("apply", `Refused: internal error (${err instanceof Error ? err.message : String(err)}). Nothing changed.`);
  }
  const keeps = result.outcome === "applied" || result.outcome === "deferred" || result.outcome === "quarantined";

  if (!keeps) {
    note(result.stage ?? "policy", result.outcome === "noop" ? "pass" : "fail", result.summary, result.ruleId);
    return finish(world, result.outcome, result.summary, payload, []);
  }
  if (result.outcome !== "applied") note(result.stage ?? "input", "info", result.summary, result.ruleId);
  const changes = redactChanges(world, draft, diff(world, draft));
  note("apply", "pass", `${changes.length} field${changes.length === 1 ? "" : "s"} changed.`);
  return finish(draft, result.outcome, result.summary, payload, changes);
}

function sortStages(stages: StageNote[]): StageNote[] {
  return stages
    .map((s, i) => ({ s, i }))
    .sort((a, b) => STAGES.indexOf(a.s.stage) - STAGES.indexOf(b.s.stage) || a.i - b.i)
    .map(({ s }) => s);
}

// ── Replay ──────────────────────────────────────────────────────────────────

export interface LogEntry {
  input: CommandInput;
  actor: Actor;
  meta?: Meta;
}

/** State is a fold of the command log. Same log, same world, same hash. */
export function replay(log: LogEntry[], upTo = log.length): Machine {
  let m = initialMachine();
  for (const entry of log.slice(0, upTo)) m = execute(m, entry.input, entry.actor, entry.meta).machine;
  return m;
}
