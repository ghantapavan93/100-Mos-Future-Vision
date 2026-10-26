"use client";

// "The whole app on one page": the five acts in story order, each screen with
// its one-line promise, so a first visit knows within thirty seconds what is
// here and where to tap. The same grouping as the menu and the footer
// (src/lib/lenses.ts).

import Link from "next/link";
import { Button, cn } from "@/components/ui/kit";
import { Reveal, Words } from "@/components/ui/Reveal";
import { hotWord } from "@/components/demo/TryIt";
import { STEPS, TOUR_NAME } from "@/components/present/Present";
import { ACTS, lensesIn } from "@/lib/lenses";
import { store } from "@/lib/store";

interface Row {
  href: string;
  label: string;
  promise: string;
  /** The one screen to look at first: drawn a little brighter. */
  featured?: boolean;
}

/** Act 1 is Home itself, so its rows point down this page rather than back to it. */
const HOME_ROWS: Row[] = [
  { href: "#today", label: "What's already built", promise: "Nine summers, seven cities, and the numbers behind them." },
  { href: "#next", label: "Where it goes next", promise: "Three ideas, each built on something that already works." },
];

function rowsFor(act: (typeof ACTS)[number]): Row[] {
  if (act.id === 1) return HOME_ROWS;
  return lensesIn(act.id).map((l) => ({ href: l.href, label: l.label, promise: l.promise, featured: l.href === "/coach" }));
}

export function AppMap() {
  return (
    <section id="map" aria-labelledby="map-title" data-mode="night" className="bg-bg py-20 text-ink sm:py-24">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
        <div className="kicker">Start here</div>
        <div className="mt-6 grid gap-x-12 gap-y-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end">
          <h2 id="map-title" className="display text-[44px] sm:text-[72px]">
            <Words text="The whole app *on one page.*" render={hotWord} />
          </h2>
          <Reveal className="flex flex-col items-start gap-5">
            <p className="t-lede">
              A working picture of 100 Miles of Summer&apos;s next chapter: tap any phone to try it. Five parts, one summer — follow them in order, or jump in anywhere.
            </p>
            <Button variant="primary" onClick={() => store.setUI({ present: 0 })}>
              Start the tour · {STEPS.length} stops
            </Button>
            <p className="-mt-2 text-[13.5px] text-muted">
              {TOUR_NAME}: one mover&apos;s first walk, followed through every screen. Each stop has a &ldquo;Show me&rdquo; button that does it for you.
            </p>
          </Reveal>
        </div>

        <ol className="mt-12 border-t border-line">
          {ACTS.map((act, i) => (
            <Reveal as="li" key={act.id} delay={50 * i} className="grid gap-4 border-b border-line py-6 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:items-center lg:gap-10">
              <div className="flex items-start gap-4">
                <span aria-hidden className="w-9 shrink-0 font-[family-name:var(--font-display)] text-[44px] font-black leading-[0.85] tracking-[-0.04em] text-accent">
                  {act.id}
                </span>
                <div className="min-w-0">
                  <h3 className="font-[family-name:var(--font-display)] text-[20px] font-black uppercase leading-[1.05] tracking-[-0.01em]">
                    <span className="sr-only">Part {act.id}: </span>
                    {act.title}
                  </h3>
                  <p className="mt-1.5 text-[14.5px] leading-snug text-muted">{act.line}</p>
                </div>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {rowsFor(act).map((r) => (
                  <li key={r.href}>
                    <Link
                      href={r.href}
                      className={cn(
                        "group flex h-full flex-col rounded-2xl border bg-surface p-4 transition-colors hover:border-accent/60 hover:bg-surface-2",
                        r.featured ? "border-accent/50 shadow-[0_0_40px_-18px_var(--accent)]" : "border-line",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-[16px] font-bold leading-tight">{r.label}</span>
                        <span aria-hidden className="ml-auto text-accent transition-transform group-hover:translate-x-1">
                          →
                        </span>
                      </span>
                      <span className="mt-1.5 text-[14px] leading-snug text-muted">{r.promise}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
