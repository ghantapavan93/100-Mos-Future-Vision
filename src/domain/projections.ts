// Read models. A production app would keep a chapter's shared-miles total in a
// table updated as activities arrive (a materialised view), not recompute it
// on every page load. The engine does the same here — `refreshChapters` after
// each change — so the X-Ray can show what happens when that cached view and
// the activity table disagree, and prove a rebuild fixes it.

import { decide } from "./policy";
import type { Activity, ChapterId, World } from "./types";

export interface ChapterTotal {
  chapterId: ChapterId;
  /** Fictional miles of members who are not modelled individually. */
  background: number;
  /** Miles from modelled members that policy and consent allow into the total. */
  included: number;
  total: number;
  /** Miles that exist but were kept out, grouped by the rule that kept them out. */
  excluded: { ruleId: string; miles: number; records: number }[];
  /** Attributions that must travel with this total (GARMIN-04, X-01). */
  attributions: string[];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * The chapter total, computed from scratch from the activity table. This is the
 * definition of truth; the projection is only a cache of it.
 */
export function chapterTotalFromLedger(world: World, chapterId: ChapterId): ChapterTotal {
  const chapter = world.chapters[chapterId];
  if (!chapter) throw new Error(`Unknown chapter ${chapterId}`);
  let included = 0;
  const excluded = new Map<string, { miles: number; records: number }>();
  const attributions = new Set<string>();

  for (const memberId of chapter.members) {
    const member = world.members[memberId];
    if (!member) continue;
    for (const activity of activitiesOf(world, memberId)) {
      if (activity.status !== "counted" && activity.status !== "owner-panel") continue;
      const decision = decide(`activity:${activity.source}`, "chapter-total", member.consents);
      if (decision.allow && activity.status === "counted") {
        included += activity.distanceMi;
        if (decision.attribution) {
          const model = member.connections.garmin.deviceModel;
          attributions.add(model ? model : decision.attribution);
        }
      } else {
        const bucket = excluded.get(decision.ruleId) ?? { miles: 0, records: 0 };
        bucket.miles += activity.distanceMi;
        bucket.records += 1;
        excluded.set(decision.ruleId, bucket);
      }
    }
  }

  return {
    chapterId,
    background: chapter.backgroundSharedMiles,
    included: round1(included),
    total: round1(chapter.backgroundSharedMiles + included),
    excluded: [...excluded.entries()].map(([ruleId, v]) => ({ ruleId, miles: round1(v.miles), records: v.records })),
    attributions: [...attributions].sort(),
  };
}

export function activitiesOf(world: World, memberId: string): Activity[] {
  return Object.values(world.activities)
    .filter((a) => a.memberId === memberId)
    .sort((a, b) => a.startedAt - b.startedAt || a.id.localeCompare(b.id));
}

/** Update the cached totals for the given chapters (or all). */
export function refreshChapters(world: World, chapterIds?: Iterable<ChapterId>): void {
  const ids = chapterIds ? [...chapterIds] : Object.keys(world.chapters);
  for (const id of ids) {
    if (!world.chapters[id]) continue;
    world.projections.chapterSharedMiles[id] = chapterTotalFromLedger(world, id).total;
  }
}

export function rebuildProjections(world: World): void {
  world.projections.chapterSharedMiles = {};
  refreshChapters(world);
}

export interface ProjectionDrift {
  chapterId: ChapterId;
  displayed: number;
  fromLedger: number;
}

/** Compare every cached total with its definition. An empty list means the screens tell the truth. */
export function verifyProjections(world: World): ProjectionDrift[] {
  const drift: ProjectionDrift[] = [];
  for (const id of Object.keys(world.chapters)) {
    const displayed = world.projections.chapterSharedMiles[id] ?? Number.NaN;
    const fromLedger = chapterTotalFromLedger(world, id).total;
    if (Math.abs(displayed - fromLedger) > 0.05 || Number.isNaN(displayed)) drift.push({ chapterId: id, displayed, fromLedger });
  }
  return drift;
}

/** Chapters whose totals a member's records can affect. */
export function chaptersTouchedBy(world: World, memberId: string): ChapterId[] {
  const member = world.members[memberId];
  if (!member) return [];
  return Object.values(world.chapters)
    .filter((c) => c.members.includes(memberId))
    .map((c) => c.id);
}
