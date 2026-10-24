"use client";

// The pilot: six Saturdays in three cities, and the one question that decides
// Year 10's shape — do first-timers come back? A simulator reads the answer the
// way we'd read the real one: the rate, how sure we can be at this size, and
// go / fix / stop against lines agreed before the first walk.

import { useMemo, useState } from "react";
import { PILOT, PILOT_WALKS, RETURN_LINES, perGroupToCompare, pilotFirstTimers, readPilot, type Verdict } from "@/domain/pilot";
import { cn } from "@/components/ui/kit";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHead, Slider } from "./SectionHead";

const VERDICT: Record<Verdict, { word: string; icon: string; tone: string; zone: string }> = {
  go: { word: "Go", icon: "✓", tone: "border-ok/50 bg-ok-soft text-ok", zone: "bg-ok/25" },
  fix: { word: "Fix", icon: "↻", tone: "border-warn/50 bg-warn-soft text-warn", zone: "bg-warn/25" },
  stop: { word: "Stop", icon: "■", tone: "border-bad/50 bg-bad-soft text-bad", zone: "bg-bad/25" },
};

/** What we watch, the line that means "go", and what similar walks and runs see. */
const MEASURES: { name: string; go: string; seen: string }[] = [
  { name: "Sign-ups who show up", go: "65%+", seen: "A reminder the day before helps most." },
  { name: "First-timers in each walk", go: "1 in 4+", seen: "Walks with more newcomers keep more of them." },
  { name: "Back by week 4", go: "Half+", seen: "Similar weekly runs and walking groups do better than half — see the marks on the line." },
  { name: "Guests who join the app", go: "3 in 10", seen: "Within two weeks of their first walk. There's no public number yet — the pilot sets it." },
  { name: "Sponsors who'd come back", go: "1 a city", seen: "Signs at $1,000 or more, gets its report within a week, and says it would renew." },
];

/** Where similar formats land, as marks on the return track (their numbers live on City Circles and Member). */
const BENCHMARKS = [
  { at: 64, label: "Big free weekly runs" },
  { at: 71, label: "Walking groups, at four months" },
];

function ReturnTrack({ rate, low, high, verdict }: { rate: number; low: number; high: number; verdict: Verdict }) {
  const stop = RETURN_LINES.stop * 100;
  const go = RETURN_LINES.go * 100;
  const zones: { from: number; to: number; v: Verdict }[] = [
    { from: 0, to: stop, v: "stop" },
    { from: stop, to: go, v: "fix" },
    { from: go, to: 100, v: "go" },
  ];
  // The value's label hugs the dot, but never runs off either edge.
  const anchor = rate < 12 ? "translate-x-0" : rate > 88 ? "-translate-x-full" : "-translate-x-1/2";
  return (
    <figure className="mt-5">
      <div
        role="img"
        aria-label={`First-timers back by week 4: ${rate}%, likely ${low} to ${high}%. Go at ${go}% or more, stop under ${stop}%. Similar weekly formats sit above the Go line.`}
        className="relative pt-12"
      >
        <div aria-hidden className={cn("absolute top-0 flex -translate-y-0 flex-col items-center", anchor)} style={{ left: `${rate}%` }}>
          <span className="num rounded-full bg-ink px-2.5 py-0.5 text-[15px] font-bold text-bg">{rate}%</span>
          <span className="mt-0.5 text-[12px] font-semibold text-muted">
            likely {low}–{high}%
          </span>
        </div>
        {/* Zones, separated by a 2px gap in the surface colour. */}
        <div aria-hidden className="relative flex h-3 gap-[2px]">
          {zones.map((z) => (
            <div key={z.v} className={cn("h-full first:rounded-l-full last:rounded-r-full", VERDICT[z.v].zone, z.v === verdict && "brightness-150")} style={{ width: `${z.to - z.from}%` }} />
          ))}
          {/* How sure: the range, then the measured rate. */}
          <div className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-ink/70 transition-all duration-300" style={{ left: `${low}%`, width: `${Math.max(0.5, high - low)}%` }} />
          <div className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-ink transition-all duration-300" style={{ left: `${rate}%` }} />
          {BENCHMARKS.map((b) => (
            <div key={b.at} className="absolute -bottom-2 h-2 w-px bg-muted" style={{ left: `${b.at}%` }} />
          ))}
        </div>
        <div aria-hidden className="relative mt-2 h-4 text-[12px] font-bold uppercase tracking-[0.08em]">
          <span className="absolute left-0 text-bad">■ Stop</span>
          <span className="absolute -translate-x-1/2 text-warn" style={{ left: `${(stop + go) / 2}%` }}>
            ↻ Fix
          </span>
          <span className="absolute -translate-x-1/2 text-ok" style={{ left: `${(go + 100) / 2}%` }}>
            ✓ Go
          </span>
        </div>
      </div>
      <figcaption className="mt-3 space-y-0.5 text-[13px] leading-snug text-muted">
        {BENCHMARKS.map((b) => (
          <div key={b.at} className="flex items-center gap-2">
            <span aria-hidden className="inline-block h-2.5 w-px bg-muted" />
            {b.label}
          </div>
        ))}
      </figcaption>
    </figure>
  );
}

export function PilotSection({ index = "02" }: { index?: string }) {
  const [perWalk, setPerWalk] = useState(8);
  const [rate, setRate] = useState(55);
  const read = useMemo(() => readPilot(perWalk, rate / 100), [perWalk, rate]);
  const fair = useMemo(() => perGroupToCompare(0.5, 0.65), []);
  // The pilot's size follows the slider, so this card and the count above it always agree.
  const pilot = pilotFirstTimers(perWalk);
  const v = VERDICT[read.verdict];

  return (
    <section id="pilot" aria-labelledby="pilot-title" className="mx-auto w-full max-w-[1320px] px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <SectionHead
        id="pilot"
        index={index}
        label="The pilot"
        title="Six Saturdays, three cities. *One clear answer.*"
        lede={`Before Year 10 grows, test the one thing that matters: do first-timers come back? ${PILOT_WALKS} first walks answer it, judged by lines we agree on before the first one.`}
        why="one clear answer before people and money are spent at scale."
      />

      <div className="mt-10 grid items-start gap-6 lg:grid-cols-12">
        <Reveal className="card p-5 sm:p-7 lg:col-span-7">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="eyebrow">Try the pilot&apos;s answer</div>
            <div className="text-[13px] text-muted">
              {PILOT.cities} cities × {PILOT.walksPerCity} Saturdays = {PILOT_WALKS} walks
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Slider id="pilot-first-timers" label="First-timers per walk" value={perWalk} min={3} max={15} show={`${perWalk}`} note={`${read.firstTimers} first-timers in all`} onChange={setPerWalk} />
            <Slider id="pilot-return" label="Back by week 4" value={rate} min={20} max={80} show={`${rate}%`} note="of those first-timers" onChange={setRate} />
          </div>

          <ReturnTrack rate={read.rate} low={read.low} high={read.high} verdict={read.verdict} />

          <div className={cn("mt-5 rounded-2xl border p-4", v.tone)} data-verdict={read.verdict} aria-live="polite">
            <div className="flex items-center gap-2 text-[13px] font-black uppercase tracking-[0.1em]">
              <span aria-hidden>{v.icon}</span>
              {v.word}
            </div>
            <p className="mt-1 text-[16px] font-bold leading-snug text-ink">{read.headline}</p>
            <p className="mt-1 text-[14px] leading-snug text-ink/80">{read.sureness}</p>
          </div>

          {/* Why every walk gets a back walker instead of testing one against none. */}
          <div className="mt-5 rounded-2xl bg-surface-2/60 p-4">
            <div className="text-[15px] font-bold">Why every walk gets a back walker</div>
            <p className="mt-1 text-[14px] leading-snug text-muted">
              The pilot is too small to test walks without one: a fair test needs about {fair} first-timers on each side, and the whole pilot has about {pilot}. So every walk gets a back walker.
            </p>
            <div aria-hidden className="mt-3 space-y-1.5 text-[12px] font-semibold text-muted">
              <div className="grid grid-cols-[96px_1fr] items-center gap-2">
                <span>A fair test</span>
                <span className="flex h-2.5 gap-[2px]">
                  <span className="h-full rounded-l-full bg-ink/45" style={{ width: "50%" }} />
                  <span className="h-full rounded-r-full bg-ink/45" style={{ width: "50%" }} />
                </span>
              </div>
              <div className="grid grid-cols-[96px_1fr] items-center gap-2">
                <span>The pilot</span>
                <span className="h-2.5 rounded-full bg-accent transition-[width] duration-300" style={{ width: `${Math.round((pilot / (fair * 2)) * 100)}%` }} />
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal className="lg:col-span-5" delay={80}>
          <div className="eyebrow">What we watch</div>
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {MEASURES.map((m) => (
              <li key={m.name} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 p-4">
                <span className="text-[15.5px] font-bold leading-snug">{m.name}</span>
                <span className="num self-start whitespace-nowrap rounded-full bg-ok-soft px-2.5 py-0.5 text-[13px] font-bold text-ok">Go: {m.go}</span>
                <span className="col-span-2 text-[14px] leading-snug text-muted">{m.seen}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[14px] leading-snug text-muted">Goal: City Leads spend four hours a week or less. Any serious incident pauses the pilot.</p>
          <div className="mt-5 rounded-2xl border border-line p-4">
            <div className="text-[15px] font-bold">Where and when</div>
            <p className="mt-1 text-[14px] leading-snug text-muted">
              Chicago, the biggest. Detroit, in the middle. Los Angeles, the newest. When is your call: six Saturdays before May 1, the first six weeks of Year 10, or a fall test in warm cities.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
