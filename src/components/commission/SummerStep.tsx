"use client";

// Step 5, the summer. The walks go on the calendar as submissions with no
// sweep and no access claims, as every funded walk does. Playing a week runs
// what the cities would do — name a sweep, publish, check people in, mark it
// done — as real commands. A heat forecast stops the week the evening before
// the walk it hits: move it to the early start, cancel it, or cancel and rerun
// it a week later at the cost of one more walk.

import { useState } from "react";
import { dayLabel, timeLabel } from "@/domain/calendar";
import type { Receipt } from "@/domain/engine";
import { usd } from "@/domain/finance";
import { activeCities, walksOf, type Walk } from "@/domain/commission/model";
import { organizerFor, runToEnd, runWeek, weeksIn } from "@/domain/commission/planner";
import type { World } from "@/domain/types";
import { cn } from "@/components/ui/kit";
import type { Flow } from "./flow";
import { MoveButton, ReceiptLine, dealStep, lastReceipt } from "./parts";
import { commissionStore } from "./store";

const founder = { role: "founder", id: "kayla" } as const;

/** "May 23" from "Sun, May 23". */
const shortDay = (day: number) => dayLabel(day).split(", ")[1] ?? dayLabel(day);

function WalkCell({ walk }: { walk: Walk }) {
  const e = walk.event;
  const firsts = e.checkIns.filter((x) => x.firstEvent).length;
  const tone =
    walk.status === "completed" ? "border-ok/50 bg-ok-soft" : walk.status === "canceled" ? "border-bad/50 bg-bad-soft" : e.status === "published" ? "border-accent/50 bg-accent/10" : "border-line border-dashed";
  return (
    <div className={cn("min-w-[92px] rounded-xl border px-2 py-1.5 text-[12px] leading-tight", tone)} data-walk={e.id} data-status={walk.status} title={e.title}>
      <div className="num font-bold">{shortDay(e.day)}</div>
      {walk.status === "completed" ? (
        <div className="text-ok">
          {e.checkIns.length} in{firsts ? ` · ${firsts} new` : ""}
        </div>
      ) : walk.status === "canceled" ? (
        <div className="text-bad">Cancelled{walk.rerunBy ? ", rerun" : ""}</div>
      ) : (
        <div className="text-muted">{e.status === "published" ? "Published" : "To prepare"}</div>
      )}
      {e.moved ? <div className="text-accent-ink">Moved to {timeLabel(e.startMinute)}</div> : null}
      {walk.makeupFor ? <div className="text-accent-ink">Makeup walk</div> : null}
    </div>
  );
}

export function SummerStep({ w, f, ledger }: { w: World; f: Flow; ledger: Receipt[] }) {
  const c = f.c!;
  const p = f.p!;
  const [busy, setBusy] = useState(false);
  const walks = walksOf(w, c);
  const weeks = weeksIn(w, c);
  const cities = activeCities(c);
  const next = walks.filter((x) => x.status === "pending").reduce((m, x) => Math.min(m, x.week), Infinity);
  const receipt = lastReceipt(ledger, ["ADVANCE_DEAL", "RESCHEDULE_EVENT", "CANCEL_EVENT", "ADD_MAKEUP_WALK", "COMPLETE_EVENT"], (_, r) => dealStep(r, "live"));
  const latest = [...walks].reverse().find((x) => x.status === "completed");
  const unrerun = p.stage === "live" ? walks.filter((x) => x.status === "canceled" && !x.rerunBy) : [];
  const perWalk = p.inputs.costPerEvent + p.inputs.organizerStipendPerEvent;

  const play = (all: boolean) => {
    setBusy(true);
    // Let the button show it's working before the engine runs the week.
    window.setTimeout(() => {
      const m = commissionStore.get().machine;
      commissionStore.absorb(all ? runToEnd(m, c.id) : runWeek(m, c.id, Number.isFinite(next) ? next : 0));
      setBusy(false);
    }, 30);
  };

  const heat = f.heat;
  const hot = heat ? w.events[heat.eventId] : undefined;
  const lead = heat ? organizerFor(w, c, heat.chapterId) : null;

  return (
    <div className="card p-5 sm:p-6" data-testid="commission-summer">
      {p.stage === "contract" ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[14.5px]">Signed. Nothing is on the calendar yet.</p>
          <MoveButton move="move-live" variant="primary" onClick={() => commissionStore.send({ type: "ADVANCE_DEAL", payload: { proposalId: p.id } }, founder)}>
            Put the walks on the calendar
          </MoveButton>
        </div>
      ) : null}

      {walks.length ? (
        <>
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <table className="w-full border-separate border-spacing-1.5 text-left" data-testid="walk-grid">
              <thead>
                <tr>
                  <th className="eyebrow pr-2 font-normal" scope="col">
                    City
                  </th>
                  {Array.from({ length: weeks }, (_, i) => (
                    <th key={i} scope="col" className="eyebrow font-normal">
                      Wk {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cities.map((city) => (
                  <tr key={city.chapterId}>
                    <th scope="row" className="whitespace-nowrap pr-2 text-[13.5px] font-bold">
                      {w.chapters[city.chapterId]?.city}
                      {city.coverage === "crew" ? <span className="block text-[11px] font-normal text-info">partner crew</span> : null}
                    </th>
                    {Array.from({ length: weeks }, (_, wk) => {
                      const here = walks.filter((x) => x.event.chapterId === city.chapterId && x.week === wk);
                      return <td key={wk}>{here.length ? here.map((x) => <WalkCell key={x.event.id} walk={x} />) : null}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {heat && hot ? (
            <div role="alert" className="mt-4 rounded-2xl border border-accent/60 bg-accent/10 p-4" data-testid="heat-alert">
              <div className="eyebrow text-accent-ink">Heat forecast · sample</div>
              <p className="mt-1 text-[15px] leading-snug">
                {heat.city}, {dayLabel(heat.day)}: heat index near {heat.heatIndexF}°F by 9 AM. The {timeLabel(hot.startMinute)} walk has {hot.backgroundRsvps + hot.rsvps.length} people coming.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <MoveButton
                  move="move-heat-early"
                  variant="primary"
                  onClick={() => commissionStore.send({ type: "RESCHEDULE_EVENT", payload: { eventId: hot.id, day: hot.day, startMinute: heat.earlyStart, reason: "Heat advisory: earlier start" } }, lead!)}
                >
                  Move it to {timeLabel(heat.earlyStart)}
                </MoveButton>
                <MoveButton move="move-heat-cancel" onClick={() => commissionStore.send({ type: "CANCEL_EVENT", payload: { eventId: hot.id, reason: "Heat advisory" } }, lead!)}>
                  Cancel it
                </MoveButton>
                <MoveButton
                  move="move-heat-rerun"
                  onClick={() => {
                    const r = commissionStore.send({ type: "CANCEL_EVENT", payload: { eventId: hot.id, reason: "Heat advisory" } }, lead!);
                    if (r.outcome === "applied") commissionStore.send({ type: "ADD_MAKEUP_WALK", payload: { commissionId: c.id, eventId: hot.id } }, founder);
                  }}
                >
                  Cancel, rerun it a week later (+{usd(perWalk)})
                </MoveButton>
              </div>
              <p className="mt-2 text-[12.5px] leading-snug text-muted">{(lead && w.members[lead.id]?.name) ?? "The lead"}, who leads it, sends the change to everyone coming. A cancelled walk is never counted as held.</p>
            </div>
          ) : null}

          {unrerun.length && !heat ? (
            <div className="mt-4 space-y-2">
              {unrerun.map((x) => (
                <div key={x.event.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line px-4 py-2.5">
                  <span className="text-[13.5px]">
                    {w.chapters[x.event.chapterId]?.city}, {dayLabel(x.event.day)}: cancelled ({x.event.cancelReason}). Unfulfilled unless it&apos;s rerun.
                  </span>
                  <MoveButton move={`move-makeup-${x.event.id}`} onClick={() => commissionStore.send({ type: "ADD_MAKEUP_WALK", payload: { commissionId: c.id, eventId: x.event.id } }, founder)}>
                    Rerun it (+{usd(perWalk)})
                  </MoveButton>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {Number.isFinite(next) && p.stage === "live" ? (
              <>
                <MoveButton move="move-week" variant="primary" disabled={busy || Boolean(heat)} onClick={() => play(false)}>
                  {busy ? "Playing…" : `Play week ${next + 1}`}
                </MoveButton>
                <MoveButton move="move-rest" disabled={busy || Boolean(heat)} onClick={() => play(true)}>
                  Play to the end
                </MoveButton>
              </>
            ) : p.stage === "live" ? (
              <p className="text-[14px]">Every walk has happened or been cancelled. The report is next.</p>
            ) : null}
          </div>

          {latest ? (
            <ol className="mt-4 grid gap-2 text-[13px] sm:grid-cols-3" aria-label="The latest walk, start to finish" data-testid="walk-workflow">
              <li className="rounded-xl border border-line px-3 py-2">
                <span className="eyebrow block">Prepared</span>
                {w.chapters[latest.event.chapterId]?.city}, {dayLabel(latest.event.day)}: sweep named, then published.
              </li>
              <li className="rounded-xl border border-line px-3 py-2">
                <span className="eyebrow block">Checked in</span>
                {latest.event.checkIns.length} people by name, {latest.event.checkIns.filter((x) => x.firstEvent).length} at their first walk.
              </li>
              <li className="rounded-xl border border-line px-3 py-2">
                <span className="eyebrow block">Done</span>
                Marked held by the {latest.event.createdBy.startsWith("crew-") ? "crew lead" : "City Lead"}.
              </li>
            </ol>
          ) : null}
        </>
      ) : p.stage !== "contract" ? (
        <p className="text-[14px] text-muted">{f.declined ? "Declined: no walks." : "The walks go on the calendar once it's signed."}</p>
      ) : null}
      {walks.length ? <ReceiptLine receipt={receipt} /> : null}
    </div>
  );
}
