"use client";

// Two plain answers under the Giving phone:
//  - How the giving fund can work without 100 Miles of Summer starting its own
//    charity: a nonprofit partner holds the money, sponsors fund it at a stated
//    share, members pick, and a real walk proves it. Never said as set up.
//  - Neighborhood Fixes, the next idea: members flag a walk that needs shade or
//    somewhere to sit; the giving fund plus a small neighborhood grant fixes the
//    route, and the walk fits more people. A before/after you can flip.

import { useState } from "react";
import { cn } from "@/components/ui/kit";
import { Reveal, Words } from "@/components/ui/Reveal";
import { hotWord } from "@/components/demo/TryIt";

const FUND_STEPS = [
  { title: "Sponsors fund it", line: "The ad says exactly how much goes to giving: “15% of their deal.”" },
  { title: "A nonprofit partner holds it", line: "No new charity to start. Partners usually keep a small share for holding the money." },
  { title: "Members pick where it goes", line: "One vote each, city by city." },
  { title: "A real walk proves it", line: "People checked in by name. That's the line in the sponsor's report." },
];

export function HowItCouldWork({ index = "02" }: { index?: string }) {
  return (
    <section aria-labelledby="how-it-could-work-title" className="mx-auto w-full max-w-[1320px] px-4 pb-20 sm:px-6 lg:px-8">
      <div className="index-line">
        <b>{index}</b> How it could work
      </div>
      <div className="mt-6 grid gap-x-12 gap-y-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end">
        <h2 id="how-it-could-work-title" className="t-section">
          <Words text="No new charity. *No guesswork.*" render={hotWord} />
        </h2>
        <Reveal>
          <p className="t-lede">How the giving fund could run from day one — and the next thing members could fund.</p>
        </Reveal>
      </div>

      <div className="mt-10 grid gap-4 lg:grid-cols-2">
        <Reveal as="div" className="card flex flex-col p-6 sm:p-7">
          <article aria-label="The giving fund, without starting a charity" className="flex h-full flex-col">
            <div className="eyebrow">The giving fund</div>
            <h3 className="t-card mt-2">Without starting a charity</h3>
            {/* Beside the taller Neighborhood Fixes card the steps share the spare height, joined circle to circle, so it reads as a path, not a gap. */}
            <ol className="mt-5 flex flex-1 flex-col gap-4">
              {FUND_STEPS.map((s, i) => (
                <li key={s.title} className="relative flex flex-1 gap-3.5">
                  {i < FUND_STEPS.length - 1 ? <span aria-hidden className="absolute -bottom-4 left-4 top-8 w-px -translate-x-1/2 bg-accent/30" /> : null}
                  <span aria-hidden className="num flex size-8 shrink-0 items-center justify-center rounded-full border border-accent/50 bg-surface text-[13px] font-bold text-accent-ink shadow-[inset_0_0_0_32px_rgba(255,106,19,0.1)]">
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[16px] font-bold leading-snug">{s.title}</span>
                    <span className="mt-0.5 block text-[14.5px] leading-snug text-muted">{s.line}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-auto pt-6 text-[13.5px] leading-snug text-muted">Not set up yet. Kayla picks the partner and the share; the books stay this simple.</p>
          </article>
        </Reveal>

        <Reveal as="div" delay={90} className="card flex flex-col p-6 sm:p-7">
          <NeighborhoodFixes />
        </Reveal>
      </div>
    </section>
  );
}

const BEFORE = ["No shade", "Nowhere to sit", "Stairs at the start"];
const AFTER = ["Shade", "Benches", "Step-free start"];

function NeighborhoodFixes() {
  const [after, setAfter] = useState(false);
  return (
    <article aria-label="Neighborhood Fixes" className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2">
        <span className="eyebrow">Next idea</span>
        <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.1em] text-accent-ink">New</span>
      </div>
      <h3 className="t-card mt-2">Neighborhood Fixes</h3>
      <p className="mt-2 text-[15.5px] leading-relaxed text-muted">Members flag a walk that needs shade or somewhere to sit. The giving fund and a small neighborhood grant fix it — and the walk fits more people.</p>

      <div role="group" aria-label="Before or after" className="mt-5 inline-flex self-start rounded-full bg-surface-2 p-1">
        {(
          [
            [false, "Before"],
            [true, "After"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={label}
            type="button"
            aria-pressed={after === value}
            onClick={() => setAfter(value)}
            className={cn("min-h-10 rounded-full px-4 text-[13.5px] font-bold transition-colors", after === value ? "bg-ink text-bg" : "text-muted hover:text-ink")}
          >
            {label}
          </button>
        ))}
      </div>

      <figure className="mt-4">
        <RouteSketch after={after} />
        <figcaption className="sr-only">{after ? `After: ${AFTER.join(", ")}.` : `Before: ${BEFORE.join(", ")}.`}</figcaption>
      </figure>
      <ul aria-label={after ? "After the fix" : "Before the fix"} className="mt-3 flex flex-wrap gap-1.5">
        {(after ? AFTER : BEFORE).map((x) => (
          <li key={x} className={cn("rounded-full px-2.5 py-1 text-[12.5px] font-bold", after ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn")}>
            {after ? "✓ " : ""}
            {x}
          </li>
        ))}
      </ul>
      <p className="mt-auto pt-5 text-[13.5px] leading-snug text-muted">
        {after ? "A small walking grant can be $2,500. With the giving fund beside it, one route gets shade and somewhere to rest." : "Flip to After to see what one small grant could change."}
      </p>
    </article>
  );
}

/** One route along a riverwalk, drawn plainly: the sun and the stairs before; trees, benches and a ramp after. */
function RouteSketch({ after }: { after: boolean }) {
  const trees = [
    [70, 58],
    [128, 92],
    [196, 70],
    [262, 98],
    [318, 62],
  ];
  const benches = [
    [100, 108],
    [230, 112],
    [290, 82],
  ];
  return (
    <svg viewBox="0 0 380 160" className="block h-auto w-full rounded-2xl border border-line bg-surface-2" aria-hidden>
      {/* The river edge. */}
      <path d="M0 140 C 90 128, 160 150, 240 136 S 360 128, 380 134 L 380 160 L 0 160 Z" className="fill-[color-mix(in_oklab,var(--info)_22%,transparent)]" />
      {/* The route. */}
      <path d="M24 118 C 70 70, 120 120, 170 90 S 270 60, 352 84" fill="none" strokeWidth={6} strokeLinecap="round" className="stroke-[color-mix(in_oklab,var(--ink)_28%,transparent)]" />
      <path d="M24 118 C 70 70, 120 120, 170 90 S 270 60, 352 84" fill="none" strokeWidth={2.5} strokeLinecap="round" strokeDasharray="2 9" className="stroke-accent" />
      {/* Start and finish. */}
      <circle cx={24} cy={118} r={7} className="fill-accent" />
      <circle cx={352} cy={84} r={7} className="fill-ink" />

      {/* Before: full sun, and stairs at the start. */}
      <g className={cn("transition-opacity duration-500", after ? "opacity-0" : "opacity-100")}>
        <circle cx={330} cy={30} r={14} className="fill-warn" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
          const r = (a * Math.PI) / 180;
          return <line key={a} x1={330 + Math.cos(r) * 19} y1={30 + Math.sin(r) * 19} x2={330 + Math.cos(r) * 26} y2={30 + Math.sin(r) * 26} strokeWidth={3} strokeLinecap="round" className="stroke-warn" />;
        })}
        <path d="M8 142 h12 v-8 h12 v-8 h12 v-8" fill="none" strokeWidth={3} strokeLinejoin="round" className="stroke-warn" />
      </g>

      {/* After: shade trees, benches, and a ramp instead of the stairs. */}
      <g className={cn("transition-opacity duration-500", after ? "opacity-100" : "opacity-0")}>
        {trees.map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <rect x={x! - 1.5} y={y! + 8} width={3} height={10} rx={1} className="fill-[color-mix(in_oklab,var(--ink)_40%,transparent)]" />
            <circle cx={x} cy={y} r={12} className="fill-ok opacity-80" />
          </g>
        ))}
        {benches.map(([x, y]) => (
          <g key={`b${x}-${y}`}>
            <rect x={x! - 9} y={y!} width={18} height={4} rx={1.5} className="fill-ink" />
            <rect x={x! - 7} y={y! + 4} width={2} height={5} className="fill-ink" />
            <rect x={x! + 5} y={y! + 4} width={2} height={5} className="fill-ink" />
          </g>
        ))}
        <path d="M6 142 L 44 118" fill="none" strokeWidth={4} strokeLinecap="round" className="stroke-ok" />
      </g>
    </svg>
  );
}
