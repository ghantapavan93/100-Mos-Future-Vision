"use client";

// Today: where your summer stands (the ring and days left their app already
// shows), a sealed note to your September self, a small plan if you want one,
// your next walk, and the step you saved. Nothing here shows a pace.

import { useState } from "react";
import { dayLabel, dayOf, timeLabel } from "@/domain/calendar";
import type { MemberView } from "@/domain/selectors";
import type { RacePath, World } from "@/domain/types";
import { useMarkStep } from "@/components/demo/TryIt";
import { Badge, cn } from "@/components/ui/kit";
import { daysToOpen, sealNote, shareNote, useSeptemberNotes } from "./septemberNote";
import { InlineReceipt, ProgressRing, YourAppToday, useMemberAction } from "./shared";

/** The challenge is 100 miles, whatever a member's own goal is: one stone per mile. */
const STONES = 100;

const RACE: Record<RacePath, { label: string; copy: string; coach: boolean }> = {
  "5k": { label: "5K", copy: "3.1 miles. Open to everyone, and walking it counts. A few weeks of building up is plenty.", coach: false },
  "10k": { label: "10K", copy: "6.2 miles. Usually comes after a 5K. Keep it easy, and keep any one run close to your longest recent one.", coach: false },
  half: { label: "Half", copy: "13.1 miles. Usually after a 10K and about 12 weeks of steady running.", coach: true },
  full: { label: "Full", copy: "26.2 miles. Usually after a half and 16 or more weeks of getting ready.", coach: true },
};

/** On-Track Helper: the miles left, spread over the weeks left, on the days you choose. */
export function onTrackPlan(remaining: number, daysLeft: number, daysPerWeek: number) {
  const weeks = Math.max(1, daysLeft / 7);
  const perDay = Math.ceil((remaining / weeks / daysPerWeek) * 10) / 10;
  return { perDay: Math.max(0.1, perDay), daysPerWeek };
}

export function TodayTab({ view, world, onTab }: { view: MemberView; world: World; onTab: (t: "log" | "circles" | "coach" | "you") => void }) {
  const m = view.member;
  const act = useMemberAction(m.id);
  const [days, setDays] = useState(4);
  const remaining = Math.max(0, view.goal.target - view.goal.value);
  const next = view.upcoming.find((e) => e.status === "published");
  const chapter = m.chapterId ? world.chapters[m.chapterId] : null;
  const shared = m.chapterId ? world.projections.chapterSharedMiles[m.chapterId] ?? 0 : 0;
  // The race chooser is opt-in: no race talk on a first-timer's home screen.
  const [raceOpen, setRaceOpen] = useState(false);
  const showRace = raceOpen || view.miles >= 25 || m.racePath !== "5k";
  const plan = onTrackPlan(remaining, view.daysLeft, days);

  return (
    <div className="space-y-4 px-4 pb-6 pt-2">
      <section aria-label="Your summer" className="rounded-[26px] bg-surface p-5 shadow-[var(--shadow)]">
        <div className="flex items-center justify-between gap-2">
          <span className="eyebrow">Your summer</span>
          <YourAppToday />
        </div>
        <div className="mt-3 flex flex-col items-center">
          <ProgressRing
            value={view.goal.value}
            target={view.goal.target}
            unit={view.goal.unit}
            label={`${view.goal.value} of ${view.goal.target} ${view.goal.unit === "mi" ? "miles" : "beginners welcomed"}`}
          />
          <p className="mt-4 text-center text-[15px] leading-snug">“{m.goal.label}”</p>
          <p className="mt-1 text-[13px] text-muted">
            <span className="num font-semibold text-ink">{view.daysLeft}</span> days left
          </p>
        </div>
        {view.goal.unit === "mi" ? null : (
          <p className="mt-4 rounded-2xl bg-surface-2 p-4 text-[14.5px] leading-snug" data-testid="pace-line">
            <span className="num font-semibold">{view.goal.value}</span> of <span className="num">{view.goal.target}</span> beginners welcomed at a first group walk.
          </p>
        )}
      </section>

      <SeptemberNoteCard view={view} world={world} />

      {view.goal.unit === "mi" ? (
        remaining > 0 ? (
          <section aria-label="On-Track Helper" className="rounded-[22px] border border-line bg-surface p-4" data-testid="on-track">
            <div className="eyebrow">On-Track Helper</div>
            <p className="mt-1 text-[13.5px] text-muted">How many days a week suit you?</p>
            <div role="group" aria-label="Days a week" className="mt-3 grid grid-cols-3 gap-1 rounded-full bg-surface-2 p-1">
              {[3, 4, 5].map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={days === d}
                  onClick={() => setDays(d)}
                  className={cn("min-h-11 rounded-full text-[14px] font-bold", days === d ? "bg-ink text-bg" : "text-muted")}
                >
                  {d} days
                </button>
              ))}
            </div>
            <p className="mt-3 text-[16px] leading-snug" data-testid="pace-line">
              <span className="num text-[22px] font-black text-accent">{plan.perDay.toFixed(1)}</span> miles, <span className="font-bold">{plan.daysPerWeek} days a week</span> gets you there by Aug 31.
            </p>
            <p className="mt-1 text-[13px] text-muted">Any week you move still counts.</p>
          </section>
        ) : (
          <p className="rounded-[22px] bg-ok-soft p-4 text-[15px] font-semibold text-ok" data-testid="pace-line">
            You reached your goal. Everything from here is extra.
          </p>
        )
      ) : null}

      <SummerPath miles={view.miles} />

      <section aria-label="My circle total" className="rounded-[22px] border border-line bg-surface p-4" data-testid="circle-total">
        <div role="group" aria-label="Show" className="flex gap-1 rounded-full bg-surface-2 p-1">
          {(["personal", "team"] as const).map((mode) => (
            <button
              key={mode}
              aria-pressed={m.rankMode === mode}
              type="button"
              onClick={() => act.run({ type: "SET_RANK_MODE", payload: { memberId: m.id, mode } })}
              className={cn("min-h-11 flex-1 rounded-full text-[14px] font-semibold", m.rankMode === mode ? "bg-surface shadow" : "text-muted")}
            >
              {mode === "personal" ? "Just me" : "My circle"}
            </button>
          ))}
        </div>
        {m.rankMode === "personal" ? (
          <p className="mt-3 text-[13.5px] leading-snug text-muted">Just your own summer. Tap “My circle” to see the miles your circle shares.</p>
        ) : chapter ? (
          <div className="mt-3">
            <div className="eyebrow">{chapter.name}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="num text-[26px] font-semibold">{shared.toLocaleString("en-US", { maximumFractionDigits: 1 })}</span>
              <span className="text-[13px] text-muted">miles together</span>
            </div>
            <p className="mt-1 text-[12.5px] leading-snug text-muted">One number for the whole circle, from the members who chose to share.</p>
          </div>
        ) : (
          <div className="mt-3 text-[13.5px] text-muted">
            You haven&apos;t joined a circle yet.{" "}
            <button type="button" onClick={() => onTab("circles")} className="font-semibold text-accent-ink underline underline-offset-4">
              Find one
            </button>
          </div>
        )}
      </section>

      {next ? (
        <section aria-label="Next walk" className="rounded-[22px] border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="eyebrow">Next walk near you</span>
            <YourAppToday />
          </div>
          {!m.needs.length ? null : (
            <div className="mt-2">{next.access.length === 0 ? <Badge tone="warn">Access not checked yet</Badge> : next.fits ? <Badge tone="ok">Fits your needs</Badge> : <Badge tone="warn">Check access</Badge>}</div>
          )}
          <h3 className="mt-2 font-[family-name:var(--font-display)] text-[21px] font-black uppercase leading-tight tracking-[-0.02em]">{next.title}</h3>
          <p className="mt-1 text-[13.5px] text-muted">
            {dayLabel(next.day)} · {timeLabel(next.startMinute)} · {next.meetingArea}
          </p>
          <button type="button" onClick={() => onTab("circles")} className="mt-3 min-h-11 w-full rounded-full border border-line-strong text-[14px] font-semibold">
            {next.going ? "You're going · details" : next.waitlisted ? "On the waitlist · details" : "See the details"}
          </button>
        </section>
      ) : null}

      {m.savedStep ? (
        <section aria-label="Saved step" className="rounded-[22px] bg-ok-soft p-4">
          <div className="eyebrow text-ok">Your saved next step</div>
          <p className="mt-1 text-[15px] leading-snug">{m.savedStep.text}</p>
          <button type="button" onClick={() => act.run({ type: "CLEAR_NEXT_STEP", payload: { memberId: m.id } })} className="mt-1 min-h-11 text-[13.5px] font-semibold underline underline-offset-4">
            Done, or not today — clear it
          </button>
        </section>
      ) : null}

      <section aria-label="Race someday" className="rounded-[22px] border border-line bg-surface p-4">
        {showRace ? (
          <>
            <div className="eyebrow">Thinking about a race?</div>
            <div role="group" aria-label="Race" className="mt-2 grid grid-cols-4 gap-1 rounded-full bg-surface-2 p-1">
              {(Object.keys(RACE) as RacePath[]).map((r) => (
                <button
                  key={r}
                  aria-pressed={m.racePath === r}
                  type="button"
                  onClick={() => act.run({ type: "SET_RACE_PATH", payload: { memberId: m.id, racePath: r } })}
                  className={cn("min-h-11 rounded-full text-[14px] font-semibold", m.racePath === r ? "bg-surface shadow" : "text-muted")}
                >
                  {RACE[r].label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[13.5px] leading-snug">{RACE[m.racePath].copy}</p>
            {RACE[m.racePath].coach ? (
              <p className="mt-2 text-[13px] leading-snug text-muted">
                A distance like this deserves a plan made with a real coach.{" "}
                <button type="button" className="font-semibold text-accent-ink underline underline-offset-4" onClick={() => onTab("coach")}>
                  Ask the coach why
                </button>
              </p>
            ) : null}
          </>
        ) : (
          <button type="button" aria-expanded={false} onClick={() => setRaceOpen(true)} className="flex min-h-11 w-full items-center justify-between text-left">
            <span>
              <span className="block text-[14.5px] font-semibold">Thinking about a race someday?</span>
              <span className="block text-[12.5px] text-muted">Totally optional. No race is part of the challenge.</span>
            </span>
            <span aria-hidden className="text-[18px] text-muted">
              +
            </span>
          </button>
        )}
      </section>

      <section aria-label="Bring someone" className="rounded-[22px] border border-line bg-surface p-4">
        <div className="eyebrow">Bring someone along</div>
        <button type="button" onClick={() => act.run({ type: "INVITE_FRIEND", payload: { memberId: m.id } })} className="mt-3 min-h-11 w-full rounded-full border border-line-strong text-[14px] font-semibold">
          Make an invite link
        </button>
        <p className="mt-2 text-[12.5px] text-muted">
          <span className="num">{m.invitesSent}</span> invite link{m.invitesSent === 1 ? "" : "s"} made. You share it yourself — nothing is sent for you.
        </p>
        <InlineReceipt receipt={act.last} className="mt-3" />
      </section>
    </div>
  );
}

/** Three ways people often finish "I'm starting because…", so the first note is one tap. */
const STARTERS = ["I want to feel strong again", "I want to meet people", "I'm keeping a promise to myself"];

function Lock({ open = false }: { open?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <rect x="5" y="11" width="14" height="9.5" rx="2.5" />
      <path d={open ? "M8.5 11V8a3.5 3.5 0 0 1 6.8-1.2" : "M8.5 11V8a3.5 3.5 0 0 1 7 0v3"} />
    </svg>
  );
}

/**
 * A note to your September self: write one line about why you're starting; it
 * stays sealed until September 1 and then opens beside your summer story.
 * Only the member can open it, and sharing it is their choice alone.
 */
function SeptemberNoteCard({ view, world }: { view: MemberView; world: World }) {
  const m = view.member;
  const notes = useSeptemberNotes();
  const note = notes[m.id] ?? null;
  const mark = useMarkStep();
  const [draft, setDraft] = useState("");
  const [peek, setPeek] = useState(false);
  const today = dayOf(world.clock);
  const left = daysToOpen(today);
  const chapter = m.chapterId ? world.chapters[m.chapterId] : null;

  const seal = () => {
    sealNote(m.id, draft, today);
    setDraft("");
    mark("note");
  };

  if (!note) {
    return (
      <section aria-label="A note to your September self" className="rounded-[22px] border border-accent/40 bg-accent/[0.07] p-4" data-testid="september-note">
        <div className="flex items-center gap-2 text-accent-ink">
          <Lock />
          <span className="eyebrow text-accent-ink">A note to your September self</span>
        </div>
        <p className="mt-2 text-[15px] font-semibold leading-snug">Why are you starting? Write it down. It stays sealed until September 1.</p>
        <label className="mt-3 block">
          <span className="sr-only">Your note</span>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 140))}
            rows={2}
            placeholder="I'm starting because…"
            className="w-full rounded-xl border border-line-strong bg-bg px-3 py-2.5 text-[15px] leading-snug"
          />
        </label>
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Start from">
          {STARTERS.map((s) => (
            <button key={s} type="button" onClick={() => setDraft(s)} className="min-h-9 rounded-full border border-line-strong px-3 text-[12.5px] font-semibold">
              {s}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={seal}
          disabled={!draft.trim()}
          data-step-target="note"
          className="mt-3 min-h-11 w-full rounded-full bg-ink text-[14.5px] font-bold text-bg transition-opacity disabled:opacity-40"
        >
          Seal it until September 1
        </button>
        <p className="mt-2 text-[12.5px] leading-snug text-muted">Only you can open it — not your circle, not the coach, not us.</p>
      </section>
    );
  }

  if (!peek) {
    return (
      <section aria-label="A note to your September self" className="rise-in rounded-[22px] border border-line bg-surface p-4" data-testid="september-note">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Lock />
            <span className="eyebrow">A note to your September self</span>
          </span>
          <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Sealed</span>
        </div>
        {/* The words stay hidden: a sealed note shows only that it exists. */}
        <div aria-hidden className="mt-3 space-y-1.5">
          <span className="block h-2.5 w-11/12 rounded-full bg-surface-2" />
          <span className="block h-2.5 w-7/12 rounded-full bg-surface-2" />
        </div>
        <p className="mt-3 text-[14px] leading-snug">
          Opens <span className="font-bold">September 1</span> · <span className="num font-bold">{left}</span> day{left === 1 ? "" : "s"} to go
        </p>
        <p className="mt-0.5 text-[12.5px] leading-snug text-muted">Only you can open it.</p>
        <button type="button" onClick={() => setPeek(true)} className="mt-2 min-h-10 text-[13.5px] font-semibold text-accent-ink underline underline-offset-4">
          Preview September 1
        </button>
      </section>
    );
  }

  const groupWalks = Object.values(world.activities).filter((a) => a.memberId === m.id && a.source === "event_checkin" && a.status === "counted").length;
  return (
    <section aria-label="Your note, opened" className="rise-in rounded-[22px] border border-accent/50 bg-surface p-4 shadow-[var(--glow)]" data-testid="september-note">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-accent-ink">
          <Lock open />
          <span className="eyebrow text-accent-ink">September 1 · preview</span>
        </span>
        <button type="button" onClick={() => setPeek(false)} className="min-h-9 px-1 text-[13px] font-semibold text-muted">
          Close
        </button>
      </div>
      <h3 className="mt-2 font-[family-name:var(--font-display)] text-[22px] font-black uppercase leading-tight tracking-[-0.02em]">Your summer story</h3>
      <p className="mt-1 text-[13px] text-muted">
        So far: <span className="num font-semibold text-ink">{view.miles.toFixed(1)}</span> miles · <span className="num font-semibold text-ink">{groupWalks}</span> group walk{groupWalks === 1 ? "" : "s"} ·{" "}
        <span className="num font-semibold text-ink">{m.stamps.length}</span> badge{m.stamps.length === 1 ? "" : "s"}
      </p>
      <div className="mt-3 rounded-2xl bg-surface-2 p-4">
        <div className="text-[12px] text-muted">You wrote on {dayLabel(note.sealedDay)}:</div>
        <p className="mt-1 font-[family-name:var(--font-display)] text-[18px] font-black leading-snug" data-testid="september-note-text">
          “{note.text}”
        </p>
      </div>
      <div role="group" aria-label="Who sees it" className="mt-3 grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1">
        <button type="button" aria-pressed={!note.shared} onClick={() => shareNote(m.id, false)} className={cn("min-h-10 rounded-full text-[13px] font-semibold", !note.shared ? "bg-surface shadow" : "text-muted")}>
          Keep it private
        </button>
        <button
          type="button"
          aria-pressed={note.shared}
          disabled={!chapter}
          onClick={() => shareNote(m.id, true)}
          className={cn("min-h-10 rounded-full text-[13px] font-semibold disabled:opacity-40", note.shared ? "bg-surface shadow" : "text-muted")}
        >
          {chapter ? `Share with ${chapter.city}` : "Share with a circle"}
        </button>
      </div>
      <p className="mt-2 text-[12.5px] leading-snug text-muted" aria-live="polite">
        {note.shared && chapter ? `Shared with your ${chapter.city} circle. You can take it back any time.` : chapter ? "Private. Nobody sees it unless you choose to share." : "Private. Join a circle to share it there — only if you want to."}
      </p>
    </section>
  );
}

/** Summer Path: 100 stepping stones, one per mile, filling in as you move. */
function SummerPath({ miles }: { miles: number }) {
  const full = Math.min(STONES, Math.floor(miles));
  const part = miles >= STONES ? 0 : miles - full;
  return (
    <section aria-label="Summer Path" className="rounded-[22px] border border-line bg-surface p-4" data-testid="summer-path">
      <div className="flex items-baseline justify-between gap-2">
        <span className="eyebrow">Summer Path</span>
        <span className="text-[12.5px] text-muted">One stone = one mile</span>
      </div>
      <div role="img" aria-label={`${miles.toFixed(1)} of 100 stones filled`} className="mt-3 grid grid-cols-10 gap-1.5">
        {Array.from({ length: STONES }, (_, i) => {
          const fill = i < full ? 1 : i === full ? part : 0;
          return (
            <span
              key={i}
              className={cn("relative aspect-square overflow-hidden rounded-full border", fill === 1 ? "border-transparent bg-accent shadow-[0_0_8px_rgba(255,106,19,0.55)]" : "border-line-strong")}
            >
              {fill > 0 && fill < 1 ? <span className="absolute inset-y-0 left-0 bg-accent" style={{ width: `${fill * 100}%` }} /> : null}
              {(i + 1) % 25 === 0 ? <span className="absolute inset-0 rounded-full ring-1 ring-inset ring-sun/70" /> : null}
            </span>
          );
        })}
      </div>
      <p className="mt-3 text-[13px] text-muted">
        <span className="num font-semibold text-ink">{Math.max(0, STONES - miles).toFixed(1)}</span> miles of path still to walk. Rings mark 25, 50, 75 and 100.
      </p>
    </section>
  );
}
