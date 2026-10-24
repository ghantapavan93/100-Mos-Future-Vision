"use client";

import { useRef, useState } from "react";
import { dayLabel, dayOf, tick, timeLabel, minuteOf } from "@/domain/calendar";
import type { MemberView } from "@/domain/selectors";
import type { Activity, MovementMode, World } from "@/domain/types";
import { plain } from "@/components/demo/plain";
import { useMarkStep } from "@/components/demo/TryIt";
import { Inspectable } from "@/components/inspect/Inspect";
import { Badge, SourceTag, cn } from "@/components/ui/kit";
import { InlineReceipt, YourAppToday, useMemberAction } from "./shared";

const MODES: { mode: MovementMode; label: string }[] = [
  { mode: "walk", label: "Walk" },
  { mode: "jog", label: "Jog" },
  { mode: "run", label: "Run" },
  { mode: "roll", label: "Roll" },
  { mode: "hike", label: "Hike" },
];

/** The member says roughly when; the app never invents a start time. */
const TIMES = [
  { key: "morning", label: "Morning", minute: 7 * 60 + 30 },
  { key: "midday", label: "Midday", minute: 12 * 60 },
  { key: "evening", label: "Evening", minute: 18 * 60 },
] as const;
type TimeKey = (typeof TIMES)[number]["key"];

const STATUS: Record<Activity["status"], { label: string; tone: "ok" | "neutral" | "warn" | "bad" | "info" }> = {
  counted: { label: "Counted", tone: "ok" },
  "owner-panel": { label: "Private", tone: "info" },
  superseded: { label: "Counted once", tone: "neutral" },
  quarantined: { label: "Being checked", tone: "warn" },
  purged: { label: "Removed", tone: "neutral" },
};

/** The request ids the demo's own buttons use, so "you logged a walk" can be told apart from the seeded season. */
export const DEMO_LOG_TAGS = ["log", "example"] as const;

/** The member's most recent typed outing, read from the world (not from receipts), with the request key it was sent under. */
function lastManualLog(world: World, memberId: string) {
  const prefix = `manual:${memberId}:`;
  // Object.values keeps insertion order for these string ids, so the last match is the newest record.
  const a = Object.values(world.activities)
    .filter((x) => x.memberId === memberId && x.source === "manual" && x.status !== "purged" && x.externalId.startsWith(prefix))
    .at(-1);
  if (!a) return null;
  return { clientRequestId: a.externalId.slice(prefix.length), distanceMi: a.distanceMi, mode: a.mode, startedAt: a.startedAt, durationMin: a.durationMin };
}

export function LogTab({ view, world }: { view: MemberView; world: World }) {
  const m = view.member;
  const act = useMemberAction(m.id);
  const mark = useMarkStep();
  const [distance, setDistance] = useState("1.0");
  const [mode, setMode] = useState<MovementMode>(m.moves[0] ?? "walk");
  const [minutes, setMinutes] = useState("20");
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const day = dayOf(world.clock);
  const now = minuteOf(world.clock);
  const passedToday = TIMES.filter((t) => t.minute <= now);
  const [when, setWhen] = useState<"today" | "yesterday">(passedToday.length || day === 0 ? "today" : "yesterday");
  const [time, setTime] = useState<TimeKey>((passedToday.at(-1) ?? TIMES[2]).key);
  const slotOpen = (key: TimeKey) => when === "yesterday" || TIMES.find((t) => t.key === key)!.minute <= now;

  const lastManual = lastManualLog(world, m.id);
  const requestId = (tag: string) => `${tag}-${world.clock}-${Object.keys(world.activities).length}-${++seq.current}`;

  const submit = () => {
    // A decimal comma ("1,5") is how much of the world writes 1.5.
    const d = Number(distance.trim().replace(",", "."));
    const mins = Math.round(Number(minutes.trim()));
    if (!distance.trim() || !Number.isFinite(d) || d <= 0) return setError("Enter how far you went, in miles — for example 1.5.");
    if (d < 0.1) return setError("Outings under a tenth of a mile aren't counted. Add it to your next one.");
    if (!minutes.trim() || !Number.isFinite(mins) || mins < 1) return setError("Enter roughly how many minutes. A guess is fine.");
    if (mins > 1440) return setError("That's more than a day — check the minutes.");
    if (!slotOpen(time)) return setError("That part of today hasn't happened yet. Pick an earlier time, or yesterday.");
    setError(null);
    const minute = TIMES.find((t) => t.key === time)!.minute;
    const startedAt = tick(when === "today" ? day : Math.max(0, day - 1), minute);
    act.run({ type: "LOG_ACTIVITY", payload: { memberId: m.id, clientRequestId: requestId("log"), distanceMi: d, mode, startedAt, durationMin: mins } });
  };

  const example = () => {
    const payload = { distanceMi: 1.2, mode: m.moves[0] ?? "walk", startedAt: Math.max(0, world.clock - 30), durationMin: 24 };
    act.run({ type: "LOG_ACTIVITY", payload: { memberId: m.id, clientRequestId: requestId("example"), ...payload } });
  };

  // The same request sent twice (a retry on a bad connection) carries the same key, so it counts once.
  const resend = () => {
    if (!lastManual) return;
    const r = act.run({ type: "LOG_ACTIVITY", payload: { memberId: m.id, ...lastManual } });
    if (r.outcome === "noop") mark("resend-counted-once");
  };

  return (
    <div className="space-y-4 px-4 pb-6 pt-2">
      <Inspectable id="ingest">
        <section aria-label="Log a walk" className="rounded-[26px] bg-surface p-5 shadow-[var(--shadow)]">
          <div className="flex items-start justify-between gap-2">
            <h2 className="font-[family-name:var(--font-display)] text-[24px] font-black uppercase leading-none tracking-[-0.02em]">Log a walk</h2>
            <YourAppToday />
          </div>
          <p className="mt-2 text-[13.5px] text-muted">Walk, jog, run, roll or hike. Type it in and it counts, at any pace.</p>
          {/* Bottom-aligned, so the two boxes stay level when "Minutes, roughly" wraps on a narrow phone. */}
          <div className="mt-5 grid grid-cols-2 items-end gap-3">
            <label className="block">
              <span className="eyebrow">Miles</span>
              <input inputMode="decimal" value={distance} onChange={(e) => {
                  setDistance(e.target.value);
                  setError(null);
                }} className="num mt-1 min-h-12 w-full rounded-xl border border-line-strong bg-bg px-3 text-[17px]" />
            </label>
            <label className="block">
              <span className="eyebrow">Minutes, roughly</span>
              <input inputMode="numeric" value={minutes} onChange={(e) => {
                  setMinutes(e.target.value);
                  setError(null);
                }} className="num mt-1 min-h-12 w-full rounded-xl border border-line-strong bg-bg px-3 text-[17px]" />
            </label>
          </div>
          <fieldset className="mt-4">
            <legend className="eyebrow">How</legend>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {MODES.map((o) => (
                <button
                  key={o.mode}
                  type="button"
                  aria-pressed={mode === o.mode}
                  onClick={() => setMode(o.mode)}
                  className={cn("min-h-11 rounded-full px-4 text-[14px] font-semibold", mode === o.mode ? "bg-ink text-bg" : "border border-line-strong")}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="mt-4">
            <legend className="eyebrow">When</legend>
            <div className="mt-2 grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1">
              {(["today", "yesterday"] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  aria-pressed={when === w}
                  disabled={w === "yesterday" && day === 0}
                  onClick={() => setWhen(w)}
                  className={cn("min-h-11 rounded-full text-[14px] font-semibold capitalize disabled:opacity-45", when === w ? "bg-surface shadow" : "text-muted")}
                >
                  {w}
                </button>
              ))}
            </div>
            <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-full bg-surface-2 p-1">
              {TIMES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  aria-pressed={time === t.key}
                  disabled={!slotOpen(t.key)}
                  onClick={() => setTime(t.key)}
                  className={cn("min-h-11 rounded-full text-[14px] font-semibold disabled:opacity-45", time === t.key ? "bg-surface shadow" : "text-muted")}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {when === "today" && passedToday.length < TIMES.length ? <p className="mt-1.5 text-[12.5px] text-muted">It&apos;s {timeLabel(now)} now, so later today isn&apos;t open yet.</p> : null}
          </fieldset>
          <div role="alert">{error ? <p className="mt-3 text-[13.5px] text-bad">{error}</p> : null}</div>
          <button type="button" onClick={submit} className="mt-4 min-h-12 w-full rounded-full bg-accent text-[15px] font-black uppercase tracking-[0.06em] text-on-accent" data-step-target="log">
            Save walk
          </button>
          <InlineReceipt receipt={act.last} className="mt-3" />
          <button type="button" onClick={example} className="mt-3 min-h-11 w-full rounded-full border border-line-strong text-[14px] font-semibold" data-testid="example-walk">
            Quick add: a 1.2 mile {m.moves[0] ?? "walk"}
          </button>
          {lastManual ? (
            <div className="mt-3 rounded-2xl border border-dashed border-line-strong p-3">
              <p className="text-[13px] leading-snug text-muted">Phones sometimes send the same walk twice on a bad signal. Try it — it still counts once.</p>
              <button type="button" onClick={resend} className="mt-2 min-h-11 w-full rounded-full bg-surface-2 text-[14px] font-bold" data-testid="resend-walk" data-step-target="resend">
                Send that walk again
              </button>
            </div>
          ) : null}
        </section>
      </Inspectable>

      {view.strava ? (
        <Inspectable id="strava-panel">
          <section aria-label="Strava, last 7 days" className="rounded-[22px] border border-line bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="eyebrow">Strava · last 7 days</span>
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[#b13c0a]">Powered by Strava</span>
            </div>
            {view.strava.records.length ? (
              <>
                <p className="mt-2 text-[14px] leading-snug">
                  <span className="num font-semibold">{view.strava.miles.toFixed(1)}</span> mi, shown only to you.
                </p>
                <ul className="mt-2 divide-y divide-[var(--line)]">
                  {view.strava.records.map((a) => {
                    const daysToExpiry = a.expiresAt !== undefined ? Math.max(0, Math.ceil((a.expiresAt - world.clock) / 1440)) : null;
                    return (
                      <li key={a.id} className="py-2.5">
                        <div className="text-[14px]">
                          <span className="num font-semibold">{a.distanceMi.toFixed(1)} mi</span> {a.mode} · {dayLabel(dayOf(a.startedAt))}
                        </div>
                        <div className="text-[12.5px] text-muted">Leaves this app in {daysToExpiry} day{daysToExpiry === 1 ? "" : "s"}</div>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <p className="mt-2 text-[14px] text-muted">Nothing in the last 7 days. Strava&apos;s copy leaves this app after a week.</p>
            )}
            <div className="mt-3 rounded-2xl bg-surface-2 p-3 text-[13.5px] leading-snug" data-testid="strava-honest">
              <p className="font-semibold">Run with Strava? Your miles still count.</p>
              <p className="mt-1">They come in from your watch or phone, and Strava&apos;s own copy stays private. It shows here for 7 days, just for you.</p>
              <p className="mt-1">Connect Apple Health, Health Connect or Garmin in You — or type a walk in yourself.</p>
            </div>
          </section>
        </Inspectable>
      ) : null}

      <section aria-label="Your records" className="rounded-[22px] border border-line bg-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="eyebrow">Your walks</span>
          <YourAppToday />
        </div>
        <p className="mt-1 text-[12.5px] text-muted">Newest first. Delete any walk you didn&apos;t mean to log.</p>
        <ul className="mt-2 divide-y divide-[var(--line)]">
          {view.recent.map((a) => {
            const st = STATUS[a.status];
            return (
              <li key={a.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 text-[14px]">
                    <span className={cn("num font-semibold", a.status === "purged" && "line-through")}>{a.distanceMi.toFixed(1)} mi</span>
                    <span className="text-muted">
                      {a.mode} · {dayLabel(dayOf(a.startedAt))}, {timeLabel(minuteOf(a.startedAt))}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    <SourceTag source={a.source} attribution={a.source === "garmin" ? m.connections.garmin.deviceModel : undefined} />
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                  {a.removal ? <div className="mt-0.5 text-[12.5px] text-muted">{plain(a.removal.reason)}</div> : null}
                </div>
                {a.status !== "purged" && a.status !== "owner-panel" ? (
                  <button
                    type="button"
                    aria-label={`Delete ${a.distanceMi} mile ${a.mode}`}
                    onClick={() => act.run({ type: "DELETE_ACTIVITY", payload: { memberId: m.id, activityId: a.id } })}
                    className="min-h-11 shrink-0 rounded-full px-3 text-[13px] font-semibold text-muted hover:text-bad"
                  >
                    Delete
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
