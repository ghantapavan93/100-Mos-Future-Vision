"use client";

// "Kayla's week": the founder's app, on a phone. Four tabs, each a glance:
//   Week    — how the week reads, her City Leads first (and the ones in
//             training), three numbers, and the few decisions only she can
//             make (with how long they take);
//   Cities  — a dot per city; tap one to see why and write to its lead;
//   Money   — money in versus promised, each sponsor, the giving fund;
//   People  — what members asked the coach (by topic), stories to share.
// Every OK is a real command; every number comes from the same world. The
// control that finishes each "Try it" step carries data-step-target.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { impactPool, type Receipt } from "@/domain/engine";
import { usd } from "@/domain/finance";
import { AppBody, AppHeader, AppTabs, Phone } from "@/components/demo/Phone";
import { plain } from "@/components/demo/plain";
import { useMarkStep } from "@/components/demo/TryIt";
import { cn } from "@/components/ui/kit";
import { store, useWorld } from "@/lib/store";
import { FELLOWS, PATH, decideFellow, trainingLine, useFellowChoices, type FellowChoice } from "./fellowship";
import {
  askedTopics,
  cityChecks,
  clearTime,
  decisions,
  moneyIn,
  sponsorSnapshot,
  stories,
  weekNumbers,
  weekSummary,
  type CityCheck,
  type CityMood,
  type WeekNumber,
} from "./week";

export type FounderTab = "week" | "cities" | "money" | "people";

/** The Week tab's blocks an idea's "Show me" can land on. */
export type WeekBlock = "summary" | "leads" | "needs" | "training" | "numbers";

export interface FounderPhoneState {
  tab: FounderTab;
  /** The city whose sheet is open. */
  city: string | null;
  /** A block to scroll to and pulse; `at` makes a second tap on the same idea land again. */
  focus?: { block: WeekBlock; at: number } | null;
}

const MOOD: Record<CityMood, { dot: string; word: string }> = {
  good: { dot: "bg-ok shadow-[0_0_10px_var(--ok)]", word: "Doing well" },
  hand: { dot: "bg-warn shadow-[0_0_10px_var(--warn)]", word: "Could use a hand" },
  help: { dot: "bg-bad shadow-[0_0_10px_var(--bad)]", word: "Needs help now" },
};

function Section({ title, children, right, block }: { title: string; children: ReactNode; right?: ReactNode; block?: WeekBlock }) {
  return (
    <section className="mt-5 rounded-2xl" data-block={block}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h4 className="text-[12px] font-black uppercase tracking-[0.12em] text-muted">{title}</h4>
        {right}
      </div>
      {children}
    </section>
  );
}

// ── Week ────────────────────────────────────────────────────────────────────

function Arrow({ n }: { n: WeekNumber }) {
  if (n.last === undefined) return <span className="text-[12px] text-muted">{n.note}</span>;
  if (n.value === n.last) return <span className="text-[12px] text-muted">same as last week</span>;
  const up = n.value > n.last;
  return (
    <span className={cn("text-[12px] font-bold", up ? "text-ok" : "text-warn")}>
      {up ? "▲" : "▼"} {up ? "up" : "down"} from {n.id === "miles" ? n.last.toLocaleString("en-US", { maximumFractionDigits: 1 }) : n.last}
    </span>
  );
}

function Numbers({ numbers }: { numbers: WeekNumber[] }) {
  const [open, setOpen] = useState<WeekNumber["id"] | null>(null);
  const shown = numbers.find((n) => n.id === open) ?? null;
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {numbers.map((n) => (
          <button
            key={n.id}
            type="button"
            aria-expanded={open === n.id}
            onClick={() => setOpen(open === n.id ? null : n.id)}
            className={cn("rounded-2xl border p-3 text-left transition-colors", open === n.id ? "border-accent bg-accent/10" : "border-line bg-surface hover:border-accent")}
          >
            <span className="num block font-[family-name:var(--font-display)] text-[26px] font-black leading-none">{n.value.toLocaleString("en-US", { maximumFractionDigits: 1 })}</span>
            <span className="mt-1 block text-[12px] font-bold leading-tight">{n.label}</span>
            <span className="mt-1 block leading-tight">
              <Arrow n={n} />
            </span>
          </button>
        ))}
      </div>
      {shown ? (
        <ul className="mt-2 divide-y divide-line rounded-2xl border border-line bg-surface" aria-label={`${shown.label} by city`}>
          {shown.byCity.map((c) => (
            <li key={c.city} className="flex justify-between px-4 py-2 text-[14px]">
              <span>{c.city}</span>
              <span className="num font-bold">{c.value.toLocaleString("en-US", { maximumFractionDigits: 1 })}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

/** The City Lead in training whose first solo walk waits on Kayla, if any. */
function useFellowAsk() {
  const answers = useFellowChoices();
  return FELLOWS.find((f) => f.done === 3 && !answers[f.id]) ?? null;
}

/** Every decision on her plate: the ones the world raises, plus a City Lead in training who's ready. */
function useDecisionCount(): number {
  const world = useWorld();
  const fellow = useFellowAsk();
  return useMemo(() => decisions(world).slice(0, fellow ? 2 : 3).length + (fellow ? 1 : 0), [world, fellow]);
}

function NeedsYou() {
  const world = useWorld();
  const mark = useMarkStep();
  const fellow = useFellowAsk();
  // Three at most: a City Lead who's ready always keeps their place.
  const list = useMemo(() => decisions(world).slice(0, fellow ? 2 : 3), [world, fellow]);
  const [said, setSaid] = useState<{ text: string; ok: boolean } | null>(null);
  const answerFellow = (id: string, name: string, walk: string | undefined, choice: FellowChoice) => {
    decideFellow(id, choice);
    setSaid({
      text:
        choice === "yes"
          ? `Yes. ${name} leads ${walk ?? "her first walk"} on her own — a seasoned City Lead checks in with her after.`
          : `One more co-led walk first. ${name} will be ready soon.`,
      ok: true,
    });
    mark("fellow");
    mark("decided");
  };
  const run = (d: (typeof list)[number]) => {
    let last: Receipt | null = null;
    for (const c of d.run) {
      last = store.dispatch(c.input, c.actor, { via: "founder-app" });
      if (last.outcome !== "applied") break;
    }
    const ok = last?.outcome === "applied";
    setSaid({ text: ok ? d.done : plain(last?.summary ?? "That didn't go through."), ok });
    if (ok) mark("decided");
  };
  return (
    <Section block="needs" title="Needs you" right={<span className="num text-[12.5px] text-muted">{list.length + (fellow ? 1 : 0)}</span>}>
      {said ? (
        <p className={cn("mb-2 rounded-2xl p-3 text-[14px] font-bold", said.ok ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn")} aria-live="polite">
          {said.text}
        </p>
      ) : null}
      {list.length === 0 && !fellow ? (
        <p className="rounded-2xl border border-line bg-surface p-4 text-[14.5px] text-muted">Nothing needs you right now. Rest counts too — enjoy the walk.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((d, i) => (
            <li key={d.id} className="rounded-2xl border border-line bg-surface p-4">
              <p className="text-[15.5px] font-bold leading-snug">{d.ask}</p>
              <p className="mt-1 text-[13px] leading-snug text-muted">{d.why}</p>
              {/* One orange OK at a time: the first decision leads, the rest wait their turn outlined. */}
              <button
                type="button"
                onClick={() => run(d)}
                data-step-target={i === 0 ? "decided" : undefined}
                className={cn(
                  "mt-3 min-h-11 rounded-xl px-5 text-[14px] font-black uppercase tracking-[0.06em] active:scale-[0.98]",
                  i === 0 ? "bg-accent text-on-accent shadow-[0_8px_30px_-8px_rgba(255,106,19,0.7)]" : "border border-line-strong text-ink hover:border-accent",
                )}
              >
                {d.ok}
              </button>
            </li>
          ))}
          {fellow ? (
            <li className="rounded-2xl border border-line bg-surface p-4" data-testid="fellow-decision">
              <p className="text-[15.5px] font-bold leading-snug">
                {fellow.name} is ready to lead her first walk in {fellow.city}. Say yes?
              </p>
              <p className="mt-1 text-[13px] leading-snug text-muted">She finished the three short lessons and co-led two walks. You pick the City Leads, so it&apos;s your call.</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => answerFellow(fellow.id, fellow.name, fellow.walk, "yes")}
                  data-step-target={list.length === 0 ? "decided" : "fellow"}
                  className={cn(
                    "min-h-11 rounded-xl px-5 text-[14px] font-black uppercase tracking-[0.06em] active:scale-[0.98]",
                    list.length === 0 ? "bg-accent text-on-accent shadow-[0_8px_30px_-8px_rgba(255,106,19,0.7)]" : "border border-line-strong text-ink hover:border-accent",
                  )}
                >
                  Yes, she&apos;s ready
                </button>
                <button
                  type="button"
                  onClick={() => answerFellow(fellow.id, fellow.name, fellow.walk, "later")}
                  className="min-h-11 px-2 text-[13.5px] font-semibold text-muted underline underline-offset-4 hover:text-ink"
                >
                  One more co-led walk
                </button>
              </div>
            </li>
          ) : null}
        </ul>
      )}
    </Section>
  );
}

/** City Leads in training: the path, and where each person is on it. */
function InTraining() {
  const answers = useFellowChoices();
  return (
    <Section block="training" title="City Leads in training" right={<span className="text-[12.5px] text-muted" data-testid="fellows-line">{trainingLine(answers)}</span>}>
      <div className="rounded-2xl border border-line bg-surface p-4" data-testid="fellows">
        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11.5px] font-bold uppercase tracking-[0.06em] text-muted" aria-label="The path to City Lead">
          {PATH.map((step, i) => (
            <li key={step} className="flex items-center gap-1.5">
              {step}
              {i < PATH.length - 1 ? <span aria-hidden>→</span> : null}
            </li>
          ))}
        </ol>
        <ul className="mt-3 space-y-3">
          {FELLOWS.map((f) => {
            const answer = answers[f.id];
            const done = answer === "yes" ? PATH.length : f.done;
            const status =
              answer === "yes"
                ? `Leading ${f.walk ?? "her first walk"}, with a check-in after`
                : answer === "later"
                  ? "One more co-led walk, then ready"
                  : f.done === 3
                    ? `${f.now} — ready for your yes`
                    : f.now;
            return (
              <li key={f.id} className="flex items-start gap-3">
                <span aria-hidden className="mt-1 flex gap-1">
                  {PATH.map((step, i) => (
                    <span key={step} className={cn("h-2 w-4 rounded-full", i < done ? "bg-ok" : "bg-surface-2")} />
                  ))}
                </span>
                <span className="min-w-0">
                  <span className="block text-[14.5px] font-bold leading-tight">
                    {f.name} · {f.city}
                  </span>
                  <span className="block text-[12.5px] leading-snug text-muted">{status}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </Section>
  );
}

/** The top of the week, calm: people first, then the miles, then how little of her time it needs. */
function Summary() {
  const world = useWorld();
  const summary = useMemo(() => weekSummary(world), [world]);
  const count = useDecisionCount();
  return (
    <div className="mt-1 rounded-2xl border border-line bg-[linear-gradient(160deg,var(--surface),color-mix(in_oklab,var(--accent)_7%,var(--surface)))] p-4" data-testid="week-summary" data-block="summary">
      <p className="flex items-center gap-2 font-[family-name:var(--font-display)] text-[22px] font-black uppercase leading-none tracking-[-0.02em]">
        <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", summary.good ? "bg-ok shadow-[0_0_10px_var(--ok)]" : "bg-sun shadow-[0_0_10px_var(--color-sun)]")} />
        {summary.headline}
      </p>
      <p className="mt-1.5 text-[14px] leading-snug">{summary.line}</p>
      <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]">
        <span className="num inline-flex rounded-full bg-bg/60 px-2.5 py-1 font-bold">{clearTime(count)}</span>
        <span className="text-muted">{count === 0 ? "Rest counts too." : "Everything else can wait."}</span>
      </p>
    </div>
  );
}

/** Every City Lead and what they're carrying, the ones who could use a hand first. */
function Leads({ onOpen }: { onOpen: (id: string) => void }) {
  const world = useWorld();
  const checks = useMemo(() => [...cityChecks(world)].sort((a, b) => Number(a.mood === "good") - Number(b.mood === "good")), [world]);
  const needing = checks.filter((c) => c.mood !== "good").length;
  const ringed = checks.find((c) => c.mood !== "good")?.id;
  return (
    <Section block="leads" title="City Leads this week" right={<span className="text-[12.5px] text-muted">{needing ? `${needing} could use a hand` : "All doing fine"}</span>}>
      <ul className="grid grid-cols-2 gap-2">
        {checks.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onOpen(c.id)}
              data-step-target={c.id === ringed ? "city" : undefined}
              aria-label={`${c.city}: ${c.lead}, ${c.walks} walk${c.walks === 1 ? "" : "s"}, ${MOOD[c.mood].word.toLowerCase()}`}
              className={cn("flex w-full items-start gap-2 rounded-2xl border p-3 text-left transition-colors hover:border-accent", c.mood === "good" ? "border-line bg-surface" : "border-warn/50 bg-warn-soft/50")}
            >
              <span aria-hidden className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", MOOD[c.mood].dot)} />
              <span className="min-w-0">
                <span className="block truncate text-[14.5px] font-bold leading-tight">{c.city}</span>
                <span className="mt-0.5 block truncate text-[12.5px] text-muted">
                  {c.lead} · {c.walks} walk{c.walks === 1 ? "" : "s"}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function WeekTab({ onOpen }: { onOpen: (id: string) => void }) {
  const world = useWorld();
  const numbers = useMemo(() => weekNumbers(world), [world]);
  return (
    <>
      <Summary />
      <Leads onOpen={onOpen} />
      <NeedsYou />
      <InTraining />
      <Section block="numbers" title="This week, in three numbers">
        <Numbers numbers={numbers} />
      </Section>
    </>
  );
}

// ── Cities ──────────────────────────────────────────────────────────────────

function CitySheet({ check, onClose }: { check: CityCheck; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [writing, setWriting] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(check.note);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div role="dialog" aria-label={check.city} className="absolute inset-0 z-20 flex flex-col bg-bg/95 backdrop-blur">
      <div className="flex items-center justify-between px-5 pb-1 pt-3">
        <span className="flex items-center gap-2 text-[12.5px] font-bold">
          <span aria-hidden className={cn("size-2.5 rounded-full", MOOD[check.mood].dot)} />
          {MOOD[check.mood].word}
        </span>
        <button type="button" onClick={onClose} className="min-h-10 rounded-full px-3 text-[14px] font-bold text-muted hover:text-ink">
          Close
        </button>
      </div>
      <AppHeader kicker={`City Lead: ${check.lead}`} title={check.city} />
      <AppBody>
        <p className="text-[16px] leading-relaxed">{check.line}</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            [check.members, "members"],
            [check.walks, "walks coming"],
            [check.waiting, "to publish"],
          ].map(([v, l]) => (
            <div key={String(l)} className="rounded-2xl border border-line bg-surface p-3">
              <div className="num font-[family-name:var(--font-display)] text-[24px] font-black leading-none">{v}</div>
              <div className="mt-1 text-[12px] text-muted">{l}</div>
            </div>
          ))}
        </div>
        {writing ? (
          <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
            <div className="text-[12px] font-black uppercase tracking-[0.12em] text-muted">A starting point for a note to {check.lead}</div>
            <div className="mt-0.5 text-[12px] text-muted">Make it yours before you send it.</div>
            <p className="mt-2 text-[14.5px] leading-relaxed">{check.note}</p>
            <button type="button" onClick={copy} className="mt-3 min-h-11 w-full rounded-xl border border-line-strong text-[14px] font-bold hover:border-accent">
              {copied ? "Copied ✓ — paste it anywhere" : "Copy message"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setWriting(true)}
            className="mt-4 min-h-12 w-full rounded-2xl bg-accent text-[15px] font-black uppercase tracking-[0.06em] text-on-accent shadow-[0_8px_30px_-8px_rgba(255,106,19,0.7)]"
          >
            Message {check.lead}
          </button>
        )}
      </AppBody>
    </div>
  );
}

function CitiesTab({ onOpen }: { onOpen: (id: string) => void }) {
  const world = useWorld();
  const checks = useMemo(() => cityChecks(world), [world]);
  const needing = checks.filter((c) => c.mood !== "good").length;
  const ringed = checks.find((c) => c.mood !== "good")?.id;
  return (
    <Section title="Every city, at a glance" right={<span className="text-[12.5px] text-muted">{needing ? `${needing} need${needing === 1 ? "s" : ""} a look` : "All good"}</span>}>
      <ul className="space-y-2">
        {checks.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onOpen(c.id)}
              data-step-target={c.id === ringed ? "city" : undefined}
              className="flex w-full items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition-colors hover:border-accent"
            >
              <span aria-hidden className={cn("mt-1.5 size-3 shrink-0 rounded-full", MOOD[c.mood].dot)} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-[16px] font-bold">{c.city}</span>
                  <span className="text-[12px] font-bold text-muted">{MOOD[c.mood].word}</span>
                </span>
                <span className="mt-0.5 block text-[13px] leading-snug text-muted">{c.line}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Section>
  );
}

// ── Money ───────────────────────────────────────────────────────────────────

function MoneyTab() {
  const world = useWorld();
  const sponsors = useMemo(() => sponsorSnapshot(world), [world]);
  const pool = useMemo(() => impactPool(world), [world]);
  const money = useMemo(() => moneyIn(world), [world]);
  return (
    <>
      <Section title="Money in vs promised">
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              [money.inBank, "in the bank", true],
              [money.owed, "signed, owed", false],
              [money.promised, "promised", false],
            ] as const
          ).map(([v, l, strong]) => (
            <div key={l} className="rounded-2xl border border-line bg-surface p-3">
              <div className={cn("num font-[family-name:var(--font-display)] text-[19px] font-black leading-none", strong && "text-accent")}>{usd(v)}</div>
              <div className="mt-1.5 text-[11.5px] leading-snug text-muted">{l}</div>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Giving back">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="num font-[family-name:var(--font-display)] text-[32px] font-black leading-none text-accent">{usd(pool.available)}</div>
          <div className="mt-1 text-[13px] font-bold">ready to give to programs members chose</div>
          <p className="mt-2 text-[12.5px] leading-snug text-muted">
            {usd(pool.disbursed)} given so far · {usd(pool.awaitingPayment)} coming once sponsors pay
          </p>
        </div>
      </Section>
      <Section title="Sponsors">
        <ul className="space-y-2">
          {sponsors.map((s) => (
            <li key={s.id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[15.5px] font-bold">{s.name}</span>
                <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-0.5 text-[11.5px] font-bold text-muted">{s.status}</span>
              </div>
              <div className="num mt-1 text-[14px] font-bold">{s.money}</div>
              <div className="mt-0.5 text-[12.5px] text-muted">Next: {s.next}</div>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

// ── People ──────────────────────────────────────────────────────────────────

function PeopleTab() {
  const world = useWorld();
  const asked = useMemo(() => askedTopics(world), [world]);
  const wins = useMemo(() => stories(world), [world]);
  const [copied, setCopied] = useState<string | null>(null);
  return (
    <>
      <Section title="What people asked the coach">
        {asked.topics.length === 0 && asked.safety === 0 ? (
          <p className="rounded-2xl border border-line bg-surface p-4 text-[14px] text-muted">No questions yet this week. When members ask the coach something, the topic shows up here.</p>
        ) : (
          <ul className="space-y-2">
            {asked.topics.map((t) => (
              <li key={t.topic} className="flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3">
                <span className="text-[14.5px] font-bold">{t.topic}</span>
                <span className="num text-[14px] text-muted">{t.count}</span>
              </li>
            ))}
            {asked.safety ? (
              <li className="rounded-2xl bg-surface-2 px-4 py-3 text-[13px] text-muted">
                {asked.safety} safety question{asked.safety === 1 ? "" : "s"} answered with care lines. Details stay private.
              </li>
            ) : null}
          </ul>
        )}
        <p className="mt-2 text-[12.5px] text-muted">Topics only. Kayla never reads a member&apos;s own words.</p>
      </Section>
      <Section title="Stories to share">
        {wins.length === 0 ? (
          <p className="rounded-2xl border border-line bg-surface p-4 text-[14px] text-muted">When a member says yes to sharing their summer, their win lands here — ready for Instagram or the newsletter.</p>
        ) : (
          <ul className="space-y-2">
            {wins.map((s) => (
              <li key={s.name} className="rounded-2xl border border-line bg-surface p-4">
                <p className="text-[14.5px] font-bold">{s.line}</p>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(s.line);
                      setCopied(s.name);
                    } catch {
                      setCopied(null);
                    }
                  }}
                  className="mt-2 min-h-10 rounded-xl border border-line-strong px-3 text-[13px] font-bold hover:border-accent"
                >
                  {copied === s.name ? "Copied ✓" : "Copy for the newsletter"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

// ── The phone ───────────────────────────────────────────────────────────────

const TITLES: Record<FounderTab, string> = { week: "Your week", cities: "Cities", money: "Money", people: "People" };

export function FounderPhone({ ui, setUI }: { ui: FounderPhoneState; setUI: (patch: Partial<FounderPhoneState>) => void }) {
  const world = useWorld();
  const mark = useMarkStep();
  const checks = useMemo(() => cityChecks(world), [world]);
  const open = checks.find((c) => c.id === ui.city) ?? null;
  const body = useRef<HTMLDivElement>(null);
  // "Show me" from an idea: scroll the phone's own body (never the page) to the block, then pulse it twice.
  useEffect(() => {
    if (!ui.focus || ui.tab !== "week") return;
    const frame = requestAnimationFrame(() => {
      const el = body.current?.querySelector<HTMLElement>(`[data-block="${ui.focus!.block}"]`);
      // The nearest scrolling box between the block and the phone: the app's body.
      let scroller = el?.parentElement ?? null;
      while (scroller && scroller !== body.current && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
      if (!el || !scroller) return;
      const top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 12;
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      scroller.scrollTo({ top, behavior: still ? "auto" : "smooth" });
      if (!still) {
        // An outline set a little outside the block, so the pulse never sits on its title's letters.
        el.animate(
          [
            { outline: "3px solid rgba(255,106,19,0)", outlineOffset: "6px" },
            { outline: "3px solid rgba(255,106,19,0.9)", outlineOffset: "6px" },
            { outline: "3px solid rgba(255,106,19,0)", outlineOffset: "6px" },
          ],
          { duration: 900, iterations: 2, delay: 350 },
        );
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [ui.focus, ui.tab]);
  const openCity = (id: string) => {
    setUI({ city: id });
    if (checks.find((c) => c.id === id)?.mood !== "good") mark("city");
  };
  return (
    <Phone label="Kayla's founder app">
      <div ref={body} className="relative flex h-full flex-col">
        <AppHeader kicker="Hi Kayla" title={TITLES[ui.tab]} />
        <AppBody>
          {ui.tab === "week" ? <WeekTab onOpen={openCity} /> : null}
          {ui.tab === "cities" ? <CitiesTab onOpen={openCity} /> : null}
          {ui.tab === "money" ? <MoneyTab /> : null}
          {ui.tab === "people" ? <PeopleTab /> : null}
        </AppBody>
        <AppTabs
          label="Founder app"
          value={ui.tab}
          onChange={(tab) => setUI({ tab, city: null, focus: null })}
          tabs={[
            { id: "week", label: "Week" },
            { id: "cities", label: "Cities" },
            { id: "money", label: "Money" },
            { id: "people", label: "People" },
          ]}
        />
        {open ? <CitySheet check={open} onClose={() => setUI({ city: null })} /> : null}
      </div>
    </Phone>
  );
}
