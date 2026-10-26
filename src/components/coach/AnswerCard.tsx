"use client";

// The answer, typeset like a short letter rather than a chat bubble. A single
// warm line runs down the left edge — the Long Light "mile line" — with a stop
// for each part of the answer. Each fact has a numbered citation in the margin,
// joined to its line by a hairline: the evidence thread.

import Link from "next/link";
import { useMemo } from "react";
import { CARD } from "@/domain/quantum/knowledge";
import type { AnswerBlock, CoachAnswer } from "@/domain/quantum/types";
import { tickLabel } from "@/domain/calendar";
import { actors, store, useWorld } from "@/lib/store";
import { Badge, Button, cn } from "@/components/ui/kit";
import { INTENT_LABEL, SAFETY, STATUS } from "./labels";

type Kind = AnswerBlock["kind"];

const NODE: Record<Kind, string> = {
  heard: "border-2 border-[var(--accent)] bg-[var(--bg)]",
  know: "bg-[var(--accent)]",
  support: "bg-[var(--info)]",
  boundary: "rounded-[3px] bg-[var(--ink)]",
  step: "bg-[var(--ok)]",
};

const SECTION_LABEL: Record<Kind, string> = {
  heard: "What I heard",
  know: "What we know",
  support: "Talk to a person",
  boundary: "Where I stop",
  step: "One next step",
};

export function useCitations(answer: CoachAnswer | undefined) {
  return useMemo(() => {
    const order: string[] = [];
    for (const b of answer?.blocks ?? []) if (b.cardId && !order.includes(b.cardId)) order.push(b.cardId);
    return order;
  }, [answer]);
}

export function AnswerCard({ answer, onCite, at }: { answer: CoachAnswer; onCite: (cardId: string, index: number) => void; at: number }) {
  const citations = useCitations(answer);
  // Keep the composer's order (it is deliberate: a crisis answer leads with support,
  // a safe fallback leads with its limit) and group consecutive blocks of one kind.
  const groups = useMemo(() => {
    const out: { kind: Kind; blocks: AnswerBlock[] }[] = [];
    for (const b of answer.blocks) {
      const last = out[out.length - 1];
      if (last && last.kind === b.kind) last.blocks.push(b);
      else out.push({ kind: b.kind, blocks: [b] });
    }
    return out;
  }, [answer]);

  const [first, ...rest] = groups;
  const lead = first?.kind === "heard" ? first.blocks[0] : undefined;
  const safety = SAFETY[answer.safety];

  return (
    <article key={answer.id} className="rise-in card relative overflow-hidden" aria-labelledby={`q-${answer.id}`}>
      <header className="border-b border-line px-5 pb-4 pt-5 sm:px-7">
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow">You asked</span>
          <span className="text-[12px] text-muted">{tickLabel(at)}</span>
          <span className="ml-auto flex flex-wrap gap-1.5">
            <Badge>{INTENT_LABEL[answer.intent]}</Badge>
            {answer.confidence === "low" ? <Badge tone="warn">Safe default</Badge> : null}
            {answer.safety !== "ok" ? <Badge tone={safety.tone}>{safety.label}</Badge> : null}
            <Badge tone="neutral">Ruleset {answer.ruleset}</Badge>
          </span>
        </div>
        <p id={`q-${answer.id}`} className="mt-2 text-[16px] leading-snug text-muted">
          “{answer.question}”
        </p>
        {answer.rejectedDraft ? (
          <p className="mt-3 rounded-xl bg-warn-soft px-3 py-2 text-[13.5px] text-warn" data-testid="validator-caught">
            The drafting step produced something unsafe. The validator refused it and sent this safe answer instead — see “Why this answer?” below.
          </p>
        ) : null}
      </header>

      <div className="relative px-5 pb-6 pt-5 sm:px-7">
        {/* The mile line */}
        <span aria-hidden className="absolute bottom-8 left-[27px] top-8 w-[2px] rounded-full bg-[color-mix(in_srgb,var(--accent)_45%,transparent)] sm:left-[35px]" />

        {lead ? (
          <Stop kind="heard" label={SECTION_LABEL.heard}>
            <p className="display text-[24px] leading-[1.18] sm:text-[27px]">{lead.text}</p>
            {first!.blocks.slice(1).map((b, i) => (
              <p key={i} className="mt-2 text-[15.5px] leading-relaxed text-muted">
                {b.text}
              </p>
            ))}
          </Stop>
        ) : null}

        {(lead ? rest : groups).map((g) => (
          <Stop key={`${g.kind}-${g.blocks[0]!.text.slice(0, 12)}`} kind={g.kind} label={g.kind === "heard" ? "For you" : SECTION_LABEL[g.kind]}>
            <div className="space-y-3">
              {g.blocks.map((b, i) => (
                <Claim key={i} block={b} citations={citations} onCite={onCite} />
              ))}
            </div>
          </Stop>
        ))}

        <Stop kind="step" label={SECTION_LABEL.step} last>
          <NextStep answer={answer} />
        </Stop>
      </div>

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-surface-2/60 px-5 py-3 text-[12px] text-muted sm:px-7">
        <span className="font-mono uppercase tracking-[0.06em]">{answer.generator === "ai-model" ? `AI draft (${answer.model}) · every check passed` : "Approved tips · no AI in this answer"}</span>
        <span>{answer.cards.length} cited card{answer.cards.length === 1 ? "" : "s"}</span>
        <span>{answer.checks.filter((c) => c.pass).length}/{answer.checks.length} checks passed on what you received</span>
        {answer.attributions.length ? <span>Includes data from {answer.attributions.join(", ")}</span> : null}
      </footer>
    </article>
  );
}

function Stop({ kind, label, children, last }: { kind: Kind; label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <section className={cn("relative pl-9 sm:pl-12", !last && "pb-6")} aria-label={label}>
      <span aria-hidden className={cn("absolute left-[3px] top-[5px] h-3 w-3 rounded-full sm:left-[11px]", NODE[kind])} />
      <div className="eyebrow mb-2">{label}</div>
      {children}
    </section>
  );
}

function Claim({ block, citations, onCite }: { block: AnswerBlock; citations: string[]; onCite: (cardId: string, index: number) => void }) {
  const card = block.cardId ? CARD[block.cardId] : undefined;
  const index = block.cardId ? citations.indexOf(block.cardId) + 1 : 0;
  const tone = block.kind === "boundary" ? "boundary" : block.kind === "support" ? "support" : "plain";
  return (
    <div className="grid grid-cols-1 items-start gap-x-3 md:grid-cols-[minmax(0,1fr)_212px]">
      <p
        className={cn(
          "text-[16px] leading-relaxed",
          tone === "boundary" && "rounded-2xl border border-line-strong bg-surface-2 px-4 py-3",
          tone === "support" && "rounded-2xl bg-info px-4 py-3 text-[16.5px] font-semibold text-[var(--bg)]",
        )}
      >
        {block.text}
        {card ? (
          <button
            type="button"
            onClick={() => onCite(card.id, index)}
            className={cn("ml-1 align-super font-mono text-[11px] font-semibold underline underline-offset-2", tone === "support" ? "text-[var(--bg)]" : "text-accent-ink")}
            aria-label={`Citation ${index}: ${card.title}`}
          >
            [{index}]
          </button>
        ) : null}
      </p>
      {card ? (
        <button
          type="button"
          onClick={() => onCite(card.id, index)}
          className="group hidden items-center gap-2 pt-2.5 text-left md:flex"
          aria-label={`Open evidence ${index}: ${card.title}`}
          tabIndex={-1}
        >
          <span aria-hidden className="h-px flex-1 border-t border-dashed border-[var(--accent)]" />
          <span className="w-[176px] shrink-0 rounded-xl border border-line px-2.5 py-1.5 group-hover:border-ink">
            <span className="block font-mono text-[10.5px] text-accent-ink">[{index}] {STATUS[card.status].label.split(" — ")[0]}</span>
            <span className="block truncate text-[12.5px] font-semibold">{card.title}</span>
          </span>
        </button>
      ) : null}
    </div>
  );
}

function NextStep({ answer }: { answer: CoachAnswer }) {
  const w = useWorld();
  const member = w.members[answer.memberId];
  const step = answer.nextStep;
  if (!step || !member) {
    return (
      <p className="text-[15px] text-muted">
        {answer.safety === "urgent"
          ? "No fitness step today. Please reach a person first."
          : answer.rejectedDraft
            ? "No step this time. The safe answer doesn't propose one."
            : answer.intent === "general"
              ? "Nothing proposed when I'm not sure what you meant. The guided questions are the ones I've been checked on."
              : answer.intent === "heat"
                ? `Ruleset ${answer.ruleset} has no heat guidance to build a step on.`
                : answer.intent === "pain" || answer.intent === "medical" || answer.intent === "nutrition"
                  ? "No step from me on this one — it belongs with a professional."
                  : "Nothing to propose here."}
      </p>
    );
  }
  const who = actors.member(member.id);
  const a = step.action;
  let done = false;
  let doneLabel = "";
  if (a.type === "save" && member.savedStep?.text === step.label) [done, doneLabel] = [true, "Saved to your plan"];
  if (a.type === "rsvp" && w.events[a.eventId]?.rsvps.includes(member.id)) [done, doneLabel] = [true, "You're going"];
  if (a.type === "race-path" && member.racePath === a.racePath) [done, doneLabel] = [true, `Race path set to ${a.racePath}`];

  const run = () => {
    if (a.type === "save") store.dispatch({ type: "SAVE_NEXT_STEP", payload: { memberId: member.id, answerId: answer.id } }, who, { via: "coach-proposal" });
    if (a.type === "rsvp") store.dispatch({ type: "RSVP", payload: { memberId: member.id, eventId: a.eventId } }, who, { via: "coach-proposal" });
    if (a.type === "race-path") store.dispatch({ type: "SET_RACE_PATH", payload: { memberId: member.id, racePath: a.racePath } }, who, { via: "coach-proposal" });
  };

  return (
    <div>
      <p className="text-[13px] text-muted">A suggestion, not an action. Nothing happens unless {member.name} taps it.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {a.type === "open" ? (
          <Link href="/circles" className="tap inline-flex items-center rounded-full bg-accent px-5 text-[15px] font-semibold text-on-accent" data-testid="next-step">
            {step.label}
          </Link>
        ) : done ? (
          <>
            <Badge tone="ok">{doneLabel}</Badge>
            {a.type === "save" ? (
              <Button size="sm" variant="quiet" onClick={() => store.dispatch({ type: "CLEAR_NEXT_STEP", payload: { memberId: member.id } }, who)}>
                Clear
              </Button>
            ) : null}
          </>
        ) : (
          <Button variant="primary" onClick={run} data-testid="next-step">
            {step.label}
          </Button>
        )}
      </div>
    </div>
  );
}
