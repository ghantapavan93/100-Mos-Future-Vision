"use client";

// The coach as a member meets it: a short conversation on a phone. It opens
// with one calm thought — feeling good today matters more than going far —
// then: tap a question, get a short answer, see "Who says?" for every card it
// leans on, save one small step if you want it. Pain, chest symptoms or a
// crisis get Safe Stop instead of advice: stop, and here is a real person to
// reach. When the AI is on, it writes the kind part of everyday answers; every
// answer says plainly whether the AI wrote it.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CARD, cardsFor } from "@/domain/quantum/knowledge";
import type { CardStatus, CoachAnswer } from "@/domain/quantum/types";
import { AppHeader } from "@/components/demo/Phone";
import { useMarkStep } from "@/components/demo/TryIt";
import { cn } from "@/components/ui/kit";
import { aiProposal, useCoachAi, type AiStatus } from "@/lib/coachAi";
import { actors, store, useWorld } from "@/lib/store";
import { GUIDED } from "./labels";

/** Short chip labels for the guided questions, in the member's words. */
const CHIP: Record<string, string> = {
  start: "Never exercised",
  restart: "Missed days",
  "5k": "First 5K",
  marathon: "Marathon next month?",
  community: "Find people",
  rest: "Sore today",
  pain: "Knee pain",
  overwhelmed: "Stressed out",
  heat: "Too hot?",
};

/** Who stands behind a card, in plain words. Lessons are drafts for Kayla — never presented as hers. */
export const WHO: Record<CardStatus, string> = {
  "public-guideline": "Public health guidance",
  "proposed-lesson": "Written by the 100 Miles team for Kayla to review. Not her words until she says yes.",
  "proposed-rule": "A program rule, waiting for a certified coach to check it.",
  resource: "A help line. It always shows when it matters.",
};

/** Who wrote a public guideline, the way a member would say it — not a citation. */
const GUIDANCE_FROM: Record<string, string> = {
  "pag-some": "from U.S. health department guidelines",
  "pag-weekly": "from U.S. health department guidelines",
  "pag-gradual": "from U.S. health department guidelines",
  "screen-symptoms": "from sports medicine advice on when to stop",
  heat: "from public heat-safety advice",
};

/** What a brand-new chat offers, big, before anything is asked: the three questions new movers ask most. */
const FIRST_QUESTIONS = ["restart", "start", "rest"];

/** Safe Stop: the answers where the right next step is a person, not a plan. */
export function isSafeStop(a: CoachAnswer): boolean {
  return a.safety === "refer" || a.safety === "urgent" || a.intent === "pain" || a.intent === "medical" || a.intent === "crisis";
}

/**
 * `chipSteps` maps a guided question's id to the screen's "Try it" step it
 * completes, so that chip carries the step's guiding ring.
 */
export function CoachPhone({ viewer, chipSteps = {} }: { viewer: string; chipSteps?: Record<string, string> }) {
  const w = useWorld();
  const mark = useMarkStep();
  const member = w.members[viewer];
  const sessions = useMemo(() => w.coach.sessions.filter((s) => s.memberId === viewer), [w.coach.sessions, viewer]);
  const available = useMemo(() => new Set(cardsFor(w.coach.activeRuleset).map((c) => c.id)), [w.coach.activeRuleset]);
  const chips = GUIDED.filter((g) => g.needsCard === undefined || available.has(g.needsCard));
  const [sheet, setSheet] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const { status, thinking } = useCoachAi(member?.id);
  const [waiting, setWaiting] = useState<string | null>(null);

  // A new answer (or the question waiting on the AI) scrolls into view, like any chat.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [sessions.length, waiting]);

  // When the page's guiding ring lands on a chip scrolled out of sight, slide the chip row to it.
  const chipRow = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = chipRow.current;
    if (!row) return;
    const follow = () => {
      const chip = row.querySelector<HTMLElement>(".step-ring");
      if (!chip) return;
      const c = chip.getBoundingClientRect();
      const r = row.getBoundingClientRect();
      if (c.left < r.left || c.right > r.right) row.scrollTo({ left: row.scrollLeft + c.left - r.left - 16, behavior: "smooth" });
    };
    const watch = new MutationObserver(follow);
    watch.observe(row, { subtree: true, attributes: true, attributeFilter: ["class"] });
    return () => watch.disconnect();
  }, [member?.id]);

  // "Who says?" takes focus when it opens, closes on Esc, and hands focus back to whatever opened it.
  const sheetPanel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sheet) return;
    const opener = document.activeElement;
    sheetPanel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheet(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (opener instanceof HTMLElement) opener.focus({ preventScroll: true });
    };
  }, [sheet]);

  if (!member) return null;
  const ask = async (question: string) => {
    if (thinking) return;
    setSheet(null);
    setWaiting(question);
    const ai = await aiProposal(store.get().machine.world, member.id, question);
    setWaiting(null);
    store.dispatch({ type: "ASK_COACH", payload: { memberId: member.id, question, ...(ai ? { ai } : {}) } }, actors.member(member.id), { via: "coach" });
  };
  const sheetAnswer = sheet ? w.coach.answers[sheet] : undefined;

  return (
    <div className="relative flex h-full flex-col" data-testid="coach-app">
      <AppHeader
        kicker={`Asking as ${member.name}`}
        title="Quantum Coach"
        right={
          sessions.length ? (
            <button
              type="button"
              onClick={() => store.dispatch({ type: "FORGET_COACH_HISTORY", payload: { memberId: member.id } }, actors.member(member.id), { via: "coach" })}
              className="min-h-11 rounded-full px-3 text-[12.5px] font-semibold text-muted underline-offset-4 hover:underline"
              data-testid="forget-coach"
            >
              Forget what I asked
            </button>
          ) : null
        }
      />
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4" aria-live="polite">
        <Bubble from="coach">
          Hi {member.name}. Ask me anything about moving this summer. I&apos;ll keep it short and show you where every answer comes from.
        </Bubble>
        <AiPill status={status} />
        <CalmNote />
        {/* An empty chat is the hardest place to start, so the first questions sit right here, big — not in a row at the bottom. */}
        {sessions.length === 0 ? (
          <div className="mt-5">
            <div className="text-[12px] font-bold text-muted">Try one</div>
            <div role="group" aria-label="Try one" className="mt-2 space-y-2">
              {FIRST_QUESTIONS.map((id) => chips.find((g) => g.id === id))
                .filter((g): g is (typeof chips)[number] => Boolean(g))
                .map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => ask(g.question)}
                    data-suggest={g.id}
                    data-step-target={chipSteps[g.id]}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-line-strong bg-surface px-4 py-3 text-left hover:border-accent"
                  >
                    <span className="text-[15px] font-semibold leading-snug">“{g.question}”</span>
                    <span aria-hidden className="text-[18px] text-accent-ink">→</span>
                  </button>
                ))}
            </div>
          </div>
        ) : null}
        {sessions.map((s) => {
          const a = w.coach.answers[s.answerId];
          return (
            <div key={s.id} className="mt-4 space-y-3">
              <Bubble from="you">{s.question}</Bubble>
              {a ? <Answer answer={a} memberId={member.id} saved={member.savedStep?.text === a.nextStep?.label} onWhoSays={() => (setSheet(a.id), mark("who-says"))} /> : null}
            </div>
          );
        })}
        {waiting ? (
          <div className="mt-4 space-y-3" data-testid="coach-thinking">
            <Bubble from="you">{waiting}</Bubble>
            <div className="flex justify-start">
              <p className="flex items-center gap-2 rounded-[22px] rounded-bl-md bg-surface-2 px-4 py-2.5 text-[14px] text-muted">
                <span aria-hidden className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="size-1.5 animate-pulse rounded-full bg-accent" style={{ animationDelay: `${i * 160}ms` }} />
                  ))}
                </span>
                Writing, then checking every word…
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-line bg-[color-mix(in_srgb,var(--bg)_94%,transparent)] pb-3.5 pt-3">
        <div className="px-4 text-[12px] font-bold text-muted">{sessions.length ? "Ask another" : "More questions"}</div>
        {/* Contained, so the long chip row scrolls inside the phone instead of widening the page around it.
            Padded on every side so a chip's guiding ring isn't clipped by the scroll edge; the right edge
            fades so a cut-off chip reads as "more this way". */}
        <div
          ref={chipRow}
          className="overflow-x-auto px-4 py-2.5 [contain:inline-size] [mask-image:linear-gradient(to_right,black_calc(100%-40px),transparent)] [scrollbar-width:none]"
        >
          <div role="group" aria-label="Questions" className="flex w-max gap-2">
            {/* While the chat offers its first three questions big, the row holds only the others. */}
            {(sessions.length ? chips : chips.filter((g) => !FIRST_QUESTIONS.includes(g.id))).map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => ask(g.question)}
                data-guided={g.id}
                data-step-target={chipSteps[g.id]}
                className="min-h-11 whitespace-nowrap rounded-full border border-line-strong bg-surface px-4 text-[14px] font-semibold hover:border-accent"
              >
                {CHIP[g.id] ?? g.situation}
              </button>
            ))}
          </div>
        </div>
      </div>

      {sheetAnswer ? (
        <div role="dialog" aria-modal="true" aria-label="Who says?" className="absolute inset-0 z-10 flex flex-col justify-end bg-black/55">
          <button type="button" aria-label="Close" tabIndex={-1} className="flex-1" onClick={() => setSheet(null)} />
          <div ref={sheetPanel} tabIndex={-1} className="rise-in max-h-[75%] overflow-y-auto rounded-t-[28px] border-t border-line bg-surface px-5 pb-8 pt-4 outline-none">
            <div className="mx-auto h-1.5 w-12 rounded-full bg-line-strong" aria-hidden />
            <div className="mt-4 flex items-center justify-between gap-3">
              <h4 className="font-[family-name:var(--font-display)] text-[22px] font-black uppercase leading-none tracking-[-0.02em]">Who says?</h4>
              <button type="button" onClick={() => setSheet(null)} className="min-h-11 rounded-full px-3 text-[14px] font-semibold text-muted">
                Done
              </button>
            </div>
            <p className="mt-2 text-[13.5px] text-muted">Every answer is built only from these tips. Nothing else. Kayla says yes or no to each of hers once, before May 1.</p>
            <ul className="mt-4 space-y-3">
              {sheetAnswer.cards.map((id) => {
                const c = CARD[id];
                if (!c) return null;
                return (
                  <li key={id} className="rounded-2xl border border-line bg-bg p-4">
                    <div className="text-[15px] font-bold">{c.title}</div>
                    <p className="mt-1 text-[14px] leading-snug text-muted">{c.body}</p>
                    <p className={cn("mt-3 rounded-xl px-3 py-2 text-[13px] font-semibold leading-snug", c.status === "proposed-lesson" ? "bg-warn-soft text-warn" : c.status === "resource" ? "bg-info-soft text-info" : "bg-ok-soft text-ok")}>
                      {c.status === "public-guideline" ? `${WHO[c.status]}, ${GUIDANCE_FROM[c.id] ?? "from public health advice"}.` : WHO[c.status]}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Says, before anyone asks, whether the AI is writing today or the approved tips answer alone. */
function AiPill({ status }: { status: AiStatus }) {
  if (status === "checking") return null;
  return (
    <div className="mt-2 flex justify-start" data-testid="ai-status" data-ai={status}>
      <span className={cn("rounded-full px-3 py-1 text-[12px] font-bold", status === "on" ? "bg-accent/15 text-accent-ink" : "bg-surface-2 text-muted")}>
        {status === "on" ? "✦ AI on · every word checked before you see it" : "Approved tips only today · the AI is switched off"}
      </span>
    </div>
  );
}

/** Who wrote this answer, in one line: the AI inside approved tips, or the tips alone. */
function WrittenBy({ answer }: { answer: CoachAnswer }) {
  const ai = answer.generator === "ai-model";
  return (
    <p className={cn("text-[11.5px] font-bold uppercase tracking-[0.08em]", ai ? "text-accent-ink" : "text-muted")} data-testid="written-by" data-generator={answer.generator}>
      {ai ? "✦ Written by AI · checked against approved tips" : "From approved tips"}
    </p>
  );
}

/**
 * The coach's one standing thought, before any question: joy first. People who
 * enjoy moving are the ones who keep at it, and racing to keep up can leave
 * people moving less than before. Said by the coach, never in Kayla's voice.
 */
function CalmNote() {
  const [why, setWhy] = useState(false);
  return (
    <div className="mt-2 flex justify-start">
      <div data-testid="calm-note" className="max-w-[85%] rounded-[22px] rounded-bl-md bg-surface-2 px-4 py-2.5 text-[15px] leading-snug">
        <span className="font-semibold">One thing first: feeling good today matters more than going far.</span>{" "}
        {why ? (
          <span className="rise-in mt-1 block text-[13.5px] text-muted">People who enjoy a walk are the ones who come back. Racing to keep up can leave you moving less than before.</span>
        ) : (
          <button type="button" onClick={() => setWhy(true)} className="min-h-8 text-[13.5px] font-bold text-accent-ink underline-offset-4 hover:underline">
            Why?
          </button>
        )}
      </div>
    </div>
  );
}

function Bubble({ from, children }: { from: "you" | "coach"; children: ReactNode }) {
  return (
    <div className={cn("flex", from === "you" ? "justify-end" : "justify-start")}>
      <p
        className={cn(
          "max-w-[85%] rounded-[22px] px-4 py-2.5 text-[15px] leading-snug",
          from === "you" ? "rounded-br-md bg-accent font-semibold text-on-accent" : "rounded-bl-md bg-surface-2 text-ink",
        )}
      >
        {children}
      </p>
    </div>
  );
}

function Answer({ answer, memberId, saved, onWhoSays }: { answer: CoachAnswer; memberId: string; saved: boolean; onWhoSays: () => void }) {
  const stop = isSafeStop(answer);
  const step = answer.nextStep;
  const heard = answer.blocks.filter((b) => b.kind === "heard");
  const know = answer.blocks.filter((b) => b.kind === "know");
  const support = answer.blocks.filter((b) => b.kind === "support");
  const boundary = answer.blocks.filter((b) => b.kind === "boundary");

  const take = () => {
    if (!step) return;
    const run = (input: Parameters<typeof store.dispatch>[0]) => store.dispatch(input, actors.member(memberId), { via: "coach-proposal" });
    const a = step.action;
    if (a.type === "save" || a.type === "open") run({ type: "SAVE_NEXT_STEP", payload: { memberId, answerId: answer.id } });
    if (a.type === "rsvp") run({ type: "RSVP", payload: { memberId, eventId: a.eventId } });
    if (a.type === "race-path") run({ type: "SET_RACE_PATH", payload: { memberId, racePath: a.racePath } });
  };

  return (
    <article aria-label="Coach's answer" className={cn("rise-in max-w-[94%] overflow-hidden rounded-[22px] rounded-bl-md border bg-surface", stop ? "border-bad/60" : "border-line")}>
      {stop ? (
        <div className="bg-bad-soft px-4 py-3" data-testid="safe-stop">
          <div className="font-[family-name:var(--font-display)] text-[16px] font-black uppercase tracking-[0.02em] text-bad">Safe Stop</div>
          <p className="mt-0.5 text-[13.5px] font-semibold leading-snug text-bad">Please stop and get real help. I won&apos;t guess about this.</p>
        </div>
      ) : null}
      <div className="space-y-2.5 px-4 py-3.5">
        {stop ? null : <WrittenBy answer={answer} />}
        {heard.map((b, i) => (
          <p key={`h${i}`} className="text-[15px] leading-snug">
            {b.text}
          </p>
        ))}
        {support.map((b, i) => (
          <p key={`s${i}`} className="rounded-xl bg-info-soft px-3 py-2.5 text-[14px] font-semibold leading-snug text-info">
            {b.text}
          </p>
        ))}
        {know.map((b, i) => (
          <p key={`k${i}`} className="border-l-2 border-accent pl-3 text-[14.5px] leading-snug">
            {b.text}
          </p>
        ))}
        {boundary.map((b, i) => (
          <p key={`b${i}`} className="text-[13px] leading-snug text-muted">
            {b.text}
          </p>
        ))}
        {answer.rejectedDraft ? <p className="rounded-xl bg-warn-soft px-3 py-2 text-[12.5px] text-warn">A draft wasn&apos;t safe, so the coach sent this instead.</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
        {answer.cards.length ? (
          <button type="button" onClick={onWhoSays} className="min-h-11 rounded-full border border-line-strong px-4 text-[13.5px] font-bold hover:border-accent" data-testid="who-says" data-step-target="who">
            Who says?
          </button>
        ) : null}
        {step ? (
          saved ? (
            <span className="min-h-11 content-center rounded-full bg-ok-soft px-4 text-[13.5px] font-bold text-ok">Saved — it&apos;s on your Today screen</span>
          ) : (
            <button
              type="button"
              onClick={take}
              className="min-h-11 basis-full rounded-[22px] bg-accent px-4 py-2 text-[13.5px] font-bold leading-snug text-on-accent"
              data-testid="save-step"
              data-step-target={step.action.type === "save" || step.action.type === "open" ? "save" : undefined}
            >
              {step.label}
            </button>
          )
        ) : stop ? null : (
          <span className="text-[12.5px] text-muted">No step this time.</span>
        )}
      </div>
    </article>
  );
}
