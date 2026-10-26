"use client";

// Step 1, the ask: a buyer, a few of Kayla's cities, a number of weeks, a
// price. The preview beside the form is economics() over the same terms the
// engine will price, so what you see before sending is what gets recorded.

import { useMemo } from "react";
import type { Receipt } from "@/domain/engine";
import { economics, usd } from "@/domain/finance";
import { BUYERS } from "@/domain/commission/fixtures";
import { activeCities, buyerOf, floorFee, quoteInputs } from "@/domain/commission/model";
import type { World } from "@/domain/types";
import { Badge, cn } from "@/components/ui/kit";
import type { Flow } from "./flow";
import { MoveButton, ReceiptLine, lastReceipt, verdict } from "./parts";
import { commissionStore } from "./store";

export interface Draft {
  buyerId: string;
  chapterIds: string[];
  weeks: number;
  fee: number;
  kickoff: boolean;
}

const founder = { role: "founder", id: "kayla" } as const;

function Chip({ on, onClick, children, disabled }: { on: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={cn("min-h-11 whitespace-nowrap rounded-full px-3.5 text-[13.5px] font-bold transition-colors disabled:opacity-40", on ? "bg-ink text-bg" : "border border-line-strong hover:border-accent")}
    >
      {children}
    </button>
  );
}

export function AskStep({ w, f, ledger, draft, setDraft }: { w: World; f: Flow; ledger: Receipt[]; draft: Draft; setDraft: (d: Draft) => void }) {
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const buyer = buyerOf(draft.buyerId) ?? BUYERS[0]!;
  const inputs = useMemo(() => quoteInputs(buyer.kind, draft.chapterIds.length, draft.weeks, draft.kickoff, draft.fee), [buyer.kind, draft]);
  const e = useMemo(() => economics(inputs), [inputs]);
  const suggested = useMemo(() => floorFee(inputs, 0.2), [inputs]);
  const v = verdict(e);
  const receipt = lastReceipt(ledger, ["CREATE_COMMISSION"]);

  if (f.c && f.p) {
    const c = f.c;
    const p = f.p;
    const b = w.partners[c.buyerId];
    const cities = c.cities.map((x) => w.chapters[x.chapterId]?.city ?? x.chapterId);
    return (
      <div className="card p-5 sm:p-6" data-testid="commission-ask">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[17px] font-bold">{b?.name}</span>
          <Badge>sample buyer</Badge>
        </div>
        <p className="mt-1 text-[14px] text-muted">{b?.wants}</p>
        <ul className="mt-4 grid gap-2 text-[14.5px] sm:grid-cols-2">
          <li>
            <span className="eyebrow block">Cities asked for</span>
            {cities.join(" · ")}
          </li>
          <li>
            <span className="eyebrow block">Weeks</span>
            <span className="num">{p.inputs.eventsPerCommunity}</span>, one walk a week in each city
          </li>
          <li>
            <span className="eyebrow block">They get</span>
            {activeCities(c).length * p.inputs.eventsPerCommunity} walks with a sweep at every one, a Community Value Report{c.kickoff ? ", and your kickoff talk" : ""}
          </li>
          <li>
            <span className="eyebrow block">Price quoted</span>
            <span className="num">{usd(c.quotedFee)}</span>
            {p.inputs.fee !== c.quotedFee ? <span className="text-muted"> · now {usd(p.inputs.fee)}</span> : null}
          </li>
        </ul>
        <ReceiptLine receipt={receipt} />
      </div>
    );
  }

  const toggleCity = (id: string) => {
    const on = draft.chapterIds.includes(id);
    if (on) set({ chapterIds: draft.chapterIds.filter((x) => x !== id) });
    else if (draft.chapterIds.length < 4) set({ chapterIds: [...draft.chapterIds, id] });
  };
  const ready = draft.chapterIds.length >= 2 && draft.chapterIds.length <= 4;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]" data-testid="commission-ask">
      <div className="card space-y-5 p-5 sm:p-6">
        <fieldset>
          <legend className="text-[13px] font-bold">Who&apos;s asking · sample buyers</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {BUYERS.map((b) => (
              <button
                key={b.id}
                type="button"
                aria-pressed={draft.buyerId === b.id}
                onClick={() => set({ buyerId: b.id })}
                className={cn("tap rounded-2xl border px-3 py-2.5 text-left transition-colors", draft.buyerId === b.id ? "border-accent bg-accent/10" : "border-line bg-surface hover:border-accent")}
              >
                <span className="block text-[14.5px] font-bold">{b.name}</span>
                <span className="block text-[12.5px] leading-snug text-muted">{b.line}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-[13px] font-bold">
            Cities <span className="font-normal text-muted">· {draft.chapterIds.length} chosen, two to four</span>
          </legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.values(w.chapters).map((ch) => (
              <Chip key={ch.id} on={draft.chapterIds.includes(ch.id)} onClick={() => toggleCity(ch.id)} disabled={!draft.chapterIds.includes(ch.id) && draft.chapterIds.length >= 4}>
                {ch.city}
              </Chip>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap gap-x-8 gap-y-5">
          <fieldset>
            <legend className="text-[13px] font-bold">Weeks</legend>
            <div className="mt-2 flex gap-2">
              {[4, 6, 8].map((n) => (
                <Chip key={n} on={draft.weeks === n} onClick={() => set({ weeks: n })}>
                  {n} weeks
                </Chip>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-[13px] font-bold">Your kickoff talk</legend>
            <div className="mt-2 flex gap-2">
              <Chip on={draft.kickoff} onClick={() => set({ kickoff: true })}>
                Included
              </Chip>
              <Chip on={!draft.kickoff} onClick={() => set({ kickoff: false })}>
                Not this time
              </Chip>
            </div>
          </fieldset>
        </div>
        <label className="block">
          <span className="text-[13px] font-bold">Price</span>
          <div className="mt-2 flex items-center gap-2">
            <button type="button" aria-label="Lower the price by $500" onClick={() => set({ fee: Math.max(500, draft.fee - 500) })} className="tap w-11 rounded-xl border border-line-strong text-[18px] font-bold hover:border-accent">
              −
            </button>
            <input
              type="number"
              inputMode="numeric"
              min={500}
              step={500}
              value={draft.fee}
              onChange={(ev) => set({ fee: Math.max(0, Math.round(Number(ev.currentTarget.value) || 0)) })}
              className="num min-h-11 w-36 rounded-xl border border-line-strong bg-bg px-3 text-[16px]"
            />
            <button type="button" aria-label="Raise the price by $500" onClick={() => set({ fee: draft.fee + 500 })} className="tap w-11 rounded-xl border border-line-strong text-[18px] font-bold hover:border-accent">
              +
            </button>
          </div>
        </label>
      </div>

      <div className="card p-5 sm:p-6">
        <div className="eyebrow">Before you send it</div>
        <dl className="mt-3 space-y-2 text-[14.5px]">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Walks promised</dt>
            <dd className="num">{e.events}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">To deliver them</dt>
            <dd className="num">{usd(e.delivery)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Team hours</dt>
            <dd className="num">{inputs.staffHours}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-line pt-2 font-bold">
            <dt>Left for the team</dt>
            <dd className={cn("num", e.contribution < 0 ? "text-bad" : "text-ok")}>{usd(e.contribution)}</dd>
          </div>
        </dl>
        <p className={cn("mt-3 text-[13.5px] leading-snug", v.tone === "bad" ? "text-bad" : v.tone === "warn" ? "text-warn" : "text-muted")}>{v.text}</p>
        <p className="mt-2 text-[12.5px] leading-snug text-muted">
          A price that leaves 20% would be <span className="num">{usd(suggested)}</span>. Sample rates: {usd(inputs.costPerEvent + inputs.organizerStipendPerEvent)} a walk, ${inputs.staffRate} a team hour.
        </p>
        <MoveButton
          move="move-create"
          variant="primary"
          className="mt-4 w-full"
          disabled={!ready}
          onClick={() => commissionStore.send({ type: "CREATE_COMMISSION", payload: draft }, founder)}
        >
          Send the proposal
        </MoveButton>
        <ReceiptLine receipt={receipt} />
      </div>
    </div>
  );
}
