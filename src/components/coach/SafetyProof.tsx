"use client";

// "Proving it's safe": the two locks every coach change passes through, read
// live from the evaluation sets. Lock one (no step backwards) decides whether
// a new set of tips may run the guided questions. Lock two is absolute: free
// text opens only when every safety-critical test passes, the old misses
// included — "no worse than before" never counts as "safe".

import Link from "next/link";
import { useMemo } from "react";
import { DEV_CASES, SEALED_COUNT, releaseGate, safetyGate } from "@/domain/quantum/evals";
import type { RulesetVersion } from "@/domain/types";
import { hotWord } from "@/components/demo/TryIt";
import { cn } from "@/components/ui/kit";
import { Reveal, Words } from "@/components/ui/Reveal";

function Lock({ n, title, line, open, status }: { n: number; title: string; line: string; open: boolean; status: string }) {
  return (
    <div className={cn("card flex flex-col p-6", open ? "border-ok/50" : "border-warn/50")} data-testid={`lock-${n}`} data-open={open}>
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow">Lock {n}</span>
        <span className={cn("rounded-full px-3 py-1 text-[12px] font-black uppercase tracking-[0.08em]", open ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn")}>{open ? "Open" : "Closed"}</span>
      </div>
      <h3 className="t-card mt-4">{title}</h3>
      <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{line}</p>
      <p className="mt-auto pt-4 text-[14px] font-bold leading-snug">{status}</p>
    </div>
  );
}

export function SafetyProof({ id = "proof", index = "04", ruleset }: { id?: string; index?: string; ruleset: RulesetVersion }) {
  const { safety, regression } = useMemo(() => {
    // v1 is the launch baseline: every later set of tips has to beat it.
    const baseline: RulesetVersion = "v1";
    return { safety: safetyGate(ruleset), regression: ruleset === baseline ? null : releaseGate(baseline, ruleset) };
  }, [ruleset]);
  const critical = safety.criticalTotal;
  const passedCritical = critical - safety.criticalMisses.length;

  return (
    <section id={id} aria-labelledby={`${id}-title`} className="mx-auto w-full max-w-[1320px] px-4 pb-20 sm:px-6 lg:px-8">
      <div className="index-line">
        <b>{index}</b> Proving it&apos;s safe
      </div>
      <div className="mt-6 grid gap-x-12 gap-y-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end">
        <h2 id={`${id}-title`} className="t-section">
          <Words text="Tested before it *talks.*" render={hotWord} />
        </h2>
        <Reveal>
          <p className="t-lede">
            {DEV_CASES.length + SEALED_COUNT} test questions, {SEALED_COUNT} of them written in advance and kept hidden from whoever writes the rules. Two locks decide what members get.
          </p>
        </Reveal>
      </div>

      <div className="mt-10 grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Reveal className="card flex flex-col justify-between p-6">
          <div>
            <div className="eyebrow">Typed-question safety tests</div>
            <div className="mt-3 font-[family-name:var(--font-display)] text-[clamp(44px,5vw,64px)] font-black leading-none tracking-[-0.04em]">
              <span className="num">{passedCritical}</span>
              <span className="text-muted">/{critical}</span>
            </div>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">passed — crisis, chest pain, “ignore your rules”, someone else&apos;s miles. The misses are why typing stays off.</p>
          </div>
          <p className="mt-5 text-[13.5px] leading-snug text-muted">
            The questions members tap today are each one of the checked answers.
          </p>
        </Reveal>
        <Reveal delay={80}>
          <Lock
            n={1}
            title="Never a step backwards"
            line="A new set of tips may run the guided questions only if every test that passed before still passes, and no tip says anything unsafe."
            open={regression ? regression.pass : true}
            status={regression ? (regression.pass ? `Open for ${ruleset}: no regressions.` : `Closed: ${regression.regressions.length} regressions.`) : `${ruleset} is the baseline the next version must beat.`}
          />
        </Reveal>
        <Reveal delay={160}>
          <Lock
            n={2}
            title="Every safety test, no exceptions"
            line="Typing your own question — the AI reading anything you write — opens only when every safety-critical test passes. Old misses count too."
            open={safety.pass}
            status={safety.pass ? "Open: every safety-critical test passes." : `Closed: ${safety.criticalMisses.length} still miss. Until then, members tap questions instead of typing.`}
          />
        </Reveal>
      </div>
      <p className="mt-5 text-[14px] text-muted">
        Anyone on the team can rerun every test:{" "}
        <Link href="/coach?lab=1#coach-lab" className="font-bold text-accent-ink underline underline-offset-4">
          open the test lab
        </Link>
        .
      </p>
    </section>
  );
}
