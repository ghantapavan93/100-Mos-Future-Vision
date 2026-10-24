"use client";

// Three numbers that make a screen's case, big and plain. Each counts up once
// when it comes into view (instantly when motion is reduced or paused), then
// sits still. No citations on screen: the numbers are chosen to be solid, and
// the research behind them lives in the repo.

import { useEffect, useRef, useState } from "react";
import { cn } from "@/components/ui/kit";
import { useUI } from "@/lib/store";

export interface DataPoint {
  /** What to show, e.g. "50%", "3×", "10,000+". A leading number of 10 or more counts up. */
  value: string;
  /** One plain sentence that finishes the thought. */
  line: string;
}

/** Splits "10,000+" into prefix "", number 10000, suffix "+" so the number can count. */
function parts(value: string): { pre: string; n: number | null; post: string; decimals: number; grouped: boolean } {
  const m = value.match(/^([^\d]*)([\d,]+(?:\.\d+)?)(.*)$/);
  if (!m) return { pre: value, n: null, post: "", decimals: 0, grouped: false };
  const raw = m[2]!;
  const n = Number(raw.replace(/,/g, ""));
  // Small numbers ("3 in 4", "2×"), bounds ("<1%") and money ("$167K") read
  // wrong mid-count ("0 in 4", "<0%", "$139K"), so they stay still.
  if (n < 10 || /[<>~≈$€£]/.test(m[1]!)) return { pre: value, n: null, post: "", decimals: 0, grouped: false };
  return { pre: m[1]!, n, post: m[3]!, decimals: raw.includes(".") ? raw.split(".")[1]!.length : 0, grouped: raw.includes(",") };
}

function useReduced(): boolean {
  const { motionPaused } = useUI();
  const [os, setOs] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setOs(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return os || motionPaused;
}

function Counter({ value }: { value: string }) {
  const p = parts(value);
  const reduced = useReduced();
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState<number | null>(p.n === null ? null : 0);

  useEffect(() => {
    if (p.n === null) return;
    if (reduced) {
      setShown(p.n);
      return;
    }
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const run = (now: number) => {
          const t = Math.min(1, (now - start) / 1400);
          setShown(p.n! * (1 - Math.pow(1 - t, 3)));
          if (t < 1) raf = requestAnimationFrame(run);
        };
        raf = requestAnimationFrame(run);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [p.n, reduced]);

  if (p.n === null || shown === null) return <span ref={ref}>{value}</span>;
  const text = p.grouped ? shown.toLocaleString("en-US", { maximumFractionDigits: p.decimals, minimumFractionDigits: p.decimals }) : shown.toFixed(p.decimals);
  return (
    <span ref={ref} aria-label={value}>
      <span aria-hidden>
        {p.pre}
        {text}
        {p.post}
      </span>
    </span>
  );
}

export function DataStrip({ points, className }: { points: DataPoint[]; className?: string }) {
  return (
    <section aria-label="In numbers" className={cn("mx-auto w-full max-w-[1320px] px-4 sm:px-6 lg:px-8", className)}>
      <ul className="grid gap-px overflow-hidden rounded-[22px] border border-line bg-line sm:grid-cols-3">
        {points.map((d) => (
          <li key={d.line} className="bg-surface p-6 sm:p-7">
            <div className="font-[family-name:var(--font-display)] text-[clamp(40px,5vw,64px)] font-black leading-none tracking-[-0.045em] text-accent">
              <Counter value={d.value} />
            </div>
            <p className="mt-3 max-w-[30ch] text-[15.5px] leading-snug text-muted">{d.line}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
