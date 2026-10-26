"use client";

// "How the AI thinks": the six moves behind every answer, drawn as one line a
// question travels along. Before anyone asks, it reads as a plain explainer;
// after a question, each stop lights up with what really happened to that
// answer — the topic, whether the AI was allowed, what it could read, which
// tips it leaned on, who wrote the words and how many checks passed.

import { CARD } from "@/domain/quantum/knowledge";
import type { CoachAnswer } from "@/domain/quantum/types";
import { hotWord } from "@/components/demo/TryIt";
import { cn } from "@/components/ui/kit";
import { Reveal, Words } from "@/components/ui/Reveal";
import { INTENT_LABEL } from "./labels";
import { isSafeStop } from "./CoachPhone";

interface Stop {
  title: string;
  line: string;
  /** What this answer did at this stop, in a few words. */
  live?: (a: CoachAnswer) => string;
  /** Whether this answer reached this stop (a Safe Stop never reaches the AI). */
  reached?: (a: CoachAnswer) => boolean;
}

const aiAsked = (a: CoachAnswer) => a.generator === "ai-model" || a.checks.some((c) => c.id === "ai-scope" || c.id.startsWith("ai-"));

const STOPS: Stop[] = [
  {
    title: "Listen",
    line: "Reads the question and sorts it: an everyday question, or a moment that needs a person.",
    live: (a) => INTENT_LABEL[a.intent],
  },
  {
    title: "Safety first",
    line: "Pain, crisis, food or a health condition go straight to Safe Stop. The AI is never asked.",
    live: (a) => (isSafeStop(a) ? "Safe Stop — a real person, no AI" : "Everyday — the AI may help"),
  },
  {
    title: "Remember you",
    line: "Reads only what you chose to share: your miles from the apps you said yes to. Never Strava.",
    live: (a) => (a.context.summary ? `${a.context.included.reduce((n, l) => n + l.miles, 0).toFixed(1)} shared miles` : "Nothing shared — and that's fine"),
    reached: (a) => !isSafeStop(a),
  },
  {
    title: "Kayla's tips",
    line: "Picks the tips that fit. Only tips someone stands behind can be used — hers after she says yes.",
    live: (a) => a.cards.map((id) => CARD[id]?.title ?? id).join(" · ") || "No tips needed",
  },
  {
    title: "AI writes",
    line: "Writes the kind, personal part in plain words. It never adds a fact, a plan or a diagnosis.",
    live: (a) => (a.generator === "ai-model" ? "Written by AI" : isSafeStop(a) ? "Not asked — rules only" : aiAsked(a) ? "Draft refused — tips answered alone" : "Approved tips answered this one"),
    reached: (a) => a.generator === "ai-model",
  },
  {
    title: "Every word checked",
    line: "Every answer runs the same checks before you see it. Fail one, and the approved tips answer alone.",
    live: (a) => `${a.checks.filter((c) => c.pass).length} of ${a.checks.length} checks passed${a.rejectedDraft ? " · one draft stopped" : ""}`,
  },
];

export function HowItThinks({ id = "how-it-thinks", index = "02", latest }: { id?: string; index?: string; latest?: CoachAnswer }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="mx-auto w-full max-w-[1320px] px-4 pb-20 sm:px-6 lg:px-8">
      <div className="index-line">
        <b>{index}</b> How the AI thinks
      </div>
      <div className="mt-6 grid gap-x-12 gap-y-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end">
        <h2 id={`${id}-title`} className="t-section">
          <Words text="Six moves. *Every answer.*" render={hotWord} />
        </h2>
        <Reveal>
          <p className="t-lede">
            {latest ? <>Lit up for the last question asked on the phone: “{latest.question}”</> : <>Ask a question on the phone above and watch it travel through each step.</>}
          </p>
        </Reveal>
      </div>

      <ol className="relative mt-10 grid gap-3 md:grid-cols-3 xl:grid-cols-6" data-testid="how-it-thinks">
        {/* The line the question travels along, behind the stops (wide screens). */}
        <span aria-hidden className="pointer-events-none absolute left-6 right-6 top-[30px] hidden h-px bg-gradient-to-r from-accent/70 via-accent/40 to-accent/10 xl:block" />
        {STOPS.map((s, i) => {
          const lit = Boolean(latest) && (s.reached ? s.reached(latest!) : true);
          return (
            <Reveal as="li" key={s.title} delay={60 * i} className={cn("card relative flex flex-col p-5 transition-colors duration-500", lit && "border-accent/60 bg-accent/[0.07]")}>
              <span
                aria-hidden
                className={cn(
                  "relative z-[1] flex size-9 items-center justify-center rounded-full border-2 font-[family-name:var(--font-display)] text-[15px] font-black",
                  lit ? "border-accent bg-accent text-on-accent shadow-[0_0_22px_-2px_var(--accent)]" : "border-line-strong bg-bg text-muted",
                )}
              >
                {i + 1}
              </span>
              <h3 className="t-card mt-4">{s.title}</h3>
              <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">{s.line}</p>
              {latest && s.live ? (
                <p className={cn("rise-in mt-auto pt-4 text-[13px] font-bold leading-snug", lit ? "text-accent-ink" : "text-muted")} data-stop={i + 1}>
                  {s.live(latest)}
                </p>
              ) : null}
            </Reveal>
          );
        })}
      </ol>
    </section>
  );
}
