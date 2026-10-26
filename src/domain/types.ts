import type { Commission, CommissionId } from "./commission/types";
import type { CoachAnswer } from "./quantum/types";

// The one model of the Future Lab world. Every lens (member, organizer, coach,
// partner, impact, founder, engineering) is a projection of a `World`, and the
// only way a `World` changes is a `Command` run through `execute` in engine.ts.
//
// Everything here is fictional demonstration data. Nothing is read from or
// written to the production 100 Miles of Summer app.

/** Minutes since the start of the fictional season (day * 1440 + minute). */
export type Tick = number;

export type MemberId = string;
export type ChapterId = string;
export type EventId = string;
export type PartnerId = string;
export type ProposalId = string;
export type ProgramId = string;
export type ActivityId = string;

// ── Actors and roles ────────────────────────────────────────────────────────

export type Role = "member" | "organizer" | "partner" | "founder" | "provider" | "engineer" | "system";

export interface Actor {
  role: Role;
  /** memberId for members/organizers, partnerId for partners, provider name for providers. */
  id: string;
}

// ── Movement and activity provenance ────────────────────────────────────────

/** Walking, jogging, running and rolling are the public 100MoS modes; hiking appears in the App Store text. No cycling. */
export type MovementMode = "walk" | "jog" | "run" | "roll" | "hike";

/** Where an activity record came from. The source decides what it may be used for. */
export type ActivitySource = "manual" | "event_checkin" | "strava" | "healthkit" | "health_connect" | "garmin";

export type Provider = "strava" | "healthkit" | "health_connect" | "garmin";

export const PROVIDERS: readonly Provider[] = ["strava", "healthkit", "health_connect", "garmin"];

/** Sources whose records may count toward a season total. Strava is excluded by its June 2026 API Policy. */
export type CountableSource = Exclude<ActivitySource, "strava">;

export const COUNTABLE_SOURCES: readonly CountableSource[] = ["manual", "event_checkin", "healthkit", "health_connect", "garmin"];

export type ActivityStatus =
  | "counted" // contributes to the owner's progress
  | "owner-panel" // Strava: shown to its owner in a separate panel, never counted or combined
  | "superseded" // the same outing recorded by a higher-priority source
  | "quarantined" // failed validation; kept out of every total until fixed
  | "purged"; // removed: source disconnected, provider deletion, or cache expiry

export interface Activity {
  id: ActivityId;
  memberId: MemberId;
  source: ActivitySource;
  /** The provider's own record id (or a client request id for manual logs). Exact-replay key. */
  externalId: string;
  /** Provider-side version (updated-at). Older versions never overwrite newer ones. */
  version: number;
  distanceMi: number;
  mode: MovementMode;
  startedAt: Tick;
  durationMin: number;
  status: ActivityStatus;
  /** When status is superseded: the activity that won. */
  supersededBy?: ActivityId;
  /** For event check-ins: the event this outing belongs to. */
  eventId?: EventId;
  receivedAt: Tick;
  /** Strava records live in a transient cache and must be gone after this tick (STRAVA-05). */
  expiresAt?: Tick;
  /** Why the record left the totals, in plain words, with the rule that decided it. */
  removal?: { reason: string; ruleId: string; at: Tick };
}

export interface Connection {
  provider: Provider;
  status: "connected" | "revoked" | "never";
  since: Tick | null;
  lastDeliveryAt: Tick | null;
  /** Garmin attribution names the device (GARMIN-04). */
  deviceModel?: string;
}

// ── Members, goals, sharing ─────────────────────────────────────────────────

export type GoalKind = "season-100" | "own-distance" | "events" | "race-path";

export interface Goal {
  kind: GoalKind;
  /** Miles for distance goals, number of events for the events goal. */
  target: number;
  /** The member's own words. Never rewritten by the system. */
  label: string;
}

export type RacePath = "5k" | "10k" | "half" | "full";

/**
 * The member's consent ledger, per source and purpose (X-03). A consent can only
 * widen what our own policy allows; provider terms are checked first.
 */
export interface Consents {
  /** Count records from this source in my chapter's shared total. */
  chapter: Record<CountableSource, boolean>;
  /** Let QUANTUM read a summary of records from this source. */
  coach: Record<CountableSource, boolean>;
  /** Show my first name and season miles to other members on the chapter wall. */
  storyWall: boolean;
  /** Partners I chose to give my email to. Never inferred. */
  partnerContact: PartnerId[];
  /** Let organizers of events I RSVP to see the access needs I listed. Off by default. */
  needsToOrganizers: boolean;
}

export interface Member {
  id: MemberId;
  name: string;
  persona: string;
  /** One line on why this member is here, in the fictional member's voice. */
  why: string;
  moves: MovementMode[];
  goal: Goal;
  racePath: RacePath;
  chapterId: ChapterId | null;
  homeChapterId: ChapterId;
  consents: Consents;
  /** What makes an event possible for this member (filters events, never shared). */
  needs: AccessNeed[];
  connections: Record<Provider, Connection>;
  invitesSent: number;
  storyCardDrafted: boolean;
  rankMode: "personal" | "team";
  savedStep: SavedStep | null;
  stamps: Stamp[];
  joinedAt: Tick;
  /** Fictional demonstration persona: never presented as a real participant. */
  fixture: true;
  /** Modelled so a chapter has a real organizer to authorize; not offered as a persona. */
  background?: true;
}

export interface SavedStep {
  text: string;
  cardId: string;
  savedAt: Tick;
}

export type StampKind = "first-mile" | "first-event" | "brought-a-friend" | "ten-miles" | "fifty-miles" | "hundred-miles" | "welcomed-someone" | "own-goal";

export interface Stamp {
  kind: StampKind;
  at: Tick;
}

// ── Chapters and events ─────────────────────────────────────────────────────

export type AccessNeed = "step-free" | "restrooms" | "shade" | "seating" | "short-option" | "transit";

export interface Chapter {
  id: ChapterId;
  city: string;
  name: string;
  /** Fictional aggregate of members who are not modelled individually. */
  backgroundMembers: number;
  /** Fictional first-party shared miles of the background members. */
  backgroundSharedMiles: number;
  organizers: MemberId[];
  /** Display name of the fictional chapter lead (only Detroit's lead is a modelled member). */
  leadName: string;
  members: MemberId[];
  note: string;
  /** Position on the atlas (0..1 across the contiguous US box). */
  atlas: { x: number; y: number };
  fixture: true;
}

export type EventStatus = "draft" | "submitted" | "published" | "cancelled" | "completed";

export interface MovementEvent {
  id: EventId;
  chapterId: ChapterId;
  title: string;
  mode: MovementMode | "mixed";
  day: number;
  startMinute: number;
  /** General meeting area only. Never an exact home location. */
  meetingArea: string;
  distanceOptions: number[];
  paceNote: string;
  access: AccessNeed[];
  capacity: number;
  rsvps: MemberId[];
  waitlist: MemberId[];
  checkIns: { memberId: MemberId; distanceMi: number; firstEvent: boolean }[];
  /** Fictional RSVPs from members not modelled individually; 80% of them attend. */
  backgroundRsvps: number;
  /** Set when the event completes: fictional attendance of the background RSVPs. */
  backgroundAttended: number | null;
  status: EventStatus;
  createdBy: MemberId;
  /** The volunteer who walks at the back so nobody finishes alone. Required to publish. */
  sweep: MemberId | null;
  fundedBy: ProposalId | null;
  cancelReason?: string;
  /** Set the first time an organizer moves the walk: when it was meant to start, and why it moved. */
  moved?: { day: number; startMinute: number; reason: string };
}

// ── Coaching (QUANTUM) ──────────────────────────────────────────────────────

/** v1 = baseline, v2 = adds summer-heat and dizziness handling, v3 = an aggressive draft the release gate must refuse. */
export type RulesetVersion = "v1" | "v2" | "v3";

export interface CoachState {
  activeRuleset: RulesetVersion;
  /** A candidate ruleset waiting for approvals before it may become active. */
  candidate: { version: RulesetVersion; approvals: ("content" | "engineering")[] } | null;
  /** Fault mode: the composer drafts unsafe text so the validator can be seen working. */
  drift: boolean;
  sessions: CoachSession[];
  answers: Record<string, CoachAnswer>;
}

export interface CoachSession {
  id: string;
  memberId: MemberId;
  question: string;
  at: Tick;
  ruleset: RulesetVersion;
  /** The full deterministic answer record (see quantum/types.ts). */
  answerId: string;
}

// ── Partners and campaigns ──────────────────────────────────────────────────

export type PartnerKind = "brand" | "workplace" | "city";

export type DealStage = "inquiry" | "qualified" | "proposal" | "contract" | "live" | "reported" | "renewed" | "lost";

export const DEAL_STAGES: readonly DealStage[] = ["inquiry", "qualified", "proposal", "contract", "live", "reported", "renewed"];

export type Product = "first-mile-series" | "workplace-season" | "city-season";

export interface ProposalInputs {
  product: Product;
  communities: number;
  eventsPerCommunity: number;
  /** Total contract fee in USD. */
  fee: number;
  /** Permits, insurance rider, water, supplies — per event. */
  costPerEvent: number;
  organizerStipendPerEvent: number;
  /** Photography and the partner report, per campaign. */
  creativeAndReporting: number;
  /** Staff time spent selling and running the campaign. */
  staffHours: number;
  staffRate: number;
  paymentFeePct: number;
  impactPct: number;
}

export interface Proposal {
  id: ProposalId;
  partnerId: PartnerId;
  inputs: ProposalInputs;
  stage: DealStage;
  signedAt: Tick | null;
  /** A founder override recorded when a contract is signed below zero contribution. */
  override: string | null;
  /** When the partner's payment arrived. Impact money exists only after this (IMPACT-POOL). */
  paidAt: Tick | null;
  chapterIds: ChapterId[];
  fundedEventIds: EventId[];
  offerClicks: number;
  /** Members who tapped the offer; a member counts once. */
  offerClickers: MemberId[];
  /** Single-use codes issued when the program goes live (handed out at funded events). */
  issuedCodes: string[];
  redemptions: { memberId: MemberId; code: string; at: Tick }[];
  reportedAt: Tick | null;
}

export interface Partner {
  id: PartnerId;
  name: string;
  kind: PartnerKind;
  /** What this fictional buyer says they want, in plain words. */
  wants: string;
  fixture: true;
}

// ── Community impact ────────────────────────────────────────────────────────

export type ImpactStage = "proposed" | "community-review" | "approved" | "funded" | "delivered" | "verified";

export const IMPACT_STAGES: readonly ImpactStage[] = ["proposed", "community-review", "approved", "funded", "delivered", "verified"];

export interface ImpactProgram {
  id: ProgramId;
  name: string;
  what: string;
  cost: number;
  stage: ImpactStage;
  votes: MemberId[];
  /** Fictional votes from members not modelled individually. */
  backgroundVotes: number;
  funded: number;
  fundedAt: Tick | null;
  /** Completed events that count as evidence of delivery. */
  evidenceEventIds: EventId[];
  chapterIds: ChapterId[];
}

// ── Founder scenario controls ───────────────────────────────────────────────

export interface ScenarioParams {
  year: 2027 | 2028 | 2029;
  /** V2 parity: brand programs per year and their average fee. */
  partners: number;
  partnerAvg: number;
  /** V2 parity: workplace/organization programs per year and their average fee. */
  workplaces: number;
  workplaceAvg: number;
}

// ── The world ───────────────────────────────────────────────────────────────

export interface Egress {
  seq: number;
  at: Tick;
  recipient: string;
  purpose: string;
  /** Rule ids that allowed this disclosure. */
  ruleIds: string[];
  /** Sources whose records are in what left (X-01 lineage). */
  lineage: ActivitySource[];
  what: string;
}

export interface World {
  /** Increments on every applied change; used to mint deterministic ids. */
  seq: number;
  clock: Tick;
  members: Record<MemberId, Member>;
  activities: Record<ActivityId, Activity>;
  chapters: Record<ChapterId, Chapter>;
  events: Record<EventId, MovementEvent>;
  partners: Record<PartnerId, Partner>;
  proposals: Record<ProposalId, Proposal>;
  programs: Record<ProgramId, ImpactProgram>;
  impact: { selectedProgram: ProgramId; disbursed: number };
  coach: CoachState;
  scenario: ScenarioParams;
  /**
   * A materialised view, maintained incrementally like a production read model.
   * `verifyProjections` recomputes it from the activity table to prove they agree.
   */
  projections: { chapterSharedMiles: Record<ChapterId, number> };
  /** Requests a provider made that failed and wait for a retry (idempotent). */
  pendingRetries: { key: string; command: unknown }[];
  /** Every disclosure outside a record's owner (X-04). An export with no row here cannot happen. */
  egress: Egress[];
  /** Multi-city programs one buyer commissions (src/domain/commission). Absent until the first is created. */
  commissions?: Record<CommissionId, Commission>;
}
