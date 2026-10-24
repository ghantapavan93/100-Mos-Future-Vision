"use client";

// Five summers, 2027 → 2031: what each one sets out to prove, what has to be
// true first, and how we'd know it worked. Possibilities, not promises — said
// once, in the lede. Tap a summer to open it; on phones it opens in place.

import { useState } from "react";
import { cn } from "@/components/ui/kit";
import { Reveal, Words } from "@/components/ui/Reveal";
import { hotWord } from "@/components/demo/TryIt";

interface Summer {
  year: string;
  name: string;
  line: string;
  mustBe: string[];
  know: string[];
  opens: string;
}

/** The "how we'd know" lines follow the test-season thresholds in domain/pilot.ts. */
export const SUMMERS: Summer[] = [
  {
    year: "2027",
    name: "Ten summers strong",
    line: "Prove people come: weekly first walks in all seven cities, joinable from a poster, and, if you want one, a Year 10 relay.",
    mustBe: ["Every walk has a City Lead, a back walker and a one-page sign-up.", "Goal: City Leads spend four hours a week or less on it.", "Kayla's week stays about three minutes."],
    know: ["Most people who sign up show up.", "Half of first-timers come back within four weeks.", "Turnout grows week over week in most cities."],
    opens: "A story partners can see, and pay for.",
  },
  {
    year: "2028",
    name: "Repeat it",
    line: "Work toward paying its way: find out which money comes back, and run programs for companies and campuses without Kayla running each one.",
    mustBe: ["Company teams — your Year 10 goal — run a second time.", "The giving fund has a legal home, through a partner charity.", "Every sponsor gets a report in a week."],
    know: ["Half of sponsors come back for a second summer.", "Money in covers the season's walks.", "A program runs somewhere new with no founder visit."],
    opens: "Room to hire a program lead.",
  },
  {
    year: "2029",
    name: "Grow it",
    line: "Grow across your cities and new ones: City Leads trained by City Leads, and a ready kit for every new city.",
    mustBe: ["The first Fellowship class leads walks on its own.", "Every Lead's load is watched, not guessed."],
    know: ["A new city launches with a trained Lead and no founder trip.", "Most Leads say their load is fine, most weeks."],
    opens: "More cities without more strain.",
  },
  {
    year: "2030",
    name: "Places",
    line: "Walks that fit more people: checked accessible routes, story trails, and neighborhood fixes with partners.",
    mustBe: ["Routes are checked by people, never guessed from a map.", "Parks, libraries and city partners say yes."],
    know: ["A fixed route brings someone new to a walk.", "A partner funds a second fix."],
    opens: "Partners in parks, libraries and city halls.",
  },
  {
    year: "2031",
    name: "A summer people wait for",
    line: "A yearly opening that travels through every city: the relay, and art made from everyone's movement.",
    mustBe: ["Every city's circle runs strong on its own.", "A title partner for opening day."],
    know: ["Cities ask to join before they're invited.", "People plan their summer around opening day."],
    opens: "A cultural moment, every summer.",
  },
];

function Detail({ s }: { s: Summer }) {
  return (
    <div className="rise-in card grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.1fr_1fr_1fr]">
      <div>
        <div className="num text-[13px] font-bold text-accent-ink">{s.year}</div>
        <div className="mt-1 font-[family-name:var(--font-display)] text-[24px] font-black uppercase leading-[0.95] tracking-[-0.02em]">{s.name}</div>
        <p className="mt-2 text-[15px] leading-relaxed text-ink/90">{s.line}</p>
        <p className="mt-3 text-[14px] text-muted">
          <span className="font-semibold text-ink">It opens: </span>
          {s.opens}
        </p>
      </div>
      <div>
        <div className="eyebrow">What has to be true first</div>
        <ul className="mt-2 space-y-2 text-[14.5px] leading-snug">
          {s.mustBe.map((m) => (
            <li key={m} className="flex gap-2">
              <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-warn" />
              {m}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="eyebrow">How we'd know</div>
        <ul className="mt-2 space-y-2 text-[14.5px] leading-snug">
          {s.know.map((k) => (
            <li key={k} className="flex gap-2">
              <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-ok" />
              {k}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function FiveSummers({ index = "01" }: { index?: string }) {
  const [open, setOpen] = useState(0);
  return (
    <section id="five-summers" aria-labelledby="summers-title" className="mx-auto w-full max-w-[1320px] scroll-mt-20 px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="index-line">
        <b>{index}</b> Five summers
      </div>
      <div className="mt-6 grid gap-x-12 gap-y-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end">
        <h2 id="summers-title" className="t-section">
          <Words text="Five summers, *one network.*" render={hotWord} />
        </h2>
        <Reveal>
          <p className="t-lede">Each summer has to earn the next. Ideas, not promises — Kayla picks what's next.</p>
        </Reveal>
      </div>

      <ol className="relative mt-10 grid gap-3 lg:grid-cols-5" aria-label="Five summers">
        {SUMMERS.map((s, i) => (
          <li key={s.year} className="relative">
            {/* Equal heights only in the row of five: on phones the open summer's detail sits under its button, so the button keeps its own height. */}
            <button
              type="button"
              onClick={() => setOpen(i)}
              aria-pressed={open === i}
              aria-controls="summer-detail"
              className={cn("tap group flex w-full lg:h-full flex-col items-start rounded-2xl border p-4 text-left transition-colors", open === i ? "border-accent/70 bg-accent/10 shadow-[var(--glow)]" : "border-line bg-surface hover:border-line-strong")}
            >
              <span className="flex items-center gap-2">
                <span aria-hidden className={cn("size-3 rounded-full border-2", open === i ? "border-accent bg-accent shadow-[0_0_12px_var(--accent)]" : "border-line-strong bg-bg")} />
                <span className="num text-[14px] font-bold text-accent-ink">{s.year}</span>
              </span>
              <span className="mt-2 font-[family-name:var(--font-display)] text-[19px] font-black uppercase leading-[0.95] tracking-[-0.02em]">{s.name}</span>
              <span className="mt-1.5 text-[13.5px] leading-snug text-muted">{s.line.split(":")[0]}.</span>
            </button>
            {open === i ? (
              <div className="mt-3 lg:hidden">
                <Detail s={s} />
              </div>
            ) : null}
          </li>
        ))}
      </ol>
      <div id="summer-detail" className="mt-4 hidden lg:block">
        <Detail key={open} s={SUMMERS[open]!} />
      </div>
    </section>
  );
}
