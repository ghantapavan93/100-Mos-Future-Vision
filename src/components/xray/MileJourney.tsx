"use client";

// "A mile's journey": the phone on How miles count. Each big button brings one
// real thing through the engine the way it really arrives — Maya's evening walk
// read from Apple Health on her phone, the same walk sent by her Garmin, a walk
// that looks off, a run from Strava, miles typed by hand — and the screen
// replays the checks it went through, in plain words, ending in what actually
// happened. The result is read from what the engine recorded, never assumed
// from the button that was pressed.

import { useEffect, useRef, type ReactNode } from "react";
import type { CommandInput } from "@/domain/commands";
import type { Receipt } from "@/domain/engine";
import { memberView, SOURCE_LABEL } from "@/domain/selectors";
import type { World } from "@/domain/types";
import { AppBody, AppHeader, AppTabs } from "@/components/demo/Phone";
import { plain } from "@/components/demo/plain";
import { cn } from "@/components/ui/kit";
import { actors, store } from "@/lib/store";

/** The walks this screen brings in, by the id their app gives them. */
export const IDS = {
  walk: "hk:evening-walk-2",
  garmin: "garmin:evening-walk-2",
  odd: "garmin:watch-left-on",
  strava: "strava:sunday-run",
  typedPrefix: "manual:maya:typed-",
} as const;

/** How Strava is said everywhere on this screen. */
export const STRAVA_LINE = "Run with Strava? Your miles still count — they come in from your watch or phone, and Strava's own copy stays private.";

export type Kind = "walk" | "garmin" | "odd" | "strava" | "typed";
export type PhoneTab = "send" | "total";

/** What happened to it, in the phone's words. */
export type Result = "counted" | "once" | "already" | "checking" | "private" | "typed" | "stopped";

/** The last thing brought in, and what the engine did with it. */
export interface Journey {
  kind: Kind;
  receipt: Receipt;
  result: Result;
}

/** A start time that has already happened today (or yesterday, if today's hasn't come yet). */
function earlier(clock: number, minuteOfDay: number): number {
  const day = Math.floor(clock / 1440);
  const t = day * 1440 + minuteOfDay;
  return t <= clock ? t : Math.max(0, t - 1440);
}

function delivery(provider: "healthkit" | "garmin" | "strava", externalId: string, distanceMi: number, durationMin: number, mode: "walk" | "run", startedAt: number): CommandInput {
  return { type: "PROVIDER_DELIVERY", payload: { provider, memberId: "maya", externalId, version: 1, op: "upsert", distanceMi, mode, startedAt, durationMin } };
}

const appleWalk = (w: World) => Object.values(w.activities).find((a) => a.memberId === "maya" && a.source === "healthkit" && a.externalId === IDS.walk);

export function walkSent(w: World): boolean {
  return appleWalk(w)?.status === "counted";
}

/** Maya links an app once before it can send anything: only she can. */
function connect(provider: "garmin" | "strava", via: { via: string }): void {
  if (store.get().machine.world.members.maya?.connections[provider].status !== "connected") {
    store.dispatch({ type: "CONNECT_PROVIDER", payload: { memberId: "maya", provider } }, actors.member("maya"), via);
  }
}

/**
 * Brings one kind of thing through the engine, as it would really arrive: the
 * phone reads Apple Health and hands the walk over as Maya's app; Garmin and
 * Strava send from their own servers. Returns what happened.
 */
export function send(kind: Kind): Receipt {
  const w = store.get().machine.world;
  const via = { via: "how-miles-count" };
  switch (kind) {
    case "walk":
      return store.dispatch(delivery("healthkit", IDS.walk, 1.4, 28, "walk", earlier(w.clock, 18 * 60)), actors.provider("healthkit"), via);
    case "garmin": {
      // The same walk as her watch saw it: started two minutes sooner, a minute longer, the same distance.
      const start = (appleWalk(w)?.startedAt ?? earlier(w.clock, 18 * 60)) - 2;
      connect("garmin", via);
      return store.dispatch(delivery("garmin", IDS.garmin, 1.4, 29, "walk", start), actors.provider("garmin"), via);
    }
    case "odd":
      // A watch left on in the car: 40 miles in an hour, sent as a walk.
      connect("garmin", via);
      return store.dispatch(delivery("garmin", IDS.odd, 40, 60, "walk", earlier(store.get().machine.world.clock, 12 * 60)), actors.provider("garmin"), via);
    case "strava":
      connect("strava", via);
      return store.dispatch(delivery("strava", IDS.strava, 3.1, 31, "run", earlier(store.get().machine.world.clock, 6 * 60 + 30)), actors.provider("strava"), via);
    case "typed": {
      const n = Object.values(w.activities).filter((a) => a.externalId.startsWith(IDS.typedPrefix)).length + 1;
      return store.dispatch(
        { type: "LOG_ACTIVITY", payload: { memberId: "maya", clientRequestId: `typed-${n}`, distanceMi: 2, mode: "walk", startedAt: earlier(w.clock, 7 * 60 + 10 * (n - 1)), durationMin: 40 } },
        actors.member("maya"),
        via,
      );
    }
  }
}

/**
 * What happened, read from the record the engine kept. A copy of a walk that is
 * already in from another app is saved, but kept as the same walk — the engine
 * says "applied" either way, so the record's status is what tells them apart.
 */
export function resultOf(r: Receipt, w: World): Result {
  if (r.outcome === "quarantined") return "checking";
  if (r.outcome === "noop") return "already";
  if (r.outcome !== "applied") return "stopped";
  if (r.type === "LOG_ACTIVITY") return "typed";
  const p = r.payload as { provider?: string; externalId?: string };
  if (p.provider === "strava") return "private";
  const record = Object.values(w.activities).find((a) => a.memberId === "maya" && a.source === p.provider && a.externalId === p.externalId);
  return record?.status === "superseded" ? "once" : "counted";
}

type Mark = "pass" | "stop" | "same" | "lock" | "skip";

interface Check {
  q: string;
  a: string;
  mark: Mark;
}

const FROM: Record<Kind, string> = {
  walk: "Read from Apple Health on Maya's phone, for Maya.",
  garmin: "Sent by Maya's Garmin watch, for Maya.",
  odd: "Sent by Maya's Garmin watch, for Maya.",
  strava: "Sent by Maya's Strava, for Maya.",
  typed: "Maya typed it herself.",
};

const ALLOWED: Record<Kind, string> = {
  walk: "Yes — Apple Health miles count for Maya.",
  garmin: "Yes — Garmin miles count for Maya.",
  odd: "Yes — Garmin miles count for Maya.",
  strava: "Strava's rules keep its copy on Maya's own screen.",
  typed: "Typed miles count, the same as any app's.",
};

const MILES: Record<Kind, number> = { walk: 1.4, garmin: 1.4, odd: 40, strava: 3.1, typed: 2 };

/** The seven checks, as this walk went through them. */
function checks({ kind, result, receipt }: Journey): Check[] {
  if (result === "stopped") return [{ q: "Stopped", a: plain(receipt.summary), mark: "stop" }];
  const rows: Check[] = [
    { q: "Is it real?", a: result === "checking" ? "40 miles in one hour is faster than anyone walks." : "Looks like a real outing.", mark: result === "checking" ? "stop" : "pass" },
    { q: "Is it really Maya's?", a: FROM[kind], mark: "pass" },
    {
      q: "Counted already?",
      a:
        result === "already"
          ? "Yes — this exact copy is already in. Nothing to add."
          : result === "once"
            ? "Yes — Apple Health already has this walk: the same distance, started two minutes apart."
            : "No, it's new.",
      mark: result === "already" ? "stop" : result === "once" ? "same" : "pass",
    },
    { q: "Allowed to count?", a: ALLOWED[kind], mark: result === "private" ? "lock" : "pass" },
    { q: "Saved", a: result === "private" ? "Kept on Maya's private list for 7 days." : result === "once" ? "Kept once, marked as the same walk." : "Saved once.", mark: "pass" },
    { q: "On the record", a: "Noted, in order, so it can always be explained.", mark: "pass" },
    {
      q: "Totals updated",
      a:
        result === "private"
          ? "Strava's copy doesn't add. Her watch or phone brings the miles."
          : result === "once"
            ? "No change — the walk already counts, once."
            : `+${MILES[kind]} mi to Maya's summer.`,
      mark: result === "private" || result === "once" ? "skip" : "pass",
    },
  ];
  // After the check that stopped it, nothing else runs — except that it is still on the record.
  const stop = rows.findIndex((c) => c.mark === "stop");
  if (stop >= 0) {
    return rows.map((c, i) => (i <= stop ? c : c.q === "On the record" ? c : { ...c, a: "Not needed.", mark: "skip" as Mark }));
  }
  return rows;
}

const OUTCOME: Record<Result, { title: string; line: string; tone: string }> = {
  counted: { title: "Counted ✓", line: "1.4 miles added to Maya's summer.", tone: "border-ok/50 bg-ok-soft text-ok" },
  once: {
    title: "Same walk — counted once",
    line: "Apple Health and her Garmin both have it. One copy counts; the other is kept, not added. Her total didn't move.",
    tone: "border-ok/50 bg-ok-soft text-ok",
  },
  already: { title: "Already counted", line: "The same copy, sent twice, counts once — your app does this today. Her total didn't move.", tone: "border-line-strong bg-surface-2 text-ink" },
  checking: {
    title: "Set aside — a person will look",
    line: "Maybe her watch was still on in the car. Nobody is accused, and no total changes until someone checks.",
    tone: "border-warn/50 bg-warn-soft text-warn",
  },
  private: { title: "Strava's copy stays private", line: STRAVA_LINE, tone: "border-info/50 bg-info-soft text-info" },
  typed: { title: "Counted ✓", line: "Typed by hand, through the same checks. Two real walks stay two walks.", tone: "border-ok/50 bg-ok-soft text-ok" },
  stopped: { title: "Not counted", line: "The reason is above.", tone: "border-bad/50 bg-bad-soft text-bad" },
};

const SENT_LABEL: Record<Kind, string> = {
  walk: "Maya's evening walk · read from Apple Health",
  garmin: "The same walk · sent by her Garmin",
  odd: "A walk that looks off · 40 mi in 1 hour",
  strava: "A run from Strava · 3.1 mi",
  typed: "Miles typed by hand · 2 mi",
};

function MarkIcon({ mark }: { mark: Mark }) {
  const common = "flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-black";
  if (mark === "pass") return <span className={cn(common, "bg-ok text-bg")}>✓</span>;
  if (mark === "stop") return <span className={cn(common, "bg-warn text-bg")}>!</span>;
  if (mark === "same") return <span className={cn(common, "bg-info text-bg")} aria-label="same walk">=</span>;
  if (mark === "lock") return <span className={cn(common, "bg-info text-bg")} aria-label="private">⌂</span>;
  return <span className={cn(common, "border border-line-strong text-muted")}>–</span>;
}

function JourneyCard({ journey }: { journey: Journey }) {
  const rows = checks(journey);
  const end = OUTCOME[journey.result];
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Bring the whole card up inside the phone, so the outcome at its foot is in view when it lands.
    // Only the phone's own screen scrolls; the page stays where the viewer put it.
    const card = ref.current;
    let screen = card?.parentElement ?? null;
    while (screen && getComputedStyle(screen).overflowY !== "auto") screen = screen.parentElement;
    if (card && screen) {
      const top = card.getBoundingClientRect().top - screen.getBoundingClientRect().top + screen.scrollTop - 8;
      screen.scrollTo({ top, behavior: "smooth" });
    }
  }, [journey.receipt.seq]);
  return (
    <div ref={ref} key={journey.receipt.seq} className="mt-4 scroll-mt-2 rounded-[22px] border border-line bg-surface p-4" aria-live="polite">
      <div className="text-[12px] font-bold uppercase tracking-[0.08em] text-muted">Just came in</div>
      <div className="mt-0.5 text-[16px] font-bold">{SENT_LABEL[journey.kind]}</div>
      <ol className="mt-3 space-y-2">
        {rows.map((c, i) => (
          <li key={c.q} className="flex items-start gap-3 opacity-0 [animation:rise-in_320ms_cubic-bezier(0.2,0,0,1)_both]" style={{ animationDelay: `${i * 140}ms` }}>
            <MarkIcon mark={c.mark} />
            <div className="min-w-0 pt-0.5">
              <div className="text-[14.5px] font-bold leading-tight">{c.q}</div>
              <div className={cn("text-[13.5px] leading-snug", c.mark === "skip" ? "text-muted" : "text-ink/80")}>{c.a}</div>
            </div>
          </li>
        ))}
      </ol>
      <div className={cn("mt-4 rounded-2xl border px-4 py-3 opacity-0 [animation:rise-in_320ms_cubic-bezier(0.2,0,0,1)_both]", end.tone)} style={{ animationDelay: `${rows.length * 140}ms` }}>
        <div className="font-[family-name:var(--font-display)] text-[17px] font-black uppercase leading-tight tracking-[-0.01em]">{end.title}</div>
        <div className="mt-1 text-[13.5px] leading-snug text-ink/85">{end.line}</div>
      </div>
    </div>
  );
}

/** Marks what their app already does, so it never reads as our idea. */
function YourAppToday() {
  return <span className="rounded-full border border-line-strong px-2 py-px text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted">Your app today</span>;
}

function SendButton({
  icon,
  title,
  sub,
  onClick,
  target,
  today,
  disabled,
  hint,
}: {
  icon: ReactNode;
  title: string;
  sub: string;
  onClick: () => void;
  /** The Try it step this button completes; it wears the guiding ring when that step is next. */
  target: string;
  /** Their app already does this. */
  today?: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-step-target={target}
      className="flex min-h-16 w-full items-center gap-3 rounded-[20px] border border-line bg-surface px-3.5 py-3 text-left transition-colors hover:border-accent disabled:opacity-45 disabled:hover:border-line"
    >
      <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[20px]">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15.5px] font-bold leading-tight">{title}</span>
        <span className="block text-[13px] leading-snug text-muted">{disabled && hint ? hint : sub}</span>
        {today ? (
          <span className="mt-1.5 block">
            <YourAppToday />
          </span>
        ) : null}
      </span>
      <span aria-hidden className="text-[20px] text-accent">›</span>
    </button>
  );
}

function SendScreen({ world, journey, onSend }: { world: World; journey: Journey | null; onSend: (k: Kind) => void }) {
  const view = memberView(world, "maya");
  const hasWalk = walkSent(world);
  return (
    <AppBody>
      <div className="rounded-[22px] bg-[linear-gradient(135deg,rgba(255,106,19,0.22),rgba(255,106,19,0.04))] p-4">
        <div className="text-[13px] font-semibold text-muted">Maya&apos;s summer</div>
        <div className="mt-0.5 flex items-baseline gap-1.5">
          <span data-testid="maya-total" className="num font-[family-name:var(--font-display)] text-[44px] font-black leading-none tracking-[-0.04em]">{view.miles}</span>
          <span className="text-[15px] font-bold text-muted">mi counted</span>
        </div>
      </div>
      <p className="mb-3 mt-4 text-[14px] text-muted">Bring a mile in and watch what happens to it.</p>
      <div className="space-y-2.5">
        <SendButton icon="🚶" title="Read Maya's evening walk" sub="From Apple Health, on her phone · 1.4 mi" onClick={() => onSend("walk")} target="walk" today />
        <SendButton
          icon="⌚"
          title="The same walk, from her Garmin"
          sub="Her watch sends it too · 1.4 mi"
          onClick={() => onSend("garmin")}
          target="garmin"
          disabled={!hasWalk}
          hint="Read the evening walk first"
        />
        <SendButton icon="🚗" title="Send a walk that looks off" sub="40 mi in an hour — watch left on in the car" onClick={() => onSend("odd")} target="odd" />
        <SendButton icon="🔒" title="Send a run from Strava" sub="3.1 mi · if you ever add Strava" onClick={() => onSend("strava")} target="strava" />
        <SendButton icon="✍️" title="Add miles by hand" sub="The + button · a 2-mile treadmill walk" onClick={() => onSend("typed")} target="typed" today />
      </div>
      {journey ? <JourneyCard journey={journey} /> : null}
    </AppBody>
  );
}

function TotalScreen({ world }: { world: World }) {
  const view = memberView(world, "maya");
  const mine = Object.values(world.activities).filter((a) => a.memberId === "maya");
  const checking = mine.filter((a) => a.status === "quarantined").length;
  const twins = mine.filter((a) => a.status === "superseded").length;
  return (
    <AppBody>
      <h4 className="mt-2 font-[family-name:var(--font-display)] text-[22px] font-black uppercase leading-tight tracking-[-0.02em]">Why is my total {view.miles}?</h4>
      <p className="mt-1 text-[14px] text-muted">Every mile, and where it came from.</p>
      <ul className="mt-4 divide-y divide-line overflow-hidden rounded-[20px] border border-line bg-surface">
        {view.sources.map((s) => (
          <li key={s.source} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="min-w-0">
              <span className="block text-[15px] font-bold">{SOURCE_LABEL[s.source]}</span>
              <span className="block text-[12.5px] text-muted">
                {s.records} {s.records === 1 ? "outing" : "outings"} · {s.counted ? "counts" : "Strava's own copy · stays private"}
              </span>
            </span>
            <span className={cn("num text-[16px] font-bold", !s.counted && "text-muted")}>{Math.round(s.miles * 10) / 10} mi</span>
          </li>
        ))}
        {twins ? (
          <li className="flex items-center justify-between gap-3 px-4 py-3">
            <span>
              <span className="block text-[15px] font-bold">Same walk, second app</span>
              <span className="block text-[12.5px] text-muted">Kept, not added · counted once</span>
            </span>
            <span className="num text-[16px] font-bold text-muted">{twins}</span>
          </li>
        ) : null}
        {checking ? (
          <li className="flex items-center justify-between gap-3 px-4 py-3">
            <span>
              <span className="block text-[15px] font-bold">Being checked</span>
              <span className="block text-[12.5px] text-muted">Waiting for a person · not in the total</span>
            </span>
            <span className="num text-[16px] font-bold text-warn">{checking}</span>
          </li>
        ) : null}
        <li className="flex items-center justify-between gap-3 bg-accent/10 px-4 py-3">
          <span className="text-[15px] font-black uppercase tracking-[0.02em]">Counted</span>
          <span className="num text-[18px] font-black text-accent">{view.miles} mi</span>
        </li>
      </ul>
      <div className="mt-5 rounded-[20px] border border-line bg-surface p-4">
        <div className="text-[13px] font-bold uppercase tracking-[0.08em] text-muted">What we keep</div>
        <ul className="mt-2 space-y-1.5 text-[14px]">
          <li>✓ How far, and when</li>
          <li>✓ Which app it came from</li>
          <li className="text-muted">✕ Never your route or where you live</li>
          <li className="text-muted">✕ Sponsors only ever see totals of 10 people or more</li>
        </ul>
      </div>
    </AppBody>
  );
}

export function MileJourneyApp({ world, tab, onTab, journey, onSend }: { world: World; tab: PhoneTab; onTab: (t: PhoneTab) => void; journey: Journey | null; onSend: (k: Kind) => void }) {
  return (
    <div className="flex h-full flex-col">
      <AppHeader kicker="How miles count" title="A mile's journey" />
      {tab === "send" ? <SendScreen world={world} journey={journey} onSend={onSend} /> : <TotalScreen world={world} />}
      <AppTabs
        label="How miles count app"
        value={tab}
        onChange={onTab}
        tabs={[
          { id: "send", label: "Miles in", icon: <span aria-hidden className="text-[18px]">➜</span> },
          { id: "total", label: "My total", icon: <span aria-hidden className="text-[18px]">∑</span> },
        ]}
      />
    </div>
  );
}
