"use client";

// One receipt, followed through the seven stations every command passes:
// Input → Authorize → Reconcile → Policy → Apply → Audit → Project.
// The only animation on the page lives here: a tracer that travels once from
// Input to the last station the request reached. Everything it shows comes
// from the receipt the engine wrote.

import Link from "next/link";
import { Check, Minus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { GENESIS, STAGES, type Lens, type Receipt, type Stage } from "@/domain/engine";
import { tickLabel } from "@/domain/calendar";
import { Badge, OutcomeBadge, RuleChip, cn } from "@/components/ui/kit";
import { STATE_LABEL, STATION, actorLabel, failStage, humanPath, isRedacted, reachedIndex, recomputeMatches, redactionReason, sayChange, showValue, stationState, type StationState } from "./model";

const LENS_ROUTE: Record<Lens, { href: string; label: string }> = {
  member: { href: "/member", label: "Member app" },
  coach: { href: "/coach", label: "AI Coach" },
  circles: { href: "/circles", label: "City Circles" },
  partner: { href: "/partner", label: "Sponsors" },
  impact: { href: "/impact", label: "Giving back" },
  founder: { href: "/founder", label: "Kayla's week" },
  future: { href: "/future", label: "Next 3 summers" },
  xray: { href: "/xray", label: "How miles count" },
};

function NodeIcon({ state }: { state: StationState }) {
  if (state === "fail") return <X aria-hidden size={15} strokeWidth={2.6} />;
  if (state === "pass" || state === "quiet") return <Check aria-hidden size={15} strokeWidth={2.6} />;
  if (state === "info") return <span aria-hidden className="font-mono text-[12px] font-bold">i</span>;
  return <Minus aria-hidden size={14} strokeWidth={2.2} />;
}

const NODE_CLASS: Record<StationState, string> = {
  pass: "border-transparent bg-ok text-night",
  quiet: "border-ok text-ok bg-transparent",
  fail: "border-transparent bg-bad text-night",
  info: "border-transparent bg-info text-night",
  unreached: "border-dashed border-line-strong text-muted bg-transparent",
  "not-needed": "border-line-strong text-muted bg-transparent",
};

function prefersStill(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "paused";
}

export function Pipeline({ receipt, previousHash, plain, onPlain }: { receipt: Receipt | null; previousHash: string | null; plain: boolean; onPlain: (v: boolean) => void }) {
  if (!receipt) {
    return (
      <div className="card p-5 sm:p-6">
        <div className="eyebrow">Anatomy of a receipt</div>
        <p className="mt-2 max-w-[560px] text-[15px] text-muted">Pick a receipt on the left — or do anything anywhere in the demo — and follow it through these seven stations. A refused request stops at the station that refused it, and says why.</p>
        <ol className="mt-5 grid gap-2 sm:grid-cols-2">
          {STAGES.map((s, i) => (
            <li key={s} className="flex items-start gap-3 rounded-xl bg-surface-2 p-3">
              <span className="num grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-line-strong text-[12px]">{i + 1}</span>
              <span>
                <span className="block text-[14.5px] font-semibold">{STATION[s].name}</span>
                <span className="block text-[13px] text-muted">{STATION[s].asks}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    );
  }
  return <ReceiptView key={receipt.seq} receipt={receipt} previousHash={previousHash} plain={plain} onPlain={onPlain} />;
}

function ReceiptView({ receipt: r, previousHash, plain, onPlain }: { receipt: Receipt; previousHash: string | null; plain: boolean; onPlain: (v: boolean) => void }) {
  const stop = failStage(r);
  const reached = reachedIndex(r);
  const chainOk = r.prevHash === (previousHash ?? GENESIS) && recomputeMatches(r);
  const [focus, setFocus] = useState<Stage | null>(stop);
  const rows = useRef<HTMLOListElement>(null);

  const showStation = (s: Stage) => {
    setFocus(s);
    rows.current?.querySelector(`[data-pipeline-stage="${s}"]`)?.scrollIntoView({ block: "nearest", behavior: prefersStill() ? "auto" : "smooth" });
  };

  return (
    <article className="card overflow-hidden" aria-labelledby="xr-receipt-title">
      <header className="border-b border-line p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="num text-[13px] text-sun">Receipt #{r.seq}</span>
          <OutcomeBadge outcome={r.outcome} />
          {r.meta.fault ? <Badge tone="warn">Injected fault · {r.meta.fault}</Badge> : null}
          {r.meta.harness ? <Badge tone="info">Harness</Badge> : null}
          {r.meta.via ? <Badge>via {r.meta.via}</Badge> : null}
          <div className="ml-auto flex rounded-full border border-line-strong p-0.5" role="group" aria-label="Detail level">
            {(["Plain English", "Technical"] as const).map((label) => {
              const on = (label === "Plain English") === plain;
              return (
                <button key={label} type="button" aria-pressed={on} onClick={() => onPlain(label === "Plain English")} className={cn("h-9 rounded-full px-3 text-[12.5px] font-semibold", on ? "bg-ink text-bg" : "text-muted hover:text-ink")}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <h3 id="xr-receipt-title" className="display mt-3 text-[24px] leading-tight sm:text-[27px]">
          {r.summary}
        </h3>
        <p className="mt-2 font-mono text-[12px] text-muted">
          {plain ? "" : `${r.type} · `}
          {actorLabel(r)} · {tickLabel(r.at)}
        </p>
        {r.meta.harness ? (
          <p className="mt-2 text-[12.5px] text-muted">A test-harness command (fault injection, clock or repair). A production port would not expose it.</p>
        ) : null}
        <Redaction receipt={r} />
      </header>

      <Rail receipt={r} reached={reached} stop={stop} focus={focus} onFocus={showStation} />

      <ol ref={rows} className="divide-y divide-line">
        {STAGES.map((s, i) => {
          const state = stationState(r, s);
          const notes = r.stages.filter((n) => n.stage === s);
          return (
            <li
              key={s}
              data-pipeline-stage={s}
              className={cn(
                "relative flex gap-3 px-4 py-3 sm:px-5",
                state === "fail" && "bg-bad-soft",
                focus === s && state !== "fail" && "bg-surface-2",
                (state === "unreached" || state === "not-needed") && "opacity-65",
              )}
            >
              <div className="flex w-[118px] shrink-0 flex-col gap-1 sm:w-[150px]">
                <div className="flex items-center gap-2">
                  <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full border-2", NODE_CLASS[state])}>
                    <NodeIcon state={state} />
                  </span>
                  <span className="text-[14px] font-semibold">
                    <span className="num mr-1 text-muted">{i + 1}</span>
                    {STATION[s].name}
                  </span>
                </div>
                <span className={cn("pl-8 font-mono text-[11px] uppercase tracking-[0.07em]", state === "fail" ? "font-bold text-bad" : "text-muted")}>{STATE_LABEL[state]}</span>
              </div>
              <div className="min-w-0 flex-1 text-[13.5px] leading-snug">
                {plain ? <p className="text-muted">{STATION[s].asks}</p> : null}
                {notes.length === 0 ? (
                  <p className={cn(plain ? "mt-1" : "", "text-muted")}>
                    {state === "unreached" ? "The request stopped before this station." : state === "not-needed" ? "Nothing changed, so there was nothing to apply or refresh." : "Passed through with nothing to note."}
                  </p>
                ) : (
                  <ul className={cn("space-y-1.5", plain && "mt-1")}>
                    {notes.map((n, k) => (
                      <li key={k} className="flex flex-wrap items-start gap-x-2 gap-y-1">
                        <span className={cn("mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full", n.status === "fail" ? "bg-bad" : n.status === "pass" ? "bg-ok" : "bg-info")} aria-hidden />
                        <span className="min-w-0 flex-1">{plain && s === "audit" ? "Recorded, and chained to the previous receipt." : n.detail}</span>
                        {n.ruleId ? <RuleChip id={n.ruleId} /> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="grid gap-px border-t border-line bg-line md:grid-cols-[1.4fr_1fr]">
        <section className="bg-surface p-4 sm:p-5" aria-labelledby="xr-changes">
          <h4 id="xr-changes" className="eyebrow">
            What changed · {r.changeCount.total} field{r.changeCount.total === 1 ? "" : "s"}
            {r.changeCount.truncated ? ` · first ${r.changes.length} shown` : ""}
          </h4>
          {r.changes.length === 0 ? (
            <p className="mt-2 text-[13.5px] text-muted">{r.outcome === "applied" ? "No fields changed." : "Nothing. A refused or duplicate request leaves the world exactly as it was."}</p>
          ) : plain ? (
            <ul className="mt-2 space-y-1.5 text-[13.5px] leading-snug">
              {r.changes.slice(0, 12).map((c) => (
                <li key={c.path}>{sayChange(c)}</li>
              ))}
            </ul>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse font-mono text-[12px]">
                <thead>
                  <tr className="text-left text-muted">
                    <th className="py-1 pr-3 font-normal">path</th>
                    <th className="py-1 pr-3 font-normal">before</th>
                    <th className="py-1 font-normal">after</th>
                  </tr>
                </thead>
                <tbody>
                  {r.changes.map((c) => (
                    <tr key={c.path} className="border-t border-line align-top">
                      <td className="py-1.5 pr-3 text-ink" title={humanPath(c.path)}>
                        {c.path}
                      </td>
                      <td className={cn("max-w-[220px] break-words py-1.5 pr-3", isRedacted(c.before) ? "italic text-muted" : "text-bad")}>{showValue(c.before)}</td>
                      <td className={cn("max-w-[220px] break-words py-1.5", isRedacted(c.after) ? "italic text-muted" : "text-ok")}>{showValue(c.after)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="space-y-4 bg-surface p-4 sm:p-5">
          <div>
            <h4 className="eyebrow">Screens refreshed</h4>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {r.lenses.filter((l) => l !== "xray").length === 0 ? (
                <span className="text-[13.5px] text-muted">None — nothing they show changed.</span>
              ) : (
                r.lenses
                  .filter((l) => l !== "xray")
                  .map((l) => (
                    <Link key={l} href={LENS_ROUTE[l].href} className="rounded-full border border-line-strong px-2.5 py-1 text-[12.5px] font-semibold hover:border-ink">
                      {LENS_ROUTE[l].label}
                    </Link>
                  ))
              )}
            </div>
          </div>
          <div>
            <h4 className="eyebrow">Audit chain</h4>
            {plain ? (
              <p className="mt-2 text-[13.5px]">{chainOk ? "This receipt is chained to the one before it, and its fingerprint still matches its contents." : "This receipt's fingerprint doesn't match — the record was altered."}</p>
            ) : (
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[12px]">
                <dt className="text-muted">prev</dt>
                <dd>{r.prevHash}</dd>
                <dt className="text-muted">hash</dt>
                <dd>{r.hash}</dd>
                <dt className="text-muted">check</dt>
                <dd className={chainOk ? "text-ok" : "text-bad"}>{chainOk ? "recomputed · matches · linked" : "MISMATCH"}</dd>
              </dl>
            )}
            {!plain ? <p className="mt-2 text-[11.5px] leading-snug text-muted">FNV-1a over the receipt and its predecessor: tamper-evident for a demo, not cryptographic. Production would write receipts in the same transaction as the change.</p> : null}
          </div>
          {!plain ? (
            <div>
              <h4 className="eyebrow">The request, as recorded</h4>
              <pre className="mt-2 max-h-[180px] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface-2 p-2.5 font-mono text-[11.5px] leading-snug">{JSON.stringify(r.payload, null, 1)}</pre>
              {r.facts ? (
                <p className="mt-1.5 font-mono text-[11.5px] text-muted">
                  derived: {Object.entries(r.facts).map(([k, v]) => `${k}=${v}`).join(" · ")}
                </p>
              ) : null}
            </div>
          ) : null}
          {r.ruleIds.length ? (
            <div>
              <h4 className="eyebrow">Rules consulted</h4>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {r.ruleIds.map((id) => (
                  <RuleChip key={id} id={id} />
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </article>
  );
}

/** Says, once and in plain words, why some values on this receipt are digests. */
function Redaction({ receipt }: { receipt: Receipt }) {
  const why = redactionReason(receipt);
  if (!why) return null;
  return (
    <div className="mt-3 flex flex-wrap items-start gap-x-3 gap-y-2 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-[13px] leading-snug">
      <span className="eyebrow pt-0.5">Not shown, on purpose</span>
      <span className="min-w-0 flex-1 basis-[260px] text-muted">{why.text}</span>
      <span className="flex gap-1.5">
        {why.rules.map((id) => (
          <RuleChip key={id} id={id} />
        ))}
      </span>
    </div>
  );
}

/** The station rail: horizontal on wider screens, a compact numbered strip on phones. A tracer runs once to the last station reached. */
function Rail({ receipt, reached, stop, focus, onFocus }: { receipt: Receipt; reached: number; stop: Stage | null; focus: Stage | null; onFocus: (s: Stage) => void }) {
  const track = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = track.current;
    const d = dot.current;
    if (!el || !d) return;
    const span = el.clientWidth;
    const x = (span * reached) / (STAGES.length - 1);
    if (prefersStill()) {
      d.style.transform = `translateX(${x}px)`;
      return;
    }
    const anim = d.animate([{ transform: "translateX(0px)" }, { transform: `translateX(${x}px)` }], { duration: Math.max(300, 130 * (reached + 1)), easing: "cubic-bezier(0.2, 0, 0, 1)", fill: "forwards" });
    return () => anim.cancel();
  }, [receipt.seq, reached]);

  return (
    <div className="border-b border-line px-4 pb-4 pt-5 sm:px-6">
      <div className="relative mx-[14px]">
        <div ref={track} className="absolute left-0 right-0 top-[13px] h-[2px] bg-line" aria-hidden />
        <div className={cn("absolute left-0 top-[13px] h-[2px]", stop ? "bg-bad" : "bg-ok")} style={{ width: `${(reached / (STAGES.length - 1)) * 100}%` }} aria-hidden />
        <span ref={dot} aria-hidden className="absolute left-[-5px] top-[9px] z-10 h-[10px] w-[10px] rounded-full bg-sun shadow-[0_0_0_3px_var(--bg)]" />
        <ol className="relative flex justify-between" aria-label="Stations">
          {STAGES.map((s, i) => {
            const state = stationState(receipt, s);
            return (
              <li key={s} className="flex w-0 flex-col items-center">
                <button
                  type="button"
                  onClick={() => onFocus(s)}
                  aria-label={`${i + 1}. ${STATION[s].name}: ${STATE_LABEL[state]}`}
                  aria-current={focus === s ? "step" : undefined}
                  className={cn("relative z-20 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-transform hover:scale-110", NODE_CLASS[state], focus === s && "ring-2 ring-sun ring-offset-2 ring-offset-[var(--surface)]")}
                >
                  <NodeIcon state={state} />
                </button>
                <span className="mt-2 hidden whitespace-nowrap text-[12px] font-semibold sm:block">{STATION[s].name}</span>
                <span className="mt-1 whitespace-nowrap font-mono text-[11px] text-muted sm:hidden">{i + 1}</span>
                {state === "fail" ? <span className="mt-1 whitespace-nowrap rounded-full bg-bad px-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-night">Refused</span> : null}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
