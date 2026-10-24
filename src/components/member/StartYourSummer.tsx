"use client";

// "Start your summer": three calm questions, then you're counted. How you move
// comes first (not how fast), the goal is in your own words, and a circle is
// optional and never preselected. Sharing is asked separately, after joining,
// with every switch off (WA-02): joining a circle is not consent to share.
//
// Never call this "Mile Zero": that is someone else's toolkit, not ours
// to borrow. The optional note to your September self is in the member's own
// words: it is sealed for them alone until September 1, never enters the shared
// record, and is never attributed to anyone else.

import { useState } from "react";
import type { AccessNeed, MovementMode, World } from "@/domain/types";
import { Inspectable } from "@/components/inspect/Inspect";
import { cn } from "@/components/ui/kit";
import { actors, store } from "@/lib/store";
import { dayOf } from "@/domain/calendar";
import { sealNote } from "./septemberNote";
import { InlineReceipt, SwitchRow, useMemberAction } from "./shared";
import type { Receipt } from "@/domain/engine";
import { ACCESS_LABEL } from "./CirclesTab";

const MOVES: { mode: MovementMode; label: string; note: string }[] = [
  { mode: "walk", label: "Walk", note: "Every step counts" },
  { mode: "jog", label: "Jog", note: "Easy and steady" },
  { mode: "run", label: "Run", note: "Any pace at all" },
  { mode: "roll", label: "Roll", note: "Wheelchair miles count the same" },
  { mode: "hike", label: "Hike", note: "Trails and hills" },
];

const TARGETS = [25, 50, 100];

export function StartYourSummer({ world, onDone, onCancel }: { world: World; onDone: (memberId: string) => void; onCancel: () => void }) {
  const [step, setStep] = useState(0);
  const [moves, setMoves] = useState<MovementMode[]>([]);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [note, setNote] = useState("");
  const [target, setTarget] = useState(100);
  // No circle is preselected: choosing one is the member's act, not a default.
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [needs, setNeeds] = useState<AccessNeed[]>([]);
  const [last, setLast] = useState<Receipt | null>(null);
  const [joined, setJoined] = useState<string | null>(null);

  const toggleMove = (m: MovementMode) => setMoves((ms) => (ms.includes(m) ? ms.filter((x) => x !== m) : [...ms, m]));
  const toggleNeed = (n: AccessNeed) => setNeeds((ns) => (ns.includes(n) ? ns.filter((x) => x !== n) : [...ns, n]));

  const canNext = step === 0 ? moves.length > 0 : step === 1 ? name.trim().length > 0 && goal.trim().length > 0 : true;

  const finish = () => {
    const before = new Set(Object.keys(world.members));
    const r = store.dispatch(
      {
        type: "JOIN_MOVEMENT",
        payload: { name: name.trim(), moves, goalLabel: goal.trim(), goalKind: target === 100 ? "season-100" : "own-distance", target, chapterId, needs },
      },
      actors.member("guest"),
      { via: "start-your-summer" },
    );
    setLast(r);
    if (r.outcome !== "applied") return;
    const after = store.get().machine.world;
    const created = Object.keys(after.members).find((id) => !before.has(id));
    if (created) {
      sealNote(created, note, dayOf(after.clock));
      setJoined(created);
      setStep(3);
    }
  };

  if (step === 3 && joined && world.members[joined]) {
    return <ShareStep world={world} memberId={joined} sealed={note.trim().length > 0} onDone={() => onDone(joined)} />;
  }

  return (
    <Inspectable id="mile-zero" className="min-h-full">
      <div className="flex min-h-full flex-col px-5 pb-6 pt-4" aria-label="Start your summer">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-muted">Start your summer · {step + 1} of 3</span>
          <button type="button" onClick={onCancel} className="min-h-11 px-2 text-[14px] font-semibold text-muted">
            Not now
          </button>
        </div>
        <div className="mt-2 flex gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className={cn("h-1 flex-1 rounded-full transition-colors duration-300", i <= step ? "bg-accent" : "bg-surface-2")} />
          ))}
        </div>

        {step === 0 ? (
          <section className="rise-in mt-6" key="s0">
            <h2 className="display text-[30px] leading-[1.05]">How do you like to move?</h2>
            <p className="mt-2 text-[14.5px] leading-snug text-muted">Pick any. Nobody here asks how fast.</p>
            <div className="mt-5 grid gap-2">
              {MOVES.map((o) => {
                const on = moves.includes(o.mode);
                return (
                  <button
                    key={o.mode}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleMove(o.mode)}
                    className={cn("flex min-h-14 items-center justify-between rounded-2xl border px-4 text-left transition-colors", on ? "border-ink bg-ink text-bg" : "border-line-strong bg-surface")}
                  >
                    <span className="text-[17px] font-semibold">{o.label}</span>
                    <span className={cn("text-[13px]", on ? "opacity-80" : "text-muted")}>{o.note}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {step === 1 ? (
          <section className="rise-in mt-6" key="s1">
            <h2 className="display text-[30px] leading-[1.05]">What would make this summer yours?</h2>
            <label className="mt-5 block">
              <span className="eyebrow">Your first name</span>
              <input value={name} onChange={(e) => setName(e.target.value.slice(0, 24))} className="mt-1 min-h-12 w-full rounded-xl border border-line-strong bg-surface px-3 text-[17px]" autoComplete="given-name" />
            </label>
            <label className="mt-4 block">
              <span className="eyebrow">Your goal, in your words</span>
              <textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value.slice(0, 90))}
                rows={2}
                placeholder="Walk to the lake and back without stopping"
                className="mt-1 w-full rounded-xl border border-line-strong bg-surface px-3 py-2.5 text-[16px] leading-snug"
              />
            </label>
            <label className="mt-4 block">
              <span className="eyebrow">A note to your September self · optional</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 140))}
                rows={2}
                placeholder="I'm starting because…"
                aria-describedby="september-note-help"
                className="mt-1 w-full rounded-xl border border-line-strong bg-surface px-3 py-2.5 text-[16px] leading-snug"
              />
              <span id="september-note-help" className="mt-1 block text-[12.5px] leading-snug text-muted">
                Sealed until September 1, when it opens beside your summer story. Only you can open it.
              </span>
            </label>
            <fieldset className="mt-4">
              <legend className="eyebrow">Miles this summer</legend>
              <div className="mt-2 grid grid-cols-3 gap-1 rounded-full bg-surface-2 p-1">
                {TARGETS.map((t) => (
                  <button key={t} type="button" aria-pressed={target === t} onClick={() => setTarget(t)} className={cn("min-h-11 rounded-full text-[15px] font-semibold", target === t ? "bg-surface shadow" : "text-muted")}>
                    <span className="num">{t}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[12.5px] leading-snug text-muted">The challenge is 100 miles, May 1 to August 31 — about 25 a month. Any goal you set counts.</p>
            </fieldset>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="rise-in mt-6" key="s2">
            <h2 className="display text-[30px] leading-[1.05]">Want people to move with?</h2>
            <p className="mt-2 text-[14.5px] leading-snug text-muted">Optional. Circles host free first walks with someone walking at the back, so nobody finishes alone.</p>
            <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="Circle">
              {Object.values(world.chapters).map((c) => (
                <button key={c.id} type="button" aria-pressed={chapterId === c.id} onClick={() => setChapterId(chapterId === c.id ? null : c.id)} className={cn("min-h-12 rounded-2xl border text-[15px] font-semibold", chapterId === c.id ? "border-ink bg-ink text-bg" : "border-line-strong bg-surface")}>
                  {c.city}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[12.5px] leading-snug text-muted">{chapterId ? "Tap it again to go without a circle." : "No circle for now — just you. You can join one later."}</p>
            <fieldset className="mt-5">
              <legend className="eyebrow">Anything that makes an event possible for you?</legend>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(Object.keys(ACCESS_LABEL) as AccessNeed[]).map((n) => (
                  <button key={n} type="button" aria-pressed={needs.includes(n)} onClick={() => toggleNeed(n)} className={cn("min-h-11 rounded-full px-3.5 text-[13.5px] font-semibold", needs.includes(n) ? "bg-ink text-bg" : "border border-line-strong")}>
                    {ACCESS_LABEL[n]}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[12.5px] leading-snug text-muted">Used to filter events for you. Nobody else sees it unless you turn on sharing, which comes next.</p>
            </fieldset>
          </section>
        ) : null}

        <div className="mt-auto pt-6">
          <InlineReceipt receipt={last} className="mb-3" />
          <div className="flex gap-2">
            {step > 0 ? (
              <button type="button" onClick={() => setStep((s) => s - 1)} className="min-h-12 rounded-full border border-line-strong px-5 text-[15px] font-semibold">
                Back
              </button>
            ) : null}
            <button
              type="button"
              disabled={!canNext}
              onClick={() => (step < 2 ? setStep((s) => s + 1) : finish())}
              className="min-h-12 flex-1 rounded-full bg-accent text-[15px] font-semibold text-on-accent disabled:opacity-45"
            >
              {step < 2 ? "Next" : "Start my summer"}
            </button>
          </div>
        </div>
      </div>
    </Inspectable>
  );
}

/** After joining: what to share, asked one switch at a time. Every switch starts off. */
function ShareStep({ world, memberId, sealed, onDone }: { world: World; memberId: string; sealed: boolean; onDone: () => void }) {
  const m = world.members[memberId]!;
  const act = useMemberAction(memberId);
  const chapter = m.chapterId ? world.chapters[m.chapterId] : null;
  const setChapter = (source: "manual" | "event_checkin", granted: boolean) => act.run({ type: "SET_CONSENT", payload: { memberId, purpose: "chapter", source, granted } }, { via: "start-your-summer" });

  return (
    <Inspectable id="mile-zero" className="min-h-full">
      <div className="flex min-h-full flex-col px-5 pb-6 pt-4" aria-label="Start your summer: sharing">
        <span className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-muted">Start your summer · you&apos;re in</span>
        <section className="rise-in mt-5">
          <h2 className="display text-[30px] leading-[1.05]">Welcome, {m.name}. Now, what to share?</h2>
          {sealed ? (
            <p className="mt-3 rounded-2xl bg-surface-2 px-4 py-3 text-[15px] leading-snug" data-testid="note-sealed">
              Your note is sealed until <span className="font-semibold">September 1</span>. Only you can open it.
            </p>
          ) : null}
          <p className="mt-3 text-[14.5px] leading-snug text-muted">Your miles count toward your own summer now. Everything below is off until you turn it on, and you can change it any time in You.</p>
          <div className="mt-4 space-y-2">
            {chapter ? (
              <>
                <SwitchRow checked={m.consents.chapter.manual} onChange={(v) => setChapter("manual", v)} label={`Add the miles I type to ${chapter.city}'s shared total`} />
                <SwitchRow checked={m.consents.chapter.event_checkin} onChange={(v) => setChapter("event_checkin", v)} label={`Add my event check-ins to ${chapter.city}'s shared total`} />
                <SwitchRow checked={m.consents.storyWall} onChange={(on) => act.run({ type: "SET_STORY_WALL", payload: { memberId, on } }, { via: "start-your-summer" })} label={`Show my first name and miles on the ${chapter.city} wall`} />
              </>
            ) : (
              <p className="rounded-2xl border border-line px-4 py-3 text-[14px] leading-snug text-muted">No circle yet, so there&apos;s no shared total to add to.</p>
            )}
            {m.needs.length ? (
              <SwitchRow
                checked={m.consents.needsToOrganizers}
                onChange={(on) => act.run({ type: "SET_NEEDS_SHARING", payload: { memberId, on } }, { via: "start-your-summer" })}
                label="Let organizers of events I join see my access needs"
              />
            ) : null}
          </div>
          <InlineReceipt receipt={act.last} className="mt-3" />
        </section>
        <div className="mt-auto pt-6">
          <button type="button" onClick={onDone} className="min-h-12 w-full rounded-full bg-accent text-[15px] font-semibold text-on-accent">
            Open my app
          </button>
        </div>
      </div>
    </Inspectable>
  );
}
