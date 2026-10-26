"use client";

// Step 3, the pushback. The buyer's side asks for something the rules refuse
// (the engine's own partner-data rules, with no override), then counters on
// price. Trying the counter shows its loss; signing it needs a written reason
// on the record; holding, meeting at the floor or walking away are one tap.

import { useState } from "react";
import type { Receipt } from "@/domain/engine";
import { economics, usd } from "@/domain/finance";
import { buyerOf, counterOffer, floorFee } from "@/domain/commission/model";
import { dayLabel } from "@/domain/calendar";
import type { World } from "@/domain/types";
import { cn } from "@/components/ui/kit";
import type { Flow } from "./flow";
import { MoveButton, ReceiptLine, dealStep, lastReceipt, verdict } from "./parts";
import { commissionStore } from "./store";

const founder = { role: "founder", id: "kayla" } as const;

export function PushbackStep({ w, f, ledger }: { w: World; f: Flow; ledger: Receipt[] }) {
  const c = f.c!;
  const p = f.p!;
  const buyer = buyerOf(c.buyerId);
  const asBuyer = { role: "partner", id: c.buyerId } as const;
  const name = w.partners[c.buyerId]?.name ?? "The buyer";
  const [override, setOverride] = useState("First program with this buyer. We accept the loss to prove it works.");
  const e = economics(p.inputs);
  const v = verdict(e);
  const counter = counterOffer(c.quotedFee);
  const floor = floorFee(p.inputs, 0.15);
  const blocking = e.flags.some((x) => x.severity === "block");
  const open = p.signedAt === null && !f.declined;
  const asked = lastReceipt(ledger, ["PARTNER_DATA_REQUEST"], (x) => x.proposalId === p.id);
  const priced = lastReceipt(ledger, ["SET_PROPOSAL_INPUT", "ADVANCE_DEAL", "MARK_DEAL_LOST"], (x, r) => x.proposalId === p.id && dealStep(r, "contract"));
  const setFee = (value: number) => commissionStore.send({ type: "SET_PROPOSAL_INPUT", payload: { proposalId: p.id, key: "fee", value } }, founder);

  return (
    <div className="grid gap-5 lg:grid-cols-2" data-testid="commission-pushback">
      <div className="card p-5 sm:p-6">
        <div className="eyebrow">Their side asks for</div>
        <ul className="mt-3 space-y-2">
          {(buyer?.asks ?? []).map((a, i) => (
            <li key={a.request} className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[14.5px]">“{a.label}”</span>
              <MoveButton move={`move-ask-${i}`} onClick={() => commissionStore.send({ type: "PARTNER_DATA_REQUEST", payload: { proposalId: p.id, request: a.request } }, asBuyer)}>
                Send the request
              </MoveButton>
            </li>
          ))}
        </ul>
        {buyer?.asks[0] ? (
          <MoveButton
            move="move-ask-override"
            variant="quiet"
            className="mt-2 px-0"
            onClick={() => commissionStore.send({ type: "PARTNER_DATA_REQUEST", payload: { proposalId: p.id, request: buyer.asks[0]!.request, override: "Our CEO has signed off on this." } }, asBuyer)}
          >
            Ask again, “with the CEO&apos;s sign-off”
          </MoveButton>
        ) : null}
        <ReceiptLine receipt={asked} />
        <p className="mt-4 text-[13.5px] leading-snug text-muted">
          What {name} can have: counts from check-ins at its own walks, with any group under 10 hidden, in the Community Value Report. Never names, never anyone&apos;s miles or health data.
        </p>
      </div>

      <div className="card p-5 sm:p-6">
        <div className="eyebrow">The counter-offer</div>
        <p className="mt-2 text-[15px] leading-snug">
          {name}&apos;s procurement asks: the same program for <span className="num font-bold">{usd(counter)}</span>?
        </p>
        {open ? (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              <MoveButton move="move-counter" disabled={p.inputs.fee === counter} onClick={() => setFee(counter)}>
                See what {usd(counter)} does
              </MoveButton>
              {f.countered ? (
                <>
                  <MoveButton move="move-hold" disabled={p.inputs.fee === c.quotedFee} onClick={() => setFee(c.quotedFee)}>
                    Hold at {usd(c.quotedFee)}
                  </MoveButton>
                  <MoveButton move="move-floor" disabled={p.inputs.fee === floor} onClick={() => setFee(floor)}>
                    Meet at {usd(floor)}
                  </MoveButton>
                </>
              ) : null}
            </div>
            <p className={cn("mt-3 text-[14px] leading-snug", v.tone === "bad" ? "text-bad" : v.tone === "warn" ? "text-warn" : "text-ok")} data-testid="price-verdict">
              At {usd(p.inputs.fee)}: {v.text}
            </p>
            {f.countered ? <p className="mt-1 text-[12.5px] text-muted">{usd(floor)} is the lowest price, in $500 steps, that leaves 15% after every cost.</p> : null}
            <div className="mt-4 border-t border-line pt-4">
              {blocking ? (
                <label className="block">
                  <span className="text-[13px] font-bold">Sign at a loss? Write down why. It stays on the record.</span>
                  <textarea value={override} maxLength={240} onChange={(ev) => setOverride(ev.currentTarget.value)} rows={2} className="mt-2 w-full rounded-xl border border-line-strong bg-bg px-3 py-2 text-[14px]" />
                </label>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <MoveButton move="move-sign" variant="primary" onClick={() => commissionStore.send({ type: "ADVANCE_DEAL", payload: { proposalId: p.id } }, founder)}>
                  Sign the contract
                </MoveButton>
                {blocking ? (
                  <MoveButton move="move-sign-loss" onClick={() => commissionStore.send({ type: "ADVANCE_DEAL", payload: { proposalId: p.id, override } }, founder)}>
                    Sign at a loss, in writing
                  </MoveButton>
                ) : null}
                <MoveButton move="move-walk-away" variant="danger" onClick={() => commissionStore.send({ type: "MARK_DEAL_LOST", payload: { proposalId: p.id, reason: "Price below what delivery costs" } }, founder)}>
                  Walk away
                </MoveButton>
              </div>
            </div>
          </>
        ) : (
          <p className="mt-3 text-[14px] leading-snug">
            {f.declined
              ? "Declined. No contract, so no money and no walks."
              : `Signed ${dayLabel(Math.floor(p.signedAt! / 1440))} at ${usd(p.inputs.fee)}.${p.override ? ` Written reason on record: “${p.override}”` : ""}`}
          </p>
        )}
        <ReceiptLine receipt={priced} />
      </div>
    </div>
  );
}
