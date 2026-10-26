// Every way the world can change, as validated data. The UI never mutates
// state; it sends one of these through `execute`. The schemas are the input
// stage of every receipt, so a malformed command is refused before any rule
// runs and the refusal is recorded.

import { z } from "zod";

const id = z.string().min(1).max(64);
const mode = z.enum(["walk", "jog", "run", "roll", "hike"]);
const countable = z.enum(["manual", "event_checkin", "healthkit", "health_connect", "garmin"]);
const provider = z.enum(["strava", "healthkit", "health_connect", "garmin"]);
const access = z.enum(["step-free", "restrooms", "shade", "seating", "short-option", "transit"]);
const miles = z.number().finite();

/** Plain text a member typed: trimmed, control characters removed, 1–55 characters (V2's limit). */
export const eventTitle = z
  .string()
  .transform((s) => s.replace(/[\u0000-\u001f\u007f]/g, "").trim())
  .pipe(z.string().min(1, "Give the event a name.").max(55, "Keep the name to 55 characters."));

export const schemas = {
  // ── members ──
  JOIN_MOVEMENT: z.object({
    name: z.string().trim().min(1).max(24),
    moves: z.array(mode).min(1),
    goalLabel: z.string().trim().min(1).max(90),
    goalKind: z.enum(["season-100", "own-distance", "events", "race-path"]),
    target: z.number().int().min(1).max(500),
    chapterId: id.nullable(),
    needs: z.array(access),
  }),
  SET_GOAL: z.object({ memberId: id, kind: z.enum(["season-100", "own-distance", "events", "race-path"]), target: z.number().int().min(1).max(500), label: z.string().trim().min(1).max(90) }),
  SET_RACE_PATH: z.object({ memberId: id, racePath: z.enum(["5k", "10k", "half", "full"]) }),
  SET_RANK_MODE: z.object({ memberId: id, mode: z.enum(["personal", "team"]) }),
  LOG_ACTIVITY: z.object({
    memberId: id,
    clientRequestId: id,
    distanceMi: miles,
    mode,
    startedAt: z.number().int().min(0),
    durationMin: z.number().int().min(1).max(1440),
    /** Set when a UI tried to pre-fill the entry from a provider record (X-02 forbids it). */
    prefilledFrom: provider.optional(),
  }),
  DELETE_ACTIVITY: z.object({ memberId: id, activityId: id }),
  SET_CONSENT: z.object({ memberId: id, purpose: z.enum(["chapter", "coach"]), source: countable, granted: z.boolean() }),
  SET_STORY_WALL: z.object({ memberId: id, on: z.boolean() }),
  SET_PARTNER_CONTACT: z.object({ memberId: id, partnerId: id, granted: z.boolean() }),
  SET_NEEDS_SHARING: z.object({ memberId: id, on: z.boolean() }),
  CONNECT_PROVIDER: z.object({ memberId: id, provider }),
  REVOKE_PROVIDER: z.object({ memberId: id, provider }),
  JOIN_CHAPTER: z.object({ memberId: id, chapterId: id }),
  LEAVE_CHAPTER: z.object({ memberId: id }),
  RSVP: z.object({ memberId: id, eventId: id }),
  CANCEL_RSVP: z.object({ memberId: id, eventId: id }),
  INVITE_FRIEND: z.object({ memberId: id }),
  TOGGLE_STORY_CARD: z.object({ memberId: id }),
  ASK_COACH: z.object({
    memberId: id,
    question: z.string().trim().min(1).max(400),
    /** The AI's proposal, when the AI is on: kind lines in its own words and approved tips by id. The rules decide whether it is sent. */
    ai: z
      .object({ heard: z.array(z.string().trim().min(1).max(240)).min(1).max(3), cards: z.array(id).min(1).max(3), model: z.string().min(1).max(40) })
      .optional(),
  }),
  SAVE_NEXT_STEP: z.object({ memberId: id, answerId: id }),
  CLEAR_NEXT_STEP: z.object({ memberId: id }),
  /** The member's right to erase what they told the coach (WA-04). */
  FORGET_COACH_HISTORY: z.object({ memberId: id }),
  VOTE_PROGRAM: z.object({ memberId: id, programId: id }),
  REDEEM_OFFER: z.object({ memberId: id, proposalId: id, code: z.string().trim().min(4).max(24) }),
  OFFER_CLICK: z.object({ memberId: id, proposalId: id }),

  // ── organizers ──
  DRAFT_EVENT: z.object({
    chapterId: id,
    title: eventTitle,
    day: z.number().int().min(0).max(122),
    startMinute: z.number().int().min(0).max(1439),
    meetingArea: z.string().trim().min(1).max(80),
    distanceOptions: z.array(z.number().positive().max(26.2)).min(1).max(4),
    mode: z.enum(["walk", "jog", "run", "roll", "hike", "mixed"]),
    access: z.array(access),
    capacity: z.number().int().min(2).max(500),
  }),
  SUBMIT_EVENT: z.object({ eventId: id }),
  ASSIGN_SWEEP: z.object({ eventId: id, memberId: id }),
  PUBLISH_EVENT: z.object({ eventId: id }),
  CANCEL_EVENT: z.object({ eventId: id, reason: z.string().trim().min(3).max(120) }),
  CHECK_IN: z.object({ eventId: id, memberId: id, distanceMi: z.number().positive().max(26.2) }),
  COMPLETE_EVENT: z.object({ eventId: id }),
  /** Move a walk that hasn't started (a heat plan's earlier start, a storm day). */
  RESCHEDULE_EVENT: z.object({ eventId: id, day: z.number().int().min(0).max(122), startMinute: z.number().int().min(0).max(1439), reason: z.string().trim().min(3).max(120) }),

  // ── partners and the founder ──
  SET_PROPOSAL_INPUT: z.object({
    proposalId: id,
    key: z.enum(["communities", "eventsPerCommunity", "fee", "costPerEvent", "organizerStipendPerEvent", "creativeAndReporting", "staffHours", "staffRate", "paymentFeePct", "impactPct"]),
    value: z.number().finite().min(0),
  }),
  SET_PROPOSAL_CHAPTERS: z.object({ proposalId: id, chapterIds: z.array(id).max(4) }),
  ADVANCE_DEAL: z.object({ proposalId: id, override: z.string().trim().max(240).optional() }),
  MARK_DEAL_LOST: z.object({ proposalId: id, reason: z.string().trim().min(3).max(120) }),
  /** The partner's payment arrived. Impact money exists only from here. */
  RECORD_PAYMENT: z.object({ proposalId: id }),
  PARTNER_DATA_REQUEST: z.object({
    proposalId: id,
    request: z.enum(["aggregate-attendance", "participant-list", "activity-history", "health-audience", "optin-contacts"]),
    override: z.string().trim().max(240).optional(),
  }),

  // ── commissions (src/domain/commission) ──
  /** A buyer asks for one walk a week in a few cities, for a fee. It becomes a proposal plus who covers each city. */
  CREATE_COMMISSION: z.object({
    buyerId: id,
    chapterIds: z.array(id).min(2).max(4),
    weeks: z.number().int().min(3).max(8),
    fee: z.number().finite().min(500).max(250000),
    kickoff: z.boolean(),
  }),
  /** Who delivers a city: its City Lead, a partner crew, or nobody (dropped before signing). */
  SET_COVERAGE: z.object({ commissionId: id, chapterId: id, coverage: z.enum(["lead", "crew", "descope"]), reason: z.string().trim().min(3).max(120).optional() }),
  /** Rerun a cancelled walk a week after the city's last one. Costs one more walk. */
  ADD_MAKEUP_WALK: z.object({ commissionId: id, eventId: id }),
  /** Next season's proposal to the same buyer, priced on what was delivered. Never signed or paid by this. */
  PROPOSE_RENEWAL: z.object({ commissionId: id }),
  SELECT_PROGRAM: z.object({ programId: id }),
  ADVANCE_PROGRAM: z.object({ programId: id }),
  SET_SCENARIO: z.object({
    key: z.enum(["year", "partners", "partnerAvg", "workplaces", "workplaceAvg"]),
    value: z.number().int().min(0).max(250000),
  }),

  // ── coaching governance ──
  PROPOSE_RULESET: z.object({ version: z.enum(["v1", "v2", "v3"]) }),
  APPROVE_RULESET: z.object({ as: z.enum(["content", "engineering"]) }),
  SET_DRIFT: z.object({ on: z.boolean() }),

  // ── providers and the system ──
  PROVIDER_DELIVERY: z.object({
    provider,
    memberId: id,
    externalId: id,
    version: z.number().int().min(1),
    op: z.enum(["upsert", "delete"]),
    distanceMi: miles.nullable(),
    mode,
    startedAt: z.number().int().min(0),
    durationMin: z.number().int().min(1).max(1440),
    /** The provider's call timed out; the delivery is queued for an idempotent retry. */
    timeout: z.boolean().optional(),
  }),
  RETRY_PENDING: z.object({}),
  ADVANCE_CLOCK: z.object({ to: z.number().int().min(0) }),
  CORRUPT_PROJECTION: z.object({ chapterId: id, delta: z.number().finite() }),
  REBUILD_PROJECTIONS: z.object({}),
  /** A staff export (e.g. the X-Ray's log download) leaves an egress row like any other disclosure (X-04). */
  RECORD_EXPORT: z.object({ recipient: z.string().trim().min(1).max(80), what: z.string().trim().min(1).max(200), lineage: z.array(z.enum(["manual", "event_checkin", "strava", "healthkit", "health_connect", "garmin"])) }),
} as const;

export type CommandType = keyof typeof schemas;
export type Payload<T extends CommandType> = z.infer<(typeof schemas)[T]>;
/** What callers send. Payloads are validated, so they arrive as `unknown`-safe input. */
export type CommandInput = { [K in CommandType]: { type: K; payload: z.input<(typeof schemas)[K]> } }[CommandType];

export const COMMAND_TYPES = Object.keys(schemas) as CommandType[];

/**
 * Test-harness commands: fault injection, clock control, repair. They exist so the
 * X-Ray can be demonstrated; a production port would expose only ProductionCommandType.
 */
export const HARNESS_COMMANDS = ["CORRUPT_PROJECTION", "SET_DRIFT", "ADVANCE_CLOCK", "RETRY_PENDING", "REBUILD_PROJECTIONS"] as const;
export type HarnessCommandType = (typeof HARNESS_COMMANDS)[number];
export type ProductionCommandType = Exclude<CommandType, HarnessCommandType>;
