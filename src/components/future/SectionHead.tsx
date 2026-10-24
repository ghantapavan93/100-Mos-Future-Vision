"use client";

// The head every proof section shares with Try it and Ideas: the magazine index
// line, a headline that rises word by word, the lede beside it, and one line on
// why the section matters.

import type { ReactNode } from "react";
import { hotWord } from "@/components/demo/TryIt";
import { Reveal, Words } from "@/components/ui/Reveal";

export function SectionHead({ id, index, label, title, lede, why }: { id: string; index: string; label: string; title: string; lede: ReactNode; why: string }) {
  return (
    <>
      <div className="index-line">
        <b>{index}</b> {label}
      </div>
      <div className="mt-6 grid gap-x-12 gap-y-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end">
        <h2 id={`${id}-title`} className="t-section">
          <Words text={title} render={hotWord} />
        </h2>
        <Reveal>
          <p className="t-lede">{lede}</p>
          <p className="mt-3 text-[15px] font-semibold leading-snug text-ink">
            <span className="text-accent-ink">Why it matters: </span>
            {why}
          </p>
        </Reveal>
      </div>
    </>
  );
}

/** A labelled range input: the label and its live value on one line, the slider below. */
export function Slider({ id, label, value, min, max, step = 1, show, note, onChange }: { id: string; label: string; value: number; min: number; max: number; step?: number; show: string; note?: string; onChange: (v: number) => void }) {
  return (
    <div className="rounded-2xl bg-surface-2/60 px-4 pb-1.5 pt-3">
      <label htmlFor={id} className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-bold">{label}</span>
        <span className="num text-[18px] font-bold text-accent-ink">{show}</span>
      </label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-10 w-full" />
      {note ? <p className="-mt-1 pb-2 text-[13px] text-muted">{note}</p> : null}
    </div>
  );
}
