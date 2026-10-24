"use client";

// "Why this answer?" — the whole pipeline for one answer, in the order it ran:
// how the question was read, what the coach was allowed to see, what it drew
// on, and the checks the answer had to pass before it reached the member.

import { CARD } from "@/domain/quantum/knowledge";
import { RULESET_NOTES } from "@/domain/quantum/knowledge";
import type { CoachAnswer } from "@/domain/quantum/types";
import { SOURCE_LABEL } from "@/domain/selectors";
import { Badge, RuleChip, cn } from "@/components/ui/kit";
import { CHECK_LABEL, INTENT_LABEL, SAFETY, STATUS } from "./labels";

export function WhyThis({ answer, open, onToggle }: { answer: CoachAnswer; open: boolean; onToggle: () => void }) {
  const failedBefore = answer.rejectedDraft?.failed ?? [];
  return (
    <section className="card overflow-hidden" aria-label="Why this answer">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`why-${answer.id}`}
        className="tap flex w-full items-center justify-between gap-3 px-5 py-3 text-left sm:px-7"
      >
        <span>
          <span className="block text-[15.5px] font-semibold">Why this answer?</span>
          <span className="block text-[12.5px] text-muted">How the question was read, what QUANTUM could see, and the checks it passed.</span>
        </span>
        <span aria-hidden className={cn("font-mono text-[18px] transition-transform duration-200", open && "rotate-45")}>
          +
        </span>
      </button>
      {open ? (
        <div id={`why-${answer.id}`} className="space-y-6 border-t border-line px-5 py-5 text-[14.5px] sm:px-7">
          <Step n={1} title="Reading the question">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{INTENT_LABEL[answer.intent]}</Badge>
              <Badge tone={SAFETY[answer.safety].tone}>{SAFETY[answer.safety].label}</Badge>
            </div>
            <p className="mt-2 text-muted">
              {answer.matched.length ? (
                <>
                  Decided by the phrase{answer.matched.length === 1 ? "" : "s"} {answer.matched.map((m, i) => (
                    <span key={i}>
                      {i > 0 ? ", " : ""}
                      <mark className="rounded bg-warn-soft px-1 text-ink">{m}</mark>
                    </span>
                  ))}
                  . Safety rules are checked first, so a crisis phrase always outranks everything else.
                </>
              ) : (
                "No rule matched, so QUANTUM said it wasn't sure rather than guessing."
              )}
            </p>
            {answer.confidence === "low" ? (
              <p className="mt-2 rounded-xl bg-warn-soft px-3 py-2 text-[13.5px] text-warn">
                {answer.classifiedAs === "general"
                  ? "The question also carried words that can signal a safety concern, so the safe default leads with that."
                  : `The phrases pointed to “${INTENT_LABEL[answer.classifiedAs].toLowerCase()}”, but the question also carried words that can signal a safety concern. An everyday answer could miss that, so QUANTUM sent its safe default instead.`}
              </p>
            ) : null}
          </Step>

          <Step n={2} title="What QUANTUM was allowed to see">
            {answer.context.included.length ? (
              <ul className="space-y-1">
                {answer.context.included.map((l) => (
                  <li key={l.source} className="flex flex-wrap items-center gap-2">
                    <Badge tone="ok">Read</Badge>
                    <span>{SOURCE_LABEL[l.source]}</span>
                    <span className="num text-muted">
                      {l.miles} mi · {l.records} outing{l.records === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">No activity at all — the member hasn't turned any source on for the coach.</p>
            )}
            {answer.context.excluded.length ? (
              <ul className="mt-2 space-y-1">
                {answer.context.excluded.map((l) => (
                  <li key={l.source} className="flex flex-wrap items-center gap-2">
                    <Badge tone="bad">Kept out</Badge>
                    <span>{SOURCE_LABEL[l.source]}</span>
                    <span className="num text-muted">
                      {l.miles} mi · {l.records} outing{l.records === 1 ? "" : "s"}
                    </span>
                    <RuleChip id={l.ruleId} />
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="mt-2 text-[12.5px] text-muted">Missed days are never read as a mood. The coach only talks about a gap if the member raises it (OURS-NO-MOOD-INFERENCE).</p>
          </Step>

          <Step n={3} title={`Cards it drew on · ruleset ${answer.ruleset}`}>
            <p className="text-[12.5px] text-muted">{RULESET_NOTES[answer.ruleset]}</p>
            <ul className="mt-2 space-y-1.5">
              {answer.cards.map((id) => {
                const card = CARD[id];
                if (!card) return null;
                return (
                  <li key={id} className="flex flex-wrap items-center gap-2">
                    <Badge tone={STATUS[card.status].tone}>{STATUS[card.status].label}</Badge>
                    <span className="font-semibold">{card.title}</span>
                  </li>
                );
              })}
            </ul>
          </Step>

          <Step n={4} title="Checks before it reached the member">
            {answer.rejectedDraft ? (
              <div className="mb-4 rounded-2xl border border-bad bg-bad-soft p-4" data-testid="rejected-draft">
                <div className="eyebrow !text-bad">Refused draft</div>
                <p className="mt-2 text-[14px] leading-relaxed text-ink line-through decoration-[var(--bad)] decoration-2">{answer.rejectedDraft.text}</p>
                <p className="mt-3 text-[13.5px] text-ink">
                  The drafting step produced this. The validator refused it. You received the safe answer instead.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {answer.rejectedDraft.failed.map((f) => (
                    <Badge key={f} tone="bad">
                      {CHECK_LABEL[f] ?? f}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {answer.checks.map((c) => (
                <li key={c.id} className="flex items-start gap-2 rounded-xl border border-line px-3 py-2">
                  <Badge tone={c.pass ? "ok" : "bad"}>{c.pass ? "Pass" : "Fail"}</Badge>
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-semibold">
                      {CHECK_LABEL[c.id] ?? c.id}
                      {failedBefore.includes(c.id) ? <span className="ml-1 font-normal text-bad">· failed on the draft</span> : null}
                    </span>
                    <span className="block text-[12.5px] text-muted">{c.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[12.5px] text-muted">
              Checks can only make an answer safer: a failed check swaps the draft for a safe fallback; nothing a check finds can unlock more. If a live model were connected, it would only draft wording — these checks and the data rules would stay exactly as they are.
            </p>
          </Step>
        </div>
      ) : null}
    </section>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[28px_minmax(0,1fr)] gap-3">
      <span className="num h-7 w-7 rounded-full bg-surface-2 text-center text-[12.5px] leading-7">{n}</span>
      <div>
        <h3 className="text-[15.5px] font-semibold">{title}</h3>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}
