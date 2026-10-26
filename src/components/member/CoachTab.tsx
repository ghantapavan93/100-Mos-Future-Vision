"use client";

import Link from "next/link";
import { CARD } from "@/domain/quantum/knowledge";
import type { CoachAnswer } from "@/domain/quantum/types";
import type { MemberView } from "@/domain/selectors";
import type { World } from "@/domain/types";
import { Inspectable } from "@/components/inspect/Inspect";
import { cn } from "@/components/ui/kit";
import { aiProposal, useCoachAi } from "@/lib/coachAi";
import { store } from "@/lib/store";
import { InlineReceipt, useMemberAction } from "./shared";

/** The missed-week question completes the member screen's "Ask the coach" step, so it carries that step's guiding ring. */
const MISSED_WEEK = "I missed almost two weeks and feel like I ruined it.";

const QUESTIONS = [
  "I've never really exercised. Is this even for me?",
  MISSED_WEEK,
  "How do I get ready for my first 5K?",
  "Could I run a marathon next year?",
  "Are there people near me I could walk with?",
  "I'm sore today. Should I rest?",
];

const STATUS_LABEL = {
  "public-guideline": "Public health guideline",
  "proposed-rule": "Program rule, for a coach to check",
  "proposed-lesson": "Drafted for Kayla's review",
  resource: "Help line",
} as const;

export function CoachTab({ view, world, onTab }: { view: MemberView; world: World; onTab: (t: "today" | "circles") => void }) {
  const m = view.member;
  const act = useMemberAction(m.id);
  const session = [...world.coach.sessions].reverse().find((s) => s.memberId === m.id);
  const answer = session ? world.coach.answers[session.answerId] : undefined;
  const { status, thinking } = useCoachAi(m.id);
  // The AI (when it's on) proposes first; the engine still decides what is sent.
  const ask = async (question: string) => {
    if (thinking) return;
    const ai = await aiProposal(store.get().machine.world, m.id, question);
    act.run({ type: "ASK_COACH", payload: { memberId: m.id, question, ...(ai ? { ai } : {}) } });
  };

  return (
    <div className="space-y-4 px-4 pb-6 pt-2">
      <section aria-label="Ask the coach" className="rounded-[26px] bg-surface p-5 shadow-[var(--shadow)]">
        <h2 className="font-[family-name:var(--font-display)] text-[24px] font-black uppercase leading-none tracking-[-0.02em]">Quantum Coach</h2>
        <p className="mt-2 text-[13.5px] leading-snug text-muted">Pick a question. You get a short answer, where it comes from, and one small step you can choose to take.</p>
        {status === "checking" ? null : (
          <p className={cn("mt-2 w-fit rounded-full px-3 py-1 text-[12px] font-bold", status === "on" ? "bg-accent/15 text-accent-ink" : "bg-surface-2 text-muted")}>
            {status === "on" ? "✦ AI on · every word checked" : "Approved tips only today"}
          </p>
        )}
        <div className="mt-4 flex flex-col gap-2">
          {QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => void ask(q)}
              aria-busy={thinking || undefined}
              className={cn("min-h-11 rounded-2xl border px-4 py-2.5 text-left text-[14px] leading-snug", answer?.question === q ? "border-ink bg-surface-2 font-semibold" : "border-line-strong hover:border-ink")}
              data-step-target={q === MISSED_WEEK ? "coach" : undefined}
            >
              {q}
            </button>
          ))}
        </div>
      </section>

      {thinking ? (
        <p className="rise-in rounded-[22px] bg-surface-2 px-4 py-3 text-[14px] text-muted" data-testid="coach-thinking">
          Writing, then checking every word…
        </p>
      ) : answer ? (
        <AnswerCard answer={answer} memberId={m.id} onTab={onTab} />
      ) : null}
      <InlineReceipt receipt={act.last} />

      <p className="px-1 text-[13px] leading-snug text-muted">
        It never diagnoses, never writes training plans, and never speaks for Kayla.{" "}
        <Link href="/coach" className="font-semibold text-accent-ink underline underline-offset-4">
          See the full coach
        </Link>
      </p>
    </div>
  );
}

function AnswerCard({ answer, memberId, onTab }: { answer: CoachAnswer; memberId: string; onTab: (t: "today" | "circles") => void }) {
  const act = useMemberAction(memberId);
  const step = answer.nextStep;
  const take = () => {
    if (!step) return;
    const a = step.action;
    if (a.type === "save") act.run({ type: "SAVE_NEXT_STEP", payload: { memberId, answerId: answer.id } });
    if (a.type === "rsvp") {
      const r = act.run({ type: "RSVP", payload: { memberId, eventId: a.eventId } }, { via: "coach-proposal" });
      if (r.outcome === "applied") onTab("circles");
    }
    if (a.type === "race-path") {
      act.run({ type: "SET_RACE_PATH", payload: { memberId, racePath: a.racePath } }, { via: "coach-proposal" });
      onTab("today");
    }
    if (a.type === "open") onTab("circles");
  };

  return (
    <Inspectable id="coach">
      <article aria-label="Coach's answer" className="rise-in rounded-[26px] border border-line bg-surface p-5" key={answer.id}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="eyebrow">You asked</div>
          <span className={cn("text-[11px] font-bold uppercase tracking-[0.08em]", answer.generator === "ai-model" ? "text-accent-ink" : "text-muted")} data-testid="written-by" data-generator={answer.generator}>
            {answer.generator === "ai-model" ? "✦ Written by AI · checked" : "From approved tips"}
          </span>
        </div>
        <p className="mt-1 text-[15px] font-semibold leading-snug">{answer.question}</p>
        {answer.rejectedDraft ? (
          <p className="mt-3 rounded-xl bg-warn-soft px-3 py-2 text-[13px] leading-snug text-warn">The coach caught a draft that wasn&apos;t safe and sent this answer instead.</p>
        ) : null}
        <div className="mt-4 space-y-3">
          {answer.blocks.map((b, i) => {
            const card = b.cardId ? CARD[b.cardId] : undefined;
            if (b.kind === "heard") return <p key={i} className="text-[15px] leading-relaxed">{b.text}</p>;
            if (b.kind === "boundary")
              return (
                <p key={i} className="rounded-xl border border-line-strong px-3 py-2.5 text-[14px] leading-snug">
                  {b.text}
                </p>
              );
            if (b.kind === "support")
              return (
                <p key={i} className="rounded-xl bg-ok-soft px-3 py-2.5 text-[14px] font-semibold leading-snug text-ok">
                  {b.text}
                </p>
              );
            return (
              <div key={i} className="border-l-2 border-accent pl-3">
                <p className="text-[15px] leading-relaxed">{b.text}</p>
                {card ? (
                  <p className="mt-1 text-[11.5px] text-muted">
                    <span className="font-semibold">{card.title}</span> · {STATUS_LABEL[card.status]}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
        {step ? (
          <button type="button" onClick={take} className="mt-5 min-h-12 w-full rounded-full bg-accent px-4 text-[14.5px] font-semibold leading-snug text-on-accent">
            {step.label}
          </button>
        ) : null}
        <p className="mt-3 text-[11.5px] leading-snug text-muted">
          {step ? "Nothing happens until you tap it." : "No step for this one — the right next step is a person."}
        </p>
        <InlineReceipt receipt={act.last} className="mt-3" />
      </article>
    </Inspectable>
  );
}
