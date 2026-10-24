"use client";

// Asking: guided questions first (the launch shape the evaluation supports),
// free text second and labelled lab-only while the sealed safety set fails,
// and the member's own switch for what the coach may read — Strava locked off
// by its terms.

import { useMemo, useState } from "react";
import { decide } from "@/domain/policy";
import { cardsFor } from "@/domain/quantum/knowledge";
import { SOURCE_LABEL } from "@/domain/selectors";
import { COUNTABLE_SOURCES, type CountableSource } from "@/domain/types";
import { actors, store, useWorld } from "@/lib/store";
import { Badge, Button, RuleChip, Toggle, cn } from "@/components/ui/kit";
import { GUIDED } from "./labels";

export function AskPanel({ viewer, onAsked, lastQuestion }: { viewer: string; onAsked: () => void; lastQuestion: string | null }) {
  const w = useWorld();
  const member = w.members[viewer];
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (!member) return null;

  const ask = (question: string) => {
    const receipt = store.dispatch({ type: "ASK_COACH", payload: { memberId: member.id, question } }, actors.member(member.id), { via: "coach" });
    if (receipt.outcome === "applied") {
      setError(null);
      onAsked();
    } else setError(receipt.summary);
  };

  const people = Object.values(w.members).filter((m) => !m.background);
  const active = w.coach.activeRuleset;
  const available = useMemo(() => new Set(cardsFor(active).map((c) => c.id)), [active]);

  return (
    <div className="space-y-5">
      <div className="card p-4 sm:p-5">
        <div className="eyebrow">Asking as</div>
        <div role="radiogroup" aria-label="Asking as" className="mt-2 flex flex-wrap gap-1.5">
          {people.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={m.id === viewer}
              onClick={() => store.setUI({ viewer: m.id })}
              className={cn("tap rounded-full border px-3.5 text-[14px] font-semibold", m.id === viewer ? "border-transparent bg-ink text-bg" : "border-line-strong hover:border-ink")}
            >
              {m.name}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[13px] text-muted">
          {member.persona}. <span className="italic">“{member.why}”</span>
        </p>
      </div>

      <div className="card p-4 sm:p-5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[16px] font-semibold">Pick what's on your mind</h2>
          <span className="eyebrow">Guided</span>
        </div>
        <ul className="mt-3 grid gap-2">
          {GUIDED.map((g) => {
            const asked = lastQuestion === g.question;
            const unavailable = g.needsCard !== undefined && !available.has(g.needsCard);
            return (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => ask(g.question)}
                  disabled={unavailable}
                  aria-describedby={unavailable ? `guided-${g.id}-why` : undefined}
                  data-guided={g.id}
                  className={cn(
                    "w-full rounded-2xl border px-3.5 py-2.5 text-left transition-colors",
                    unavailable
                      ? "cursor-not-allowed border-dashed border-line bg-surface-2/60"
                      : asked
                        ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,var(--surface))]"
                        : "border-line hover:border-ink",
                  )}
                >
                  <span className={cn("block text-[14.5px] font-semibold", unavailable && "text-muted")}>{g.situation}</span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-muted">“{g.question}”</span>
                  {unavailable ? (
                    <span id={`guided-${g.id}-why`} className="mt-1 block font-mono text-[10.5px] uppercase tracking-[0.06em] text-accent-ink">
                      Not in {active} · available once v2 is approved in the Coach Lab
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <form
        className="card p-4 sm:p-5"
        onSubmit={(e) => {
          e.preventDefault();
          const q = text.trim();
          if (!q) return setError("Type a question first, or pick one of the guided questions above.");
          ask(q);
          setText("");
        }}
      >
        <label htmlFor="coach-free" className="block text-[16px] font-semibold">
          Your own words
        </label>
        <p id="coach-free-status" className="mt-1 rounded-xl bg-warn-soft px-3 py-2 text-[13px] leading-snug text-warn">
          <span className="font-semibold">Lab only</span> — the 2027 launch gate for free text is closed until the sealed safety set passes.
        </p>
        <p className="mt-1 text-[12.5px] leading-snug text-muted">
          If QUANTUM isn't sure what you meant, it says so, shows the 988 Lifeline and a way to reach care, and proposes nothing.
        </p>
        <textarea
          id="coach-free"
          aria-describedby="coach-free-status coach-free-hint"
          value={text}
          maxLength={400}
          rows={3}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
          }}
          placeholder="e.g. Can I roll the whole 100 in my chair?"
          className="mt-3 w-full resize-none rounded-2xl border border-line-strong bg-bg px-3.5 py-2.5 text-[15px] outline-none focus:border-ink"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span id="coach-free-hint" className="num text-[11.5px] text-muted">
            {text.length}/400 · Ctrl+Enter to ask
          </span>
          <Button type="submit" variant="primary" size="sm">
            Ask QUANTUM
          </Button>
        </div>
        {error ? (
          <p role="alert" className="mt-2 text-[13px] text-bad">
            {error}
          </p>
        ) : null}
      </form>
    </div>
  );
}

const SHORT: Record<CountableSource, string> = {
  manual: "Logged by me",
  event_checkin: "Event check-ins",
  healthkit: "Apple Health",
  health_connect: "Health Connect",
  garmin: "Garmin",
};

export function ConsentRow({ viewer }: { viewer: string }) {
  const w = useWorld();
  const member = w.members[viewer]!;
  return (
    <div className="card p-4 sm:p-5" aria-labelledby="coach-consent">
      <h2 id="coach-consent" className="text-[16px] font-semibold">
        Let QUANTUM read my activity summary
      </h2>
      <p className="mt-0.5 text-[12.5px] text-muted">Off unless you turn it on, source by source. Turning one off applies to the next answer.</p>
      <ul className="mt-3 divide-y divide-[var(--line)]">
        {COUNTABLE_SOURCES.map((s) => {
          const on = member.consents.coach[s];
          const rule = decide(`activity:${s}`, "ai-coaching", { ...member.consents, coach: { ...member.consents.coach, [s]: true } }).ruleId;
          return (
            <li key={s} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold">{SHORT[s]}</span>
                <span className="block text-[11.5px] text-muted">{rule !== "OURS-CONSENT" ? `Your consent, per ${rule}` : "Your consent"}</span>
              </span>
              <Toggle
                checked={on}
                label={`Coach reads ${SOURCE_LABEL[s]}`}
                onChange={(v) => store.dispatch({ type: "SET_CONSENT", payload: { memberId: member.id, purpose: "coach", source: s, granted: v } }, actors.member(member.id), { via: "coach" })}
              />
            </li>
          );
        })}
        <li className="flex items-center justify-between gap-3 py-2">
          <span className="min-w-0">
            <span className="block text-[14px] font-semibold">Strava</span>
            <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted">
              Never — not even with your consent <RuleChip id="STRAVA-03" />
            </span>
          </span>
          <Badge tone="bad">Locked off</Badge>
        </li>
      </ul>
    </div>
  );
}
