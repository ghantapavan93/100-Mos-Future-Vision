// The Community Value Report: what one commission delivered, read from the
// world as it is. It counts only organizer check-ins at the program's own walks
// — never Strava, health apps or hand-logged miles — never names a participant,
// and hides any group under 10. The buyer's copy exists only once the report
// has been sent (the egress row in ADVANCE_DEAL); Kayla's copy adds the money
// and the modelled crowd, which a buyer never sees.

import { dayLabel } from "../calendar";
import { campaignReport, type CampaignReport } from "../engine";
import type { Actor, ActivitySource, ChapterId, World } from "../types";
import { commissionOf, deliverablesOf, moneyOf, suppressCells, walksOf, type Cell, type CommissionMoney, type Deliverables } from "./model";

export type Audience = "buyer" | "founder";

/** How many walks make someone a regular. */
export const REGULAR_WALKS = 4;

export interface CityLine {
  chapterId: ChapterId;
  city: string;
  /** Who hosted, as the reader may see it. */
  hostedBy: string;
  held: number;
  canceled: number;
  pending: number;
  people: Cell;
  firstWalks: Cell;
  cameBack: Cell;
  regulars: Cell;
}

export interface ValueReport {
  audience: Audience;
  buyer: string;
  /** Sent to the buyer (the egress row exists). */
  sentOn: string | null;
  window: { from: string; to: string } | null;
  deliverables: Deliverables;
  cities: CityLine[];
  totals: { people: Cell; firstWalks: Cell; cameBack: Cell; regulars: Cell };
  /** Check-ins by name, as the sent report's egress row states it. */
  checkIns: CampaignReport["attendance"];
  canceled: { city: string; day: string; reason: string; rerun: boolean }[];
  unfulfilled: { city: string; count: number; reasons: string[] }[];
  sources: { used: string; excluded: string[] };
  ruleIds: string[];
  /** Kayla's copy only: the fictional crowd behind the named check-ins. Never a count of real people. */
  modelledCrowd?: number;
  /** Kayla's copy only. */
  money?: CommissionMoney;
}

export type ReportResult = { ok: true; report: ValueReport } | { ok: false; reason: string };

const EXCLUDED: Record<Exclude<ActivitySource, "event_checkin">, string> = {
  strava: "Strava",
  healthkit: "Apple Health",
  health_connect: "Health Connect",
  garmin: "Garmin",
  manual: "miles logged by hand",
};

export function valueReport(w: World, commissionId: string, viewer: Actor): ReportResult {
  const c = commissionOf(w, commissionId);
  if (!c) return { ok: false, reason: "No such commission." };
  const p = w.proposals[c.proposalId]!;
  const audience: Audience | null = viewer.role === "founder" ? "founder" : viewer.role === "partner" && viewer.id === c.buyerId ? "buyer" : null;
  if (!audience) return { ok: false, reason: "Only the buyer and Kayla's team can see this report." };
  if (audience === "buyer" && p.reportedAt === null) return { ok: false, reason: "The report hasn't been sent yet." };

  const walks = walksOf(w, c);
  const deliverables = deliverablesOf(w, c);
  const visible = c.cities.filter((x) => x.coverage !== "descoped");

  // Per city: how many of this program's completed walks each named person checked in at.
  const visits = visible.map((city) => {
    const seen = new Map<string, number>();
    let firsts = 0;
    for (const walk of walks) {
      if (walk.event.chapterId !== city.chapterId || walk.status !== "completed") continue;
      for (const ci of walk.event.checkIns) {
        seen.set(ci.memberId, (seen.get(ci.memberId) ?? 0) + 1);
        if (ci.firstEvent) firsts++;
      }
    }
    const counts = [...seen.values()];
    return { people: counts.length, firstWalks: firsts, cameBack: counts.filter((n) => n >= 2).length, regulars: counts.filter((n) => n >= REGULAR_WALKS).length };
  });
  const metric = (k: keyof (typeof visits)[number]) => suppressCells(visits.map((v) => v[k]), visits.reduce((s, v) => s + v[k], 0));
  const people = metric("people");
  const firstWalks = metric("firstWalks");
  const cameBack = metric("cameBack");
  const regulars = metric("regulars");

  const cities: CityLine[] = visible.map((city, i) => {
    const chapter = w.chapters[city.chapterId]!;
    const mine = walks.filter((x) => x.event.chapterId === city.chapterId);
    const hostedBy = city.coverage === "crew" ? "Partner crew" : audience === "founder" ? `City Lead (${chapter.leadName})` : "City Lead";
    return {
      chapterId: city.chapterId,
      city: chapter.city,
      hostedBy,
      held: mine.filter((x) => x.status === "completed").length,
      canceled: mine.filter((x) => x.status === "canceled").length,
      pending: mine.filter((x) => x.status === "pending").length,
      people: people.cells[i]!,
      firstWalks: firstWalks.cells[i]!,
      cameBack: cameBack.cells[i]!,
      regulars: regulars.cells[i]!,
    };
  });

  const days = walks.map((x) => x.event.day);
  const report: ValueReport = {
    audience,
    buyer: w.partners[c.buyerId]?.name ?? c.buyerId,
    sentOn: p.reportedAt === null ? null : dayLabel(Math.floor(p.reportedAt / 1440)),
    window: days.length ? { from: dayLabel(Math.min(...days)), to: dayLabel(Math.max(...days)) } : null,
    deliverables,
    cities,
    totals: { people: people.total, firstWalks: firstWalks.total, cameBack: cameBack.total, regulars: regulars.total },
    checkIns: campaignReport(w, p.id).attendance,
    canceled: walks
      .filter((x) => x.status === "canceled")
      .map((x) => ({ city: w.chapters[x.event.chapterId]!.city, day: dayLabel(x.event.day), reason: x.event.cancelReason ?? "no reason given", rerun: x.rerunBy !== null })),
    unfulfilled: deliverables.byCity.filter((x) => x.unfulfilled > 0).map((x) => ({ city: x.city, count: x.unfulfilled, reasons: x.reasons })),
    sources: { used: "Check-ins an organizer recorded at this program's walks", excluded: Object.values(EXCLUDED) },
    ruleIds: ["OURS-COUNTS-NOT-PEOPLE", "OURS-SMALL-GROUPS"],
  };
  if (audience === "founder") {
    report.modelledCrowd = walks.filter((x) => x.status === "completed").reduce((s, x) => s + (x.event.backgroundAttended ?? 0), 0);
    report.money = moneyOf(w, c);
  }
  return { ok: true, report };
}
