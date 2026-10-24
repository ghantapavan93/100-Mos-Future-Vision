"use client";

// Live consistency checks: do the screens agree with the ledger, what is
// waiting to retry, what was quarantined, what sits in Strava's private cache,
// and what has ever left a member's hands (the egress log).

import type { ReactNode } from "react";
import { tickLabel } from "@/domain/calendar";
import { chapterTotalFromLedger } from "@/domain/projections";
import { ledgerHealth } from "@/domain/selectors";
import { Badge, Button, RuleChip, cn } from "@/components/ui/kit";
import { actors, store, useWorld } from "@/lib/store";

function Panel({ title, status, children, wide }: { title: string; status: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <section className={cn("card flex flex-col p-4", wide && "md:col-span-2")} aria-label={title}>
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-[15px] font-semibold">{title}</h4>
        {status}
      </div>
      <div className="mt-3 min-w-0 flex-1 text-[13.5px]">{children}</div>
    </section>
  );
}

export function Consistency() {
  const w = useWorld();
  const health = ledgerHealth(w);
  const hours = (t: number) => Math.round((t - w.clock) / 60);
  const purgedByRule = health.purged.reduce<Record<string, number>>((acc, a) => {
    const rule = a.removal?.ruleId ?? "OWNER";
    acc[rule] = (acc[rule] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <Panel
        title="Screens vs ledger"
        status={health.drift.length ? <Badge tone="bad">{health.drift.length} disagree</Badge> : <Badge tone="ok">All agree</Badge>}
      >
        <p className="text-muted">Each chapter total on screen is a cached read model. Here it is recomputed from the activity table.</p>
        <table className="mt-3 w-full font-mono text-[12px]">
          <thead>
            <tr className="text-left text-muted">
              <th className="py-1 font-normal">chapter</th>
              <th className="py-1 text-right font-normal">on screen</th>
              <th className="py-1 text-right font-normal">ledger</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(w.chapters).map((c) => {
              const shown = w.projections.chapterSharedMiles[c.id] ?? 0;
              const truth = chapterTotalFromLedger(w, c.id).total;
              const off = Math.abs(shown - truth) > 0.05;
              return (
                <tr key={c.id} className={cn("border-t border-line", off && "text-bad")}>
                  <td className="py-1.5">{c.city}</td>
                  <td className="py-1.5 text-right">{shown.toLocaleString("en-US")}</td>
                  <td className="py-1.5 text-right">
                    {truth.toLocaleString("en-US")}
                    {off ? " ≠" : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {health.drift.length ? (
          <Button className="mt-3 w-full" variant="primary" onClick={() => store.dispatch({ type: "REBUILD_PROJECTIONS", payload: {} }, actors.engineer, { via: "consistency" })}>
            Rebuild from the ledger
          </Button>
        ) : null}
      </Panel>

      <Panel title="Retry queue" status={health.pendingRetries.length ? <Badge tone="warn">{health.pendingRetries.length} waiting</Badge> : <Badge tone="ok">Empty</Badge>}>
        {health.pendingRetries.length ? (
          <>
            <ul className="space-y-1 font-mono text-[12px]">
              {health.pendingRetries.map((p) => (
                <li key={p.key}>{p.key}</li>
              ))}
            </ul>
            <p className="mt-2 text-muted">Each key is an idempotency key: a retry can apply at most once.</p>
            <Button className="mt-3 w-full" variant="primary" onClick={() => store.dispatch({ type: "RETRY_PENDING", payload: {} }, actors.system, { via: "consistency" })}>
              Retry now
            </Button>
          </>
        ) : (
          <p className="text-muted">Nothing timed out. A provider timeout lands here and is retried under its idempotency key.</p>
        )}
      </Panel>

      <Panel title="Quarantine" status={health.quarantined.length ? <Badge tone="warn">{health.quarantined.length} held</Badge> : <Badge tone="ok">Empty</Badge>}>
        {health.quarantined.length ? (
          <ul className="space-y-1.5">
            {health.quarantined.map((a) => {
              // Staff see first-party records; provider records stay unattributed here (STRAVA-01, HC-05).
              const firstParty = a.source === "manual" || a.source === "event_checkin";
              return (
                <li key={a.id} className="font-mono text-[12px]">
                  {a.source.replace("_", " ")} record{firstParty ? ` · ${w.members[a.memberId]?.name ?? "a member"}` : " · member not shown"} · <span className="text-warn">{a.removal?.reason}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-muted">No malformed records. Anything missing a distance, or implausible, is held here and counted nowhere.</p>
        )}
      </Panel>

      <Panel title="Strava private cache" status={<RuleChip id="STRAVA-05" />}>
        {health.stravaPanel.length ? (
          <div className="space-y-2">
            <p className="font-mono text-[12.5px]">
              {health.stravaPanel.length} record{health.stravaPanel.length === 1 ? "" : "s"} cached · soonest expiry in{" "}
              {hours(Math.min(...health.stravaPanel.map((a) => a.expiresAt ?? Infinity)))} h
            </p>
            <p className="text-[12.5px] text-muted">An operational check only. Whose they are, and what they say, is shown to their owners and nobody else — including here.</p>
          </div>
        ) : (
          <p className="text-muted">Empty. Strava records live here for at most 7 days, visible only to their owner, never counted.</p>
        )}
      </Panel>

      <Panel title="Reconciliation" status={<Badge>{health.superseded.length + health.purged.length} handled</Badge>}>
        <dl className="grid grid-cols-[1fr_auto] gap-y-1.5">
          <dt className="text-muted">Superseded (same outing, kept once)</dt>
          <dd className="num text-right">{health.superseded.length}</dd>
          {Object.entries(purgedByRule).map(([rule, n]) => (
            <div key={rule} className="contents">
              <dt className="flex items-center gap-2 text-muted">
                Removed by <RuleChip id={rule} />
              </dt>
              <dd className="num text-right">{n}</dd>
            </div>
          ))}
        </dl>
        {health.purged.length === 0 ? <p className="mt-2 text-muted">Nothing removed yet. Disconnecting a source or Strava's cache expiring removes records here.</p> : null}
      </Panel>

      <Panel title="Egress log" status={<RuleChip id="X-04" />} wide>
        {health.egress.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-[12.5px]">
              <thead>
                <tr className="text-left font-mono text-[11px] uppercase tracking-[0.06em] text-muted">
                  <th className="py-1 font-normal">#</th>
                  <th className="py-1 font-normal">when</th>
                  <th className="py-1 font-normal">recipient</th>
                  <th className="py-1 font-normal">what left</th>
                  <th className="py-1 font-normal">lineage</th>
                  <th className="py-1 font-normal">rules</th>
                </tr>
              </thead>
              <tbody>
                {health.egress.map((e) => (
                  <tr key={e.seq} className="border-t border-line align-top">
                    <td className="num py-1.5 pr-2">{e.seq}</td>
                    <td className="py-1.5 pr-2 font-mono text-[11.5px] text-muted">{tickLabel(e.at)}</td>
                    <td className="py-1.5 pr-2">{e.recipient}</td>
                    <td className="py-1.5 pr-2">{e.what}</td>
                    <td className="py-1.5 pr-2 font-mono text-[11.5px]">{e.lineage.join(", ") || "member opt-in"}</td>
                    <td className="py-1.5">
                      <div className="flex flex-wrap gap-1">
                        {e.ruleIds.map((r) => (
                          <RuleChip key={r} id={r} />
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted">Nothing has left any member's hands. Every disclosure to a partner writes a row here — recipient, purpose, rules and source lineage — and an export without a row cannot happen.</p>
        )}
      </Panel>
    </div>
  );
}
