"use client";

// "From the first idea to the real thing": the Quantum Health Coach began as
// an idea in the first 100 Miles of Summer prototype. Each row keeps the idea
// and says how it works now — kinder, private, and something Kirk can build.

import { hotWord } from "@/components/demo/TryIt";
import { Reveal, Words } from "@/components/ui/Reveal";

const ROWS: { idea: string; now: string }[] = [
  { idea: "A mirror of your progress", now: "Your own miles, read back kindly — only from the apps you say yes to." },
  { idea: "Every wearable and device", now: "Apple Health, Health Connect and Garmin, each with your yes. Strava stays private, by its own rules." },
  { idea: "Mind, body and spirit", now: "Mind, body and belonging: rest counts, hard days get kindness and a real person — never a diagnosis." },
  { idea: "Zero tracking", now: "Private by default. Sponsors never see you, and “Forget what I asked” wipes your questions." },
  { idea: "Always on, always optimizing", now: "Never pushing. Enjoyment first, and one small step you choose — or none at all." },
];

export function FirstIdea({ id = "first-idea", index = "03" }: { id?: string; index?: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="mx-auto w-full max-w-[1320px] px-4 pb-20 sm:px-6 lg:px-8">
      <div className="index-line">
        <b>{index}</b> Where it came from
      </div>
      <div className="mt-6 grid gap-x-12 gap-y-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end">
        <h2 id={`${id}-title`} className="t-section">
          <Words text="The first idea, *made real.*" render={hotWord} />
        </h2>
        <Reveal>
          <p className="t-lede">The Quantum Health Coach started as an idea in the first 100 Miles of Summer prototype. Every part of it is still here — built so a member can trust it.</p>
        </Reveal>
      </div>
      <Reveal className="mt-10">
        <div className="card overflow-hidden" role="table" aria-label="The first idea and how it works now">
          <div role="row" className="hidden grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)] gap-6 border-b border-line bg-surface-2/60 px-6 py-3 sm:grid">
            <span role="columnheader" className="eyebrow">
              The first idea
            </span>
            <span role="columnheader" className="eyebrow">
              How it works now
            </span>
          </div>
          {ROWS.map((r) => (
            <div role="row" key={r.idea} className="grid gap-1 border-b border-line px-6 py-4 last:border-b-0 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)] sm:items-baseline sm:gap-6">
              <span role="cell" className="text-[16px] font-bold">
                {r.idea}
              </span>
              <span role="cell" className="text-[15.5px] leading-relaxed text-muted">
                <span aria-hidden className="mr-2 text-accent-ink sm:hidden">→</span>
                {r.now}
              </span>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
