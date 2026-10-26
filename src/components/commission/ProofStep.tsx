"use client";

// Steps 6 and 7: the proof and next summer. The Community Value Report is
// valueReport() over the commission's world, in two copies: Kayla's (with the
// money and the modelled crowd) and the buyer's (counts only, after it's
// sent). The renewal is a proposal priced on what was delivered; nothing here
// signs it or takes money for it.

import { useState } from "react";
import type { Receipt } from "@/domain/engine";
import { economics, usd } from "@/domain/finance";
import { listOf } from "@/domain/commission/model";
import { valueReport, REGULAR_WALKS, type ValueReport } from "@/domain/commission/report";
import type { World } from "@/domain/types";
import { Badge, cn } from "@/components/ui/kit";
import type { Flow } from "./flow";
import { CellText, MoveButton, ReceiptLine, dealStep, lastReceipt, verdict } from "./parts";
import { commissionStore } from "./store";

const founder = { role: "founder", id: "kayla" } as const;

function Bar({ d }: { d: ValueReport["deliverables"] }) {
  const parts = [
    { n: d.fulfilled, label: "held", cls: "bg-ok" },
    { n: d.pending, label: "still to come", cls: "bg-line-strong" },
    { n: d.unfulfilled, label: "unfulfilled", cls: "bg-bad" },
  ];
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        {parts.map((x) => (x.n ? <span key={x.label} className={x.cls} style={{ width: `${(x.n / Math.max(1, d.requested)) * 100}%` }} /> : null))}
      </div>
      <p className="mt-2 text-[13.5px]" data-testid="deliverables">
        Of <span className="num font-bold">{d.requested}</span> walks asked for: <span className="num font-bold text-ok">{d.fulfilled}</span> held, <span className="num font-bold">{d.pending}</span> still to come,{" "}
        <span className={cn("num font-bold", d.unfulfilled ? "text-bad" : "")}>{d.unfulfilled}</span> unfulfilled.
        {d.canceled ? ` ${d.canceled} cancelled along the way.` : ""}
      </p>
    </div>
  );
}

function ReportCard({ r }: { r: ValueReport }) {
  return (
    <article className="rounded-2xl border border-line-strong bg-bg/60 p-5" data-testid="value-report" data-audience={r.audience}>
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="eyebrow">Community Value Report</div>
          <h3 className="t-card mt-1">
            {r.buyer} × 100 Miles of Summer
          </h3>
        </div>
        <span className="text-[12.5px] text-muted">{r.window ? `${r.window.from} – ${r.window.to}` : "Not started"} · {r.sentOn ? `sent ${r.sentOn}` : "not sent yet"}</span>
      </header>
      <div className="mt-4">
        <Bar d={r.deliverables} />
      </div>
      <div className="-mx-1 mt-4 overflow-x-auto px-1">
        <table className="w-full min-w-[520px] border-collapse text-[13.5px]">
          <thead>
            <tr className="text-left">
              {["City", "Hosted by", "Walks held", "People", "First walk ever", "Came back", `${REGULAR_WALKS}+ walks`].map((h) => (
                <th key={h} scope="col" className="eyebrow pb-2 pr-2 font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {r.cities.map((x) => (
              <tr key={x.chapterId} className="border-t border-line">
                <th scope="row" className="py-1.5 pr-2 text-left font-bold">
                  {x.city}
                </th>
                <td className="py-1.5 pr-2 text-muted">{x.hostedBy}</td>
                <td className="num py-1.5 pr-2">
                  {x.held}
                  {x.canceled ? <span className="text-bad"> · {x.canceled} cancelled</span> : null}
                </td>
                <td className="py-1.5 pr-2">
                  <CellText cell={x.people} />
                </td>
                <td className="py-1.5 pr-2">
                  <CellText cell={x.firstWalks} />
                </td>
                <td className="py-1.5 pr-2">
                  <CellText cell={x.cameBack} />
                </td>
                <td className="py-1.5 pr-2">
                  <CellText cell={x.regulars} />
                </td>
              </tr>
            ))}
            <tr className="border-t border-line-strong font-bold">
              <th scope="row" className="py-1.5 pr-2 text-left">
                All cities
              </th>
              <td />
              <td className="num py-1.5 pr-2">{r.cities.reduce((s, x) => s + x.held, 0)}</td>
              <td className="py-1.5 pr-2">
                <CellText cell={r.totals.people} />
              </td>
              <td className="py-1.5 pr-2">
                <CellText cell={r.totals.firstWalks} />
              </td>
              <td className="py-1.5 pr-2">
                <CellText cell={r.totals.cameBack} />
              </td>
              <td className="py-1.5 pr-2">
                <CellText cell={r.totals.regulars} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {r.canceled.length || r.unfulfilled.length ? (
        <ul className="mt-3 space-y-1 text-[13px]">
          {r.canceled.map((x) => (
            <li key={`${x.city}-${x.day}`}>
              <span className="font-bold">{x.city}</span>, {x.day}: cancelled ({x.reason}){x.rerun ? ", rerun a week later." : ", not rerun."}
            </li>
          ))}
          {r.unfulfilled.map((x) => (
            <li key={x.city} className="text-bad">
              <span className="font-bold">{x.city}</span>: {x.count} unfulfilled. {x.reasons.join(" ")}
            </li>
          ))}
        </ul>
      ) : null}
      <footer className="mt-4 border-t border-line pt-3 text-[12.5px] leading-snug text-muted">
        From: {r.sources.used.toLowerCase()}. Not from {listOf(r.sources.excluded)}. No names. Any group under 10 says “under 10”; “withheld” stops a hidden number being worked out from the total.
        {r.modelledCrowd !== undefined ? ` Kayla's copy only: about ${r.modelledCrowd} more in the modelled crowd, never reported as people.` : ""}
      </footer>
    </article>
  );
}

export function ProofStep({ w, f, ledger }: { w: World; f: Flow; ledger: Receipt[] }) {
  const c = f.c!;
  const p = f.p!;
  const [copy, setCopy] = useState<"founder" | "buyer">("founder");
  const name = w.partners[c.buyerId]?.name ?? "the buyer";
  const result = valueReport(w, c.id, copy === "founder" ? founder : { role: "partner", id: c.buyerId });
  const receipt = lastReceipt(ledger, ["ADVANCE_DEAL"], (x, r) => x.proposalId === p.id && dealStep(r, "reported"));
  const canSend = p.stage === "live" && f.pendingWalks === 0 && !f.heat;

  return (
    <div className="card p-5 sm:p-6" data-testid="commission-proof">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Whose copy" className="flex gap-1 rounded-full border border-line p-1">
          {(["founder", "buyer"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={copy === k}
              onClick={() => setCopy(k)}
              className={cn("min-h-10 rounded-full px-3.5 text-[13px] font-bold", copy === k ? "bg-ink text-bg" : "text-muted hover:text-ink")}
            >
              {k === "founder" ? "Your copy" : `${name}'s copy`}
            </button>
          ))}
        </div>
        {p.stage === "live" ? (
          <MoveButton move="move-send" variant="primary" disabled={!canSend} onClick={() => commissionStore.send({ type: "ADVANCE_DEAL", payload: { proposalId: p.id } }, founder)}>
            Send it to {name}
          </MoveButton>
        ) : null}
      </div>
      {p.stage === "live" && !canSend ? <p className="mt-2 text-[12.5px] text-muted">It goes out once every walk has happened or been cancelled. Until then, this is a preview.</p> : null}
      <div className="mt-4">
        {result.ok ? (
          <ReportCard r={result.report} />
        ) : (
          <p className="rounded-2xl border border-dashed border-line-strong px-4 py-6 text-center text-[14px] text-muted" data-testid="report-refused">
            {result.reason}
          </p>
        )}
      </div>
      {p.reportedAt !== null ? <ReceiptLine receipt={receipt} /> : null}
    </div>
  );
}

export function RenewStep({ w, f, ledger }: { w: World; f: Flow; ledger: Receipt[] }) {
  const c = f.c!;
  const p = f.p!;
  const renewal = c.renewalProposalId ? w.proposals[c.renewalProposalId] : undefined;
  const receipt = lastReceipt(ledger, ["PROPOSE_RENEWAL"], (x) => x.commissionId === c.id);
  const name = w.partners[c.buyerId]?.name ?? "the buyer";
  return (
    <div className="card p-5 sm:p-6" data-testid="commission-renew">
      {renewal ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Badge tone="info">Proposed</Badge>
            <Badge>Not signed</Badge>
            <Badge>Not paid</Badge>
          </div>
          <p className="mt-3 text-[15px] leading-snug">
            Next summer for {name}: one walk a week in {listOf(renewal.chapterIds.map((x) => w.chapters[x]?.city ?? x))} for {renewal.inputs.eventsPerCommunity} weeks, at <span className="num font-bold">{usd(renewal.inputs.fee)}</span>.
          </p>
          <p className="mt-1 text-[13.5px] text-muted">{verdict(economics(renewal.inputs)).text} Priced on what was delivered this year. It stays a proposal until {name} signs it.</p>
        </>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[14.5px]">{p.reportedAt === null ? "A renewal is priced on proof, so it waits for the report." : `${name} has the report. Draft next summer from what was delivered.`}</p>
          <MoveButton move="move-renew" variant="primary" onClick={() => commissionStore.send({ type: "PROPOSE_RENEWAL", payload: { commissionId: c.id } }, founder)}>
            Draft next summer
          </MoveButton>
        </div>
      )}
      <ReceiptLine receipt={receipt} />
    </div>
  );
}
