// The seeded world. Every person, chapter, event, partner and number below is
// FICTIONAL demonstration data. The four personas and the V2 defaults (Maya
// 12.4 mi, Sarah 68.7, James 31.2, Nina 44.1; Detroit; fee 7,500; delivery
// 2,800; impact 15%; 8 × 7,500 + 4 × 12,000) are preserved from Future Lab V2
// so the two can be compared.

import { tick } from "./calendar";
import { rebuildProjections } from "./projections";
import type {
  Activity,
  ActivitySource,
  Chapter,
  Connection,
  Consents,
  ImpactProgram,
  Member,
  MovementEvent,
  MovementMode,
  Partner,
  Proposal,
  ProposalInputs,
  Provider,
  World,
} from "./types";

/** The demo opens on Thursday, May 13, 2027 at 6:00 PM — day 12 of the tenth season. */
export const OPENING_TICK = tick(12, 18 * 60);

const NONE: Record<Provider, Connection> = {
  strava: { provider: "strava", status: "never", since: null, lastDeliveryAt: null },
  healthkit: { provider: "healthkit", status: "never", since: null, lastDeliveryAt: null },
  health_connect: { provider: "health_connect", status: "never", since: null, lastDeliveryAt: null },
  garmin: { provider: "garmin", status: "never", since: null, lastDeliveryAt: null },
};

function connections(...connected: [Provider, number, string?][]): Record<Provider, Connection> {
  const out = structuredClone(NONE);
  for (const [provider, day, deviceModel] of connected) {
    out[provider] = { provider, status: "connected", since: tick(day, 9 * 60), lastDeliveryAt: tick(11, 20 * 60) };
    if (deviceModel) out[provider].deviceModel = deviceModel;
  }
  return out;
}

function consents(chapter: Partial<Consents["chapter"]>, coach: Partial<Consents["coach"]> = {}, storyWall = false): Consents {
  const off = { manual: false, event_checkin: false, healthkit: false, health_connect: false, garmin: false };
  return { chapter: { ...off, event_checkin: true, ...chapter }, coach: { ...off, ...coach }, storyWall, partnerContact: [], needsToOrganizers: false };
}

function member(m: Omit<Member, "invitesSent" | "storyCardDrafted" | "rankMode" | "savedStep" | "stamps" | "fixture" | "racePath"> & Partial<Pick<Member, "stamps" | "racePath" | "background">>): Member {
  return {
    racePath: "5k",
    invitesSent: 0,
    storyCardDrafted: false,
    rankMode: "personal",
    savedStep: null,
    stamps: [],
    fixture: true,
    ...m,
  };
}

const MEMBERS: Member[] = [
  member({
    id: "maya",
    name: "Maya",
    persona: "First-time walker",
    why: "I've never walked a mile on purpose. I want to know I can.",
    moves: ["walk"],
    goal: { kind: "season-100", target: 100, label: "Walk 100 miles by August — one comfortable mile at a time" },
    chapterId: null,
    homeChapterId: "detroit",
    consents: consents({ manual: true }),
    needs: ["restrooms", "short-option"],
    connections: connections(["healthkit", 2]),
    joinedAt: tick(1, 19 * 60),
    stamps: [{ kind: "first-mile", at: tick(1, 19 * 60) }, { kind: "ten-miles", at: tick(10, 8 * 60) }],
  }),
  member({
    id: "james",
    name: "James",
    persona: "Social roller",
    why: "I roll with people every week. The miles are how we hang out.",
    moves: ["roll"],
    goal: { kind: "own-distance", target: 75, label: "Roll 75 miles with my Saturday crew" },
    chapterId: "detroit",
    homeChapterId: "detroit",
    consents: { ...consents({ manual: true, health_connect: true }, {}, true), needsToOrganizers: true },
    needs: ["step-free", "restrooms"],
    connections: connections(["health_connect", 0]),
    joinedAt: tick(0, 8 * 60),
    stamps: [{ kind: "first-mile", at: tick(0, 9 * 60) }, { kind: "first-event", at: tick(7, 9 * 60) }, { kind: "ten-miles", at: tick(4, 9 * 60) }],
  }),
  member({
    id: "sarah",
    name: "Sarah",
    persona: "Aspiring marathoner",
    why: "100 miles got me running last summer. Now I want a first 10K — and maybe more.",
    moves: ["run", "jog"],
    goal: { kind: "race-path", target: 100, label: "100 miles, then train toward my first 10K" },
    racePath: "10k",
    chapterId: "detroit",
    homeChapterId: "detroit",
    consents: consents({ manual: true, healthkit: true }),
    needs: [],
    connections: connections(["healthkit", 0], ["strava", 0]),
    joinedAt: tick(0, 6 * 60),
    stamps: [{ kind: "first-mile", at: tick(0, 7 * 60) }, { kind: "ten-miles", at: tick(2, 7 * 60) }, { kind: "fifty-miles", at: tick(9, 7 * 60) }],
  }),
  member({
    id: "nina",
    name: "Nina",
    persona: "Community organizer",
    why: "Somebody walked at the back for me once. Now I get to be that person.",
    moves: ["walk", "jog"],
    goal: { kind: "events", target: 10, label: "Help 10 beginners finish their first group mile" },
    chapterId: "detroit",
    homeChapterId: "detroit",
    consents: consents({ manual: true, garmin: true }, { manual: true }, true),
    needs: [],
    connections: connections(["garmin", 0, "Garmin Forerunner 265"]),
    joinedAt: tick(0, 7 * 60),
    stamps: [{ kind: "first-mile", at: tick(0, 8 * 60) }, { kind: "ten-miles", at: tick(3, 8 * 60) }, { kind: "welcomed-someone", at: tick(7, 9 * 60) }],
  }),
];


/** Chapter leads outside Detroit: modelled only so their chapters have someone who may organize. */
function lead(id: string, name: string, chapterId: string): Member {
  return member({
    id,
    name,
    persona: "Chapter lead",
    why: "I run the circle in my city.",
    moves: ["walk"],
    goal: { kind: "events", target: 10, label: "Welcome ten newcomers" },
    chapterId,
    homeChapterId: chapterId,
    consents: consents({}),
    needs: [],
    connections: connections(),
    joinedAt: tick(0, 7 * 60),
    background: true,
  });
}

const LEADS: Member[] = [lead("marisol", "Marisol", "chicago"), lead("theo", "Theo", "charleston"), lead("grace", "Grace", "nyc"), lead("lena", "Lena", "la"), lead("dee", "Dee", "durham"), lead("amelie", "Amélie", "montreal")];

/**
 * Split a total into n outings with deterministic, slightly uneven distances
 * that sum exactly to the total (to a tenth of a mile).
 */
function outings(
  memberId: string,
  source: ActivitySource,
  totalMi: number,
  n: number,
  days: [number, number],
  mode: MovementMode,
  minute: number,
): Activity[] {
  const tenths = Math.round(totalMi * 10);
  const weights = Array.from({ length: n }, (_, i) => 7 + ((i * 5 + memberId.length * 3) % 6));
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const parts = weights.map((w) => Math.floor((tenths * w) / weightSum));
  parts[n - 1]! += tenths - parts.reduce((a, b) => a + b, 0);
  return parts.map((p, i) => {
    const day = days[0] + Math.round(((days[1] - days[0]) * i) / Math.max(1, n - 1));
    const startedAt = tick(day, minute + ((i * 13) % 40));
    const distanceMi = p / 10;
    return {
      id: `a-${memberId}-${source}-${i + 1}`,
      memberId,
      source,
      externalId: `${source}:${memberId}:${i + 1}`,
      version: 1,
      distanceMi,
      mode,
      startedAt,
      durationMin: Math.round(distanceMi * (mode === "run" ? 10.5 : mode === "jog" ? 12.5 : mode === "roll" ? 14 : 19)),
      status: source === "strava" ? "owner-panel" : "counted",
      receivedAt: startedAt + 45,
      ...(source === "strava" ? { expiresAt: startedAt + 45 + tick(7) } : {}),
    } satisfies Activity;
  });
}

const ACTIVITIES: Activity[] = [
  // Maya: 4.6 typed by hand + 7.8 from Apple Health = 12.4 (V2)
  ...outings("maya", "manual", 4.6, 4, [1, 9], "walk", 19 * 60),
  ...outings("maya", "healthkit", 7.8, 5, [3, 11], "walk", 7 * 60 + 30),
  // James: 18.4 Health Connect + 12.8 manual = 31.2 (V2)
  ...outings("james", "health_connect", 18.4, 6, [0, 11], "roll", 9 * 60),
  ...outings("james", "manual", 12.8, 4, [1, 10], "roll", 17 * 60),
  // Sarah: 50.5 Apple Health + 18.2 manual = 68.7 counted (V2), plus Strava runs that may only sit in her private panel
  ...outings("sarah", "healthkit", 50.5, 9, [0, 11], "run", 6 * 60),
  ...outings("sarah", "manual", 18.2, 5, [0, 10], "jog", 18 * 60),
  ...outings("sarah", "strava", 12.3, 3, [8, 11], "run", 6 * 60 + 5),
  // Nina: 22.6 Garmin + 21.5 manual = 44.1 (V2)
  ...outings("nina", "garmin", 22.6, 6, [0, 11], "jog", 6 * 60 + 30),
  ...outings("nina", "manual", 21.5, 7, [0, 11], "walk", 19 * 60),
];

const CHAPTERS: Chapter[] = [
  {
    id: "chicago",
    city: "Chicago",
    name: "Chicago Lakefront Circle",
    backgroundMembers: 138,
    backgroundSharedMiles: 3410.8,
    organizers: ["marisol"],
    leadName: "Marisol",
    members: ["marisol"],
    note: "Where the challenge began in 2018. Lakefront and neighborhood loops.",
    atlas: { x: 0.635, y: 0.33 },
    fixture: true,
  },
  {
    id: "detroit",
    city: "Detroit",
    name: "Detroit Riverwalk Circle",
    backgroundMembers: 84,
    backgroundSharedMiles: 1912.4,
    organizers: ["nina"],
    leadName: "Nina",
    members: ["james", "sarah", "nina"],
    note: "Beginner-friendly riverwalk loops, an evening roll, and a long Sunday trail.",
    atlas: { x: 0.505, y: 0.73 },
    fixture: true,
  },
  {
    id: "charleston",
    city: "Charleston",
    name: "Charleston Waterfront Circle",
    backgroundMembers: 116,
    backgroundSharedMiles: 2688.0,
    organizers: ["theo"],
    leadName: "Theo",
    members: ["theo"],
    note: "Waterfront walks, family loops and local leadership.",
    atlas: { x: 0.72, y: 0.66 },
    fixture: true,
  },
  {
    id: "nyc",
    city: "New York",
    name: "New York Prospect Circle",
    backgroundMembers: 157,
    backgroundSharedMiles: 3902.5,
    organizers: ["grace"],
    leadName: "Grace",
    members: ["grace"],
    note: "Many paces, one community, across neighborhood circles.",
    atlas: { x: 0.885, y: 0.32 },
    fixture: true,
  },
  {
    id: "la",
    city: "Los Angeles",
    name: "Los Angeles Griffith Park Circle",
    backgroundMembers: 63,
    backgroundSharedMiles: 1388.2,
    organizers: ["lena"],
    leadName: "Lena",
    members: ["lena"],
    note: "New in Year 9. Griffith Park loops and an easy beach-path morning.",
    atlas: { x: 0.08, y: 0.62 },
    fixture: true,
  },
  {
    id: "durham",
    city: "Durham",
    name: "Durham Bull City Circle",
    backgroundMembers: 71,
    backgroundSharedMiles: 1620.6,
    organizers: ["dee"],
    leadName: "Dee",
    members: ["dee"],
    note: "Tobacco Trail walks and a Saturday rolling route.",
    atlas: { x: 0.8, y: 0.58 },
    fixture: true,
  },
  {
    id: "montreal",
    city: "Montreal",
    name: "Montreal Lachine Canal Circle",
    backgroundMembers: 57,
    backgroundSharedMiles: 1294.8,
    organizers: ["amelie"],
    leadName: "Amélie",
    members: ["amelie"],
    note: "Canal-side walks, in English and French.",
    atlas: { x: 0.89, y: 0.16 },
    fixture: true,
  },
];

function event(e: Omit<MovementEvent, "rsvps" | "waitlist" | "checkIns" | "fundedBy" | "backgroundAttended"> & Partial<Pick<MovementEvent, "rsvps" | "fundedBy">>): MovementEvent {
  return { rsvps: [], waitlist: [], checkIns: [], fundedBy: null, backgroundAttended: null, ...e };
}

const EVENTS: MovementEvent[] = [
  event({
    id: "det-first-mile",
    chapterId: "detroit",
    title: "Saturday First Mile",
    mode: "mixed",
    day: 14,
    startMinute: 8 * 60,
    meetingArea: "Detroit Riverwalk, Rivard Plaza",
    distanceOptions: [1, 2.5],
    paceNote: "Every pace. Walk, jog, run or roll. Every First Mile walk names a sweep who walks at the back.",
    access: ["step-free", "restrooms", "shade", "short-option"],
    capacity: 40,
    rsvps: ["james"],
    backgroundRsvps: 16,
    status: "published",
    createdBy: "nina",
    sweep: "james",
  }),
  event({
    id: "det-roll-stroll",
    chapterId: "detroit",
    title: "Tuesday Roll & Stroll",
    mode: "mixed",
    day: 17,
    startMinute: 18 * 60 + 30,
    meetingArea: "Belle Isle, Casino lawn",
    distanceOptions: [1, 1.5],
    paceNote: "Flat, paved and step-free. Built around rollers and strollers.",
    access: ["step-free", "restrooms", "seating", "transit", "short-option"],
    capacity: 25,
    backgroundRsvps: 0,
    status: "submitted",
    createdBy: "james",
    sweep: null,
  }),
  event({
    id: "det-dequindre-long",
    chapterId: "detroit",
    title: "Sunday Long Walk",
    mode: "walk",
    day: 22,
    startMinute: 7 * 60,
    meetingArea: "Dequindre Cut, Gratiot Avenue entrance",
    distanceOptions: [3, 5],
    paceNote: "Conversational. Turn back at any point.",
    access: ["shade", "restrooms"],
    capacity: 30,
    rsvps: ["sarah"],
    backgroundRsvps: 9,
    status: "published",
    createdBy: "nina",
    sweep: "nina",
  }),
  event({
    id: "chi-lakefront",
    chapterId: "chicago",
    title: "Lakefront First Mile",
    mode: "mixed",
    day: 14,
    startMinute: 8 * 60 + 30,
    meetingArea: "Montrose Harbor, south lot",
    distanceOptions: [1, 3],
    paceNote: "The route the challenge started on. All paces.",
    access: ["step-free", "restrooms", "short-option"],
    capacity: 60,
    backgroundRsvps: 31,
    status: "published",
    createdBy: "marisol",
    sweep: "marisol",
  }),
  event({
    id: "chs-waterfront",
    chapterId: "charleston",
    title: "Waterfront Evening Walk",
    mode: "walk",
    day: 15,
    startMinute: 19 * 60,
    meetingArea: "Waterfront Park, Pineapple Fountain",
    distanceOptions: [1, 2],
    paceNote: "Family-friendly, strollers welcome.",
    access: ["step-free", "restrooms", "transit", "short-option"],
    capacity: 45,
    backgroundRsvps: 22,
    status: "published",
    createdBy: "theo",
    sweep: "theo",
  }),
  event({
    id: "nyc-prospect",
    chapterId: "nyc",
    title: "Prospect Park Loop",
    mode: "mixed",
    day: 15,
    startMinute: 8 * 60,
    meetingArea: "Grand Army Plaza entrance",
    distanceOptions: [1, 3.35],
    paceNote: "One loop or a single mile — both finish together.",
    access: ["restrooms", "transit", "short-option"],
    capacity: 50,
    backgroundRsvps: 27,
    status: "published",
    createdBy: "grace",
    sweep: "grace",
  }),
  event({
    id: "la-griffith",
    chapterId: "la",
    title: "Griffith Park First Mile",
    mode: "mixed",
    day: 15,
    startMinute: 8 * 60,
    meetingArea: "Griffith Park, Fern Dell entrance",
    distanceOptions: [1, 3],
    paceNote: "Shade most of the way. One mile or three, all paces welcome.",
    access: ["shade", "restrooms", "short-option"],
    capacity: 40,
    backgroundRsvps: 14,
    status: "published",
    createdBy: "lena",
    sweep: "lena",
  }),
  event({
    id: "dur-tobacco",
    chapterId: "durham",
    title: "Tobacco Trail Saturday Walk",
    mode: "walk",
    day: 14,
    startMinute: 8 * 60 + 30,
    meetingArea: "American Tobacco Trail, Morehead Avenue trailhead",
    distanceOptions: [1, 2.5],
    paceNote: "Flat, shaded trail. Strollers and chairs welcome.",
    access: ["step-free", "shade", "short-option"],
    capacity: 40,
    backgroundRsvps: 11,
    status: "published",
    createdBy: "dee",
    sweep: "dee",
  }),
  event({
    id: "mtl-canal",
    chapterId: "montreal",
    title: "Lachine Canal First Mile",
    mode: "walk",
    day: 14,
    startMinute: 9 * 60,
    meetingArea: "Lachine Canal, Atwater Market steps",
    distanceOptions: [1, 3],
    paceNote: "Flat canal path. One mile or three, every pace.",
    access: ["step-free", "restrooms", "short-option"],
    capacity: 40,
    backgroundRsvps: 9,
    status: "published",
    createdBy: "amelie",
    sweep: "amelie",
  }),
];

const PARTNERS: Partner[] = [
  {
    id: "northline",
    name: "Northline Outfitters",
    kind: "brand",
    wants: "To be seen helping beginners start in Detroit and Charleston, with proof our stores can share.",
    fixture: true,
  },
  {
    id: "lakeshore",
    name: "Lakeshore Logistics",
    kind: "workplace",
    wants: "A summer season for 1,200 employees that isn't another step contest.",
    fixture: true,
  },
  {
    id: "riverside",
    name: "Riverside Parks & Recreation",
    kind: "city",
    wants: "More residents using the parks we already maintain, especially people who don't today.",
    fixture: true,
  },
];

/** V2 parity: fee 7,500 and delivery 2,800 (= 6 events × $250 + 6 × $100 stipends + $700 creative and report). */
export const NORTHLINE_DEFAULTS: ProposalInputs = {
  product: "first-mile-series",
  communities: 2,
  eventsPerCommunity: 3,
  fee: 7500,
  costPerEvent: 250,
  organizerStipendPerEvent: 100,
  creativeAndReporting: 700,
  staffHours: 24,
  staffRate: 45,
  paymentFeePct: 0,
  impactPct: 15,
};

function proposal(id: string, partnerId: string, stage: Proposal["stage"], inputs: ProposalInputs): Proposal {
  return {
    id,
    partnerId,
    inputs,
    stage,
    signedAt: null,
    override: null,
    paidAt: null,
    chapterIds: [],
    fundedEventIds: [],
    offerClicks: 0,
    offerClickers: [],
    issuedCodes: [],
    redemptions: [],
    reportedAt: null,
  };
}

const PROPOSALS: Proposal[] = [
  proposal("pr-northline", "northline", "proposal", NORTHLINE_DEFAULTS),
  proposal("pr-lakeshore", "lakeshore", "qualified", {
    product: "workplace-season",
    communities: 1,
    eventsPerCommunity: 6,
    fee: 12000,
    costPerEvent: 300,
    organizerStipendPerEvent: 120,
    creativeAndReporting: 900,
    staffHours: 40,
    staffRate: 45,
    paymentFeePct: 0,
    impactPct: 10,
  }),
  proposal("pr-riverside", "riverside", "inquiry", {
    product: "city-season",
    communities: 3,
    eventsPerCommunity: 4,
    fee: 18000,
    costPerEvent: 350,
    organizerStipendPerEvent: 120,
    creativeAndReporting: 1500,
    staffHours: 60,
    staffRate: 45,
    paymentFeePct: 0,
    impactPct: 15,
  }),
];

const PROGRAMS: ImpactProgram[] = [
  {
    id: "neighborhood",
    name: "First-Mile Neighborhood Walks",
    backgroundVotes: 21,
    fundedAt: null,
    what: "Underwrite three welcoming, accessible beginner walks led by approved local organizers, each with a sweep.",
    cost: 750,
    stage: "proposed",
    votes: [],
    funded: 0,
    evidenceEventIds: [],
    chapterIds: ["detroit"],
  },
  {
    id: "leaders",
    name: "Community Leader Toolkit",
    backgroundVotes: 9,
    fundedAt: null,
    what: "Ten organizer kits: first-aid basics, a sweep vest, a printed welcome script and heat-day guidance.",
    cost: 800,
    stage: "proposed",
    votes: [],
    funded: 0,
    evidenceEventIds: [],
    chapterIds: ["detroit", "charleston"],
  },
  {
    id: "access",
    name: "Accessible Participation Fund",
    backgroundVotes: 14,
    fundedAt: null,
    what: "Two local projects chosen with members: shade and seating at a start line, or a loaned all-terrain chair.",
    cost: 1200,
    stage: "proposed",
    votes: [],
    funded: 0,
    evidenceEventIds: [],
    chapterIds: ["detroit"],
  },
];

function byId<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

export function seedWorld(): World {
  const world: World = {
    seq: 0,
    clock: OPENING_TICK,
    members: byId(structuredClone([...MEMBERS, ...LEADS])),
    activities: byId(structuredClone(ACTIVITIES)),
    chapters: byId(structuredClone(CHAPTERS)),
    events: byId(structuredClone(EVENTS)),
    partners: byId(structuredClone(PARTNERS)),
    proposals: byId(structuredClone(PROPOSALS)),
    programs: byId(structuredClone(PROGRAMS)),
    impact: { selectedProgram: "neighborhood", disbursed: 0 },
    coach: { activeRuleset: "v1", candidate: null, drift: false, sessions: [], answers: {} },
    scenario: { year: 2027, partners: 8, partnerAvg: 7500, workplaces: 4, workplaceAvg: 12000 },
    projections: { chapterSharedMiles: {} },
    pendingRetries: [],
    egress: [],
  };
  rebuildProjections(world);
  return world;
}
