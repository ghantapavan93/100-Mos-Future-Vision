"use client";

// "Try it": the heart of every screen. A short list of things to tap on the
// phone, each ticking itself off when it really happens (the steps read the
// live world, not a click counter), each revealing one line of why it matters.
// Beside the phone, what just happened — in plain words.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Receipt } from "@/domain/engine";
import type { World } from "@/domain/types";
import { cn } from "@/components/ui/kit";
import { Reveal, Words } from "@/components/ui/Reveal";

/** Renders a `*starred*` token from `Words` as the hot phrase. */
export function hotWord(token: string): ReactNode {
  return token.length > 2 && token.startsWith("*") && token.endsWith("*") ? <span className="hot">{token.slice(1, -1)}</span> : token;
}
import { store, useLedger, useWorld } from "@/lib/store";
import { OUTCOME_TONE, OUTCOME_WORDS, plain } from "./plain";
import { TapHint } from "./TapHint";

export interface Step {
  id: string;
  /** What to do, starting with a verb: "Tap Log a walk". */
  label: string;
  /** Where to find it, if it isn't obvious. */
  hint?: string;
  /** One line on why it matters, shown once the step is done. */
  why: string;
  /**
   * Done when the world says so (a walk was logged), or when the phone marks it
   * (a screen was opened) — see `useMarkStep`.
   */
  done: (world: World, marked: ReadonlySet<string>) => boolean;
}

interface DemoState {
  marked: ReadonlySet<string>;
  mark: (id: string) => void;
}

const DemoContext = createContext<DemoState>({ marked: new Set(), mark: () => {} });

/** For things only the phone knows about ("opened the Coach tab"): call `mark("open-coach")`. */
export function useMarkStep() {
  return useContext(DemoContext).mark;
}

function Check({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300",
        on ? "border-ok bg-ok text-bg shadow-[0_0_18px_-2px_var(--ok)]" : "border-line-strong",
      )}
    >
      {on ? (
        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 8.5l3 3 6-7" />
        </svg>
      ) : null}
    </span>
  );
}

function Steps({ steps, world, marked, finale }: { steps: Step[]; world: World; marked: ReadonlySet<string>; finale?: ReactNode }) {
  const done = steps.map((s) => s.done(world, marked));
  const count = done.filter(Boolean).length;
  const next = done.findIndex((d) => !d);
  const lastDone = done.lastIndexOf(true);
  const later = done.filter((d, i) => !d && i !== next).length;
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="kicker">Try it</div>
        <span className="num text-[13px] text-muted" aria-live="polite">
          {count} of {steps.length}
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <div className="h-full rounded-full bg-accent shadow-[0_0_14px_var(--accent)] transition-[width] duration-500" style={{ width: `${(count / steps.length) * 100}%` }} />
      </div>
      <ol className="mt-5 space-y-3">
        {steps.map((s, i) => {
          const isDone = done[i]!;
          const isNext = i === next;
          return (
            <li
              key={s.id}
              data-next={isNext ? "true" : undefined}
              className={cn(
                "flex gap-3 rounded-2xl border p-3.5 transition-colors duration-300",
                // Narrow screens: the next step rides above the phone instead (NextBar), so it isn't said twice.
                !isDone && "hidden lg:flex",
                isDone ? "border-ok/40 bg-ok-soft/60" : isNext ? "border-accent/70 bg-accent/10 shadow-[var(--glow)]" : "border-line bg-surface",
              )}
            >
              <Check on={isDone} />
              <div className="min-w-0 flex-1">
                <div className={cn("text-[15.5px] font-bold leading-snug", isDone && "text-muted line-through decoration-ok/60")}>{s.label}</div>
                {!isDone && s.hint ? <div className="mt-0.5 text-[13.5px] text-muted">{s.hint}</div> : null}
                {isDone ? <div className={cn("mt-1 text-[14px] leading-snug text-ink", i !== lastDone && "hidden lg:block")}>{s.why}</div> : null}
              </div>
              {/* Beside the phone on wide screens: this card says where to look. */}
              {isNext ? (
                <span aria-hidden className="hidden shrink-0 items-center gap-1 self-center rounded-full bg-accent px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-[#140b05] lg:inline-flex">
                  On the phone <span className="text-[13px] leading-none">→</span>
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
      {next >= 0 ? (
        <p className="mt-3 text-[13.5px] text-muted lg:hidden">
          {later + 1} to go. <span className="font-semibold text-accent-ink">The next one is just below ↓</span>
        </p>
      ) : null}
      {count === steps.length && finale ? <div className="rise-in mt-5 rounded-2xl border border-accent/50 bg-accent/10 p-4 text-[15px] leading-relaxed">{finale}</div> : null}
    </div>
  );
}

/** The last few things that happened, as sentences. */
function Happened({ since, example }: { since: number; example: string }) {
  const ledger = useLedger();
  const recent: Receipt[] = ledger.filter((r) => r.seq > since).slice(-4).reverse();
  return (
    <div>
      <div className="eyebrow flex items-center gap-1.5">
        {/* The phone is to the left on wide screens and above on narrow ones. */}
        <span aria-hidden className="text-[13px] leading-none text-accent-ink">
          <span className="hidden lg:inline">←</span>
          <span className="lg:hidden">↑</span>
        </span>
        What just happened on the phone
      </div>
      {recent.length ? (
        <ul className="mt-3 space-y-2.5" aria-live="polite">
          {recent.map((r) => (
            <li key={r.seq} className="rise-in rounded-2xl border border-line bg-surface p-3.5">
              <span
                className={cn(
                  "inline-flex rounded-full px-2 py-0.5 text-[11px] font-black uppercase tracking-[0.08em]",
                  OUTCOME_TONE[r.outcome] === "ok" && "bg-ok-soft text-ok",
                  OUTCOME_TONE[r.outcome] === "bad" && "bg-bad-soft text-bad",
                  OUTCOME_TONE[r.outcome] === "warn" && "bg-warn-soft text-warn",
                  OUTCOME_TONE[r.outcome] === "info" && "bg-info-soft text-info",
                  OUTCOME_TONE[r.outcome] === "neutral" && "bg-surface-2 text-muted",
                )}
              >
                {OUTCOME_WORDS[r.outcome]}
              </span>
              <p className="mt-1.5 text-[14.5px] leading-snug">{plain(r.summary)}</p>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <p className="mt-3 text-[14.5px] leading-relaxed text-muted">Nothing yet. Tap the phone and it shows up here, in plain words — something like this:</p>
          {/* A faded example, so the empty column already shows what it's for. */}
          <div aria-hidden className="mt-3 rounded-2xl border border-dashed border-line p-3.5 opacity-50">
            <span className="inline-flex rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-black uppercase tracking-[0.08em] text-muted">Example</span>
            <p className="mt-1.5 text-[14.5px] leading-snug">{example}</p>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Narrow screens stack the steps above the phone, so the next one rides along
 * just above it: what to tap, and that it's the glowing thing below.
 */
function NextBar({ step, n, total }: { step: Step; n: number; total: number }) {
  return (
    <div className="sticky top-[64px] z-30 mb-3 lg:hidden" data-testid="next-bar">
      <div className="flex items-start gap-3 rounded-2xl border border-accent/60 bg-[color-mix(in_srgb,var(--bg)_90%,var(--accent))] p-3 shadow-[var(--glow)]">
        <span aria-hidden className="num flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-black text-[#140b05]">
          {n}
        </span>
        <div className="min-w-0">
          <div className="text-[11.5px] font-black uppercase tracking-[0.1em] text-accent-ink">
            Step {n} of {total}
          </div>
          <div className="mt-0.5 text-[15px] font-bold leading-snug">{step.label}</div>
          <div className="mt-0.5 text-[13px] leading-snug text-muted">
            {step.hint ? `${step.hint} ` : ""}
            <span className="whitespace-nowrap font-semibold text-accent-ink">It&apos;s glowing below ↓</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * A screen's "Try it" section: steps on the left, the phone in the middle,
 * what happened on the right (below on narrow screens).
 */
export function TryIt({
  id = "try",
  index = "01",
  title,
  intro,
  steps,
  phone,
  finale,
  aside,
  example = "1 mile counted for Maya.",
  feed = true,
}: {
  id?: string;
  /** The section's number on the page ("01"), shown in its index line. */
  index?: string;
  /** A short headline; *starred words* run hot. */
  title: string;
  intro: ReactNode;
  steps: Step[];
  phone: ReactNode;
  /** Shown when every step is done: the one-sentence takeaway. */
  finale?: ReactNode;
  /** Extra things beside the feed (a person picker, a "start over" button). */
  aside?: ReactNode;
  /** The faded sample in the empty feed: one sentence this screen's first tap would really produce. */
  example?: string;
  /** False for a phone that only reads (nothing it does changes the summer), so no feed promises otherwise. */
  feed?: boolean;
}) {
  const world = useWorld();
  const ledger = useLedger();
  const [marked, setMarked] = useState<ReadonlySet<string>>(() => new Set());
  const mark = useCallback((stepId: string) => setMarked((m) => (m.has(stepId) ? m : new Set(m).add(stepId))), []);
  const value = useMemo(() => ({ marked, mark }), [marked, mark]);
  // Only what happens on this visit shows in the feed; starting over starts the feed over too.
  const [since, setSince] = useState<number | null>(null);
  useEffect(() => {
    const last = ledger.at(-1)?.seq ?? 0;
    if (since === null || last < since) setSince(last);
  }, [ledger, since]);
  const startOver = () => {
    store.reset();
    setMarked(new Set());
  };

  // The guiding ring: whatever on the phone carries data-step-target="<next step's id>" gets it.
  const phoneBox = useRef<HTMLDivElement>(null);
  const nextIndex = steps.findIndex((s) => !s.done(world, marked));
  const nextStep = nextIndex < 0 ? null : steps[nextIndex]!;
  const nextId = nextStep?.id ?? null;
  useEffect(() => {
    const box = phoneBox.current;
    if (!box) return;
    box.querySelectorAll(".step-ring").forEach((el) => el.classList.remove("step-ring"));
    if (!nextId) return;
    box.querySelector(`[data-step-target="${CSS.escape(nextId)}"]`)?.classList.add("step-ring");
  });

  return (
    <DemoContext.Provider value={value}>
      <section id={id} aria-labelledby={`${id}-title`} className="mx-auto w-full max-w-[1320px] px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="index-line">
          <b>{index}</b> Try it
        </div>
        <div className="mt-6 grid gap-x-12 gap-y-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end">
          <h2 id={`${id}-title`} className="t-section">
            <Words text={title} render={hotWord} />
          </h2>
          <Reveal>
            <p className="t-lede">{intro}</p>
          </Reveal>
        </div>
        <div className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,0.9fr)] lg:gap-10">
          <div className="order-1 lg:sticky lg:top-24">
            <Steps steps={steps} world={world} marked={marked} finale={finale} />
          </div>
          <div className="order-2">
            {nextStep ? <NextBar step={nextStep} n={nextIndex + 1} total={steps.length} /> : null}
            <div ref={phoneBox} className="relative">
              {phone}
              <TapHint box={phoneBox} targetId={nextId} step={nextIndex + 1} />
            </div>
          </div>
          <div className="order-3 space-y-6 lg:sticky lg:top-24">
            {feed ? <Happened since={since ?? Number.MAX_SAFE_INTEGER} example={example} /> : null}
            {aside}
            <button type="button" onClick={startOver} className="tap rounded-full border border-line-strong px-4 text-[14px] font-semibold hover:border-accent">
              Start over
            </button>
          </div>
        </div>
      </section>
    </DemoContext.Provider>
  );
}
