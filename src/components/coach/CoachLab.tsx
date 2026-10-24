"use client";

// The Coach Lab. The same evaluation the tests run, live in the browser, in
// two sets that mean different things: DEV (seen while writing the rules) and
// SEALED (written from the specification alone, never shown, never tuned on).
// Then governance: a new ruleset needs two people, no regressions on either
// set, and cards whose own words pass the content checks.

import { useMemo, useState } from "react";
import { RULESET_NOTES } from "@/domain/quantum/knowledge";
import { SEALED_COUNT, SEALED_OVERLAPS, SEALED_SHA256, applies, releaseGate, sealedCategory, type EvalResult, type EvalRun } from "@/domain/quantum/evals";
import { runFull } from "@/domain/quantum/sealed";
import type { RulesetVersion } from "@/domain/types";
import { actors, store, useLedger, useWorld } from "@/lib/store";
import { Badge, Button, OutcomeBadge, Stat, Toggle, cn } from "@/components/ui/kit";
import { INTENT_LABEL, SAFETY } from "./labels";

const VERSIONS: RulesetVersion[] = ["v1", "v2", "v3"];

export function CoachLab() {
  const w = useWorld();
  const active = w.coach.activeRuleset;
  const [underFault, setUnderFault] = useState(false);
  const clean = useMemo(() => runFull(active), [active]);
  const run = useMemo(() => (underFault ? runFull(active, true) : clean), [active, underFault, clean]);
  const caught = run.results.filter((r) => r.answer.rejectedDraft).length;
  const unsafeSent = run.results.filter((r) => r.answer.checks.some((c) => !c.pass)).length;
  const checkCount = run.results[0]?.answer.checks.length ?? 0;
  const sealedCritical = clean.sealed.criticalTotal;
  const misses = clean.sealed.criticalMisses;
  const fellBack = clean.sealed.missesThatFellBackSafely.length;

  return (
    <div className="space-y-10">
      <section aria-labelledby="lab-evidence" className="space-y-4">
        <div>
          <h2 id="lab-evidence" className="t-section">
            How ready is QUANTUM?
          </h2>
          <p className="mt-1 max-w-[760px] text-[14px] text-muted">Two sets, kept apart on purpose. Only the sealed set says anything about questions the rules have never seen.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card p-4" data-testid="lab-dev">
            <Stat label={`DEV · seen · ${active}`} value={`${run.dev.passed}/${run.dev.total}`} note="Seen while writing the rules. Shows they do what they were built to do, not that they generalise." tone={run.dev.passed === run.dev.total ? "ok" : "warn"} />
          </div>
          <div className="card p-4" data-testid="lab-sealed">
            <Stat label={`SEALED · never seen · ${active}`} value={`${run.sealed.passed}/${run.sealed.total}`} note="Written from the specification alone, before any rule. Never shown, never used to tune." tone={run.sealed.passed === run.sealed.total ? "ok" : "warn"} />
          </div>
          <div className="card p-4" data-testid="lab-sealed-critical">
            <Stat
              label="Sealed critical misses"
              value={`${misses.length} of ${sealedCritical}`}
              note={misses.length ? `${fellBack} of these still showed 988 or care and proposed no step. A miss is still a miss.` : "None. The launch gate for free text can open."}
              tone={misses.length ? "bad" : "ok"}
            />
          </div>
          <div className="card p-4">
            <Stat label="Unsafe answers sent" value={unsafeSent} note={underFault ? `${caught} unsafe drafts caught by the validator.` : `Every sent answer passed all ${checkCount} checks.`} tone={unsafeSent ? "bad" : "ok"} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line px-4 py-3">
          <Toggle checked={underFault} onChange={setUnderFault} label="Evaluate under the drafting fault" />
          <span className="min-w-0 flex-1 text-[14px]">
            <span className="font-semibold">Evaluate under the drafting fault.</span>{" "}
            <span className="text-muted">Every draft gets an unsafe line added. Pass rates drop because answers fall back to safe minimums — but the number of unsafe answers sent should stay at zero.</span>
          </span>
        </div>

        <Methodology run={clean} />
      </section>

      <SealedCasebook run={clean} ruleset={active} />

      <EvalTable results={run.results} ruleset={active} />

      <Governance />
    </div>
  );
}

function Methodology({ run }: { run: EvalRun }) {
  return (
    <div className="card grid gap-5 p-4 text-[14px] leading-relaxed sm:p-5 md:grid-cols-3" data-testid="lab-method">
      <div>
        <div className="eyebrow">DEV · {run.dev.total} cases</div>
        <p className="mt-1">
          The original 16 dev cases, the 12 cases once called “held-out” (relabelled: the rules had been tuned against them, so they no longer test anything unseen), and the critics' paraphrases and false-positive traps. Patterns were only ever changed while looking at DEV.
        </p>
      </div>
      <div>
        <div className="eyebrow">SEALED · {SEALED_COUNT} cases</div>
        <p className="mt-1">
          Written from the written specification alone, by an author who opened no rule file. 32 urgent, 12 refer, 19 false-positive traps, 12 adversarial, 15 ordinary. Question texts appear nowhere in this lab; failures show by id and category only.
        </p>
        {SEALED_OVERLAPS.length ? (
          <p className="mt-2 text-muted">
            {SEALED_OVERLAPS.join(", ")} turned out to use the same words as a critic's example added to DEV before the sealed run, so {SEALED_OVERLAPS.length === 1 ? "it isn't" : "they aren't"} unseen: shown, not scored ({run.sealed.total} scored).
          </p>
        ) : null}
      </div>
      <div>
        <div className="eyebrow">How it was run</div>
        <p className="mt-1">
          Run once, after the classifier work. No pattern changed after seeing the result. The file is pinned by SHA-256 and vitest recomputes the digest from its bytes on every run.
        </p>
        <p className="mt-2 break-all font-mono text-[11.5px] text-muted" data-testid="sealed-sha">
          sha256 {SEALED_SHA256}
        </p>
      </div>
    </div>
  );
}

const CATEGORY_LABEL: Record<string, string> = {
  urgent: "urgent (crisis or emergency symptoms)",
  refer: "refer to a professional",
  privacy: "someone else's data",
  injection: "trying to change the rules",
  kayla: "speaking for Kayla",
};

function SealedCasebook({ run, ruleset }: { run: EvalRun; ruleset: RulesetVersion }) {
  const missed = run.results.filter((r) => r.case.set === "sealed" && r.case.critical && !r.case.overlapsDev && !r.pass);
  const byCategory = Object.entries(
    missed.reduce<Record<string, number>>((acc, r) => {
      const k = sealedCategory(r.case);
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const fellBack = new Set(run.sealed.missesThatFellBackSafely);
  const unsafe = missed.filter((r) => !fellBack.has(r.case.id));

  if (!missed.length) {
    return (
      <section className="rounded-[20px] border-2 border-ok bg-ok-soft p-5 sm:p-6" aria-labelledby="casebook" data-testid="casebook">
        <h2 id="casebook" className="t-card">
          Every critical sealed case passes under {ruleset}.
        </h2>
      </section>
    );
  }

  return (
    <section className="rounded-[20px] border-2 border-bad bg-bad-soft p-5 sm:p-6" aria-labelledby="casebook" data-testid="casebook">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="bad">Failure casebook · sealed set</Badge>
        <Badge tone="bad">
          {missed.length} critical miss{missed.length === 1 ? "" : "es"} · {ruleset}
        </Badge>
      </div>
      <h2 id="casebook" className="t-card mt-3">
        DEV {run.dev.passed}/{run.dev.total}. Sealed {run.sealed.passed}/{run.sealed.total}. That gap is the finding.
      </h2>
      <div className="mt-4 grid gap-4 text-[14.5px] leading-relaxed md:grid-cols-3">
        <div>
          <div className="eyebrow !text-bad">What happens</div>
          <ul className="mt-1 space-y-0.5">
            {byCategory.map(([k, n]) => (
              <li key={k}>
                <span className="num font-semibold">{n}</span> {CATEGORY_LABEL[k] ?? k}
              </li>
            ))}
          </ul>
          <p className="mt-2">
            {fellBack.size} of {missed.length} fell back to the safe default: 988 or care shown, no step proposed.{" "}
            {unsafe.length ? `${unsafe.length} did not (${unsafe.map((r) => r.case.id).join(", ")}).` : ""}
          </p>
        </div>
        <div>
          <div className="eyebrow !text-bad">Why it can't be patched here</div>
          <p className="mt-1">
            Rules written against DEV pass {run.dev.passed} of {run.dev.total} there, and {run.sealed.passed} of {run.sealed.total} on questions they had never seen. Adding patterns for these failures would turn the sealed set into another DEV set and prove nothing. Keyword matching is the wrong tool for the long tail of how people say they're in danger.
          </p>
        </div>
        <div>
          <div className="eyebrow !text-bad">What it decides</div>
          <p className="mt-1">Free-text coaching stays off for 2027: guided questions only. Opening it needs a reviewed classifier, a human escalation path, clinical sign-off — and a fresh sealed set, since this one's failure categories have now been seen.</p>
        </div>
      </div>
    </section>
  );
}

function EvalTable({ results, ruleset }: { results: EvalResult[]; ruleset: RulesetVersion }) {
  const [filter, setFilter] = useState<"all" | "fail">("all");
  const counted = results.filter((r) => applies(r.case, ruleset));
  const shown = counted.filter((r) => filter === "all" || !r.pass);
  // Sealed cases that pass carry no words worth showing, so they collapse to their ids.
  const sealedPasses = shown.filter((r) => r.case.set === "sealed" && r.pass);
  const groups: [string, string, EvalResult[]][] = [
    ["dev", "DEV · seen while writing the rules", shown.filter((r) => r.case.set === "dev")],
    ["sealed", "SEALED · question texts withheld", shown.filter((r) => r.case.set === "sealed" && !r.pass)],
  ];
  return (
    <section aria-labelledby="eval-table">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="eval-table" className="t-section">
            Every case QUANTUM is held to
          </h2>
          <p className="mt-1 text-[13px] text-muted">Computed now, in your browser, by src/domain/quantum/evals.ts — the same function vitest runs.</p>
        </div>
        <div role="radiogroup" aria-label="Show" className="flex rounded-full bg-surface-2 p-1">
          {(["all", "fail"] as const).map((f) => (
            <button key={f} type="button" role="radio" aria-checked={filter === f} onClick={() => setFilter(f)} className={cn("rounded-full px-3 py-1.5 text-[13px] font-semibold", filter === f ? "bg-surface shadow" : "text-muted")}>
              {f === "all" ? `All ${counted.length}` : "Failures only"}
            </button>
          ))}
        </div>
      </div>
      {groups.map(([key, label, rows]) =>
        rows.length ? (
          <div key={key} className="mt-4">
            <div className="eyebrow">{label}</div>
            <ul className="mt-2 divide-y divide-[var(--line)] overflow-hidden rounded-2xl border border-line bg-surface" data-testid={`eval-${key}`}>
              {rows.map((r) => (
                <li key={r.case.id} className="grid gap-2 px-4 py-3 md:grid-cols-[64px_minmax(0,1.6fr)_minmax(0,1fr)_90px] md:items-start">
                  <span className="flex items-center gap-1.5 md:block">
                    <span className="num text-[13px] font-semibold">{r.case.id}</span>
                    {r.case.critical ? <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-bad md:block">critical</span> : null}
                    <span className="ml-auto md:hidden">
                      <Badge tone={r.pass ? "ok" : "bad"}>{r.pass ? "Pass" : "Fail"}</Badge>
                    </span>
                  </span>
                  <span className="min-w-0">
                    {r.case.set === "sealed" ? (
                      <>
                        <span className="block text-[14px] text-muted">
                          Sealed · {sealedCategory(r.case)}
                          {r.case.overlapsDev ? " · same words as a DEV case, not scored" : ""}
                        </span>
                        <span className="mt-0.5 block text-[12px] text-muted">as {r.case.member}</span>
                      </>
                    ) : (
                      <>
                        <span className="block text-[14px]">“{r.case.question}”</span>
                        <span className="mt-0.5 block text-[12px] text-muted">
                          as {r.case.member} · {r.case.origin}
                        </span>
                      </>
                    )}
                  </span>
                  <span className="min-w-0 text-[12.5px] text-muted">
                    <span className="block">
                      Read as <span className="text-ink">{INTENT_LABEL[r.answer.intent]}</span> ·{" "}
                      {r.answer.intent === "general" && r.answer.safety === "ok" ? "safe default, no step" : SAFETY[r.answer.safety].label.toLowerCase()}
                    </span>
                    {!r.pass ? <span className="mt-0.5 block text-bad">{r.reasons.join("; ")}</span> : null}
                  </span>
                  <span className="hidden md:block md:text-right">
                    <Badge tone={r.pass ? "ok" : "bad"}>{r.pass ? "Pass" : "Fail"}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null,
      )}
      {sealedPasses.length ? (
        <div className="mt-4" data-testid="eval-sealed-passes">
          <div className="eyebrow">SEALED · {sealedPasses.length} passing</div>
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Sealed cases that pass">
            {sealedPasses.map((r) => (
              <li key={r.case.id} className={cn("num rounded-full border px-2.5 py-1 text-[12px]", r.case.overlapsDev ? "border-dashed border-line-strong text-muted" : "border-line")} title={r.case.overlapsDev ? "Same words as a DEV case, not scored" : sealedCategory(r.case)}>
                {r.case.id}
                {r.case.critical ? <span className="ml-1 text-bad">·c</span> : null}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] text-muted">·c marks a critical case. A dashed id shares its words with a DEV case and isn't scored.</p>
        </div>
      ) : null}
    </section>
  );
}

function Governance() {
  const w = useWorld();
  const ledger = useLedger();
  const active = w.coach.activeRuleset;
  const candidate = w.coach.candidate;
  const gates = useMemo(() => Object.fromEntries(VERSIONS.filter((v) => v !== active).map((v) => [v, releaseGate(active, v)])), [active]);
  const last = [...ledger].reverse().find((r) => r.type === "APPROVE_RULESET" || r.type === "PROPOSE_RULESET" || r.type === "SET_DRIFT");

  return (
    <section aria-labelledby="governance" className="space-y-4">
      <div>
        <h2 id="governance" className="t-section">
          Changing what QUANTUM may say
        </h2>
        <p className="mt-1 max-w-[760px] text-[13px] text-muted">
          A new ruleset needs content approval (Kayla), engineering approval (Kirk), zero regressions on DEV and on the sealed set, and every card it cites passing the same content checks as an answer. Predict the gate below, then try it.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {VERSIONS.map((v) => {
          const gate = gates[v];
          const isActive = v === active;
          const isCandidate = candidate?.version === v;
          return (
            <div key={v} className={cn("card flex flex-col p-4", isActive && "outline outline-2 outline-[var(--ok)]", isCandidate && "outline outline-2 outline-[var(--accent)]")}>
              <div className="flex items-center gap-2">
                <span className="display text-[24px]">{v}</span>
                {isActive ? <Badge tone="ok">Active</Badge> : null}
                {isCandidate ? <Badge tone="accent">Waiting for approval</Badge> : null}
              </div>
              <p className="mt-2 flex-1 text-[13.5px] leading-snug text-muted">{RULESET_NOTES[v]}</p>
              {gate ? (
                <div className={cn("mt-3 rounded-xl px-3 py-2 text-[12.5px]", gate.pass ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad")} data-testid={`gate-${v}`}>
                  <span className="font-semibold">Gate prediction vs {active}: {gate.pass ? "would pass" : "would refuse"}.</span> {gate.reason}
                </div>
              ) : null}
              {!isActive ? (
                <Button
                  size="sm"
                  className="mt-3 self-start"
                  disabled={isCandidate}
                  onClick={() => store.dispatch({ type: "PROPOSE_RULESET", payload: { version: v } }, actors.engineer, { via: "coach-lab" })}
                  data-testid={`propose-${v}`}
                >
                  Propose {v}
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="card grid gap-4 p-4 sm:p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div>
          <div className="eyebrow">Approvals {candidate ? `for ${candidate.version}` : ""}</div>
          {candidate ? (
            <p className="mt-1 text-[14px]">
              {(["content", "engineering"] as const).map((k) => (
                <span key={k} className="mr-3 inline-flex items-center gap-1.5">
                  <Badge tone={candidate.approvals.includes(k) ? "ok" : "neutral"}>{candidate.approvals.includes(k) ? "Approved" : "Pending"}</Badge>
                  {k === "content" ? "Content · Kayla" : "Engineering · Kirk"}
                </span>
              ))}
            </p>
          ) : (
            <p className="mt-1 text-[14px] text-muted">Nothing waiting. Propose a ruleset above.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={!candidate} onClick={() => store.dispatch({ type: "APPROVE_RULESET", payload: { as: "content" } }, actors.founder, { via: "coach-lab" })} data-testid="approve-content">
            Approve as Kayla (content)
          </Button>
          <Button size="sm" disabled={!candidate} onClick={() => store.dispatch({ type: "APPROVE_RULESET", payload: { as: "engineering" } }, actors.engineer, { via: "coach-lab" })} data-testid="approve-engineering">
            Approve as Kirk (engineering)
          </Button>
        </div>
      </div>

      <div className="card flex flex-wrap items-center gap-3 p-4 sm:p-5">
        <Toggle
          checked={w.coach.drift}
          label="Drafting fault"
          onChange={(on) => store.dispatch({ type: "SET_DRIFT", payload: { on } }, actors.engineer, { via: "coach-lab" })}
        />
        <div className="min-w-0 flex-1 text-[14px]">
          <span className="font-semibold">Drafting fault (simulates a model drifting).</span>{" "}
          <span className="text-muted">{w.coach.drift ? "On. Ask QUANTUM again — the validator will refuse the unsafe draft and you'll see it struck through." : "Off. Turn it on, then ask a question to watch the validator work."}</span>
        </div>
      </div>

      {last ? (
        <div className="flex flex-wrap items-center gap-2 text-[13.5px]" aria-live="polite" data-testid="governance-last">
          <span className="eyebrow">Last governance receipt</span>
          <OutcomeBadge outcome={last.outcome} />
          <span>{last.summary}</span>
        </div>
      ) : null}
    </section>
  );
}
