"use client";

// Two of the new City Circles screens:
//  - The no-app doorway: what someone sees after scanning a poster at the
//    library. Pick what helps (the walks sort themselves, saying what the City
//    Lead has checked), save a spot with a first name, show up — and only after
//    the walk, join in one tap so it counts.
//  - "What am I missing?": the Lead's co-pilot on one walk. It reads the walk,
//    says what to fix, and drafts the fix. Nothing changes or sends until the
//    Lead taps.
// Controls that finish a "Try it" step carry data-step-target.

import { Check, CircleAlert, Lock, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";
import { dayLabel, timeLabel } from "@/domain/calendar";
import type { Receipt } from "@/domain/engine";
import type { MovementEvent, World } from "@/domain/types";
import { AppBody } from "@/components/demo/Phone";
import { cn } from "@/components/ui/kit";
import { changeNote, copilot, fitOf, listWords, NEED_ORDER, NEED_WORDS, rankWalks, type FitState } from "./walkRules";
import { Chip, DateChip, LEAD_CITY, MAYA, NINA, Note, PhoneHeading, Primary, Secondary, refused, send, start, type CirclesDemo } from "./phoneUi";

const leadName = (world: World) => world.members[world.chapters[LEAD_CITY]?.organizers[0] ?? "nina"]?.name ?? "the City Lead";

/** Who's at the back of a walk right now: nobody if they said they can't make it. */
function atBack(world: World, demo: CirclesDemo, e: MovementEvent): string | null {
  return e.sweep && demo.dropout[e.id] !== e.sweep ? world.members[e.sweep]?.name ?? null : null;
}

// ── The guest: no app ────────────────────────────────────────────────────────

export function GuestScreen({ world, demo }: { world: World; demo: CirclesDemo }) {
  const guest = demo.guest;
  const lead = leadName(world);
  return (
    <>
      {/* A web page, not the app: the address bar says so. */}
      <div className="mx-4 mb-2 flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-[12.5px] text-muted">
        <Lock size={12} aria-hidden />
        <span className="min-w-0 truncate">100milesofsummer.com/walk</span>
        <span className="ml-auto shrink-0 rounded-full bg-bg px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.1em]">No app</span>
      </div>
      <AppBody>
        <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-accent">Scanned at the Detroit Public Library</div>
        <h3 className="mt-1 font-[family-name:var(--font-display)] text-[26px] font-black uppercase leading-none tracking-[-0.02em]">Walk with Detroit</h3>
        <p className="mt-1.5 text-[13.5px] text-muted">Free. Every pace. No app needed — just a first name.</p>
        {!guest ? <Pick world={world} demo={demo} lead={lead} /> : guest.memberId ? <Joined world={world} demo={demo} /> : guest.checkedIn ? <Walked world={world} demo={demo} /> : <OnTheList world={world} demo={demo} lead={lead} />}
      </AppBody>
    </>
  );
}

const STATE_WORDS: Record<FitState, (lead: string) => string> = {
  checked: (lead) => `checked by ${lead}`,
  listed: () => "listed, not checked yet",
  missing: () => "not listed",
};

function Pick({ world, demo, lead }: { world: World; demo: CirclesDemo; lead: string }) {
  const upcoming = Object.values(world.events).filter((e) => e.chapterId === LEAD_CITY && e.status === "published" && start(e) > world.clock);
  const walks = rankWalks(upcoming, demo.needs, demo.confirmed);

  return (
    <>
      <section aria-label="What helps you" className="mt-4 rounded-2xl border border-line bg-surface p-3.5">
        <div className="text-[14px] font-bold">What helps you? <span className="font-semibold text-muted">Optional</span></div>
        <div role="group" aria-label="What helps you" className="mt-2 flex flex-wrap gap-1.5">
          {NEED_ORDER.map((n) => {
            const on = demo.needs.includes(n);
            return (
              <button
                key={n}
                type="button"
                aria-pressed={on}
                data-step-target={(n === "shade" && !demo.needs.includes("shade")) || (n === "step-free" && demo.needs.includes("shade") && !demo.needs.includes("step-free")) ? "needs" : undefined}
                onClick={() => demo.toggleNeed(n)}
                className={cn("min-h-10 rounded-full border px-3 text-[13px] font-bold transition-colors", on ? "border-accent bg-accent text-on-accent" : "border-line-strong hover:border-accent")}
              >
                {NEED_WORDS[n]}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[12px] text-muted">Your picks stay on this page. They're never sent anywhere.</p>
      </section>

      <PhoneHeading className="mt-5">{demo.needs.length ? "Best fit first" : "This week"}</PhoneHeading>
      {walks.length === 0 ? <p className="mt-2 text-[14px] text-muted">No walks posted this week. Check back Friday.</p> : null}
      <ul className="mt-2 space-y-3">
        {walks.map((e, i) => (
          <li key={e.id}>
            <GuestWalk event={e} world={world} demo={demo} lead={lead} first={i === 0} saving={demo.saving === e.id} onSave={() => demo.setSaving(e.id)} onCancel={() => demo.setSaving(null)} />
          </li>
        ))}
      </ul>
    </>
  );
}

function GuestWalk({ event: e, world, demo, lead, first, saving, onSave, onCancel }: { event: MovementEvent; world: World; demo: CirclesDemo; lead: string; first: boolean; saving: boolean; onSave: () => void; onCancel: () => void }) {
  const [name, setName] = useState("Tasha");
  const [contact, setContact] = useState("");
  const fit = fitOf(e, demo.needs, demo.confirmed[e.id] ?? []);
  const back = atBack(world, demo, e);
  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    if (name.trim()) demo.saveGuest(name.trim(), e.id);
  };

  return (
    <article aria-label={e.title} className={cn("rounded-2xl border bg-surface p-4", first && demo.needs.length ? "border-accent/60 shadow-[var(--glow)]" : "border-line")}>
      <div className="flex gap-3">
        <DateChip day={e.day} />
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-bold leading-snug">{e.title}</div>
          <div className="mt-0.5 text-[13px] leading-snug text-muted">
            {timeLabel(e.startMinute)} · {e.meetingArea}
          </div>
        </div>
      </div>

      {demo.needs.length ? (
        <div className="mt-3">
          <Chip tone={fit.has === demo.needs.length ? "ok" : fit.has ? "accent" : "neutral"}>
            Fits {fit.has} of {demo.needs.length}
          </Chip>
          <FitRows event={e} demo={demo} lead={lead} />
        </div>
      ) : e.access.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {e.access.map((n) => (
            <Chip key={n}>{NEED_WORDS[n]}</Chip>
          ))}
        </div>
      ) : null}

      <p className="mt-3 text-[13px] leading-snug">{back ? <><span className="font-bold">{back}</span> walks at the back, so nobody finishes last.</> : "Someone always walks at the back, so nobody finishes last."}</p>

      {saving ? (
        <form aria-label={`Save a spot on ${e.title}`} onSubmit={submit} className="rise-in mt-3 space-y-2.5 rounded-xl bg-surface-2 p-3">
          <label className="block">
            <span className="text-[13px] font-bold">First name</span>
            <input value={name} maxLength={24} onChange={(ev) => setName(ev.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-line-strong bg-bg px-3 text-[15px]" />
          </label>
          <label className="block">
            <span className="text-[13px] font-bold">
              Phone or email for one reminder <span className="font-semibold text-muted">· optional</span>
            </span>
            <input value={contact} maxLength={60} onChange={(ev) => setContact(ev.target.value)} placeholder="Optional" className="mt-1 min-h-11 w-full rounded-xl border border-line-strong bg-bg px-3 text-[15px]" />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Primary type="submit" disabled={!name.trim()} data-step-target={first ? "spot" : undefined}>
              Save my spot
            </Primary>
            <button type="button" onClick={onCancel} className="min-h-10 px-2 text-[13px] text-muted">
              Not now
            </button>
          </div>
          <p className="text-[12px] text-muted">That&apos;s all we ask. No app, no password.</p>
        </form>
      ) : (
        <Primary className="mt-3" aria-label={`Save my spot on ${e.title}`} data-step-target={first ? "spot" : undefined} onClick={onSave}>
          Save my spot
        </Primary>
      )}
    </article>
  );
}

function FitRows({ event: e, demo, lead }: { event: MovementEvent; demo: CirclesDemo; lead: string }) {
  const fit = fitOf(e, demo.needs, demo.confirmed[e.id] ?? []);
  return (
    <ul aria-label={`How ${e.title} fits`} className="mt-2 space-y-1">
      {fit.rows.map((r) => (
        <li key={r.need} className={cn("flex items-start gap-2 text-[13px] leading-snug", r.state === "missing" && "text-muted")}>
          <span aria-hidden className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-black", r.state === "checked" ? "bg-ok text-bg" : r.state === "listed" ? "bg-warn-soft text-warn" : "bg-surface-2 text-muted")}>
            {r.state === "checked" ? "✓" : r.state === "listed" ? "•" : "–"}
          </span>
          <span>
            <span className="font-semibold">{NEED_WORDS[r.need]}</span> — {STATE_WORDS[r.state](lead)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function OnTheList({ world, demo, lead }: { world: World; demo: CirclesDemo; lead: string }) {
  const g = demo.guest!;
  const e = world.events[g.eventId];
  if (!e) return null;
  const back = atBack(world, demo, e);
  return (
    <section aria-label="You're on the list" className="mt-4">
      <div className="rise-in rounded-2xl border border-ok/40 bg-ok-soft p-4">
        <div className="text-[19px] font-black leading-tight">You&apos;re on the list, {g.name} ✓</div>
        <p className="mt-1.5 text-[14px] font-semibold">
          {e.title} · {dayLabel(e.day)} · {timeLabel(e.startMinute)}
        </p>
        <p className="text-[13.5px]">{e.meetingArea}</p>
      </div>
      <ul className="mt-3 space-y-2 text-[13.5px] leading-snug">
        <li>
          Look for <span className="font-bold">{lead}</span>, the City Lead. {back ? `${back} walks at the back, so nobody finishes last.` : "Someone walks at the back, so nobody finishes last."}
        </li>
        <li>One reminder comes the day before.</li>
      </ul>
      {demo.needs.length ? (
        <div className="mt-3 rounded-xl border border-line bg-surface p-3">
          <div className="text-[12px] font-bold uppercase tracking-[0.1em] text-muted">What you picked · stays on this page</div>
          <FitRows event={e} demo={demo} lead={lead} />
        </div>
      ) : null}
      <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2.5 text-[13px] leading-snug">No app needed. If you want your miles to count, you can join after the walk — in one tap.</p>
      <button type="button" onClick={demo.dropGuest} className="mt-2 min-h-10 px-1 text-[13px] font-semibold text-muted underline-offset-4 hover:underline">
        Change my walk
      </button>
    </section>
  );
}

function Walked({ world, demo }: { world: World; demo: CirclesDemo }) {
  const g = demo.guest!;
  const e = world.events[g.eventId];
  const miles = e?.distanceOptions[0] ?? 1;
  return (
    <section aria-label="After the walk" className="mt-4">
      <div className="rise-in rounded-2xl border border-accent/50 bg-accent/10 p-4">
        <div className="text-[12px] font-black uppercase tracking-[0.12em] text-accent">Today</div>
        <div className="mt-1 text-[22px] font-black leading-tight">
          You walked {miles} {miles === 1 ? "mile" : "miles"} with Detroit ✓
        </div>
        <p className="mt-2 text-[14px] leading-snug">Want it to count toward your 100 miles this summer? Your first name is already in.</p>
        <Primary className="mt-3 w-full" data-step-target="join" onClick={demo.joinGuest}>
          Join in one tap
        </Primary>
        <p className="mt-2 text-[12.5px] text-muted">Or don&apos;t — you can walk again as a guest anytime.</p>
      </div>
    </section>
  );
}

function Joined({ world, demo }: { world: World; demo: CirclesDemo }) {
  const g = demo.guest!;
  const e = world.events[g.eventId];
  const counted = e?.checkIns.find((c) => c.memberId === g.memberId);
  return (
    <section aria-label="Welcome" className="mt-4">
      <div className="rise-in rounded-2xl border border-ok/40 bg-ok-soft p-4">
        <div className="text-[20px] font-black leading-tight">Welcome to 100 Miles of Summer, {g.name} ✓</div>
        <p className="mt-1.5 text-[14px] font-semibold">{counted ? `${counted.distanceMi} mi counted toward your 100 — your first walk, counted once.` : g.note ?? "Your next walk counts."}</p>
      </div>
      <p className="mt-3 text-[13px] leading-snug text-muted">Every sharing switch starts off. The app is there when you want it — the walks never needed it.</p>
    </section>
  );
}

// ── The Lead: what am I missing? ─────────────────────────────────────────────

export function CoPilot({ world, demo, event: e }: { world: World; demo: CirclesDemo; event: MovementEvent }) {
  const [result, setResult] = useState<Receipt | null>(null);
  const open = demo.opened.has(e.id);
  const guests = demo.guest && demo.guest.eventId === e.id && !demo.guest.memberId ? 1 : 0;
  const untold = demo.untold[e.id] ?? null;
  const offered = new Set(demo.offers.size > 0 ? [MAYA] : []);
  const cp = copilot({ world, event: e, confirmed: demo.confirmed[e.id] ?? [], dropout: demo.dropout[e.id] ?? null, guests, offered, untold: Boolean(untold) });
  // The guiding ring goes on the first fix waiting, in the order the list reads.
  const firstFix = cp.checks.find((c) => !c.ok && (c.id === "back" || c.id === "access" || c.id === "told"))?.id ?? null;
  const ring = (id: string) => (firstFix === id ? "copilot" : undefined);
  const sent = demo.sent[e.id];
  const dropoutName = demo.dropout[e.id] ? world.members[demo.dropout[e.id]!]?.name : null;

  if (!open) {
    return (
      <section aria-label="What am I missing?" className="mt-3 rounded-2xl border border-accent/40 bg-accent/5 p-3.5">
        <div className="flex items-center gap-2 text-[15px] font-bold">
          <Sparkles size={16} className="text-accent" aria-hidden />
          What am I missing?
        </div>
        <p className="mt-0.5 text-[12.5px] leading-snug text-muted">Checks who&apos;s at the back, what&apos;s listed, the heat and the room. It drafts the fix — you decide.</p>
        <Secondary className="mt-2.5 min-h-10 text-[13px]" data-step-target="copilot" onClick={() => demo.openCopilot(e.id)}>
          Check this walk
        </Secondary>
      </section>
    );
  }

  const assign = (memberId: string, name: string) => {
    const r = send({ type: "ASSIGN_SWEEP", payload: { eventId: e.id, memberId } }, NINA);
    setResult(r);
    if (!refused(r)) demo.setUntold(e.id, name);
  };

  return (
    <section aria-label="What am I missing?" className={cn("rise-in mt-3 rounded-2xl border p-3.5", cp.clear ? "border-ok/40 bg-ok-soft/40" : "border-accent/40 bg-accent/5")}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[15px] font-bold">
          <Sparkles size={16} className="text-accent" aria-hidden />
          What am I missing?
        </div>
        {cp.clear ? <Chip tone="ok">All set ✓</Chip> : <Chip tone="warn">{cp.checks.filter((c) => !c.ok).length} to fix</Chip>}
      </div>
      {dropoutName && !cp.checks[0]!.ok ? (
        <p className="rise-in mt-2 rounded-xl bg-bg px-3 py-2 text-[13px] leading-snug">
          <span className="font-bold">{dropoutName}:</span> “So sorry — I can&apos;t make it Saturday.”
        </p>
      ) : null}
      <ul aria-label="Checks" className="mt-2.5 space-y-2.5">
        {cp.checks.map((c) => (
          <li key={c.id} className="flex gap-2.5">
            <span aria-hidden className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full", c.ok ? "bg-ok text-bg" : "bg-warn-soft text-warn")}>
              {c.ok ? <Check size={12} strokeWidth={3} /> : <CircleAlert size={13} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className={cn("text-[13.5px] font-bold leading-snug", c.ok && "font-semibold")}>{c.title}</div>
              <div className="text-[12.5px] leading-snug text-muted">{c.detail}</div>

              {!c.ok && c.id === "back" ? (
                <div role="group" aria-label="Who could walk at the back" className="mt-2 space-y-1.5">
                  {cp.backOptions.slice(0, 3).map((o, i) => (
                    <button
                      key={o.memberId}
                      type="button"
                      aria-label={`Ask ${o.name} to walk at the back`}
                      data-step-target={i === 0 ? ring("back") : undefined}
                      onClick={() => assign(o.memberId, o.name)}
                      className="flex w-full items-center justify-between gap-2 rounded-xl border border-line-strong bg-bg px-3 py-2 text-left hover:border-accent"
                    >
                      <span className="min-w-0">
                        <span className="block text-[13.5px] font-bold">Ask {o.name}</span>
                        <span className="block text-[12px] text-muted">{o.tradeoff}</span>
                      </span>
                      <span aria-hidden className="text-accent">›</span>
                    </button>
                  ))}
                </div>
              ) : null}

              {!c.ok && c.id === "access" ? (
                <Secondary className="mt-2 min-h-10 text-[12.5px]" data-step-target={ring("access")} onClick={() => demo.confirm(e.id, cp.unchecked)}>
                  I walked it — mark {listWords(cp.unchecked).toLowerCase()} checked
                </Secondary>
              ) : null}

              {!c.ok && c.id === "told" && untold ? (
                <div className="mt-2 rounded-xl bg-bg p-2.5">
                  <div className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-muted">Draft to everyone coming</div>
                  <p className="mt-1 text-[13px] leading-snug">“{changeNote(e, untold)}”</p>
                  <Primary
                    className="mt-2 min-h-10 w-full px-3 text-[12.5px]"
                    data-step-target={ring("told")}
                    onClick={() => {
                      demo.sendNote(e.id, changeNote(e, untold));
                      demo.setUntold(e.id, null);
                    }}
                  >
                    Send to {cp.coming}
                  </Primary>
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {sent ? <p className="mt-2.5 text-[12.5px] leading-snug text-ok">Sent to everyone coming ✓ “{sent}”</p> : null}
      <Note receipt={result} />
    </section>
  );
}

/** A guest's row on the Lead's list: first name, no app, checked in by hand like everyone else. */
export function GuestRow({ demo, canCheckIn }: { demo: CirclesDemo; canCheckIn: boolean }) {
  const g = demo.guest!;
  return (
    <li className="flex min-h-14 items-center gap-3 px-3.5 py-2">
      <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[14px] font-black">
        {g.name[0]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-[15px] font-bold">{g.name}</span>
          {!g.checkedIn ? <Chip tone="accent">First walk</Chip> : null}
        </span>
        <span className="block text-[12px] text-muted">Guest · signed up from a poster, no app</span>
      </span>
      {g.checkedIn ? (
        <Chip tone="ok">Was there ✓</Chip>
      ) : canCheckIn ? (
        <Primary className="min-h-10 px-3 text-[12.5px]" aria-label={`Check in ${g.name}`} data-step-target="checkin" onClick={demo.checkInGuest}>
          Check in
        </Primary>
      ) : null}
    </li>
  );
}

