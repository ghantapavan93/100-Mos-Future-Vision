"use client";

// Small pieces every commission step shares: the step frame, the buttons the
// guide can point at, a receipt in plain words, and the money table.

import { createContext, useContext, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { Receipt } from "@/domain/engine";
import { usd, type Economics } from "@/domain/finance";
import type { Cell } from "@/domain/commission/model";
import { plain } from "@/components/demo/plain";
import { Badge, Button, OutcomeBadge, cn } from "@/components/ui/kit";
import { MONEY_COLOR } from "@/components/partner/moneyColors";
import type { StepId } from "./flow";

/** The button the guide is pointing at, so it can wear the guiding ring. */
export const GuideTarget = createContext<string | null>(null);

/** A button that makes one move in the story. `move` is its id; the guide finds it by that. */
export function MoveButton({ move, className, variant = "secondary", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { move: string; variant?: "primary" | "secondary" | "danger" | "quiet" }) {
  const target = useContext(GuideTarget);
  return <Button id={move} data-move={move} variant={variant} size="sm" className={cn(target === move && "step-ring", className)} {...rest} />;
}

export function StepFrame({ id, n, title, question, done, locked, children }: { id: StepId; n: string; title: string; question: string; done: boolean; locked: string | null; children: ReactNode }) {
  return (
    <section id={`step-${id}`} aria-labelledby={`step-${id}-title`} data-step={id} data-done={done ? "true" : "false"} className="scroll-mt-28 border-t border-line pt-8">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="num text-[13px] font-bold text-accent-ink">{n}</span>
        <h2 id={`step-${id}-title`} className="t-card">
          {title}
        </h2>
        {done ? <Badge tone="ok">Done</Badge> : null}
      </div>
      <p className="mt-1 text-[14.5px] text-muted">{question}</p>
      {locked ? <p className="mt-4 rounded-2xl border border-dashed border-line-strong px-4 py-3 text-[14px] text-muted">{locked}</p> : <div className="mt-5">{children}</div>}
    </section>
  );
}

/** What the engine said about the last thing done here, in plain words. */
export function ReceiptLine({ receipt, className }: { receipt: Receipt | undefined; className?: string }) {
  if (!receipt) return null;
  const why = receipt.stages.filter((s) => s.status === "fail" && plain(s.detail) !== plain(receipt.summary)).map((s) => plain(s.detail));
  return (
    <div role="status" aria-live="polite" className={cn("mt-4 rounded-2xl border border-line bg-surface-2/60 px-4 py-3", className)} data-receipt={receipt.seq} data-outcome={receipt.outcome}>
      <div className="flex flex-wrap items-center gap-2">
        <OutcomeBadge outcome={receipt.outcome} />
        <span className="num text-[11.5px] text-muted">receipt #{receipt.seq}</span>
      </div>
      <p className="mt-1.5 text-[14.5px] leading-snug">{plain(receipt.summary)}</p>
      {why.length ? <p className="mt-1 text-[13px] leading-snug text-muted">{why.slice(0, 2).join(" ")}</p> : null}
    </div>
  );
}

/** The latest receipt of any of these types that also passes `match` (its payload, then the receipt itself). */
export function lastReceipt(ledger: Receipt[], types: Receipt["type"][], match: (payload: Record<string, unknown>, r: Receipt) => boolean = () => true): Receipt | undefined {
  for (let i = ledger.length - 1; i >= 0; i--) {
    const r = ledger[i]!;
    if (types.includes(r.type) && match((r.payload ?? {}) as Record<string, unknown>, r)) return r;
  }
  return undefined;
}

/**
 * A deal command that moved the deal to `stage`, or tried to and was refused: ADVANCE_DEAL is one
 * command for every stage, so each step shows only its own.
 */
export function dealStep(r: Receipt, stage: string): boolean {
  if (r.type !== "ADVANCE_DEAL") return true;
  if (r.outcome !== "applied") return true;
  return r.changes.some((c) => c.path.endsWith(".stage") && c.after === stage);
}

/** A count a buyer may see, as words when it isn't a number. */
export function CellText({ cell }: { cell: Cell }) {
  if (typeof cell === "number") return <span className="num">{cell.toLocaleString("en-US")}</span>;
  return <span className="text-[12.5px] text-muted">{cell === "withheld" ? "withheld" : "under 10"}</span>;
}

const ROWS: { key: keyof Economics; label: string; color?: string; sign: 1 | -1 }[] = [
  { key: "revenue", label: "Price", color: MONEY_COLOR.fee, sign: 1 },
  { key: "delivery", label: "Walks, photos and report", color: MONEY_COLOR.delivery, sign: -1 },
  { key: "staffCost", label: "Team hours", color: MONEY_COLOR.staff, sign: -1 },
  { key: "processing", label: "Card fees", color: MONEY_COLOR.processing, sign: -1 },
  { key: "impact", label: "Giving back", color: MONEY_COLOR.impact, sign: -1 },
];

/** The deal's money, one column per version of it (as priced, as run). Every number is economics(). */
export function MoneyTable({ columns }: { columns: { label: string; e: Economics }[] }) {
  return (
    <table className="w-full border-collapse text-[14px]" data-testid="money-table">
      <thead>
        <tr className="text-left">
          <th className="pb-2 font-normal text-muted" />
          {columns.map((c) => (
            <th key={c.label} scope="col" className="eyebrow pb-2 text-right">
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {ROWS.map((r) => (
          <tr key={r.key} className="border-t border-line">
            <th scope="row" className="py-1.5 text-left font-normal text-muted">
              <span aria-hidden className="mr-2 inline-block size-2 rounded-full align-middle" style={{ background: r.color }} />
              {r.label}
            </th>
            {columns.map((c) => (
              <td key={c.label} className="num py-1.5 text-right">
                {r.sign < 0 && (c.e[r.key] as number) > 0 ? "−" : ""}
                {usd(c.e[r.key] as number)}
              </td>
            ))}
          </tr>
        ))}
        <tr className="border-t border-line-strong">
          <th scope="row" className="py-2 text-left font-bold">
            <span aria-hidden className="mr-2 inline-block size-2 rounded-full align-middle" style={{ background: MONEY_COLOR.left }} />
            Left for the team
          </th>
          {columns.map((c) => (
            <td key={c.label} className={cn("num py-2 text-right font-bold", c.e.contribution < 0 ? "text-bad" : "text-ok")} data-contribution={c.e.contribution}>
              {usd(c.e.contribution)}
              <span className="block text-[11.5px] font-normal text-muted">{c.e.marginPct}% of the price</span>
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

/** One line on whether a price covers its costs, from the numbers, never a canned message. */
export function verdict(e: Economics): { tone: "ok" | "warn" | "bad"; text: string } {
  if (e.contribution < 0) return { tone: "bad", text: `Underpriced by ${usd(-e.contribution)}. It covers its costs at ${usd(e.breakEvenFee)}.` };
  if (e.flags.some((f) => f.id === "THIN_MARGIN")) return { tone: "warn", text: `Covers its costs, with ${usd(e.contribution)} left: under 15%, so one bad week could erase it.` };
  return { tone: "ok", text: `Covers its costs, with ${usd(e.contribution)} (${e.marginPct}%) left for the team.` };
}
