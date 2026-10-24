"use client";

// A lens's opening: a full-bleed live 3D scene with the lens's words over it.
// The picture is never the only way to get its facts: the legend beside it says
// in text what each thing in the scene is and its current value, and that text
// is what screen readers get (the Stage itself is aria-hidden).
//
// Desktop: words on the left over a side scrim, the scene's subject to the right.
// Phones: the scene fills the top, the words sit on a bottom scrim — so scenes
// should frame their subject in the upper half when the viewport is portrait.

import type { ReactNode } from "react";
import { cn } from "@/components/ui/kit";
import { Reveal, Words } from "@/components/ui/Reveal";
import { LIGHT, type Mode } from "./palette";

export interface LegendItem {
  label: string;
  value?: ReactNode;
  /** Swatch matching the scene's colour for this thing. */
  color?: string;
  /** Hollow swatch for things shown as an outline (promised, private, not counted). */
  hollow?: boolean;
}

/** `#rrggbb` plus a two-digit alpha. */
const alpha = (hex: string, a: number) => `${hex}${Math.round(a * 255).toString(16).padStart(2, "0")}`;

export function Hero({
  mode,
  eyebrow,
  title,
  lede,
  actions,
  stage,
  legend,
  legendTitle = "What you're seeing",
  basis,
  side,
  className,
}: {
  mode: Mode;
  eyebrow: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
  /** A `<Stage …/>`. */
  stage: ReactNode;
  legend?: LegendItem[];
  legendTitle?: string;
  /** A Badge saying what the numbers are (fictional, simulated, live from the engine). */
  basis?: ReactNode;
  /** A control panel in the legend's place, when the scene's real control is a list (City Circles). */
  side?: ReactNode;
  className?: string;
}) {
  const bg = LIGHT[mode].bg;
  return (
    <section data-hero={mode} className={cn("relative isolate overflow-hidden", className)} style={{ background: bg }}>
      <div className="absolute inset-0 -z-20">{stage}</div>
      {/* Scrims keep the words readable over any frame, and fade the scene into the page below. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 hidden lg:block" style={{ background: `linear-gradient(90deg, ${alpha(bg, 0.94)} 0%, ${alpha(bg, 0.78)} 30%, ${alpha(bg, 0)} 58%)` }} />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 lg:hidden" style={{ background: `linear-gradient(180deg, ${alpha(bg, 0)} 30%, ${alpha(bg, 0.86)} 58%, ${bg} 82%)` }} />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-28" style={{ background: `linear-gradient(180deg, ${alpha(bg, 0)}, ${bg})` }} />

      <div className="pointer-events-none mx-auto flex min-h-[clamp(600px,86svh,940px)] w-full max-w-[1240px] flex-col justify-end gap-8 px-4 pb-10 pt-[42svh] sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8 lg:pb-14 lg:pt-28">
        <div className="pointer-events-auto max-w-[760px]">
          <div className="kicker">{eyebrow}</div>
          <h1 className="t-page mt-5 [text-wrap:balance]">
            {typeof title === "string" ? <Words text={title} render={(t) => (t.startsWith("*") && t.endsWith("*") ? <span className="hot">{t.slice(1, -1)}</span> : t)} /> : title}
          </h1>
          {lede ? (
            <Reveal delay={250}>
              <p className="t-lede mt-5 max-w-[620px]">{lede}</p>
            </Reveal>
          ) : null}
          {actions ? (
            <Reveal delay={400} className="mt-6 flex flex-wrap gap-2">
              {actions}
            </Reveal>
          ) : null}
        </div>

        {side ? (
          <div className="pointer-events-auto w-full max-w-[340px] shrink-0 rounded-2xl border border-line bg-surface/85 p-4 shadow-[var(--shadow)] backdrop-blur-md">{side}</div>
        ) : legend?.length ? (
          // A quiet key, not a card: a thin rule and plain rows, like a caption in a magazine.
          <aside aria-label={legendTitle} className="pointer-events-auto w-full max-w-[320px] shrink-0 border-t border-line-strong/70 pt-3">
            <div className="flex items-center justify-between gap-3">
              <div className="eyebrow">{legendTitle}</div>
              {basis}
            </div>
            <ul className="mt-3 space-y-2 text-[14px]">
              {legend.map((item) => (
                <li key={item.label} className="flex items-baseline gap-2.5">
                  {item.color ? (
                    <span
                      aria-hidden
                      className="mt-[3px] inline-block size-2.5 shrink-0 self-start rounded-full"
                      style={item.hollow ? { boxShadow: `inset 0 0 0 2px ${item.color}` } : { background: item.color }}
                    />
                  ) : null}
                  <span className="min-w-0 flex-1 text-muted">{item.label}</span>
                  {item.value !== undefined ? <span className="num shrink-0 font-semibold text-ink">{item.value}</span> : null}
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
