"use client";

// The fault lab. Each card states a promise, injects an ordinary command
// stream with `meta.fault` set, and then checks the promise against the worlds
// before and after. Repairs are separate, explicit actions — the system detects;
// a person decides to fix.

import { useState } from "react";
import type { Receipt } from "@/domain/engine";
import { FAULTS, GROUP_LABEL, verdict, type Fault, type FaultCheck, type FaultGroup } from "@/domain/faults";
import { verifyProjections } from "@/domain/projections";
import { Badge, Button, OutcomeBadge, cn } from "@/components/ui/kit";
import { actors, store, useWorld } from "@/lib/store";

interface Result extends FaultCheck {
  receipts: Receipt[];
}

const GROUPS = Object.keys(GROUP_LABEL) as FaultGroup[];

export function FaultLab({ onShow }: { onShow: (seq: number) => void }) {
  const world = useWorld();
  const [results, setResults] = useState<Record<string, Result>>({});
  const [group, setGroup] = useState<FaultGroup | "all">("all");
  const drift = verifyProjections(world);

  const inject = (fault: Fault) => {
    const before = store.get().machine.world;
    const entries = fault.build(before, store.get().machine.ledger.length);
    const receipts = entries.map((e) => store.dispatch(e.input, e.actor, e.meta));
    const after = store.get().machine.world;
    const result = verdict(fault, before, after, receipts, entries);
    setResults((r) => ({ ...r, [fault.id]: { ...result, receipts } }));
    const last = receipts.at(-1);
    if (last) onShow(last.seq);
  };

  const shown = FAULTS.filter((f) => group === "all" || f.group === group);
  const kept = Object.values(results).filter((r) => r.kept).length;
  const broken = Object.values(results).filter((r) => !r.kept).length;

  return (
    <div>
      <div className="card flex flex-wrap items-center gap-3 p-3 sm:p-4" aria-label="Repairs">
        <span className="eyebrow mr-1">Repairs</span>
        <Button variant={drift.length ? "primary" : "secondary"} onClick={() => store.dispatch({ type: "REBUILD_PROJECTIONS", payload: {} }, actors.engineer, { via: "fault-lab" })}>
          Rebuild read models{drift.length ? ` · ${drift.length} wrong` : ""}
        </Button>
        <Button variant={world.pendingRetries.length ? "primary" : "secondary"} onClick={() => store.dispatch({ type: "RETRY_PENDING", payload: {} }, actors.system, { via: "fault-lab" })}>
          Retry pending · {world.pendingRetries.length}
        </Button>
        <Button variant={world.coach.drift ? "primary" : "secondary"} disabled={!world.coach.drift} onClick={() => store.dispatch({ type: "SET_DRIFT", payload: { on: false } }, actors.engineer, { via: "fault-lab" })}>
          {world.coach.drift ? "Turn coach drift off" : "Coach drift is off"}
        </Button>
        <span className="ml-auto text-[13px] text-muted" aria-live="polite">
          {kept + broken === 0 ? "No faults injected yet." : `${kept} promise${kept === 1 ? "" : "s"} kept${broken ? ` · ${broken} broken` : ""} this session.`}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="Fault groups">
        {(["all", ...GROUPS] as const).map((g) => (
          <button
            key={g}
            type="button"
            aria-pressed={group === g}
            onClick={() => setGroup(g)}
            className={cn("min-h-11 rounded-full border px-3 text-[13px] font-semibold", group === g ? "border-transparent bg-ink text-bg" : "border-line-strong text-muted hover:text-ink")}
          >
            {g === "all" ? `All · ${FAULTS.length}` : `${GROUP_LABEL[g]} · ${FAULTS.filter((f) => f.group === g).length}`}
          </button>
        ))}
      </div>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((f) => {
          const res = results[f.id];
          return (
            <li key={f.id} className={cn("card flex flex-col p-4", res && !res.kept && "border-bad")} data-fault={f.id}>
              <div className="flex items-center justify-between gap-2">
                <span className="eyebrow">{GROUP_LABEL[f.group]}</span>
                {res ? <Badge tone={res.kept ? "ok" : "bad"}>{res.kept ? "Promise kept" : "Promise BROKEN"}</Badge> : null}
              </div>
              <h4 className="t-card mt-2">{f.title}</h4>
              <p className="mt-1.5 text-[13.5px] leading-snug text-muted">{f.plainEnglish}</p>
              <p className="mt-3 border-l-2 border-sun pl-3 text-[14px] font-semibold leading-snug">Promise: {f.promise}</p>
              {f.sideEffect ? <p className="mt-2 text-[12px] leading-snug text-warn">Heads up: {f.sideEffect}</p> : null}
              {res ? (
                <div className="mt-3 rounded-xl bg-surface-2 p-3 text-[13px] leading-snug" aria-live="polite">
                  <p>{res.evidence}</p>
                  {res.receipts.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {res.receipts.map((r) => (
                        <button key={r.seq} type="button" onClick={() => onShow(r.seq)} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line-strong py-0.5 pl-2 pr-1 hover:border-ink" title={r.summary}>
                          <span className="num text-[11.5px]">#{r.seq}</span>
                          <OutcomeBadge outcome={r.outcome} />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="mt-auto pt-4">
                <Button variant={res ? "secondary" : "primary"} onClick={() => inject(f)} className="w-full" aria-label={`${res ? "Inject again" : "Inject"}: ${f.title}`}>
                  {res ? "Inject again" : "Inject"}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
