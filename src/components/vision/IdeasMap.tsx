"use client";

// Every idea on one map: how much it does for the movement (up) against how
// hard it is to build and run (right). Tap a dot — or a name in the list — to
// read what it is, the moment it shows, how it pays, and where to be careful.
// The four to start with carry a star.

import { useState } from "react";
import { cn } from "@/components/ui/kit";
import { Reveal, Words } from "@/components/ui/Reveal";
import { hotWord } from "@/components/demo/TryIt";
import { IDEAS, STAGE_WORDS, type IdeaStage, type VisionIdea } from "./ideas";

const STAGE_TONE: Record<IdeaStage, string> = {
  now: "bg-accent/15 text-accent-ink",
  next: "bg-info-soft text-info",
  later: "border border-line-strong text-muted",
};

function Card({ idea, n }: { idea: VisionIdea; n: number }) {
  const rows: [string, string][] = [
    ["The moment", idea.moment],
    ["How it pays", idea.money],
    ["Careful", idea.careful],
  ];
  return (
    <div className="rise-in card p-5 sm:p-6" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2">
        <span className="num text-[13px] font-bold text-accent-ink">{String(n).padStart(2, "0")}</span>
        <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.1em]", STAGE_TONE[idea.stage])}>{STAGE_WORDS[idea.stage]}</span>
        <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.1em]", idea.origin === "yours" ? "border border-line-strong text-muted" : "bg-surface-2 text-ink")}>
          {idea.origin === "yours" ? "Builds on what you have" : "New"}
        </span>
        {idea.start ? <span className="rounded-full bg-warn-soft px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.1em] text-warn">★ Start here</span> : null}
      </div>
      <h3 className="mt-3 font-[family-name:var(--font-display)] text-[26px] font-black uppercase leading-[0.95] tracking-[-0.03em]">{idea.name}</h3>
      <p className="mt-2 text-[15.5px] leading-relaxed text-ink/90">{idea.what}</p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="eyebrow">{k}</dt>
            <dd className="mt-1 text-[14px] leading-snug text-muted">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function IdeasMap({ index = "02" }: { index?: string }) {
  const [picked, setPicked] = useState(IDEAS[0]!.id);
  const n = IDEAS.findIndex((i) => i.id === picked);
  const idea = IDEAS[n]!;
  const groups: IdeaStage[] = ["now", "next", "later"];
  return (
    <section id="ideas-map" aria-labelledby="ideas-map-title" className="mx-auto w-full max-w-[1320px] px-4 pb-20 sm:px-6 lg:px-8">
      <div className="index-line">
        <b>{index}</b> Every idea, on one map
      </div>
      <div className="mt-6 grid gap-x-12 gap-y-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end">
        <h2 id="ideas-map-title" className="t-section">
          <Words text="Fifteen ideas. *Start with four.*" render={hotWord} />
        </h2>
        <Reveal>
          <p className="t-lede">Higher up does more for the movement; further right takes more to build and run. Tap any dot.</p>
        </Reveal>
      </div>

      {/* Map, then the open idea, then the list — on wide screens the open idea sits beside both. */}
      <div className="mt-10 grid items-start gap-x-8 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
        <div className="lg:col-start-1 lg:row-start-1">
          <div className="mb-2 text-[12px] font-semibold text-muted">↑ More for the movement</div>
          {/* The map: four quarters, one dot per idea. */}
          <div className="relative aspect-square w-full max-w-[620px] select-none sm:aspect-[4/3.4]" role="group" aria-label="Ideas by value and effort">
            <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 overflow-hidden rounded-[22px] border border-line">
              {[
                ["Quick wins", "bg-accent/[0.07]"],
                ["Big bets", "bg-surface/60"],
                ["Small touches", "bg-surface/30"],
                ["Later", "bg-bg/40"],
              ].map(([label, tone], i) => (
                <div key={label} className={cn("relative border-line", tone, i % 2 === 0 && "border-r", i < 2 && "border-b")}>
                  <span className={cn("eyebrow absolute", i < 2 ? "top-3" : "bottom-3", i % 2 === 0 ? "left-3" : "right-3", i === 0 && "text-accent-ink")}>{label}</span>
                </div>
              ))}
            </div>
            {IDEAS.map((it, i) => (
              <button
                key={it.id}
                type="button"
                onClick={() => setPicked(it.id)}
                aria-pressed={picked === it.id}
                aria-label={`${it.name}: ${STAGE_WORDS[it.stage]}${it.start ? ", start here" : ""}`}
                title={it.name}
                className={cn(
                  "absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[11.5px] font-black transition-transform duration-200 hover:scale-110 sm:size-8",
                  it.start ? "bg-accent text-on-accent shadow-[0_0_18px_rgba(255,106,19,0.55)]" : it.stage === "now" ? "border-2 border-accent bg-bg text-accent-ink" : it.stage === "next" ? "border-2 border-info bg-bg text-info" : "border border-line-strong bg-bg text-muted",
                  picked === it.id && "z-10 scale-125 ring-2 ring-ink ring-offset-2 ring-offset-bg hover:scale-125",
                )}
                style={{ left: `${6 + it.effort * 88}%`, top: `${6 + (1 - it.value) * 88}%` }}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="mt-2 max-w-[620px] text-right text-[12px] font-semibold text-muted">More to build and run →</div>
        </div>

        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-24">
          <Card key={idea.id} idea={idea} n={n + 1} />
        </div>

        {/* The same ideas as a list, by when. */}
        <div className="lg:col-start-1 lg:row-start-2">
          <div className="grid gap-5 sm:grid-cols-3">
            {groups.map((g) => (
              <div key={g}>
                <div className="eyebrow">{STAGE_WORDS[g]}</div>
                <ul className="mt-2 space-y-1">
                  {IDEAS.map((it, i) =>
                    it.stage === g ? (
                      <li key={it.id}>
                        <button
                          type="button"
                          onClick={() => setPicked(it.id)}
                          aria-pressed={picked === it.id}
                          className={cn("flex w-full items-baseline gap-2 rounded-lg px-2 py-1.5 text-left text-[14px] transition-colors", picked === it.id ? "bg-surface-2 text-ink" : "text-muted hover:text-ink")}
                        >
                          <span className="num w-5 shrink-0 text-[12px] font-bold text-accent-ink">{i + 1}</span>
                          {/* The star rides on the name's last line, even when the name wraps. */}
                          <span className="font-semibold">
                            {it.name}
                            {it.start ? (
                              <span aria-label="start here" className="ml-1.5 text-warn">
                                ★
                              </span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    ) : null,
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
