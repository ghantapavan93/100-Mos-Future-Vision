// Read-only views of the world for each lens. Components call these and never
// compute their own totals, so the member app, the organizer console, the
// partner report and the founder console cannot disagree.

import { SEASON, dayOf, daysLeft } from "./calendar";
import { campaignReport, impactPool, seasonMiles } from "./engine";
import { contributionBand, economics } from "./finance";
import { decide } from "./policy";
import { activitiesOf, chapterTotalFromLedger, verifyProjections } from "./projections";
import type { Activity, ActivitySource, ChapterId, Member, MemberId, MovementEvent, World } from "./types";

const round1 = (n: number) => Math.round(n * 10) / 10;

export const SOURCE_LABEL: Record<ActivitySource, string> = {
  manual: "Logged by you",
  event_checkin: "Event check-in",
  strava: "Strava",
  healthkit: "Apple Health",
  health_connect: "Health Connect",
  garmin: "Garmin",
};

export interface SourceLine {
  source: ActivitySource;
  miles: number;
  records: number;
  /** In the member's own season total. */
  counted: boolean;
  /** Reaches the chapter total under current consent. */
  chapter: { allow: boolean; ruleId: string };
  /** Reaches the coach under current consent. */
  coach: { allow: boolean; ruleId: string };
}

export interface MemberView {
  member: Member;
  miles: number;
  goal: { value: number; target: number; pct: number; unit: "mi" | "events" };
  /** Miles a week from now to Aug 31 to reach the goal — Kayla's public pacing is about 25 a month. */
  weeklyNeeded: number;
  daysLeft: number;
  sources: SourceLine[];
  strava: { records: Activity[]; miles: number; soonestExpiry: number | null } | null;
  recent: Activity[];
  upcoming: (MovementEvent & { going: boolean; waitlisted: boolean; fits: boolean })[];
}

export function memberView(w: World, id: MemberId): MemberView {
  const member = w.members[id];
  if (!member) throw new Error(`Unknown member ${id}`);
  const all = activitiesOf(w, id);
  const miles = seasonMiles(w, id);
  const bySource = new Map<ActivitySource, { miles: number; records: number }>();
  for (const a of all) {
    if (a.status !== "counted" && a.status !== "owner-panel") continue;
    const s = bySource.get(a.source) ?? { miles: 0, records: 0 };
    s.miles += a.distanceMi;
    s.records += 1;
    bySource.set(a.source, s);
  }
  const sources: SourceLine[] = [...bySource.entries()].map(([source, s]) => ({
    source,
    miles: round1(s.miles),
    records: s.records,
    counted: decide(`activity:${source}`, "season-total").allow,
    chapter: decide(`activity:${source}`, "chapter-total", member.consents),
    coach: decide(`activity:${source}`, "ai-coaching", member.consents),
  }));

  const stravaRecords = all.filter((a) => a.source === "strava" && a.status === "owner-panel");
  const strava =
    member.connections.strava.status === "connected" || stravaRecords.length
      ? {
          records: stravaRecords,
          miles: round1(stravaRecords.reduce((s, a) => s + a.distanceMi, 0)),
          soonestExpiry: stravaRecords.length ? Math.min(...stravaRecords.map((a) => a.expiresAt ?? Infinity)) : null,
        }
      : null;

  // An "events" goal means different things to an organizer (newcomers welcomed) and to anyone else (events attended).
  const organizes = Object.values(w.chapters).some((c) => c.organizers.includes(id));
  const eventsAttended = Object.values(w.events).filter((e) => e.checkIns.some((c) => c.memberId === id)).length;
  const welcomed = Object.values(w.events)
    .filter((e) => e.sweep === id || e.createdBy === id)
    .reduce((s, e) => s + e.checkIns.filter((c) => c.firstEvent && c.memberId !== id).length, 0);
  const goal =
    member.goal.kind === "events"
      ? { value: organizes ? welcomed : eventsAttended, target: member.goal.target, unit: "events" as const }
      : { value: miles, target: member.goal.target, unit: "mi" as const };

  const left = daysLeft(w.clock);
  const remaining = Math.max(0, goal.target - goal.value);
  const chapterId = member.chapterId ?? member.homeChapterId;
  const upcoming = Object.values(w.events)
    .filter((e) => e.chapterId === chapterId && (e.status === "published" || e.status === "cancelled") && e.day >= dayOf(w.clock))
    .sort((a, b) => a.day - b.day || a.startMinute - b.startMinute)
    .map((e) => ({ ...e, going: e.rsvps.includes(id), waitlisted: e.waitlist.includes(id), fits: member.needs.every((n) => e.access.includes(n)) }));

  return {
    member,
    miles,
    goal: { ...goal, pct: Math.min(100, Math.round((goal.value / goal.target) * 100)) },
    weeklyNeeded: goal.unit === "mi" ? round1(remaining / Math.max(1, left / 7)) : 0,
    daysLeft: left,
    sources,
    strava,
    // Deleted Strava records are tombstones with no data; there is nothing to show.
    recent: [...all].filter((a) => !(a.source === "strava" && a.status === "purged")).reverse().slice(0, 8),
    upcoming,
  };
}

export interface ChapterView {
  chapterId: ChapterId;
  city: string;
  name: string;
  leadName: string;
  note: string;
  /** What a production read model would display: the cached projection. */
  displayedTotal: number;
  /** The same total computed from the activity table. Equal unless a fault corrupted the cache. */
  ledger: ReturnType<typeof chapterTotalFromLedger>;
  members: number;
  modelledMembers: Member[];
  events: MovementEvent[];
  queue: MovementEvent[];
}

export function chapterView(w: World, chapterId: ChapterId): ChapterView {
  const c = w.chapters[chapterId];
  if (!c) throw new Error(`Unknown chapter ${chapterId}`);
  const events = Object.values(w.events)
    .filter((e) => e.chapterId === chapterId)
    .sort((a, b) => a.day - b.day || a.startMinute - b.startMinute);
  return {
    chapterId,
    city: c.city,
    name: c.name,
    leadName: c.leadName,
    note: c.note,
    displayedTotal: w.projections.chapterSharedMiles[chapterId] ?? 0,
    ledger: chapterTotalFromLedger(w, chapterId),
    members: c.backgroundMembers + c.members.length,
    modelledMembers: c.members.map((m) => w.members[m]).filter((m): m is Member => Boolean(m)),
    events,
    queue: events.filter((e) => e.status === "submitted" || e.status === "draft"),
  };
}

/** What an organizer may see about the people coming: a first name, and access needs only if the member shared them. Never activity. */
export function roster(w: World, eventId: string) {
  const e = w.events[eventId];
  if (!e) return { named: [], waitlist: [], background: 0 };
  const line = (id: string) => {
    const m = w.members[id];
    if (!m) return { id, label: id, needs: [], needsShared: false, sweep: false };
    const shared = decide("access-needs", "organizer-roster", m.consents).allow;
    return { id, label: m.name, needs: shared ? m.needs : [], needsShared: shared, sweep: e.sweep === id };
  };
  return { named: e.rsvps.map(line), waitlist: e.waitlist.map(line), background: e.backgroundRsvps };
}

export function partnerView(w: World, proposalId: string) {
  const p = w.proposals[proposalId];
  if (!p) throw new Error(`Unknown proposal ${proposalId}`);
  return {
    proposal: p,
    partner: w.partners[p.partnerId]!,
    economics: economics(p.inputs),
    band: contributionBand(p.inputs),
    report: campaignReport(w, proposalId),
    egress: w.egress.filter((e) => e.recipient === w.partners[p.partnerId]!.name),
    fundedEvents: p.fundedEventIds.map((id) => w.events[id]).filter((e): e is MovementEvent => Boolean(e)),
  };
}

export function founderView(w: World) {
  const proposals = Object.values(w.proposals);
  const signed = proposals.filter((p) => p.signedAt !== null && p.stage !== "lost");
  const pipeline = proposals.filter((p) => p.signedAt === null && p.stage !== "lost");
  const sum = (ps: typeof proposals, f: (e: ReturnType<typeof economics>) => number) => ps.reduce((s, p) => s + f(economics(p.inputs)), 0);
  const chapters = Object.values(w.chapters).map((c) => {
    const events = Object.values(w.events).filter((e) => e.chapterId === c.id && e.status !== "cancelled" && e.status !== "draft");
    const organizers = Math.max(1, c.organizers.length);
    return {
      id: c.id,
      city: c.city,
      leadName: c.leadName,
      members: c.backgroundMembers + c.members.length,
      events: events.length,
      eventsPerOrganizer: Math.round((events.length / organizers) * 10) / 10,
      queue: Object.values(w.events).filter((e) => e.chapterId === c.id && e.status === "submitted").length,
      cancelled: Object.values(w.events).filter((e) => e.chapterId === c.id && e.status === "cancelled").length,
      total: w.projections.chapterSharedMiles[c.id] ?? 0,
    };
  });
  const risks: { id: string; text: string; lens: string }[] = [];
  for (const p of proposals) {
    const e = economics(p.inputs);
    const name = w.partners[p.partnerId]!.name;
    if (e.contribution < 0 && p.stage !== "lost") risks.push({ id: `neg-${p.id}`, text: `${name} loses ${Math.abs(e.contribution).toLocaleString("en-US")} dollars as priced.`, lens: "/partner" });
  }
  for (const c of chapters) if (c.eventsPerOrganizer >= 4) risks.push({ id: `load-${c.id}`, text: `${c.city}: ${c.eventsPerOrganizer} events per organizer. Burnout risk; recruit a co-lead.`, lens: "/circles" });
  const drift = verifyProjections(w);
  if (drift.length) risks.push({ id: "drift", text: `${drift.length} chapter total${drift.length === 1 ? "" : "s"} on screen disagree with the ledger.`, lens: "/xray" });
  const pool = impactPool(w);
  return {
    signedRevenue: sum(signed, (e) => e.revenue),
    signedContribution: sum(signed, (e) => e.contribution),
    pipelineRevenue: sum(pipeline, (e) => e.revenue),
    pipelineContribution: sum(pipeline, (e) => e.contribution),
    signed,
    pipeline,
    pool,
    chapters,
    risks,
    members: Object.values(w.chapters).reduce((s, c) => s + c.backgroundMembers + c.members.length, 0),
    seasonDay: dayOf(w.clock) + 1,
    seasonDays: SEASON.days,
  };
}

export function ledgerHealth(w: World) {
  const all = Object.values(w.activities);
  return {
    drift: verifyProjections(w),
    quarantined: all.filter((a) => a.status === "quarantined"),
    superseded: all.filter((a) => a.status === "superseded"),
    purged: all.filter((a) => a.status === "purged"),
    stravaPanel: all.filter((a) => a.status === "owner-panel"),
    pendingRetries: w.pendingRetries,
    egress: w.egress,
  };
}
