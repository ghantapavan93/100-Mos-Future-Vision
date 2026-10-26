"use client";

// Step 4, the money. A signature is a promise; money counts once it's in. The
// table is economics() over the deal as priced and, once walks are on the
// calendar, over the walks actually scheduled, so a rerun walk shows up as a
// cost the moment it's added.

import type { Receipt } from "@/domain/engine";
import { impactPool } from "@/domain/engine";
import { usd } from "@/domain/finance";
import { moneyOf } from "@/domain/commission/model";
import type { World } from "@/domain/types";
import { cn } from "@/components/ui/kit";
import type { Flow } from "./flow";
import { MoneyTable, MoveButton, ReceiptLine, lastReceipt } from "./parts";
import { commissionStore } from "./store";

const founder = { role: "founder", id: "kayla" } as const;

const STATES = [
  { id: "quote", label: "Offered" },
  { id: "signed", label: "Signed, owed" },
  { id: "paid", label: "Paid" },
] as const;

export function MoneyStep({ w, f, ledger }: { w: World; f: Flow; ledger: Receipt[] }) {
  const c = f.c!;
  const p = f.p!;
  const money = moneyOf(w, c);
  const pool = impactPool(w);
  const receipt = lastReceipt(ledger, ["RECORD_PAYMENT"], (x) => x.proposalId === p.id);
  const at = STATES.findIndex((s) => s.id === money.state);
  const changed = money.asRun.contribution !== money.planned.contribution;

  return (
    <div className="card p-5 sm:p-6" data-testid="commission-money" data-state={money.state}>
      {money.state === "declined" ? (
        <p className="text-[15px]">Declined: no contract, so {usd(0)} in, and nothing to deliver or give back.</p>
      ) : (
        <>
          <ol className="flex flex-wrap gap-2" aria-label="Where the money is">
            {STATES.map((s, i) => (
              <li key={s.id} aria-current={i === at ? "step" : undefined} className={cn("rounded-full border px-3 py-1 text-[12.5px] font-bold", i <= at ? "border-accent bg-accent/10 text-accent-ink" : "border-line text-muted")}>
                {s.label}
              </li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="eyebrow">Money in</div>
              <div className="num mt-1 text-[30px] font-bold leading-none" data-testid="money-in">
                {usd(money.received)}
              </div>
              <div className="mt-1 text-[12.5px] text-muted">{money.state === "signed" ? `${usd(p.inputs.fee)} is owed, not in.` : money.state === "quote" ? "Nothing is owed until it's signed." : "In the bank."}</div>
            </div>
            {money.state === "signed" ? (
              <MoveButton move="move-pay" variant="primary" onClick={() => commissionStore.send({ type: "RECORD_PAYMENT", payload: { proposalId: p.id } }, founder)}>
                Record their payment
              </MoveButton>
            ) : null}
          </div>
          <div className="mt-5">
            <MoneyTable columns={changed || money.walksOnSchedule !== money.planned.events ? [{ label: "As priced", e: money.planned }, { label: "As run", e: money.asRun }] : [{ label: "As priced", e: money.planned }]} />
          </div>
          <p className="mt-3 text-[12.5px] leading-snug text-muted">
            {money.walksOnSchedule} walks on the schedule. Giving back: {usd(money.planned.impact)} promised; it becomes real money only when the buyer has paid{money.planned.contribution < 0 ? ", and this contract can't fund it" : ""}. Across every deal, {usd(pool.available)} is ready to give.
          </p>
        </>
      )}
      <ReceiptLine receipt={receipt} />
    </div>
  );
}
