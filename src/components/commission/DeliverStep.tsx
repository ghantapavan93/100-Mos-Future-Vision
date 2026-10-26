"use client";

// Step 2, can we deliver it? Each city's own team against what a weekly walk
// needs: a lead with room, a step-free start, a backup sweep. Where one fails,
// the choices are a partner crew, dropping the city, or saying no to the whole
// thing, and each button says what it would do to the money before it's tapped
// (a dry run of the same command through the engine).

import type { CommandInput } from "@/domain/commands";
import type { Receipt } from "@/domain/engine";
import { economics, usd } from "@/domain/finance";
import { readiness } from "@/domain/commission/model";
import type { World } from "@/domain/types";
import { Badge, cn } from "@/components/ui/kit";
import type { Flow } from "./flow";
import { MoveButton, ReceiptLine, lastReceipt } from "./parts";
import { commissionStore } from "./store";

const founder = { role: "founder", id: "kayla" } as const;

/** "Left for the team $3,600 → $3,240 · 56 team hours", from a dry run of the command. */
function effect(w: World, proposalId: string, input: CommandInput): string {
  const before = w.proposals[proposalId];
  const { world, receipt } = commissionStore.preview(input, founder);
  const after = world.proposals[proposalId];
  if (!before || !after || receipt.outcome !== "applied") return "";
  if (after.stage === "lost") return "No contract, no money in, no walks.";
  const a = economics(before.inputs);
  const b = economics(after.inputs);
  const parts = [`Left for the team ${usd(a.contribution)} → ${usd(b.contribution)}`];
  if (after.inputs.fee !== before.inputs.fee) parts.unshift(`Price ${usd(before.inputs.fee)} → ${usd(after.inputs.fee)}`);
  if (after.inputs.staffHours !== before.inputs.staffHours) parts.push(`${after.inputs.staffHours - before.inputs.staffHours > 0 ? "+" : ""}${after.inputs.staffHours - before.inputs.staffHours} team hours`);
  return parts.join(" · ");
}

function Tick({ ok }: { ok: boolean }) {
  return (
    <span aria-hidden className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[12px] font-black", ok ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad")}>
      {ok ? "✓" : "!"}
    </span>
  );
}

const COVERAGE: Record<string, { label: string; tone: "ok" | "bad" | "info" | "neutral" }> = {
  lead: { label: "City Lead", tone: "ok" },
  crew: { label: "Partner crew", tone: "info" },
  pending: { label: "Needs a decision", tone: "bad" },
  descoped: { label: "Dropped", tone: "neutral" },
};

export function DeliverStep({ w, f, ledger }: { w: World; f: Flow; ledger: Receipt[] }) {
  const c = f.c!;
  const p = f.p!;
  const open = p.signedAt === null && !f.declined;
  const rows = readiness(w, c);
  const receipt = lastReceipt(ledger, ["SET_COVERAGE", "MARK_DEAL_LOST"], (x) => x.commissionId === c.id || x.proposalId === p.id);

  return (
    <div data-testid="commission-deliver">
      <div className="grid gap-3 md:grid-cols-3">
        {rows.map((r) => {
          const cov = COVERAGE[r.coverage]!;
          const crewMove: CommandInput = { type: "SET_COVERAGE", payload: { commissionId: c.id, chapterId: r.chapterId, coverage: "crew" } };
          const dropMove: CommandInput = { type: "SET_COVERAGE", payload: { commissionId: c.id, chapterId: r.chapterId, coverage: "descope", reason: "its own team isn't ready and we chose not to bring in a crew" } };
          return (
            <div key={r.chapterId} className={cn("card p-4", r.coverage === "pending" && "border-bad/60")} data-city={r.chapterId} data-coverage={r.coverage}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[16px] font-bold">{r.city}</span>
                <Badge tone={cov.tone}>{cov.label}</Badge>
              </div>
              {r.coverage === "descoped" ? (
                <p className="mt-3 text-[13.5px] text-muted">Dropped: {c.cities.find((x) => x.chapterId === r.chapterId)?.descopedBecause}. The buyer is told, and its walks show as unfulfilled.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {r.checks.map((k) => (
                    <li key={k.id} className="flex gap-2 text-[13.5px] leading-snug" data-check={k.id} data-ok={k.ok ? "true" : "false"}>
                      <Tick ok={k.ok} />
                      <span>
                        <span className="font-bold">{k.label}.</span> <span className="text-muted">{k.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {open && r.coverage === "pending" ? (
                <div className="mt-4 space-y-2 border-t border-line pt-3">
                  {r.options.crew ? (
                    <div>
                      <MoveButton move={`move-crew-${r.chapterId}`} className="w-full" onClick={() => commissionStore.send(crewMove, founder)}>
                        Bring in {r.options.crew.name}
                      </MoveButton>
                      <p className="mt-1 text-[12px] leading-snug text-muted">Sample crew. {effect(w, p.id, crewMove)}</p>
                    </div>
                  ) : null}
                  {r.options.descope ? (
                    <div>
                      <MoveButton move={`move-drop-${r.chapterId}`} className="w-full" onClick={() => commissionStore.send(dropMove, founder)}>
                        Drop {r.city}
                      </MoveButton>
                      <p className="mt-1 text-[12px] leading-snug text-muted">{effect(w, p.id, dropMove)}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {open ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <MoveButton move="move-decline" variant="danger" onClick={() => commissionStore.send({ type: "MARK_DEAL_LOST", payload: { proposalId: p.id, reason: "We can't deliver it as asked" } }, founder)}>
            Decline the whole commission
          </MoveButton>
          <span className="text-[12.5px] text-muted">No contract means no money in and no walks promised.</span>
        </div>
      ) : (
        <p className="mt-3 text-[13px] text-muted">{f.declined ? "Declined. Nothing is promised, so nothing is owed." : "Locked at signing. From here, changes are cancelled walks and makeups."}</p>
      )}
      <ReceiptLine receipt={receipt} />
    </div>
  );
}
